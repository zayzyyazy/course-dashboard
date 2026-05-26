import React from 'react';

export default function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] no-drag pointer-events-none">
      <div className="px-4 py-2.5 rounded-lg bg-bg-tertiary border border-accent/40 text-sm text-text-primary shadow-lg">
        {message}
      </div>
    </div>
  );
}
