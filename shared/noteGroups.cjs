/** Display-only topic sections for lecture notes (no concept clustering). */

function sortNotesInSection(notes) {
  return [...notes].sort((a, b) => {
    const orderA = Number.isFinite(a.sortIndex) ? a.sortIndex : Number.MAX_SAFE_INTEGER;
    const orderB = Number.isFinite(b.sortIndex) ? b.sortIndex : Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });
}

function sectionSortIndex(section, topicOrder) {
  if (!topicOrder?.length || !section.topicId) return Number.MAX_SAFE_INTEGER;
  const idx = topicOrder.indexOf(section.topicId);
  return idx >= 0 ? idx : Number.MAX_SAFE_INTEGER;
}

function buildTopicSections(notes, topicOrder = []) {
  const byTopic = new Map();
  for (const n of notes) {
    const key = n.topicId || n.topicTitle || '_other';
    if (!byTopic.has(key)) {
      byTopic.set(key, { topicId: n.topicId, topicTitle: n.topicTitle || 'Other', notes: [] });
    }
    byTopic.get(key).notes.push(n);
  }

  const sections = [];
  for (const [, section] of byTopic) {
    sections.push({
      topicId: section.topicId,
      topicTitle: section.topicTitle,
      notes: sortNotesInSection(section.notes),
      noteCount: section.notes.length
    });
  }

  sections.sort((a, b) => {
    const ia = sectionSortIndex(a, topicOrder);
    const ib = sectionSortIndex(b, topicOrder);
    if (ia !== ib) return ia - ib;
    return (a.topicTitle || '').localeCompare(b.topicTitle || '', undefined, { sensitivity: 'base' });
  });

  return sections;
}

/** Build display model: topic sections → flat note list (respects sortIndex). */
function buildNoteDisplayModel(notes, topicOrder = []) {
  const sections = buildTopicSections(notes, topicOrder);
  return {
    sections,
    totalNotes: notes.length
  };
}

function noteContextLabel(note) {
  const sub = String(note?.subtopicTitle || '').trim();
  const topic = String(note?.topicTitle || '').trim();
  if (sub && sub.toLowerCase() !== topic.toLowerCase()) return sub;
  const heading = String(note?.sectionHeading || '').trim();
  if (heading) return heading;
  return '';
}

function formatNoteDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

module.exports = {
  buildNoteDisplayModel,
  buildTopicSections,
  sortNotesInSection,
  sectionSortIndex,
  noteContextLabel,
  formatNoteDate
};
