const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vault = require('../main/vault');
const lectureNotes = require('../main/lectureNotes');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-pin-test-'));
const itemPath = path.join(root, 'lec1');
fs.mkdirSync(itemPath, { recursive: true });
fs.writeFileSync(
  path.join(itemPath, 'lecture.json'),
  JSON.stringify(
    {
      id: 'lec1',
      title: 'Mathematische Strukturen',
      topics: [
        {
          id: 't1',
          title: 'Mengenlehre',
          subtopics: [{ id: 's1', title: 'Vereinigung' }]
        }
      ],
      exercise: {
        topics: [
          {
            id: 'ex1',
            title: 'Übung Mengen',
            subtopics: [{ id: 'exs1', title: 'Aufgabe 1' }]
          }
        ]
      }
    },
    null,
    2
  )
);

try {
  const p1 = vault.toggleItemPinned(itemPath);
  assert(p1?.pinned, 'lecture pin set');
  const p2 = vault.toggleTopicPinned(itemPath, 't1', 'lecture');
  assert(p2?.topics?.[0]?.pinned, 'lecture topic pin set');
  const p3 = vault.toggleSubtopicPinned(itemPath, 't1', 's1', 'lecture');
  assert(p3?.topics?.[0]?.subtopics?.[0]?.pinned, 'lecture subtopic pin set');

  const ex1 = vault.toggleTopicPinned(itemPath, 'ex1', 'exercise');
  assert(ex1?.exercise?.topics?.[0]?.pinned, 'exercise topic pin set');
  const ex2 = vault.toggleSubtopicPinned(itemPath, 'ex1', 'exs1', 'exercise');
  assert(ex2?.exercise?.topics?.[0]?.subtopics?.[0]?.pinned, 'exercise subtopic pin set');

  const n = lectureNotes.addNote(itemPath, {
    topicId: 't1',
    topicTitle: 'Mengenlehre',
    highlightedText: 'A ∪ B',
    note: 'union',
    refinedNote: 'union',
    source: 'card',
    materialMode: 'exercise'
  });
  assert(n.success, 'note created');
  const np = lectureNotes.toggleNotePinned(itemPath, n.note.id);
  assert(np.success, 'note pinned');

  const pins = vault.listPinnedInItem(itemPath);
  assert(pins.length >= 5, 'item pins listed including exercise');
  assert(pins.some((p) => p.materialMode === 'exercise' && p.type === 'topic'), 'exercise topic in list');
  const notePins = lectureNotes.listPinnedNotes(itemPath);
  assert(notePins.length === 1, 'note pins listed');
  assert(notePins[0].materialMode === 'exercise', 'note pin carries materialMode');

  console.log('pin-state tests OK');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
