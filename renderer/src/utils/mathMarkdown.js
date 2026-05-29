import { normalizeNoteMarkdown } from './noteMarkdown';

/** @deprecated use normalizeNoteMarkdown — kept for imports */
export function normalizeMathMarkdown(text) {
  return normalizeNoteMarkdown(text);
}

export { normalizeNoteMarkdown };
