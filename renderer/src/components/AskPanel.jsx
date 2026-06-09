import React, { useState, useEffect } from 'react';
import MarkdownView from './MarkdownView';
import RelevantSavedNotes from './RelevantSavedNotes';
import { getAskChat, setAskChat, clearAskChat } from '../utils/askChatStore';

export default function AskPanel({ chatKey, onAsk, onOpenSavedNote, disabled, placeholder }) {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastQuestion, setLastQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [relevantNotes, setRelevantNotes] = useState([]);

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

  function handleNewChat() {
    if (chatKey) clearAskChat(chatKey);
    setQ('');
    setLastQuestion('');
    setAnswer('');
    setRelevantNotes([]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!q.trim() || loading) return;
    const question = q.trim();
    setLoading(true);
    setAnswer('');
    setRelevantNotes([]);
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
      <div className="flex items-center justify-between gap-2 mb-2">
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
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={disabled || loading}
          placeholder={placeholder || 'Ask about this lecture or topic…'}
          className="flex-1 bg-bg-tertiary border border-border-DEFAULT rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={disabled || loading || !q.trim()}
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
          <MarkdownView className="markdown-body-study-chat">{answer}</MarkdownView>
        </div>
      )}
    </div>
  );
}
