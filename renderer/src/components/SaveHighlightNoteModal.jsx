import React, { useEffect, useState } from 'react';
import { coursePayload } from '../utils/courseApi';
import HighlightPreviewText from './HighlightPreviewText';

export default function SaveHighlightNoteModal({
  highlight,
  topicTitle,
  topicId,
  subtopicId = '',
  subtopicTitle = '',
  sectionAnchor = '',
  sourceKind = '',
  markdownSource = '',
  course,
  lecturePath,
  materialMode = 'lecture',
  exerciseId = '',
  source = 'card',
  hasApiKey,
  onSaveManual,
  onSaveWithAI,
  onCancel
}) {
  const [note, setNote] = useState('');
  const [refinedNote, setRefinedNote] = useState('');
  const [keyIdeas, setKeyIdeas] = useState([]);
  const [noteTitle, setNoteTitle] = useState('');
  const [refining, setRefining] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [refineError, setRefineError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [showRefined, setShowRefined] = useState(false);

  useEffect(() => {
    setNote('');
    setRefinedNote('');
    setKeyIdeas([]);
    setNoteTitle('');
    setRefineError('');
    setSaveError('');
    setShowRefined(false);
  }, [highlight]);

  async function handleRefine() {
    if (!hasApiKey) {
      setRefineError('Add an API key in Settings to use AI refinement.');
      return;
    }
    setRefining(true);
    setRefineError('');
    const result = await window.api.refineNote({
      lecturePath,
      ...coursePayload(course),
      topicTitle,
      highlightedText: highlight,
      draftNote: note
    });
    setRefining(false);
    if (result.success) {
      setKeyIdeas(result.keyIdeas || []);
      setNoteTitle(result.title || topicTitle || '');
      setRefinedNote(result.refinedNote || '');
      setShowRefined(true);
    } else {
      setRefineError(result.error || 'Refinement failed');
    }
  }

  async function handleSaveManual() {
    setSaving(true);
    setSaveError('');
    try {
      await onSaveManual({
        note: note.trim(),
        refinedNote: refinedNote.trim() || note.trim(),
        keyIdeas,
        title: noteTitle.trim() || topicTitle
      });
    } catch (err) {
      setSaveError(err.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveWithAI() {
    if (!hasApiKey) {
      setSaveError('Add an API key in Settings to use Save with AI.');
      return;
    }
    setAiSaving(true);
    setSaveError('');
    try {
      const result = await window.api.autoSaveHighlightNote({
        lecturePath,
        ...coursePayload(course),
        topicId,
        topicTitle,
        subtopicId,
        subtopicTitle,
        sectionAnchor,
        sourceKind,
        markdownSource,
        source,
        materialMode,
        exerciseId: materialMode === 'exercise' ? exerciseId : '',
        highlightedText: highlight
      });
      if (!result?.success) {
        setSaveError(result?.error || 'AI save failed');
        return;
      }
      await onSaveWithAI(result);
    } catch (err) {
      setSaveError(err.message || 'AI save failed');
    } finally {
      setAiSaving(false);
    }
  }

  const busy = saving || refining || aiSaving;

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center no-drag p-4">
      <div className="bg-bg-secondary border border-border-DEFAULT rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-text-primary mb-1">Save to lecture notes</h2>
        <p className="text-xs text-text-muted mb-4">
          Save manually, or let AI pick an existing note group and append — or create a new one.
        </p>

        <blockquote className="border-l-2 border-accent/60 pl-3 mb-4 text-sm text-text-secondary max-h-28 overflow-y-auto">
          <HighlightPreviewText text={highlight} />
        </blockquote>

        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={handleSaveWithAI}
            disabled={busy || !hasApiKey}
            className="px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-40"
            title={hasApiKey ? 'Save without typing — AI titles and groups the note' : 'API key required'}
          >
            {aiSaving ? 'Saving with AI…' : 'Save with AI'}
          </button>
          <button
            type="button"
            onClick={handleRefine}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg border border-accent/40 text-accent text-xs font-medium hover:bg-accent/10 disabled:opacity-40"
          >
            {refining ? 'Sharpening…' : 'Sharpen draft (optional)'}
          </button>
        </div>

        <label className="block mb-3">
          <span className="text-xs text-text-muted uppercase tracking-wide">Manual note (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            disabled={busy}
            placeholder="Type your own note, or use Save with AI above"
            className="mt-1 w-full bg-bg-tertiary border border-border-DEFAULT rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-y disabled:opacity-50"
          />
        </label>

        {refinedNote && (
          <button
            type="button"
            onClick={() => {
              setNote(refinedNote);
              setShowRefined(false);
            }}
            disabled={busy}
            className="mb-3 text-xs text-accent hover:underline disabled:opacity-40"
          >
            Use refined text as manual note
          </button>
        )}

        {refineError && <p className="text-xs text-red-400 mb-3">{refineError}</p>}
        {saveError && <p className="text-xs text-red-400 mb-3">{saveError}</p>}

        {keyIdeas.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {keyIdeas.map((idea, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/20"
              >
                {idea}
              </span>
            ))}
          </div>
        )}

        {showRefined && refinedNote && (
          <div className="mb-4 rounded-lg border border-border-DEFAULT bg-bg-tertiary/40 p-3 max-h-40 overflow-y-auto">
            <p className="text-xs text-text-muted mb-2 uppercase tracking-wide">Refined preview</p>
            <MarkdownView>{refinedNote}</MarkdownView>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 text-sm text-text-muted disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveManual}
            disabled={busy}
            className="px-4 py-2 rounded-lg border border-border-DEFAULT text-sm text-text-primary hover:border-accent/40 disabled:opacity-40 min-w-[110px]"
          >
            {saving ? 'Saving…' : 'Save manually'}
          </button>
        </div>
      </div>
    </div>
  );
}
