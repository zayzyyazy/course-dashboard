import React from 'react';

export default function PinButton({
  pinned,
  onClick,
  title = 'Pin for Study overview',
  className = ''
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`text-xs px-2 py-1 rounded-md border transition-colors ${
        pinned
          ? 'border-accent/60 bg-accent/15 text-accent'
          : 'border-border-DEFAULT text-text-muted hover:text-accent hover:border-accent/40'
      } ${className}`}
    >
      {pinned ? '📌' : '📍'}
    </button>
  );
}
