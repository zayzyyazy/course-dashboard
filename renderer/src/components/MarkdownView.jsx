import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { normalizeMathMarkdown } from '../utils/mathMarkdown';

export default function MarkdownView({ children, className = '' }) {
  const content = useMemo(() => normalizeMathMarkdown(children || ''), [children]);

  return (
    <div className={`markdown-body markdown-body-reading ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
