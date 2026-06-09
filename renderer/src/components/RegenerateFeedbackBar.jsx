import React, { useState } from 'react';

const CHIPS = [
  { id: 'language_de', label: 'German' },
  { id: 'too_long', label: 'Shorter' },
  { id: 'too_short', label: 'More detail' },
  { id: 'too_complicated', label: 'Too complicated' },
  { id: 'too_theoretical', label: 'More practical' },
  { id: 'too_alarmist', label: 'Less warnings' },
  { id: 'too_shallow', label: 'Go deeper' },
  { id: 'wrong_level', label: 'Wrong level' }
];

/** Optional feedback chips + note before calling regenerate. */
export default function RegenerateFeedbackBar({
  onRegenerate,
  disabled = false,
  busy = false,
  className = ''
}) {
  const [open, setOpen] = useState(false);
  const [presets, setPresets] = useState([]);
  const [text, setText] = useState('');

  function togglePreset(id) {
    setPresets((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  function handleRegenerate() {
    onRegenerate?.({ presets, text: text.trim() });
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => handleRegenerate()}
        className="text-xs px-2.5 py-1 rounded-md border border-accent/50 bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-40"
      >
        {busy ? 'Regenerating…' : 'Regenerate'}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
        className="text-[10px] text-text-muted hover:text-accent"
      >
        {open ? 'Hide feedback' : 'What was wrong?'}
      </button>
      {open && (
        <div className="w-full mt-1 space-y-2 rounded-lg border border-border-subtle bg-bg-primary/40 p-2.5">
          <div className="flex flex-wrap gap-1.5">
            {CHIPS.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={busy}
                onClick={() => togglePreset(c.id)}
                className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
                  presets.includes(c.id)
                    ? 'border-accent bg-accent/20 text-accent'
                    : 'border-border-subtle text-text-muted hover:border-accent/40'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
            placeholder="Optional note (e.g. should be in German)…"
            className="w-full text-xs px-2 py-1.5 rounded-md border border-border-DEFAULT bg-bg-secondary text-text-primary placeholder:text-text-muted"
          />
        </div>
      )}
    </div>
  );
}
