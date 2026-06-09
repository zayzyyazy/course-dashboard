/** Filter and sort card-marker notes shown on subtopic deep cards. */

function matchesMaterial(note, materialMode, exerciseId) {
  const mode = note.materialMode || 'lecture';
  if (mode !== materialMode) return false;
  if (materialMode === 'exercise') {
    return (note.exerciseId || '') === (exerciseId || '');
  }
  return true;
}

function cardMarkersForSubtopic(notes, { topicId, subtopicId, materialMode = 'lecture', exerciseId = '' }) {
  if (!topicId || !subtopicId) return [];
  return (notes || [])
    .filter(
      (n) =>
        Boolean(n.cardMarker) &&
        n.topicId === topicId &&
        n.subtopicId === subtopicId &&
        matchesMaterial(n, materialMode, exerciseId)
    )
    .sort((a, b) => {
      const orderA = Number.isFinite(a.sortIndex) ? a.sortIndex : Number.MAX_SAFE_INTEGER;
      const orderB = Number.isFinite(b.sortIndex) ? b.sortIndex : Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
}

function notesForLinkPicker(notes, { topicId, subtopicId, materialMode = 'lecture', exerciseId = '' }) {
  return (notes || [])
    .filter(
      (n) =>
        !n.cardMarker &&
        n.topicId === topicId &&
        (!subtopicId || n.subtopicId === subtopicId || !n.subtopicId) &&
        matchesMaterial(n, materialMode, exerciseId)
    )
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
}

module.exports = {
  cardMarkersForSubtopic,
  notesForLinkPicker
};
