import React, { useRef, useEffect, useState, useCallback } from 'react';
import MarkdownView from './MarkdownView';
import RelevantSavedNotes from './RelevantSavedNotes';
import { extractSelectionTextFromWindow } from '../utils/extractSelectionText';

export default function NoteChatPanel({
  onAsk,
  onSaveToNotes,
  onOpenSavedNote,
  disabled,
  placeholder,
  variant = 'note'
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selection, setSelection] = useState(null);
  const [saveNotice, setSaveNotice] = useState('');
  const [relevantNotes, setRelevantNotes] = useState([]);
  const chatRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, saveNotice]);

  useEffect(() => {
    if (!saveNotice) return undefined;
    const t = setTimeout(() => setSaveNotice(''), 4000);
    return () => clearTimeout(t);
  }, [saveNotice]);

  const clearSelection = useCallback(() => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !chatRef.current) return;

    const anchor = sel.anchorNode;
    const node = anchor?.nodeType === Node.TEXT_NODE ? anchor.parentElement : anchor;
    if (!node?.closest?.('[data-assistant-msg]')) return;

    const text = extractSelectionTextFromWindow(sel, chatRef.current);
    if (text.length < 3) {
      return;
    }

    setSelection({ text });
  }, []);

  async function handleSave(content, { isSelection }) {
    if (!content?.trim() || !onSaveToNotes) return;
    setSaving(true);
    setSaveNotice('Adding to your note…');
    try {
      const result = await onSaveToNotes({
        excerpt: content.trim(),
        isSelection: Boolean(isSelection)
      });
      if (result?.success) {
        setSaveNotice(
          isSelection
            ? 'Selection added to this note (see left panel)'
            : 'Answer added to this note (see left panel)'
        );
        clearSelection();
      } else {
        setSaveNotice(result?.error || 'Could not add to note');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading || disabled) return;
    setInput('');
    clearSelection();
    const userMsg = { role: 'user', text: q };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setRelevantNotes([]);
    const history = messages.map((m) => ({ role: m.role, content: m.text }));
    const result = await onAsk(q, history);
    setLoading(false);
    if (result?.relevantNotes?.length) setRelevantNotes(result.relevantNotes);
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        text: result?.success ? result.answer : result?.error || 'Could not get an answer.'
      }
    ]);
  }

  const isReference = variant === 'reference';
  const suggestions = isReference
    ? [
        'Explain this in simple terms',
        'What are the key points?',
        'How does this relate to the lecture?',
        'Give me an example'
      ]
    : [
        'Explain my note more clearly',
        'What does this formula mean?',
        'What am I missing here?',
        'Give an example for this point'
      ];

  return (
    <div className="flex flex-col h-full min-h-0">
      <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2 flex-shrink-0">
        {isReference ? 'Ask about this reference' : 'Ask about this note'}
      </p>

      <div
        ref={chatRef}
        className="flex-1 min-h-0 overflow-y-auto space-y-3 mb-2 pr-1 note-chat-scroll"
        onMouseUp={isReference ? undefined : handleMouseUp}
      >
        {messages.length === 0 && !loading && (
          <div className="space-y-2">
            <p className="text-xs text-text-muted leading-relaxed">
              {isReference
                ? 'AI sees your saved reference (text, screenshot, or link) plus lecture context.'
                : 'AI is grounded in your note first, then the topic, lecture, and course. Highlight part of an answer or add the full reply — it goes into this same note on the left.'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={disabled}
                  onClick={() => setInput(s)}
                  className="text-xs px-2 py-1 rounded-full border border-border-DEFAULT text-text-secondary hover:border-accent/40 hover:text-accent disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div
              key={i}
              className="text-base leading-relaxed whitespace-pre-wrap rounded-lg px-3 py-2.5 bg-accent/15 text-text-primary ml-4 note-chat-user-bubble"
            >
              {m.text}
            </div>
          ) : (
            <div key={i} className="mr-2 group" data-assistant-msg>
              <div className="rounded-lg px-3 py-2 bg-bg-tertiary border border-border-subtle note-chat-md">
                <MarkdownView className="markdown-body-study-chat">{m.text}</MarkdownView>
              </div>
              {!isReference && onSaveToNotes && (
                <div className="flex flex-wrap gap-2 mt-1.5 opacity-90 group-hover:opacity-100">
                  <button
                    type="button"
                    disabled={disabled || saving}
                    onClick={() => handleSave(m.text, { isSelection: false })}
                    className="text-[11px] px-2 py-0.5 rounded border border-border-DEFAULT text-text-muted hover:text-accent hover:border-accent/40 disabled:opacity-40"
                  >
                    Add answer to this note
                  </button>
                </div>
              )}
            </div>
          )
        )}

        {!isReference && relevantNotes.length > 0 && onOpenSavedNote && (
          <RelevantSavedNotes
            notes={relevantNotes}
            onOpenNote={(n) => onOpenSavedNote(n.id)}
          />
        )}

        {loading && <p className="text-xs text-text-muted animate-pulse">Thinking…</p>}
        <div ref={bottomRef} />
      </div>

      {!isReference && selection && (
        <div className="mb-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 flex flex-wrap items-center gap-2 flex-shrink-0">
          <span className="text-xs text-text-secondary flex-1 min-w-0 truncate">
            Selected: “{selection.text.slice(0, 60)}
            {selection.text.length > 60 ? '…' : ''}”
          </span>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave(selection.text, { isSelection: true })}
            className="text-xs px-2 py-1 rounded bg-accent text-white font-medium disabled:opacity-40"
          >
            Add selection to this note
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="text-xs text-text-muted hover:text-text-primary"
          >
            Cancel
          </button>
        </div>
      )}

      {!isReference && saveNotice && (
        <p className="text-xs text-accent mb-2 flex-shrink-0">{saveNotice}</p>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 flex-shrink-0">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={disabled || loading || saving}
          placeholder={placeholder || 'Ask about this note…'}
          className="flex-1 bg-bg-tertiary border border-border-DEFAULT rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={disabled || loading || saving || !input.trim()}
          className="px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
