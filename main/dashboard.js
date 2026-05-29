const vault = require('./vault');
const coursesApi = require('./courses');
const courseProfile = require('./courseProfile');
const studyState = require('../shared/studyState.cjs');
const { collectAllPinned } = require('./pinsAggregate');

const DIFFICULTY_LABELS = {
  1: 'Easy',
  2: 'Easy',
  3: 'Medium',
  4: 'Hard',
  5: 'Hard'
};

function daysUntilExam(examDate) {
  if (!examDate) return null;
  const end = new Date(`${examDate}T23:59:59`);
  if (Number.isNaN(end.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((end - now) / (24 * 60 * 60 * 1000));
}

function lectureProgress(lecture) {
  const topics = lecture.topics || [];
  const { unitsTotal, unitsStudied, topicsTotal, topicsComplete } = studyState.countLectureUnits(topics);
  const percent = unitsTotal > 0 ? Math.round((unitsStudied / unitsTotal) * 100) : 0;

  const opened = Boolean(lecture.studyState?.opened);
  let status = 'untouched';
  if (topicsTotal === 0) {
    status = opened ? 'started' : 'untouched';
  } else if (topicsComplete >= topicsTotal) {
    status = 'complete';
  } else if (unitsStudied > 0 || opened) {
    status = 'partial';
  }

  const firstUnstudiedTopic =
    topics.find((t) => {
      if (studyState.hasSubtopics(t)) {
        return (t.subtopics || []).some((s) => s.studyState !== 'studied');
      }
      return !studyState.isTopicStudied(t);
    }) || null;

  const firstUnstudiedSub =
    firstUnstudiedTopic && studyState.hasSubtopics(firstUnstudiedTopic)
      ? (firstUnstudiedTopic.subtopics || []).find((s) => s.studyState !== 'studied')
      : null;

  return {
    topicsTotal,
    topicsStudied: topicsComplete,
    unitsTotal,
    unitsStudied,
    percent,
    opened,
    status,
    lastOpenedAt: lecture.studyState?.lastOpenedAt || null,
    firstUnstudiedTopicId: firstUnstudiedTopic?.id || null,
    firstUnstudiedTopicTitle: firstUnstudiedTopic?.title || null,
    firstUnstudiedSubtopicId: firstUnstudiedSub?.id || null,
    firstUnstudiedSubtopicTitle: firstUnstudiedSub?.title || null
  };
}

function toStudyItem(raw) {
  return {
    ...raw,
    studyType: raw.itemType === 'promoted' ? 'study-unit' : 'lecture'
  };
}

function getStudyItemsForCourse(vaultPath, courseStorageKey) {
  const rows = vault.loadCourseLectures(vaultPath, courseStorageKey) || [];
  return rows.map((r) => toStudyItem(r));
}

function coursePriorityScore({ studyMeta, progress, hasPartial }) {
  const days = daysUntilExam(studyMeta.examDate);
  let urgency = 0;
  if (days != null) {
    if (days < 0) urgency = 45;
    else if (days <= 7) urgency = 40;
    else if (days <= 14) urgency = 32;
    else if (days <= 30) urgency = 22;
    else if (days <= 60) urgency = 12;
    else urgency = 6;
  }

  const ects = studyMeta.ects != null ? studyMeta.ects : 0;
  const ectsWeight = Math.min(20, (ects / 12) * 20);

  const diff = studyMeta.personalDifficulty || 3;
  const difficultyWeight = ((diff - 1) / 4) * 18;

  const progressGap = progress.unitsTotal > 0 ? 1 - progress.unitsStudied / progress.unitsTotal : 1;
  const behindWeight = progressGap * 28;

  const startedWeight = hasPartial ? 12 : 0;

  const score = urgency + ectsWeight + difficultyWeight + behindWeight + startedWeight;
  const reasons = [];
  if (urgency >= 22) reasons.push(days <= 7 ? 'Exam very soon' : 'Exam approaching');
  if (ectsWeight >= 10) reasons.push('Higher ECTS');
  if (difficultyWeight >= 12) reasons.push('Harder for you');
  if (behindWeight >= 14) reasons.push('Low progress');
  if (startedWeight) reasons.push('Work in progress');

  return { score, reasons: reasons.slice(0, 3) };
}

function buildNextTarget(lec, topic, reason) {
  let subId = null;
  let subTitle = null;
  if (topic && studyState.hasSubtopics(topic)) {
    const sub = (topic.subtopics || []).find((s) => s.studyState !== 'studied');
    subId = sub?.id || null;
    subTitle = sub?.title || null;
  }
  return {
    lectureId: lec.id,
    lectureTitle: lec.title,
    itemType: lec.studyType || (lec.itemType === 'promoted' ? 'study-unit' : 'lecture'),
    topicId: topic?.id || null,
    topicTitle: topic?.title || null,
    subtopicId: subId,
    subtopicTitle: subTitle,
    reason
  };
}

/** One next item/topic for a single course (lectures + promoted units). */
function pickCourseNextStep(studyItems) {
  if (!studyItems.length) {
    return { next: null, statusLine: 'No study items yet' };
  }

  const incomplete = studyItems.filter((l) => l.progress.status !== 'complete');
  if (!incomplete.length) {
    return { next: null, statusLine: 'All lectures complete' };
  }

  const partial = incomplete
    .filter((l) => l.progress.status === 'partial')
    .sort((a, b) => {
      const ta = a.progress.lastOpenedAt ? new Date(a.progress.lastOpenedAt).getTime() : 0;
      const tb = b.progress.lastOpenedAt ? new Date(b.progress.lastOpenedAt).getTime() : 0;
      return tb - ta;
    });
  if (partial.length) {
    const lec = partial[0];
    const topic =
      (lec.topics || []).find((t) => !studyState.isTopicStudied(t)) || (lec.topics || [])[0] || null;
    return {
      next: buildNextTarget(lec, topic, 'Continue this lecture'),
      statusLine: `In progress · ${lec.progress.topicsStudied}/${lec.progress.topicsTotal} topics`
    };
  }

  for (const lec of studyItems) {
    if (lec.progress.status !== 'untouched') continue;
    const idx = studyItems.indexOf(lec);
    const prior = studyItems.slice(0, idx);
    const blocked = prior.some((p) => p.progress.status !== 'complete' && p.progress.topicsTotal > 0);
    if (blocked) continue;
    const topic = (lec.topics || [])[0] || null;
    return {
      next: buildNextTarget(
        lec,
        topic,
        idx === 0 ? 'Start first item' : 'Start next item in sequence'
      ),
      statusLine: idx === 0 ? 'Not started' : 'Next in sequence'
    };
  }

  for (const lec of studyItems) {
    if (lec.progress.status === 'untouched') {
      const topic = (lec.topics || [])[0] || null;
      return {
        next: buildNextTarget(lec, topic, 'Start untouched lecture'),
        statusLine: 'Not opened yet'
      };
    }
  }

  const lec = incomplete[0];
  const topic =
    (lec.topics || []).find((t) => !studyState.isTopicStudied(t)) || (lec.topics || [])[0] || null;
  const almostDone = incomplete.length === 1 && lec.progress.topicsTotal > 0;
  return {
    next: buildNextTarget(lec, topic, almostDone ? 'Finish this lecture' : 'Continue studying'),
    statusLine: almostDone ? 'Almost done' : `${lec.progress.topicsStudied}/${lec.progress.topicsTotal} topics left`
  };
}

function buildCourseStatusLine({ percent, days, priorityReasons, courseStepStatus }) {
  const parts = [];
  if (courseStepStatus) parts.push(courseStepStatus);
  if (days != null && days <= 14 && days >= 0) parts.push(days <= 7 ? 'Exam very soon' : 'Exam approaching');
  else if (days != null && days < 0) parts.push('Exam passed');
  if (percent < 25 && percent > 0) parts.push('Low progress');
  if (percent === 0 && courseStepStatus === 'Not started') parts.push('Untouched');
  if (percent >= 85 && percent < 100) parts.push('Nearly complete');
  for (const r of priorityReasons || []) {
    if (!parts.includes(r)) parts.push(r);
  }
  return parts.slice(0, 3).join(' · ') || 'On track';
}

function pickGlobalTopPick(courseCards) {
  const sorted = [...courseCards].sort((a, b) => b.priorityScore - a.priorityScore);
  for (const card of sorted) {
    if (!card.nextStep) continue;
    return {
      courseId: card.id,
      courseName: card.name,
      courseEmoji: card.emoji,
      ...card.nextStep
    };
  }
  return null;
}

function buildDashboardOverview(store) {
  const vaultPath = store.get('vaultPath');
  const courses = coursesApi.listOrderedCourses(store);
  const courseCards = [];

  for (const course of courses) {
    const lectures = getStudyItemsForCourse(vaultPath, course.storageKey);
    const studyMeta = courseProfile.loadStudyMeta(vaultPath, course.storageKey);
    const days = daysUntilExam(studyMeta.examDate);

    let unitsTotal = 0;
    let unitsStudied = 0;
    let topicsTotal = 0;
    let topicsStudied = 0;
    let lectureCount = 0;
    let studyUnitCount = 0;
    let hasPartial = false;

    const enriched = lectures.map((lec) => {
      const progress = lectureProgress(lec);
      unitsTotal += progress.unitsTotal;
      unitsStudied += progress.unitsStudied;
      topicsTotal += progress.topicsTotal;
      topicsStudied += progress.topicsStudied;
      if (lec.itemType !== 'promoted') lectureCount += 1;
      else studyUnitCount += 1;
      if (progress.status === 'partial') hasPartial = true;
      return { ...lec, progress };
    });

    const { next: nextStep, statusLine: stepStatus } = pickCourseNextStep(enriched);

    const percent = unitsTotal > 0 ? Math.round((unitsStudied / unitsTotal) * 100) : 0;
    const priority = coursePriorityScore({
      studyMeta,
      progress: { unitsTotal, unitsStudied },
      hasPartial
    });

    const statusLine = buildCourseStatusLine({
      percent,
      days,
      priorityReasons: priority.reasons,
      courseStepStatus: stepStatus
    });

    courseCards.push({
      id: course.id,
      name: course.name,
      emoji: course.emoji,
      color: course.color,
      studyMeta,
      daysUntilExam: days,
      difficultyLabel: DIFFICULTY_LABELS[studyMeta.personalDifficulty] || 'Medium',
      lectureCount,
      studyUnitCount,
      itemCount: lectureCount + studyUnitCount,
      topicsTotal,
      topicsStudied,
      percent,
      priorityScore: priority.score,
      nextStep,
      statusLine
    });
  }

  courseCards.sort((a, b) => b.priorityScore - a.priorityScore);

  const topPick = pickGlobalTopPick(courseCards);
  const pinnedItems = collectAllPinned(store);

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    courseCards,
    topPick,
    pinnedItems
  };
}

module.exports = {
  buildDashboardOverview,
  daysUntilExam,
  lectureProgress,
  pickCourseNextStep,
  getStudyItemsForCourse,
  DIFFICULTY_LABELS
};
