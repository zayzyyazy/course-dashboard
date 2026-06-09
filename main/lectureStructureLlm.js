/**
 * Per-lecture LLM structure extraction — overwrites structure.json as source of truth.
 */
const fs = require('fs');
const path = require('path');
const topicExtraction = require('./topicExtraction');
const { normalizeDepth } = require('../shared/studyDepth.cjs');

const STRUCTURE_SOURCE = 'llm';
const MAX_MAIN_TOPICS = 6;
const MIN_MAIN_TOPICS = 2;
const MAX_SUBTOPICS = 5;

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function safeReadJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function readMeta(lecturePath) {
  return safeReadJson(path.join(lecturePath, 'meta.json'), {}) || {};
}

function gatherLectureMaterials(lecturePath) {
  const extracted = safeRead(path.join(lecturePath, 'extracted.txt'));
  const concepts = safeRead(path.join(lecturePath, 'concepts.md'));
  const summary = safeRead(path.join(lecturePath, 'summary.md'));
  const overview = safeRead(path.join(lecturePath, 'overview.md'));
  const oldStructure = safeReadJson(path.join(lecturePath, 'structure.json'));
  const legacyStructure = safeReadJson(path.join(lecturePath, 'lecture_structure.json'));

  return { extracted, concepts, summary, overview, oldStructure, legacyStructure };
}

function gatherCourseContext(courseDir, currentLectureId) {
  if (!courseDir || !fs.existsSync(courseDir)) {
    return { courseLabel: '', siblings: [], order: [] };
  }

  const orderPath = path.join(courseDir, 'lecture_order.json');
  const orderData = safeReadJson(orderPath, { lectureIds: [] }) || { lectureIds: [] };
  const order = Array.isArray(orderData.lectureIds) ? orderData.lectureIds : [];

  const folders = fs
    .readdirSync(courseDir)
    .filter((f) => {
      try {
        return fs.statSync(path.join(courseDir, f)).isDirectory();
      } catch {
        return false;
      }
    });

  const sorted = order.length
    ? [...order.filter((id) => folders.includes(id)), ...folders.filter((id) => !order.includes(id))]
    : folders;

  const siblings = sorted.map((id, index) => {
    const lecturePath = path.join(courseDir, id);
    const meta = readMeta(lecturePath);
    const structure = safeReadJson(path.join(lecturePath, 'structure.json'));
    const topicTitles = (structure?.topics || [])
      .map((t) => t.title)
      .filter(Boolean)
      .slice(0, 6);
    return {
      index: index + 1,
      id,
      title: meta.inferredLectureName || id.replace(/_/g, ' '),
      isCurrent: id === currentLectureId,
      topicTitles
    };
  });

  return {
    courseLabel: path.basename(courseDir).replace(/_/g, ' '),
    siblings,
    order: sorted
  };
}

function buildStructureExtractionPrompt(language) {
  return `You are a university study-structure extractor. Output STRICT JSON ONLY (no markdown fences, no commentary).

LANGUAGE: Write all topic labels and courseThread text in ${language}. Match the lecture materials.

TASK: From ONE lecture's source materials, extract a clean study checklist structure for that lecture only.

OUTPUT SHAPE (exact keys):
{
  "lectureTitle": "short lecture name",
  "lectureSummary": "concise structured summary of the whole lecture (120-220 words, markdown allowed sparingly)",
  "topics": [
    {
      "title": "main topic",
      "importance": "core|supporting|foundation",
      "studyDepth": "low|medium|high|examHeavy",
      "subtopics": [{"title": "concrete subtopic", "studyDepth": "low|medium|high|examHeavy"}],
      "connections": {
        "buildsOn": ["topic or lecture idea"],
        "continuesIn": ["topic or lecture idea"],
        "relatedInCourse": ["topic or lecture idea"]
      }
    }
  ],
  "courseThread": {
    "summary": "2-4 sentences: how this lecture fits the course sequence",
    "continuesFrom": "what earlier lecture/topics this builds on",
    "leadsTo": "what later lecture/topics this prepares",
    "positionNote": "optional one short line"
  }
}

TOPIC RULES:
- Extract ONLY real lecture content: concepts, methods, models, procedures, definitions, analyses taught in THIS lecture.
- Prefer 3-${MAX_MAIN_TOPICS} main topics; each with 1-${MAX_SUBTOPICS} subtopics when the material supports it.
- Subtopics must be concrete, learnable checklist items actually covered in the lecture.
- Labels: short (2-8 words), study-usable, no slide noise, no full sentences.
- importance: "core" for central ideas, "supporting" for secondary, "foundation" for prerequisites taught here.

SUBTOPIC RECOGNITION (conservative — do not inflate count):
- Prefer 2-${MAX_SUBTOPICS} subtopics when the lecture clearly breaks a topic into internal parts; 0-1 is fine if the topic is atomic.
- Include a subtopic only when the source: names it as a distinct part, repeats it, explains it beyond a single mention, uses it in an example, walks through a formula/step with it, or treats it as a component of the parent topic.
- Skip: passing mentions, bare slide headers, synonyms of the parent title, overly narrow fragments, decorative labels.
- Subtopic titles: 2-7 words, specific internal unit — not a duplicate of the parent topic.

FOCUS LEVEL (estimate — how much attention you likely need; not exam truth; per topic AND subtopic):
- low: lightly treated; mostly recognition/surface familiarity — do not over-invest time
- medium: should be understood reasonably well; worth studying, but not likely the deepest part
- high: clearly important in the lecture; likely central for understanding and continuation
- examHeavy: likely important for application, exercises, procedures, formulas, calculations, or stronger exam relevance

Signals: space in the lecture, repetition, examples, worked steps, formulas, procedural/operational use, whether later topics build on it.

Be conservative: most items should be low or medium; use high only when importance is clearly established; use examHeavy only when formulas/procedures/calculations/structured steps are central.

Technical subjects (statistics, math, programming, technical digital-media):
- Use examHeavy when the lecture is formula-driven, procedure-heavy, or explicitly operational (e.g. steps/workflows) and this is needed for exercises/solutions.
- Do NOT label light conceptual mentions as examHeavy.

QUANTITATIVE / TECHNICAL LECTURES (statistics, mathematics, programming, quantitative methods):
- When formulas, notation, tests, algorithms, or computation steps are central, they MUST appear in the structure — not only as vague theory.
- Create subtopics for: key formulas/rules, symbol meanings, procedure steps, assumptions + when to use, interpretation of results, worked logic, syntax patterns, or algorithm phases when the lecture teaches them.
- Examples: ANOVA / sums of squares / F-test; set/relation notation; Huffman steps; hypothesis test workflow; regression coefficients; proof sketches; code patterns.
- Do NOT bury computational content under generic labels like "Overview" or "Methods" — name the actual method or formula family.
- Still avoid fake scaffolding headings; each subtopic must be a real teachable unit from the materials.

FORBIDDEN as topics or subtopics (never output these labels):
Fokusthema, Kernthemen, Unterthemen, Unterthemen und Navigation, Aufbau, Typische Fehler, Häufige Fehler,
Voraussetzungen, Voraussetzungen und Anschluss, prerequisites, Objects & methods, Bausteine, Beziehungen,
Concept map, Lecture arc, Build order, review path, practice path, Overview, Zusammenfassung, Agenda,
organizational/admin metadata, lecturer names, semester labels, generic educational buckets.

COURSE THREAD RULES:
- Use the sibling lecture list provided in the user message.
- Mention specific earlier/later lectures by name when relevant.
- Keep summary under 80 words total across courseThread fields.
- Do not invent lectures not listed.

INPUT PRIORITY:
1. extracted.txt (primary)
2. concepts.md (domain naming only)
3. summary.md (weak supplement)
4. Old structure files are UNTRUSTED context only — never copy their headings.

If materials are thin, output fewer but accurate topics rather than generic placeholders.`;
}

function buildUserPayload({ materials, meta, courseContext, currentLectureId }) {
  const lectureTitle = meta.inferredLectureName || currentLectureId.replace(/_/g, ' ');
  const siblingBlock = courseContext.siblings
    .map((s) => {
      const mark = s.isCurrent ? ' [THIS LECTURE]' : '';
      const topics = s.topicTitles.length ? ` | topics: ${s.topicTitles.join('; ')}` : '';
      return `${s.index}. ${s.title} (${s.id})${mark}${topics}`;
    })
    .join('\n');

  const weakContext = [];
  if (materials.legacyStructure?.topics?.length) {
    weakContext.push(
      `Untrusted legacy lecture_structure.json topic hints: ${materials.legacyStructure.topics
        .map((t) => t.title)
        .slice(0, 8)
        .join('; ')}`
    );
  }
  if (materials.oldStructure?.topics?.length) {
    weakContext.push(
      `Untrusted old structure.json (do not copy headings): ${materials.oldStructure.topics
        .map((t) => t.title)
        .slice(0, 8)
        .join('; ')}`
    );
  }

  return [
    `Course folder: ${courseContext.courseLabel}`,
    `This lecture: ${lectureTitle}`,
    `Lecture folder id: ${currentLectureId}`,
    '',
    '--- Sibling lectures in course order (for courseThread connections) ---',
    siblingBlock || '(no siblings listed)',
    '',
    '--- PRIMARY SOURCE: extracted lecture text ---',
    materials.extracted.slice(0, 62000) || '(empty)',
    '',
    '--- SUPPLEMENT: concepts.md (domain terms, not section titles) ---',
    materials.concepts.slice(0, 20000) || '(empty)',
    '',
    '--- SUPPLEMENT: summary.md ---',
    materials.summary.slice(0, 14000) || '(empty)',
    '',
    '--- IGNORE as topic sources: overview.md scaffold ---',
    materials.overview.slice(0, 6000) || '(empty)',
    weakContext.length ? `\n--- Weak context only ---\n${weakContext.join('\n')}` : ''
  ].join('\n');
}

function parseJsonPayload(raw) {
  const text = (raw || '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // fall through to fence / brace slicing
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const payload = fenced ? fenced[1].trim() : text;
  const start = payload.indexOf('{');
  const end = payload.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(payload.slice(start, end + 1));
  } catch {
    return null;
  }
}

function validateAndNormalizeTopics(raw, lectureTitle) {
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
      subtopics.push({
        title: subTitle,
        studyDepth: normalizeDepth(sub.studyDepth)
      });
    }

    if (topics.some((t) => topicExtraction.areNearDuplicate(t.title, title))) continue;
    topics.push({
      title,
      importance: ['core', 'supporting', 'foundation'].includes(topic.importance)
        ? topic.importance
        : 'core',
      studyDepth: normalizeDepth(topic.studyDepth),
      subtopics,
      connections: {
        buildsOn: Array.isArray(topic.connections?.buildsOn)
          ? topic.connections.buildsOn.map((x) => String(x).trim()).filter(Boolean).slice(0, 4)
          : [],
        continuesIn: Array.isArray(topic.connections?.continuesIn)
          ? topic.connections.continuesIn.map((x) => String(x).trim()).filter(Boolean).slice(0, 4)
          : [],
        relatedInCourse: Array.isArray(topic.connections?.relatedInCourse)
          ? topic.connections.relatedInCourse.map((x) => String(x).trim()).filter(Boolean).slice(0, 4)
          : []
      }
    });
    if (topics.length >= MAX_MAIN_TOPICS) break;
  }

  if (topics.length < MIN_MAIN_TOPICS) return null;

  const thread = raw.courseThread || {};
  const courseThread = {
    summary: String(thread.summary || '').trim().slice(0, 600),
    continuesFrom: String(thread.continuesFrom || '').trim().slice(0, 280),
    leadsTo: String(thread.leadsTo || '').trim().slice(0, 280),
    positionNote: String(thread.positionNote || '').trim().slice(0, 200)
  };

  if (!courseThread.summary && !courseThread.continuesFrom && !courseThread.leadsTo) {
    return null;
  }

  const lectureSummary = String(raw.lectureSummary || '').trim().slice(0, 2200);
  if (!lectureSummary || lectureSummary.length < 40) return null;

  return {
    version: topicExtraction.STRUCTURE_VERSION,
    extractedAt: new Date().toISOString(),
    source: STRUCTURE_SOURCE,
    lectureTitle: topicExtraction.normalizeTopicLabel(raw.lectureTitle || lectureTitle) || lectureTitle,
    lectureSummary,
    topics,
    courseThread
  };
}

/**
 * @param {object} opts
 * @param {string} opts.lecturePath
 * @param {string} opts.outputLanguage
 * @param {function} opts.callLlm - async (system, user) => string
 * @param {function} opts.normalizeStructure - from lectureCore
 * @param {function} opts.structureQualityOk
 */
async function extractLectureStructureWithLlm(opts) {
  const { lecturePath, outputLanguage, callLlm, normalizeStructure, structureQualityOk } = opts;
  const materials = gatherLectureMaterials(lecturePath);
  const meta = readMeta(lecturePath);
  const currentLectureId = path.basename(lecturePath);
  const courseDir = path.dirname(lecturePath);
  const courseContext = gatherCourseContext(courseDir, currentLectureId);

  if (
    !materials.extracted.trim() &&
    !materials.concepts.trim() &&
    !materials.summary.trim()
  ) {
    return { ok: false, error: 'No lecture source text (extracted.txt / concepts / summary)' };
  }

  const system = buildStructureExtractionPrompt(outputLanguage);
  const user = buildUserPayload({ materials, meta, courseContext, currentLectureId });

  let raw = await callLlm(system, user);
  let parsed = parseJsonPayload(raw);
  let candidate = validateAndNormalizeTopics(parsed, meta.inferredLectureName || currentLectureId);
  let normalized = candidate ? normalizeStructure(candidate) : null;

  if (!normalized || !structureQualityOk(normalized)) {
    const repairUser = `${user}\n\nYour previous JSON was invalid or too generic. Return ONLY valid JSON matching the schema. Include at least ${MIN_MAIN_TOPICS} real main topics with subtopics and a non-empty courseThread.summary.`;
    raw = await callLlm(system, repairUser);
    parsed = parseJsonPayload(raw);
    candidate = validateAndNormalizeTopics(parsed, meta.inferredLectureName || currentLectureId);
    normalized = candidate ? normalizeStructure(candidate) : null;
  }

  if (!normalized || !structureQualityOk(normalized)) {
    const debug = {
      parsedTopics: parsed?.topics?.map((t) => t.title) || [],
      rawPreview: (raw || '').slice(0, 400),
      hasCandidate: Boolean(candidate),
      qualityOk: normalized ? structureQualityOk(normalized) : false,
      extractedChars: materials.extracted.length
    };
    return {
      ok: false,
      error: 'LLM structure failed validation',
      debug
    };
  }

  return { ok: true, structure: normalized, raw };
}

module.exports = {
  STRUCTURE_SOURCE,
  gatherLectureMaterials,
  gatherCourseContext,
  buildStructureExtractionPrompt,
  buildUserPayload,
  parseJsonPayload,
  validateAndNormalizeTopics,
  extractLectureStructureWithLlm
};
