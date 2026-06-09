#!/usr/bin/env node
const assert = require('assert');
const { rankPages, scorePage, keywordSet } = require('../main/pdfPages');

const pageIndex = [
  { page: 1, text: 'Introduction to the course overview' },
  { page: 2, text: 'Jamovi Analyze Descriptive Statistics output table Mean SD' },
  { page: 3, text: 'Theory of variance formulas assumptions normality homogeneity' },
  { page: 4, text: '' },
  { page: 5, text: 'Jamovi screenshot one-way ANOVA menu click Results' }
];

const topic = { title: 'Deskriptive Statistik', card: { markdown: 'Jamovi output tables' } };
const subtopic = { title: 'Mittelwert in Jamovi' };

const keywords = keywordSet({ topic, subtopic, cardMarkdown: topic.card.markdown });
assert.ok(keywords.has('jamovi') || keywords.has('mittelwert'));

const jamoviScore = scorePage(pageIndex[1], keywords, subtopic.title);
const introScore = scorePage(pageIndex[0], keywords, subtopic.title);
assert.ok(jamoviScore > introScore, 'Jamovi page should rank higher');

const ranked = rankPages(pageIndex, { topic, subtopic, cardMarkdown: topic.card.markdown, maxPages: 3 });
assert.ok(ranked.includes(2), 'page 2 (Jamovi) should be selected');
assert.ok(ranked.includes(5) || ranked.includes(4), 'screenshot-like page should be selected');
assert.ok(ranked.length <= 3);

console.log('test-pdf-pages: ok');
