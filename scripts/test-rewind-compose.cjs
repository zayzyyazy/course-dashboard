#!/usr/bin/env node
const assert = require('assert');
const {
  composeRewindFromLecture,
  getRewindMarkdown,
  firstSentence,
  firstNSentences,
  topicTakeaway
} = require('../shared/rewindCompose.cjs');

const baseLecture = {
  title: 'Hypothesis Testing',
  lectureSummary:
    'This lecture covers null and alternative hypotheses. Students learn p-values and Type I errors.',
  courseThread: {
    summary: 'Bridges descriptive stats and regression.',
    continuesFrom: 'Probability basics',
    leadsTo: 'Linear models'
  },
  topics: [
    {
      id: 't-one',
      title: 'Null hypothesis',
      importance: 'core',
      card: { markdown: 'The **null hypothesis** $H_0$ assumes no effect.' },
      subtopics: []
    },
    {
      id: 't-two',
      title: 'p-values',
      importance: 'supporting',
      subtopics: [{ title: 'Interpretation' }, { title: 'Common mistakes' }]
    }
  ],
  studyState: { lastOpenedAt: '2026-05-01T12:00:00.000Z' }
};

assert.strictEqual(firstSentence('First idea. Second idea.'), 'First idea.');
assert.strictEqual(firstNSentences('One. Two. Three.', 2), 'One. Two.');

const composed = composeRewindFromLecture(baseLecture);
assert.match(composed, /## What this lecture is about/);
assert.match(composed, /## Topics to recall/);
assert.match(composed, /Null hypothesis/);
assert.match(composed, /\(Core\)/);
assert.match(composed, /- Interpretation/);
assert.match(composed, /\*\*Remember:\*\*/);
assert.match(composed, /## Where this fits/);
assert.match(composed, /Last studied:/);
assert.doesNotMatch(composed, /## Lecture summary/);

const empty = composeRewindFromLecture({ topics: [] });
assert.match(empty, /No summary yet/);

assert.match(topicTakeaway(baseLecture.topics[0]), /null hypothesis/i);

const withAi = getRewindMarkdown({
  ...baseLecture,
  rewind: { markdown: '## In one minute\n\nThree things to remember.' }
});
assert.strictEqual(withAi.source, 'ai');

const composedOnly = getRewindMarkdown(baseLecture);
assert.strictEqual(composedOnly.source, 'composed');

console.log('test-rewind-compose: ok');
