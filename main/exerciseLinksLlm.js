const { parseJsonPayload } = require('./lectureStructureLlm');

function buildLinksPrompt(language) {
  return `You connect exercise/practice topics to lecture topics for the same course unit. Output STRICT JSON ONLY.

LANGUAGE: ${language}

Return:
{
  "links": [
    {
      "exerciseTopicTitle": "exact exercise topic title",
      "lectureTopicTitle": "exact lecture topic title",
      "relation": "applies|reinforces|deepens|exam-level",
      "note": "one short sentence (max 25 words) — what the exercise does with this lecture idea"
    }
  ]
}

RULES:
- Only link when there is a real connection in the materials provided.
- Prefer 1-3 links per exercise topic max; omit weak guesses.
- note: concise, source-grounded (e.g. "computes SS_between for ANOVA topic").
- Use exact topic titles from the lists.`;
}

async function generateExerciseLectureLinks({
  lectureTopics,
  exerciseTopics,
  lectureSummary,
  exerciseSummary,
  outputLanguage,
  callLlm
}) {
  const system = buildLinksPrompt(outputLanguage);
  const user = [
    `Lecture summary: ${lectureSummary?.slice(0, 600) || ''}`,
    `Exercise summary: ${exerciseSummary?.slice(0, 600) || ''}`,
    '',
    'Lecture topics:',
    lectureTopics.map((t, i) => `${i + 1}. ${t.title}`).join('\n'),
    '',
    'Exercise topics:',
    exerciseTopics.map((t, i) => `${i + 1}. ${t.title}`).join('\n')
  ].join('\n');

  const raw = await callLlm(system, user);
  const parsed = parseJsonPayload(raw);
  if (!parsed || !Array.isArray(parsed.links)) {
    return { ok: true, links: [] };
  }

  const lt = new Map(lectureTopics.map((t) => [t.title.toLowerCase(), t.id]));
  const et = new Map(exerciseTopics.map((t) => [t.title.toLowerCase(), t.id]));

  const links = [];
  for (const link of parsed.links) {
    const exTitle = String(link.exerciseTopicTitle || '').trim().toLowerCase();
    const leTitle = String(link.lectureTopicTitle || '').trim().toLowerCase();
    const exerciseTopicId = et.get(exTitle);
    const lectureTopicId = lt.get(leTitle);
    if (!exerciseTopicId || !lectureTopicId) continue;
    links.push({
      exerciseTopicId,
      lectureTopicId,
      relation: String(link.relation || 'reinforces').slice(0, 40),
      note: String(link.note || '').trim().slice(0, 200)
    });
  }

  return { ok: true, links };
}

function attachLinksToTopics(exerciseLayer, links) {
  exerciseLayer.lectureLinks = links;
  const byEx = new Map(links.map((l) => [l.exerciseTopicId, l]));
  for (const topic of exerciseLayer.topics || []) {
    const link = byEx.get(topic.id);
    if (link) {
      topic.lectureLink = {
        lectureTopicId: link.lectureTopicId,
        relation: link.relation,
        note: link.note
      };
    }
  }
  return exerciseLayer;
}

module.exports = {
  generateExerciseLectureLinks,
  attachLinksToTopics
};
