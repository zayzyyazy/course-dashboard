import React from 'react';
import TitleWithMath from './TitleWithMath';

export default function PromoteTopicModal({ topic, lecture, onConfirm, onCancel }) {
  if (!topic) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/65 flex items-center justify-center no-drag p-4">
      <div className="bg-bg-secondary border border-border-DEFAULT rounded-xl w-full max-w-md p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-text-primary mb-2">Promote to study unit?</h2>
        <p className="text-sm text-text-secondary mb-4 leading-relaxed">
          <strong className="text-text-primary">
            <TitleWithMath text={topic.title} />
          </strong>{' '}
          will become its own study unit in
          this course — with a finer topic breakdown and tutor cards. The original lecture stays
          unchanged; this topic will be linked to the new unit.
        </p>
        <p className="text-xs text-text-muted mb-5">
          From lecture: {lecture?.title}
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className="w-full py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90"
          >
            Create study unit
          </button>
          <button type="button" onClick={onCancel} className="w-full py-2 text-sm text-text-muted">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
