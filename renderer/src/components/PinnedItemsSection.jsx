import React from 'react';

function pinTypeLabel(type) {
  if (type === 'study-unit') return 'Study unit';
  if (type === 'subtopic') return 'Subtopic';
  if (type === 'topic') return 'Topic';
  if (type === 'note') return 'Note';
  return type;
}

export default function PinnedItemsSection({
  items = [],
  onOpen,
  onUnpin,
  className = '',
  compact = false
}) {
  if (!items.length) return null;

  return (
    <section className={className}>
      <h2
        className={`font-semibold text-accent uppercase tracking-wide mb-2 ${
          compact ? 'text-[10px]' : 'text-xs'
        }`}
      >
        Pinned
      </h2>
      <div className="space-y-2">
        {items.map((pin) => (
          <div
            key={`${pin.type}:${pin.id}:${pin.materialMode || ''}`}
            className="rounded-lg border border-border-subtle bg-bg-secondary/60 px-3 py-2 flex items-center justify-between gap-2"
          >
            <button
              type="button"
              onClick={() => onOpen?.(pin)}
              className="min-w-0 text-left flex-1"
            >
              <p className="text-[10px] text-text-muted uppercase tracking-wide">
                {pinTypeLabel(pin.type)}
                {pin.materialMode === 'exercise' ? ' · Übung' : ''}
              </p>
              <p className={`text-text-primary truncate ${compact ? 'text-[11px]' : 'text-xs'}`}>
                {pin.title}
              </p>
              {pin.breadcrumb ? (
                <p className="text-[10px] text-text-muted truncate">{pin.breadcrumb}</p>
              ) : null}
            </button>
            {onUnpin ? (
              <button
                type="button"
                onClick={() => onUnpin(pin)}
                className="text-[10px] text-text-muted hover:text-accent flex-shrink-0"
              >
                Unpin
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
