#!/usr/bin/env node
const assert = require('assert');
const { buildTopicSections, sortNotesInSection } = require('../shared/noteGroups.cjs');

const notes = [
  {
    id: 'n1',
    topicId: 't-b',
    topicTitle: 'Beta Topic',
    sortIndex: 20,
    createdAt: '2026-01-02T00:00:00.000Z',
    title: 'Second'
  },
  {
    id: 'n2',
    topicId: 't-a',
    topicTitle: 'Alpha Topic',
    sortIndex: 10,
    createdAt: '2026-01-01T00:00:00.000Z',
    title: 'First alpha'
  },
  {
    id: 'n3',
    topicId: 't-b',
    topicTitle: 'Beta Topic',
    sortIndex: 10,
    createdAt: '2026-01-03T00:00:00.000Z',
    title: 'First beta'
  }
];

const sorted = sortNotesInSection(notes.filter((n) => n.topicId === 't-b'));
assert.strictEqual(sorted[0].id, 'n3', 'sortIndex wins within topic');
assert.strictEqual(sorted[1].id, 'n1');

const sections = buildTopicSections(notes);
assert.strictEqual(sections.length, 2, 'two topic sections');
assert.strictEqual(sections[0].topicTitle, 'Alpha Topic');
assert.strictEqual(sections[0].notes.length, 1);
assert.strictEqual(sections[1].notes[0].id, 'n3');
assert.ok(!sections[0].clusters, 'no cluster layer');

const ordered = buildTopicSections(notes, ['t-b', 't-a']);
assert.strictEqual(ordered[0].topicTitle, 'Beta Topic', 'topic order from lecture topics');
assert.strictEqual(ordered[1].topicTitle, 'Alpha Topic');

console.log('test-note-sections: ok');
