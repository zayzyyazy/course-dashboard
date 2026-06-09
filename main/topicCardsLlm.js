const topicExtraction = require('./topicExtraction');
const { parseJsonPayload } = require('./lectureStructureLlm');
const { MATH_OUTPUT_HINT } = require('./courseProfile');

function buildTopicCardsPrompt(language, domainHint, courseProfileBlock = '') {
  return `You are an expert university tutor writing study cards for ONE lecture topic. Output STRICT JSON ONLY.

LANGUAGE: ${language}
DOMAIN CONTEXT: ${domainHint || 'general academic lecture'}

${courseProfileBlock}

${MATH_OUTPUT_HINT}

Return shape:
{
  "cards": [
    {
      "topicTitle": "exact title matching input topic",
      "markdown": "tutor explanation in markdown"
    }
  ]
}

CARD RULES — ADAPTIVE TUTOR, NOT TEMPLATED THEORY:
- Write like a strong tutor who adapts to the subject. Do NOT write every card as pure conceptual prose.
- Do NOT force identical headings on every card (no mandatory Definition/Example/Mistakes blocks).
- Use markdown naturally: short sections only when they help; inline math with $...$ or clear ASCII when needed.

WHEN THE TOPIC IS QUANTITATIVE OR PROCEDURAL, INCLUDE WHAT STUDENTS MUST LEARN:
- Statistics: test statistic logic, assumptions, computation steps, interpretation, common confusions vs similar tests.
- Mathematics: notation decode, definitions, key formulas, symbol meanings, proof/derivation sketch only if in lecture, when to apply.
- Programming / CS: concept vs syntax, algorithm/data-flow steps, when to use, minimal code only if lecture had code.
- Technical methods: step-by-step procedure, inputs/outputs, how to apply, not just what it is called.

WHEN INTUITION OR COMPARISON MATTERS: explain intuition; contrast similar methods when the lecture does.

REJECT: generic filler, meta labels, content not in the lecture, empty templates.

Length: ~120-280 words for this single topic card.
Escape double quotes inside markdown as \\". No raw newlines inside JSON strings — use \\n.
topicTitle must match the requested topic exactly.`;
}

function buildSingleTopicUserPayload({ extracted, lectureTitle, lectureSummary, topic, courseThread }) {
  const subtopicLine = topic.subtopics?.length
    ? `Subtopics: ${topic.subtopics.map((s) => s.title).join('; ')}`
    : '';

  return [
    `Lecture: ${lectureTitle}`,
    `Summary: ${lectureSummary}`,
    courseThread?.summary ? `Course position: ${courseThread.summary}` : '',
    '',
    `Generate ONE study card for this topic only: "${topic.title}" (importance: ${topic.importance})`,
    subtopicLine,
    `Return JSON with a single-item "cards" array. topicTitle must be exactly: "${topic.title}"`,
    '',
    '--- Lecture source excerpt ---',
    extracted.slice(0, 10000)
  ]
    .filter(Boolean)
    .join('\n');
}

/** Pull markdown from complete or truncated topic-card JSON when JSON.parse fails. */
function salvageTopicCardMarkdown(raw) {
  if (!raw) return null;
  const marker = '"markdown"';
  const idx = raw.indexOf(marker);
  if (idx < 0) return null;

  let i = raw.indexOf(':', idx + marker.length);
  if (i < 0) return null;
  i += 1;
  while (i < raw.length && /\s/.test(raw[i])) i += 1;
  if (raw[i] !== '"') return null;
  i += 1;

  let out = '';
  let escaped = false;
  while (i < raw.length) {
    const c = raw[i];
    if (escaped) {
      if (c === 'n') out += '\n';
      else if (c === 't') out += '\t';
      else if (c === 'r') out += '\r';
      else if (c === 'u' && raw.slice(i, i + 4).match(/^u[0-9a-fA-F]{4}/)) {
        out += String.fromCharCode(parseInt(raw.slice(i + 1, i + 5), 16));
        i += 4;
      } else out += c;
      escaped = false;
    } else if (c === '\\') {
      escaped = true;
    } else if (c === '"') {
      break;
    } else {
      out += c;
    }
    i += 1;
  }

  const markdown = out.trim();
  return markdown.length >= 60 ? markdown : null;
}

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

function validateCards(raw, topics) {
  if (!raw || !Array.isArray(raw.cards)) return null;
  const usedIds = new Set();
  const out = [];
  const unmatched = [];

  for (const card of raw.cards) {
    const title = topicExtraction.normalizeTopicLabel(card.topicTitle);
    const topic = resolveTopicForCard(card.topicTitle, topics, usedIds);
    if (!topic) {
      if (title) unmatched.push(title);
      continue;
    }
    const markdown = String(card.markdown || '').trim();
    if (markdown.length < 60) {
      unmatched.push(`${title} (too short: ${markdown.length})`);
      continue;
    }
    usedIds.add(topic.id);
    out.push({ topicId: topic.id, markdown: markdown.slice(0, 12000) });
  }

  const required = topics.length <= 1 ? 1 : Math.min(2, topics.length);
  if (out.length < required) return null;
  return out;
}

async function generateOneTopicCard({ topic, extracted, lecture, outputLanguage, domainHint, courseProfileBlock, callLlm }) {
  const system = buildTopicCardsPrompt(outputLanguage, domainHint, courseProfileBlock);
  const user = buildSingleTopicUserPayload({
    extracted,
    lectureTitle: lecture.lectureTitle || lecture.title,
    lectureSummary: lecture.lectureSummary || lecture.summary,
    topic,
    courseThread: lecture.courseThread
  });

  let raw = await callLlm(system, user, { maxTokens: 2048 });
  let parsed = parseJsonPayload(raw);
  let cards = validateCards(parsed, [topic]);

  if (!cards) {
    const salvaged = salvageTopicCardMarkdown(raw);
    if (salvaged) {
      cards = [{ topicId: topic.id, markdown: salvaged.slice(0, 12000) }];
    }
  }

  if (!cards && parsed?.cards?.[0]?.markdown) {
    const md = String(parsed.cards[0].markdown).trim();
    if (md.length >= 60) {
      cards = [{ topicId: topic.id, markdown: md.slice(0, 12000) }];
    }
  }

  if (!cards) {
    raw = await callLlm(
      system,
      `${user}\n\nPrevious JSON invalid or truncated. Return ONLY valid JSON: {"cards":[{"topicTitle":"${topic.title}","markdown":"..."}]} — compact markdown, 80-200 words, properly escaped.`,
      { maxTokens: 2048 }
    );
    parsed = parseJsonPayload(raw);
    cards = validateCards(parsed, [topic]);
    if (!cards && parsed?.cards?.[0]?.markdown?.trim().length >= 60) {
      cards = [{ topicId: topic.id, markdown: String(parsed.cards[0].markdown).trim().slice(0, 12000) }];
    }
    if (!cards) {
      const salvaged = salvageTopicCardMarkdown(raw);
      if (salvaged) {
        cards = [{ topicId: topic.id, markdown: salvaged.slice(0, 12000) }];
      }
    }
  }

  if (!cards) return null;

  return cards[0];
}

const TOPIC_CARD_CONCURRENCY = 3;

async function generateTopicCards({
  extracted,
  lecture,
  outputLanguage,
  domainHint,
  courseProfileBlock,
  callLlm,
  onProgress
}) {
  const topics = lecture.topics || [];
  if (!topics.length) return { ok: false, error: 'No topics to generate cards for' };

  const cards = new Array(topics.length);
  let nextIndex = 0;
  let failure = null;

  const worker = async () => {
    while (!failure) {
      const i = nextIndex;
      nextIndex += 1;
      if (i >= topics.length) return;

      const topic = topics[i];
      onProgress?.(`Writing topic card ${i + 1}/${topics.length}: ${topic.title}…`);

      const card = await generateOneTopicCard({
        topic,
        extracted,
        lecture,
        outputLanguage,
        domainHint,
        courseProfileBlock,
        callLlm
      });
      if (!card) {
        failure = `Topic card generation failed for "${topic.title}"`;
        return;
      }
      cards[i] = card;
    }
  };

  const poolSize = Math.min(TOPIC_CARD_CONCURRENCY, topics.length);
  await Promise.all(Array.from({ length: poolSize }, () => worker()));

  if (failure) return { ok: false, error: failure };

  return { ok: true, cards };
}

function applyCardsToLecture(lecture, cards) {
  const byId = new Map(cards.map((c) => [c.topicId, c]));
  for (const topic of lecture.topics || []) {
    const card = byId.get(topic.id);
    if (card) {
      topic.card = {
        markdown: card.markdown,
        generatedAt: new Date().toISOString()
      };
    }
  }
  return lecture;
}

module.exports = {
  buildTopicCardsPrompt,
  generateTopicCards,
  generateOneTopicCard,
  applyCardsToLecture,
  validateCards,
  resolveTopicForCard,
  salvageTopicCardMarkdown
};
