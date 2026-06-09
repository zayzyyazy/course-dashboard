import React, { useEffect, useState } from 'react';
import ReadableStudyContent from './ReadableStudyContent';
import NoteChatPanel from './NoteChatPanel';
import { coursePayload } from '../utils/courseApi';

const TYPE_LABEL = { link: 'Link', text: 'Text', image: 'Image' };

export default function ReferenceDetailView({
  item,
  course,
  lecture,
  hasApiKey,
  onClose,
  onOpenLink
}) {
  const [imageUrl, setImageUrl] = useState('');
  const [imageError, setImageError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (item?.type !== 'image' || !item.fileName || !lecture?.path) {
      setImageUrl('');
      setImageError('');
      return undefined;
    }
    window.api
      .getReferenceAsset({ lecturePath: lecture.path, fileName: item.fileName })
      .then((res) => {
        if (cancelled) return;
        if (res?.success) {
          setImageUrl(res.dataUrl);
          setImageError('');
        } else {
          setImageError(res?.error || 'Could not load image');
        }
      })
      .catch((err) => {
        if (!cancelled) setImageError(err.message || 'Could not load image');
      });
    return () => {
      cancelled = true;
    };
  }, [item?.id, item?.fileName, item?.type, lecture?.path]);

  if (!item) return null;

  const label = TYPE_LABEL[item.type] || 'Reference';

  return (
    <div className="fixed inset-0 z-[80] bg-bg-primary flex flex-col no-drag">
      <div className="h-8 drag-region flex-shrink-0" />
      <header className="flex items-center justify-between gap-4 px-6 py-3 border-b border-border-DEFAULT flex-shrink-0">
        <div className="min-w-0">
          <p className="text-xs text-text-muted uppercase tracking-wide">{label} · Referenzen</p>
          <h1 className="text-lg font-semibold text-text-primary truncate">
            {item.title || (item.type === 'link' ? item.url : label)}
          </h1>
          <p className="text-xs text-text-muted truncate">
            {course?.name} · {lecture?.title}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {item.type === 'link' && item.url && (
            <button
              type="button"
              onClick={() => onOpenLink?.(item.url)}
              className="px-3 py-1.5 rounded-lg border border-border-DEFAULT text-xs text-text-secondary hover:text-accent"
            >
              Open in browser
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-bg-tertiary border border-border-DEFAULT text-xs text-text-primary hover:border-accent/40"
          >
            ← Back
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border-DEFAULT">
        <div className="overflow-y-auto p-6 lg:p-8">
          {item.description && (
            <p className="study-reading-caption mb-5 border-l-2 border-accent/40 pl-4">
              {item.description}
            </p>
          )}

          {item.type === 'text' && (
            <div className="rounded-xl border border-border-subtle bg-bg-secondary/50 p-5 lg:p-6">
              <ReadableStudyContent>{item.body}</ReadableStudyContent>
            </div>
          )}

          {item.type === 'link' && (
            <div className="rounded-xl border border-border-subtle bg-bg-secondary/50 p-4 space-y-2">
              <p className="text-xs text-text-muted uppercase tracking-wide">URL</p>
              <a
                href={item.url}
                onClick={(e) => {
                  e.preventDefault();
                  onOpenLink?.(item.url);
                }}
                className="text-sm text-accent break-all hover:underline"
              >
                {item.url}
              </a>
            </div>
          )}

          {item.type === 'image' && (
            <div className="rounded-xl border border-border-subtle bg-bg-secondary/30 p-2 flex items-center justify-center min-h-[200px]">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={item.title || 'Reference image'}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                />
              ) : (
                <p className="text-sm text-text-muted p-6">
                  {imageError || 'Loading image…'}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="p-6 min-h-0 flex flex-col bg-bg-secondary/30">
          {!hasApiKey ? (
            <p className="text-sm text-text-muted">
              Add an API key in Settings to ask AI about this reference.
            </p>
          ) : (
            <NoteChatPanel
              variant="reference"
              disabled={!lecture?.path}
              placeholder="e.g. explain this screenshot, summarize this note…"
              onAsk={(question, history) =>
                window.api.askAboutReference({
                  lecturePath: lecture.path,
                  id: item.id,
                  question,
                  history,
                  ...coursePayload(course)
                })
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
