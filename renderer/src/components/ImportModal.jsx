import React, { useState } from 'react';

export default function ImportModal({ courses, onConfirm, onCreateCourse, onCancel }) {
  const [courseId, setCourseId] = useState(courses[0]?.id || '');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!newName.trim()) return;
    const c = await onCreateCourse({ name: newName.trim() });
    if (c) {
      setCourseId(c.id);
      setCreating(false);
      setNewName('');
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center no-drag">
      <div className="bg-bg-secondary border border-border-DEFAULT rounded-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-lg font-semibold text-text-primary mb-1">Import lecture PDF</h2>
        <p className="text-sm text-text-secondary mb-4">Choose which course this lecture belongs to.</p>

        {!creating ? (
          <>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-full bg-bg-tertiary border border-border-DEFAULT rounded-lg px-3 py-2 text-sm text-text-primary mb-3"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="text-xs text-accent mb-4 block"
            >
              + New course
            </button>
          </>
        ) : (
          <div className="mb-4 flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Course name"
              className="flex-1 bg-bg-tertiary border border-border-DEFAULT rounded-lg px-3 py-2 text-sm"
            />
            <button type="button" onClick={handleCreate} className="px-3 py-2 rounded-lg bg-accent text-white text-sm">
              Add
            </button>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-text-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              const course = courses.find((c) => c.id === courseId);
              if (course) onConfirm(course);
            }}
            disabled={!courseId}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-40"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
