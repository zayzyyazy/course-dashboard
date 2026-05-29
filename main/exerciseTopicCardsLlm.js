const topicExtraction = require('./topicExtraction');
const { parseJsonPayload } = require('./lectureStructureLlm');
const { MATH_OUTPUT_HINT } = require('./courseProfile');

function buildExerciseCardsPrompt(language, domainHint, courseProfileBlock = '') {
  return `You write practice-focused study cards for ONE exercise topic (Übung). Output STRICT JSON ONLY.

LANGUAGE: ${language}
DOMAIN: ${domainHint || 'university practice material'}

${courseProfileBlock}
${MATH_OUTPUT_HINT}

Return: { "cards": [{ "topicTitle": "exact title", "markdown": "..." }] }

CARD FOCUS — NOT A MINI-LECTURE:
- What is being practiced and what you must be able to do
- Problem types that appear (from the exercise source)
- Procedures: steps, calculations, interpretations, notation use
- What exam/application level this suggests
- 1-2 concrete examples or worked patterns ONLY if in the source
- Link to lecture ideas briefly when obvious — do not invent theory

INCLUDE when central: formulas ($...$), computation steps, interpretation checks, code/syntax patterns.

REJECT: generic theory essays, invented content, filler headings, ignoring calculations in the exercise.

Length: 120-320 words per card; more if heavy procedure/math.`;
}

function buildUserPayload({ extracted, exerciseTitle, exerciseSummary, topics, lectureTitle, lectureSummary }) {
  const topicList = topics
    .map((t, i) => {
      const extra = [
        t.practiceFocus ? `focus: ${t.practiceFocus}` : '',
        t.problemTypes?.length ? `problems: ${t.problemTypes.join('; ')}` : '',
        t.procedures?.length ? `procedures: ${t.procedures.join('; ')}` : ''
      ]
        .filter(Boolean)
        .join(' | ');
      return `${i + 1}. ${t.title}${extra ? `\n   ${extra}` : ''}`;
    })
    .join('\n');

  return [
    `Lecture: ${lectureTitle}`,
    lectureSummary ? `Lecture summary (context): ${lectureSummary.slice(0, 800)}` : '',
    `Exercise set: ${exerciseTitle}`,
    `Exercise summary: ${exerciseSummary}`,
    '',
    'Topics (one card each):',
    topicList,
    '',
    '--- Exercise source excerpt ---',
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
    if (markdown.length < 60) continue;
    out.push({ topicId: topic.id, markdown: markdown.slice(0, 12000) });
  }
  if (out.length < Math.min(1, topics.length)) return null;
  return out;
}

async function generateExerciseTopicCards({
  extracted,
  exerciseLayer,
  lectureTitle,
  lectureSummary,
  outputLanguage,
  domainHint,
  courseProfileBlock,
  callLlm
}) {
  const topics = exerciseLayer.topics || [];
  const system = buildExerciseCardsPrompt(outputLanguage, domainHint, courseProfileBlock);
  const user = buildUserPayload({
    extracted,
    exerciseTitle: exerciseLayer.title || exerciseLayer.exerciseTitle,
    exerciseSummary: exerciseLayer.exerciseSummary,
    topics,
    lectureTitle,
    lectureSummary
  });

  let raw = await callLlm(system, user);
  let parsed = parseJsonPayload(raw);
  let cards = validateCards(parsed, topics);

  if (!cards) {
    raw = await callLlm(system, `${user}\n\nReturn valid JSON with one card per topic title.`);
    parsed = parseJsonPayload(raw);
    cards = validateCards(parsed, topics);
  }

  if (!cards) return { ok: false, error: 'Exercise topic cards failed' };
  return { ok: true, cards };
}

function applyCardsToExercise(exerciseLayer, cards) {
  const byId = new Map(cards.map((c) => [c.topicId, c]));
  for (const topic of exerciseLayer.topics || []) {
    const card = byId.get(topic.id);
    if (card) {
      topic.card = {
        markdown: card.markdown,
        generatedAt: new Date().toISOString()
      };
    }
  }
  return exerciseLayer;
}

module.exports = {
  generateExerciseTopicCards,
  applyCardsToExercise
};
