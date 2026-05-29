const fs = require('fs');
const path = require('path');
const studyState = require('../shared/studyState.cjs');
const { applySubtopicExerciseLinks } = require('../shared/subtopicExerciseLink.cjs');
const lectureNormalize = require('./lectureNormalize');

const LECTURE_FILE = 'lecture.json';
const STUDY_UNIT_FILE = 'study_unit.json';
const ORDER_FILE = 'lecture_order.json';

function sanitizeName(name) {
  return name.replace(/[^a-zA-Z0-9\u00C0-\u024F\s_-]/g, '').trim().replace(/\s+/g, '_');
}

function courseDir(vaultPath, courseName) {
  return path.join(vaultPath, sanitizeName(courseName));
}

function safeReadJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function readLectureOrder(courseDirPath) {
  const data = safeReadJson(path.join(courseDirPath, ORDER_FILE), { lectureIds: [] }) || {
    lectureIds: []
  };
  return Array.isArray(data.lectureIds) ? data.lectureIds : [];
}

function writeLectureOrder(courseDirPath, lectureIds) {
  writeJson(path.join(courseDirPath, ORDER_FILE), {
    lectureIds,
    updatedAt: new Date().toISOString()
  });
}

function syncLectureOrder(courseDirPath, newId) {
  if (!fs.existsSync(courseDirPath)) fs.mkdirSync(courseDirPath, { recursive: true });
  const order = readLectureOrder(courseDirPath);
  if (!order.includes(newId)) order.push(newId);
  writeLectureOrder(courseDirPath, order);
  return order;
}

function isActiveItemDir(itemPath) {
  const lecturePath = path.join(itemPath, LECTURE_FILE);
  const unitPath = path.join(itemPath, STUDY_UNIT_FILE);
  if (fs.existsSync(lecturePath)) return true;
  if (fs.existsSync(unitPath)) return true;
  return false;
}

function readLecture(lecturePath) {
  const lecture = safeReadJson(path.join(lecturePath, LECTURE_FILE), null);
  if (lecture) exerciseSheets.normalizeLectureExercises(lecture);
  return lecture;
}

function writeLecture(lecturePath, lecture) {
  if (lecture) {
    exerciseSheets.normalizeLectureExercises(lecture);
    exerciseSheets.syncLegacyExerciseMirror(lecture);
  }
  writeJson(path.join(lecturePath, LECTURE_FILE), lecture);
  return lecture;
}

function dedupeSubtopicIds(topic, makeId) {
  const subs = topic.subtopics || [];
  const seen = new Set();
  let changed = false;
  for (let si = 0; si < subs.length; si += 1) {
    const sub = subs[si];
    if (!sub || typeof sub !== 'object') continue;
    let id = sub.id || makeId(`${topic.id}-s`, sub.title || 'sub', si);
    if (seen.has(id)) {
      id = `${id}-${si}`.slice(0, 48);
      changed = true;
    }
    seen.add(id);
    if (sub.id !== id) {
      sub.id = id;
      changed = true;
    }
  }
  return changed;
}

/** Ensure topic/subtopic ids exist before study mutations (no reconcile side effects). */
function ensureStudyIds(item) {
  if (!item?.topics) return false;
  let changed = false;
  const { makeId } = lectureNormalize;
  for (const [ti, topic] of item.topics.entries()) {
    if (!topic.id) {
      topic.id = makeId('t', topic.title, ti);
      changed = true;
    }
    const subs = topic.subtopics || [];
    for (let si = 0; si < subs.length; si += 1) {
      const raw = subs[si];
      if (typeof raw === 'string') {
        subs[si] = {
          id: makeId(`${topic.id}-s`, raw, si),
          title: raw,
          studyState: 'new'
        };
        changed = true;
        continue;
      }
      if (!raw?.id) {
        raw.id = makeId(`${topic.id}-s`, raw.title || 'sub', si);
        changed = true;
      }
      if (raw && !raw.studyState) {
        raw.studyState = 'new';
        changed = true;
      }
    }
    if (dedupeSubtopicIds(topic, makeId)) changed = true;
  }
  return changed;
}

function readRawCourseItem(itemPath) {
  const unit = readStudyUnit(itemPath);
  if (unit) return unit;
  return readLecture(itemPath);
}

const exerciseSheets = require('../shared/exerciseSheets.cjs');

function ensureExerciseStudyIds(item) {
  exerciseSheets.normalizeLectureExercises(item);
  const sheets = item?.exercises || [];
  if (!sheets.length) return false;
  let changed = false;
  const { makeId } = lectureNormalize;
  for (const sheet of sheets) {
    if (!sheet.topics?.length) continue;
    for (const [ti, topic] of sheet.topics.entries()) {
      if (!topic.id) {
        topic.id = makeId('ex', topic.title, ti);
        changed = true;
      }
      if (!topic.studyState) {
        topic.studyState = 'new';
        changed = true;
      }
      const subs = topic.subtopics || [];
      for (let si = 0; si < subs.length; si += 1) {
        const raw = subs[si];
        if (typeof raw === 'string') {
          subs[si] = {
            id: makeId(`${topic.id}-s`, raw, si),
            title: raw,
            studyState: 'new'
          };
          changed = true;
          continue;
        }
        if (!raw.id) {
          raw.id = makeId(`${topic.id}-s`, raw.title || 'sub', si);
          changed = true;
        }
        if (!raw.studyState) {
          raw.studyState = 'new';
          changed = true;
        }
      }
      if (dedupeSubtopicIds(topic, makeId)) changed = true;
    }
  }
  exerciseSheets.syncLegacyExerciseMirror(item);
  return changed;
}

/** Read lecture or promoted study unit for study-state writes (not lecture.json only). */
function readItemForMutation(itemPath) {
  const item = readRawCourseItem(itemPath);
  if (!item) return null;
  let dirty = false;
  if (ensureStudyIds(item)) dirty = true;
  if (ensureExerciseStudyIds(item)) dirty = true;
  if (dirty) writeCourseItem(itemPath, item);
  return item;
}

function findExerciseSubtopic(item, topicId, subtopicId, exerciseId = '') {
  const { topic } = exerciseSheets.findExerciseTopicInLecture(item, topicId, exerciseId);
  if (!topic) return { topic: null, sub: null };
  const sub = (topic.subtopics || []).find((s) => s && s.id === subtopicId);
  return { topic, sub };
}

function findLectureSubtopic(item, topicId, subtopicId) {
  const topic = item.topics?.find((t) => t.id === topicId);
  if (!topic) return { topic: null, sub: null };
  const subs = (topic.subtopics || []).filter((s) => s && typeof s === 'object');
  let sub = subs.find((s) => s.id === subtopicId);
  if (!sub && subtopicId) {
    sub = subs.find((s) => String(s.id || '').startsWith(`${subtopicId}-`));
  }
  return { topic, sub: sub || null };
}

function readStudyUnit(itemPath) {
  return safeReadJson(path.join(itemPath, STUDY_UNIT_FILE), null);
}

function writeStudyUnit(itemPath, unit) {
  writeJson(path.join(itemPath, STUDY_UNIT_FILE), unit);
  return unit;
}

function reconcileLectureStudyState(item) {
  if (!item?.topics) return false;
  let changed = false;
  for (const t of item.topics) {
    if (!studyState.hasSubtopics(t)) continue;
    const before = t.studyState;
    studyState.syncTopicFromSubtopics(t);
    if (before !== t.studyState) changed = true;
  }
  if (changed) syncTopicStudiedCounts(item, 'lecture');
  return changed;
}

function reconcileSubtopicExerciseLinks(item) {
  exerciseSheets.normalizeLectureExercises(item);
  const hasExercise = exerciseSheets.hasAnyExerciseMaterial(item);
  if (!hasExercise || !item?.topics?.length) return false;
  const { changed } = applySubtopicExerciseLinks(item);
  return changed;
}

function readCourseItem(itemPath) {
  const unit = readStudyUnit(itemPath);
  if (unit) {
    let dirty = false;
    if (reconcileLectureStudyState(unit)) dirty = true;
    if (reconcileSubtopicExerciseLinks(unit)) dirty = true;
    if (dirty) writeStudyUnit(itemPath, unit);
    return {
      ...unit,
      itemType: 'promoted',
      type: unit.type || 'promoted'
    };
  }
  const lecture = readLecture(itemPath);
  if (lecture) {
    let dirty = false;
    if (reconcileLectureStudyState(lecture)) dirty = true;
    if (reconcileSubtopicExerciseLinks(lecture)) dirty = true;
    if (dirty) writeLecture(itemPath, lecture);
    return {
      ...lecture,
      itemType: 'lecture',
      type: lecture.type || 'lecture'
    };
  }
  return null;
}

function writeCourseItem(itemPath, data) {
  if (data.type === 'promoted' || data.itemType === 'promoted') {
    return writeStudyUnit(itemPath, data);
  }
  return writeLecture(itemPath, data);
}

function listItemFolders(courseDirPath) {
  if (!fs.existsSync(courseDirPath)) return [];
  return fs.readdirSync(courseDirPath).filter((f) => {
    try {
      const full = path.join(courseDirPath, f);
      return fs.statSync(full).isDirectory() && isActiveItemDir(full);
    } catch {
      return false;
    }
  });
}

function sortByOrder(items, order) {
  if (!order?.length) return items;
  const rank = new Map(order.map((id, i) => [id, i]));
  return [...items].sort((a, b) => {
    const ra = rank.has(a.id) ? rank.get(a.id) : 9999;
    const rb = rank.has(b.id) ? rank.get(b.id) : 9999;
    return ra - rb;
  });
}

function enrichItem(item, itemPath) {
  exerciseSheets.normalizeLectureExercises(item);
  const topics = item.topics || [];
  const sheets = item.exercises || [];
  const exerciseTopics = sheets.flatMap((s) => s.topics || []);
  const lectureUnits = studyState.countLectureUnits(topics);
  return {
    ...item,
    path: itemPath,
    topicCount: topics.length,
    studiedCount: lectureUnits.topicsComplete,
    hasExercise: exerciseSheets.hasAnyExerciseMaterial(item),
    exerciseSheetCount: sheets.length,
    exerciseTopicCount: exerciseTopics.length,
    exerciseStudiedCount: exerciseTopics.filter((t) => studyState.isTopicStudied(t)).length
  };
}

function loadCourseLectures(vaultPath, courseName) {
  const dir = courseDir(vaultPath, courseName);
  const order = readLectureOrder(dir);
  const folders = listItemFolders(dir);
  const rows = folders
    .map((id) => {
      const itemPath = path.join(dir, id);
      const item = readCourseItem(itemPath);
      if (!item) return null;
      return enrichItem(item, itemPath);
    })
    .filter(Boolean);
  return sortByOrder(rows, order).map((item, index) => ({
    ...item,
    order: index + 1
  }));
}

function reorderLectures(vaultPath, courseName, lectureIds) {
  const dir = courseDir(vaultPath, courseName);
  if (!fs.existsSync(dir)) return [];
  const folders = listItemFolders(dir);
  const valid = lectureIds.filter((id) => folders.includes(id));
  for (const id of folders) {
    if (!valid.includes(id)) valid.push(id);
  }
  writeLectureOrder(dir, valid);
  valid.forEach((id, index) => {
    const itemPath = path.join(dir, id);
    const item = readCourseItem(itemPath);
    if (item) {
      item.order = index + 1;
      writeCourseItem(itemPath, item);
    }
  });
  return loadCourseLectures(vaultPath, courseName);
}

function hideCourseItem(itemPath) {
  const unitActive = path.join(itemPath, STUDY_UNIT_FILE);
  const unitHidden = path.join(itemPath, `${STUDY_UNIT_FILE}.removed`);
  const lectureActive = path.join(itemPath, LECTURE_FILE);
  const lectureHidden = path.join(itemPath, `${LECTURE_FILE}.removed`);

  if (fs.existsSync(unitActive)) {
    fs.renameSync(unitActive, unitHidden);
  } else if (fs.existsSync(lectureActive)) {
    fs.renameSync(lectureActive, lectureHidden);
  }
}

function deleteLecture(vaultPath, courseName, lectureId, { deleteFromDisk = false } = {}) {
  const dir = courseDir(vaultPath, courseName);
  const itemPath = path.join(dir, lectureId);
  if (!fs.existsSync(itemPath)) {
    return { success: false, error: 'Item folder not found' };
  }

  const item = readCourseItem(itemPath);
  const title = item?.title || lectureId;
  const isPromoted = item?.itemType === 'promoted';

  if (deleteFromDisk) {
    try {
      fs.rmSync(itemPath, { recursive: true, force: true });
    } catch (err) {
      return {
        success: false,
        error: `Could not delete folder: ${err.message}`,
        lecturePath: itemPath
      };
    }
  } else {
    hideCourseItem(itemPath);
  }

  if (isPromoted && item?.source?.lecturePath && item?.source?.topicId) {
    const src = readCourseItem(item.source.lecturePath);
    if (src?.topics) {
      const topic = src.topics.find((t) => t.id === item.source.topicId);
      if (topic) {
        delete topic.promotedToUnitId;
        delete topic.promotedAt;
        delete topic.promotedProvenance;
        writeCourseItem(item.source.lecturePath, src);
      }
    }
  }

  const order = readLectureOrder(dir).filter((id) => id !== lectureId);
  writeLectureOrder(dir, order);

  const remaining = loadCourseLectures(vaultPath, courseName);
  return {
    success: true,
    deletedLectureId: lectureId,
    deleteFromDisk,
    lecturePath: itemPath,
    title,
    lectures: remaining
  };
}

function courseStats(items) {
  const lectures = items.filter((i) => i.itemType !== 'promoted');
  const promoted = items.filter((i) => i.itemType === 'promoted');
  const total = items.length;
  const opened = items.filter((l) => l.studyState?.opened).length;
  const topicsTotal = items.reduce((s, l) => s + (l.topicCount || 0), 0);
  const topicsStudied = items.reduce((s, l) => s + (l.studiedCount || 0), 0);
  return {
    total,
    lectureCount: lectures.length,
    promotedCount: promoted.length,
    opened,
    topicsTotal,
    topicsStudied
  };
}

function markLectureOpened(itemPath) {
  const item = readCourseItem(itemPath);
  if (!item) return null;
  item.studyState = item.studyState || {};
  item.studyState.opened = true;
  item.studyState.lastOpenedAt = new Date().toISOString();
  return writeCourseItem(itemPath, item);
}

function toggleItemPinned(itemPath) {
  const item = readCourseItem(itemPath);
  if (!item) return null;
  const next = !Boolean(item.pinned);
  item.pinned = next;
  if (next) item.pinnedAt = new Date().toISOString();
  else delete item.pinnedAt;
  writeCourseItem(itemPath, item);
  return item;
}

function toggleTopicPinned(itemPath, topicId, materialMode = 'lecture', exerciseId = '') {
  const item = readCourseItem(itemPath);
  if (!item || !topicId) return null;

  if (materialMode === 'exercise') {
    const { topic } = exerciseSheets.findExerciseTopicInLecture(item, topicId, exerciseId);
    if (!topic) return null;
    const next = !Boolean(topic.pinned);
    topic.pinned = next;
    if (next) topic.pinnedAt = new Date().toISOString();
    else delete topic.pinnedAt;
    writeCourseItem(itemPath, item);
    return item;
  }

  const topic = (item.topics || []).find((t) => t.id === topicId);
  if (!topic) return null;
  const next = !Boolean(topic.pinned);
  topic.pinned = next;
  if (next) topic.pinnedAt = new Date().toISOString();
  else delete topic.pinnedAt;
  writeCourseItem(itemPath, item);
  return item;
}

function toggleSubtopicPinned(itemPath, topicId, subtopicId, materialMode = 'lecture', exerciseId = '') {
  const item = readCourseItem(itemPath);
  if (!item || !topicId || !subtopicId) return null;

  if (materialMode === 'exercise') {
    const { topic, sub } = findExerciseSubtopic(item, topicId, subtopicId, exerciseId);
    if (!topic || !sub) return null;
    const next = !Boolean(sub.pinned);
    sub.pinned = next;
    if (next) sub.pinnedAt = new Date().toISOString();
    else delete sub.pinnedAt;
    writeCourseItem(itemPath, item);
    return item;
  }

  const { topic, sub } = findLectureSubtopic(item, topicId, subtopicId);
  if (!topic || !sub) return null;
  const next = !Boolean(sub.pinned);
  sub.pinned = next;
  if (next) sub.pinnedAt = new Date().toISOString();
  else delete sub.pinnedAt;
  writeCourseItem(itemPath, item);
  return item;
}

function pushTopicPins(pins, { itemPath, itemTitle, topics, materialMode, exerciseId = '', sheetLabel = '' }) {
  const prefix = sheetLabel ? `${itemTitle} · ${sheetLabel}` : itemTitle;
  for (const topic of topics || []) {
    if (topic?.pinned) {
      pins.push({
        type: 'topic',
        id: topic.id,
        title: topic.title,
        lecturePath: itemPath,
        topicId: topic.id,
        materialMode,
        exerciseId: materialMode === 'exercise' ? exerciseId : '',
        breadcrumb: prefix,
        pinnedAt: topic.pinnedAt || null
      });
    }
    for (const sub of topic?.subtopics || []) {
      if (!sub?.pinned) continue;
      pins.push({
        type: 'subtopic',
        id: sub.id,
        title: sub.title,
        lecturePath: itemPath,
        topicId: topic.id,
        subtopicId: sub.id,
        materialMode,
        exerciseId: materialMode === 'exercise' ? exerciseId : '',
        breadcrumb: `${prefix} / ${topic.title}`,
        pinnedAt: sub.pinnedAt || null
      });
    }
  }
}

function listPinnedInItem(itemPath) {
  const item = readCourseItem(itemPath);
  if (!item) return [];
  const pins = [];
  if (item.pinned) {
    pins.push({
      type: item.itemType === 'promoted' ? 'study-unit' : 'lecture',
      id: item.id,
      title: item.title,
      lecturePath: itemPath,
      pinnedAt: item.pinnedAt || null
    });
  }
  pushTopicPins(pins, {
    itemPath,
    itemTitle: item.title,
    topics: item.topics,
    materialMode: 'lecture'
  });
  for (const sheet of item.exercises || []) {
    if (!(sheet.topics?.length)) continue;
    pushTopicPins(pins, {
      itemPath,
      itemTitle: item.title,
      topics: sheet.topics,
      materialMode: 'exercise',
      exerciseId: sheet.id || '',
      sheetLabel: sheet.label || ''
    });
  }
  return pins.sort((a, b) => new Date(b.pinnedAt || 0) - new Date(a.pinnedAt || 0));
}

function syncTopicStudiedCounts(item, materialMode = 'lecture') {
  if (materialMode === 'exercise') {
    exerciseSheets.normalizeLectureExercises(item);
    for (const sheet of item.exercises || []) {
      sheet.studyState = sheet.studyState || {};
      sheet.studyState.topicsStudied = (sheet.topics || []).filter((t) =>
        studyState.isTopicStudied(t)
      ).length;
    }
    exerciseSheets.syncLegacyExerciseMirror(item);
    return;
  }
  for (const t of item.topics || []) {
    if (studyState.hasSubtopics(t)) studyState.syncTopicFromSubtopics(t);
  }
  item.studyState = item.studyState || {};
  item.studyState.topicsStudied = (item.topics || []).filter((t) =>
    studyState.isTopicStudied(t)
  ).length;
}

function toggleTopicStudied(itemPath, topicId, materialMode = 'lecture', exerciseId = '') {
  if (!itemPath || !topicId) return null;
  const item = readItemForMutation(itemPath);
  if (!item) return null;

  if (materialMode === 'exercise') {
    const { topic } = exerciseSheets.findExerciseTopicInLecture(item, topicId, exerciseId);
    if (!topic) return null;
    if (studyState.hasSubtopics(topic)) return null;
    const studied = topic.studyState === 'studied';
    topic.studyState = studied ? 'new' : 'studied';
    if (topic.studyState === 'studied') topic.lastStudiedAt = new Date().toISOString();
    else delete topic.lastStudiedAt;
    syncTopicStudiedCounts(item, materialMode);
    writeCourseItem(itemPath, item);
    return item;
  }

  const topic = item.topics?.find((t) => t.id === topicId);
  if (!topic) return null;
  if (studyState.hasSubtopics(topic)) return null;
  const studied = topic.studyState === 'studied';
  topic.studyState = studied ? 'new' : 'studied';
  if (topic.studyState === 'studied') topic.lastStudiedAt = new Date().toISOString();
  else delete topic.lastStudiedAt;
  syncTopicStudiedCounts(item, materialMode);
  writeCourseItem(itemPath, item);
  return item;
}

function toggleSubtopicStudied(itemPath, topicId, subtopicId, materialMode = 'lecture', exerciseId = '') {
  if (!itemPath || !topicId || !subtopicId) return null;

  const item = readItemForMutation(itemPath);
  if (!item) return null;

  if (materialMode === 'exercise') {
    const { topic, sub } = findExerciseSubtopic(item, topicId, subtopicId, exerciseId);
    if (!topic || !sub) return null;

    const studied = studyState.isSubtopicStudied(sub);
    sub.studyState = studied ? 'new' : 'studied';
    if (studyState.isSubtopicStudied(sub)) {
      sub.lastStudiedAt = new Date().toISOString();
    } else {
      delete sub.lastStudiedAt;
    }

    studyState.syncTopicFromSubtopics(topic);
    syncTopicStudiedCounts(item, 'exercise');
    writeCourseItem(itemPath, item);
    return item;
  }

  const { topic, sub } = findLectureSubtopic(item, topicId, subtopicId);
  if (!topic || !sub) return null;

  const studied = studyState.isSubtopicStudied(sub);
  sub.studyState = studied ? 'new' : 'studied';
  if (studyState.isSubtopicStudied(sub)) {
    sub.lastStudiedAt = new Date().toISOString();
  } else {
    delete sub.lastStudiedAt;
    delete sub.studyConfidence;
  }

  studyState.syncTopicFromSubtopics(topic);
  syncTopicStudiedCounts(item, materialMode);
  writeCourseItem(itemPath, item);
  return item;
}

function setSubtopicConfidence(itemPath, topicId, subtopicId, confidence) {
  if (!itemPath || !topicId || !subtopicId) return null;

  const item = readItemForMutation(itemPath);
  if (!item) return null;

  const { topic, sub } = findLectureSubtopic(item, topicId, subtopicId);
  if (!topic || !sub || !studyState.isSubtopicStudied(sub)) return null;

  const next = studyState.normalizeConfidence(confidence);
  if (next) sub.studyConfidence = next;
  else delete sub.studyConfidence;

  writeCourseItem(itemPath, item);
  return item;
}

function cycleSubtopicConfidence(itemPath, topicId, subtopicId) {
  if (!itemPath || !topicId || !subtopicId) return null;

  const item = readItemForMutation(itemPath);
  if (!item) return null;

  const { topic, sub } = findLectureSubtopic(item, topicId, subtopicId);
  if (!topic || !sub || !studyState.isSubtopicStudied(sub)) return null;

  const next = studyState.nextConfidence(sub.studyConfidence);
  if (next) sub.studyConfidence = next;
  else delete sub.studyConfidence;

  writeCourseItem(itemPath, item);
  return item;
}

function markTopicStudied(itemPath, topicId, materialMode, exerciseId = '') {
  return toggleTopicStudied(itemPath, topicId, materialMode, exerciseId);
}

function getPromotedUnitPath(vaultPath, courseName, unitId) {
  return path.join(courseDir(vaultPath, courseName), unitId);
}

module.exports = {
  LECTURE_FILE,
  STUDY_UNIT_FILE,
  sanitizeName,
  courseDir,
  readLecture,
  writeLecture,
  readStudyUnit,
  writeStudyUnit,
  readCourseItem,
  writeCourseItem,
  loadCourseLectures,
  courseStats,
  syncLectureOrder,
  readLectureOrder,
  writeLectureOrder,
  sortByOrder,
  enrichItem,
  reorderLectures,
  deleteLecture,
  markLectureOpened,
  markTopicStudied,
  toggleTopicStudied,
  toggleSubtopicStudied,
  setSubtopicConfidence,
  cycleSubtopicConfidence,
  getPromotedUnitPath,
  toggleItemPinned,
  toggleTopicPinned,
  toggleSubtopicPinned,
  listPinnedInItem
};
