const topicExtraction = require('./topicExtraction');
const { parseJsonPayload } = require('./lectureStructureLlm');
const { MATH_OUTPUT_HINT } = require('./courseProfile');

function buildTopicCardsPrompt(language, domainHint, courseProfileBlock = '') {
  return `You are an expert university tutor writing study cards for ONE lecture's topics. Output STRICT JSON ONLY.

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

WHEN INTUITION OR COMPARISON MATTERS: explain intuition; contrast similar methods (e.g. t-test vs ANOVA) when the lecture does.

REJECT: generic filler, meta labels, content not in the lecture, empty templates, ignoring formulas that are central to the topic.

Length: simpler topics ~150-280 words; formula-heavy or procedural topics up to ~500 words.
Be concrete, lecture-faithful. One card per topic; topicTitle must match exactly.`;
}

function buildTopicCardsUserPayload({ extracted, lectureTitle, lectureSummary, topics, courseThread }) {
  const topicList = topics
    .map(
      (t, i) =>
        `${i + 1}. ${t.title} (importance: ${t.importance})${
          t.subtopics?.length ? `\n   Subtopics: ${t.subtopics.map((s) => s.title).join('; ')}` : ''
        }`
    )
    .join('\n');

  return [
    `Lecture: ${lectureTitle}`,
    `Summary: ${lectureSummary}`,
    courseThread?.summary ? `Course position: ${courseThread.summary}` : '',
    '',
    'Topics to explain (generate one card each):',
    topicList,
    '',
    '--- Lecture source excerpt ---',
    extracted.slice(0, 45000)
  ].join('\n');
}

function validateCards(raw, topics) {
  if (!raw || !Array.isArray(raw.cards)) return null;
  const byTitle = new Map(topics.map((t) => [t.title.toLowerCase(), t]));
  const out = [];
  for (const card of raw.cards) {
    const title = topicExtraction.normalizeTopicLabel(card.topicTitle);
    const topic = byTitle.get(title.toLowerCase());
    if (!topic) continue;
    const markdown = String(card.markdown || '').trim();
    if (markdown.length < 80) continue;
    out.push({ topicId: topic.id, markdown: markdown.slice(0, 12000) });
  }
  if (out.length < Math.min(2, topics.length)) return null;
  return out;
}

async function generateTopicCards({
  extracted,
  lecture,
  outputLanguage,
  domainHint,
  courseProfileBlock,
  callLlm
}) {
  const system = buildTopicCardsPrompt(outputLanguage, domainHint, courseProfileBlock);
  const user = buildTopicCardsUserPayload({
    extracted,
    lectureTitle: lecture.lectureTitle || lecture.title,
    lectureSummary: lecture.lectureSummary || lecture.summary,
    topics: lecture.topics,
    courseThread: lecture.courseThread
  });

  let raw = await callLlm(system, user);
  let parsed = parseJsonPayload(raw);
  let cards = validateCards(parsed, lecture.topics);

  if (!cards) {
    raw = await callLlm(
      system,
      `${user}\n\nPrevious response invalid. Return JSON with a "cards" array — one entry per topic, matching topic titles exactly.`
    );
    parsed = parseJsonPayload(raw);
    cards = validateCards(parsed, lecture.topics);
  }

  if (!cards) return { ok: false, error: 'Topic card generation failed validation' };
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
  applyCardsToLecture
};
