import React from 'react';
import { useCompactLayout } from '../hooks/useCompactLayout';

/**
 * Scrollable study page frame — tighter padding and typography when compact (half-screen).
 */
export default function StudyPageShell({ children, className = '' }) {
  const compact = useCompactLayout();

  return (
    <div
      className={`h-full flex flex-col overflow-hidden no-drag study-shell ${
        compact ? 'study-shell--compact' : ''
      } ${className}`.trim()}
    >
      <div className="h-8 drag-region flex-shrink-0" />
      <div className="flex-1 overflow-y-auto">
        <div className="study-inner max-w-3xl mx-auto px-4 py-4 pb-12 sm:px-5 lg:px-8 lg:py-6 lg:pb-16">
          {children}
        </div>
      </div>
    </div>
  );
}
