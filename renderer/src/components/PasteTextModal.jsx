import React, { useEffect, useState } from 'react';

export default function PasteTextModal({
  initialText = '',
  hasApiKey,
  onSavePlain,
  onClassify,
  onCancel
}) {
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setText(initialText);
    setError('');
  }, [initialText]);

  async function run(action) {
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Paste some text first');
      return;
    }
    setBusy(true);
    setMode(action);
    setError('');
    try {
      if (action === 'plain') {
        await onSavePlain?.(trimmed);
      } else {
        await onClassify?.(trimmed);
      }
    } catch (err) {
      setError(err.message || 'Could not save');
    } finally {
      setBusy(false);
      setMode('');
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center no-drag p-4">
      <div className="bg-bg-secondary border border-border-DEFAULT rounded-xl w-full max-w-lg p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-text-primary mb-1">Paste text</h2>
        <p className="text-xs text-text-muted mb-4 leading-relaxed">
          Drop in ChatGPT answers, notes, or mixed content with links. AI can split URLs into link
          cards and keep the rest as a text note.
        </p>

        <label className="block mb-4">
          <span className="text-xs text-text-muted uppercase tracking-wide">Content</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            disabled={busy}
            placeholder="Paste text or URLs here…"
            className="mt-1 w-full bg-bg-tertiary border border-border-DEFAULT rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-y disabled:opacity-50"
            autoFocus
          />
        </label>

        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

        {!hasApiKey && (
          <p className="text-[11px] text-text-muted mb-3">
            No API key — classify will extract URLs and save the rest as plain text.
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
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
            onClick={() => run('plain')}
            disabled={busy || !text.trim()}
            className="px-4 py-2 rounded-lg border border-border-DEFAULT text-sm text-text-secondary hover:border-accent hover:text-accent disabled:opacity-40"
          >
            {busy && mode === 'plain' ? 'Saving…' : 'Save as text'}
          </button>
          <button
            type="button"
            onClick={() => run('classify')}
            disabled={busy || !text.trim()}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-40"
          >
            {busy && mode === 'classify'
              ? hasApiKey
                ? 'Classifying…'
                : 'Saving…'
              : hasApiKey
                ? 'Classify & save with AI'
                : 'Extract links & save'}
          </button>
        </div>
      </div>
    </div>
  );
}
