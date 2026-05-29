const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vault = require('../main/vault');
const { collectAllPinned } = require('../main/pinsAggregate');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-pins-agg-'));
const courseKey = 'Mathe';
const courseDir = path.join(root, courseKey);
const itemPath = path.join(courseDir, 'lec1');
fs.mkdirSync(itemPath, { recursive: true });
fs.writeFileSync(
  path.join(itemPath, 'lecture.json'),
  JSON.stringify(
    {
      id: 'lec1',
      title: 'Strukturen',
      topics: [{ id: 't1', title: 'Mengen', pinned: true, pinnedAt: '2026-01-01T00:00:00.000Z' }]
    },
    null,
    2
  )
);

const store = {
  get(key) {
    if (key === 'vaultPath') return root;
    if (key === 'courses')
      return [
        {
          id: 'c1',
          name: 'Mathematik',
          emoji: '📐',
          storageKey: courseKey
        }
      ];
    if (key === 'courseOrder') return ['c1'];
    return null;
  }
};

try {
  const pins = collectAllPinned(store);
  assert(pins.length === 1, 'one pin aggregated');
  assert(pins[0].courseId === 'c1', 'course id');
  assert(pins[0].lectureId === 'lec1', 'lecture id');
  assert(pins[0].type === 'topic', 'topic pin');
  assert(pins[0].breadcrumb.includes('Mathematik'), 'breadcrumb has course');
  console.log('pins-aggregate tests OK');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
