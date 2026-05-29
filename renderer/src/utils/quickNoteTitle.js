import { buildNoteTitle } from '@shared/noteListMeta.cjs';

/** Auto title for quick-capture notes from topic chat (no modal). */
export function makeQuickNoteTitle(excerpt, topicTitle, source = 'tutorChat') {
  return buildNoteTitle({
    title: '',
    topicTitle,
    highlightedText: excerpt,
    refinedNote: excerpt,
    note: excerpt,
    source,
    keyIdeas: []
  });
}
