import React, { useMemo } from 'react';
import MarkdownView from './MarkdownView';
import { prepareStudyMarkdown } from '../utils/prepareStudyMarkdown';

export default function ReadableStudyContent({ children, className = '' }) {
  const content = useMemo(() => prepareStudyMarkdown(children || ''), [children]);

  return (
    <div className={`study-reading-panel prose-note ${className}`.trim()}>
      <MarkdownView variant="study">{content}</MarkdownView>
    </div>
  );
}
