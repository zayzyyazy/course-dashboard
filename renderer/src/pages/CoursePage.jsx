import React, { useCallback, useEffect, useState } from 'react';

export default function CoursePage({
  course,
  onOpenLecture,
  onBack,
  onOpenSettings,
  onRequestDeleteLecture,
  refreshKey
}) {
  const [data, setData] = useState({ lectures: [], stats: {} });
  const [loading, setLoading] = useState(true);
  const [reorderMode, setReorderMode] = useState(false);

  const load = useCallback(() => {
    if (!course) return;
    setLoading(true);
    window.api.getCourseLectures(course.storageKey || course.name).then((res) => {
      setData(res);
      setLoading(false);
    });
  }, [course?.storageKey, course?.name]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function handleMoveLecture(lectureId, direction) {
    const ids = data.lectures.map((l) => l.id);
    const i = ids.indexOf(lectureId);
    if (i < 0) return;
    const j = direction === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    const result = await window.api.reorderLectures({
      courseStorageKey: course.storageKey || course.name,
      lectureIds: ids
    });
    if (result.success) {
      setData({ lectures: result.lectures, stats: result.stats });
    }
  }

  if (!course) return null;

  const statsLine = [
    data.stats.lectureCount != null
      ? `${data.stats.lectureCount} lecture${data.stats.lectureCount === 1 ? '' : 's'}`
      : `${data.stats.total || 0} items`,
    data.stats.promotedCount > 0
      ? `${data.stats.promotedCount} study unit${data.stats.promotedCount === 1 ? '' : 's'}`
      : null,
    `${data.stats.topicsStudied || 0}/${data.stats.topicsTotal || 0} topics studied`
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="h-full flex flex-col overflow-hidden no-drag">
      <div className="h-8 drag-region flex-shrink-0" />
      <div className="px-8 pb-4 flex-shrink-0">
        <button type="button" onClick={onBack} className="text-xs text-text-muted hover:text-accent mb-2">
          ← All courses
        </button>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <span>{course.emoji}</span> {course.name}
            </h1>
            <p className="text-sm text-text-secondary mt-1">{statsLine}</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onOpenSettings}
              className="text-xs px-3 py-1.5 rounded-lg border border-border-DEFAULT text-text-muted hover:text-accent hover:border-accent/40"
              title="Course settings"
            >
              ⚙ Settings
            </button>
            {data.lectures.length > 1 && (
              <button
                type="button"
                onClick={() => setReorderMode((v) => !v)}
                className={`text-xs px-3 py-1.5 rounded-lg border ${
                  reorderMode
                    ? 'border-accent/50 bg-accent/15 text-accent'
                    : 'border-border-DEFAULT text-text-muted hover:text-text-secondary'
                }`}
              >
                {reorderMode ? 'Done reordering' : 'Reorder'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {loading ? (
          <p className="text-text-muted text-sm">Loading…</p>
        ) : data.lectures.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-DEFAULT p-8 text-center text-text-secondary text-sm">
            No lectures yet. Use <strong className="text-text-primary">Import lecture PDF</strong> in the
            sidebar.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {data.lectures.map((lec, i) => {
              const isPromoted = lec.itemType === 'promoted';
              return (
                <div
                  key={lec.id}
                  className={`rounded-xl border bg-bg-secondary hover:border-accent/35 transition-all ${
                    isPromoted ? 'border-amber-900/40' : 'border-border-DEFAULT'
                  }`}
                >
                  <div className="flex items-stretch">
                    {reorderMode && (
                      <div className="flex flex-col justify-center pl-2 py-3 gap-0.5">
                        <button
                          type="button"
                          disabled={i === 0}
                          onClick={() => handleMoveLecture(lec.id, 'up')}
                          className="text-text-muted hover:text-text-primary disabled:opacity-25 text-xs px-1"
                          aria-label="Move up"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          disabled={i === data.lectures.length - 1}
                          onClick={() => handleMoveLecture(lec.id, 'down')}
                          className="text-text-muted hover:text-text-primary disabled:opacity-25 text-xs px-1"
                          aria-label="Move down"
                        >
                          ▼
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => !reorderMode && onOpenLecture(lec)}
                      className={`flex-1 text-left p-5 min-w-0 ${reorderMode ? 'cursor-default' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span
                          className={`text-xs font-medium ${
                            isPromoted ? 'text-amber-400/90' : 'text-accent'
                          }`}
                        >
                          {isPromoted ? 'Study unit' : `Lecture ${lec.order || i + 1}`}
                        </span>
                        {lec.studyState?.opened && !reorderMode && (
                          <span className="text-xs text-text-muted">Opened</span>
                        )}
                      </div>
                      <h2 className="text-lg font-semibold text-text-primary leading-snug mb-2">
                        {lec.title}
                      </h2>
                      {isPromoted && lec.provenanceLabel && (
                        <p className="text-xs text-text-muted mb-2 leading-snug">{lec.provenanceLabel}</p>
                      )}
                      <p className="text-sm text-text-secondary line-clamp-3 mb-3">
                        {(lec.lectureSummary || lec.summary || '').slice(0, 180)}
                        {(lec.lectureSummary || lec.summary || '').length > 180 ? '…' : ''}
                      </p>
                      <p className="text-xs text-text-muted">
                        {lec.topicCount || 0} topics · {lec.studiedCount || 0} studied
                        {lec.hasExercise ? ' · Übung' : ''}
                      </p>
                    </button>
                    {!reorderMode && (
                      <button
                        type="button"
                        onClick={() => onRequestDeleteLecture(lec)}
                        className="px-3 text-text-muted hover:text-red-400 text-lg self-start pt-4"
                        title={isPromoted ? 'Remove study unit' : 'Delete lecture'}
                        aria-label={`Delete ${lec.title}`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
