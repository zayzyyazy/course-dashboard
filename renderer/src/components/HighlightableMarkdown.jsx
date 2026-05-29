import React, { useCallback, useRef, useState } from 'react';
import { findSectionAnchorInMarkdown } from '@shared/noteAnchor.cjs';
import { useStudyPinsOptional } from '../state/studyPins.jsx';
import MarkdownView from './MarkdownView';
import SelectionAskAiPanel from './SelectionAskAiPanel';
import { extractSelectionTextFromWindow } from '../utils/extractSelectionText';

export default function HighlightableMarkdown({
  children,
  markdownSource,
  onHighlight,
  sectionAnchor: fixedSectionAnchor = '',
  pinSource = null,
  askContext = null,
  hasApiKey = false
}) {
  const containerRef = useRef(null);
  const [toolbar, setToolbar] = useState(null);
  const [askPanel, setAskPanel] = useState(null);
  const studyPins = useStudyPinsOptional();
  const canPinToScreen = Boolean(studyPins && pinSource?.lecturePath);
  const canAskAi = Boolean(hasApiKey && askContext?.lecturePath);

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

    const text = extractSelectionTextFromWindow(sel, root);
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
        rootRect.width - 200
      )
    });
  }, [clearToolbar]);

  function handleSaveClick() {
    if (!toolbar?.text) return;
    const sectionAnchor =
      fixedSectionAnchor ||
      (markdownSource ? findSectionAnchorInMarkdown(markdownSource, toolbar.text) : '');
    onHighlight(toolbar.text, { sectionAnchor });
    clearToolbar();
    window.getSelection()?.removeAllRanges();
  }

  function handlePinToScreenClick() {
    if (!toolbar?.text || !studyPins || !pinSource?.lecturePath) return;
    studyPins.addPin({
      text: toolbar.text,
      sourceType: pinSource.sourceType || 'unknown',
      lectureTitle: pinSource.lectureTitle || '',
      topicTitle: pinSource.topicTitle || '',
      subtopicTitle: pinSource.subtopicTitle || '',
      lecturePath: pinSource.lecturePath
    });
    clearToolbar();
    window.getSelection()?.removeAllRanges();
  }

  function handleAskAiClick() {
    if (!toolbar?.text || !canAskAi) return;
    const root = containerRef.current;
    if (!root) return;
    const rootRect = root.getBoundingClientRect();
    setAskPanel({
      selectedText: toolbar.text,
      anchorX: rootRect.left + toolbar.left,
      anchorY: rootRect.top + toolbar.top + 36
    });
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
        <div
          className="absolute z-10 flex flex-wrap gap-1.5 shadow-lg max-w-[min(100%,320px)]"
          style={{ top: toolbar.top, left: toolbar.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90"
            onClick={handleSaveClick}
          >
            Save note
          </button>
          {canPinToScreen && (
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg border border-accent/50 bg-bg-secondary text-accent text-xs font-medium hover:bg-accent/10"
              onClick={handlePinToScreenClick}
              title="Pin to screen for this study session"
            >
              Pin to screen
            </button>
          )}
          {canAskAi && (
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg border border-emerald-800/50 bg-emerald-950/40 text-emerald-300 text-xs font-medium hover:bg-emerald-900/40"
              onClick={handleAskAiClick}
              title="Ask AI about this selection"
            >
              Ask AI
            </button>
          )}
        </div>
      )}
      {askPanel && (
        <SelectionAskAiPanel
          selectedText={askPanel.selectedText}
          askContext={askContext}
          anchorX={askPanel.anchorX}
          anchorY={askPanel.anchorY}
          onClose={() => setAskPanel(null)}
        />
      )}
    </div>
  );
}
