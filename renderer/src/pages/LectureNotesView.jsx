import React, { useMemo, useState } from 'react';
import LectureNotesTopicFilter from '../components/LectureNotesTopicFilter';
import { filterNotesByTopic, topicFilterOptions } from '../utils/lectureNotesUi';
import { buildNoteDisplayModel, displayNotePreview, displayNoteTitle } from '../utils/noteDisplay';

export default function LectureNotesView({
  lecture,
  notes,
  onBack,
  onOpenNote,
  onDelete,
  onTogglePin,
  onReorder,
  onMerge,
  onOpenTopic,
  onRebuildMetadata
}) {
  const [topicFilter, setTopicFilter] = useState('all');
  const [expandedClusters, setExpandedClusters] = useState(() => new Set());
  const [rebuilding, setRebuilding] = useState(false);
  const [dragSourceId, setDragSourceId] = useState('');
  const [dropTargetId, setDropTargetId] = useState('');
  const topicOptions = useMemo(() => topicFilterOptions(notes), [notes]);
  const filtered = useMemo(() => filterNotesByTopic(notes, topicFilter), [notes, topicFilter]);
  const displayModel = useMemo(() => buildNoteDisplayModel(filtered), [filtered]);
  const visibleNoteIds = useMemo(() => filtered.map((n) => n.id), [filtered]);

  async function handleRebuildMetadata() {
    if (!lecture?.path || rebuilding) return;
    setRebuilding(true);
    try {
      await onRebuildMetadata?.({
        topicId: topicFilter !== 'all' ? topicFilter : '',
        forceRetitle: true
      });
    } finally {
      setRebuilding(false);
    }
  }

  function toggleCluster(id) {
    setExpandedClusters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

  return (
    <div className="h-full flex flex-col overflow-hidden no-drag bg-bg-primary">
      <div className="h-8 drag-region flex-shrink-0" />
      <header className="px-8 py-4 border-b border-border-DEFAULT flex-shrink-0">
        <button type="button" onClick={onBack} className="text-xs text-text-muted hover:text-accent mb-2">
          ← Back to lecture
        </button>
        <h1 className="text-xl font-bold text-text-primary">Notes</h1>
        <p className="text-sm text-text-muted mt-0.5">
          {lecture?.title} · {filtered.length} shown
          {topicFilter !== 'all' ? ` · filtered` : ` · ${notes.length} total`}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
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
              title="Leitet Titel/Kurzbeschreibungen der sichtbaren Notizen neu ab"
            >
              {rebuilding ? 'Aktualisiere…' : 'Titel neu ableiten'}
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {notes.length === 0 ? (
          <p className="text-sm text-text-muted leading-relaxed">
            No notes for this lecture yet. Open a topic, highlight text, and save a note.
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-text-muted">No notes for this topic.</p>
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
                <div className="space-y-3">
                  {section.clusters.map((cluster) => {
                    const primary = cluster.notes[0];
                    const isMulti = cluster.count > 1;
                    const expanded = expandedClusters.has(cluster.id);

                    return (
                      <article
                        key={cluster.id}
                        draggable={Boolean(primary?.id)}
                        onDragStart={() => handleDragStart(primary?.id)}
                        onDragOver={(e) => handleDragOver(e, primary?.id)}
                        onDrop={(e) => handleDrop(e, primary?.id)}
                        onDragEnd={() => {
                          setDragSourceId('');
                          setDropTargetId('');
                        }}
                        className={noteCardClass(primary?.id)}
                      >
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              {isMulti ? (
                                <>
                                  <p className="font-medium text-text-primary leading-snug truncate">
                                    {cluster.label}
                                  </p>
                                  <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                                    {cluster.helpsWith}
                                  </p>
                                  <p className="text-[10px] text-text-muted mt-1">
                                    {cluster.count} related notes · open best match first
                                  </p>
                                  <p className="text-[10px] text-text-muted mt-1">
                                    Drag to reorder · Alt+drop to merge
                                  </p>
                                </>
                              ) : (
                                <>
                                  <h3 className="font-medium text-text-primary leading-snug truncate">
                                    {displayNoteTitle(primary)}
                                  </h3>
                                  <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                                    {displayNotePreview(primary)}
                                  </p>
                                  <p className="text-[10px] text-text-muted mt-1">
                                    Drag to reorder · Alt+drop to merge
                                  </p>
                                </>
                              )}
                            </div>
                            <div className="flex flex-col gap-1.5 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => onOpenNote(primary)}
                                className="text-xs px-2.5 py-1 rounded-md bg-accent text-white font-medium"
                              >
                                Study
                              </button>
                              <button
                                type="button"
                                onClick={() => onTogglePin?.(primary.id)}
                                className="text-xs px-2 py-1 text-text-muted hover:text-accent"
                              >
                                {primary.pinned ? 'Unpin' : 'Pin'}
                              </button>
                              {!isMulti && (
                                <button
                                  type="button"
                                  onClick={() => onDelete(primary.id)}
                                  className="text-xs px-2 py-1 text-text-muted hover:text-red-400"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {isMulti && (
                          <div className="border-t border-border-subtle bg-bg-primary/20">
                            <button
                              type="button"
                              onClick={() => toggleCluster(cluster.id)}
                              className="w-full text-left px-4 py-2 text-xs text-accent hover:bg-bg-hover"
                            >
                              {expanded ? 'Hide' : 'Show'} {cluster.count} notes in this group
                            </button>
                            {expanded && (
                              <ul className="px-4 pb-3 space-y-2">
                                {cluster.notes.map((n) => (
                                  <li
                                    key={n.id}
                                    draggable
                                    onDragStart={() => handleDragStart(n.id)}
                                    onDragOver={(e) => handleDragOver(e, n.id)}
                                    onDrop={(e) => handleDrop(e, n.id)}
                                    onDragEnd={() => {
                                      setDragSourceId('');
                                      setDropTargetId('');
                                    }}
                                    className={`rounded-lg border bg-bg-secondary/80 p-3 ${
                                      dropTargetId === n.id ? 'border-accent/70' : 'border-border-subtle'
                                    }`}
                                  >
                                    <div className="flex justify-between gap-2">
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium text-text-primary truncate">
                                          {displayNoteTitle(n)}
                                        </p>
                                        <p className="text-xs text-text-muted line-clamp-2 mt-0.5">
                                          {displayNotePreview(n)}
                                        </p>
                                      </div>
                                      <div className="flex gap-2 flex-shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => onOpenNote(n)}
                                          className="text-xs text-accent"
                                        >
                                          Study
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => onTogglePin?.(n.id)}
                                          className="text-xs text-text-muted hover:text-accent"
                                        >
                                          {n.pinned ? 'Unpin' : 'Pin'}
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
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
