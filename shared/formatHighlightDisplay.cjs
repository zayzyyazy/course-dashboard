/**
 * Display-only readable text for highlights (no KaTeX $ wrapping).
 * Storage uses cleanHighlightText at extraction/save; previews call this alias.
 */

const { cleanHighlightText } = require('./cleanHighlightText.cjs');

/** Plain readable highlight text — preserves prose spacing, light math spacing. */
function formatHighlightReadableText(raw) {
  return cleanHighlightText(raw);
}

/** @deprecated Use formatHighlightReadableText — no markdown/math wrapping. */
function formatHighlightDisplayMarkdown(raw) {
  return formatHighlightReadableText(raw);
}

module.exports = {
  formatHighlightReadableText,
  formatHighlightDisplayMarkdown
};
