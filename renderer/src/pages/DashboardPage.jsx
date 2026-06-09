import React, { useCallback, useEffect, useState } from 'react';
import TitleWithMath from '../components/TitleWithMath';
import PinnedItemsSection from '../components/PinnedItemsSection';
import DashboardAskPanel from '../components/DashboardAskPanel';
import { pinToNavTarget } from '../utils/dashboardPinNav';
import { courseHasPracticeCoach } from '../utils/openPracticeCoach';
import { fetchEpcPracticeStats } from '../utils/epcPracticeStats';

function formatExamShort(days) {
  if (days == null) return null;
  if (days < 0) return `Exam ${Math.abs(days)}d ago`;
  if (days === 0) return 'Exam today';
  if (days === 1) return 'Exam tomorrow';
  return `Exam ${days}d`;
}

function ProgressBar({ percent }) {
  return (
    <div className="h-1.5 rounded-full bg-bg-hover overflow-hidden">
      <div className="h-full bg-accent transition-all" style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
  );
}

export default function DashboardPage({
  courses,
  onOpenTarget,
  onImportPdf,
  onOpenSettings,
  hasApiKey = false,
  refreshKey = 0
}) {
  const [data, setData] = useState(null);
  const [epcStats, setEpcStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [res, practice] = await Promise.all([
      window.api.getDashboardOverview(),
      fetchEpcPracticeStats()
    ]);
    if (res?.success) setData(res);
    else setData(null);
    setEpcStats(practice);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load, courses.length, courses.map((c) => c.id).join(','), refreshKey]);

  function openTarget(target) {
    if (!target?.courseId) return;
    onOpenTarget?.(target);
  }

  async function handleUnpin(pin) {
    if (!pin?.lecturePath) return;
    if (pin.type === 'note') {
      await window.api.toggleNotePin({ lecturePath: pin.lecturePath, noteId: pin.id });
    } else if (pin.type === 'topic') {
      await window.api.toggleTopicPin({
        lecturePath: pin.lecturePath,
        topicId: pin.topicId,
        materialMode: pin.materialMode || 'lecture'
      });
    } else if (pin.type === 'subtopic') {
      await window.api.toggleSubtopicPin({
        lecturePath: pin.lecturePath,
        topicId: pin.topicId,
        subtopicId: pin.subtopicId,
        materialMode: pin.materialMode || 'lecture'
      });
    } else {
      await window.api.toggleLecturePin({ lecturePath: pin.lecturePath });
    }
    await load();
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted text-sm no-drag">
        Loading dashboard…
      </div>
    );
  }

  if (!courses.length) {
    return (
      <div className="h-full overflow-y-auto no-drag">
        <div className="h-8 drag-region" />
        <div className="max-w-4xl mx-auto px-8 py-6 pb-12">
          <h1 className="text-2xl font-bold text-text-primary mb-2">Study overview</h1>
          <p className="text-sm text-text-secondary mb-5">
            Import lectures to track progress — expand <span className="text-accent">Ask about my study plan</span>{' '}
            below once you have courses.
          </p>
          <DashboardAskPanel
            hasApiKey={hasApiKey}
            topPick={null}
            onOpenTarget={openTarget}
            onOpenSettings={onOpenSettings}
          />
          <div className="rounded-xl border border-dashed border-border-DEFAULT p-10 text-center mt-4">
            <p className="text-text-secondary mb-4">No courses yet.</p>
            <button
              type="button"
              onClick={onImportPdf}
              className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium"
            >
              Import lecture PDF
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { courseCards = [], topPick, pinnedItems = [] } = data || {};

  return (
    <div className="h-full overflow-y-auto no-drag">
      <div className="h-8 drag-region" />
      <div className="max-w-4xl mx-auto px-8 py-6 pb-12">
        <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Study overview</h1>
            <p className="text-sm text-text-secondary mt-0.5">
              Ask AI about your plan · pinned shortcuts · best next step per course
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="text-xs px-2.5 py-1 rounded-md border border-border-DEFAULT text-text-muted hover:text-accent"
          >
            Refresh
          </button>
        </div>

        <DashboardAskPanel
          hasApiKey={hasApiKey}
          topPick={topPick}
          onOpenTarget={openTarget}
          onOpenSettings={onOpenSettings}
        />

        <section className="mb-6">
          {pinnedItems.length > 0 ? (
            <PinnedItemsSection
              items={pinnedItems}
              onOpen={(pin) => {
                const target = pinToNavTarget(pin);
                if (target) openTarget(target);
              }}
              onUnpin={handleUnpin}
            />
          ) : (
            <>
              <h2 className="text-xs font-semibold text-accent uppercase tracking-wide mb-2">Pinned</h2>
              <div className="rounded-xl border border-dashed border-border-DEFAULT bg-bg-secondary/40 px-4 py-3">
                <p className="text-sm text-text-secondary leading-relaxed">
                  Nothing pinned yet. Use 📍 on a lecture, topic, subtopic, or note — pinned items show up
                  here with links back to where you saved them.
                </p>
                <p className="text-[10px] text-text-muted mt-2">
                  (Not the same as &quot;Pin to screen&quot; on highlighted text — that is session-only.)
                </p>
              </div>
            </>
          )}
        </section>

        {topPick && (
          <section className="mb-6">
            <p className="text-xs font-medium text-accent uppercase tracking-wide mb-2">Best next step</p>
            <button
              type="button"
              onClick={() => openTarget(topPick)}
              className="w-full text-left rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 hover:border-accent/60 transition-colors"
            >
              <p className="text-xs text-text-muted">
                {topPick.courseEmoji || '📚'} {topPick.courseName}
              </p>
              <p className="text-sm font-medium text-text-primary mt-0.5 truncate">
                <TitleWithMath text={topPick.lectureTitle} />
              </p>
              <p className="text-[10px] text-text-muted mt-1">
                {topPick.itemType === 'study-unit' ? 'Study unit' : 'Lecture'}
              </p>
              {topPick.topicTitle && (
                <p className="text-xs text-accent/90 truncate mt-0.5">
                  → <TitleWithMath text={topPick.topicTitle} />
                </p>
              )}
              {topPick.reason && (
                <p className="text-[10px] text-text-muted mt-1.5">{topPick.reason}</p>
              )}
            </button>
          </section>
        )}

        <section>
          <h2 className="text-sm font-semibold text-text-primary mb-3">Courses</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {courseCards.map((c) => {
              const practiceRow =
                epcStats && courseHasPracticeCoach({ storageKey: c.storageKey })
                  ? epcStats[c.storageKey]
                  : null;
              return (
              <button
                key={c.id}
                type="button"
                disabled={!c.nextStep}
                onClick={() => {
                  if (c.nextStep) {
                    openTarget({
                      courseId: c.id,
                      lectureId: c.nextStep.lectureId,
                      topicId: c.nextStep.topicId
                    });
                  }
                }}
                className={`text-left rounded-xl border p-4 transition-colors ${
                  c.nextStep
                    ? 'border-border-DEFAULT bg-bg-secondary hover:border-accent/35'
                    : 'border-border-subtle bg-bg-secondary/50 opacity-80 cursor-default'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-semibold text-text-primary truncate">
                    {c.emoji || '📚'} {c.name}
                  </p>
                  <span className="text-xs text-text-muted flex-shrink-0">{c.percent}%</span>
                </div>
                <ProgressBar percent={c.percent} />
                <div className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-text-muted">
                  <span>
                    {c.topicsStudied}/{c.topicsTotal} topics
                  </span>
                  <span>·</span>
                  <span>
                    {c.itemCount || c.lectureCount} items ({c.lectureCount} lectures{c.studyUnitCount ? `, ${c.studyUnitCount} units` : ''})
                  </span>
                  {formatExamShort(c.daysUntilExam) && (
                    <>
                      <span>·</span>
                      <span>{formatExamShort(c.daysUntilExam)}</span>
                    </>
                  )}
                  {c.studyMeta?.ects != null && (
                    <>
                      <span>·</span>
                      <span>{c.studyMeta.ects} ECTS</span>
                    </>
                  )}
                  <span>·</span>
                  <span>{c.difficultyLabel || `D${c.studyMeta?.personalDifficulty}`}</span>
                  {practiceRow && (
                    <>
                      <span>·</span>
                      <span className="text-violet-300/90">
                        {practiceRow.attempts_count || 0} exercises
                        {practiceRow.cd_total > 0
                          ? ` · ${practiceRow.cd_studied}/${practiceRow.cd_total} practiced`
                          : ''}
                      </span>
                    </>
                  )}
                </div>
                {c.statusLine && (
                  <p className="text-[10px] text-text-muted mt-1.5 line-clamp-2">{c.statusLine}</p>
                )}
                {c.nextStep ? (
                  <p className="text-xs text-accent/90 mt-1.5 truncate">
                    Next: <TitleWithMath text={c.nextStep.lectureTitle} />
                    {c.nextStep.topicTitle ? (
                      <>
                        {' '}
                        → <TitleWithMath text={c.nextStep.topicTitle} />
                      </>
                    ) : null}
                  </p>
                ) : (
                  <p className="text-xs text-text-muted mt-1.5">No next step — course complete</p>
                )}
              </button>
            );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
