import React from 'react';

export default function LectureMaterialSwitch({ mode, onChange, hasExercise, disabled }) {
  return (
    <div className="inline-flex rounded-lg border border-border-DEFAULT p-0.5 bg-bg-tertiary/80">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('lecture')}
        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
          mode === 'lecture'
            ? 'bg-accent text-white shadow-sm'
            : 'text-text-muted hover:text-text-primary'
        }`}
      >
        Vorlesung
      </button>
      <button
        type="button"
        disabled={disabled || !hasExercise}
        onClick={() => onChange('exercise')}
        title={hasExercise ? 'Exercise / Übung material' : 'Attach an exercise PDF first'}
        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
          mode === 'exercise'
            ? 'bg-accent text-white shadow-sm'
            : hasExercise
              ? 'text-text-muted hover:text-text-primary'
              : 'text-text-muted/40 cursor-not-allowed'
        }`}
      >
        Übung
      </button>
    </div>
  );
}
