import { LABELS, SHORT, resolveDepth } from '@shared/studyDepth.cjs';

export { LABELS, SHORT, resolveDepth };

export function depthBadgeClass(depth) {
  switch (depth) {
    case 'low':
      return 'bg-bg-hover text-text-muted border-border-subtle';
    case 'medium':
      return 'bg-sky-950/40 text-sky-300/90 border-sky-800/40';
    case 'high':
      return 'bg-accent/15 text-accent border-accent/30';
    case 'examHeavy':
      return 'bg-emerald-950/40 text-emerald-300/90 border-emerald-800/40';
    default:
      return 'bg-bg-hover text-text-muted border-border-subtle';
  }
}

const COMPACT = {
  low: 'Low',
  medium: 'Med',
  high: 'High',
  examHeavy: 'Exam'
};

export function StudyDepthBadge({ item, parentImportance, compact = false, className = '' }) {
  const depth = resolveDepth(item, parentImportance);
  const label = LABELS[depth] || depth;
  const hint = SHORT[depth];

  return (
    <span
      title={`Likely focus (estimate): ${hint}`}
      className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${depthBadgeClass(depth)} ${className}`}
    >
      {compact ? COMPACT[depth] || label : label}
    </span>
  );
}
