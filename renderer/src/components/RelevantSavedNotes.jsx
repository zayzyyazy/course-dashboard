import React from 'react';

/**
 * Surfaces 1–3 saved notes that match the student's question, with direct open actions.
 */
export default function RelevantSavedNotes({ notes, onOpenNote, className = '' }) {
  if (!notes?.length) return null;

  return (
    <div
      className={`rounded-lg border border-amber-900/35 bg-amber-950/20 px-3 py-2.5 ${className}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/80 mb-2">
        Relevant saved notes
      </p>
      <p className="text-[11px] text-text-muted mb-2 leading-relaxed">
        {notes.length === 1
          ? 'Your saved note may already answer this'
          : 'Up to 2 saved notes may already answer this'}{' '}
        — open instead of re-writing the same idea.
      </p>
      <ul className="space-y-2">
        {notes.map((n) => (
          <li
            key={n.id}
            className="flex items-start justify-between gap-2 rounded-md border border-border-subtle bg-bg-primary/40 px-2.5 py-2"
          >
            <div className="min-w-0">
              <p className="text-xs font-medium text-text-primary truncate">{n.title}</p>
              {n.preview && (
                <p className="text-[11px] text-text-muted line-clamp-2 mt-0.5 leading-relaxed">
                  {n.preview}
                </p>
              )}
              <p className="text-[10px] text-amber-200/60 mt-0.5">{n.reason}</p>
            </div>
            <button
              type="button"
              onClick={() => onOpenNote?.(n)}
              className="flex-shrink-0 text-[11px] px-2 py-1 rounded-md border border-accent/50 bg-accent/15 text-accent font-medium hover:bg-accent/25"
            >
              Open note
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
