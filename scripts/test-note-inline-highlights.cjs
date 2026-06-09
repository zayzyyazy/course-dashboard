#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { addNote, addInlineHighlight, removeInlineHighlight } = require('../main/lectureNotes.js');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-nl-hl-'));

const saved = addNote(tmp, {
  topicId: 't1',
  topicTitle: 'ANOVA',
  highlightedText: 'Main effect example',
  note: 'Body paragraph one. Body paragraph two.',
  refinedNote: 'Body paragraph one. Body paragraph two.',
  source: 'card'
});
assert.strictEqual(saved.success, true);

const hl = addInlineHighlight(tmp, saved.note.id, 'Body paragraph one');
assert.strictEqual(hl.success, true);
assert.strictEqual(hl.note.inlineHighlights.length, 1);

const removed = removeInlineHighlight(tmp, saved.note.id, hl.highlight.id);
assert.strictEqual(removed.success, true);
assert.strictEqual(removed.note.inlineHighlights.length, 0);

console.log('test-note-inline-highlights: ok');
