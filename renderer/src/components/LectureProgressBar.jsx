import React from 'react';
import { computeLectureProgress } from '../utils/lectureProgress';

export default function LectureProgressBar({
  lecture,
  materialMode = 'lecture',
  exerciseId = '',
  compact = false,
  className = ''
}) {
  const { total, studied, remaining, percent } = computeLectureProgress(lecture, materialMode, exerciseId);
  const modeLabel = materialMode === 'exercise' ? 'exercise topics' : 'topics';

  if (total === 0) return null;

  return (
    <div className={className}>
      <div className={`flex items-center justify-between gap-2 ${compact ? 'mb-1' : 'mb-2'}`}>
        <span className={`${compact ? 'text-xs' : 'text-sm'} text-text-secondary`}>
          <span className="text-text-primary font-medium">{studied}</span>
          <span className="text-text-muted"> / {total} {modeLabel} studied</span>
        </span>
        <span className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-accent`}>{percent}%</span>
      </div>
      <div className="h-2 rounded-full bg-bg-tertiary overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      {!compact && remaining > 0 && (
        <p className="text-xs text-text-muted mt-1.5">
          {remaining} topic{remaining === 1 ? '' : 's'} left to study
        </p>
      )}
      {!compact && remaining === 0 && total > 0 && (
        <p className="text-xs text-accent mt-1.5">All topics marked studied</p>
      )}
    </div>
  );
}
