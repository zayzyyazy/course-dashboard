import React, { useMemo } from 'react';
import LectureNotesTopicFilter from './LectureNotesTopicFilter';
import {
  buildNoteDisplayModel,
  displayNotePreview,
  displayNoteTitle,
  formatNoteDate,
  noteContextLabel
} from '../utils/noteDisplay';

export default function LectureNotesPanel({
  notes,
  allNotes,
  topicFilter,
  onTopicFilterChange,
  topicOptions,
  onOpenNote,
  onDelete
}) {
  const total = allNotes?.length ?? notes.length;
  const displayModel = useMemo(() => buildNoteDisplayModel(notes), [notes]);

  return (
    <section
      id="lecture-notes-anchor"
      className="mb-8 rounded-xl border border-border-DEFAULT bg-bg-secondary/40 p-4 scroll-mt-4"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide">
          Your notes ({total})
        </h2>
      </div>

      {total > 0 && topicOptions.length > 0 && (
        <LectureNotesTopicFilter
          options={topicOptions}
          value={topicFilter}
          onChange={onTopicFilterChange}
          totalCount={total}
        />
      )}

      {total === 0 ? (
        <p className="text-sm text-text-muted leading-relaxed">
          No notes yet. Open a topic, select lines from the explanation, and tap{' '}
          <span className="text-accent">Save note</span>.
        </p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-text-muted">No notes for this topic filter.</p>
      ) : (
        <div className="space-y-4">
          {displayModel.sections.map((section) => (
            <div key={section.topicId || section.topicTitle}>
              <p className="text-[10px] font-semibold text-accent uppercase tracking-wide mb-1.5">
                {section.topicTitle}
              </p>
              <div className="space-y-2">
                {section.notes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-lg border border-border-subtle bg-bg-secondary p-3 hover:border-accent/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {displayNoteTitle(note)}
                        </p>
                        <p className="text-xs text-text-secondary line-clamp-2 mt-0.5">
                          {displayNotePreview(note)}
                        </p>
                        <p className="text-[10px] text-text-muted mt-1">
                          {noteContextLabel(note) || section.topicTitle}
                          {formatNoteDate(note.updatedAt || note.createdAt)
                            ? ` · ${formatNoteDate(note.updatedAt || note.createdAt)}`
                            : ''}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => onOpenNote(note)}
                          className="text-xs text-accent font-medium"
                        >
                          Study
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(note.id)}
                          className="text-xs text-text-muted hover:text-red-400"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
