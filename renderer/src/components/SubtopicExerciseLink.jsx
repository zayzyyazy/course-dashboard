import React from 'react';
import TitleWithMath from './TitleWithMath';

/** Compact lecture subtopic → Übung practice link. */
export default function SubtopicExerciseLink({ link, onOpen }) {
  if (!link?.exerciseTopicId) return null;

  return (
    <div className="mt-2.5 rounded-md border border-emerald-800/45 bg-emerald-950/20 px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400/90">
        Related Übung
      </p>
      <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">{link.note}</p>
      <button
        type="button"
        onClick={() => onOpen?.(link)}
        className="mt-1.5 text-[11px] px-2 py-1 rounded-md border border-emerald-600/50 bg-emerald-900/25 text-emerald-300 font-medium hover:bg-emerald-900/40"
      >
        Open · <TitleWithMath text={link.exerciseSubtopicTitle} className="inline" />
      </button>
    </div>
  );
}
