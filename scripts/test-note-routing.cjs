const assert = require('assert');
const {
  headingToAnchor,
  findSectionAnchorInMarkdown,
  subtopicAnchor
} = require('../shared/noteAnchor.cjs');
const { pickNoteToAppend } = require('../shared/noteAppendPick.cjs');

const cardMd = `## Topic

### Vereinigung von Mengen (A ∪ B)

Die Vereinigung A ∪ B enthält alle Elemente aus A oder B.

### Schnitt von Mengen (A ∩ B)

Der Schnitt A ∩ B enthält nur gemeinsame Elemente.
`;

const aV = headingToAnchor('Vereinigung von Mengen (A ∪ B)');
const aS = headingToAnchor('Schnitt von Mengen (A ∩ B)');
assert(aV && aS && aV !== aS, `distinct anchors: ${aV} vs ${aS}`);

const anchorV = findSectionAnchorInMarkdown(
  cardMd,
  'Die Vereinigung A ∪ B enthält alle Elemente'
);
const anchorS = findSectionAnchorInMarkdown(cardMd, 'Der Schnitt A ∩ B enthält nur gemeinsame');
assert(anchorV === aV, `Vereinigung anchor got ${anchorV}`);
assert(anchorS === aS, `Schnitt anchor got ${anchorS}`);

const notes = [
  {
    id: 'n1',
    topicId: 't1',
    sectionAnchor: aV,
    subtopicId: '',
    title: 'Vereinigung note',
    updatedAt: '2026-01-01'
  },
  {
    id: 'n2',
    topicId: 't1',
    sectionAnchor: aS,
    subtopicId: '',
    title: 'Schnitt note',
    updatedAt: '2026-01-02'
  }
];

const pickV = pickNoteToAppend(notes, 'weitere Vereinigung', {
  topicId: 't1',
  sectionAnchor: aV,
  sourceKind: 'topic-summary'
});
const pickS = pickNoteToAppend(notes, 'weitere Schnitt', {
  topicId: 't1',
  sectionAnchor: aS,
  sourceKind: 'topic-summary'
});
assert(pickV?.id === 'n1', 'append Vereinigung to n1');
assert(pickS?.id === 'n2', 'append Schnitt to n2');

const pickWrong = pickNoteToAppend(notes, 'Schnitt text', {
  topicId: 't1',
  sectionAnchor: aV,
  sourceKind: 'topic-summary'
});
assert(pickWrong?.id === 'n1', 'wrong anchor still only n1 bucket');

const pickNew = pickNoteToAppend(notes, 'new concept', {
  topicId: 't1',
  sectionAnchor: 'differenz-von-mengen',
  sourceKind: 'topic-summary'
});
assert(pickNew === null, 'unknown anchor creates new');

const subId = 'sub-vereinigung-1';
const deepPick = pickNoteToAppend(
  [
    {
      id: 'd1',
      topicId: 't1',
      subtopicId: 'vereinigung-1',
      sectionAnchor: subtopicAnchor({ id: 'vereinigung-1', title: 'Vereinigung' }),
      title: 'deep v'
    }
  ],
  'more deep',
  {
    topicId: 't1',
    subtopicId: 'vereinigung-1',
    sectionAnchor: subtopicAnchor({ id: 'vereinigung-1', title: 'Vereinigung' }),
    sourceKind: 'deeper-subtopic'
  }
);
assert(deepPick?.id === 'd1', 'deep subtopic routing');

console.log('note-routing tests OK');
