/** Study progress for a lecture (main topics). */
export function computeLectureProgress(lecture) {
  const topics = lecture?.topics || [];
  const total = topics.length;
  const studied = topics.filter((t) => t.studyState === 'studied').length;
  const remaining = Math.max(0, total - studied);
  const percent = total > 0 ? Math.round((studied / total) * 100) : 0;
  return { total, studied, remaining, percent };
}
