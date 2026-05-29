const assert = require('assert');
const {
  cleanHighlightText,
  dedupeAdjacentExactCopy,
  removeTrailingAsciiMathEcho,
  repairCollapsedWords
} = require('../shared/cleanHighlightText.cjs');

function eq(actual, expected, label) {
  assert.strictEqual(actual, expected, label);
}

function includes(actual, needle, label) {
  assert(actual.includes(needle), `${label}: expected "${needle}" in "${actual}"`);
}

const dupA = cleanHighlightText('A = {4,+,1} A={4,+,1}');
assert(!dupA.includes('A={4'), 'duplicate set assignment removed');
includes(dupA, '4', 'duplicate keeps content');

const dupB = cleanHighlightText('B = {a,5,Ω} B={a,5,Ω}');
assert(!/B=\{a/i.test(dupB), 'duplicate with omega removed');
includes(dupB, 'Ω', 'omega preserved');
eq(
  cleanHighlightText('A ∪ B AuB'),
  'A ∪ B',
  'unicode union vs ascii echo'
);

const german =
  'Die leere Menge enthält kein Element und ist eine Teilmenge jeder Menge.';
eq(cleanHighlightText(german), german, 'German sentence unchanged');

eq(
  cleanHighlightText('η² erklärt die Effektstärke in der ANOVA.'),
  'η² erklärt die Effektstärke in der ANOVA.',
  'eta squared'
);

eq(
  cleanHighlightText('SS_between misst die Streuung zwischen Gruppen.'),
  'SS_between misst die Streuung zwischen Gruppen.',
  'SS_between'
);

eq(cleanHighlightText('  A ∪ B   A ∪ B  '), 'A ∪ B', 'spaced duplicate union');

const glued = cleanHighlightText('BetrachtenwirzweiMengen:A = {1,2,3,4} B = {3,4,5,6}');
assert(!/Betrachtenwir/i.test(glued), 'German words not glued');
includes(glued, 'Betrachten', 'betrachten word');
includes(glued, 'wir', 'wir word');
includes(glued, 'zwei', 'zwei word');
includes(glued, 'Mengen', 'Mengen word');
includes(glued, 'A =', 'set A');
includes(glued, 'B =', 'set B');

const intersection = cleanHighlightText('A∩B={xIx∈A und x∈B}');
includes(intersection, '∩', 'union symbol spaced');
includes(intersection, '∈', 'element symbol');
includes(intersection, '|', 'set-builder bar');
includes(intersection, 'und', 'German und preserved');
assert(/A\s*∩\s*B/.test(intersection), 'A cap B readable');

const notation = cleanHighlightText('Definition und Notation Der Schnitt zweier Mengen');
includes(notation, 'Definition und Notation', 'heading phrase spaced');
includes(notation, 'Der Schnitt', 'sentence start spaced');

assert(
  dedupeAdjacentExactCopy('x = 1 x=1').length <= 5 || dedupeAdjacentExactCopy('x = 1 x=1') === 'x = 1',
  'compact dup'
);
assert(removeTrailingAsciiMathEcho('A ∪ B AuB') === 'A ∪ B', 'ascii echo helper');

const repaired = repairCollapsedWords('BetrachtenwirzweiMengen');
assert(repaired.includes(' '), 'repairCollapsedWords adds spaces');

console.log('clean-highlight-text tests OK');
