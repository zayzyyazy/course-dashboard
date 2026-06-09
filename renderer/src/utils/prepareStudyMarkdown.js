/**
 * Turn pasted plain text into readable markdown (paragraphs, lists, short headings).
 */
export function prepareStudyMarkdown(text) {
  let raw = String(text || '').trim();
  if (!raw) return '';

  if (/^#{1,6}\s/m.test(raw) || /^[-*]\s/m.test(raw) || /^\d+[.)]\s/m.test(raw)) {
    return raw;
  }

  if (raw.includes('\n\n')) return raw;

  if (raw.includes('\n')) {
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        if (/^[-*•]\s/.test(line)) return line.replace(/^•\s/, '- ');
        if (/^\d+[.)]\s/.test(line)) return line;
        if (line.length <= 72 && /[:?]$/.test(line) && !/[.!?]{2,}/.test(line)) {
          return `### ${line.replace(/:$/, '')}`;
        }
        return line;
      })
      .join('\n\n');
  }

  if (raw.length > 200) {
    raw = raw
      .replace(/\s+[·•]\s+/g, '\n\n')
      .replace(/\s+—\s+/g, '\n\n')
      .replace(/;\s+(?=[A-ZÄÖÜ„"])/g, '.\n\n');

    if (!raw.includes('\n\n')) {
      raw = raw.replace(/(?<=[.!?])\s+(?=[A-ZÄÖÜ„"])/g, '\n\n');
    }
  }

  return raw;
}
