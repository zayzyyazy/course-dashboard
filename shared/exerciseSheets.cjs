/**
 * Multiple exercise sheets (Übung 1, Übung 2, …) per lecture.
 * Keeps lecture.exercise as mirror of the first sheet for legacy readers.
 */

function defaultSheetLabel(index) {
  return `Übung ${index + 1}`;
}

function normalizeSheet(sheet, index) {
  if (!sheet || typeof sheet !== 'object') return null;
  const normalized = { ...sheet };
  if (!normalized.id) normalized.id = index === 0 ? 'exsheet_legacy' : `exsheet_${index}`;
  if (!normalized.label) normalized.label = defaultSheetLabel(index);
  if (!normalized.topics) normalized.topics = [];
  if (!normalized.lectureLinks) normalized.lectureLinks = [];
  return normalized;
}

/** Migrate lecture.exercise → lecture.exercises[]; sync legacy mirror. */
function normalizeLectureExercises(lecture) {
  if (!lecture || typeof lecture !== 'object') return lecture;

  if (!Array.isArray(lecture.exercises)) {
    if (lecture.exercise && (lecture.exercise.topics?.length || lecture.exercise.exerciseSummary)) {
      lecture.exercises = [normalizeSheet(lecture.exercise, 0)];
    } else {
      lecture.exercises = [];
    }
  } else {
    lecture.exercises = lecture.exercises
      .map((s, i) => normalizeSheet(s, i))
      .filter(Boolean);
  }

  syncLegacyExerciseMirror(lecture);
  return lecture;
}

function syncLegacyExerciseMirror(lecture) {
  if (!lecture) return;
  if (lecture.exercises?.length) {
    lecture.exercise = lecture.exercises[0];
    lecture.hasExercise = true;
  } else {
    delete lecture.exercise;
    lecture.hasExercise = false;
  }
}

function getExerciseSheets(lecture) {
  if (!lecture) return [];
  normalizeLectureExercises(lecture);
  return lecture.exercises;
}

function getExerciseSheet(lecture, exerciseId) {
  const sheets = getExerciseSheets(lecture);
  if (!sheets.length) return null;
  if (!exerciseId) return sheets[0];
  return sheets.find((s) => s.id === exerciseId) || sheets[0];
}

function resolveExerciseId(exerciseId, lecture) {
  return getExerciseSheet(lecture, exerciseId)?.id || '';
}

function countExerciseTopics(lecture) {
  return getExerciseSheets(lecture).reduce((n, s) => n + (s.topics?.length || 0), 0);
}

function getExerciseTopics(lecture, exerciseId) {
  return getExerciseSheet(lecture, exerciseId)?.topics || [];
}

function getExerciseSummary(lecture, exerciseId) {
  return getExerciseSheet(lecture, exerciseId)?.exerciseSummary || '';
}

function hasAnyExerciseMaterial(lecture) {
  return getExerciseSheets(lecture).some((s) => (s.topics?.length || 0) > 0);
}

function nextSheetLabel(lecture) {
  return defaultSheetLabel(getExerciseSheets(lecture).length);
}

function extractedFileName(sheetId, sheetIndex) {
  if (sheetId === 'exsheet_legacy' || sheetIndex === 0) {
    return 'exercise_extracted.txt';
  }
  return `exercise_${sheetId}_extracted.txt`;
}

function appendExerciseSheet(lecture, sheet) {
  normalizeLectureExercises(lecture);
  const index = lecture.exercises.length;
  const normalized = normalizeSheet(
    {
      ...sheet,
      label: sheet.label || defaultSheetLabel(index)
    },
    index
  );
  lecture.exercises.push(normalized);
  syncLegacyExerciseMirror(lecture);
  return normalized;
}

function findExerciseTopicInLecture(lecture, topicId, exerciseId) {
  const sheets = exerciseId
    ? [getExerciseSheet(lecture, exerciseId)].filter(Boolean)
    : getExerciseSheets(lecture);
  for (const sheet of sheets) {
    const topic = (sheet.topics || []).find((t) => t.id === topicId);
    if (topic) return { sheet, topic };
  }
  return { sheet: null, topic: null };
}

module.exports = {
  defaultSheetLabel,
  normalizeLectureExercises,
  syncLegacyExerciseMirror,
  getExerciseSheets,
  getExerciseSheet,
  resolveExerciseId,
  countExerciseTopics,
  getExerciseTopics,
  getExerciseSummary,
  hasAnyExerciseMaterial,
  nextSheetLabel,
  extractedFileName,
  appendExerciseSheet,
  findExerciseTopicInLecture
};
