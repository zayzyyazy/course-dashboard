import React from 'react';

/** Übung 1 / Übung 2 … sheet chooser on the lecture page. */
export default function ExerciseSheetPicker({
  sheets,
  selectedId,
  onSelect,
  onAdd,
  canAdd = false,
  adding = false
}) {
  if (!sheets?.length) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {sheets.map((sheet, index) => {
        const label = sheet.label || `Übung ${index + 1}`;
        const active = sheet.id === selectedId;
        return (
          <button
            key={sheet.id}
            type="button"
            onClick={() => onSelect(sheet.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              active
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-border-DEFAULT text-text-muted hover:text-accent hover:border-accent/40'
            }`}
          >
            {label}
          </button>
        );
      })}
      {canAdd && (
        <button
          type="button"
          disabled={adding}
          onClick={onAdd}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-dashed border-accent/50 text-accent hover:bg-accent/10 disabled:opacity-40"
          title="Attach another exercise PDF"
        >
          {adding ? '…' : '+ Übung'}
        </button>
      )}
    </div>
  );
}
