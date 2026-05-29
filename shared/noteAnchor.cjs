/**
 * Stable section anchors for note routing (math-safe heading slugs).
 */

const { normalizeForCompare } = require('./noteListMeta.cjs');

const MATH_SYMBOL_MAP = [
  [/∪/g, ' union '],
  [/∩/g, ' intersection '],
  [/∖/g, ' minus '],
  [/\\setminus/gi, ' minus '],
  [/×/g, ' times '],
  [/→/g, ' arrow '],
  [/≤|≥|≠/g, ' '],
  [/∅/g, ' emptyset '],
  [/ℕ|ℤ|ℚ|ℝ/g, ' ']
];

function stripForAnchor(text) {
  let s = String(text || '');
  for (const [re, rep] of MATH_SYMBOL_MAP) {
    s = s.replace(re, rep);
  }
  return s
    .replace(/\$[^$]+\$/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/[#*_>`[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Stable anchor slug from a heading line (distinct for ∪ vs ∩ etc.). */
function headingToAnchor(title) {
  const base = normalizeForCompare(stripForAnchor(title));
  if (!base) return '';
  return base
    .split(' ')
    .filter(Boolean)
    .slice(0, 12)
    .join('-')
    .slice(0, 64);
}

function parseH3Sections(markdown) {
  const text = String(markdown || '');
  if (!text.trim()) return [];

  const lines = text.split('\n');
  const sections = [];
  let current = null;

  for (const line of lines) {
    const m = line.match(/^###\s+(.+?)\s*$/);
    if (m) {
      if (current?.title) sections.push(current);
      const title = m[1].trim();
      current = {
        title,
        anchor: headingToAnchor(title),
        body: ''
      };
      continue;
    }
    if (current) {
      current.body += `${line}\n`;
    }
  }
  if (current?.title) sections.push(current);
  return sections;
}

function overlapScore(needle, haystack) {
  const n = normalizeForCompare(needle);
  const h = normalizeForCompare(haystack);
  if (!n || !h) return 0;
  if (h.includes(n) || n.includes(h.slice(0, Math.min(n.length, 80)))) return 1;
  const nWords = n.split(' ').filter((w) => w.length > 3);
  if (!nWords.length) return 0;
  let hits = 0;
  for (const w of nWords) {
    if (h.includes(w)) hits += 1;
  }
  return hits / nWords.length;
}

/**
 * Find which ### section a highlight belongs to inside topic card markdown.
 */
function findSectionAnchorInMarkdown(markdown, selectedText) {
  const sections = parseH3Sections(markdown);
  if (!sections.length) return '';

  const needle = stripForAnchor(selectedText).slice(0, 200);
  if (!needle) return '';

  let best = '';
  let bestScore = 0;
  for (const sec of sections) {
    const body = stripForAnchor(sec.body);
    const score = Math.max(overlapScore(needle, body), overlapScore(needle, sec.title) * 0.85);
    if (score > bestScore) {
      bestScore = score;
      best = sec.anchor;
    }
  }

  return bestScore >= 0.2 ? best : '';
}

function subtopicAnchor(subtopic) {
  if (!subtopic) return '';
  if (subtopic.id) return `sub-${subtopic.id}`;
  return headingToAnchor(subtopic.title);
}

function buildNoteRoutingKey({
  lecturePath,
  topicId,
  subtopicId,
  sectionAnchor,
  sourceKind,
  materialMode,
  exerciseId
}) {
  const parts = [
    lecturePath || '',
    topicId || '',
    subtopicId || '',
    sectionAnchor || '',
    sourceKind || ''
  ];
  if (materialMode === 'exercise') {
    parts.push(exerciseId || 'exsheet_legacy');
  }
  return parts.join('|');
}

function resolveSaveAnchors({
  source,
  sourceKind,
  markdownSource,
  highlightedText,
  subtopic,
  topicId
}) {
  const sub = subtopic || null;
  const subtopicId = sub?.id || '';
  const subtopicTitle = sub?.title || '';

  let sectionAnchor = '';
  let kind = sourceKind || source || 'topic-summary';

  if (source === 'deep' && sub) {
    kind = 'deeper-subtopic';
    sectionAnchor = subtopicAnchor(sub);
  } else if (source === 'card' || kind === 'topic-summary') {
    kind = 'topic-summary';
    sectionAnchor = findSectionAnchorInMarkdown(markdownSource, highlightedText);
    if (!sectionAnchor && subtopicId) {
      sectionAnchor = subtopicAnchor(sub);
    }
  } else if (source === 'noteChat') {
    kind = 'note-study';
  } else if (source === 'tutorChat') {
    kind = 'tutor-chat';
  }

  return {
    sectionAnchor,
    subtopicId,
    subtopicTitle,
    sourceKind: kind,
    routingKey: buildNoteRoutingKey({
      lecturePath: '',
      topicId: topicId || '',
      subtopicId,
      sectionAnchor,
      sourceKind: kind
    })
  };
}

module.exports = {
  headingToAnchor,
  parseH3Sections,
  findSectionAnchorInMarkdown,
  subtopicAnchor,
  buildNoteRoutingKey,
  resolveSaveAnchors
};
