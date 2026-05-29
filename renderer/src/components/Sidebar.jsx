import React from 'react';

export default function Sidebar({
  courses,
  selectedCourseId,
  reorderMode,
  onToggleReorder,
  onSelectCourse,
  onMoveCourse,
  onRequestDeleteCourse,
  onImportPdf,
  onOpenSettings,
  onGoHome
}) {
  return (
    <aside className="w-56 flex-shrink-0 border-r border-border-DEFAULT bg-bg-secondary flex flex-col h-full">
      <div className="h-8 drag-region flex-shrink-0" />
      <div className="px-4 pb-3 no-drag">
        <button type="button" onClick={onGoHome} className="text-left w-full">
          <p className="text-xs text-text-muted uppercase tracking-wider">Course Dashboard</p>
          <p className="text-sm font-semibold text-text-primary mt-0.5">Study overview</p>
        </button>
      </div>

      <div className="px-3 mb-2 no-drag">
        <button
          type="button"
          onClick={onImportPdf}
          className="w-full py-2.5 rounded-lg bg-accent hover:bg-accent-dark text-white text-sm font-medium transition-colors"
        >
          + Import lecture PDF
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4 no-drag">
        <div className="flex items-center justify-between px-2 mb-2">
          <p className="text-xs text-text-muted uppercase tracking-wide">Courses</p>
          {courses.length > 1 && (
            <button
              type="button"
              onClick={onToggleReorder}
              className={`text-xs px-2 py-0.5 rounded ${
                reorderMode ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {reorderMode ? 'Done' : 'Reorder'}
            </button>
          )}
        </div>

        {courses.length === 0 && (
          <p className="px-2 text-xs text-text-muted">No courses yet</p>
        )}

        {courses.map((c, index) => (
          <div
            key={c.id}
            className={`flex items-center gap-0.5 mb-0.5 rounded-lg ${
              selectedCourseId === c.id && !reorderMode ? 'bg-accent/15' : ''
            }`}
          >
            {reorderMode ? (
              <div className="flex flex-col flex-shrink-0 pl-1">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => onMoveCourse(c.id, 'up')}
                  className="text-text-muted hover:text-text-primary disabled:opacity-25 text-xs leading-none px-1"
                  aria-label="Move up"
                >
                  ▲
                </button>
                <button
                  type="button"
                  disabled={index === courses.length - 1}
                  onClick={() => onMoveCourse(c.id, 'down')}
                  className="text-text-muted hover:text-text-primary disabled:opacity-25 text-xs leading-none px-1"
                  aria-label="Move down"
                >
                  ▼
                </button>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => !reorderMode && onSelectCourse(c)}
              className={`flex-1 flex items-center gap-2 px-2 py-2 rounded-lg text-sm min-w-0 transition-colors ${
                reorderMode
                  ? 'cursor-default text-text-secondary'
                  : selectedCourseId === c.id
                    ? 'text-text-primary'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`}
            >
              <span className="flex-shrink-0">{c.emoji || '📚'}</span>
              <span className="truncate text-left">{c.name}</span>
            </button>

            {!reorderMode && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRequestDeleteCourse(c);
                }}
                className="flex-shrink-0 px-2 py-2 text-text-muted hover:text-red-400 text-xs"
                title="Delete course"
                aria-label={`Delete ${c.name}`}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-border-subtle no-drag">
        <button
          type="button"
          onClick={onOpenSettings}
          className="text-xs text-text-muted hover:text-text-secondary"
        >
          Settings
        </button>
      </div>
    </aside>
  );
}
