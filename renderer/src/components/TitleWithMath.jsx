import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { normalizeMathMarkdown } from '../utils/mathMarkdown';

function looksLikeInlineMath(raw) {
  // Cheap checks to avoid running the markdown renderer for normal titles.
  return (
    /\$[^$]+\$/.test(raw) ||
    /\\\(.+\\\)/.test(raw) ||
    /\\\[.+\\\]/.test(raw) ||
    /\\(frac|sqrt|sum|alpha|beta|sigma|mu|lambda|leq|geq|neq|cdot|times|partial|nabla|ldots|cdots|mathbf|mathrm)\b/.test(
      raw
    )
  );
}

function sanitizeBrokenInlineMathTitle(normalized) {
  // If delimiters are unbalanced, we avoid rendering by stripping likely math delimiters.
  return normalized
    .replace(/\$/g, '')
    .replace(/\\\(/g, '')
    .replace(/\\\)/g, '')
    .replace(/\\\[/g, '')
    .replace(/\\\]/g, '')
    .trim();
}

export default function TitleWithMath({ text, className = '' }) {
  if (text == null) return null;
  const raw = String(text);
  if (!looksLikeInlineMath(raw)) {
    return <span className={className}>{raw}</span>;
  }

  const normalized = normalizeMathMarkdown(raw);
  const dollarCount = (normalized.match(/\$/g) || []).length;

  // KaTeX/rehype-katex can throw on malformed math; fall back to sanitized plain text.
  if (dollarCount % 2 !== 0 && dollarCount > 0) {
    return <span className={className}>{sanitizeBrokenInlineMathTitle(normalized)}</span>;
  }

  return (
    <span className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <span>{children}</span>
        }}
      >
        {normalized}
      </ReactMarkdown>
    </span>
  );
}

