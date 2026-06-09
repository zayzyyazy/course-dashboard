import React, { useEffect, useMemo, useRef, useState } from 'react';
import StudyPageShell from './StudyPageShell';
import MarkdownView from './MarkdownView';
import TitleWithMath from './TitleWithMath';
import RegenerateFeedbackBar from './RegenerateFeedbackBar';
import { coursePayload } from '../utils/courseApi';
import { getRewindMarkdown, formatLastRewind } from '../utils/rewindUi';

export default function LectureRewindView({
  course,
  lecture,
  hasApiKey,
  onBack,
  onLectureUpdated,
  onNotify
}) {
  const [generating, setGenerating] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState('');
  const [localMarkdown, setLocalMarkdown] = useState('');
  const autoStartedRef = useRef(false);

  const rewindStatus = useMemo(
    () => formatLastRewind(lecture?.studyState?.lastRewindAt),
    [lecture?.studyState?.lastRewindAt]
  );

  const { markdown, source } = useMemo(() => getRewindMarkdown(lecture), [lecture]);
  const displayMarkdown = localMarkdown || markdown;

  async function syncLectureFromDisk() {
    if (!lecture?.path) return null;
    const fresh = await window.api.getLecture(lecture.path);
    if (fresh) {
      onLectureUpdated?.(fresh);
      return fresh;
    }
    return null;
  }

  async function handleMarkRead() {
    if (!lecture?.path || marking) return;
    setMarking(true);
    try {
      const updated = await window.api.markRewindRead({ lecturePath: lecture.path });
      if (updated) {
        onLectureUpdated?.({ ...updated, path: lecture.path });
        onNotify?.('Rewind marked as read');
      }
    } finally {
      setMarking(false);
    }
  }

  async function handleGenerate({ force = false, feedback, silent = false } = {}) {
    if (!lecture?.path || generating) return false;
    if (!hasApiKey) {
      setError('Add an API key in Settings to generate a memory-focused Rewind.');
      onNotify?.('Add an API key in Settings');
      return false;
    }
    if (typeof window.api.generateRewind !== 'function') {
      setError('Rewind generation is unavailable — restart the app after updating.');
      return false;
    }

    setGenerating(true);
    setError('');
    try {
      const res = await window.api.generateRewind({
        ...coursePayload(course),
        lecturePath: lecture.path,
        force,
        ...(feedback != null ? { feedback } : {})
      });
      if (res?.success) {
        setLocalMarkdown(res.markdown || '');
        const fresh = await syncLectureFromDisk();
        if (!fresh && res.markdown) {
          onLectureUpdated?.({
            ...lecture,
            path: lecture.path,
            rewind: {
              markdown: res.markdown,
              generatedAt: new Date().toISOString(),
              version: 1
            }
          });
        }
        if (!silent) {
          onNotify?.(force ? 'Rewind regenerated' : 'AI Rewind ready');
        }
        return true;
      }
      const msg = res?.error || 'Could not generate Rewind';
      setError(msg);
      onNotify?.(msg);
      return false;
    } catch (err) {
      const msg = err?.message || 'Could not generate Rewind';
      setError(msg);
      onNotify?.(msg);
      return false;
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    setLocalMarkdown('');
    setError('');
    autoStartedRef.current = false;
  }, [lecture?.path]);

  useEffect(() => {
    if (!lecture?.path || !hasApiKey || source === 'ai' || autoStartedRef.current) return;
    autoStartedRef.current = true;
    handleGenerate({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lecture?.path, hasApiKey, source]);

  return (
    <StudyPageShell>
      <button type="button" onClick={onBack} className="text-xs text-text-muted hover:text-accent mb-3">
        ← Back to lecture
      </button>

      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs font-medium text-accent uppercase tracking-wide mb-1">Weekly rewind</p>
          <h1 className="study-title text-2xl font-bold text-text-primary">
            <TitleWithMath text={lecture?.title || 'Lecture'} />
          </h1>
          <p className="text-sm text-text-muted mt-2 leading-relaxed">
            A short memory refresh — what this lecture covered and what to recall.
          </p>
        </div>
        <span
          className={`text-xs px-2.5 py-1 rounded-full border flex-shrink-0 ${
            rewindStatus.due
              ? 'border-amber-500/40 bg-amber-950/30 text-amber-300'
              : 'border-border-DEFAULT bg-bg-secondary text-text-muted'
          }`}
        >
          {rewindStatus.label}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          type="button"
          disabled={marking}
          onClick={handleMarkRead}
          className="text-sm px-3 py-1.5 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 disabled:opacity-40"
        >
          {marking ? 'Saving…' : 'Mark as read'}
        </button>
        {source === 'ai' ? (
          <RegenerateFeedbackBar
            busy={generating}
            disabled={!hasApiKey}
            onRegenerate={(feedback) => handleGenerate({ force: true, feedback })}
          />
        ) : (
          <button
            type="button"
            disabled={generating}
            onClick={() => handleGenerate({ force: true })}
            className="text-xs px-3 py-1.5 rounded-lg border border-accent/50 bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-40"
          >
            {generating ? 'Generating…' : hasApiKey ? 'Generate AI Rewind' : 'API key needed'}
          </button>
        )}
        {generating && (
          <span className="text-[10px] text-text-muted">Building a memory-focused recap…</span>
        )}
        {!generating && source === 'composed' && !hasApiKey && (
          <span className="text-[10px] text-text-muted">Preview below — add API key for a better Rewind</span>
        )}
        {!generating && source === 'ai' && (
          <span className="text-[10px] text-emerald-400/80">AI Rewind</span>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="study-card rounded-xl border border-border-DEFAULT bg-bg-secondary p-5 relative">
        {generating && !displayMarkdown && (
          <p className="text-sm text-text-muted mb-4">Generating your Rewind…</p>
        )}
        <MarkdownView>{displayMarkdown || '_No rewind content yet._'}</MarkdownView>
        {generating && displayMarkdown && (
          <div className="absolute inset-0 rounded-xl bg-bg-primary/40 pointer-events-none" aria-hidden />
        )}
      </div>
    </StudyPageShell>
  );
}
