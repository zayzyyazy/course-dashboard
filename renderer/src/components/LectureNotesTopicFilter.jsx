import React from 'react';

export default function LectureNotesTopicFilter({ options, value, onChange, totalCount }) {
  if (!options.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-3">
      <span className="text-[10px] uppercase tracking-wide text-text-muted mr-1">Filter by topic</span>
      <button
        type="button"
        onClick={() => onChange('all')}
        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
          value === 'all'
            ? 'border-accent bg-accent/15 text-accent'
            : 'border-border-DEFAULT text-text-muted hover:border-accent/40'
        }`}
      >
        All ({totalCount})
      </button>
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors max-w-[12rem] truncate ${
            value === opt.key
              ? 'border-accent bg-accent/15 text-accent'
              : 'border-border-DEFAULT text-text-muted hover:border-accent/40'
          }`}
          title={opt.topicTitle}
        >
          {opt.topicTitle} ({opt.count})
        </button>
      ))}
    </div>
  );
}
