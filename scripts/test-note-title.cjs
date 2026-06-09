const assert = require('assert');
const { deriveStudyNoteTitle, isWeakNoteTitle } = require('../shared/noteTitle.cjs');
const { buildNoteTitle, buildNotePreview } = require('../shared/noteListMeta.cjs');

function eq(actual, expected, label) {
  assert.strictEqual(actual, expected, `${label}\nexpected: ${expected}\nactual: ${actual}`);
}

eq(
  deriveStudyNoteTitle({
    subtopicTitle: 'Varianz zwischen Gruppen',
    topicTitle: 'ANOVA'
  }),
  'Varianz zwischen Gruppen',
  'subtopic title priority'
);

eq(
  deriveStudyNoteTitle({
    sectionHeading: 'Effektstärken',
    topicTitle: 'ANOVA'
  }),
  'Effektstärken',
  'section heading priority'
);

const fromHighlight = deriveStudyNoteTitle({
  highlightedText: 'Der F-Test vergleicht zwei Varianzen Schritt für Schritt.',
  topicTitle: 'ANOVA'
});
assert.ok(fromHighlight.includes('F-Test'), `highlight sentence title expected, got: ${fromHighlight}`);

eq(
  deriveStudyNoteTitle({
    source: 'tutorChat',
    topicTitle: 'Mengenlehre'
  }),
  'Tutor answer · Mengenlehre',
  'source hint fallback'
);

assert(isWeakNoteTitle('AI clarification', 'Mengenlehre'), 'weak title detection');
assert(!isWeakNoteTitle('Varianz zwischen Gruppen', 'ANOVA'), 'good title should stay');
assert(
  isWeakNoteTitle('Die Wahl zwischen Eta-Quadrat und Omega-Quadrat hängt von', 'ANOVA'),
  'sentence fragment ending with von is weak'
);
assert(
  isWeakNoteTitle('ein signifikantes Ergebnis nicht angibt, welche Gruppen sich', 'ANOVA'),
  'lowercase sentence fragment is weak'
);

eq(
  deriveStudyNoteTitle({
    title: 'Die Wahl zwischen Eta-Quadrat und Omega-Quadrat hängt von',
    subtopicTitle: 'Effektgrößen in der ANOVA',
    topicTitle: 'Einfaktorielle Varianzanalyse'
  }),
  'Effektgrößen in der ANOVA',
  'weak stored title falls back to subtopic'
);

eq(
  deriveStudyNoteTitle({
    keyIdeas: ['Eta-Quadrat misst Varianzanteil'],
    highlightedText: 'Die Wahl zwischen Eta-Quadrat und Omega-Quadrat hängt von mehreren Faktoren ab.',
    topicTitle: 'ANOVA'
  }),
  'Eta-Quadrat misst Varianzanteil',
  'key idea before highlight snippet'
);

const edited = buildNoteTitle({
  title: 'My custom title',
  titleEdited: true,
  topicTitle: 'ANOVA'
});
eq(edited, 'My custom title', 'edited title preserved');

const preview = buildNotePreview({
  refinedNote: 'Der F-Test prüft ob Gruppenunterschiede zufällig sind.',
  title: 'F-Test',
  topicTitle: 'ANOVA',
  locale: 'de'
});
assert.ok(preview.includes('F-Test'), `preview from body expected, got: ${preview}`);
assert.ok(!preview.startsWith('Helps with:'), 'no generic helps-with preview');

console.log('note-title tests OK');
