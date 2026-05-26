import React, { useRef, useEffect, useState } from 'react';

export default function NoteChatPanel({ onAsk, disabled, placeholder }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function handleSubmit(e) {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading || disabled) return;
    setInput('');
    const userMsg = { role: 'user', text: q };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    const history = messages.map((m) => ({ role: m.role, content: m.text }));
    const result = await onAsk(q, history);
    setLoading(false);
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        text: result?.success ? result.answer : result?.error || 'Could not get an answer.'
      }
    ]);
  }

  const suggestions = [
    'Explain my note more clearly',
    'What does this formula mean?',
    'What am I missing here?',
    'Give an example for this point'
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2 flex-shrink-0">
        Ask about this note
      </p>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 mb-3 pr-1">
        {messages.length === 0 && !loading && (
          <div className="space-y-2">
            <p className="text-xs text-text-muted leading-relaxed">
              AI is grounded in your note first, then the topic, lecture, and course.
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
        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-sm leading-relaxed whitespace-pre-wrap rounded-lg px-3 py-2 ${
              m.role === 'user'
                ? 'bg-accent/15 text-text-primary ml-4'
                : 'bg-bg-tertiary text-text-secondary mr-2'
            }`}
          >
            {m.text}
          </div>
        ))}
        {loading && (
          <p className="text-xs text-text-muted animate-pulse">Thinking…</p>
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 flex-shrink-0">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={disabled || loading}
          placeholder={placeholder || 'Ask about this note…'}
          className="flex-1 bg-bg-tertiary border border-border-DEFAULT rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={disabled || loading || !input.trim()}
          className="px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
