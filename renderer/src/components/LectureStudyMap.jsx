import React from 'react';

export default function LectureStudyMap({ lecture, open, onClose, onOpenTopic }) {
  if (!open || !lecture) return null;

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
            <h2 className="text-base font-semibold text-text-primary">{lecture.title}</h2>
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

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {lecture.courseThread?.summary && (
            <div className="rounded-lg border border-accent/25 bg-accent/5 p-3 text-sm text-text-secondary leading-relaxed">
              <p className="text-xs font-medium text-accent mb-1">Course thread</p>
              {lecture.courseThread.summary}
              {(lecture.courseThread.continuesFrom || lecture.courseThread.leadsTo) && (
                <ul className="mt-2 text-xs text-text-muted space-y-1 list-disc pl-4">
                  {lecture.courseThread.continuesFrom && (
                    <li>Builds on: {lecture.courseThread.continuesFrom}</li>
                  )}
                  {lecture.courseThread.leadsTo && (
                    <li>Prepares: {lecture.courseThread.leadsTo}</li>
                  )}
                </ul>
              )}
            </div>
          )}

          <ol className="space-y-4">
            {(lecture.topics || []).map((topic, index) => (
              <li key={topic.id} className="relative pl-1">
                <div className="flex items-start gap-2">
                  <span className="text-xs font-mono text-accent mt-0.5 w-5 flex-shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenTopic(lecture, topic);
                        onClose();
                      }}
                      className="text-left w-full group"
                    >
                      <p className="font-medium text-text-primary group-hover:text-accent transition-colors">
                        {topic.title}
                      </p>
                      {topic.importance && (
                        <p className="text-[10px] uppercase tracking-wide text-text-muted mt-0.5">
                          {topic.importance}
                        </p>
                      )}
                    </button>

                    {topic.subtopics?.length > 0 && (
                      <ul className="mt-2 space-y-1 border-l border-border-subtle ml-1 pl-3">
                        {topic.subtopics.map((sub, si) => (
                          <li key={si} className="text-xs text-text-secondary flex gap-2">
                            <span className="text-text-muted">○</span>
                            <span>{sub.title}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {(topic.connections?.buildsOn?.length > 0 ||
                      topic.connections?.relatedInCourse?.length > 0) && (
                      <p className="text-[10px] text-text-muted mt-2 leading-snug">
                        {topic.connections.buildsOn?.length > 0 &&
                          `Builds on: ${topic.connections.buildsOn.join('; ')}`}
                        {topic.connections.relatedInCourse?.length > 0 &&
                          `${topic.connections.buildsOn?.length ? ' · ' : ''}Related: ${topic.connections.relatedInCourse.join('; ')}`}
                      </p>
                    )}

                    <span
                      className={`inline-block mt-1.5 text-[10px] px-1.5 py-0.5 rounded ${
                        topic.studyState === 'studied'
                          ? 'bg-accent/20 text-accent'
                          : 'bg-bg-hover text-text-muted'
                      }`}
                    >
                      {topic.studyState === 'studied' ? 'Studied' : topic.card ? 'Card ready' : '—'}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </>
  );
}
