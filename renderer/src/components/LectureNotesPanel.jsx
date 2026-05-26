import React from 'react';

export default function LectureNotesPanel({ notes, onOpenNote, onDelete, onOpenTopic }) {
  return (
    <section
      id="lecture-notes-anchor"
      className="mb-8 rounded-xl border border-border-DEFAULT bg-bg-secondary/40 p-4 scroll-mt-4"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide">
          Your notes ({notes.length})
        </h2>
        <p className="text-xs text-text-muted">Highlight text on a topic → save here</p>
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-text-muted leading-relaxed">
          No notes yet. Open a topic, select lines from the explanation, and tap{' '}
          <span className="text-accent">Save note</span>. They appear here for this lecture.
        </p>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <div
              key={n.id}
              className="rounded-lg border border-border-subtle bg-bg-secondary p-3 hover:border-accent/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <button
                  type="button"
                  onClick={() => onOpenTopic?.(n.topicId)}
                  className="text-xs font-medium text-accent hover:underline text-left"
                >
                  {n.topicTitle || 'Topic'}
                </button>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenNote(n)}
                    className="text-xs text-accent hover:text-accent-light font-medium"
                  >
                    Study
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(n.id)}
                    className="text-xs text-text-muted hover:text-red-400"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p className="text-sm text-text-muted line-clamp-2 italic border-l-2 border-accent/30 pl-2">
                {n.highlightedText}
              </p>
              {(n.refinedNote || n.note) && (
                <p className="text-xs text-text-secondary mt-1.5 line-clamp-1">
                  {(n.refinedNote || n.note).replace(/[#*_]/g, '').slice(0, 120)}
                  {(n.refinedNote || n.note).length > 120 ? '…' : ''}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
