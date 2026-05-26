import React from 'react';

function noteTitle(note) {
  return note.title || note.topicTitle || 'Note';
}

function notePreview(note) {
  const body = note.refinedNote || note.note || '';
  const text = body.replace(/[#*_]/g, '').replace(/\s+/g, ' ').trim();
  return text.slice(0, 160) + (text.length > 160 ? '…' : '');
}

export default function LectureNotesView({
  lecture,
  notes,
  onBack,
  onOpenNote,
  onDelete,
  onOpenTopic
}) {
  return (
    <div className="h-full flex flex-col overflow-hidden no-drag bg-bg-primary">
      <div className="h-8 drag-region flex-shrink-0" />
      <header className="px-8 py-4 border-b border-border-DEFAULT flex-shrink-0">
        <button type="button" onClick={onBack} className="text-xs text-text-muted hover:text-accent mb-2">
          ← Back to lecture
        </button>
        <h1 className="text-xl font-bold text-text-primary">Notes</h1>
        <p className="text-sm text-text-muted mt-0.5">
          {lecture?.title} · {notes.length} saved
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {notes.length === 0 ? (
          <p className="text-sm text-text-muted leading-relaxed">
            No notes for this lecture yet. Open a topic, highlight text, and save a note.
          </p>
        ) : (
          <div className="max-w-2xl mx-auto space-y-3">
            {notes.map((n) => (
              <article
                key={n.id}
                className="rounded-xl border border-border-DEFAULT bg-bg-secondary p-4 hover:border-accent/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <h2 className="font-medium text-text-primary leading-snug">{noteTitle(n)}</h2>
                    {n.topicTitle && n.title && (
                      <button
                        type="button"
                        onClick={() => onOpenTopic?.(n.topicId)}
                        className="text-xs text-accent hover:underline mt-0.5"
                      >
                        {n.topicTitle}
                      </button>
                    )}
                    {!n.title && n.topicTitle && (
                      <button
                        type="button"
                        onClick={() => onOpenTopic?.(n.topicId)}
                        className="text-xs text-text-muted hover:text-accent mt-0.5"
                      >
                        {n.topicTitle}
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenNote(n)}
                      className="text-xs px-2.5 py-1 rounded-md bg-accent text-white font-medium"
                    >
                      Study
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(n.id)}
                      className="text-xs px-2 py-1 text-text-muted hover:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="text-xs text-text-muted italic border-l-2 border-accent/30 pl-2 line-clamp-2 mb-2">
                  {n.highlightedText}
                </p>
                {(n.refinedNote || n.note) && (
                  <p className="text-sm text-text-secondary line-clamp-3">{notePreview(n)}</p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
