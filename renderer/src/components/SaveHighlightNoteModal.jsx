import React, { useEffect, useState } from 'react';
import MarkdownView from './MarkdownView';
import { coursePayload } from '../utils/courseApi';

export default function SaveHighlightNoteModal({
  highlight,
  topicTitle,
  course,
  lecturePath,
  hasApiKey,
  onSave,
  onCancel
}) {
  const [note, setNote] = useState('');
  const [refinedNote, setRefinedNote] = useState('');
  const [keyIdeas, setKeyIdeas] = useState([]);
  const [refining, setRefining] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refineError, setRefineError] = useState('');
  const [showRefined, setShowRefined] = useState(false);

  useEffect(() => {
    setNote('');
    setRefinedNote('');
    setKeyIdeas([]);
    setRefineError('');
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
      setRefinedNote(result.refinedNote || '');
      setShowRefined(true);
    } else {
      setRefineError(result.error || 'Refinement failed');
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        note: note.trim(),
        refinedNote: refinedNote.trim() || note.trim(),
        keyIdeas
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center no-drag p-4">
      <div className="bg-bg-secondary border border-border-DEFAULT rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-text-primary mb-1">Save to lecture notes</h2>
        <p className="text-xs text-text-muted mb-4">
          Saved under <span className="text-accent">this lecture&apos;s notes</span> — reopen anytime from
          the lecture page.
        </p>

        <blockquote className="border-l-2 border-accent/60 pl-3 mb-4 text-sm text-text-secondary italic leading-relaxed max-h-28 overflow-y-auto">
          {highlight}
        </blockquote>

        <label className="block mb-3">
          <span className="text-xs text-text-muted uppercase tracking-wide">Your note</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            disabled={saving || refining}
            placeholder="What do you want to remember?"
            className="mt-1 w-full bg-bg-tertiary border border-border-DEFAULT rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-y disabled:opacity-50"
            autoFocus
          />
        </label>

        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={handleRefine}
            disabled={refining || saving}
            className="px-3 py-1.5 rounded-lg border border-accent/40 text-accent text-xs font-medium hover:bg-accent/10 disabled:opacity-40"
          >
            {refining ? 'Sharpening…' : 'Sharpen with AI'}
          </button>
          {refinedNote && (
            <button
              type="button"
              onClick={() => {
                setNote(refinedNote);
                setShowRefined(false);
              }}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg border border-border-DEFAULT text-xs text-text-secondary hover:text-text-primary disabled:opacity-40"
            >
              Use refined as note
            </button>
          )}
        </div>

        {refineError && <p className="text-xs text-red-400 mb-3">{refineError}</p>}

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
            <p className="text-xs text-text-muted mb-2 uppercase tracking-wide">Refined for study</p>
            <MarkdownView>{refinedNote}</MarkdownView>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 text-sm text-text-muted disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || refining}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-40 min-w-[100px]"
          >
            {saving ? 'Saving…' : 'Save note'}
          </button>
        </div>
      </div>
    </div>
  );
}
