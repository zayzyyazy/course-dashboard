import React from 'react';
import LectureNotesPreview from './LectureNotesPreview';

export default function LectureNotesEntry({ notes = [], onOpen, onOpenNote }) {
  const count = notes.length;

  if (!count) {
    return (
      <p className="mb-4 text-[11px] text-text-muted">
        No saved notes yet — highlight text on a topic and save a note.
      </p>
    );
  }

  return (
    <div className="mb-4">
      <LectureNotesPreview
        notes={notes}
        totalCount={count}
        onOpenNote={(note) => {
          if (onOpenNote) onOpenNote(note);
          else onOpen?.();
        }}
        onViewAll={onOpen}
      />
    </div>
  );
}
