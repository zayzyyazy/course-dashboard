import React from 'react';
import MarkdownView from './MarkdownView';
import NoteChatPanel from './NoteChatPanel';
import { coursePayload } from '../utils/courseApi';

export default function NoteStudyView({
  note,
  course,
  lecture,
  hasApiKey,
  onClose,
  onOpenTopic
}) {
  if (!note) return null;

  const body = note.refinedNote || note.note;

  return (
    <div className="fixed inset-0 z-[80] bg-bg-primary flex flex-col no-drag">
      <div className="h-8 drag-region flex-shrink-0" />
      <header className="flex items-center justify-between gap-4 px-6 py-3 border-b border-border-DEFAULT flex-shrink-0">
        <div className="min-w-0">
          <p className="text-xs text-text-muted uppercase tracking-wide">Note study</p>
          <h1 className="text-lg font-semibold text-text-primary truncate">{note.topicTitle}</h1>
          <p className="text-xs text-text-muted truncate">
            {course?.name} · {lecture?.title}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {note.topicId && (
            <button
              type="button"
              onClick={() => onOpenTopic?.(note.topicId)}
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
        <div className="overflow-y-auto p-6">
          <blockquote className="text-sm text-text-secondary border-l-2 border-accent/50 pl-3 italic mb-4 leading-relaxed">
            {note.highlightedText}
          </blockquote>

          {note.keyIdeas?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {note.keyIdeas.map((idea, i) => (
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
            <div className="rounded-xl border border-border-DEFAULT bg-bg-secondary p-5 prose-note">
              <MarkdownView>{body}</MarkdownView>
            </div>
          ) : (
            <p className="text-sm text-text-muted">No note body — ask AI about the highlight.</p>
          )}

          {note.note && note.refinedNote && note.note !== note.refinedNote && (
            <div className="mt-6">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                Original draft
              </p>
              <p className="text-sm text-text-muted whitespace-pre-wrap">{note.note}</p>
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
              onAsk={(question, history) =>
                window.api.askAboutNote({
                  lecturePath: lecture.path,
                  ...coursePayload(course),
                  noteId: note.id,
                  note,
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
