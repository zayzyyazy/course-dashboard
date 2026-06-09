#!/usr/bin/env node
const assert = require('assert');
const expandContent = require('../main/expandContent');
const { buildExpandProfileBlock } = require('../main/courseProfile');

const statsExtract =
  'Jamovi: Analyze > Descriptive Statistics. Output table shows Mean, SD. One-way ANOVA in Jamovi menu.';

assert.match(expandContent.DEPTH_RULES.subtopic, /250/);
assert.match(expandContent.DEPTH_RULES.topic, /350/);
assert.match(expandContent.CLARITY_RULES, /do not add content absent from the source/i);

const statsSys = expandContent.buildSubtopicExpandSystem(
  'lecture',
  'German',
  { profile: {}, displayName: 'Statistik I' },
  {
    extracted: statsExtract,
    topic: { title: 'Varianz', card: { markdown: 'Stichprobenvarianz' } },
    subtopic: { title: 'Jamovi deskriptiv' }
  }
);
assert.match(statsSys, /STATISTICS \/ JAMOVI EMPHASIS/);
assert.match(statsSys, /software workflow/i);
assert.doesNotMatch(statsSys, /Go deeper on mechanisms, notation/i);
assert.match(statsSys, /Prefer clarity over completeness/);

const plainSys = expandContent.buildSubtopicExpandSystem(
  'lecture',
  'English',
  { profile: {}, displayName: 'Media Design' },
  {
    extracted: 'Gestalt principles and visual hierarchy in digital media.',
    topic: { title: 'Layout', card: { markdown: 'Balance and contrast' } },
    subtopic: { title: 'Contrast' }
  }
);
assert.doesNotMatch(plainSys, /STATISTICS \/ JAMOVI EMPHASIS/);

const visionSys = expandContent.buildTopicExpandSystem(
  'lecture',
  'German',
  { profile: {}, displayName: 'Statistik' },
  { extracted: statsExtract, topic: { title: 'ANOVA' }, hasVision: true }
);
assert.match(visionSys, /Attached slide screenshots/);

const expandBlock = buildExpandProfileBlock({}, 'Statistik', { presets: [] });
assert.match(expandBlock, /Prefer clarity over completeness/);
assert.doesNotMatch(expandBlock, /step-by-step logic for procedures and calculations/);

const deeperBlock = buildExpandProfileBlock({}, 'Statistik', { presets: ['too_shallow'] });
assert.match(deeperBlock, /step-by-step logic/i);

assert.strictEqual(
  expandContent.isStatisticsDomain('Statistik I', statsExtract, { title: 'Varianz' }, { title: 'Jamovi' }),
  true
);

console.log('test-expand-prompts: ok');
