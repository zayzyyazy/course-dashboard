import React from 'react';
import { normalizeConfidence } from '../utils/studyState';

const LABELS = {
  low: 'Low',
  medium: 'Med',
  high: 'High'
};

const STYLES = {
  unset: 'border-border-subtle text-text-muted hover:border-slate-500',
  low: 'border-amber-800/50 text-amber-300/90 bg-amber-950/25',
  medium: 'border-sky-800/50 text-sky-300/90 bg-sky-950/25',
  high: 'border-emerald-700/50 text-emerald-300/90 bg-emerald-950/30'
};

/** Cycle: unset → low → medium → high → unset */
export default function SubtopicConfidence({ value, loading, onCycle }) {
  const c = normalizeConfidence(value);
  const key = c || 'unset';

  return (
    <button
      type="button"
      disabled={loading}
      onClick={onCycle}
      title="How confident you feel (tap to cycle)"
      className={`text-[10px] px-2 py-0.5 rounded-md border font-medium transition-colors disabled:opacity-50 ${STYLES[key]}`}
    >
      {loading ? '…' : c ? `Confidence · ${LABELS[c]}` : 'Set confidence'}
    </button>
  );
}
