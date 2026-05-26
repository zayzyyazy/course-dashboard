/**
 * Normalize common LaTeX delimiters for remark-math ($ and $$).
 */
export function normalizeMathMarkdown(text) {
  if (!text || typeof text !== 'string') return '';
  let s = text;

  s = s.replace(/\\\[/g, '$$').replace(/\\\]/g, '$$');
  s = s.replace(/\\\(/g, '$').replace(/\\\)/g, '$');

  return s;
}
