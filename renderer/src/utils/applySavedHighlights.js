/** Wrap saved highlight snippets in the rendered markdown DOM. */

function unwrapSavedMarks(container) {
  container.querySelectorAll('mark.cd-saved-highlight').forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  });
}

function collectTextNodes(root) {
  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
      if (node.parentElement?.closest('mark.cd-saved-highlight, code, pre')) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  let current = walker.nextNode();
  while (current) {
    nodes.push(current);
    current = walker.nextNode();
  }
  return nodes;
}

function buildTextMap(nodes) {
  let combined = '';
  const spans = [];
  for (const node of nodes) {
    spans.push({ node, start: combined.length, end: combined.length + node.textContent.length });
    combined += node.textContent;
  }
  return { combined, spans };
}

function locateSpan(spans, index) {
  for (const span of spans) {
    if (index >= span.start && index < span.end) return span;
  }
  return spans[spans.length - 1] || null;
}

function wrapDomRange(root, start, end, id) {
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  const mark = document.createElement('mark');
  mark.className = 'cd-saved-highlight';
  if (id) mark.dataset.highlightId = id;
  mark.title = 'Click to delete highlight';
  try {
    range.surroundContents(mark);
    return true;
  } catch {
    const fragment = range.extractContents();
    mark.appendChild(fragment);
    range.insertNode(mark);
    return Boolean(mark.textContent);
  }
}

function wrapMatch(root, needle, id) {
  const nodes = collectTextNodes(root);
  if (!nodes.length) return false;
  const { combined, spans } = buildTextMap(nodes);
  if (!combined) return false;

  let idx = combined.indexOf(needle);
  if (idx < 0) idx = combined.toLowerCase().indexOf(String(needle).toLowerCase());
  if (idx < 0) return false;

  const endIdx = idx + needle.length;
  const startSpan = locateSpan(spans, idx);
  const endSpan = locateSpan(spans, Math.max(endIdx - 1, idx));
  if (!startSpan || !endSpan) return false;

  return wrapDomRange(
    root,
    { node: startSpan.node, offset: idx - startSpan.start },
    { node: endSpan.node, offset: endIdx - endSpan.start },
    id
  );
}

function needleCandidates(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const out = [raw];
  const collapsed = raw.replace(/\s+/g, ' ');
  if (collapsed !== raw) out.push(collapsed);
  if (raw.length > 48) out.push(raw.slice(0, 48));
  const words = collapsed.split(/\s+/).filter(Boolean);
  if (words.length > 4) out.push(words.slice(0, 4).join(' '));
  return [...new Set(out.filter((s) => s.length >= 4))];
}

export function applySavedHighlights(container, highlights = []) {
  if (!container) return { applied: 0, tried: 0 };
  unwrapSavedMarks(container);
  let applied = 0;
  let tried = 0;
  for (const item of highlights) {
    const id = item.id || '';
    const candidates = needleCandidates(item.text || item.highlightedText);
    tried += candidates.length;
    for (const needle of candidates) {
      if (wrapMatch(container, needle, id)) {
        applied += 1;
        break;
      }
    }
  }
  return { applied, tried };
}
