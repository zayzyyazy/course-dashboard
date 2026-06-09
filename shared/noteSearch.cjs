const { normalizeForCompare, stripMarkdown } = require('./noteListMeta.cjs');

function noteSearchBlob(note) {
  return [
    note?.title,
    note?.preview,
    note?.topicTitle,
    note?.subtopicTitle,
    note?.sectionHeading,
    stripMarkdown(note?.highlightedText),
    stripMarkdown(note?.refinedNote || note?.note),
    (note?.keyIdeas || []).join(' ')
  ]
    .filter(Boolean)
    .join(' ');
}

function filterNotesByQuery(notes, query) {
  const list = Array.isArray(notes) ? notes : [];
  const q = normalizeForCompare(String(query || '').trim());
  if (!q) return list;
  return list.filter((note) => normalizeForCompare(noteSearchBlob(note)).includes(q));
}

module.exports = {
  noteSearchBlob,
  filterNotesByQuery
};
