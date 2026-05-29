import React, { useRef, useState, useCallback, useEffect } from 'react';
import MarkdownView from './MarkdownView';
import RelevantSavedNotes from './RelevantSavedNotes';
import { getAskChat, setAskChat, clearAskChat, hasAskChat } from '../utils/askChatStore';
import { extractSelectionTextFromWindow } from '../utils/extractSelectionText';

export default function TopicAskPanel({
  chatKey,
  onAsk,
  onQuickSaveNote,
  onOpenSavedNote,
  disabled,
  placeholder
}) {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastQuestion, setLastQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [relevantNotes, setRelevantNotes] = useState([]);
  const [saveNotice, setSaveNotice] = useState('');
  const answerRef = useRef(null);
  const saveLockRef = useRef(false);

  useEffect(() => {
    if (!chatKey) return;
    const saved = getAskChat(chatKey);
    if (saved) {
      setLastQuestion(saved.lastQuestion || '');
      setAnswer(saved.answer || '');
      setRelevantNotes(saved.relevantNotes || []);
    }
  }, [chatKey]);

  useEffect(() => {
    if (!chatKey) return;
    if (!answer && !lastQuestion && !relevantNotes.length) return;
    setAskChat(chatKey, { lastQuestion, answer, relevantNotes });
  }, [chatKey, lastQuestion, answer, relevantNotes]);

  useEffect(() => {
    if (!saveNotice) return undefined;
    const t = setTimeout(() => setSaveNotice(''), 3500);
    return () => clearTimeout(t);
  }, [saveNotice]);

  function handleNewChat() {
    if (chatKey) clearAskChat(chatKey);
    setQ('');
    setLastQuestion('');
    setAnswer('');
    setRelevantNotes([]);
    setSaveNotice('');
  }

  async function saveExcerpt(excerpt, { isSelection }) {
    if (!excerpt?.trim() || !onQuickSaveNote || saveLockRef.current) return;
    saveLockRef.current = true;
    setSaving(true);
    setSaveNotice(isSelection ? 'Saving selection…' : 'Saving answer…');
    try {
      const result = await onQuickSaveNote({ excerpt: excerpt.trim(), isSelection });
      if (result?.success) {
        setSaveNotice('Saved as a new note for this topic');
        window.getSelection()?.removeAllRanges();
      } else {
        setSaveNotice(result?.error || 'Could not save');
      }
    } finally {
      setSaving(false);
      setTimeout(() => {
        saveLockRef.current = false;
      }, 600);
    }
  }

  const handleAnswerMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !answerRef.current) return;
    const text = extractSelectionTextFromWindow(sel, answerRef.current);
    if (text.length < 3) return;
    const anchor = sel.anchorNode;
    const node = anchor?.nodeType === Node.TEXT_NODE ? anchor.parentElement : anchor;
    if (!node?.closest?.('[data-topic-chat-answer]')) return;
    saveExcerpt(text, { isSelection: true });
  }, [onQuickSaveNote]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!q.trim() || loading) return;
    const question = q.trim();
    setLoading(true);
    setAnswer('');
    setRelevantNotes([]);
    setSaveNotice('');
    setLastQuestion(question);
    const result = await onAsk(question);
    setLoading(false);
    if (result?.success) {
      setAnswer(result.answer);
      setRelevantNotes(result.relevantNotes || []);
    } else {
      setAnswer(result?.error || 'Could not get an answer.');
    }
    setQ('');
  }

  const showSession = Boolean(lastQuestion || answer);

  return (
    <div className="rounded-xl border border-border-DEFAULT bg-bg-secondary/80 p-4">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-xs font-medium text-text-muted uppercase tracking-wide">Ask tutor</p>
        {showSession && (
          <button
            type="button"
            onClick={handleNewChat}
            className="text-[10px] px-2 py-0.5 rounded border border-border-DEFAULT text-text-muted hover:text-accent hover:border-accent/40"
          >
            New chat
          </button>
        )}
      </div>
      <p className="text-[11px] text-text-muted mb-2 leading-relaxed">
        Highlight part of an answer to save it as a note. Your chat stays here until you start a new
        one — even if you open a suggested note and come back.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={disabled || loading || saving}
          placeholder={placeholder || 'Ask about this topic…'}
          className="flex-1 bg-bg-tertiary border border-border-DEFAULT rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={disabled || loading || saving || !q.trim()}
          className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-40"
        >
          {loading ? '…' : 'Ask'}
        </button>
      </form>

      {lastQuestion && (
        <p className="mt-3 text-xs text-text-muted">
          <span className="text-text-secondary font-medium">You asked:</span> {lastQuestion}
        </p>
      )}

      {relevantNotes.length > 0 && onOpenSavedNote && (
        <RelevantSavedNotes
          notes={relevantNotes}
          onOpenNote={(n) => onOpenSavedNote(n.id)}
          className="mt-3"
        />
      )}

      {answer && (
        <div className="mt-3 border-t border-border-subtle pt-3">
          <div
            ref={answerRef}
            data-topic-chat-answer
            className="note-chat-md user-select-text"
            onMouseUp={handleAnswerMouseUp}
          >
            <MarkdownView className="markdown-body-chat">{answer}</MarkdownView>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              type="button"
              disabled={disabled || saving}
              onClick={() => saveExcerpt(answer, { isSelection: false })}
              className="text-[11px] px-2 py-0.5 rounded border border-border-DEFAULT text-text-muted hover:text-accent hover:border-accent/40 disabled:opacity-40"
            >
              Save full answer as note
            </button>
          </div>
        </div>
      )}

      {saveNotice && <p className="text-xs text-accent mt-2">{saveNotice}</p>}
    </div>
  );
}
