import React, { useEffect, useState } from 'react';
import HighlightableMarkdown from './HighlightableMarkdown';
import MarkdownView from './MarkdownView';
import { coursePayload } from '../utils/courseApi';
import TitleWithMath from './TitleWithMath';
import StudiedToggleButton, { subtopicCardStudiedClasses } from './StudiedToggleButton';
import SubtopicExerciseLink from './SubtopicExerciseLink';
import SubtopicConfidence from './SubtopicConfidence';
import { hasExerciseForLecture, getMaterialTopics } from '../utils/lectureMaterial';
import { subtopicAnchor } from '@shared/noteAnchor.cjs';
import { isSubtopicStudied, normalizeConfidence } from '../utils/studyState';
import PinButton from './PinButton';
import RegenerateFeedbackBar from './RegenerateFeedbackBar';

export default function SubtopicCards({
  topic,
  lecture,
  lecturePath,
  course,
  materialMode,
  exerciseId = '',
  hasApiKey,
  onHighlightSave,
  onTopicUpdated,
  onLectureUpdated,
  onOpenExerciseSubtopic,
  onNotify,
  initialOpenSubtopicId,
  onInitialSubtopicConsumed,
  onToggleSubtopicPin
}) {
  const subtopics = topic?.subtopics || [];
  const path = lecturePath || lecture?.path;
  const [openId, setOpenId] = useState(null);
  const [expandingId, setExpandingId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!initialOpenSubtopicId) return;
    setOpenId(initialOpenSubtopicId);
    onInitialSubtopicConsumed?.();
  }, [initialOpenSubtopicId, onInitialSubtopicConsumed]);

  const showExerciseLinks =
    materialMode === 'lecture' && hasExerciseForLecture(lecture) && onOpenExerciseSubtopic;

  if (!subtopics.length) return null;

  function applyServerLecture(updated) {
    if (!updated) return null;
    onLectureUpdated?.(updated);
    const topics = getMaterialTopics(updated, materialMode, exerciseId);
    const freshTopic = topics?.find((t) => t.id === topic.id);
    if (freshTopic) onTopicUpdated?.(freshTopic);
    return freshTopic;
  }

  async function reloadLecture() {
    if (!path) return null;
    const fresh = await window.api.getLecture(path);
    return applyServerLecture(fresh);
  }

  async function handleToggleSubtopicStudied(sub, e) {
    e?.stopPropagation();
    if (busyId || !path || !sub?.id) return;

    setBusyId(sub.id);
    try {
      const updated = await window.api.toggleSubtopicStudied({
        lecturePath: path,
        topicId: topic.id,
        subtopicId: sub.id,
        materialMode,
        exerciseId: materialMode === 'exercise' ? exerciseId : ''
      });
      if (!updated) {
        onNotify?.('Could not update studied state — try again');
        await reloadLecture();
        return;
      }
      applyServerLecture(updated);
      await reloadLecture();
    } catch {
      onNotify?.('Could not update studied state');
      await reloadLecture();
    } finally {
      setBusyId(null);
    }
  }

  async function handleCycleConfidence(sub, e) {
    e?.stopPropagation();
    if (busyId || !path || !sub?.id) return;
    if (!isSubtopicStudied(sub)) {
      onNotify?.('Mark this subtopic studied before setting confidence');
      return;
    }

    setBusyId(sub.id);
    try {
      const updated = await window.api.cycleSubtopicConfidence({
        lecturePath: path,
        topicId: topic.id,
        subtopicId: sub.id
      });
      if (!updated) {
        onNotify?.('Could not update confidence');
        await reloadLecture();
        return;
      }
      applyServerLecture(updated);
      await reloadLecture();
    } catch {
      onNotify?.('Could not update confidence');
      await reloadLecture();
    } finally {
      setBusyId(null);
    }
  }

  async function handleExpand(subtopic) {
    if (subtopic.deepMarkdown) {
      setOpenId((id) => (id === subtopic.id ? null : subtopic.id));
      return;
    }
    if (!hasApiKey) return;
    setExpandingId(subtopic.id);
    try {
      const res = await window.api.expandSubtopic({
        lecturePath: path,
        topicId: topic.id,
        subtopicId: subtopic.id,
        materialMode,
        exerciseId: materialMode === 'exercise' ? exerciseId : '',
        ...coursePayload(course)
      });
      if (res.success && res.topic) {
        onTopicUpdated?.(res.topic);
        setOpenId(subtopic.id);
      } else if (res?.error) {
        onNotify?.(res.error);
      }
    } catch {
      onNotify?.('Could not expand subtopic');
    } finally {
      setExpandingId(null);
    }
  }

  async function handleRegenerateSubtopic(subtopic, feedback) {
    if (!hasApiKey || !path) return;
    setExpandingId(subtopic.id);
    try {
      const res = await window.api.expandSubtopic({
        lecturePath: path,
        topicId: topic.id,
        subtopicId: subtopic.id,
        materialMode,
        exerciseId: materialMode === 'exercise' ? exerciseId : '',
        force: true,
        feedback,
        ...coursePayload(course)
      });
      if (res.success && res.topic) {
        onTopicUpdated?.(res.topic);
        setOpenId(subtopic.id);
      } else if (res?.error) {
        onNotify?.(res.error);
      }
    } catch {
      onNotify?.('Regeneration failed');
    } finally {
      setExpandingId(null);
    }
  }

  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide mb-3">
        Subtopics ({subtopics.length})
      </h2>
      <div className="grid gap-3">
        {subtopics.map((sub) => {
          const isOpen = openId === sub.id;
          const loading = expandingId === sub.id;
          const subStudied = isSubtopicStudied(sub);
          const busy = busyId === sub.id;
          const confidence = normalizeConfidence(sub.studyConfidence);

          return (
            <div
              key={sub.id}
              className={`rounded-xl border overflow-hidden transition-all duration-200 ${subtopicCardStudiedClasses(subStudied)}`}
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold border flex-shrink-0 ${
                          subStudied
                            ? 'bg-emerald-600/30 border-emerald-500/60 text-emerald-300'
                            : 'bg-bg-primary/60 border-border-DEFAULT text-text-muted'
                        }`}
                        aria-hidden
                      >
                        {subStudied ? '✓' : '○'}
                      </span>
                      <h3
                        className={`font-medium ${
                          subStudied ? 'text-emerald-100/90' : 'text-text-primary'
                        }`}
                      >
                        <TitleWithMath text={sub.title} />
                      </h3>
                    </div>
                    {sub.summary && !isOpen && (
                      <p className="text-xs text-text-muted mt-1 line-clamp-2 leading-relaxed pl-8">
                        {sub.summary}
                      </p>
                    )}
                    {sub.deepMarkdown && !isOpen && (
                      <p className="text-[10px] text-accent/80 mt-1 pl-8">Deeper explanation ready</p>
                    )}
                    {showExerciseLinks && sub.exerciseLink && (
                      <div className="pl-8 mt-2">
                        <SubtopicExerciseLink
                          link={sub.exerciseLink}
                          onOpen={onOpenExerciseSubtopic}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0 items-end">
                    <PinButton
                      pinned={Boolean(sub.pinned)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSubtopicPin?.(sub.id);
                      }}
                      title={sub.pinned ? 'Unpin subtopic' : 'Pin subtopic'}
                    />
                    <StudiedToggleButton
                      studied={subStudied}
                      loading={busy}
                      onClick={(e) => handleToggleSubtopicStudied(sub, e)}
                    />
                    {subStudied && materialMode === 'lecture' && (
                      <SubtopicConfidence
                        value={confidence}
                        loading={busy}
                        onCycle={(e) => handleCycleConfidence(sub, e)}
                      />
                    )}
                    <button
                      type="button"
                      disabled={loading || (!hasApiKey && !sub.deepMarkdown)}
                      onClick={() => handleExpand(sub)}
                      className="text-xs px-2.5 py-1 rounded-md border border-border-DEFAULT text-text-secondary hover:border-accent hover:text-accent disabled:opacity-40"
                    >
                      {loading ? 'Loading…' : sub.deepMarkdown ? (isOpen ? 'Hide' : 'Open') : 'Go deeper'}
                    </button>
                  </div>
                </div>
              </div>
              {isOpen && sub.deepMarkdown && (
                <div className="border-t border-border-subtle px-4 py-4 bg-bg-primary/30">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <p className="text-[10px] font-medium text-accent uppercase tracking-wide">
                      Deeper · <TitleWithMath text={sub.title} className="text-accent" />
                    </p>
                    <RegenerateFeedbackBar
                      busy={loading}
                      disabled={!hasApiKey}
                      onRegenerate={(feedback) => handleRegenerateSubtopic(sub, feedback)}
                    />
                  </div>
                  <HighlightableMarkdown
                    markdownSource={sub.deepMarkdown}
                    sectionAnchor={subtopicAnchor(sub)}
                    pinSource={{
                      lecturePath: path,
                      lectureTitle: lecture?.title,
                      topicTitle: topic?.title,
                      subtopicTitle: sub.title,
                      sourceType: 'subtopic'
                    }}
                    askContext={{
                      course,
                      lecturePath: path,
                      topicId: topic?.id,
                      materialMode,
                      exerciseId: materialMode === 'exercise' ? exerciseId : '',
                      lectureTitle: lecture?.title || '',
                      topicTitle: topic?.title || '',
                      subtopicTitle: sub.title
                    }}
                    hasApiKey={hasApiKey}
                    onHighlight={(text, meta) =>
                      onHighlightSave(text, 'deep', sub, meta)
                    }
                  >
                    {sub.deepMarkdown}
                  </HighlightableMarkdown>
                </div>
              )}
              {isOpen && sub.summary && !sub.deepMarkdown && (
                <div className="border-t border-border-subtle px-4 py-3">
                  <MarkdownView className="markdown-body-chat">{sub.summary}</MarkdownView>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
