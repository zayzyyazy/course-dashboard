import React, { useEffect, useState } from 'react';

export default function ReferenceCard({
  item,
  lecturePath,
  onEdit,
  onDelete,
  onOpen,
  onOpenLink,
  onDescribe,
  describing,
  hasApiKey
}) {
  const [thumbUrl, setThumbUrl] = useState('');
  const [thumbError, setThumbError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (item.type !== 'image' || !item.fileName) {
      setThumbUrl('');
      return undefined;
    }
    window.api
      .getReferenceAsset({ lecturePath, fileName: item.fileName })
      .then((res) => {
        if (!cancelled && res?.success) setThumbUrl(res.dataUrl);
        else if (!cancelled) setThumbError(true);
      })
      .catch(() => {
        if (!cancelled) setThumbError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [item.id, item.fileName, item.type, lecturePath]);

  const isLink = item.type === 'link';
  const isText = item.type === 'text';

  return (
    <article className="rounded-xl border border-border-DEFAULT bg-bg-secondary overflow-hidden flex flex-col">
      {isLink ? (
        <button
          type="button"
          onClick={() => onOpen?.(item)}
          className="text-left px-4 py-3 border-b border-border-subtle hover:bg-bg-primary/30 transition-colors"
        >
          <p className="text-[10px] uppercase tracking-wide text-accent mb-1">Link</p>
          <p className="text-sm font-medium text-text-primary truncate">
            {item.title || item.url}
          </p>
          <p className="text-[11px] text-text-muted truncate mt-0.5">{item.url}</p>
        </button>
      ) : isText ? (
        <button
          type="button"
          onClick={() => onOpen?.(item)}
          className="text-left w-full px-4 py-3 border-b border-border-subtle bg-bg-primary/20 hover:bg-bg-primary/30 transition-colors"
        >
          <p className="text-[10px] uppercase tracking-wide text-accent mb-1">Text</p>
          <p className="text-sm font-medium text-text-primary line-clamp-2">
            {item.title || 'Pasted note'}
          </p>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onOpen?.(item)}
          className="relative w-full bg-bg-primary/40 border-b border-border-subtle min-h-[120px] max-h-48 flex items-center justify-center overflow-hidden hover:bg-bg-primary/50 transition-colors"
        >
          {thumbUrl ? (
            <img
              src={thumbUrl}
              alt={item.title || 'Reference image'}
              className="w-full h-full max-h-48 object-contain"
            />
          ) : (
            <p className="text-xs text-text-muted p-4">
              {thumbError ? 'Could not load image' : 'Loading…'}
            </p>
          )}
        </button>
      )}

      <div className="p-3 flex-1 flex flex-col gap-2">
        {!isLink && !isText && item.title && (
          <p className="text-sm font-medium text-text-primary line-clamp-2">{item.title}</p>
        )}
        {isText && item.body ? (
          <p className="text-xs text-text-secondary leading-relaxed line-clamp-5 whitespace-pre-wrap">
            {item.body}
          </p>
        ) : null}
        {item.description ? (
          <p className="text-xs text-text-secondary leading-relaxed line-clamp-4">{item.description}</p>
        ) : (
          !isText || !item.body ? (
            <p className="text-[11px] text-text-muted italic">No caption yet</p>
          ) : null
        )}

        <div className="flex flex-wrap gap-2 mt-auto pt-1">
          <button
            type="button"
            onClick={() => onOpen?.(item)}
            className="text-[11px] text-accent hover:underline"
          >
            Open
          </button>
          <button
            type="button"
            onClick={() => onEdit?.(item)}
            className="text-[11px] text-text-muted hover:text-accent"
          >
            Edit
          </button>
          {hasApiKey && (
            <button
              type="button"
              disabled={describing}
              onClick={() => onDescribe?.(item)}
              className="text-[11px] text-text-muted hover:text-accent disabled:opacity-40"
            >
              {describing ? 'Describing…' : 'Describe with AI'}
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete?.(item.id)}
            className="text-[11px] text-red-400/80 hover:text-red-400"
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}
