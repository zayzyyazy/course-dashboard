import React, { useMemo } from 'react';
import { buildNoteDisplayModel, displayNotePreview, displayNoteTitle, formatNoteDate } from '../utils/noteDisplay';

const PREVIEW_COUNT = 4;

export default function LectureNotesPreview({ notes, totalCount, onOpenNote, onViewAll }) {
  const displayModel = useMemo(() => buildNoteDisplayModel(notes), [notes]);
  const recent = useMemo(() => {
    const flat = displayModel.sections.flatMap((s) =>
      s.notes.map((n) => ({ ...n, topicTitle: s.topicTitle }))
    );
    return flat
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
      .slice(0, PREVIEW_COUNT);
  }, [displayModel]);
  const total = totalCount ?? notes.length;
  const more = Math.max(0, total - recent.length);

  if (total === 0) {
    return (
      <section className="mb-4 rounded-lg border border-dashed border-border-subtle px-4 py-3">
        <p className="text-xs text-text-muted">
          No saved notes yet — highlight text on a topic and tap <span className="text-accent">Save note</span>.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-4 rounded-lg border border-border-subtle bg-bg-secondary/30 px-4 py-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-xs font-medium text-text-muted uppercase tracking-wide">Recent notes</h2>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs text-accent hover:text-accent-light font-medium"
        >
          View all ({total}) →
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
            <p className="text-sm font-medium text-text-primary truncate">{displayNoteTitle(n)}</p>
            <p className="text-[10px] text-text-muted truncate">
              {n.topicTitle}
              {formatNoteDate(n.updatedAt || n.createdAt)
                ? ` · ${formatNoteDate(n.updatedAt || n.createdAt)}`
                : ''}
            </p>
            <p className="text-xs text-text-secondary line-clamp-1 mt-0.5">{displayNotePreview(n)}</p>
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
