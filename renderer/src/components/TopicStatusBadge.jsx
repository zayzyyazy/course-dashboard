import React from 'react';
import { hasSubtopics, subtopicsProgress, topicStudyStatus } from '../utils/studyState';

export default function TopicStatusBadge({ topic, compact = false }) {
  const status = topicStudyStatus(topic);
  const subProgress = hasSubtopics(topic) ? subtopicsProgress(topic) : null;

  const styles = {
    not_started: 'border-border-subtle bg-bg-hover/50 text-text-muted',
    in_progress: 'border-amber-800/45 bg-amber-950/20 text-amber-200/90',
    complete: 'border-emerald-600/45 bg-emerald-600/15 text-emerald-300'
  };

  const labels = {
    not_started: 'Not started',
    in_progress: subProgress
      ? `In progress · ${subProgress.studied}/${subProgress.total}`
      : 'In progress',
    complete: subProgress ? `Complete · ${subProgress.total}/${subProgress.total}` : 'Complete'
  };

  return (
    <span
      className={`${compact ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'} rounded-full border font-medium ${styles[status]}`}
    >
      {status === 'complete' ? '✓ ' : ''}
      {labels[status]}
    </span>
  );
}
