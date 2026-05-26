const { parseJsonPayload } = require('./lectureStructureLlm');
const topicExtraction = require('./topicExtraction');
const lectureNormalize = require('./lectureNormalize');
const { MATH_OUTPUT_HINT } = require('./courseProfile');

const MIN_TOPICS = 3;
const MAX_TOPICS = 8;
const MAX_SUBTOPICS = 5;

function buildPromoteStructurePrompt(language, domainHint, courseProfileBlock = '') {
  return `You are a university study-structure specialist. A student promoted ONE large topic from a lecture into its own focused study unit. Output STRICT JSON ONLY.

LANGUAGE: ${language}
DOMAIN: ${domainHint || 'general academic'}

${courseProfileBlock}

${MATH_OUTPUT_HINT}

The promoted topic is now the ROOT of a new study unit. Break it into a richer, more granular checklist than the original lecture had room for.

OUTPUT SHAPE:
{
  "unitTitle": "clean study-unit title (use/improve the source topic name — never generic labels)",
  "unitSummary": "120-200 word markdown-friendly summary focused ONLY on this unit's scope",
  "topics": [
    {
      "title": "main study topic within this unit",
      "importance": "core|supporting|foundation",
      "subtopics": [{"title": "concrete learnable sub-item"}],
      "connections": {
        "buildsOn": ["idea within this unit or source lecture"],
        "relatedInCourse": ["optional link to source lecture topic"]
      }
    }
  ],
  "courseThread": {
    "summary": "2-3 sentences: this unit's role, split from which lecture topic",
    "continuesFrom": "what from the source lecture/topic this assumes",
    "leadsTo": "what to study next in course"
  }
}

RULES:
- Produce ${MIN_TOPICS}-${MAX_TOPICS} main topics; each 1-${MAX_SUBTOPICS} subtopics when material supports it.
- More detailed than the original single topic card — this unit exists because the topic was too large.
- Include formulas, notation, computation steps, procedures, proofs, syntax when central (statistics/math/CS/quantitative).
- Subtopics must be real teachable items from the source material for THIS topic scope only.
- Do NOT invent content outside the provided sources.
- Forbidden labels: Overview, Summary, Topic from lecture, Expanded section, Kernthemen, Unterthemen, generic scaffolding.
- unitTitle must be specific (e.g. "Quadratsummenzerlegung", "Analysis reeller Funktionen") — never "Promoted topic".`;
}

function buildPromoteUserPayload({
  sourceLectureTitle,
  sourceTopic,
  extracted,
  domainHint
}) {
  const subtopicList = (sourceTopic.subtopics || []).map((s) => s.title).join('; ');
  const card = sourceTopic.card?.markdown || '';
  const connections = sourceTopic.connections || {};

  return [
    `Source lecture: ${sourceLectureTitle}`,
    `Promoted topic: ${sourceTopic.title}`,
    sourceTopic.importance ? `Importance in lecture: ${sourceTopic.importance}` : '',
    subtopicList ? `Original subtopics (expand/refine these): ${subtopicList}` : '',
    connections.buildsOn?.length ? `Builds on: ${connections.buildsOn.join('; ')}` : '',
    connections.relatedInCourse?.length
      ? `Related in course: ${connections.relatedInCourse.join('; ')}`
      : '',
    '',
    '--- Existing topic card (primary scope anchor) ---',
    card.slice(0, 12000) || '(none)',
    '',
    '--- Lecture extracted text (find all material relevant to this topic) ---',
    extracted.slice(0, 55000) || '(empty)',
    '',
    `Domain hint: ${domainHint || 'general'}`
  ]
    .filter(Boolean)
    .join('\n');
}

function validatePromotedStructure(raw, fallbackTitle) {
  if (!raw || !Array.isArray(raw.topics)) return null;

  const topics = [];
  for (const topic of raw.topics) {
    const title = topicExtraction.normalizeTopicLabel(topic.title);
    if (!title || topicExtraction.isStructuralHeading(title)) continue;

    const subtopics = [];
    for (const sub of topic.subtopics || []) {
      const subTitle = topicExtraction.normalizeTopicLabel(sub.title || sub);
      if (!subTitle || topicExtraction.isStructuralHeading(subTitle)) continue;
      if (subtopics.some((s) => topicExtraction.areNearDuplicate(s.title, subTitle))) continue;
      subtopics.push({ title: subTitle });
    }

    if (topics.some((t) => topicExtraction.areNearDuplicate(t.title, title))) continue;
    topics.push({
      title,
      importance: ['core', 'supporting', 'foundation'].includes(topic.importance)
        ? topic.importance
        : 'core',
      subtopics,
      connections: {
        buildsOn: Array.isArray(topic.connections?.buildsOn)
          ? topic.connections.buildsOn.map((x) => String(x).trim()).filter(Boolean).slice(0, 4)
          : [],
        continuesIn: [],
        relatedInCourse: Array.isArray(topic.connections?.relatedInCourse)
          ? topic.connections.relatedInCourse.map((x) => String(x).trim()).filter(Boolean).slice(0, 4)
          : []
      }
    });
    if (topics.length >= MAX_TOPICS) break;
  }

  if (topics.length < MIN_TOPICS) return null;

  const unitTitle =
    topicExtraction.normalizeTopicLabel(raw.unitTitle || fallbackTitle) || fallbackTitle;
  const unitSummary = String(raw.unitSummary || '').trim().slice(0, 2800);
  if (!unitSummary || unitSummary.length < 60) return null;

  const thread = raw.courseThread || {};
  return {
    version: topicExtraction.STRUCTURE_VERSION,
    extractedAt: new Date().toISOString(),
    source: 'promoted',
    lectureTitle: unitTitle,
    lectureSummary: unitSummary,
    topics,
    courseThread: {
      summary: String(thread.summary || '').trim().slice(0, 600),
      continuesFrom: String(thread.continuesFrom || '').trim().slice(0, 280),
      leadsTo: String(thread.leadsTo || '').trim().slice(0, 280),
      positionNote: String(thread.positionNote || '').trim().slice(0, 200)
    }
  };
}

async function extractPromotedUnitStructure(opts) {
  const {
    outputLanguage,
    domainHint,
    courseProfileBlock,
    sourceLectureTitle,
    sourceTopic,
    extracted,
    callLlm
  } = opts;

  const system = buildPromoteStructurePrompt(outputLanguage, domainHint, courseProfileBlock);
  const user = buildPromoteUserPayload({
    sourceLectureTitle,
    sourceTopic,
    extracted,
    domainHint
  });

  let raw = await callLlm(system, user);
  let parsed = parseJsonPayload(raw);
  let candidate = validatePromotedStructure(parsed, sourceTopic.title);
  let normalized = candidate ? lectureNormalize.normalizeStructure(candidate) : null;

  if (!normalized) {
    raw = await callLlm(
      system,
      `${user}\n\nPrevious JSON invalid or too thin. Return valid JSON with at least ${MIN_TOPICS} main topics and granular subtopics for this promoted unit only.`
    );
    parsed = parseJsonPayload(raw);
    candidate = validatePromotedStructure(parsed, sourceTopic.title);
    normalized = candidate ? lectureNormalize.normalizeStructure(candidate) : null;
  }

  if (!normalized) {
    return { ok: false, error: 'Could not build study unit structure' };
  }
  return { ok: true, structure: normalized };
}

module.exports = {
  extractPromotedUnitStructure,
  buildPromoteStructurePrompt
};
