#!/usr/bin/env node
const assert = require('assert');
const topicExtraction = require('../main/topicExtraction');

// mirror validateCards helpers from topicCardsLlm (inline for test)
function resolveTopicForCard(cardTitle, topics, usedIds) {
  const normalized = topicExtraction.normalizeTopicLabel(cardTitle);
  if (!normalized) return null;
  const lower = normalized.toLowerCase();
  const exact = topics.find(
    (t) =>
      !usedIds.has(t.id) &&
      topicExtraction.normalizeTopicLabel(t.title).toLowerCase() === lower
  );
  if (exact) return exact;
  const fuzzy = topics.find(
    (t) => !usedIds.has(t.id) && topicExtraction.areNearDuplicate(t.title, normalized)
  );
  if (fuzzy) return fuzzy;
  return (
    topics.find((t) => {
      if (usedIds.has(t.id)) return false;
      const tl = topicExtraction.normalizeTopicLabel(t.title).toLowerCase();
      return tl.length > 4 && lower.length > 4 && (tl.includes(lower) || lower.includes(tl));
    }) || null
  );
}

const topics = [
  { id: 't1', title: 'If-Else Statements' },
  { id: 't2', title: 'Boolean Logic' }
];

const used = new Set();
const m1 = resolveTopicForCard('If-Else Statements', topics, used);
assert.strictEqual(m1.id, 't1');
used.add(m1.id);
const m2 = resolveTopicForCard('Boolean logic and comparisons', topics, used);
assert.strictEqual(m2.id, 't2');

console.log('test-topic-cards-validate: ok');
