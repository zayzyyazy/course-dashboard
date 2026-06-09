#!/usr/bin/env node
const assert = require('assert');
const { salvageTopicCardMarkdown } = require('../main/topicCardsLlm');

const truncated = `{
  "cards": [
    {
      "topicTitle": "IF Statement",
      "markdown": "### Understanding the IF Statement\\n\\nThe **IF statement** is a fundamental construct in programming used for decision-makin`;

const md = salvageTopicCardMarkdown(truncated);
assert.ok(md && md.length >= 60, 'salvage truncated json');
assert.ok(md.includes('IF statement'), 'salvage keeps content');

const complete = `{"cards":[{"topicTitle":"IF Statement","markdown":"### IF\\n\\nUse when you need branching. At least sixty characters of real study content here for the test."}]}`;
const md2 = salvageTopicCardMarkdown(complete);
assert.ok(md2 && md2.includes('branching'), 'salvage complete json');

console.log('test-topic-card-salvage: ok');
