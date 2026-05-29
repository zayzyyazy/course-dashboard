/**
 * Match lecture subtopics ↔ exercise subtopics (same lecture unit first).
 */

const { normalizeForCompare, stripMarkdown } = require('./noteListMeta.cjs');

const CONCEPT_PATTERNS = [
  { key: 'f-test', re: /\bf[\s-]?test|f-wert|f-statistic|f-statistik/i },
  { key: 'anova', re: /anova|varianzanalyse/i },
  { key: 'eta', re: /\beta|eta[\s²2^]?|effektgr|effect size/i },
  { key: 'omega', re: /omega[\s²2^]?/i },
  { key: 'ss', re: /ssbetween|sswithin|quadratsumme|sum of squares|variance decomposition/i },
  { key: 'huffman', re: /huffman|prefix.*code|codierung/i },
  { key: 'sampling', re: /abtast|sampling|nyquist|frequenz/i },
  { key: 'sets', re: /mengen|union|intersection|venn|∩|∪/i },
  { key: 'formula', re: /formel|formula|gleichung|equation|berechnen|compute/i },
  { key: 'regression', re: /regression|korrelation|linear model/i },
  { key: 'probability', re: /wahrscheinlichkeit|probability|verteilung|distribution/i }
];

const STOP = new Set([
  'the',
  'and',
  'for',
  'that',
  'this',
  'what',
  'with',
  'from',
  'about',
  'how',
  'why',
  'does',
  'ist',
  'das',
  'die',
  'der',
  'und',
  'für',
  'eine',
  'ein',
  'topic',
  'subtopic',
  'übung',
  'exercise',
  'practice',
  'aufgabe'
]);

const MIN_SCORE = 0.27;

function tokenSet(text) {
  const n = normalizeForCompare(stripMarkdown(text));
  if (!n) return new Set();
  return new Set(n.split(' ').filter((w) => w.length > 2 && !STOP.has(w)));
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

function conceptKeys(text) {
  const blob = String(text || '');
  const keys = [];
  for (const p of CONCEPT_PATTERNS) {
    if (p.re.test(blob)) keys.push(p.key);
  }
  return keys;
}

function lectureSubBlob(sub, topic) {
  return [topic?.title, sub?.title, sub?.summary].filter(Boolean).join(' ');
}

function getExerciseSheetList(lecture) {
  if (Array.isArray(lecture?.exercises) && lecture.exercises.length) {
    return lecture.exercises;
  }
  if (lecture?.exercise?.topics?.length || lecture.exercise?.exerciseSummary) {
    return [{ ...lecture.exercise, id: lecture.exercise.id || 'exsheet_legacy' }];
  }
  return [];
}

function buildExerciseSubtopicIndex(lecture) {
  const rows = [];
  for (const sheet of getExerciseSheetList(lecture)) {
    const exerciseId = sheet.id || 'exsheet_legacy';
    for (const exTopic of sheet.topics || []) {
    const subs = exTopic.subtopics || [];
    if (!subs.length) {
      rows.push({
        exerciseId,
        exerciseTopicId: exTopic.id,
        exerciseTopicTitle: exTopic.title,
        exerciseSubtopicId: '',
        exerciseSubtopicTitle: exTopic.title,
        blob: [
          exTopic.title,
          exTopic.practiceFocus,
          (exTopic.procedures || []).join(' '),
          (exTopic.problemTypes || []).join(' ')
        ].join(' '),
        linkedLectureTopicId: exTopic.lectureLink?.lectureTopicId || ''
      });
      continue;
    }
    for (const sub of subs) {
      rows.push({
        exerciseId,
        exerciseTopicId: exTopic.id,
        exerciseTopicTitle: exTopic.title,
        exerciseSubtopicId: sub.id,
        exerciseSubtopicTitle: sub.title,
        blob: [
          exTopic.title,
          sub.title,
          exTopic.practiceFocus,
          (exTopic.procedures || []).join(' '),
          (exTopic.problemTypes || []).join(' ')
        ].join(' '),
        linkedLectureTopicId: exTopic.lectureLink?.lectureTopicId || ''
      });
    }
    }
  }
  return rows;
}

function buildTopicLinkMaps(lecture) {
  const lectureToExercise = new Map();
  const exerciseToLecture = new Map();
  for (const sheet of getExerciseSheetList(lecture)) {
    for (const link of sheet.lectureLinks || []) {
      if (link.lectureTopicId && link.exerciseTopicId) {
        lectureToExercise.set(link.lectureTopicId, link.exerciseTopicId);
        exerciseToLecture.set(link.exerciseTopicId, link.lectureTopicId);
      }
    }
    for (const exTopic of sheet.topics || []) {
      const lid = exTopic.lectureLink?.lectureTopicId;
      if (lid && exTopic.id) {
        lectureToExercise.set(lid, exTopic.id);
        exerciseToLecture.set(exTopic.id, lid);
      }
    }
  }
  return { lectureToExercise, exerciseToLecture };
}

function scorePair(lectureBlob, exerciseRow, { lectureTopicId, preferredExerciseTopicId } = {}) {
  const lTokens = tokenSet(lectureBlob);
  const eTokens = tokenSet(exerciseRow.blob);
  if (!lTokens.size || !eTokens.size) return 0;

  let score = jaccard(lTokens, eTokens);

  let hits = 0;
  for (const w of lTokens) {
    if (w.length >= 4 && eTokens.has(w)) hits += 1;
  }
  score += Math.min(hits * 0.065, 0.32);

  const lConcepts = conceptKeys(lectureBlob);
  const eConcepts = conceptKeys(exerciseRow.blob);
  const overlap = lConcepts.filter((c) => eConcepts.includes(c)).length;
  if (overlap) score += 0.16 + (overlap - 1) * 0.09;

  const lNorm = normalizeForCompare(stripMarkdown(lectureBlob));
  const eTitle = normalizeForCompare(exerciseRow.exerciseSubtopicTitle);
  if (eTitle.length >= 5 && lNorm.includes(eTitle)) score += 0.22;
  if (eTitle.length >= 5) {
    const eWords = eTitle.split(' ').filter((w) => w.length > 4);
    for (const w of eWords) {
      if (lNorm.includes(w)) score += 0.05;
    }
  }

  if (preferredExerciseTopicId && exerciseRow.exerciseTopicId === preferredExerciseTopicId) {
    score *= 1.45;
  } else if (preferredExerciseTopicId) {
    score *= 0.62;
  }

  if (lectureTopicId && exerciseRow.linkedLectureTopicId === lectureTopicId) {
    score *= 1.35;
  }

  return score;
}

function buildLinkNote(lectureSubTitle, exerciseRow, relation) {
  const exLabel = exerciseRow.exerciseSubtopicTitle || exerciseRow.exerciseTopicTitle;
  if (relation === 'applies') {
    return `This Übung applies “${exLabel}” to the lecture concept.`;
  }
  if (relation === 'computes') {
    return `Practice sheet works through calculations for “${exLabel}” (from “${lectureSubTitle}”).`;
  }
  if (relation === 'exam-style') {
    return `Exam-style tasks on “${exLabel}” — operational version of this subtopic.`;
  }
  return `Related practice: “${exLabel}” trains what you saw in “${lectureSubTitle}”.`;
}

function inferRelation(lectureBlob, exerciseRow) {
  const blob = `${lectureBlob} ${exerciseRow.blob}`.toLowerCase();
  if (/compute|calculate|berechnen|rechnen|formula|formel/.test(blob)) return 'computes';
  if (/interpret|bedeutung|explain|erklären/.test(blob)) return 'applies';
  if (/exam|klausur|test|aufgabe|problem/.test(blob)) return 'exam-style';
  return 'practices';
}

function findBestExerciseLink(sub, topic, index, { preferredExerciseTopicId, lectureTopicId } = {}) {
  const lectureBlob = lectureSubBlob(sub, topic);
  let best = null;

  for (const row of index) {
    const score = scorePair(lectureBlob, row, { lectureTopicId, preferredExerciseTopicId });
    if (!best || score > best.score) {
      best = { row, score };
    }
  }

  if (!best || best.score < MIN_SCORE) return null;

  const relation = inferRelation(lectureBlob, best.row);
  return {
    exerciseId: best.row.exerciseId || '',
    exerciseTopicId: best.row.exerciseTopicId,
    exerciseSubtopicId: best.row.exerciseSubtopicId || best.row.exerciseTopicId,
    exerciseTopicTitle: best.row.exerciseTopicTitle,
    exerciseSubtopicTitle: best.row.exerciseSubtopicTitle || best.row.exerciseTopicTitle,
    relation,
    note: buildLinkNote(sub.title, best.row, relation)
  };
}

function linksEqual(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.exerciseId === b.exerciseId &&
    a.exerciseTopicId === b.exerciseTopicId &&
    a.exerciseSubtopicId === b.exerciseSubtopicId &&
    a.note === b.note
  );
}

/**
 * Attach exerciseLink on lecture subtopics when exercise material exists.
 * @returns {{ changed: boolean, linksCount: number }}
 */
function applySubtopicExerciseLinks(lecture) {
  const hasExercise = getExerciseSheetList(lecture).some((s) => (s.topics?.length || 0) > 0);
  if (!hasExercise || !lecture?.topics?.length) {
    return { changed: false, linksCount: 0 };
  }

  const index = buildExerciseSubtopicIndex(lecture);
  if (!index.length) return { changed: false, linksCount: 0 };

  const { lectureToExercise } = buildTopicLinkMaps(lecture);
  let changed = false;
  let linksCount = 0;

  for (const topic of lecture.topics) {
    const preferredExerciseTopicId = lectureToExercise.get(topic.id) || '';
    for (const sub of topic.subtopics || []) {
      const link = findBestExerciseLink(sub, topic, index, {
        preferredExerciseTopicId,
        lectureTopicId: topic.id
      });
      const prev = sub.exerciseLink;
      if (link) {
        linksCount += 1;
        if (!linksEqual(prev, link)) {
          sub.exerciseLink = link;
          changed = true;
        }
      } else if (prev) {
        delete sub.exerciseLink;
        changed = true;
      }
    }
  }

  return { changed, linksCount };
}

module.exports = {
  applySubtopicExerciseLinks,
  buildExerciseSubtopicIndex,
  findBestExerciseLink,
  MIN_SCORE
};
