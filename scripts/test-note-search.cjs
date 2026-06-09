#!/usr/bin/env node
const assert = require('assert');
const { filterNotesByQuery } = require('../shared/noteSearch.cjs');

const notes = [
  {
    id: '1',
    title: 'F-Test interpretieren',
    preview: 'Signifikanz prüfen',
    topicTitle: 'ANOVA',
    highlightedText: 'F-Wert',
    refinedNote: 'Der F-Test vergleicht Varianzen.'
  },
  {
    id: '2',
    title: 'Vereinigung von Mengen',
    preview: 'A union B',
    topicTitle: 'Mengenlehre',
    highlightedText: 'A ∪ B'
  }
];

assert.strictEqual(filterNotesByQuery(notes, '').length, 2);
assert.strictEqual(filterNotesByQuery(notes, 'f-test').length, 1);
assert.strictEqual(filterNotesByQuery(notes, 'vereinigung').length, 1);
assert.strictEqual(filterNotesByQuery(notes, 'varianzen').length, 1);
assert.strictEqual(filterNotesByQuery(notes, 'missing').length, 0);

console.log('test-note-search: ok');
