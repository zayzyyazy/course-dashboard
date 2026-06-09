/** Vault folders wired to Exam Practice Coach (Mathe, Python/GPT, Statistik). */
export const EPC_VAULT_KEYS = new Set(['Mathe', 'GPT', 'Statistik_2']);

const EPC_NAME_TO_VAULT = {
  GPT: 'GPT',
  Python: 'GPT',
  Mathe: 'Mathe',
  'Mathematische Strukturen': 'Mathe',
  Statistik: 'Statistik_2',
  'Statistik 2': 'Statistik_2'
};

/** Resolve CD course → vault folder used by Exercise Coach deep links. */
export function resolveEpcVaultKey(course) {
  const key = (course?.storageKey || '').trim();
  if (EPC_VAULT_KEYS.has(key)) return key;
  const byName = EPC_NAME_TO_VAULT[course?.name || ''];
  if (byName) return byName;
  const normalized = key.replace(/\s+/g, '_');
  if (EPC_VAULT_KEYS.has(normalized)) return normalized;
  return null;
}

export function courseHasPracticeCoach(course) {
  return Boolean(resolveEpcVaultKey(course));
}

/** Open Exercise Coach desktop app with the right topic (not Safari). */
export async function openPracticeCoach(opts, onNotify) {
  const vault = resolveEpcVaultKey({ storageKey: opts.courseStorageKey, name: opts.courseName }) || opts.courseStorageKey || '';
  const payload = {
    vault,
    unit: opts.unitId || '',
    topic: opts.topicId || '',
    subtopic: opts.subtopicId || '',
    exercise: opts.exerciseId || '',
    mode: opts.mode || 'lecture'
  };

  if (window.api?.openExerciseCoach) {
    const res = await window.api.openExerciseCoach(payload);
    if (!res?.success) {
      const msg = res?.error || 'Could not open Exercise Coach';
      onNotify?.(msg);
      throw new Error(msg);
    }
    if (res?.message) onNotify?.(res.message);
    return;
  }

  onNotify?.('Exercise Coach launcher not available — restart Course Dashboard');
}
