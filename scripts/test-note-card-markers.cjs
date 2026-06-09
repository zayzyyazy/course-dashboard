#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { cardMarkersForSubtopic, notesForLinkPicker } = require('../shared/noteCardMarkers.cjs');

const notes = [
  {
    id: 'm1',
    cardMarker: true,
    topicId: 't1',
    subtopicId: 's1',
    highlightedText: 'Eta-Quadrat',
    sortIndex: 10,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'n1',
    topicId: 't1',
    subtopicId: 's1',
    title: 'Full note',
    createdAt: '2026-01-02T00:00:00.000Z'
  },
  {
    id: 'm2',
    cardMarker: true,
    topicId: 't1',
    subtopicId: 's2',
    highlightedText: 'Other subtopic',
    createdAt: '2026-01-03T00:00:00.000Z'
  }
];

const markers = cardMarkersForSubtopic(notes, { topicId: 't1', subtopicId: 's1' });
assert.strictEqual(markers.length, 1);
assert.strictEqual(markers[0].id, 'm1');

const linkable = notesForLinkPicker(notes, { topicId: 't1', subtopicId: 's1' });
assert.strictEqual(linkable.length, 1);
assert.strictEqual(linkable[0].id, 'n1');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-card-marker-'));
const { addNote } = require('../main/lectureNotes.js');

const saved = addNote(tmp, {
  topicId: 't1',
  topicTitle: 'ANOVA',
  subtopicId: 's1',
  subtopicTitle: 'Effektgrößen',
  source: 'deep',
  sourceKind: 'deeper-subtopic',
  highlightedText: 'Omega-Quadrat korrigiert für Stichprobengröße',
  cardMarker: true,
  note: 'Prüfungsrelevant'
});
assert.strictEqual(saved.success, true);
assert.strictEqual(saved.note.cardMarker, true);
assert.ok(saved.note.title);

console.log('test-note-card-markers: ok');
