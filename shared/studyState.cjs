/** Subtopic completion is source of truth when a topic has subtopics. */

function hasSubtopics(topic) {
  return Array.isArray(topic?.subtopics) && topic.subtopics.length > 0;
}

function isSubtopicStudied(sub) {
  return sub?.studyState === 'studied';
}

function allSubtopicsStudied(topic) {
  const subs = topic?.subtopics || [];
  if (!subs.length) return false;
  return subs.every((s) => isSubtopicStudied(s));
}

function subtopicsProgress(topic) {
  const subs = topic?.subtopics || [];
  const total = subs.length;
  const studied = subs.filter((s) => isSubtopicStudied(s)).length;
  return { total, studied };
}

/** Effective studied flag for UI and progress. */
function isTopicStudied(topic) {
  if (!topic) return false;
  if (hasSubtopics(topic)) return allSubtopicsStudied(topic);
  return topic.studyState === 'studied';
}

/** not_started | in_progress | complete */
function topicStudyStatus(topic) {
  if (!topic) return 'not_started';
  if (!hasSubtopics(topic)) {
    return topic.studyState === 'studied' ? 'complete' : 'not_started';
  }
  const { total, studied } = subtopicsProgress(topic);
  if (studied === 0) return 'not_started';
  if (studied >= total) return 'complete';
  return 'in_progress';
}

/** Sync topic.studyState from subtopics (call after any subtopic toggle). */
function syncTopicFromSubtopics(topic) {
  if (!topic || !hasSubtopics(topic)) return topic;
  const status = topicStudyStatus(topic);
  if (status === 'complete') {
    topic.studyState = 'studied';
    topic.lastStudiedAt = topic.lastStudiedAt || new Date().toISOString();
  } else if (status === 'in_progress') {
    topic.studyState = 'in_progress';
    delete topic.lastStudiedAt;
  } else {
    topic.studyState = 'new';
    delete topic.lastStudiedAt;
  }
  return topic;
}

const VALID_CONFIDENCE = new Set(['low', 'medium', 'high']);

function normalizeConfidence(value) {
  if (value === null || value === undefined || value === '') return null;
  const v = String(value).toLowerCase().trim();
  return VALID_CONFIDENCE.has(v) ? v : null;
}

function nextConfidence(current) {
  const order = ['low', 'medium', 'high'];
  const c = normalizeConfidence(current);
  if (!c) return 'low';
  const idx = order.indexOf(c);
  if (idx < 0) return 'low';
  if (idx >= order.length - 1) return null;
  return order[idx + 1];
}

/** Count progress units without double-counting topic + subtopics. */
function countTopicUnits(topic) {
  if (hasSubtopics(topic)) {
    const { total, studied } = subtopicsProgress(topic);
    return { total, studied, derivedTopicStudied: allSubtopicsStudied(topic) };
  }
  const studied = topic.studyState === 'studied' ? 1 : 0;
  return { total: 1, studied, derivedTopicStudied: studied === 1 };
}

function countLectureUnits(topics) {
  let unitsTotal = 0;
  let unitsStudied = 0;
  let topicsComplete = 0;
  for (const t of topics || []) {
    const { total, studied, derivedTopicStudied } = countTopicUnits(t);
    unitsTotal += total;
    unitsStudied += studied;
    if (derivedTopicStudied) topicsComplete += 1;
  }
  return { unitsTotal, unitsStudied, topicsTotal: (topics || []).length, topicsComplete };
}

module.exports = {
  hasSubtopics,
  isSubtopicStudied,
  allSubtopicsStudied,
  subtopicsProgress,
  isTopicStudied,
  topicStudyStatus,
  syncTopicFromSubtopics,
  normalizeConfidence,
  nextConfidence,
  countTopicUnits,
  countLectureUnits
};
