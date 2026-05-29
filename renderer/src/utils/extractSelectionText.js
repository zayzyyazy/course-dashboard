import { cleanHighlightText } from '@shared/cleanHighlightText.cjs';

const BLOCK_TAGS = new Set([
  'p',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'blockquote',
  'pre',
  'section',
  'article',
  'header',
  'footer',
  'tr',
  'table',
  'thead',
  'tbody',
  'ul',
  'ol',
  'dl',
  'hr'
]);

function isHiddenElement(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  if (el.classList?.contains('katex-mathml')) return true;
  const tag = el.tagName?.toLowerCase();
  return tag === 'math' || tag === 'semantics' || tag === 'annotation';
}

function needsSpaceBetween(lastChar, firstChar) {
  if (!lastChar || !firstChar) return false;
  if (/[\s\n]/.test(lastChar) || /[\s\n]/.test(firstChar)) return false;
  if (/^[\.,;:!?%‰°²³⁴⁵⁶⁷⁸⁹⁰₁₂₃₄₅₆₇₈₉\)'\]}/]/.test(firstChar)) return false;
  if (/[\(\[\{:'"`]$/.test(lastChar)) return false;
  if (/^[\)\]\},;:]/.test(firstChar)) return false;
  const MATH = '=∪∩∈∉⊆⊂∅∖×÷±≤≥≠|^';
  if (MATH.includes(lastChar) || MATH.includes(firstChar)) return true;
  if (/[\p{L}]/u.test(lastChar) && /[\p{L}\p{N}]/u.test(firstChar)) return true;
  if (/[\p{N}]/u.test(lastChar) && /[\p{L}]/u.test(firstChar)) return true;
  if (/[{,]/.test(lastChar) && /[\p{L}\p{N}]/u.test(firstChar)) return true;
  return false;
}

function appendText(left, right) {
  if (!right) return left || '';
  if (!left) return right;
  const last = left.slice(-1);
  const first = right[0];
  if (needsSpaceBetween(last, first)) return left + ' ' + right;
  return left + right;
}

function extractTextFromNode(node) {
  if (!node) return '';
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || '';
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const el = node;
  if (isHiddenElement(el)) return '';

  const tag = el.tagName?.toLowerCase();

  if (el.classList?.contains('katex')) {
    el.querySelectorAll('.katex-mathml, math, semantics, annotation').forEach((n) => n.remove());
    const html = el.querySelector('.katex-html');
    if (html) return extractTextFromNode(html);
  }

  let out = '';
  for (const child of el.childNodes) {
    out = appendText(out, extractTextFromNode(child));
  }

  if (tag === 'br') return out ? `${out}\n` : '\n';
  if (BLOCK_TAGS.has(tag)) {
    if (!out.trim()) return '\n';
    return `${out}\n`;
  }
  return out;
}

function prepareSelectionFragment(fragment) {
  if (!fragment) return null;
  fragment.querySelectorAll('.katex-mathml, math, semantics, annotation').forEach((el) => el.remove());
  fragment.querySelectorAll('.katex').forEach((katexEl) => {
    katexEl.querySelectorAll('.katex-mathml, math, semantics, annotation').forEach((el) => el.remove());
  });
  return fragment;
}

/**
 * Extract plain text from a DOM Range without KaTeX MathML duplicate content.
 */
export function extractSelectionTextFromRange(range) {
  if (!range) return '';

  const fragment = range.cloneContents();
  if (!fragment) return '';

  prepareSelectionFragment(fragment);

  const host = document.createElement('div');
  host.appendChild(fragment);
  const raw = extractTextFromNode(host);
  return cleanHighlightText(raw);
}

export function extractSelectionTextFromWindow(selection, rootEl) {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return '';

  const range = selection.getRangeAt(0);
  if (rootEl && !rootEl.contains(range.commonAncestorContainer)) return '';

  return extractSelectionTextFromRange(range);
}
