/**
 * Lightweight keyword + concept relevance for saved lecture notes (no vector DB).
 * Prioritizes note body content over titles.
 */

const { normalizeForCompare, stripMarkdown } = require('./noteListMeta.cjs');

const CONCEPT_PATTERNS = [
  { key: 'eta', re: /\beta|eta[\s²2^]?|effektgr|effect size|cohen/i },
  { key: 'omega', re: /omega[\s²2^]?/i },
  { key: 'ss', re: /ssbetween|sswithin|ss[\s_-]?total|quadratsumme|sum of squares/i },
  { key: 'f-test', re: /\bf[\s-]?test|f-wert|f-statistic/i },
  { key: 'anova', re: /anova|varianzanalyse/i },
  { key: 'interpret', re: /interpret|bedeutung|threshold|schwellen/i },
  { key: 'formula', re: /formel|formula|berechnen|calculate|gleichung|equation|symbol/i },
  { key: 'difference', re: /difference|unterschied|versus| vs |compared to|gegenüber/i }
];

const STOP = new Set([
  'the',
  'and',
  'for',
  'that',
  'this',
  'what',
  'why',
  'how',
  'does',
  'mean',
  'with',
  'from',
  'about',
  'when',
  'where',
  'which',
  'have',
  'has',
  'are',
  'was',
  'were',
  'can',
  'you',
  'your',
  'ist',
  'das',
  'die',
  'der',
  'und',
  'für',
  'was',
  'wie',
  'warum',
  'eine',
  'ein',
  'den',
  'dem',
  'des',
  'sich',
  'nicht',
  'auch',
  'oder',
  'bei',
  'zum',
  'zur',
  'exactly',
  'really',
  'better',
  'than',
  'between',
  'within'
]);

function tokenSet(text) {
  const n = normalizeForCompare(stripMarkdown(text));
  if (!n) return new Set();
  return new Set(
    n
      .split(' ')
      .filter((w) => w.length > 2 && !STOP.has(w))
  );
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

function conceptKeysInText(text) {
  const blob = String(text || '');
  const keys = [];
  for (const p of CONCEPT_PATTERNS) {
    if (p.re.test(blob)) keys.push(p.key);
  }
  return keys;
}

function noteBodyText(note) {
  return stripMarkdown(
    [
      note.refinedNote || '',
      note.note || '',
      (note.studyAdditions || []).map((a) => a.content).join('\n')
    ].join('\n')
  ).slice(0, 4000);
}

function noteMetaText(note) {
  return [
    (note.keyIdeas || []).join(' '),
    stripMarkdown(note.highlightedText),
    note.preview || ''
  ]
    .filter(Boolean)
    .join(' ');
}

function countTokenHits(qTokens, targetTokens) {
  let hits = 0;
  for (const w of qTokens) {
    if (w.length >= 4 && targetTokens.has(w)) hits += 1;
  }
  return hits;
}

function bodyPhraseBoost(question, bodyPlain) {
  const qWords = normalizeForCompare(stripMarkdown(question))
    .split(' ')
    .filter((w) => w.length > 3 && !STOP.has(w));
  if (qWords.length < 2) return 0;
  const body = normalizeForCompare(bodyPlain);
  let boost = 0;
  for (let i = 0; i < qWords.length - 1; i += 1) {
    const pair = `${qWords[i]} ${qWords[i + 1]}`;
    if (body.includes(pair)) boost += 0.12;
  }
  const longTerms = qWords.filter((w) => w.length >= 6);
  for (const term of longTerms) {
    if (body.includes(term)) boost += 0.08;
  }
  return Math.min(boost, 0.35);
}

function scoreNoteForQuestion(note, question, { topicId, materialMode } = {}) {
  const qTokens = tokenSet(question);
  if (!qTokens.size) return 0;

  const bodyPlain = noteBodyText(note);
  const bodyTokens = tokenSet(bodyPlain);
  const metaTokens = tokenSet(noteMetaText(note));
  const titleTokens = tokenSet(note.title || '');

  const bodyJaccard = jaccard(qTokens, bodyTokens);
  const metaJaccard = jaccard(qTokens, metaTokens);
  const titleJaccard = jaccard(qTokens, titleTokens);

  let score = bodyJaccard * 0.72 + metaJaccard * 0.2 + titleJaccard * 0.08;

  const bodyHits = countTokenHits(qTokens, bodyTokens);
  score += Math.min(bodyHits * 0.06, 0.3);
  score += bodyPhraseBoost(question, bodyPlain);

  const qConcepts = conceptKeysInText(question);
  const bodyConcepts = conceptKeysInText(bodyPlain);
  const conceptOverlap = qConcepts.filter((c) => bodyConcepts.includes(c)).length;
  if (conceptOverlap) score += 0.2 + (conceptOverlap - 1) * 0.08;

  if (topicId && note.topicId === topicId) {
    score *= 1.35;
  } else if (topicId && note.topicId) {
    score *= 0.65;
  }

  if (materialMode && note.materialMode === materialMode) {
    score *= 1.03;
  }

  const hasBodySignal =
    bodyJaccard >= 0.06 ||
    bodyHits >= 2 ||
    bodyPhraseBoost(question, bodyPlain) >= 0.12 ||
    conceptOverlap > 0;

  if (!hasBodySignal) {
    score *= 0.35;
  }

  return score;
}

function matchReason(note, question, topicId) {
  const bodyPlain = noteBodyText(note);
  const sameTopic = topicId && note.topicId === topicId;
  const concepts = conceptKeysInText(question).filter((c) => conceptKeysInText(bodyPlain).includes(c));
  if (sameTopic && concepts.length) return `Your note covers this · ${concepts[0]}`;
  if (sameTopic && bodyPhraseBoost(question, bodyPlain) >= 0.12) return 'Your note answers this';
  if (sameTopic) return 'Saved on this topic';
  if (concepts.length) return `Note explains · ${concepts[0]}`;
  if (bodyPhraseBoost(question, bodyPlain) >= 0.12) return 'Note content matches your question';
  return 'Related note content';
}

function toPublicNote(note, score, reason, topicId) {
  const bodyPreview = stripMarkdown(noteBodyText(note)).slice(0, 160);
  return {
    id: note.id,
    title: note.title || note.topicTitle || 'Saved note',
    preview: bodyPreview || (note.preview || '').slice(0, 160),
    topicId: note.topicId || '',
    topicTitle: note.topicTitle || '',
    materialMode: note.materialMode || 'lecture',
    score: Math.round(score * 100) / 100,
    reason,
    sameTopic: Boolean(topicId && note.topicId === topicId)
  };
}

/**
 * @param {object[]} notes
 * @param {string} question
 * @param {{ topicId?: string, materialMode?: string, limit?: number, excludeNoteId?: string, minScore?: number }} opts
 */
function findRelevantNotes(notes, question, opts = {}) {
  const {
    topicId = '',
    materialMode = '',
    limit = 2,
    excludeNoteId = '',
    minScore = 0.24
  } = opts;

  const q = String(question || '').trim();
  if (!q || !Array.isArray(notes) || !notes.length) return [];

  const candidates = notes.filter((n) => n.id && n.id !== excludeNoteId);

  const ranked = candidates
    .map((note) => {
      const score = scoreNoteForQuestion(note, q, { topicId, materialMode });
      return { note, score, reason: matchReason(note, q, topicId) };
    })
    .filter((x) => x.score >= minScore)
    .sort((a, b) => b.score - a.score);

  const picked = [];
  const seenTitles = new Set();
  for (const row of ranked) {
    const titleKey = normalizeForCompare(row.note.title || row.note.topicTitle);
    if (titleKey && seenTitles.has(titleKey)) continue;
    if (titleKey) seenTitles.add(titleKey);
    picked.push(toPublicNote(row.note, row.score, row.reason, topicId));
    if (picked.length >= limit) break;
  }

  return picked;
}

function buildRelevantNotesContextBlock(relevantNotes, language = 'English') {
  if (!relevantNotes?.length) return '';
  const de = language === 'German' || language === 'de';
  const lines = relevantNotes.map((n, i) => {
    const scope = n.sameTopic
      ? de
        ? 'gleiches Thema'
        : 'same topic'
      : n.topicTitle
        ? de
          ? `Thema: ${n.topicTitle}`
          : `topic: ${n.topicTitle}`
        : de
          ? 'gleiche Vorlesung'
          : 'same lecture';
    const fallback = de ? 'gespeicherte Notiz' : 'saved note';
    return `${i + 1}. „${n.title}" (${scope}) — ${n.preview || fallback}`;
  });
  if (de) {
    return [
      'GESPEICHERTE NOTIZEN (Student hat diese schon — nur referenzieren, NICHT wörtlich kopieren):',
      ...lines,
      '',
      'Wenn eine Notiz die Frage klar beantwortet: mit EINEM kurzen Satz darauf hinweisen, dann kurz in anderen Worten erklären. Notiztext nicht wiederholen. Antwort auf Deutsch.'
    ].join('\n');
  }
  return [
    'SAVED NOTES (student already wrote these — reference only, do NOT copy wording):',
    ...lines,
    '',
    'If a saved note clearly answers the question: open with ONE short sentence pointing them to it (e.g. you already saved a note on this), then give a brief fresh clarification in different words. Do not repeat the note body.'
  ].join('\n');
}

module.exports = {
  findRelevantNotes,
  buildRelevantNotesContextBlock,
  scoreNoteForQuestion
};
