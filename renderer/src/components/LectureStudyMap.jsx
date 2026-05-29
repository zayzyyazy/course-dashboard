import React from 'react';
import LectureProgressBar from './LectureProgressBar';
import { computeLectureProgress } from '../utils/lectureProgress';
import { getMaterialTopics } from '../utils/lectureMaterial';
import { StudyDepthBadge } from './StudyDepthBadge';
import TitleWithMath from './TitleWithMath';
import { hasSubtopics, isTopicStudied, isSubtopicStudied, topicStudyStatus } from '../utils/studyState';

export default function LectureStudyMap({
  lecture,
  open,
  onClose,
  onOpenTopic,
  materialMode = 'lecture',
  exerciseId = '',
  onLectureUpdated
}) {
  if (!open || !lecture) return null;

  const { total, studied, remaining } = computeLectureProgress(lecture, materialMode, exerciseId);

  async function toggleTopic(topic) {
    if (hasSubtopics(topic)) return;
    const updated = await window.api.markTopicStudied({
      lecturePath: lecture.path,
      topicId: topic.id,
      materialMode,
      exerciseId: materialMode === 'exercise' ? exerciseId : ''
    });
    if (updated) onLectureUpdated?.(updated);
  }

  async function toggleSubtopic(topicId, subtopicId) {
    const updated = await window.api.toggleSubtopicStudied({
      lecturePath: lecture.path,
      topicId,
      subtopicId,
      materialMode,
      exerciseId: materialMode === 'exercise' ? exerciseId : ''
    });
    if (updated) onLectureUpdated?.(updated);
  }

  const topics = getMaterialTopics(lecture, materialMode, exerciseId);

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[55] bg-black/50 no-drag"
        aria-label="Close study map"
        onClick={onClose}
      />
      <aside className="fixed top-0 right-0 bottom-0 z-[56] w-full max-w-md bg-bg-secondary border-l border-border-DEFAULT shadow-2xl flex flex-col no-drag">
        <div className="h-8 drag-region flex-shrink-0" />
        <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle">
          <div>
            <p className="text-xs text-accent uppercase tracking-wide font-medium">Study map</p>
            <h2 className="text-base font-semibold text-text-primary">
              <TitleWithMath text={lecture.title} />
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text-primary text-xl px-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 border-b border-border-subtle bg-bg-secondary/60">
          <LectureProgressBar lecture={lecture} materialMode={materialMode} />
          {total > 0 && (
            <p className="text-xs text-text-muted mt-2">
              {remaining > 0
                ? `${remaining} topic${remaining === 1 ? '' : 's'} remaining`
                : 'Complete — all topics studied'}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {lecture.courseThread?.summary && (
            <div className="rounded-lg border border-accent/25 bg-accent/5 p-3 text-sm text-text-secondary leading-relaxed">
              <p className="text-xs font-medium text-accent mb-1">Course thread</p>
              {lecture.courseThread.summary}
            </div>
          )}

          <ol className="space-y-4">
            {topics.map((topic, index) => {
              const isStudied = isTopicStudied(topic);
              const topicHasSubs = hasSubtopics(topic);
              return (
                <li key={topic.id} className="relative pl-1">
                  <div className="flex items-start gap-2">
                    {topicHasSubs ? (
                      <span
                        className={`text-xs font-mono mt-0.5 w-5 flex-shrink-0 ${
                          isStudied ? 'text-accent' : 'text-text-muted'
                        }`}
                      >
                        {isStudied ? '✓' : index + 1}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleTopic(topic)}
                        title={isStudied ? 'Unmark studied' : 'Mark studied'}
                        className={`text-xs font-mono mt-0.5 w-5 flex-shrink-0 text-left ${
                          isStudied ? 'text-accent' : 'text-text-muted hover:text-accent'
                        }`}
                      >
                        {isStudied ? '✓' : index + 1}
                      </button>
                    )}
                    <div className="flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          onOpenTopic(lecture, topic, materialMode, {
                            exerciseId: materialMode === 'exercise' ? exerciseId : ''
                          });
                          onClose();
                        }}
                        className="text-left w-full group"
                      >
                        <p
                          className={`font-medium transition-colors ${
                            isStudied
                              ? 'text-text-muted line-through decoration-accent/40'
                              : 'text-text-primary group-hover:text-accent'
                          }`}
                        >
                          <TitleWithMath text={topic.title} />
                        </p>
                        <div className="mt-1">
                          <StudyDepthBadge item={topic} parentImportance={topic.importance} compact />
                        </div>
                      </button>

                      {topic.subtopics?.length > 0 && materialMode !== 'exercise' && (
                        <ul className="mt-2 space-y-1 border-l border-border-subtle ml-1 pl-3">
                          {topic.subtopics.map((sub) => {
                            const subStudied = isSubtopicStudied(sub);
                            return (
                              <li
                                key={sub.id}
                                className="text-xs text-text-secondary flex gap-2 items-center"
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleSubtopic(topic.id, sub.id)}
                                  title={subStudied ? 'Unmark studied' : 'Mark studied'}
                                  className={
                                    subStudied
                                      ? 'text-emerald-400 font-bold hover:text-emerald-300'
                                      : 'text-amber-600/80 hover:text-amber-400'
                                  }
                                >
                                  {subStudied ? '✓' : '○'}
                                </button>
                                <span
                                  className={
                                    subStudied ? 'text-emerald-400/90 line-through decoration-emerald-600/50' : ''
                                  }
                                >
                                  <TitleWithMath text={sub.title} />
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}

                      {!topicHasSubs && (
                        <button
                          type="button"
                          onClick={() => toggleTopic(topic)}
                          className={`inline-block mt-1.5 text-[10px] px-1.5 py-0.5 rounded ${
                            isStudied
                              ? 'bg-accent/20 text-accent'
                              : 'bg-bg-hover text-text-muted hover:text-accent'
                          }`}
                        >
                          {isStudied ? 'Studied · tap to undo' : 'Mark studied'}
                        </button>
                      )}
                      {topicHasSubs && (
                        <span
                          className={`inline-block mt-1.5 text-[10px] px-1.5 py-0.5 rounded border ${
                            topicStudyStatus(topic) === 'complete'
                              ? 'bg-emerald-600/20 text-emerald-300 border-emerald-600/40'
                              : topicStudyStatus(topic) === 'in_progress'
                                ? 'bg-amber-950/25 text-amber-200/80 border-amber-900/40'
                                : 'bg-bg-hover text-text-muted border-border-subtle'
                          }`}
                        >
                          {topicStudyStatus(topic) === 'complete'
                            ? 'All subtopics done'
                            : topicStudyStatus(topic) === 'in_progress'
                              ? 'In progress — toggle subtopics'
                              : 'Mark subtopics in topic view'}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </aside>
    </>
  );
}
