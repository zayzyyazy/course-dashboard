import React, { useCallback, useEffect, useState } from 'react';
import MarkdownView from '../components/MarkdownView';
import AskPanel from '../components/AskPanel';
import LectureNotesEntry from '../components/LectureNotesEntry';
import LectureNotesView from './LectureNotesView';
import NoteStudyView from '../components/NoteStudyView';
import LectureStudyMap from '../components/LectureStudyMap';
import LectureRewindView from '../components/LectureRewindView';
import LectureReferencesView from './LectureReferencesView';
import LectureProgressBar from '../components/LectureProgressBar';
import LectureMaterialSwitch from '../components/LectureMaterialSwitch';
import { coursePayload } from '../utils/courseApi';
import { StudyDepthBadge } from '../components/StudyDepthBadge';
import TitleWithMath from '../components/TitleWithMath';
import { hasSubtopics, isTopicStudied } from '../utils/studyState';
import TopicStatusBadge from '../components/TopicStatusBadge';
import {
  getMaterialTopics,
  getMaterialSummary,
  hasExerciseMaterial,
  lectureSupportsExercise,
  getExerciseSheets,
  resolveActiveExerciseId
} from '../utils/lectureMaterial';
import ExerciseSheetPicker from '../components/ExerciseSheetPicker';
import { askChatKey } from '../utils/askChatStore';
import StudyPageShell from '../components/StudyPageShell';
import PinButton from '../components/PinButton';
import { useCompactLayout } from '../hooks/useCompactLayout';
import { isRewindDue } from '../utils/rewindUi';

export default function LecturePage({
  course,
  lectureMeta,
  hasApiKey,
  materialMode = 'lecture',
  exerciseId = '',
  onMaterialModeChange,
  onExerciseIdChange,
  onAttachExercise,
  onOpenTopic,
  onBack,
  onOpenSourceItem,
  onOpenPromotedUnit,
  onPinsChanged,
  onNotify,
  sidebarHidden,
  onToggleSidebar,
  openNotesView,
  onNotesViewConsumed,
  pendingOpenNoteId,
  onPendingNoteConsumed,
  returnViewAfterNote,
  onReturnAfterNote
}) {
  const [lecture, setLecture] = useState(null);
  const [notes, setNotes] = useState([]);
  const [studyNote, setStudyNote] = useState(null);
  const [studyMapOpen, setStudyMapOpen] = useState(false);
  const [rewindOpen, setRewindOpen] = useState(false);
  const [notesViewOpen, setNotesViewOpen] = useState(false);
  const [contentTab, setContentTab] = useState(materialMode === 'exercise' ? 'exercise' : 'lecture');
  const compact = useCompactLayout();

  const loadNotes = useCallback(async () => {
    if (!lectureMeta?.path) return;
    const res = await window.api.listLectureNotes(lectureMeta.path);
    if (res.success) setNotes(res.notes || []);
  }, [lectureMeta?.path]);

  const reloadLecture = useCallback(async () => {
    if (!lectureMeta?.path) return;
    const data = await window.api.getLecture(lectureMeta.path);
    if (data) setLecture(data);
  }, [lectureMeta?.path]);

  useEffect(() => {
    if (!lectureMeta?.path) return;
    window.api.markLectureOpened(lectureMeta.path);
    reloadLecture();
    loadNotes();
  }, [lectureMeta?.path, lectureMeta?.topics, reloadLecture, loadNotes]);

  useEffect(() => {
    if (openNotesView) {
      setNotesViewOpen(true);
      onNotesViewConsumed?.();
    }
  }, [openNotesView, onNotesViewConsumed]);

  useEffect(() => {
    if (!pendingOpenNoteId || !notes.length) return;
    const target = notes.find((n) => n.id === pendingOpenNoteId);
    if (target) {
      setStudyNote(target);
      setNotesViewOpen(false);
      onPendingNoteConsumed?.();
    }
  }, [pendingOpenNoteId, notes, onPendingNoteConsumed]);

  useEffect(() => {
    if (materialMode === 'exercise') {
      setContentTab((tab) => (tab === 'references' ? tab : 'exercise'));
    } else if (contentTab !== 'references') {
      setContentTab('lecture');
    }
  }, [materialMode]);

  function handleContentTabChange(tab) {
    setContentTab(tab);
    if (tab === 'lecture') onMaterialModeChange?.('lecture');
    if (tab === 'exercise') onMaterialModeChange?.('exercise');
  }

  function handleOpenTopicFromNote(topicId, noteMaterialMode, subtopicId = null, noteExerciseId = '') {
    if (!lecture || !topicId) return;
    const mode = noteMaterialMode === 'exercise' ? 'exercise' : 'lecture';
    const activeExerciseId = mode === 'exercise' ? noteExerciseId || exerciseId : '';
    const topic = getMaterialTopics(lecture, mode, activeExerciseId).find((t) => t.id === topicId);
    if (topic) {
      setStudyNote(null);
      setNotesViewOpen(false);
      onMaterialModeChange?.(mode);
      if (activeExerciseId) onExerciseIdChange?.(activeExerciseId);
      onOpenTopic(lecture, topic, mode, { subtopicId, exerciseId: activeExerciseId });
    }
  }

  async function handleDeleteNote(noteId) {
    const res = await window.api.deleteLectureNote({
      lecturePath: lecture.path,
      noteId
    });
    if (res.success) {
      loadNotes();
      onPinsChanged?.();
      if (studyNote?.id === noteId) setStudyNote(null);
    }
  }

  async function handleReorderNotes(orderedIds, options = {}) {
    if (!lecture?.path || !orderedIds?.length) return;
    const res = await window.api.reorderNotes({
      lecturePath: lecture.path,
      orderedIds,
      topicId: options.topicId || ''
    });
    if (res?.success) await loadNotes();
    if (res?.success) onPinsChanged?.();
    return res;
  }

  async function handleMergeNotes(sourceNoteId, targetNoteId) {
    if (!lecture?.path || !sourceNoteId || !targetNoteId) return;
    const res = await window.api.mergeNotes({
      lecturePath: lecture.path,
      sourceNoteId,
      targetNoteId
    });
    if (res?.success) await loadNotes();
    if (res?.success) onPinsChanged?.();
    return res;
  }

  async function handleRebuildNoteMetadata(options = {}) {
    if (!lecture?.path) return;
    const res = await window.api.rebuildNoteMetadata(lecture.path, options);
    if (res?.success) await loadNotes();
    if (res?.success) onPinsChanged?.();
    return res;
  }

  async function handleUpdateNoteTitle(noteId, title) {
    if (!lecture?.path || !noteId) return;
    const res = await window.api.updateLectureNote({
      lecturePath: lecture.path,
      noteId,
      title
    });
    if (res?.success) {
      await loadNotes();
      if (studyNote?.id === noteId && res.note) setStudyNote(res.note);
      onNotify?.('Note title saved');
    }
    return res;
  }

  async function handleToggleLecturePin() {
    const res = await window.api.toggleLecturePin({ lecturePath: lecture.path });
    if (res?.success && res.lecture) {
      setLecture(res.lecture);
      onPinsChanged?.();
      onNotify?.(res.lecture.pinned ? 'Pinned — see Study overview (Home)' : 'Unpinned');
    }
  }

  async function handleToggleTopicPin(topicId, pinMaterialMode = materialMode, pinExerciseId = exerciseId) {
    const res = await window.api.toggleTopicPin({
      lecturePath: lecture.path,
      topicId,
      materialMode: pinMaterialMode,
      exerciseId: pinMaterialMode === 'exercise' ? pinExerciseId : ''
    });
    if (res?.success && res.lecture) {
      setLecture(res.lecture);
      onPinsChanged?.();
      const topics = getMaterialTopics(res.lecture, pinMaterialMode, pinExerciseId);
      const t = topics.find((x) => x.id === topicId);
      onNotify?.(t?.pinned ? 'Pinned — see Study overview (Home)' : 'Unpinned');
    }
  }

  async function handleToggleNotePin(noteId) {
    const res = await window.api.toggleNotePin({ lecturePath: lecture.path, noteId });
    if (res?.success) {
      if (studyNote?.id === noteId && res.note) setStudyNote(res.note);
      await loadNotes();
      onPinsChanged?.();
    }
    return res;
  }

  const isExercise = materialMode === 'exercise' && contentTab !== 'references';
  const isReferences = contentTab === 'references';
  const exerciseSheets = lecture ? getExerciseSheets(lecture) : [];
  const activeExerciseId = resolveActiveExerciseId(lecture, exerciseId);
  const displayTopics = lecture ? getMaterialTopics(lecture, materialMode, activeExerciseId) : [];
  const summary = lecture ? getMaterialSummary(lecture, materialMode, activeExerciseId) : '';
  const showExerciseUi = lecture && lectureSupportsExercise(lecture);

  async function handleLectureUpdated(updated) {
    if (updated) setLecture(updated);
  }

  async function handleToggleTopicStudied(e, topic) {
    e?.stopPropagation?.();
    if (!isExercise && hasSubtopics(topic)) return;
    const updated = await window.api.markTopicStudied({
      lecturePath: lecture.path,
      topicId: topic.id,
      materialMode,
      exerciseId: isExercise ? activeExerciseId : ''
    });
    if (updated) handleLectureUpdated(updated);
  }

  if (!lecture) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted text-sm no-drag">
        Loading lecture…
      </div>
    );
  }

  if (studyNote) {
    return (
      <NoteStudyView
        note={studyNote}
        course={course}
        lecture={lecture}
        hasApiKey={hasApiKey}
        onClose={() => {
          setStudyNote(null);
          if (returnViewAfterNote) onReturnAfterNote?.();
        }}
        onOpenTopic={handleOpenTopicFromNote}
        onNoteUpdated={(updated) => {
          loadNotes();
          if (updated) setStudyNote(updated);
        }}
        onOpenSiblingNote={(noteId) => {
          const sibling = notes.find((n) => n.id === noteId);
          if (sibling) setStudyNote(sibling);
        }}
        onTogglePin={() => handleToggleNotePin(studyNote.id)}
      />
    );
  }

  if (notesViewOpen) {
    return (
      <LectureNotesView
        lecture={lecture}
        notes={notes}
        onBack={() => setNotesViewOpen(false)}
        onOpenNote={setStudyNote}
        onDelete={handleDeleteNote}
        onTogglePin={handleToggleNotePin}
        onReorder={handleReorderNotes}
        onMerge={handleMergeNotes}
        onUpdateTitle={handleUpdateNoteTitle}
        onOpenTopic={handleOpenTopicFromNote}
        onRebuildMetadata={handleRebuildNoteMetadata}
        onNotify={onNotify}
      />
    );
  }

  if (rewindOpen && !isExercise) {
    return (
      <LectureRewindView
        course={course}
        lecture={lecture}
        hasApiKey={hasApiKey}
        onBack={() => setRewindOpen(false)}
        onLectureUpdated={handleLectureUpdated}
        onNotify={onNotify}
      />
    );
  }

  return (
    <>
    <StudyPageShell>
          <button type="button" onClick={onBack} className="text-xs text-text-muted hover:text-accent mb-3">
            ← {course?.name}
          </button>

          <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
            <div className="min-w-0">
              <h1 className="study-title text-2xl font-bold text-text-primary">
                <TitleWithMath text={lecture.title} />
              </h1>
              {showExerciseUi && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <LectureMaterialSwitch
                    mode={contentTab}
                    onChange={handleContentTabChange}
                    hasExercise={hasExerciseMaterial(lecture)}
                  />
                  {!hasExerciseMaterial(lecture) && contentTab !== 'references' && (
                    <button
                      type="button"
                      disabled={!hasApiKey}
                      onClick={onAttachExercise}
                      className="text-xs px-2.5 py-1 rounded-lg border border-dashed border-accent/50 text-accent hover:bg-accent/10 disabled:opacity-40"
                    >
                      + Übung / exercise PDF
                    </button>
                  )}
                </div>
              )}
              {showExerciseUi && isExercise && exerciseSheets.length > 0 && (
                <ExerciseSheetPicker
                  sheets={exerciseSheets}
                  selectedId={activeExerciseId}
                  onSelect={onExerciseIdChange}
                  onAdd={onAttachExercise}
                  canAdd={Boolean(hasApiKey)}
                />
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0 items-center flex-wrap justify-end">
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
                pinned={Boolean(lecture.pinned)}
                onClick={handleToggleLecturePin}
                title={lecture.pinned ? 'Unpin from Study overview' : 'Pin to Study overview'}
              />
              {!isExercise && !isReferences && (
                <button
                  type="button"
                  onClick={() => setRewindOpen(true)}
                  className="relative text-xs px-3 py-1.5 rounded-lg border border-border-DEFAULT text-text-muted hover:text-accent hover:border-accent/40"
                  title="Weekly recap — refresh what this lecture is about"
                >
                  Rewind
                  {isRewindDue(lecture.studyState?.lastRewindAt) && (
                    <span
                      className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400"
                      aria-hidden
                    />
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => setStudyMapOpen(true)}
                className="text-xs px-3 py-1.5 rounded-lg border border-border-DEFAULT text-text-muted hover:text-accent hover:border-accent/40"
              >
                Study map
              </button>
            </div>
          </div>

          {!isExercise && !isReferences && (
            <LectureProgressBar
              lecture={lecture}
              materialMode={materialMode}
              exerciseId={activeExerciseId}
              className="mb-6 rounded-lg bg-bg-secondary/40 px-4 py-3"
            />
          )}

          {isReferences ? (
            <LectureReferencesView
              course={course}
              lecture={lecture}
              hasApiKey={hasApiKey}
              onNotify={onNotify}
            />
          ) : (
            <>
          {isExercise && !hasExerciseMaterial(lecture) && (
            <div className="rounded-xl border border-dashed border-accent/40 bg-accent/5 p-5 mb-6">
              <p className="text-sm text-text-secondary leading-relaxed mb-3">
                No exercise material yet. Attach a Übungsblatt or practice PDF to see application-focused
                topics for this lecture.
              </p>
              <button
                type="button"
                disabled={!hasApiKey}
                onClick={onAttachExercise}
                className="text-sm px-3 py-1.5 rounded-lg bg-accent text-white font-medium disabled:opacity-40"
              >
                Attach exercise PDF
              </button>
            </div>
          )}

          {lecture.itemType === 'promoted' && (
            <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 px-4 py-3 mb-6">
              <p className="text-xs font-medium text-amber-400/90 uppercase tracking-wide mb-1">
                Promoted study unit
              </p>
              {lecture.provenanceLabel && (
                <p className="text-sm text-text-secondary leading-relaxed">{lecture.provenanceLabel}</p>
              )}
              {lecture.source?.lecturePath && (
                <button
                  type="button"
                  onClick={() => onOpenSourceItem?.(lecture.source.lecturePath)}
                  className="mt-2 text-xs text-accent hover:underline"
                >
                  View source lecture →
                </button>
              )}
            </div>
          )}

          {lecture.courseThread?.summary && (
            <div className="rounded-xl border border-accent/25 bg-accent/5 p-4 mb-6">
              <p className="text-xs font-medium text-accent mb-1">In this course</p>
              <p className="text-sm text-text-secondary leading-relaxed">{lecture.courseThread.summary}</p>
              {(lecture.courseThread.continuesFrom || lecture.courseThread.leadsTo) && (
                <div className="mt-2 text-xs text-text-muted space-y-1">
                  {lecture.courseThread.continuesFrom && (
                    <p>Builds on: {lecture.courseThread.continuesFrom}</p>
                  )}
                  {lecture.courseThread.leadsTo && <p>Prepares: {lecture.courseThread.leadsTo}</p>}
                </div>
              )}
            </div>
          )}

          {(summary || !isExercise) && (
            <section className="mb-8">
              <h2 className="study-section-title text-sm font-semibold text-text-primary uppercase tracking-wide mb-3">
                {isExercise
                  ? 'Exercise focus'
                  : lecture.itemType === 'promoted'
                    ? 'Unit summary'
                    : 'Lecture summary'}
              </h2>
              <div
                className={`study-card rounded-xl border p-5 ${
                  isExercise
                    ? 'border-emerald-900/30 bg-emerald-950/10'
                    : 'border-border-DEFAULT bg-bg-secondary'
                }`}
              >
                <MarkdownView>{summary || '_No summary yet._'}</MarkdownView>
              </div>
            </section>
          )}

          {isExercise && lecture.exercise?.lectureLinks?.length > 0 && (
            <section className="mb-6">
              <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
                Links to lecture
              </h2>
              <ul className="space-y-1.5 text-xs text-text-secondary">
                {lecture.exercise.lectureLinks.slice(0, 8).map((link) => {
                  const ex = lecture.exercise.topics.find((t) => t.id === link.exerciseTopicId);
                  const le = lecture.topics.find((t) => t.id === link.lectureTopicId);
                  return (
                    <li key={`${link.exerciseTopicId}-${link.lectureTopicId}`} className="leading-relaxed">
                      <span className="text-text-primary">{ex?.title || 'Exercise'}</span>
                      <span className="text-text-muted"> → </span>
                      <span className="text-accent">{le?.title || 'Lecture'}</span>
                      {link.note ? <span className="text-text-muted"> — {link.note}</span> : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="mb-6">
            <h2 className="study-section-title text-sm font-semibold text-text-primary uppercase tracking-wide mb-3">
              {isExercise ? 'Practice topics' : 'Topics'} ({displayTopics.length})
            </h2>
            <div className="grid gap-3">
              {displayTopics.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() =>
                    onOpenTopic(lecture, topic, materialMode, {
                      exerciseId: isExercise ? activeExerciseId : ''
                    })
                  }
                  className="text-left rounded-xl border border-border-DEFAULT bg-bg-secondary hover:border-accent/40 p-4 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-text-primary">
                          <TitleWithMath text={topic.title} />
                        </p>
                        {!isExercise && (
                          <StudyDepthBadge item={topic} parentImportance={topic.importance} />
                        )}
                      </div>
                      {topic.practiceFocus && (
                        <p className="text-xs text-text-muted mt-1 line-clamp-2">{topic.practiceFocus}</p>
                      )}
                      {topic.subtopics?.length > 0 && (
                        <p className="text-xs text-text-muted mt-1">
                          {topic.subtopics.map((s, idx) => (
                            <React.Fragment key={s.id || `${s.title}-${idx}`}>
                              {idx > 0 ? ' · ' : null}
                              <TitleWithMath text={s.title} />
                            </React.Fragment>
                          ))}
                        </p>
                      )}
                      {topic.lectureLink?.note && (
                        <p className="text-[10px] text-emerald-400/80 mt-1">{topic.lectureLink.note}</p>
                      )}
                      {!isExercise && topic.promotedToUnitId && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenPromotedUnit?.(topic.promotedToUnitId);
                          }}
                          className="text-[10px] text-amber-400/90 mt-1 hover:underline"
                        >
                          Study unit created →
                        </button>
                      )}
                    </div>
                    {isExercise ? (
                      <div className="flex items-center gap-2">
                        <PinButton
                          pinned={Boolean(topic.pinned)}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleTopicPin(topic.id);
                          }}
                          title={topic.pinned ? 'Unpin topic' : 'Pin topic'}
                        />
                        {hasSubtopics(topic) ? (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium border ${
                              isTopicStudied(topic)
                                ? 'bg-emerald-600/20 text-emerald-300 border-emerald-600/40'
                                : 'bg-bg-hover text-text-muted border-border-subtle'
                            }`}
                          >
                            {isTopicStudied(topic) ? '✓ Done' : 'Open to track'}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleToggleTopicStudied(e, topic)}
                            className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium border ${
                              isTopicStudied(topic)
                                ? 'bg-emerald-600/20 text-emerald-300 border-emerald-600/40'
                                : 'bg-bg-hover text-text-muted border-amber-900/40 hover:border-amber-700/50'
                            }`}
                          >
                            {isTopicStudied(topic) ? '✓ Done' : 'Mark done'}
                          </button>
                        )}
                      </div>
                    ) : hasSubtopics(topic) ? (
                      <div className="flex items-center gap-2">
                        <PinButton
                          pinned={Boolean(topic.pinned)}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleTopicPin(topic.id);
                          }}
                          title={topic.pinned ? 'Unpin topic' : 'Pin topic'}
                        />
                        <TopicStatusBadge topic={topic} compact />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <PinButton
                          pinned={Boolean(topic.pinned)}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleTopicPin(topic.id);
                          }}
                          title={topic.pinned ? 'Unpin topic' : 'Pin topic'}
                        />
                        <button
                          type="button"
                          onClick={(e) => handleToggleTopicStudied(e, topic)}
                          className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium border ${
                            isTopicStudied(topic)
                              ? 'bg-emerald-600/20 text-emerald-300 border-emerald-600/40'
                              : 'bg-bg-hover text-text-muted border-amber-900/40 hover:border-amber-700/50'
                          }`}
                        >
                          {isTopicStudied(topic) ? '✓ Studied' : 'Mark studied'}
                        </button>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <LectureNotesEntry
            notes={notes}
            onOpen={() => setNotesViewOpen(true)}
            onOpenNote={(note) => setStudyNote(note)}
          />

          <AskPanel
            chatKey={askChatKey(lecture.path, null, materialMode)}
            disabled={!course || (isExercise && !hasExerciseMaterial(lecture))}
            onOpenSavedNote={(noteId) => {
              const target = notes.find((n) => n.id === noteId);
              if (target) setStudyNote(target);
            }}
            placeholder={
              isExercise
                ? 'Ask about this Übung — procedures, exam level, lecture links…'
                : 'Ask about this lecture, prerequisites, connections…'
            }
            onAsk={(question) =>
              window.api.askTutor({
                lecturePath: lecture.path,
                ...coursePayload(course),
                topicId: null,
                materialMode,
                exerciseId: isExercise ? activeExerciseId : '',
                question
              })
            }
          />
            </>
          )}
    </StudyPageShell>

      <LectureStudyMap
        lecture={lecture}
        open={studyMapOpen}
        materialMode={materialMode}
        exerciseId={activeExerciseId}
        onClose={() => setStudyMapOpen(false)}
        onOpenTopic={onOpenTopic}
        onLectureUpdated={handleLectureUpdated}
      />
    </>
  );
}
