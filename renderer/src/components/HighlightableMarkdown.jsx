import React, { useCallback, useRef, useState } from 'react';
import MarkdownView from './MarkdownView';

export default function HighlightableMarkdown({ children, onHighlight }) {
  const containerRef = useRef(null);
  const [toolbar, setToolbar] = useState(null);

  const clearToolbar = useCallback(() => setToolbar(null), []);

  const handleMouseUp = useCallback(() => {
    const root = containerRef.current;
    const sel = window.getSelection();
    if (!root || !sel || sel.isCollapsed || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) {
      clearToolbar();
      return;
    }

    const text = sel.toString().replace(/\s+/g, ' ').trim();
    if (text.length < 2) {
      clearToolbar();
      return;
    }

    const rect = range.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    setToolbar({
      text,
      top: rect.bottom - rootRect.top + root.scrollTop + 6,
      left: Math.min(
        Math.max(rect.left - rootRect.left + root.scrollLeft, 8),
        rootRect.width - 120
      )
    });
  }, [clearToolbar]);

  function handleSaveClick() {
    if (!toolbar?.text) return;
    onHighlight(toolbar.text);
    clearToolbar();
    window.getSelection()?.removeAllRanges();
  }

  return (
    <div
      ref={containerRef}
      className="highlightable-markdown relative select-text"
      onMouseUp={handleMouseUp}
      onScroll={clearToolbar}
    >
      <MarkdownView>{children}</MarkdownView>
      {toolbar && (
        <button
          type="button"
          style={{ top: toolbar.top, left: toolbar.left }}
          className="absolute z-10 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium shadow-lg hover:bg-accent-dark"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleSaveClick}
        >
          Save note
        </button>
      )}
    </div>
  );
}
