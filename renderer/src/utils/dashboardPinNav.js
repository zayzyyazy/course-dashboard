/**
 * Build navigation payload for App.handleDashboardNavigate from a dashboard pin row.
 */
export function pinToNavTarget(pin) {
  if (!pin?.courseId || !pin?.lectureId) return null;

  const base = {
    courseId: pin.courseId,
    lectureId: pin.lectureId,
    itemType: pin.itemType || 'lecture'
  };

  if (pin.type === 'note') {
    return {
      ...base,
      noteId: pin.id,
      topicId: pin.topicId || null,
      materialMode: pin.materialMode || 'lecture',
      exerciseId: pin.exerciseId || ''
    };
  }

  if (pin.type === 'topic' || pin.type === 'subtopic') {
    return {
      ...base,
      topicId: pin.topicId,
      subtopicId: pin.type === 'subtopic' ? pin.subtopicId : null,
      materialMode: pin.materialMode || 'lecture',
      exerciseId: pin.exerciseId || ''
    };
  }

  return base;
}
