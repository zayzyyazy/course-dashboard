import React from 'react';
import MarkdownView from './MarkdownView';
import HighlightPreviewText from './HighlightPreviewText';

export default function NoteDetailModal({ note, onClose, onOpenTopic }) {
  if (!note) return null;

  const body = note.refinedNote || note.note;

  return (
    <div className="fixed inset-0 z-[65] bg-black/70 flex items-center justify-center no-drag p-4">
      <div className="bg-bg-secondary border border-border-DEFAULT rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-border-subtle flex-shrink-0">
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wide">Saved note</p>
            <h2 className="text-lg font-semibold text-text-primary mt-0.5">{note.topicTitle}</h2>
            {note.source === 'deep' && (
              <p className="text-xs text-accent mt-0.5">From deeper explanation</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text-primary text-xl leading-none px-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
              Highlighted from topic card
            </p>
            <blockquote className="text-sm text-text-secondary border-l-2 border-accent/50 pl-3">
              <HighlightPreviewText text={note.highlightedText} />
            </blockquote>
          </div>

          {note.keyIdeas?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                Key ideas
              </p>
              <ul className="flex flex-wrap gap-2">
                {note.keyIdeas.map((idea, i) => (
                  <li
                    key={i}
                    className="text-xs px-2.5 py-1 rounded-full bg-accent/15 text-accent border border-accent/25"
                  >
                    {idea}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {body && (
            <div>
              <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                {note.refinedNote ? 'Study note (refined)' : 'Your note'}
              </p>
              <div className="rounded-lg border border-border-DEFAULT bg-bg-tertiary/50 p-4">
                <MarkdownView>{body}</MarkdownView>
              </div>
            </div>
          )}

          {note.note && note.refinedNote && note.note !== note.refinedNote && (
            <div>
              <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                Original draft
              </p>
              <p className="text-sm text-text-muted whitespace-pre-wrap">{note.note}</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border-subtle flex justify-end gap-2 flex-shrink-0">
          {note.topicId && (
            <button
              type="button"
              onClick={() => onOpenTopic?.(note)}
              className="px-4 py-2 rounded-lg border border-border-DEFAULT text-sm text-text-secondary hover:text-accent"
            >
              Open topic
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
