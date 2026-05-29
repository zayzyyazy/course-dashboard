import React, { useMemo } from 'react';
import { buildNoteDisplayModel, displayNotePreview, displayNoteTitle } from '../utils/noteDisplay';

const PREVIEW_COUNT = 4;

export default function LectureNotesPreview({ notes, totalCount, onOpenNote, onViewAll }) {
  const displayModel = useMemo(() => buildNoteDisplayModel(notes), [notes]);
  const flatClusters = useMemo(
    () =>
      displayModel.sections.flatMap((s) =>
        s.clusters.map((c) => ({ ...c, topicTitle: s.topicTitle }))
      ),
    [displayModel]
  );
  const recent = flatClusters.slice(0, PREVIEW_COUNT);
  const more = flatClusters.length - recent.length;
  const total = totalCount ?? notes.length;

  if (total === 0) {
    return (
      <section className="mb-6 rounded-lg border border-dashed border-border-subtle px-4 py-3">
        <p className="text-xs text-text-muted">
          No saved notes yet — highlight text on a topic and tap <span className="text-accent">Save note</span>.
        </p>
      </section>
    );
  }

  if (notes.length === 0) {
    return (
      <section className="mb-6 rounded-lg border border-border-subtle bg-bg-secondary/30 px-4 py-3">
        <p className="text-xs text-text-muted">No notes match this topic filter.</p>
        <button type="button" onClick={onViewAll} className="mt-2 text-xs text-accent hover:underline">
          View all notes ({total}) →
        </button>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-lg border border-border-subtle bg-bg-secondary/30 px-4 py-3">
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
        {recent.map((c) => {
          const n = c.notes[0];
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onOpenNote(n)}
              className="w-full text-left rounded-md border border-transparent hover:border-accent/25 hover:bg-bg-secondary/80 px-2 py-1.5 transition-colors"
            >
              <p className="text-sm font-medium text-text-primary truncate">
                {c.count > 1 ? c.label : displayNoteTitle(n)}
              </p>
              <p className="text-[10px] text-text-muted truncate">
                {c.topicTitle}
                {c.count > 1 ? ` · ${c.count} related` : ''}
              </p>
              <p className="text-xs text-text-secondary line-clamp-2 mt-0.5">
                {c.count > 1 ? c.helpsWith : displayNotePreview(n)}
              </p>
            </button>
          );
        })}
      </div>
      {more > 0 && (
        <button
          type="button"
          onClick={onViewAll}
          className="mt-2 text-xs text-text-muted hover:text-accent w-full text-left"
        >
          +{more} more group{more === 1 ? '' : 's'}
        </button>
      )}
    </section>
  );
}
