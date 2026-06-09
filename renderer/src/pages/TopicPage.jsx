import React, { useEffect, useMemo, useState } from 'react';
import HighlightableMarkdown from '../components/HighlightableMarkdown';
import SaveHighlightNoteModal from '../components/SaveHighlightNoteModal';
import PromoteTopicModal from '../components/PromoteTopicModal';
import TopicAskPanel from '../components/TopicAskPanel';
import SubtopicCards from '../components/SubtopicCards';
import { coursePayload } from '../utils/courseApi';
import { getLectureTopicTitle, resolveActiveExerciseId, getMaterialTopics } from '../utils/lectureMaterial';
import { makeQuickNoteTitle } from '../utils/quickNoteTitle';
import { StudyDepthBadge } from '../components/StudyDepthBadge';
import TitleWithMath from '../components/TitleWithMath';
import { hasSubtopics, isTopicStudied } from '../utils/studyState';
import { subtopicAnchor } from '@shared/noteAnchor.cjs';
import { notesForLinkPicker } from '@shared/noteCardMarkers.cjs';
import TopicStatusBadge from '../components/TopicStatusBadge';
import { askChatKey } from '../utils/askChatStore';
import PinButton from '../components/PinButton';
import RegenerateFeedbackBar from '../components/RegenerateFeedbackBar';
import DeepPdfFigures from '../components/DeepPdfFigures';
import StudyPageShell from '../components/StudyPageShell';
import { useCompactLayout } from '../hooks/useCompactLayout';
import { courseHasPracticeCoach, openPracticeCoach, resolveEpcVaultKey } from '../utils/openPracticeCoach';

export default function TopicPage({
  course,
  lecture,
  topic,
  materialMode = 'lecture',
  exerciseId = '',
  hasApiKey,
  onBack,
  onNoteSaved,
  notesCount = 0,
  onGoToNotes,
  onOpenSavedNote,
  onOpenExerciseSubtopic,
  onNotify,
  initialOpenSubtopicId,
  onInitialSubtopicConsumed,
  onPromoteTopic,
  onOpenPromotedUnit,
  onTopicStudied,
  onTopicUpdated,
  sidebarHidden,
  onToggleSidebar
}) {
  const [expanding, setExpanding] = useState(false);
  const [deepMd, setDeepMd] = useState(topic?.card?.deepMarkdown || '');

  useEffect(() => {
    setDeepMd(topic?.card?.deepMarkdown || '');
  }, [topic?.id, topic?.card?.deepMarkdown]);
  const [pendingHighlight, setPendingHighlight] = useState(null);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [lectureNotes, setLectureNotes] = useState([]);
  const compact = useCompactLayout();

  const isExercise = materialMode === 'exercise';
  const activeExerciseId = resolveActiveExerciseId(lecture, exerciseId);
  const selectionAskContext = {
    course,
    lecturePath: lecture?.path,
    topicId: topic?.id,
    materialMode,
    exerciseId: activeExerciseId,
    lectureTitle: lecture?.title || '',
    topicTitle: topic?.title || ''
  };
  const isSourceLecture = lecture?.itemType !== 'promoted';
  const canPromote = isSourceLecture && !isExercise && !topic?.promotedToUnitId && hasApiKey;
  const topicHasSubtopics = hasSubtopics(topic);
  const isStudied = isTopicStudied(topic);
  const showPracticeCoach =
    !isExercise && courseHasPracticeCoach(course) && lecture?.id && topic?.id;
  const epcVaultKey = resolveEpcVaultKey(course);

  async function handleOpenTopicPractice(subtopicId = '') {
    const firstSub = topic?.subtopics?.find((s) => s?.id);
    try {
      await openPracticeCoach(
        {
          courseStorageKey: course?.storageKey,
          courseName: course?.name,
          unitId: lecture?.id || '',
          topicId: topic?.id || '',
          subtopicId: subtopicId || firstSub?.id || ''
        },
        onNotify
      );
    } catch {
      /* onNotify already shown */
    }
  }

  async function loadLectureNotes() {
    if (!lecture?.path) return;
    try {
      const res = await window.api.listLectureNotes(lecture.path);
      if (res?.success) setLectureNotes(res.notes || []);
    } catch {
      setLectureNotes([]);
    }
  }

  useEffect(() => {
    loadLectureNotes();
  }, [lecture?.path]);

  const linkableNotesForModal = useMemo(() => {
    if (!pendingHighlight?.subtopicId) return [];
    return notesForLinkPicker(lectureNotes, {
      topicId: topic.id,
      subtopicId: pendingHighlight.subtopicId,
      materialMode,
      exerciseId: activeExerciseId
    });
  }, [lectureNotes, pendingHighlight, topic.id, materialMode, activeExerciseId]);

  async function handleToggleStudied() {
    const updated = await window.api.markTopicStudied({
      lecturePath: lecture.path,
      topicId: topic.id,
      materialMode,
      exerciseId: isExercise ? activeExerciseId : ''
    });
    if (!updated) return;
    const freshTopic =
      getMaterialTopics(updated, materialMode, activeExerciseId).find((t) => t.id === topic.id) ||
      topic;
    onTopicStudied?.(updated);
    onTopicUpdated?.(freshTopic);
  }

  async function handleExpandTopic() {
    if (deepMd) return;
    if (!hasApiKey) return;
    setExpanding(true);
    try {
      const res = await window.api.expandTopic({
        lecturePath: lecture.path,
        topicId: topic.id,
        materialMode,
        exerciseId: isExercise ? activeExerciseId : '',
        ...coursePayload(course)
      });
      if (res.success) {
        setDeepMd(res.markdown);
        if (res.topic) onTopicUpdated?.(res.topic);
      } else if (res?.error) {
        onNotify?.(res.error);
      }
    } catch {
      onNotify?.('Could not expand topic');
    } finally {
      setExpanding(false);
    }
  }

  async function handleRegenerateTopic(feedback) {
    if (!hasApiKey) return;
    setExpanding(true);
    try {
      const res = await window.api.expandTopic({
        lecturePath: lecture.path,
        topicId: topic.id,
        materialMode,
        exerciseId: isExercise ? activeExerciseId : '',
        force: true,
        feedback,
        ...coursePayload(course)
      });
      if (res.success) {
        setDeepMd(res.markdown);
        onNotify?.('Regenerated');
      } else if (res?.error) {
        onNotify?.(res.error);
      }
    } catch {
      onNotify?.('Regeneration failed');
    } finally {
      setExpanding(false);
    }
  }

  async function handleToggleTopicPin() {
    const res = await window.api.toggleTopicPin({
      lecturePath: lecture.path,
      topicId: topic.id,
      materialMode,
      exerciseId: isExercise ? activeExerciseId : ''
    });
    if (res?.success && res.lecture) {
      const topics = getMaterialTopics(res.lecture, materialMode, activeExerciseId);
      const freshTopic = topics?.find((t) => t.id === topic.id);
      onTopicStudied?.(res.lecture);
      if (freshTopic) onTopicUpdated?.(freshTopic);
      const pinned = Boolean(freshTopic?.pinned);
      onNotify?.(pinned ? 'Pinned — see Study overview (Home)' : 'Unpinned');
    }
  }

  function openSaveModal(text, source, subtopic = null, anchorMeta = {}) {
    const sectionAnchor =
      anchorMeta.sectionAnchor ||
      (subtopic ? subtopicAnchor(subtopic) : '');
    const sourceKind =
      source === 'deep'
        ? 'deeper-subtopic'
        : source === 'card'
          ? 'topic-summary'
          : source || 'topic-summary';
    const saveMode =
      anchorMeta.saveMode ||
      (source === 'deep' && subtopic ? 'card' : 'notes');
    setPendingHighlight({
      text,
      source,
      sourceKind,
      sectionAnchor,
      subtopicId: subtopic?.id || '',
      subtopicTitle: subtopic?.title || '',
      saveMode
    });
  }

  async function handleQuickSaveFromChat({ excerpt, isSelection }) {
    const title = makeQuickNoteTitle(excerpt, topic.title);
    return window.api.saveHighlightNote({
      lecturePath: lecture.path,
      ...coursePayload(course),
      topicId: topic.id,
      topicTitle: topic.title,
      source: 'tutorChat',
      materialMode,
      exerciseId: isExercise ? activeExerciseId : '',
      highlightedText: isSelection
        ? excerpt.slice(0, 4000)
        : `Tutor answer · ${topic.title}`.slice(0, 4000),
      note: excerpt,
      refinedNote: excerpt,
      title
    }).then((result) => {
      if (result.success) onNoteSaved?.(result.note);
      return result;
    });
  }

  async function handleSaveNoteManual({ note, keyIdeas, refinedNote, title }) {
    const body = (refinedNote || note || '').trim();
    if (!body) {
      throw new Error('Add a note or use Save with AI');
    }
    const result = await window.api.saveHighlightNote({
      lecturePath: lecture.path,
      topicId: topic.id,
      topicTitle: topic.title,
      subtopicId: pendingHighlight.subtopicId || '',
      subtopicTitle: pendingHighlight.subtopicTitle || '',
      sectionAnchor: pendingHighlight.sectionAnchor || '',
      sourceKind: pendingHighlight.sourceKind || pendingHighlight.source,
      markdownSource: cardMd,
      source: pendingHighlight.source,
      materialMode,
      exerciseId: isExercise ? activeExerciseId : '',
      highlightedText: pendingHighlight.text,
      note: body,
      keyIdeas,
      refinedNote: body,
      title
    });
    setPendingHighlight(null);
    if (result.success) {
      await loadLectureNotes();
      onNoteSaved?.(result.note);
    } else {
      throw new Error(result.error || 'Could not save note');
    }
  }

  async function handleSaveNoteWithAI(result) {
    setPendingHighlight(null);
    await loadLectureNotes();
    onNoteSaved?.(result.note);
    onNotify?.(result.message || (result.mode === 'appended' ? 'Added to existing note' : 'Note saved'));
  }

  async function handleSaveOnCard({ shortNote, relatedNoteId }) {
    const short = String(shortNote || '').trim();
    const result = await window.api.saveHighlightNote({
      lecturePath: lecture.path,
      topicId: topic.id,
      topicTitle: topic.title,
      subtopicId: pendingHighlight.subtopicId || '',
      subtopicTitle: pendingHighlight.subtopicTitle || '',
      sectionAnchor: pendingHighlight.sectionAnchor || '',
      sourceKind: pendingHighlight.sourceKind || 'deeper-subtopic',
      markdownSource: cardMd,
      source: pendingHighlight.source,
      materialMode,
      exerciseId: isExercise ? activeExerciseId : '',
      highlightedText: pendingHighlight.text,
      note: short,
      refinedNote: short || pendingHighlight.text,
      relatedNoteId: relatedNoteId || '',
      cardMarker: true
    });
    setPendingHighlight(null);
    if (result.success) {
      await loadLectureNotes();
      onNoteSaved?.(result.note);
      onNotify?.('Highlight saved on card');
    } else {
      throw new Error(result.error || 'Could not save highlight');
    }
  }

  async function handleDeleteCardMarker(noteId) {
    if (!lecture?.path || !noteId) return;
    const res = await window.api.deleteLectureNote({
      lecturePath: lecture.path,
      noteId
    });
    if (res?.success) {
      await loadLectureNotes();
      onNoteSaved?.();
      onNotify?.('Highlight removed from card');
    }
  }

  async function handleConfirmPromote() {
    setShowPromoteModal(false);
    await onPromoteTopic?.({
      lecturePath: lecture.path,
      topicId: topic.id
    });
  }

  function handleSubtopicTopicUpdated(updatedTopic) {
    onTopicUpdated?.(updatedTopic);
  }

  const cardMd = topic?.card?.markdown || '_No study card yet._';

  return (
    <>
    <StudyPageShell>
          <button type="button" onClick={onBack} className="text-xs text-text-muted hover:text-accent mb-3">
            ← <TitleWithMath text={lecture.title} />
            {isExercise ? ' · Übung' : ''}
          </button>

          {isExercise && (
            <p className="text-xs text-emerald-400/90 uppercase tracking-wide mb-2">Übung / practice</p>
          )}

          {notesCount > 0 && (
            <button
              type="button"
              onClick={onGoToNotes}
              className="mb-4 w-full flex items-center justify-between gap-2 rounded-lg border border-border-subtle bg-bg-secondary/25 px-3 py-2 text-left hover:border-accent/30 transition-colors"
            >
              <span className="text-xs text-text-secondary">
                <span className="font-medium text-text-primary">{notesCount}</span> notes on this lecture
              </span>
              <span className="text-[11px] text-accent font-medium">View →</span>
            </button>
          )}

          {topic.promotedToUnitId && (
            <button
              type="button"
              onClick={() => onOpenPromotedUnit?.(topic.promotedToUnitId)}
              className="mb-4 w-full text-left rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-400/90 hover:bg-amber-950/30"
            >
              Open study unit for this topic →
            </button>
          )}

          <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
            <div className="min-w-0">
              <h1 className="study-title text-2xl font-bold text-text-primary">
                <TitleWithMath text={topic.title} />
              </h1>
              {!isExercise && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <StudyDepthBadge item={topic} parentImportance={topic.importance} />
                  {topicHasSubtopics && <TopicStatusBadge topic={topic} compact />}
                  {!topicHasSubtopics && (
                    <span className="text-[10px] text-text-muted">likely focus · estimate</span>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
              {onToggleSidebar && (
                <button
                  type="button"
                  onClick={onToggleSidebar}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-border-DEFAULT text-text-muted hover:text-accent hover:border-accent/40"
                  title={
                    sidebarHidden
                      ? 'Sidebar einblenden (⌘\\)'
                      : compact
                        ? 'Sidebar ausblenden — mehr Platz (⌘\\)'
                        : 'Sidebar ausblenden (⌘\\)'
                  }
                >
                  {sidebarHidden ? '☰ Kurse' : compact ? '◧ Focus' : '◧ Vollbild'}
                </button>
              )}
              <PinButton
                pinned={Boolean(topic.pinned)}
                onClick={handleToggleTopicPin}
                title={topic.pinned ? 'Unpin topic' : 'Pin topic'}
              />
              {canPromote && (
                <button
                  type="button"
                  onClick={() => setShowPromoteModal(true)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-amber-900/50 text-amber-400/90 hover:bg-amber-950/25"
                >
                  Promote to study unit
                </button>
              )}
              {!topicHasSubtopics && !isExercise && (
                <button
                  type="button"
                  onClick={handleToggleStudied}
                  className={`text-xs px-3 py-1.5 rounded-lg border ${
                    isStudied
                      ? 'border-accent/50 bg-accent/15 text-accent'
                      : 'border-border-DEFAULT text-text-secondary hover:border-accent hover:text-accent'
                  }`}
                >
                  {isStudied ? 'Studied ✓' : 'Mark studied'}
                </button>
              )}
              {showPracticeCoach && (
                <button
                  type="button"
                  onClick={() => handleOpenTopicPractice()}
                  className="text-xs px-3 py-1.5 rounded-lg border border-violet-500/50 bg-violet-500/20 text-violet-100 font-medium hover:border-violet-400 hover:bg-violet-500/30"
                  title="Generate exercises in Exam Practice Coach"
                >
                  Practice exercises →
                </button>
              )}
            </div>
          </div>

          {showPracticeCoach && topicHasSubtopics && (
            <div className="mb-4 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-violet-100/90">
                Finished studying? Open <span className="font-medium">Exercise Coach</span> for this topic — or use
                Practice on each subtopic below.
              </p>
              <button
                type="button"
                onClick={() => handleOpenTopicPractice()}
                className="text-xs px-3 py-1.5 rounded-md border border-violet-400/60 bg-violet-500/25 text-violet-50 font-medium hover:bg-violet-500/35 flex-shrink-0"
              >
                Practice this topic →
              </button>
            </div>
          )}

          <p className="text-xs text-text-muted mb-4">
            Select text in the topic summary or a subtopic → <span className="text-accent">Save note</span>.
            Highlight tutor answers below to quick-save as a note for this topic.
            {canPromote && (
              <>
                {' '}
                Use <span className="text-amber-400/90">Promote to study unit</span> if this topic is too
                large for one card.
              </>
            )}
          </p>

          {isExercise && topic.lectureLink?.note && (
            <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-4 py-3 mb-4 text-sm text-text-secondary">
              <p className="text-xs font-medium text-emerald-400/90 mb-1">Linked lecture topic</p>
              <p>
                {getLectureTopicTitle(lecture, topic.lectureLink.lectureTopicId)} —{' '}
                {topic.lectureLink.note}
              </p>
            </div>
          )}

          {isExercise && topic.practiceFocus && (
            <p className="text-sm text-text-secondary mb-3">{topic.practiceFocus}</p>
          )}

          {isExercise && (topic.problemTypes?.length > 0 || topic.procedures?.length > 0) && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {topic.problemTypes?.map((p, i) => (
                <span
                  key={`p-${i}`}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-bg-tertiary text-text-muted border border-border-subtle"
                >
                  {p}
                </span>
              ))}
              {topic.procedures?.map((p, i) => (
                <span
                  key={`r-${i}`}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20"
                >
                  {p}
                </span>
              ))}
            </div>
          )}

          {(topic.connections?.buildsOn?.length > 0 || topic.connections?.relatedInCourse?.length > 0) && (
            <div className="rounded-lg border border-border-subtle bg-bg-secondary/60 px-4 py-3 mb-6 text-xs text-text-muted space-y-1">
              {topic.connections.buildsOn?.length > 0 && (
                <p>Builds on: {topic.connections.buildsOn.join('; ')}</p>
              )}
              {topic.connections.relatedInCourse?.length > 0 && (
                <p>Related in course: {topic.connections.relatedInCourse.join('; ')}</p>
              )}
            </div>
          )}

          <article className="study-card rounded-xl border border-border-DEFAULT bg-bg-secondary p-6 mb-6">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">Topic summary</p>
            <HighlightableMarkdown
              markdownSource={cardMd}
              pinSource={{
                lecturePath: lecture.path,
                lectureTitle: lecture.title,
                topicTitle: topic.title,
                sourceType: 'topic'
              }}
              askContext={selectionAskContext}
              hasApiKey={hasApiKey}
              onHighlight={(text, meta) => openSaveModal(text, 'card', null, meta)}
            >
              {cardMd}
            </HighlightableMarkdown>
          </article>

          {topicHasSubtopics ? (
            <SubtopicCards
              topic={topic}
              lecture={lecture}
              lecturePath={lecture?.path}
              course={course}
              materialMode={materialMode}
              exerciseId={activeExerciseId}
              hasApiKey={hasApiKey}
              onHighlightSave={openSaveModal}
              onTopicUpdated={handleSubtopicTopicUpdated}
              onLectureUpdated={onTopicStudied}
              onOpenExerciseSubtopic={onOpenExerciseSubtopic}
              onNotify={onNotify}
              initialOpenSubtopicId={initialOpenSubtopicId}
              onInitialSubtopicConsumed={onInitialSubtopicConsumed}
              onToggleSubtopicPin={async (subtopicId) => {
                const res = await window.api.toggleSubtopicPin({
                  lecturePath: lecture.path,
                  topicId: topic.id,
                  subtopicId,
                  materialMode,
                  exerciseId: isExercise ? activeExerciseId : ''
                });
                if (res?.success && res.lecture) {
                  const topics = getMaterialTopics(res.lecture, materialMode, activeExerciseId);
                  const freshTopic = topics?.find((t) => t.id === topic.id);
                  onTopicStudied?.(res.lecture);
                  if (freshTopic) onTopicUpdated?.(freshTopic);
                }
              }}
              lectureNotes={lectureNotes}
              onOpenSavedNote={onOpenSavedNote}
              onDeleteCardMarker={handleDeleteCardMarker}
            />
          ) : (
            <>
              {deepMd && (
                <article className="study-card rounded-xl border border-accent/30 bg-bg-secondary p-6 mb-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <p className="text-xs font-medium text-accent">Deeper explanation</p>
                    <RegenerateFeedbackBar
                      busy={expanding}
                      disabled={!hasApiKey}
                      onRegenerate={handleRegenerateTopic}
                    />
                  </div>
                  <DeepPdfFigures
                    lecturePath={lecture.path}
                    figures={topic?.card?.deepFigures}
                    className="mb-3"
                  />
                  <HighlightableMarkdown
                    markdownSource={deepMd}
                    pinSource={{
                      lecturePath: lecture.path,
                      lectureTitle: lecture.title,
                      topicTitle: topic.title,
                      sourceType: 'topic'
                    }}
                    askContext={selectionAskContext}
                    hasApiKey={hasApiKey}
                    onHighlight={(text, meta) => openSaveModal(text, 'deep', null, meta)}
                  >
                    {deepMd}
                  </HighlightableMarkdown>
                </article>
              )}
              {!deepMd && (
                <button
                  type="button"
                  onClick={handleExpandTopic}
                  disabled={expanding || !hasApiKey}
                  className="mb-8 text-sm text-accent hover:text-accent-light disabled:opacity-40"
                >
                  {expanding ? 'Expanding…' : isExercise ? 'More practice detail' : 'Go deeper on this topic'}
                </button>
              )}
            </>
          )}

          <TopicAskPanel
            chatKey={askChatKey(lecture.path, topic.id, materialMode)}
            disabled={!hasApiKey}
            onOpenSavedNote={onOpenSavedNote}
            placeholder={
              isExercise
                ? `Ask about this exercise (steps, meaning, exam level)…`
                : `Ask about “${topic.title}”…`
            }
            onQuickSaveNote={handleQuickSaveFromChat}
            onAsk={(question) =>
              window.api.askTutor({
                lecturePath: lecture.path,
                topicId: topic.id,
                materialMode,
                exerciseId: isExercise ? activeExerciseId : '',
                ...coursePayload(course),
                question
              })
            }
          />
    </StudyPageShell>

      {pendingHighlight && (
        <SaveHighlightNoteModal
          highlight={pendingHighlight.text}
          topicTitle={topic.title}
          topicId={topic.id}
          subtopicId={pendingHighlight.subtopicId}
          subtopicTitle={pendingHighlight.subtopicTitle}
          sectionAnchor={pendingHighlight.sectionAnchor}
          sourceKind={pendingHighlight.sourceKind}
          markdownSource={cardMd}
          lecturePath={lecture.path}
          course={course}
          materialMode={materialMode}
          exerciseId={activeExerciseId}
          source={pendingHighlight.source}
          hasApiKey={Boolean(hasApiKey)}
          cardContext={pendingHighlight.saveMode === 'card'}
          linkableNotes={linkableNotesForModal}
          onSaveOnCard={handleSaveOnCard}
          onSaveManual={handleSaveNoteManual}
          onSaveWithAI={handleSaveNoteWithAI}
          onCancel={() => setPendingHighlight(null)}
        />
      )}

      {showPromoteModal && (
        <PromoteTopicModal
          topic={topic}
          lecture={lecture}
          onConfirm={handleConfirmPromote}
          onCancel={() => setShowPromoteModal(false)}
        />
      )}
    </>
  );
}
