import React from 'react';

export default function LectureMaterialSwitch({
  mode,
  onChange,
  hasExercise,
  disabled
}) {
  const tabClass = (active) =>
    `px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
      active ? 'bg-accent text-white shadow-sm' : 'text-text-muted hover:text-text-primary'
    }`;

  return (
    <div className="inline-flex rounded-lg border border-border-DEFAULT p-0.5 bg-bg-tertiary/80 flex-wrap">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('lecture')}
        className={tabClass(mode === 'lecture')}
      >
        Vorlesung
      </button>
      <button
        type="button"
        disabled={disabled || !hasExercise}
        onClick={() => onChange('exercise')}
        title={hasExercise ? 'Exercise / Übung material' : 'Attach an exercise PDF first'}
        className={`${tabClass(mode === 'exercise')} ${
          !hasExercise ? 'opacity-40 cursor-not-allowed' : ''
        }`}
      >
        Übung
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('references')}
        title="Screenshots, links, and study materials for this lecture"
        className={tabClass(mode === 'references')}
      >
        Referenzen
      </button>
    </div>
  );
}
