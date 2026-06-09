import React, { useCallback, useEffect, useRef, useState } from 'react';
import { findSectionAnchorInMarkdown } from '@shared/noteAnchor.cjs';
import { useStudyPinsOptional } from '../state/studyPins.jsx';
import MarkdownView from './MarkdownView';
import SelectionAskAiPanel from './SelectionAskAiPanel';
import { extractSelectionTextFromWindow } from '../utils/extractSelectionText';
import { applySavedHighlights } from '../utils/applySavedHighlights';

export default function HighlightableMarkdown({
  children,
  markdownSource,
  markdownClassName = '',
  wrapperClassName = '',
  contentVariant = 'reading',
  onHighlight,
  sectionAnchor: fixedSectionAnchor = '',
  saveLabel = 'Save note',
  notesSaveLabel = 'Save to notes',
  showNotesSave = false,
  savedHighlights = [],
  onDeleteSavedHighlight,
  pinSource = null,
  askContext = null,
  hasApiKey = false
}) {
  const containerRef = useRef(null);
  const [toolbar, setToolbar] = useState(null);
  const [askPanel, setAskPanel] = useState(null);
  const [deletePrompt, setDeletePrompt] = useState(null);
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
    setDeletePrompt(null);
    setToolbar({
      text,
      top: rect.bottom - rootRect.top + root.scrollTop + 6,
      left: Math.min(
        Math.max(rect.left - rootRect.left + root.scrollLeft, 8),
        rootRect.width - 200
      )
    });
  }, [clearToolbar]);

  function handleSaveClick(saveMode = 'default') {
    if (!toolbar?.text) return;
    const sectionAnchor =
      fixedSectionAnchor ||
      (markdownSource ? findSectionAnchorInMarkdown(markdownSource, toolbar.text) : '');
    onHighlight(toolbar.text, { sectionAnchor, saveMode });
    clearToolbar();
    window.getSelection()?.removeAllRanges();
  }

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    applySavedHighlights(root, savedHighlights);

    if (!onDeleteSavedHighlight) return undefined;

    function handleMarkClick(e) {
      const mark = e.target.closest?.('mark.cd-saved-highlight');
      if (!mark || !root.contains(mark)) return;
      e.preventDefault();
      e.stopPropagation();
      clearToolbar();
      window.getSelection()?.removeAllRanges();
      const id = mark.dataset.highlightId;
      if (!id) return;
      const rootRect = root.getBoundingClientRect();
      const rect = mark.getBoundingClientRect();
      setDeletePrompt({
        id,
        top: rect.bottom - rootRect.top + root.scrollTop + 6,
        left: Math.max(rect.left - rootRect.left + root.scrollLeft, 8)
      });
    }

    root.addEventListener('click', handleMarkClick);
    return () => root.removeEventListener('click', handleMarkClick);
  }, [children, savedHighlights, onDeleteSavedHighlight, clearToolbar]);

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

  async function handleConfirmDeleteHighlight() {
    const id = deletePrompt?.id;
    setDeletePrompt(null);
    if (id) await onDeleteSavedHighlight?.(id);
  }

  return (
    <div
      ref={containerRef}
      className={`highlightable-markdown relative select-text ${wrapperClassName}`.trim()}
      onMouseUp={handleMouseUp}
      onScroll={() => {
        clearToolbar();
        setDeletePrompt(null);
      }}
    >
      <MarkdownView variant={contentVariant} className={markdownClassName}>{children}</MarkdownView>
      {toolbar && (
        <div
          className="absolute z-10 flex flex-wrap gap-1.5 shadow-lg max-w-[min(100%,320px)]"
          style={{ top: toolbar.top, left: toolbar.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {showNotesSave && (
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg border border-border-DEFAULT bg-bg-secondary text-text-primary text-xs font-medium hover:border-accent/40"
              onClick={() => handleSaveClick('notes')}
            >
              {notesSaveLabel}
            </button>
          )}
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90"
            onClick={() => handleSaveClick(showNotesSave ? 'card' : 'default')}
          >
            {saveLabel}
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
      {deletePrompt && onDeleteSavedHighlight && (
        <div
          className="absolute z-10 flex gap-1.5 shadow-lg"
          style={{ top: deletePrompt.top, left: deletePrompt.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg bg-red-600/90 text-white text-xs font-medium hover:bg-red-600"
            onClick={handleConfirmDeleteHighlight}
          >
            Delete highlight
          </button>
          <button
            type="button"
            className="px-2 py-1.5 rounded-lg border border-border-DEFAULT bg-bg-secondary text-text-muted text-xs hover:text-text-primary"
            onClick={() => setDeletePrompt(null)}
          >
            Cancel
          </button>
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
