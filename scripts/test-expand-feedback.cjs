#!/usr/bin/env node
const assert = require('assert');
const { buildRegenerateFeedbackBlock } = require('../shared/expandFeedback.cjs');
const expandContent = require('../main/expandContent');

assert.strictEqual(buildRegenerateFeedbackBlock({}), '');
assert.match(
  buildRegenerateFeedbackBlock({ presets: ['language_de'], text: 'use formal tone' }),
  /German/
);
assert.match(buildRegenerateFeedbackBlock({ presets: ['language_de'], text: 'use formal tone' }), /formal tone/);

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

const sys = expandContent.buildSubtopicExpandSystem('lecture', 'German', { block: 'CTX' });
assert.match(sys, /German \(Deutsch\)/);
assert.match(sys, /\$\.\.\.\$/);

console.log('test-expand-feedback: ok');
