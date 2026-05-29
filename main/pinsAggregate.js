const vault = require('./vault');
const lectureNotes = require('./lectureNotes');
const coursesApi = require('./courses');

function formatPinBreadcrumb(course, lectureTitle, pin) {
  const parts = [course.name, lectureTitle];
  if (pin.type === 'topic') return parts.join(' · ');
  if (pin.type === 'subtopic') {
    const topicPart = pin.breadcrumb?.includes(' / ')
      ? pin.breadcrumb.split(' / ').slice(1).join(' / ')
      : '';
    if (topicPart && topicPart !== pin.title) parts.push(topicPart);
    parts.push(pin.title);
    return parts.join(' · ');
  }
  if (pin.type === 'note') {
    if (pin.breadcrumb) parts.push(pin.breadcrumb);
    return parts.join(' · ');
  }
  return parts.join(' · ');
}

/**
 * Collect bookmark pins across all courses (lecture, topic, subtopic, note).
 */
function collectAllPinned(store) {
  const vaultPath = store.get('vaultPath');
  if (!vaultPath) return [];

  const courses = coursesApi.listOrderedCourses(store);
  const items = [];

  for (const course of courses) {
    const lectures = vault.loadCourseLectures(vaultPath, course.storageKey) || [];
    for (const lec of lectures) {
      const lecturePath = lec.path;
      if (!lecturePath) continue;

      const itemPins = vault.listPinnedInItem(lecturePath);
      const notePins = lectureNotes.listPinnedNotes(lecturePath);

      for (const pin of [...itemPins, ...notePins]) {
        items.push({
          ...pin,
          courseId: course.id,
          courseName: course.name,
          courseEmoji: course.emoji || '📚',
          lectureId: lec.id,
          lectureTitle: lec.title,
          itemType: lec.itemType === 'promoted' ? 'promoted' : 'lecture',
          breadcrumb: formatPinBreadcrumb(course, lec.title, pin)
        });
      }
    }
  }

  return items.sort((a, b) => new Date(b.pinnedAt || 0) - new Date(a.pinnedAt || 0));
}

module.exports = {
  collectAllPinned,
  formatPinBreadcrumb
};
