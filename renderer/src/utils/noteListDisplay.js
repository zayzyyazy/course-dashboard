import { buildNotePreview } from '@shared/noteListMeta.cjs';

export function displayNoteTitle(note) {
  return note?.title || note?.topicTitle || 'Note';
}

export function displayNotePreview(note) {
  if (note?.preview) return note.preview;
  return buildNotePreview(note);
}
