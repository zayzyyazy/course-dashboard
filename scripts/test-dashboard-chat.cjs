#!/usr/bin/env node
const assert = require('assert');
const {
  buildDashboardAiContext,
  buildDashboardChatSystem,
  buildDashboardUserMessage,
  analyzeCourseMaterial,
  topicMaterialWeight,
  collectLowConfidenceSubtopics
} = require('../main/dashboardChat');

const emptyStore = {
  get(key) {
    if (key === 'vaultPath') return '/tmp/empty-vault';
    if (key === 'courses') return [];
    if (key === 'courseOrder') return [];
    return undefined;
  }
};

const ctxEmpty = buildDashboardAiContext(emptyStore);
assert.match(ctxEmpty.snapshot, /No courses in the vault yet/i);

const sys = buildDashboardChatSystem('German');
assert.match(sys, /do NOT use these for comparisons/i);
assert.match(sys, /Personal difficulty/i);
assert.match(sys, /MATERIAL EVIDENCE/i);
assert.match(sys, /exam character/i);
assert.doesNotMatch(sys, /personal difficulty 1–5/i);

const heavyTopic = {
  title: 'Relationen',
  importance: 'core',
  studyDepth: 'examHeavy',
  card: { markdown: '### Relationen\nDefiniert Paare, Funktionen und Äquivalenzklassen für Prüfungsaufgaben.' },
  subtopics: [
    { title: 'kartesisches Produkt', studyDepth: 'examHeavy' },
    { title: 'Äquivalenz', studyDepth: 'high' },
    { title: 'Funktionen', studyDepth: 'high' }
  ]
};
assert.ok(topicMaterialWeight(heavyTopic) >= 14);

const material = analyzeCourseMaterial([
  {
    title: 'Vorlesung 4',
    topics: [heavyTopic, { title: 'Intro', importance: 'supporting', studyDepth: 'low' }]
  }
]);
assert.ok(material.demandScore >= 10);
assert.ok(material.examHeavy >= 1);
assert.ok(material.heaviest[0].topicTitle === 'Relationen');
assert.match(material.examCharacter, /procedures|mixed|conceptual/i);

const lowConf = collectLowConfidenceSubtopics([
  {
    title: 'VL1',
    topics: [
      {
        title: 'Mengen',
        subtopics: [{ title: 'Potenzmenge', studyState: 'studied', studyConfidence: 'low' }]
      }
    ]
  }
]);
assert.strictEqual(lowConf[0].subtopicTitle, 'Potenzmenge');

console.log('test-dashboard-chat: ok');
