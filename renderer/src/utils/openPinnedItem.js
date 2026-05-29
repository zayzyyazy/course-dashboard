import { getMaterialTopics } from './lectureMaterial';

/**
 * Resolve navigation for a bookmark pin (lecture/topic/subtopic/note).
 * Returns { action, mode, topic, subtopicId, note } — caller applies setState / routing.
 */
export function resolvePinnedNavigation(pin, { lecture, notes = [] }) {
  if (!pin || !lecture) return null;

  if (pin.type === 'note') {
    const note = notes.find((n) => n.id === pin.id);
    if (!note) return null;
    return {
      action: 'note',
      note,
      mode: pin.materialMode || note.materialMode || 'lecture'
    };
  }

  if (pin.type === 'lecture' || pin.type === 'study-unit') {
    return { action: 'stay-lecture' };
  }

  if (pin.type === 'topic' || pin.type === 'subtopic') {
    const mode = pin.materialMode || 'lecture';
    const topic = getMaterialTopics(lecture, mode).find((t) => t.id === pin.topicId);
    if (!topic) return null;
    return {
      action: 'topic',
      mode,
      topic,
      subtopicId: pin.type === 'subtopic' ? pin.subtopicId : null
    };
  }

  return null;
}
