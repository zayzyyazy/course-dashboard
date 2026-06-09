#!/usr/bin/env node
const assert = require('assert');
const { prepareStudyMarkdown } = require('../renderer/src/utils/prepareStudyMarkdown.js');

const multiLine = prepareStudyMarkdown('Title line:\nFirst point.\nSecond point.');
assert.ok(multiLine.includes('### Title line'));
assert.ok(multiLine.includes('\n\n'));

const longBlock = prepareStudyMarkdown(
  `${'Word '.repeat(40)}First sentence here. Second sentence follows. Third sentence adds more. Fourth wraps up.`
);
assert.ok(longBlock.includes('\n\n'));

console.log('test-prepare-study-markdown: ok');
