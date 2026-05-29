import React from 'react';

/** Compact notes entry — no previews on the main learning screen. */
export default function LectureNotesEntry({ count, onOpen }) {
  if (!count) {
    return (
      <p className="mb-4 text-[11px] text-text-muted">
        No saved notes yet — highlight text on a topic and save a note.
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="mb-4 w-full flex items-center justify-between gap-2 rounded-lg border border-border-subtle bg-bg-secondary/25 px-3 py-2 text-left hover:border-accent/30 hover:bg-bg-secondary/50 transition-colors"
    >
      <span className="text-xs text-text-secondary">
        <span className="font-medium text-text-primary">{count}</span> saved note{count === 1 ? '' : 's'}
      </span>
      <span className="text-[11px] text-accent font-medium">View notes →</span>
    </button>
  );
}
