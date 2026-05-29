const assert = require('assert');
const exerciseSheets = require('../shared/exerciseSheets.cjs');
const { applySubtopicExerciseLinks } = require('../shared/subtopicExerciseLink.cjs');
const { buildNoteRoutingKey } = require('../shared/noteAnchor.cjs');

const lecture = {
  title: 'Test Lecture',
  topics: [
    {
      id: 't1',
      title: 'Mengen',
      subtopics: [{ id: 's1', title: 'Vereinigung' }]
    }
  ],
  exercise: {
    id: 'exsheet_legacy',
    label: 'Übung 1',
    topics: [{ id: 'ex1', title: 'Übung Mengen', subtopics: [{ id: 'exs1', title: 'Aufgabe 1' }] }],
    lectureLinks: [{ lectureTopicId: 't1', exerciseTopicId: 'ex1' }]
  }
};

exerciseSheets.normalizeLectureExercises(lecture);
assert(Array.isArray(lecture.exercises), 'exercises array');
assert.strictEqual(lecture.exercises.length, 1, 'one sheet migrated');
assert.strictEqual(lecture.exercises[0].label, 'Übung 1');
assert.strictEqual(lecture.exercise.topics[0].id, 'ex1', 'legacy mirror');

exerciseSheets.appendExerciseSheet(lecture, {
  id: 'exsheet_2',
  label: 'Übung 2',
  topics: [{ id: 'ex2', title: 'Zweites Blatt' }],
  lectureLinks: []
});
assert.strictEqual(lecture.exercises.length, 2);
assert.strictEqual(exerciseSheets.getExerciseTopics(lecture, 'exsheet_2').length, 1);

const { topic } = exerciseSheets.findExerciseTopicInLecture(lecture, 'ex2', 'exsheet_2');
assert(topic?.title === 'Zweites Blatt');

const { linksCount } = applySubtopicExerciseLinks(lecture);
assert(linksCount >= 0);

const keyA = buildNoteRoutingKey({
  lecturePath: '/x',
  topicId: 'ex1',
  materialMode: 'exercise',
  exerciseId: 'exsheet_legacy'
});
const keyB = buildNoteRoutingKey({
  lecturePath: '/x',
  topicId: 'ex1',
  materialMode: 'exercise',
  exerciseId: 'exsheet_2'
});
assert.notStrictEqual(keyA, keyB, 'different sheets separate note groups');

console.log('exercise-sheets tests OK');
