/** Focus/depth estimate — how much attention this likely needs (not exam truth). */

// Canonical tokens used in the UI + saved lecture JSON:
// low | medium | high | examHeavy
const VALID = new Set(['low', 'medium', 'high', 'examHeavy']);

const LABELS = {
  low: 'Low focus',
  medium: 'Medium focus',
  high: 'High focus',
  examHeavy: 'Exam-heavy'
};

const SHORT = {
  low: 'Lightly treated · surface familiarity',
  medium: 'Understood reasonably well · worth studying',
  high: 'Central in lecture · likely important',
  examHeavy: 'Procedures/forms/calculations · strong exam relevance'
};

function normalizeDepth(value) {
  const raw = String(value || '').trim();
  const d = raw.toLowerCase();

  // Legacy compatibility
  if (d === 'explain') return 'medium';
  if (d === 'recognize') return 'low';
  if (d === 'understand') return 'medium';
  if (d === 'apply') return 'high';
  if (d === 'calculate') return 'examHeavy';

  // New focus tokens (a few tolerant spellings)
  if (d === 'low' || d === 'lowfocus' || d === 'low_focus') return 'low';
  if (d === 'medium' || d === 'med' || d === 'mediumfocus' || d === 'medium_focus') return 'medium';
  if (d === 'high' || d === 'highfocus' || d === 'high_focus') return 'high';
  if (
    d === 'exam-heavy' ||
    d === 'examheavy' ||
    d === 'exam_heavy' ||
    d === 'exam heavy' ||
    d === 'exam'
  ) {
    return 'examHeavy';
  }

  return VALID.has(d) ? d : null;
}

function fallbackDepth(importance) {
  if (importance === 'foundation') return 'low';
  if (importance === 'supporting') return 'medium';
  if (importance === 'core') return 'high';
  return 'medium';
}

function resolveDepth(item, parentImportance) {
  const direct = normalizeDepth(item?.studyDepth);
  if (direct) return direct;
  return fallbackDepth(item?.importance || parentImportance);
}

module.exports = {
  VALID,
  LABELS,
  SHORT,
  normalizeDepth,
  fallbackDepth,
  resolveDepth
};
