import React from 'react';

/**
 * High-contrast studied toggle — pending (muted/amber outline) vs done (emerald fill).
 */
export default function StudiedToggleButton({
  studied = false,
  loading = false,
  onClick,
  size = 'default',
  className = ''
}) {
  const pad = size === 'compact' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1.5 text-xs';

  const base = `${pad} rounded-lg border font-semibold transition-all duration-200 disabled:opacity-60`;

  const studiedCls =
    'border-emerald-400/80 bg-emerald-600/35 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.25)] hover:bg-emerald-600/45';

  const pendingCls =
    'border-slate-600/50 bg-bg-primary/50 text-text-muted hover:border-slate-500/70 hover:text-text-secondary';

  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      title={studied ? 'Click to mark as not studied' : 'Click to mark as studied'}
      className={`${base} ${studied ? studiedCls : pendingCls} ${className}`}
    >
      {loading ? (
        <span className="opacity-80">Updating…</span>
      ) : studied ? (
        <span className="inline-flex items-center gap-1">
          <span className="text-emerald-400" aria-hidden>
            ✓
          </span>
          Studied
        </span>
      ) : (
        <span className="inline-flex items-center gap-1">
          <span className="text-amber-500/90" aria-hidden>
            ○
          </span>
          Mark studied
        </span>
      )}
    </button>
  );
}

export function subtopicCardStudiedClasses(studied) {
  return studied
    ? 'border-emerald-500/55 bg-emerald-950/25 shadow-[inset_4px_0_0_0_rgba(52,211,153,0.75)] ring-1 ring-emerald-900/30'
    : 'border-border-DEFAULT/80 bg-bg-secondary/60 opacity-[0.97] hover:border-slate-600/40';
}
