import React, { useState } from 'react';

export default function AskPanel({ onAsk, disabled, placeholder }) {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!q.trim() || loading) return;
    setLoading(true);
    setAnswer('');
    const result = await onAsk(q.trim());
    setLoading(false);
    if (result?.success) setAnswer(result.answer);
    else setAnswer(result?.error || 'Could not get an answer.');
  }

  return (
    <div className="rounded-xl border border-border-DEFAULT bg-bg-secondary/80 p-4">
      <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Ask tutor</p>
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
      {answer && (
        <div className="mt-3 text-sm text-text-secondary leading-relaxed whitespace-pre-wrap border-t border-border-subtle pt-3">
          {answer}
        </div>
      )}
    </div>
  );
}
