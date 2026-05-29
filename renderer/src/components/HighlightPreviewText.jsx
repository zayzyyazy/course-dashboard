import React from 'react';
import { formatHighlightReadableText } from '@shared/formatHighlightDisplay.cjs';

/** Plain readable highlight preview — no KaTeX/markdown italicization. */
export default function HighlightPreviewText({ text, className = '' }) {
  const readable = formatHighlightReadableText(text);
  if (!readable) return null;
  return (
    <p className={`whitespace-pre-wrap leading-relaxed ${className}`.trim()}>{readable}</p>
  );
}
