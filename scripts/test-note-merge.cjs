const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const lectureNotes = require('../main/lectureNotes');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-note-merge-'));
try {
  const a = lectureNotes.addNote(tmp, {
    topicId: 't1',
    topicTitle: 'Mengenlehre',
    highlightedText: 'A ∪ B',
    note: 'Vereinigung Erklärung',
    refinedNote: 'Vereinigung Erklärung',
    source: 'card'
  });
  const b = lectureNotes.addNote(tmp, {
    topicId: 't1',
    topicTitle: 'Mengenlehre',
    highlightedText: 'A ∩ B',
    note: 'Schnitt Erklärung',
    refinedNote: 'Schnitt Erklärung',
    source: 'card'
  });
  assert(a.success && b.success, 'seed notes');

  const list = lectureNotes.listNotes(tmp);
  const reorder = lectureNotes.reorderNotes(tmp, [list[1].id, list[0].id], { topicId: 't1' });
  assert(reorder.success, 'reorder should succeed');
  const reordered = lectureNotes.listNotes(tmp).filter((n) => n.topicId === 't1');
  assert(reordered[0].id === list[1].id, 'reordered first should match');

  const merge = lectureNotes.mergeNotes(tmp, {
    sourceNoteId: reordered[1].id,
    targetNoteId: reordered[0].id
  });
  assert(merge.success, 'merge should succeed');
  const finalNotes = lectureNotes.listNotes(tmp);
  assert(finalNotes.length === 1, 'source note removed after merge');
  assert(
    /Merged from:/i.test(finalNotes[0].refinedNote || ''),
    'merged marker should be in target note'
  );

  console.log('note-merge tests OK');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
