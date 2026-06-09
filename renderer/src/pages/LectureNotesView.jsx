import React, { useMemo, useState } from 'react';
import LectureNotesTopicFilter from '../components/LectureNotesTopicFilter';
import { filterNotesByQuery, filterNotesByTopic, topicFilterOptions } from '../utils/lectureNotesUi';
import {
  buildNoteDisplayModel,
  displayNotePreview,
  displayNoteTitle,
  formatNoteDate,
  noteContextLabel
} from '../utils/noteDisplay';

export default function LectureNotesView({
  lecture,
  notes,
  onBack,
  onOpenNote,
  onDelete,
  onTogglePin,
  onReorder,
  onMerge,
  onUpdateTitle,
  onRebuildMetadata,
  onNotify
}) {
  const [topicFilter, setTopicFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [rebuilding, setRebuilding] = useState(false);
  const [dragSourceId, setDragSourceId] = useState('');
  const [dropTargetId, setDropTargetId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);

  const topicOptions = useMemo(() => topicFilterOptions(notes), [notes]);
  const searched = useMemo(() => filterNotesByQuery(notes, searchQuery), [notes, searchQuery]);
  const filtered = useMemo(() => filterNotesByTopic(searched, topicFilter), [searched, topicFilter]);
  const topicOrder = useMemo(
    () => (lecture?.topics || []).map((t) => t.id).filter(Boolean),
    [lecture?.topics]
  );
  const displayModel = useMemo(
    () => buildNoteDisplayModel(filtered, topicOrder),
    [filtered, topicOrder]
  );
  const visibleNoteIds = useMemo(
    () => displayModel.sections.flatMap((s) => s.notes.map((n) => n.id)),
    [displayModel]
  );

  async function handleRebuildMetadata() {
    if (!lecture?.path || rebuilding) return;
    setRebuilding(true);
    try {
      const res = await onRebuildMetadata?.({
        topicId: topicFilter !== 'all' ? topicFilter : '',
        forceRetitle: true
      });
      if (res?.success) {
        const n = res.updated ?? 0;
        onNotify?.(
          n > 0
            ? `Repaired ${n} title${n === 1 ? '' : 's'}`
            : 'Titles already up to date'
        );
      }
    } finally {
      setRebuilding(false);
    }
  }

  function startEditTitle(note) {
    setEditingId(note.id);
    setEditTitle(displayNoteTitle(note));
  }

  async function saveEditTitle(noteId) {
    if (!editTitle.trim() || savingTitle) return;
    setSavingTitle(true);
    try {
      await onUpdateTitle?.(noteId, editTitle.trim());
      setEditingId('');
      setEditTitle('');
    } finally {
      setSavingTitle(false);
    }
  }

  function handleDragStart(noteId) {
    setDragSourceId(noteId);
  }

  function handleDragOver(e, noteId) {
    e.preventDefault();
    if (noteId !== dragSourceId) setDropTargetId(noteId);
  }

  async function handleDrop(e, targetId) {
    e.preventDefault();
    const sourceId = dragSourceId;
    setDropTargetId('');
    setDragSourceId('');
    if (!sourceId || !targetId || sourceId === targetId) return;
    if (e.altKey) {
      await onMerge?.(sourceId, targetId);
      return;
    }
    const ids = [...visibleNoteIds];
    const from = ids.indexOf(sourceId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    const insertAt = ids.indexOf(targetId);
    ids.splice(insertAt, 0, sourceId);
    await onReorder?.(ids, { topicId: topicFilter !== 'all' ? topicFilter : '' });
  }

  function noteCardClass(noteId) {
    const dropping = dropTargetId === noteId;
    return `rounded-xl border bg-bg-secondary overflow-hidden ${
      dropping ? 'border-accent/70' : 'border-border-DEFAULT'
    }`;
  }

  function renderNoteCard(note) {
    const context = noteContextLabel(note);
    const isEditing = editingId === note.id;

    return (
      <article
        key={note.id}
        draggable={Boolean(note.id)}
        onDragStart={() => handleDragStart(note.id)}
        onDragOver={(e) => handleDragOver(e, note.id)}
        onDrop={(e) => handleDrop(e, note.id)}
        onDragEnd={() => {
          setDragSourceId('');
          setDropTargetId('');
        }}
        className={noteCardClass(note.id)}
      >
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {isEditing ? (
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEditTitle(note.id);
                      if (e.key === 'Escape') {
                        setEditingId('');
                        setEditTitle('');
                      }
                    }}
                    className="flex-1 min-w-[10rem] text-sm px-2 py-1 rounded-md border border-border-DEFAULT bg-bg-primary text-text-primary"
                    autoFocus
                  />
                  <button
                    type="button"
                    disabled={savingTitle}
                    onClick={() => saveEditTitle(note.id)}
                    className="text-xs px-2 py-1 rounded-md bg-accent text-white"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId('');
                      setEditTitle('');
                    }}
                    className="text-xs px-2 py-1 text-text-muted"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => startEditTitle(note)}
                  className="text-left w-full group"
                  title="Click to rename"
                >
                  <h3 className="font-medium text-text-primary leading-snug truncate group-hover:text-accent">
                    {displayNoteTitle(note)}
                  </h3>
                </button>
              )}
              <p className="text-xs text-text-secondary mt-1 line-clamp-2">{displayNotePreview(note)}</p>
              <p className="text-[10px] text-text-muted mt-2 flex flex-wrap gap-x-2 gap-y-0.5">
                {context ? <span>{context}</span> : null}
                {context ? <span aria-hidden>·</span> : null}
                <span>{formatNoteDate(note.updatedAt || note.createdAt)}</span>
                {note.pinned ? <span className="text-accent">Pinned</span> : null}
              </p>
              <p className="text-[10px] text-text-muted mt-1">Drag to reorder · Alt+drop to merge</p>
            </div>
            <div className="flex flex-col gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => onOpenNote(note)}
                className="text-xs px-2.5 py-1 rounded-md bg-accent text-white font-medium"
              >
                Study
              </button>
              <button
                type="button"
                onClick={() => onTogglePin?.(note.id)}
                className="text-xs px-2 py-1 text-text-muted hover:text-accent"
              >
                {note.pinned ? 'Unpin' : 'Pin'}
              </button>
              <button
                type="button"
                onClick={() => onDelete(note.id)}
                className="text-xs px-2 py-1 text-text-muted hover:text-red-400"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden no-drag bg-bg-primary">
      <div className="h-8 drag-region flex-shrink-0" />
      <header className="px-4 sm:px-6 lg:px-8 py-4 border-b border-border-DEFAULT flex-shrink-0">
        <button type="button" onClick={onBack} className="text-xs text-text-muted hover:text-accent mb-2">
          ← Back to lecture
        </button>
        <h1 className="text-xl font-bold text-text-primary">Notes</h1>
        <p className="text-sm text-text-muted mt-0.5">
          {lecture?.title} · {filtered.length} shown
          {searchQuery.trim() ? ` · search` : ''}
          {topicFilter !== 'all' ? ` · filtered` : ` · ${notes.length} total`}
        </p>
        <div className="mt-3 space-y-3">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes…"
            className="w-full max-w-md text-sm px-3 py-2 rounded-lg border border-border-DEFAULT bg-bg-secondary text-text-primary placeholder:text-text-muted"
          />
          <div className="flex flex-wrap items-center gap-3">
            <LectureNotesTopicFilter
              options={topicOptions}
              value={topicFilter}
              onChange={setTopicFilter}
              totalCount={notes.length}
            />
            {notes.length > 0 && onRebuildMetadata && (
              <button
                type="button"
                onClick={handleRebuildMetadata}
                disabled={rebuilding}
                className="text-[11px] px-2.5 py-1 rounded-lg border border-border-DEFAULT text-text-muted hover:text-accent hover:border-accent/40 disabled:opacity-40"
                title="Repair auto-generated titles for visible notes"
              >
                {rebuilding ? 'Repairing…' : 'Repair titles'}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
        {notes.length === 0 ? (
          <p className="text-sm text-text-muted leading-relaxed">
            No notes for this lecture yet. Open a topic, highlight text, and save a note.
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-text-muted">
            {searchQuery.trim() ? 'No notes match your search.' : 'No notes for this topic.'}
          </p>
        ) : (
          <div className="max-w-2xl mx-auto space-y-6">
            {displayModel.sections.map((section) => (
              <section key={section.topicId || section.topicTitle}>
                <h2 className="text-xs font-semibold text-accent uppercase tracking-wide mb-3">
                  {section.topicTitle}
                  <span className="text-text-muted font-normal ml-2">
                    ({section.noteCount} note{section.noteCount === 1 ? '' : 's'})
                  </span>
                </h2>
                <div className="space-y-3">{section.notes.map((note) => renderNoteCard(note))}</div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
