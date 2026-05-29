const fs = require('fs');
const path = require('path');
const vault = require('./vault');
const courseProfile = require('./courseProfile');

function getCourses(store) {
  return store.get('courses') || [];
}

function getCourseOrder(store) {
  const order = store.get('courseOrder');
  return Array.isArray(order) ? order : [];
}

function sortCoursesByOrder(courses, order) {
  const map = new Map(courses.map((c) => [c.id, c]));
  const sorted = [];
  for (const id of order) {
    if (map.has(id)) sorted.push(map.get(id));
  }
  for (const c of courses) {
    if (!order.includes(c.id)) sorted.push(c);
  }
  return sorted;
}

function persistCourses(store, courses, order) {
  const nextOrder = order || courses.map((c) => c.id);
  store.set('courseOrder', nextOrder);
  store.set('courses', courses);
  return courses;
}

function migrateCourses(store) {
  const vaultPath = store.get('vaultPath');
  const courses = getCourses(store);
  const usedKeys = new Set();
  let changed = false;

  for (const course of courses) {
    if (!course.storageKey) {
      let key = vault.sanitizeName(course.name) || `course_${course.id}`;
      while (usedKeys.has(key)) key = `${key}_${usedKeys.size}`;
      course.storageKey = key;
      changed = true;
    }
    usedKeys.add(course.storageKey);

    const dir = vault.courseDir(vaultPath, course.storageKey);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (_) {}
    }
  }

  if (changed) store.set('courses', courses);
  return courses;
}

function makeUniqueStorageKey(vaultPath, displayName) {
  let key = vault.sanitizeName(displayName) || 'course';
  const base = key;
  let n = 1;
  while (fs.existsSync(vault.courseDir(vaultPath, key))) {
    key = `${base}_${n++}`;
  }
  return key;
}

function getCourseById(store, courseId) {
  migrateCourses(store);
  return getCourses(store).find((c) => c.id === courseId) || null;
}

function resolveCourse(store, ref) {
  migrateCourses(store);
  const courses = getCourses(store);
  if (!ref) return null;
  if (typeof ref === 'object' && ref.id) {
    return courses.find((c) => c.id === ref.id) || ref;
  }
  if (typeof ref === 'object' && ref.storageKey) {
    return courses.find((c) => c.storageKey === ref.storageKey) || ref;
  }
  const byId = courses.find((c) => c.id === ref);
  if (byId) return byId;
  const byKey = courses.find((c) => c.storageKey === ref);
  if (byKey) return byKey;
  return courses.find((c) => c.name === ref) || null;
}

function listOrderedCourses(store) {
  migrateCourses(store);
  const courses = getCourses(store);
  const order = getCourseOrder(store);
  if (!order.length && courses.length) {
    const initial = courses.map((c) => c.id);
    return sortCoursesByOrder(persistCourses(store, courses, initial), initial);
  }
  return sortCoursesByOrder(courses, order);
}

function reorderCourses(store, courseIds) {
  const courses = getCourses(store);
  const map = new Map(courses.map((c) => [c.id, c]));
  const validIds = courseIds.filter((id) => map.has(id));
  for (const c of courses) {
    if (!validIds.includes(c.id)) validIds.push(c.id);
  }
  const sorted = validIds.map((id) => map.get(id));
  return persistCourses(store, sorted, validIds);
}

function createCourse(store, { name, color, emoji }) {
  migrateCourses(store);
  const courses = getCourses(store);
  const vaultPath = store.get('vaultPath');
  const displayName = name.trim();
  const storageKey = makeUniqueStorageKey(vaultPath, displayName);

  const course = {
    id: String(Date.now()),
    name: displayName,
    storageKey,
    color: color || '#6366f1',
    emoji: emoji || '📚'
  };
  courses.push(course);
  const order = [...getCourseOrder(store), course.id];
  const dir = vault.courseDir(vaultPath, storageKey);
  fs.mkdirSync(dir, { recursive: true });
  courseProfile.saveProfile(vaultPath, storageKey, courseProfile.DEFAULT_PROFILE);
  return persistCourses(store, sortCoursesByOrder(courses, order), order).find((c) => c.id === course.id);
}

function updateCourse(store, courseId, { name, emoji, color }) {
  migrateCourses(store);
  const courses = getCourses(store);
  const course = courses.find((c) => c.id === courseId);
  if (!course) return { success: false, error: 'Course not found' };

  if (name != null && String(name).trim()) {
    course.name = String(name).trim();
  }
  if (emoji != null) course.emoji = emoji;
  if (color != null) course.color = color;

  store.set('courses', courses);
  const order = getCourseOrder(store);
  return {
    success: true,
    course,
    courses: sortCoursesByOrder(courses, order)
  };
}

function getCourseSettings(store, courseId) {
  const course = getCourseById(store, courseId);
  if (!course) return { success: false, error: 'Course not found' };
  const vaultPath = store.get('vaultPath');
  const aiProfile = courseProfile.loadProfile(vaultPath, course.storageKey);
  const studyMeta = courseProfile.loadStudyMeta(vaultPath, course.storageKey);
  return { success: true, course, aiProfile, studyMeta };
}

function saveCourseSettings(store, { courseId, name, aiProfile, studyMeta }) {
  const course = getCourseById(store, courseId);
  if (!course) return { success: false, error: 'Course not found' };

  const vaultPath = store.get('vaultPath');
  if (name != null && String(name).trim()) {
    course.name = String(name).trim();
    const courses = getCourses(store);
    const idx = courses.findIndex((c) => c.id === courseId);
    if (idx >= 0) courses[idx] = course;
    store.set('courses', courses);
  }

  const saved = courseProfile.saveCourseSettingsBundle(vaultPath, course.storageKey, {
    aiProfile: aiProfile || undefined,
    studyMeta: studyMeta != null ? studyMeta : undefined
  });
  const order = getCourseOrder(store);
  return {
    success: true,
    course,
    aiProfile: saved.aiProfile,
    studyMeta: saved.studyMeta,
    courses: sortCoursesByOrder(getCourses(store), order)
  };
}

function deleteCourse(store, courseId, { deleteFromDisk = false } = {}) {
  migrateCourses(store);
  const courses = getCourses(store);
  const course = courses.find((c) => c.id === courseId);
  if (!course) return { success: false, error: 'Course not found' };

  const vaultPath = store.get('vaultPath');
  const folderPath = vault.courseDir(vaultPath, course.storageKey);
  let diskWarning = null;

  if (deleteFromDisk) {
    if (fs.existsSync(folderPath)) {
      try {
        fs.rmSync(folderPath, { recursive: true, force: true });
      } catch (err) {
        return {
          success: false,
          error: `Could not delete folder on disk: ${err.message}`,
          folderPath
        };
      }
    } else {
      diskWarning = 'Course folder was not found on disk; removed from app only.';
    }
  }

  const remaining = courses.filter((c) => c.id !== courseId);
  const order = getCourseOrder(store).filter((id) => id !== courseId);
  persistCourses(store, sortCoursesByOrder(remaining, order), order);

  return {
    success: true,
    deletedCourseId: courseId,
    deleteFromDisk,
    folderPath,
    diskWarning
  };
}

module.exports = {
  listOrderedCourses,
  reorderCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  getCourseById,
  resolveCourse,
  getCourseSettings,
  saveCourseSettings,
  migrateCourses,
  sortCoursesByOrder
};
