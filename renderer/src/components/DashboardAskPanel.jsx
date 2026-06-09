import React, { useEffect, useState } from 'react';
import MarkdownView from './MarkdownView';
import { getAskChat, setAskChat, clearAskChat } from '../utils/askChatStore';

const CHAT_KEY = 'dashboard:study-plan';

const SUGGESTIONS = [
  'Which course has the deepest material?',
  'What topics will take longest to grasp?',
  'How might my exams look based on the content?',
  'What topics connect and build on each other?',
  'What Übungen match the hardest topics?',
  'What should I study right now?'
];

export default function DashboardAskPanel({ hasApiKey, topPick, onOpenTarget, onOpenSettings }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastQuestion, setLastQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [answerTopPick, setAnswerTopPick] = useState(null);

  useEffect(() => {
    const saved = getAskChat(CHAT_KEY);
    if (saved) {
      setLastQuestion(saved.lastQuestion || '');
      setAnswer(saved.answer || '');
    }
  }, []);

  useEffect(() => {
    if (!answer && !lastQuestion) return;
    setAskChat(CHAT_KEY, { lastQuestion, answer, relevantNotes: [] });
  }, [lastQuestion, answer]);

  function handleNewChat() {
    clearAskChat(CHAT_KEY);
    setQ('');
    setLastQuestion('');
    setAnswer('');
    setAnswerTopPick(null);
  }

  async function handleSubmit(e) {
    e?.preventDefault?.();
    if (!q.trim() || loading || !hasApiKey) return;
    const question = q.trim();
    setLoading(true);
    setAnswer('');
    setAnswerTopPick(null);
    setLastQuestion(question);
    try {
      const result = await window.api.askDashboard({ question });
      if (result?.success) {
        setAnswer(result.answer);
        setAnswerTopPick(result.topPick || null);
      } else {
        setAnswer(result?.error || 'Could not get an answer.');
      }
    } catch {
      setAnswer('Could not get an answer.');
    } finally {
      setLoading(false);
      setQ('');
    }
  }

  function applySuggestion(text) {
    setQ(text);
    if (!open) setOpen(true);
  }

  const showOpenStep = (answerTopPick || topPick) && onOpenTarget;

  return (
    <section className="mb-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 rounded-xl border border-border-DEFAULT bg-bg-secondary/60 px-4 py-3 text-left hover:border-accent/35 transition-colors"
      >
        <div>
          <p className="text-sm font-medium text-text-primary">Ask about my study plan</p>
          <p className="text-[11px] text-text-muted mt-0.5">
            Real answers from your progress, exams, and next steps
          </p>
        </div>
        <span className="text-text-muted text-sm flex-shrink-0" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-border-subtle bg-bg-secondary/40 p-4">
          {!hasApiKey ? (
            <p className="text-sm text-text-muted">
              Add an API key in{' '}
              <button
                type="button"
                onClick={onOpenSettings}
                className="text-accent hover:underline"
              >
                Settings
              </button>{' '}
              to use Ask AI.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={loading}
                    onClick={() => applySuggestion(s)}
                    className="text-[10px] px-2 py-0.5 rounded-md border border-border-subtle text-text-muted hover:border-accent/40 hover:text-accent disabled:opacity-40"
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-[10px] font-medium text-text-muted uppercase tracking-wide">
                  Study coach
                </p>
                {(lastQuestion || answer) && (
                  <button
                    type="button"
                    onClick={handleNewChat}
                    className="text-[10px] px-2 py-0.5 rounded border border-border-DEFAULT text-text-muted hover:text-accent"
                  >
                    New chat
                  </button>
                )}
              </div>

              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  disabled={loading}
                  placeholder="e.g. What should I focus on this week?"
                  className="flex-1 bg-bg-tertiary border border-border-DEFAULT rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  disabled={loading || !q.trim()}
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

              {answer && (
                <div className="mt-3 border-t border-border-subtle pt-3">
                  <MarkdownView className="markdown-body-study-chat">{answer}</MarkdownView>
                  {showOpenStep && (
                    <button
                      type="button"
                      onClick={() => onOpenTarget(answerTopPick || topPick)}
                      className="mt-3 text-xs text-accent hover:underline"
                    >
                      Open best next step →
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
