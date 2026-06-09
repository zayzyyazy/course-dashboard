import { getRewindMarkdown } from '@shared/rewindCompose.cjs';

export { getRewindMarkdown };

export const REWIND_DUE_DAYS = 7;

export function daysSince(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const then = new Date(d);
  then.setHours(0, 0, 0, 0);
  return Math.floor((now - then) / (24 * 60 * 60 * 1000));
}

export function formatLastRewind(lastRewindAt) {
  if (!lastRewindAt) {
    return { label: 'Not read yet', due: true, days: null };
  }
  const days = daysSince(lastRewindAt);
  if (days === null) {
    return { label: 'Not read yet', due: true, days: null };
  }
  if (days === 0) {
    return { label: 'Last read today', due: false, days: 0 };
  }
  if (days === 1) {
    return { label: 'Last read yesterday', due: false, days: 1 };
  }
  if (days >= REWIND_DUE_DAYS) {
    return { label: `Due for rewind (${days} days ago)`, due: true, days };
  }
  return { label: `Last read ${days} days ago`, due: false, days };
}

export function isRewindDue(lastRewindAt) {
  return formatLastRewind(lastRewindAt).due;
}
