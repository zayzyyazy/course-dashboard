#!/usr/bin/env node
const assert = require('assert');
const { buildRegenerateFeedbackBlock, PRESETS } = require('../shared/expandFeedback.cjs');
const expandContent = require('../main/expandContent');

assert.strictEqual(buildRegenerateFeedbackBlock({}), '');
assert.strictEqual(buildRegenerateFeedbackBlock(null), '');
assert.strictEqual(buildRegenerateFeedbackBlock(undefined), '');
assert.match(
  buildRegenerateFeedbackBlock({ presets: ['language_de'], text: 'use formal tone' }),
  /German/
);
assert.match(buildRegenerateFeedbackBlock({ presets: ['language_de'], text: 'use formal tone' }), /formal tone/);

assert.ok(PRESETS.too_complicated);
assert.ok(PRESETS.too_theoretical);
assert.ok(PRESETS.too_alarmist);
assert.match(buildRegenerateFeedbackBlock({ presets: ['too_complicated'] }), /shorter and simpler/i);
assert.match(buildRegenerateFeedbackBlock({ presets: ['too_theoretical'] }), /Jamovi/i);
assert.match(buildRegenerateFeedbackBlock({ presets: ['too_alarmist'] }), /assumptions/i);

const lang = expandContent.resolveExpandLanguage(
  '/x',
  { title: 'Vorlesung 3: Varianz und Streuung' },
  'lecture',
  '',
  { title: 'Stichprobenvarianz' },
  { title: 'Berechnung mit n-1' },
  'English-only PDF extraction noise'
);
assert.strictEqual(lang, 'German');

const sys = expandContent.buildSubtopicExpandSystem(
  'lecture',
  'German',
  { profile: {}, displayName: 'Statistik' },
  { extracted: 'Jamovi output', topic: { title: 'Varianz' }, subtopic: { title: 'Berechnung' } }
);
assert.match(sys, /German \(Deutsch\)/);
assert.match(sys, /\$\.\.\.\$/);
assert.doesNotMatch(sys, /Go deeper on mechanisms, notation/i);

console.log('test-expand-feedback: ok');
