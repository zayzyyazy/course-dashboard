import React, { useState } from 'react';
import HighlightableMarkdown from '../components/HighlightableMarkdown';
import SaveHighlightNoteModal from '../components/SaveHighlightNoteModal';
import PromoteTopicModal from '../components/PromoteTopicModal';
import AskPanel from '../components/AskPanel';
import { coursePayload } from '../utils/courseApi';

export default function TopicPage({
  course,
  lecture,
  topic,
  hasApiKey,
  onBack,
  onNoteSaved,
  notesCount = 0,
  onGoToNotes,
  onPromoteTopic,
  onOpenPromotedUnit
}) {
  const [expanding, setExpanding] = useState(false);
  const [deepMd, setDeepMd] = useState(topic?.card?.deepMarkdown || '');
  const [pendingHighlight, setPendingHighlight] = useState(null);
  const [showPromoteModal, setShowPromoteModal] = useState(false);

  const isSourceLecture = lecture?.itemType !== 'promoted';
  const canPromote = isSourceLecture && !topic?.promotedToUnitId && hasApiKey;

  async function handleMarkStudied() {
    await window.api.markTopicStudied({ lecturePath: lecture.path, topicId: topic.id });
    topic.studyState = 'studied';
  }

  async function handleExpand() {
    setExpanding(true);
    const res = await window.api.expandTopic({
      lecturePath: lecture.path,
      topicId: topic.id,
      ...coursePayload(course)
    });
    setExpanding(false);
    if (res.success) setDeepMd(res.markdown);
  }

  function openSaveModal(text, source) {
    setPendingHighlight({ text, source });
  }

  async function handleSaveNote({ note, keyIdeas, refinedNote }) {
    const result = await window.api.saveHighlightNote({
      lecturePath: lecture.path,
      topicId: topic.id,
      topicTitle: topic.title,
      source: pendingHighlight.source,
      highlightedText: pendingHighlight.text,
      note,
      keyIdeas,
      refinedNote
    });
    setPendingHighlight(null);
    if (result.success) {
      onNoteSaved?.(result.note);
    } else {
      throw new Error(result.error || 'Could not save note');
    }
  }

  async function handleConfirmPromote() {
    setShowPromoteModal(false);
    await onPromoteTopic?.({
      lecturePath: lecture.path,
      topicId: topic.id
    });
  }

  const cardMd = topic?.card?.markdown || '_No study card yet._';

  return (
    <div className="h-full flex flex-col overflow-hidden no-drag">
      <div className="h-8 drag-region flex-shrink-0" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-6 pb-16">
          <button type="button" onClick={onBack} className="text-xs text-text-muted hover:text-accent mb-3">
            ← {lecture.title}
          </button>

          {notesCount > 0 && (
            <button
              type="button"
              onClick={onGoToNotes}
              className="mb-4 w-full text-left rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-accent hover:bg-accent/15"
            >
              View {notesCount} saved note{notesCount === 1 ? '' : 's'} on this lecture →
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
            <h1 className="text-2xl font-bold text-text-primary">{topic.title}</h1>
            <div className="flex gap-2 flex-shrink-0">
              {canPromote && (
                <button
                  type="button"
                  onClick={() => setShowPromoteModal(true)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-amber-900/50 text-amber-400/90 hover:bg-amber-950/25"
                >
                  Promote to study unit
                </button>
              )}
              <button
                type="button"
                onClick={handleMarkStudied}
                className="text-xs px-3 py-1.5 rounded-lg border border-border-DEFAULT text-text-secondary hover:border-accent hover:text-accent"
              >
                Mark studied
              </button>
            </div>
          </div>

          <p className="text-xs text-text-muted mb-4">
            Select text below → <span className="text-accent">Save note</span> → optional{' '}
            <span className="text-accent">Sharpen with AI</span> → saved under{' '}
            <span className="text-text-primary">Your notes</span> on the lecture page.
            {canPromote && (
              <>
                {' '}
                Use <span className="text-amber-400/90">Promote to study unit</span> if this topic is too
                large for one card.
              </>
            )}
          </p>

          {topic.subtopics?.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {topic.subtopics.map((s) => (
                <span
                  key={s.id}
                  className="text-xs px-2.5 py-1 rounded-full bg-bg-tertiary text-text-secondary border border-border-subtle"
                >
                  {s.title}
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

          <article className="rounded-xl border border-border-DEFAULT bg-bg-secondary p-6 mb-6">
            <HighlightableMarkdown onHighlight={(text) => openSaveModal(text, 'card')}>
              {cardMd}
            </HighlightableMarkdown>
          </article>

          {deepMd && (
            <article className="rounded-xl border border-accent/30 bg-bg-secondary p-6 mb-6">
              <p className="text-xs font-medium text-accent mb-3">Deeper explanation</p>
              <HighlightableMarkdown onHighlight={(text) => openSaveModal(text, 'deep')}>
                {deepMd}
              </HighlightableMarkdown>
            </article>
          )}

          <button
            type="button"
            onClick={handleExpand}
            disabled={expanding}
            className="mb-8 text-sm text-accent hover:text-accent-light disabled:opacity-40"
          >
            {expanding ? 'Expanding…' : 'Go deeper on this topic'}
          </button>

          <AskPanel
            placeholder={`Ask about “${topic.title}”…`}
            onAsk={(question) =>
              window.api.askTutor({
                lecturePath: lecture.path,
                topicId: topic.id,
                ...coursePayload(course),
                question
              })
            }
          />
        </div>
      </div>

      {pendingHighlight && (
        <SaveHighlightNoteModal
          highlight={pendingHighlight.text}
          topicTitle={topic.title}
          lecturePath={lecture.path}
          course={course}
          hasApiKey={Boolean(hasApiKey)}
          onSave={handleSaveNote}
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
    </div>
  );
}
