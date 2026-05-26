import React, { useCallback, useEffect, useState } from 'react';
import MarkdownView from '../components/MarkdownView';
import AskPanel from '../components/AskPanel';
import LectureNotesPanel from '../components/LectureNotesPanel';
import NoteStudyView from '../components/NoteStudyView';
import LectureStudyMap from '../components/LectureStudyMap';
import { coursePayload } from '../utils/courseApi';

export default function LecturePage({
  course,
  lectureMeta,
  hasApiKey,
  onOpenTopic,
  onBack,
  onOpenSourceItem,
  onOpenPromotedUnit
}) {
  const [lecture, setLecture] = useState(null);
  const [notes, setNotes] = useState([]);
  const [studyNote, setStudyNote] = useState(null);
  const [studyMapOpen, setStudyMapOpen] = useState(false);

  const loadNotes = useCallback(async () => {
    if (!lectureMeta?.path) return;
    const res = await window.api.listLectureNotes(lectureMeta.path);
    if (res.success) setNotes(res.notes || []);
  }, [lectureMeta?.path]);

  useEffect(() => {
    if (!lectureMeta?.path) return;
    window.api.markLectureOpened(lectureMeta.path);
    window.api.getLecture(lectureMeta.path).then(setLecture);
    loadNotes();
  }, [lectureMeta?.path, loadNotes]);

  function handleOpenTopicFromNote(topicId) {
    if (!lecture || !topicId) return;
    const topic = lecture.topics?.find((t) => t.id === topicId);
    if (topic) {
      setStudyNote(null);
      onOpenTopic(lecture, topic);
    }
  }

  async function handleDeleteNote(noteId) {
    const res = await window.api.deleteLectureNote({
      lecturePath: lecture.path,
      noteId
    });
    if (res.success) {
      loadNotes();
      if (studyNote?.id === noteId) setStudyNote(null);
    }
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
        onClose={() => setStudyNote(null)}
        onOpenTopic={handleOpenTopicFromNote}
      />
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden no-drag">
      <div className="h-8 drag-region flex-shrink-0" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-6 pb-16">
          <button type="button" onClick={onBack} className="text-xs text-text-muted hover:text-accent mb-3">
            ← {course?.name}
          </button>

          <div className="flex items-start justify-between gap-4 mb-4">
            <h1 className="text-2xl font-bold text-text-primary">{lecture.title}</h1>
            <button
              type="button"
              onClick={() => setStudyMapOpen(true)}
              className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg border border-border-DEFAULT text-text-muted hover:text-accent hover:border-accent/40"
            >
              Study map
            </button>
          </div>

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

          <LectureNotesPanel
            notes={notes}
            onOpenNote={setStudyNote}
            onDelete={handleDeleteNote}
            onOpenTopic={handleOpenTopicFromNote}
          />

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

          <section className="mb-8">
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide mb-3">
              {lecture.itemType === 'promoted' ? 'Unit summary' : 'Lecture summary'}
            </h2>
            <div className="rounded-xl border border-border-DEFAULT bg-bg-secondary p-5">
              <MarkdownView>{lecture.lectureSummary || lecture.summary}</MarkdownView>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide mb-3">
              Topics ({lecture.topics?.length || 0})
            </h2>
            <div className="grid gap-3">
              {(lecture.topics || []).map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => onOpenTopic(lecture, topic)}
                  className="text-left rounded-xl border border-border-DEFAULT bg-bg-secondary hover:border-accent/40 p-4 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-text-primary">{topic.title}</p>
                      {topic.subtopics?.length > 0 && (
                        <p className="text-xs text-text-muted mt-1">
                          {topic.subtopics.map((s) => s.title).join(' · ')}
                        </p>
                      )}
                      {topic.promotedToUnitId && (
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
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        topic.studyState === 'studied'
                          ? 'bg-accent/20 text-accent'
                          : 'bg-bg-hover text-text-muted'
                      }`}
                    >
                      {topic.studyState === 'studied' ? 'Studied' : topic.card ? 'Ready' : '—'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <AskPanel
            disabled={!course}
            placeholder="Ask about this lecture, prerequisites, connections…"
            onAsk={(question) =>
              window.api.askTutor({
                lecturePath: lecture.path,
                ...coursePayload(course),
                topicId: null,
                question
              })
            }
          />
        </div>
      </div>

      <LectureStudyMap
        lecture={lecture}
        open={studyMapOpen}
        onClose={() => setStudyMapOpen(false)}
        onOpenTopic={onOpenTopic}
      />
    </div>
  );
}
