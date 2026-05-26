import React from 'react';

const PREVIEW_COUNT = 3;

function noteTitle(note) {
  return note.title || note.topicTitle || 'Note';
}

function notePreview(note) {
  const body = note.refinedNote || note.note || note.highlightedText || '';
  return body.replace(/[#*_]/g, '').replace(/\s+/g, ' ').trim().slice(0, 90);
}

export default function LectureNotesPreview({ notes, onOpenNote, onViewAll }) {
  const recent = notes.slice(0, PREVIEW_COUNT);
  const more = notes.length - recent.length;

  if (notes.length === 0) {
    return (
      <section className="mb-6 rounded-lg border border-dashed border-border-subtle px-4 py-3">
        <p className="text-xs text-text-muted">
          No saved notes yet — highlight text on a topic and tap <span className="text-accent">Save note</span>.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-lg border border-border-subtle bg-bg-secondary/30 px-4 py-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-xs font-medium text-text-muted uppercase tracking-wide">
          Recent notes
        </h2>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs text-accent hover:text-accent-light font-medium"
        >
          View all ({notes.length}) →
        </button>
      </div>
      <div className="space-y-1.5">
        {recent.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => onOpenNote(n)}
            className="w-full text-left rounded-md border border-transparent hover:border-accent/25 hover:bg-bg-secondary/80 px-2 py-1.5 transition-colors"
          >
            <p className="text-sm font-medium text-text-primary truncate">{noteTitle(n)}</p>
            <p className="text-xs text-text-muted truncate">{notePreview(n)}</p>
          </button>
        ))}
      </div>
      {more > 0 && (
        <button
          type="button"
          onClick={onViewAll}
          className="mt-2 text-xs text-text-muted hover:text-accent w-full text-left"
        >
          +{more} more note{more === 1 ? '' : 's'}
        </button>
      )}
    </section>
  );
}
