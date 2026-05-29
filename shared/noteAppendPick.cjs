/**
 * Pick an existing note to append — strict local bucket by sectionAnchor / subtopic.
 */

const { findRelevantNotes } = require('./noteRelevance.cjs');
const { headingToAnchor } = require('./noteAnchor.cjs');

const APPEND_MIN_SCORE_SAME_BUCKET = 0.55;

function sameBucket(note, context) {
  const {
    topicId,
    subtopicId,
    sectionAnchor,
    sourceKind
  } = context;

  if (topicId && note.topicId && note.topicId !== topicId) return false;

  if (sectionAnchor) {
    if (note.sectionAnchor === sectionAnchor) return true;
    const subFromAnchor = sectionAnchor.startsWith('sub-') ? sectionAnchor.slice(4) : '';
    if (subFromAnchor && note.subtopicId === subFromAnchor) return true;
    return false;
  }

  if (sourceKind === 'deeper-subtopic' && subtopicId) {
    return note.subtopicId === subtopicId;
  }

  if (subtopicId && note.subtopicId) {
    return note.subtopicId === subtopicId;
  }

  if (sourceKind === 'topic-summary' && !sectionAnchor && !subtopicId) {
    return !note.sectionAnchor && !note.subtopicId;
  }

  return false;
}

function pickWithinBucket(pool, highlight, topicId) {
  if (!pool.length) return null;
  if (pool.length === 1) return pool[0];

  const relevant = findRelevantNotes(pool, highlight, {
    topicId: topicId || '',
    limit: 1,
    minScore: APPEND_MIN_SCORE_SAME_BUCKET
  });
  if (relevant.length) {
    const hit = pool.find((n) => n.id === relevant[0].id);
    if (hit) return hit;
  }

  return [...pool].sort(
    (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
  )[0];
}

/**
 * @param {object[]} notes
 * @param {string} highlight
 * @param {object} context
 */
function pickNoteToAppend(notes, highlight, context = {}) {
  if (!notes?.length || !String(highlight || '').trim()) return null;

  const {
    noteId,
    topicId,
    subtopicId,
    sectionAnchor,
    sourceKind
  } = context;

  if (noteId) {
    const exact = notes.find((n) => n.id === noteId);
    if (exact) return exact;
  }

  if (!topicId && !sectionAnchor && !subtopicId) {
    return null;
  }

  let pool = notes;
  if (topicId) {
    pool = pool.filter((n) => n.topicId === topicId);
    if (!pool.length) return null;
  }

  const bucket = pool.filter((n) => sameBucket(n, context));
  if (!bucket.length) {
    return null;
  }

  return pickWithinBucket(bucket, highlight, topicId);
}

module.exports = {
  pickNoteToAppend,
  APPEND_MIN_SCORE_SAME_BUCKET,
  headingToAnchor,
  sameBucket
};
