import { filterNotesByQuery as filterNotesByQueryShared } from '@shared/noteSearch.cjs';

export function filterNotesByQuery(notes, query) {
  return filterNotesByQueryShared(notes, query);
}

export function topicFilterOptions(notes) {
  const byId = new Map();
  for (const n of notes) {
    const id = n.topicId || `title:${n.topicTitle || 'other'}`;
    if (!byId.has(id)) {
      byId.set(id, {
        key: id,
        topicId: n.topicId || '',
        topicTitle: n.topicTitle || 'Other',
        count: 0
      });
    }
    byId.get(id).count += 1;
  }
  return [...byId.values()].sort((a, b) => a.topicTitle.localeCompare(b.topicTitle));
}

export function filterNotesByTopic(notes, filterKey) {
  if (!filterKey || filterKey === 'all') return notes;
  return notes.filter((n) => {
    const id = n.topicId || `title:${n.topicTitle || 'other'}`;
    return id === filterKey;
  });
}
