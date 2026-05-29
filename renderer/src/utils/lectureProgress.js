import { getMaterialTopics } from './lectureMaterial';
import { countLectureUnits, isTopicStudied } from './studyState';

/** Study progress for lecture or exercise topics in the current mode. */
export function computeLectureProgress(lecture, materialMode = 'lecture', exerciseId = '') {
  const topics = getMaterialTopics(lecture, materialMode, exerciseId);
  if (materialMode === 'exercise') {
    const total = topics.length;
    const studied = topics.filter((t) => isTopicStudied(t)).length;
    const remaining = Math.max(0, total - studied);
    const percent = total > 0 ? Math.round((studied / total) * 100) : 0;
    return { total, studied, remaining, percent, unitsTotal: total, unitsStudied: studied };
  }

  const { unitsTotal, unitsStudied, topicsTotal, topicsComplete } = countLectureUnits(topics);
  const remaining = Math.max(0, topicsTotal - topicsComplete);
  const percent = unitsTotal > 0 ? Math.round((unitsStudied / unitsTotal) * 100) : 0;
  return {
    total: topicsTotal,
    studied: topicsComplete,
    remaining,
    percent,
    unitsTotal,
    unitsStudied
  };
}
