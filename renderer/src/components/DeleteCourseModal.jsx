import React, { useEffect, useState } from 'react';

export default function DeleteCourseModal({ course, folderPath, onRemoveAppOnly, onDeleteDisk, onCancel }) {
  const [confirmDisk, setConfirmDisk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setConfirmDisk(false);
    setError('');
  }, [course?.id]);

  async function run(action) {
    setBusy(true);
    setError('');
    const result = action === 'disk' ? await onDeleteDisk() : await onRemoveAppOnly();
    setBusy(false);
    if (!result?.success) setError(result?.error || 'Delete failed');
  }

  if (!course) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center no-drag p-4">
      <div className="bg-bg-secondary border border-border-DEFAULT rounded-xl w-full max-w-md p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-text-primary mb-2">Delete course?</h2>
        <p className="text-sm text-text-secondary mb-4">
          You are about to remove <strong className="text-text-primary">{course.emoji} {course.name}</strong>.
        </p>

        {folderPath && (
          <p className="text-xs text-text-muted font-mono bg-bg-tertiary rounded-lg px-3 py-2 mb-4 break-all">
            {folderPath}
          </p>
        )}

        <div className="space-y-3 mb-5 text-sm text-text-secondary">
          <div className="rounded-lg border border-border-DEFAULT px-3 py-2.5">
            <p className="font-medium text-text-primary text-xs uppercase tracking-wide mb-1">
              Remove from app only
            </p>
            <p>Hides the course in Course Dashboard. Lecture PDFs and processed files stay on disk.</p>
          </div>
          <div className="rounded-lg border border-red-900/50 bg-red-950/20 px-3 py-2.5">
            <p className="font-medium text-red-300 text-xs uppercase tracking-wide mb-1">
              Delete from app and disk
            </p>
            <p>Permanently deletes the course folder, including all lectures, PDFs, and topic data.</p>
            <label className="flex items-start gap-2 mt-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmDisk}
                onChange={(e) => setConfirmDisk(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-xs text-red-200/90">
                I understand this cannot be undone
              </span>
            </label>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400 mb-3">{error}</p>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => run('app')}
            className="w-full py-2.5 rounded-lg border border-border-DEFAULT text-text-primary text-sm font-medium hover:bg-bg-hover disabled:opacity-40"
          >
            Remove from app only
          </button>
          <button
            type="button"
            disabled={busy || !confirmDisk}
            onClick={() => run('disk')}
            className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Delete from app and disk
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="w-full py-2 text-sm text-text-muted hover:text-text-secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
