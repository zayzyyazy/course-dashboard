const EPC_API = 'http://127.0.0.1:8765';

/** Fetch per-course practice stats from Exam Practice Coach API. */
export async function fetchEpcPracticeStats() {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(`${EPC_API}/api/practice-stats`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const byVault = {};
    for (const row of data.courses || []) {
      if (row.vault_folder) byVault[row.vault_folder] = row;
    }
    return byVault;
  } catch {
    return null;
  }
}

export function epcStatsForCourse(course, statsByVault) {
  if (!statsByVault || !course) return null;
  const key = course.storageKey || '';
  return statsByVault[key] || null;
}
