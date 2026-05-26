import React from 'react';

export default function HomePage({ courses, onSelectCourse, onImportPdf }) {
  return (
    <div className="h-full overflow-y-auto no-drag">
      <div className="h-8 drag-region" />
      <div className="max-w-3xl mx-auto px-8 py-10">
        <h1 className="text-2xl font-bold text-text-primary mb-2">Course Dashboard</h1>
        <p className="text-text-secondary mb-8 leading-relaxed">
          Import lecture PDFs, get a clean topic breakdown, and study each topic with tutor-style cards — all stored locally.
        </p>

        {courses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-DEFAULT p-10 text-center">
            <p className="text-text-secondary mb-4">Create a course by importing your first lecture PDF.</p>
            <button
              type="button"
              onClick={onImportPdf}
              className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium"
            >
              Import lecture PDF
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {courses.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectCourse(c)}
                className="text-left rounded-xl border border-border-DEFAULT bg-bg-secondary hover:border-accent/40 p-5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{c.emoji || '📚'}</span>
                  <div>
                    <p className="font-semibold text-text-primary">{c.name}</p>
                    <p className="text-sm text-text-muted mt-0.5">Open course →</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
