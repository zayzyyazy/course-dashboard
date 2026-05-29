const LATEX_CMD =
  'frac|mathbb|text|sum|sqrt|alpha|beta|sigma|mu|lambda|leq|geq|neq|cdot|times|left|right|begin|end|infty|partial|nabla|ldots|cdots|mathbf|mathrm|operatorname|hat|bar|vec|pm|mp';

function normalizeNoteMarkdown(text) {
  if (!text || typeof text !== 'string') return '';
  let s = text.trim();

  const fence = s.match(/^```(?:markdown|md|tex)?\s*\n?([\s\S]*?)```$/i);
  if (fence) s = fence[1].trim();

  s = s.replace(/\\\[/g, '$$').replace(/\\\]/g, '$$');
  s = s.replace(/\\\(/g, '$').replace(/\\\)/g, '$');
  s = s.replace(new RegExp(`\\\\{2,}(${LATEX_CMD})`, 'g'), '\\$1');
  s = s.replace(/\\\$/g, '$');
  s = s.replace(/\r\n/g, '\n');

  return s;
}

const STUDY_BLOCK_RE = /\n\n---\n\n#### /;

function formatStudyBlock(sectionLabel, content, addedAt) {
  const label = String(sectionLabel || 'AI-added explanation').trim().slice(0, 80);
  const date = new Date(addedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const body = normalizeNoteMarkdown(content);
  return `\n\n---\n\n#### ${label}\n\n> Added while studying · ${date}\n\n${body}\n`;
}

function ensureRefinedNoteCore(note) {
  if (note.refinedNoteCore != null && note.refinedNoteCore !== '') return note.refinedNoteCore;
  const full = String(note.refinedNote || note.note || '').trim();
  if (!Array.isArray(note.studyAdditions) || note.studyAdditions.length === 0) {
    return full;
  }
  const idx = full.search(STUDY_BLOCK_RE);
  return idx >= 0 ? full.slice(0, idx).trim() : full;
}

function rebuildRefinedNote(note) {
  const core = ensureRefinedNoteCore(note);
  note.refinedNoteCore = core;
  const blocks = (note.studyAdditions || []).map((a) =>
    formatStudyBlock(a.label, a.content, a.addedAt)
  );
  return (core + blocks.join('')).trim().slice(0, 48000);
}

module.exports = {
  normalizeNoteMarkdown,
  formatStudyBlock,
  ensureRefinedNoteCore,
  rebuildRefinedNote,
  STUDY_BLOCK_RE
};
