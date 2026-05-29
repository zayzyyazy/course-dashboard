const fs = require('fs');
const path = require('path');
const topicExtraction = require('./topicExtraction');
const { parseJsonPayload } = require('./lectureStructureLlm');

const MAX_TOPICS = 8;
const MIN_TOPICS = 2;

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function gatherExerciseMaterials(lecturePath) {
  return {
    extracted: safeRead(path.join(lecturePath, 'exercise_extracted.txt'))
  };
}

function buildExerciseStructurePrompt(language) {
  return `You are a university exercise/practice-sheet structure extractor (Übungen, Übungsblatt, practice problems). Output STRICT JSON ONLY.

LANGUAGE: ${language}

TASK: From exercise/practice materials, extract what students must DO — not a second lecture summary.

OUTPUT SHAPE:
{
  "exerciseTitle": "short name for this exercise set",
  "exerciseSummary": "80-160 words: what this sheet trains, problem types, expected application level",
  "topics": [
    {
      "title": "practice cluster (2-8 words)",
      "importance": "core|supporting|foundation",
      "practiceFocus": "what skill is trained here",
      "problemTypes": ["concrete problem type from source"],
      "procedures": ["calculation/step/procedure actually used"],
      "subtopics": [{"title": "concrete task or example type"}]
    }
  ]
}

RULES — SOURCE-GROUNDED, OPERATIONAL:
- Topics = clusters of practice (problem families, exercise sections, task types) from the material.
- Prefer ${MIN_TOPICS}-${MAX_TOPICS} topics. Each needs 1-4 subtopics naming real tasks/examples/steps from the sheet.
- problemTypes & procedures: short phrases from the source (e.g. "compute F statistic", "interpret interaction", "Huffman encoding steps").
- Include formulas, notation, and computation steps IN titles/subtopics when the exercise uses them — do not abstract away math/stats/CS procedure.
- examDepthNote optional in exerciseSummary: what level of application seems expected (compute / interpret / prove / implement).
- Do NOT invent theory not in the exercise. Do NOT output generic buckets (Overview, Introduction, Practice).
- Stay close to wording and examples in the source.

FORBIDDEN labels: Overview, Zusammenfassung, Kernthemen, Exercise 1, Aufgabe (alone), generic theory-only headings without a concrete practice angle.`;
}

function buildUserPayload({ materials, lectureTitle, lectureTopics }) {
  const lectureTopicList = (lectureTopics || [])
    .map((t, i) => `${i + 1}. ${t.title}`)
    .join('\n');

  return [
    `Lecture this exercise belongs to: ${lectureTitle}`,
    '',
    'Lecture topics (for mental alignment only — do not copy as exercise topics):',
    lectureTopicList || '(none)',
    '',
    '--- PRIMARY: exercise / practice source text ---',
    materials.extracted.slice(0, 62000) || '(empty)'
  ].join('\n');
}

function validateExerciseStructure(raw) {
  if (!raw || !Array.isArray(raw.topics)) return null;
  const topics = raw.topics
    .map((t, i) => {
      const title = topicExtraction.normalizeTopicLabel(t.title);
      if (!title) return null;
      return {
        title,
        importance: ['core', 'supporting', 'foundation'].includes(t.importance) ? t.importance : 'core',
        practiceFocus: String(t.practiceFocus || '').trim().slice(0, 300),
        problemTypes: (t.problemTypes || []).map((p) => String(p).trim()).filter(Boolean).slice(0, 6),
        procedures: (t.procedures || []).map((p) => String(p).trim()).filter(Boolean).slice(0, 6),
        subtopics: (t.subtopics || [])
          .map((s, si) => ({
            id: `ex-sub-${i}-${si}`,
            title: topicExtraction.normalizeTopicLabel(s.title)
          }))
          .filter((s) => s.title)
          .slice(0, 5)
      };
    })
    .filter(Boolean);

  if (topics.length < MIN_TOPICS) return null;

  return {
    exerciseTitle: String(raw.exerciseTitle || 'Übung').trim().slice(0, 120),
    exerciseSummary: String(raw.exerciseSummary || '').trim().slice(0, 2500),
    topics
  };
}

async function extractExerciseStructureWithLlm({
  lecturePath,
  lectureTitle,
  lectureTopics,
  outputLanguage,
  callLlm
}) {
  const materials = gatherExerciseMaterials(lecturePath);
  if (!materials.extracted?.trim()) {
    return { ok: false, error: 'Exercise text is empty' };
  }

  const system = buildExerciseStructurePrompt(outputLanguage);
  const user = buildUserPayload({ materials, lectureTitle, lectureTopics });

  let raw = await callLlm(system, user);
  let parsed = parseJsonPayload(raw);
  let structure = validateExerciseStructure(parsed);

  if (!structure) {
    raw = await callLlm(
      system,
      `${user}\n\nInvalid JSON. Return exercise topics grounded in problem types and procedures from the source.`
    );
    parsed = parseJsonPayload(raw);
    structure = validateExerciseStructure(parsed);
  }

  if (!structure) {
    return { ok: false, error: 'Exercise structure extraction failed' };
  }
  return { ok: true, structure };
}

module.exports = {
  gatherExerciseMaterials,
  extractExerciseStructureWithLlm
};
