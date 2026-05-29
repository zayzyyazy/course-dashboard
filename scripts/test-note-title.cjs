const assert = require('assert');
const { deriveStudyNoteTitle, isWeakNoteTitle } = require('../shared/noteTitle.cjs');
const { buildNoteTitle } = require('../shared/noteListMeta.cjs');

function eq(actual, expected, label) {
  assert.strictEqual(actual, expected, `${label}\nexpected: ${expected}\nactual: ${actual}`);
}

const longAnova = buildNoteTitle({
  title: '',
  topicTitle: 'ANOVA',
  highlightedText:
    'In diesem Beispiel berechnen wir SS_between aus Gruppenmitteln und interpretieren danach den F-Test Schritt fuer Schritt.',
  refinedNote:
    'Lange Erklaerung: zuerst Quadratsummen berechnen, dann F-Test auswerten, danach Entscheidung.',
  source: 'card',
  locale: 'de',
  keyIdeas: []
});
assert(longAnova.length <= 55, 'long fragment should be shortened');

eq(
  deriveStudyNoteTitle({
    highlightedText: 'Eta-Quadrat η² als Effektstärke in der ANOVA',
    topicTitle: 'ANOVA'
  }),
  'Eta² / Effektstärke',
  'eta heuristic'
);

const fTitle = deriveStudyNoteTitle({
  highlightedText: 'Beispielaufgabe zum F-Test in der ANOVA',
  topicTitle: 'ANOVA'
});
assert(
  fTitle === 'Beispiel für F-Test' || fTitle === 'F-Test interpretieren',
  `f-test title unexpected: ${fTitle}`
);

eq(
  deriveStudyNoteTitle({
    highlightedText: 'Vereinigung A ∪ B mit Beispiel',
    topicTitle: 'Mengenlehre'
  }),
  'Vereinigung von Mengen',
  'union heuristic'
);

eq(
  deriveStudyNoteTitle({
    highlightedText: 'Schnitt A ∩ B mit Venn-Diagramm',
    topicTitle: 'Mengenlehre'
  }),
  'Schnitt von Mengen',
  'intersection heuristic'
);

eq(
  deriveStudyNoteTitle({
    highlightedText: 'Defining Sets by Enumeration and listing elements',
    topicTitle: 'Mengenlehre'
  }),
  'Mengen aufzählen',
  'enumeration heuristic'
);

eq(
  deriveStudyNoteTitle({
    highlightedText: 'x ∈ A oder x ∉ B prüfen',
    topicTitle: 'Mengenlehre'
  }),
  'Element in Menge prüfen',
  'membership heuristic'
);

eq(
  deriveStudyNoteTitle({
    highlightedText: 'Reihenfolge irrelevant in Mengen',
    topicTitle: 'Mengenlehre'
  }),
  'Reihenfolge in Mengen',
  'order heuristic'
);

const genericAi = deriveStudyNoteTitle({
  title: 'AI clarification',
  source: 'tutorChat',
  topicTitle: 'Mengenlehre',
  subtopicTitle: 'Vereinigung von Mengen'
});
assert(genericAi !== 'AI clarification', 'generic AI title should be replaced');
assert(/vereinigung|mengenlehre/i.test(genericAi), `context title expected, got: ${genericAi}`);

assert(isWeakNoteTitle('AI clarification', 'Mengenlehre'), 'weak title detection should catch AI clarification');
assert(!isWeakNoteTitle('Vereinigung von Mengen', 'Mengenlehre'), 'good title should stay');

console.log('note-title tests OK');
