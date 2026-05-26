const fs = require('fs');
const path = require('path');

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
  return safeReadJson(path.join(lecturePath, LECTURE_FILE), null);
}

function writeLecture(lecturePath, lecture) {
  writeJson(path.join(lecturePath, LECTURE_FILE), lecture);
  return lecture;
}

function readStudyUnit(itemPath) {
  return safeReadJson(path.join(itemPath, STUDY_UNIT_FILE), null);
}

function writeStudyUnit(itemPath, unit) {
  writeJson(path.join(itemPath, STUDY_UNIT_FILE), unit);
  return unit;
}

function readCourseItem(itemPath) {
  const unit = readStudyUnit(itemPath);
  if (unit) {
    return {
      ...unit,
      itemType: 'promoted',
      type: unit.type || 'promoted'
    };
  }
  const lecture = readLecture(itemPath);
  if (lecture) {
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
  const topics = item.topics || [];
  return {
    ...item,
    path: itemPath,
    topicCount: topics.length,
    studiedCount: topics.filter((t) => t.studyState === 'studied').length
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

function markTopicStudied(itemPath, topicId) {
  const item = readCourseItem(itemPath);
  if (!item) return null;
  const topic = item.topics?.find((t) => t.id === topicId);
  if (topic) {
    topic.studyState = 'studied';
    topic.lastStudiedAt = new Date().toISOString();
  }
  item.studyState = item.studyState || {};
  item.studyState.topicsStudied = (item.topics || []).filter((t) => t.studyState === 'studied').length;
  return writeCourseItem(itemPath, item);
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
  reorderLectures,
  deleteLecture,
  markLectureOpened,
  markTopicStudied,
  getPromotedUnitPath
};
