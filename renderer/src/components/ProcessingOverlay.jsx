import React from 'react';

export default function ProcessingOverlay({ status, onCancel }) {
  if (!status) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center no-drag">
      <div className="bg-bg-secondary border border-border-DEFAULT rounded-xl px-8 py-6 max-w-md w-full mx-4 text-center">
        <div className="w-8 h-8 mx-auto mb-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        <p className="text-text-primary font-medium">{status.title || 'Processing'}</p>
        <p className="text-sm text-text-secondary mt-2">{status.message || 'Working…'}</p>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="mt-4 text-xs text-text-muted hover:text-text-secondary"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
