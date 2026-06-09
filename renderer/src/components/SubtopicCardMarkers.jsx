import React from 'react';
import HighlightPreviewText from './HighlightPreviewText';
import { displayNoteTitle } from '../utils/noteDisplay';

export default function SubtopicCardMarkers({
  markers,
  allNotes = [],
  onOpenNote,
  onOpenLinkedNote,
  onDelete
}) {
  if (!markers?.length) return null;

  const noteById = new Map((allNotes || []).map((n) => [n.id, n]));

  return (
    <div className="mt-4 pt-3 border-t border-border-subtle">
      <p className="text-[10px] font-medium text-text-muted uppercase tracking-wide mb-2">
        Saved highlights ({markers.length})
      </p>
      <ul className="space-y-2">
        {markers.map((marker) => {
          const linked = marker.relatedNoteId ? noteById.get(marker.relatedNoteId) : null;
          const shortNote =
            marker.note &&
            marker.note.trim() &&
            marker.note.trim() !== marker.highlightedText?.trim()
              ? marker.note.trim()
              : '';

          return (
            <li
              key={marker.id}
              className="rounded-lg border border-accent/25 bg-accent/5 px-3 py-2.5 group"
            >
              <blockquote className="text-xs text-text-secondary border-l-2 border-accent/50 pl-2 mb-1.5 leading-relaxed">
                <HighlightPreviewText text={marker.highlightedText} />
              </blockquote>
              {shortNote && (
                <p className="text-xs text-text-primary mb-1.5 pl-0.5">{shortNote}</p>
              )}
              {linked && (
                <button
                  type="button"
                  onClick={() => onOpenLinkedNote?.(linked.id)}
                  className="text-[11px] text-accent hover:underline mb-1.5 block text-left"
                >
                  → {displayNoteTitle(linked)}
                </button>
              )}
              <div className="flex flex-wrap gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => onOpenNote?.(marker)}
                  className="text-[11px] text-text-muted hover:text-accent"
                >
                  Open note
                </button>
                <button
                  type="button"
                  onClick={() => onDelete?.(marker.id)}
                  className="text-[11px] text-red-400/80 hover:text-red-400 opacity-80 group-hover:opacity-100"
                >
                  Delete highlight
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
