import React, { useEffect, useState } from 'react';

export default function AddReferenceModal({
  mode = 'link',
  item = null,
  hasApiKey,
  onSaveLink,
  onSaveEdit,
  onDescribe,
  onCancel
}) {
  const isEdit = Boolean(item);
  const [url, setUrl] = useState(item?.url || '');
  const [title, setTitle] = useState(item?.title || '');
  const [description, setDescription] = useState(item?.description || '');
  const [body, setBody] = useState(item?.body || '');
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setUrl(item?.url || '');
    setTitle(item?.title || '');
    setDescription(item?.description || '');
    setBody(item?.body || '');
    setError('');
  }, [item, mode]);

  async function handleSave() {
    setBusy(true);
    setError('');
    try {
      if (isEdit) {
        await onSaveEdit?.({
          title,
          description,
          url: item.type === 'link' ? url : undefined,
          body: item.type === 'text' ? body : undefined
        });
      } else {
        await onSaveLink?.({ url, title, description });
      }
    } catch (err) {
      setError(err.message || 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  async function handleDescribe() {
    if (!hasApiKey || !item) return;
    setAiBusy(true);
    setError('');
    try {
      const res = await onDescribe?.(item.id);
      if (res?.item) {
        setTitle(res.item.title || '');
        setDescription(res.item.description || '');
      } else if (res?.error) {
        setError(res.error);
      }
    } catch (err) {
      setError(err.message || 'AI describe failed');
    } finally {
      setAiBusy(false);
    }
  }

  const showUrl = !isEdit || item?.type === 'link';
  const showBody = isEdit && item?.type === 'text';
  const heading =
    isEdit && item?.type === 'text'
      ? 'Edit text note'
      : isEdit
        ? 'Edit reference'
        : 'Add link';
  const subtext =
    isEdit && item?.type === 'text'
      ? 'Update the pasted note or caption. Saved to this lecture only.'
      : isEdit
        ? 'Update the caption or link. Saved to this lecture only.'
        : 'Paste a YouTube or web URL — optional caption below.';

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center no-drag p-4">
      <div className="bg-bg-secondary border border-border-DEFAULT rounded-xl w-full max-w-md p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-text-primary mb-1">{heading}</h2>
        <p className="text-xs text-text-muted mb-4">{subtext}</p>

        {showUrl && (
          <label className="block mb-3">
            <span className="text-xs text-text-muted uppercase tracking-wide">URL</span>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={busy || (isEdit && item?.type !== 'link')}
              placeholder="https://youtube.com/…"
              className="mt-1 w-full bg-bg-tertiary border border-border-DEFAULT rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent disabled:opacity-50"
            />
          </label>
        )}

        {showBody && (
          <label className="block mb-3">
            <span className="text-xs text-text-muted uppercase tracking-wide">Text</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              disabled={busy}
              className="mt-1 w-full bg-bg-tertiary border border-border-DEFAULT rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-y disabled:opacity-50"
            />
          </label>
        )}

        <label className="block mb-3">
          <span className="text-xs text-text-muted uppercase tracking-wide">Title (optional)</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
            className="mt-1 w-full bg-bg-tertiary border border-border-DEFAULT rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent disabled:opacity-50"
          />
        </label>

        <label className="block mb-4">
          <span className="text-xs text-text-muted uppercase tracking-wide">Caption</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            disabled={busy}
            placeholder="Why this helps for studying…"
            className="mt-1 w-full bg-bg-tertiary border border-border-DEFAULT rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-y disabled:opacity-50"
          />
        </label>

        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

        {isEdit && hasApiKey && (
          <button
            type="button"
            onClick={handleDescribe}
            disabled={busy || aiBusy}
            className="mb-3 text-xs text-accent hover:underline disabled:opacity-40"
          >
            {aiBusy ? 'Generating caption…' : 'Describe with AI'}
          </button>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 text-sm text-text-muted disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy || (!isEdit && !url.trim()) || (isEdit && item?.type === 'text' && !body.trim())}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-40"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
