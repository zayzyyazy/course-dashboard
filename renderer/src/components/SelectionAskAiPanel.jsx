import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { coursePayload } from '../utils/courseApi';
import HighlightPreviewText from './HighlightPreviewText';
import MarkdownView from './MarkdownView';

const SUGGESTED = [
  'Was bedeutet das?',
  'Einfacher erklären',
  'Ist das korrekt?',
  'Was fehlt hier?',
  'Beispiel geben'
];

export default function SelectionAskAiPanel({
  selectedText,
  askContext,
  anchorX = 120,
  anchorY = 120,
  onClose
}) {
  const [x, setX] = useState(() => Math.min(anchorX, window.innerWidth - 400));
  const [y, setY] = useState(() => Math.min(anchorY, window.innerHeight - 120));
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dragRef = useRef(null);

  const startDrag = useCallback(
    (e) => {
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startY: e.clientY, origX: x, origY: y };
    },
    [x, y]
  );

  useEffect(() => {
    function onMove(e) {
      if (!dragRef.current) return;
      const d = dragRef.current;
      setX(Math.max(8, Math.min(window.innerWidth - 320, d.origX + (e.clientX - d.startX))));
      setY(Math.max(8, Math.min(window.innerHeight - 80, d.origY + (e.clientY - d.startY))));
    }
    function onUp() {
      dragRef.current = null;
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  async function sendQuestion(q) {
    const text = String(q ?? question).trim();
    if (!text || loading) return;
    if (!askContext?.lecturePath) {
      setError('Missing lecture context');
      return;
    }
    setLoading(true);
    setError('');
    setAnswer('');
    try {
      const res = await window.api.askAboutSelection({
        ...coursePayload(askContext.course),
        lecturePath: askContext.lecturePath,
        topicId: askContext.topicId || '',
        materialMode: askContext.materialMode || 'lecture',
        selectedText,
        question: text,
        lectureTitle: askContext.lectureTitle || '',
        topicTitle: askContext.topicTitle || '',
        subtopicTitle: askContext.subtopicTitle || '',
        noteTitle: askContext.noteTitle || ''
      });
      if (res?.success) setAnswer(res.answer || '');
      else setError(res?.error || 'Could not get an answer');
    } catch (err) {
      setError(err?.message || 'Could not get an answer');
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-label="Ask AI about selection"
      className="fixed z-[250] w-[min(420px,calc(100vw-24px))] flex flex-col rounded-xl border border-accent/35 bg-bg-secondary/98 shadow-2xl backdrop-blur-sm overflow-hidden"
      style={{ left: x, top: y }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle bg-bg-primary/70 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={startDrag}
      >
        <span className="text-[10px] text-text-muted">⋮⋮</span>
        <p className="text-xs font-medium text-accent flex-1">Ask AI · selection</p>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-text-muted hover:text-red-400 px-1"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="max-h-[72px] overflow-y-auto px-3 py-2 border-b border-border-subtle/80 bg-bg-primary/30">
        <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Selected</p>
        <HighlightPreviewText text={selectedText} className="text-xs text-text-secondary" />
      </div>

      <div className="px-3 py-2 flex flex-wrap gap-1.5">
        {SUGGESTED.map((s) => (
          <button
            key={s}
            type="button"
            disabled={loading}
            onClick={() => {
              setQuestion(s);
              sendQuestion(s);
            }}
            className="text-[10px] px-2 py-1 rounded-md border border-border-subtle text-text-muted hover:text-accent hover:border-accent/40 disabled:opacity-40"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="px-3 pb-2 flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendQuestion()}
          placeholder="Frage zur Auswahl…"
          disabled={loading}
          className="flex-1 min-w-0 text-sm px-2.5 py-1.5 rounded-lg border border-border-DEFAULT bg-bg-primary text-text-primary placeholder:text-text-muted disabled:opacity-50"
        />
        <button
          type="button"
          disabled={loading || !question.trim()}
          onClick={() => sendQuestion()}
          className="text-xs px-3 py-1.5 rounded-lg bg-accent text-white font-medium disabled:opacity-40"
        >
          {loading ? '…' : 'Send'}
        </button>
      </div>

      <div className="min-h-[4rem] max-h-[220px] overflow-y-auto px-3 pb-3 border-t border-border-subtle/60">
        {loading && (
          <p className="text-xs text-text-muted py-2 animate-pulse">Thinking about your selection…</p>
        )}
        {error && !loading && (
          <p className="text-xs text-red-400/90 py-2">{error}</p>
        )}
        {answer && !loading && (
          <div className="pt-2 prose-note">
            <MarkdownView className="markdown-body-study-chat">{answer}</MarkdownView>
          </div>
        )}
        {!loading && !error && !answer && (
          <p className="text-[10px] text-text-muted py-2">Ask about the highlighted text only.</p>
        )}
      </div>
    </div>,
    document.body
  );
}
