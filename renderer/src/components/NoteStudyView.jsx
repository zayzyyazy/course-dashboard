import React, { useEffect, useMemo, useState } from 'react';
import HighlightableMarkdown from './HighlightableMarkdown';
import NoteChatPanel from './NoteChatPanel';
import { coursePayload } from '../utils/courseApi';
import { prepareStudyMarkdown } from '../utils/prepareStudyMarkdown';
import PinButton from './PinButton';
import HighlightPreviewText from './HighlightPreviewText';

function formatAdditionDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return '';
  }
}

export default function NoteStudyView({
  note,
  course,
  lecture,
  hasApiKey,
  onClose,
  onOpenTopic,
  onNoteUpdated,
  onOpenSiblingNote,
  onTogglePin
}) {
  const [activeNote, setActiveNote] = useState(note);
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    setActiveNote(note);
  }, [note?.id, note?.updatedAt, note?.refinedNote, note?.inlineHighlights]);

  const body = activeNote?.refinedNote || activeNote?.note || '';
  const preparedBody = useMemo(() => prepareStudyMarkdown(body), [body]);
  const additions = activeNote?.studyAdditions || [];

  const savedHighlights = useMemo(() => {
    return (activeNote?.inlineHighlights || []).map((h) => ({
      id: h.id,
      highlightedText: h.text
    }));
  }, [activeNote?.inlineHighlights]);

  if (!activeNote) return null;

  const selectionAskContext = {
    course,
    lecturePath: lecture?.path,
    topicId: activeNote.topicId || '',
    materialMode: activeNote.materialMode || 'lecture',
    lectureTitle: lecture?.title || '',
    topicTitle: activeNote.topicTitle || '',
    subtopicTitle: activeNote.subtopicTitle || '',
    noteTitle: activeNote.title || activeNote.topicTitle || ''
  };

  async function handleAddToNote({ excerpt, isSelection }) {
    return window.api.appendToNoteFromStudy({
      lecturePath: lecture.path,
      ...coursePayload(course),
      noteId: activeNote.id,
      note: activeNote,
      excerpt,
      isSelection: Boolean(isSelection)
    });
  }

  async function handleSaveToNotes(payload) {
    const result = await handleAddToNote(payload);
    if (result?.success && result.note) {
      setActiveNote(result.note);
      onNoteUpdated?.(result.note);
    }
    return result;
  }

  async function handleSaveInlineHighlight(text) {
    const res = await window.api.addNoteInlineHighlight({
      lecturePath: lecture.path,
      noteId: activeNote.id,
      text
    });
    if (res?.success && res.note) {
      setActiveNote(res.note);
      onNoteUpdated?.(res.note);
    }
  }

  async function handleRemoveAddition(additionId) {
    setRemovingId(additionId);
    try {
      const result = await window.api.deleteNoteStudyBlock({
        lecturePath: lecture.path,
        noteId: activeNote.id,
        additionId
      });
      if (result?.success && result.note) {
        setActiveNote(result.note);
        onNoteUpdated?.(result.note);
      }
    } finally {
      setRemovingId(null);
    }
  }

  async function handleDeleteSavedHighlight(highlightId) {
    const res = await window.api.removeNoteInlineHighlight({
      lecturePath: lecture.path,
      noteId: activeNote.id,
      highlightId
    });
    if (res?.success && res.note) {
      setActiveNote(res.note);
      onNoteUpdated?.(res.note);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] bg-bg-primary flex flex-col no-drag">
      <div className="h-8 drag-region flex-shrink-0" />
      <header className="flex items-center justify-between gap-4 px-6 py-3 border-b border-border-DEFAULT flex-shrink-0">
        <div className="min-w-0">
          <p className="text-xs text-text-muted uppercase tracking-wide">Note study</p>
          <h1 className="text-lg font-semibold text-text-primary truncate">{activeNote.topicTitle}</h1>
          <p className="text-xs text-text-muted truncate">
            {course?.name} · {lecture?.title}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <PinButton
            pinned={Boolean(activeNote.pinned)}
            onClick={() => onTogglePin?.()}
            title={activeNote.pinned ? 'Unpin note' : 'Pin note'}
          />
          {activeNote.topicId && (
            <button
              type="button"
              onClick={() =>
                onOpenTopic?.(
                  activeNote.topicId,
                  activeNote.materialMode,
                  activeNote.subtopicId,
                  activeNote.exerciseId
                )
              }
              className="px-3 py-1.5 rounded-lg border border-border-DEFAULT text-xs text-text-secondary hover:text-accent"
            >
              Open topic
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-bg-tertiary border border-border-DEFAULT text-xs text-text-primary hover:border-accent/40"
          >
            ← Back to lecture
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border-DEFAULT">
        <div className="overflow-y-auto p-6 lg:p-8">
          <blockquote className="study-reading-caption border-l-2 border-accent/50 pl-4 mb-5 max-h-48 overflow-y-auto">
            <HighlightPreviewText text={activeNote.highlightedText} />
          </blockquote>

          {activeNote.keyIdeas?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {activeNote.keyIdeas.map((idea, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/25"
                >
                  {idea}
                </span>
              ))}
            </div>
          )}

          {body ? (
            <div className="rounded-xl border border-border-DEFAULT bg-bg-secondary p-5 lg:p-6 study-reading-panel">
              <HighlightableMarkdown
                markdownSource={body}
                contentVariant="study"
                savedHighlights={savedHighlights}
                onDeleteSavedHighlight={handleDeleteSavedHighlight}
                saveLabel="Highlight"
                pinSource={{
                  lecturePath: lecture.path,
                  lectureTitle: lecture.title,
                  topicTitle: activeNote.topicTitle,
                  subtopicTitle: activeNote.subtopicTitle,
                  sourceType: 'note'
                }}
                askContext={selectionAskContext}
                hasApiKey={hasApiKey}
                onHighlight={handleSaveInlineHighlight}
              >
                {preparedBody}
              </HighlightableMarkdown>
            </div>
          ) : (
            <p className="text-sm text-text-muted">No note body — ask AI about the highlight.</p>
          )}

          {additions.length > 0 && (
            <div className="mt-5 rounded-lg border border-border-subtle bg-bg-secondary/50 p-3">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                Sections added from AI
              </p>
              <ul className="space-y-2">
                {additions.map((add) => (
                  <li
                    key={add.id}
                    className="flex items-start justify-between gap-2 text-xs border-b border-border-subtle/60 last:border-0 pb-2 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-text-secondary">{add.label}</p>
                      <p className="text-text-muted">{formatAdditionDate(add.addedAt)}</p>
                    </div>
                    <button
                      type="button"
                      disabled={removingId === add.id}
                      onClick={() => handleRemoveAddition(add.id)}
                      className="text-text-muted hover:text-red-400 flex-shrink-0 disabled:opacity-40"
                    >
                      {removingId === add.id ? 'Removing…' : 'Remove'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activeNote.note && activeNote.refinedNote && activeNote.note !== activeNote.refinedNote && (
            <div className="mt-6 study-reading-panel">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                Original draft
              </p>
              <p className="text-base text-text-muted leading-relaxed whitespace-pre-wrap">
                {activeNote.note}
              </p>
            </div>
          )}
        </div>

        <div className="p-6 min-h-0 flex flex-col bg-bg-secondary/30">
          {!hasApiKey ? (
            <p className="text-sm text-text-muted">
              Add an API key in Settings to chat about this note with AI.
            </p>
          ) : (
            <NoteChatPanel
              disabled={!lecture?.path}
              placeholder="e.g. explain this formula, what am I missing…"
              onSaveToNotes={handleSaveToNotes}
              onOpenSavedNote={onOpenSiblingNote}
              onAsk={(question, history) =>
                window.api.askAboutNote({
                  lecturePath: lecture.path,
                  ...coursePayload(course),
                  noteId: activeNote.id,
                  note: activeNote,
                  question,
                  history
                })
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
