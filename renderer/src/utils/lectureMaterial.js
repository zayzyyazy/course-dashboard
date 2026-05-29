/** @typedef {'lecture' | 'exercise'} MaterialMode */

import {
  getExerciseSheets,
  getExerciseSheet,
  getExerciseTopics,
  getExerciseSummary,
  hasAnyExerciseMaterial,
  findExerciseTopicInLecture
} from '@shared/exerciseSheets.cjs';

export {
  getExerciseSheets,
  getExerciseSheet,
  hasAnyExerciseMaterial as hasExerciseMaterial
};

export function getMaterialTopics(lecture, materialMode, exerciseId = '') {
  if (materialMode === 'exercise') {
    return getExerciseTopics(lecture, exerciseId);
  }
  return lecture?.topics || [];
}

export function getMaterialSummary(lecture, materialMode, exerciseId = '') {
  if (materialMode === 'exercise') {
    return getExerciseSummary(lecture, exerciseId);
  }
  return lecture?.lectureSummary || lecture?.summary || '';
}

export function lectureSupportsExercise(lecture) {
  return Boolean(lecture?.path);
}

export function getLectureTopicTitle(lecture, lectureTopicId) {
  return (lecture?.topics || []).find((t) => t.id === lectureTopicId)?.title || '';
}

export function findExerciseTopic(lecture, exerciseTopicId, exerciseId = '') {
  const { topic } = findExerciseTopicInLecture(lecture, exerciseTopicId, exerciseId);
  return topic;
}

export function hasExerciseForLecture(lecture) {
  return hasAnyExerciseMaterial(lecture);
}

export function resolveActiveExerciseId(lecture, exerciseId) {
  return getExerciseSheet(lecture, exerciseId)?.id || '';
}
