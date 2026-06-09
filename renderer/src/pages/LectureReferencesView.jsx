import React, { useCallback, useEffect, useState } from 'react';
import { coursePayload } from '../utils/courseApi';
import ReferenceCard from '../components/ReferenceCard';
import AddReferenceModal from '../components/AddReferenceModal';
import PasteTextModal from '../components/PasteTextModal';
import ReferenceDetailView from '../components/ReferenceDetailView';

export default function LectureReferencesView({
  course,
  lecture,
  hasApiKey,
  onNotify
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [describingId, setDescribingId] = useState('');
  const [addLinkOpen, setAddLinkOpen] = useState(false);
  const [pasteTextOpen, setPasteTextOpen] = useState(false);
  const [pasteInitialText, setPasteInitialText] = useState('');
  const [editItem, setEditItem] = useState(null);
  const [viewItem, setViewItem] = useState(null);

  const lecturePath = lecture?.path;

  const loadReferences = useCallback(async () => {
    if (!lecturePath) return;
    setLoading(true);
    try {
      const res = await window.api.listLectureReferences(lecturePath);
      if (res?.success) setItems(res.items || []);
    } finally {
      setLoading(false);
    }
  }, [lecturePath]);

  useEffect(() => {
    loadReferences();
  }, [loadReferences]);

  async function handleImportImage() {
    if (!lecturePath || importing) return;
    const sourcePath = await window.api.openReferenceImage();
    if (!sourcePath) return;
    setImporting(true);
    try {
      const res = await window.api.importReferenceImage({ lecturePath, sourcePath });
      if (res?.success) {
        await loadReferences();
        onNotify?.('Image saved to Referenzen');
      } else {
        onNotify?.(res?.error || 'Could not import image');
      }
    } finally {
      setImporting(false);
    }
  }

  function openPasteTextModal(initialText = '') {
    setPasteInitialText(initialText);
    setPasteTextOpen(true);
  }

  async function handlePaste(e) {
    if (!lecturePath || importing) return;
    const clipboard = e.clipboardData;
    if (!clipboard) return;

    for (const item of clipboard.items) {
      if (!item.type.startsWith('image/')) continue;
      e.preventDefault();
      const blob = item.getAsFile();
      if (!blob) continue;
      setImporting(true);
      try {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        const res = await window.api.importReferenceClipboard({
          lecturePath,
          dataUrl,
          mimeType: blob.type
        });
        if (res?.success) {
          await loadReferences();
          onNotify?.('Screenshot pasted to Referenzen');
        } else {
          onNotify?.(res?.error || 'Paste failed');
        }
      } finally {
        setImporting(false);
      }
      return;
    }

    const plain = clipboard.getData('text/plain')?.trim();
    if (plain) {
      e.preventDefault();
      openPasteTextModal(plain);
    }
  }

  async function finishTextImport(res, label) {
    if (!res?.success) throw new Error(res?.error || 'Could not save text');
    setPasteTextOpen(false);
    setPasteInitialText('');
    await loadReferences();
    const count = res.count || res.items?.length || 1;
    onNotify?.(count > 1 ? `${count} references saved` : label);
  }

  async function handleSavePlainText(text) {
    const res = await window.api.addLectureReference({
      lecturePath,
      type: 'text',
      body: text,
      sourceHint: 'manual'
    });
    await finishTextImport({ ...res, count: 1 }, 'Text saved');
  }

  async function handleClassifyText(text) {
    const res = await window.api.classifyReferenceText({ lecturePath, text });
    await finishTextImport(res, hasApiKey ? 'References classified & saved' : 'Links extracted & saved');
  }

  async function handleSaveLink({ url, title, description }) {
    const res = await window.api.addLectureReference({
      lecturePath,
      type: 'link',
      url,
      title,
      description
    });
    if (!res?.success) throw new Error(res?.error || 'Could not save link');
    setAddLinkOpen(false);
    await loadReferences();
    onNotify?.('Link saved');
  }

  async function handleSaveEdit({ title, description, url, body }) {
    const res = await window.api.updateLectureReference({
      lecturePath,
      id: editItem.id,
      title,
      description,
      url,
      body
    });
    if (!res?.success) throw new Error(res?.error || 'Could not update');
    setEditItem(null);
    await loadReferences();
    onNotify?.('Reference updated');
  }

  async function handleDelete(id) {
    if (!lecturePath || !id) return;
    const res = await window.api.deleteLectureReference({ lecturePath, id });
    if (res?.success) {
      await loadReferences();
      onNotify?.('Reference deleted');
    }
  }

  async function handleOpenLink(url) {
    if (!url) return;
    await window.api.openExternalUrl(url);
  }

  function handleOpenReference(item) {
    setViewItem(item);
  }

  async function handleDescribe(itemOrId) {
    const id = typeof itemOrId === 'string' ? itemOrId : itemOrId?.id;
    if (!lecturePath || !id) return { success: false };
    setDescribingId(id);
    try {
      const res = await window.api.describeReference({
        lecturePath,
        id,
        ...coursePayload(course)
      });
      if (res?.success) {
        await loadReferences();
        onNotify?.('Caption updated');
      } else {
        onNotify?.(res?.error || 'Could not describe');
      }
      return res;
    } finally {
      setDescribingId('');
    }
  }

  return (
    <>
    <section
      className="mb-8"
      tabIndex={0}
      onPaste={handlePaste}
      aria-label="Lecture reference materials"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="study-section-title text-sm font-semibold text-text-primary uppercase tracking-wide">
            Referenzen
          </h2>
          <p className="text-xs text-text-muted mt-1 max-w-xl leading-relaxed">
            Screenshots, pasted notes, ChatGPT answers, and links for this lecture. Paste an image
            or text with Cmd+V, or use the buttons below.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleImportImage}
            disabled={importing}
            className="text-xs px-3 py-1.5 rounded-lg border border-border-DEFAULT text-text-secondary hover:border-accent hover:text-accent disabled:opacity-40"
          >
            {importing ? 'Importing…' : 'Add image'}
          </button>
          <button
            type="button"
            onClick={() => openPasteTextModal('')}
            className="text-xs px-3 py-1.5 rounded-lg border border-border-DEFAULT text-text-secondary hover:border-accent hover:text-accent"
          >
            Paste text
          </button>
          <button
            type="button"
            onClick={() => setAddLinkOpen(true)}
            className="text-xs px-3 py-1.5 rounded-lg bg-accent text-white font-medium hover:bg-accent/90"
          >
            Add link
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Loading references…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-subtle px-4 py-8 text-center">
          <p className="text-sm text-text-muted mb-1">No references yet</p>
          <p className="text-xs text-text-muted">
            Add a screenshot, paste text or an image, or save a YouTube / web link.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <ReferenceCard
              key={item.id}
              item={item}
              lecturePath={lecturePath}
              hasApiKey={hasApiKey}
              describing={describingId === item.id}
              onEdit={setEditItem}
              onDelete={handleDelete}
              onOpen={handleOpenReference}
              onOpenLink={handleOpenLink}
              onDescribe={handleDescribe}
            />
          ))}
        </div>
      )}

      {pasteTextOpen && (
        <PasteTextModal
          initialText={pasteInitialText}
          hasApiKey={hasApiKey}
          onSavePlain={handleSavePlainText}
          onClassify={handleClassifyText}
          onCancel={() => {
            setPasteTextOpen(false);
            setPasteInitialText('');
          }}
        />
      )}

      {addLinkOpen && (
        <AddReferenceModal
          hasApiKey={hasApiKey}
          onSaveLink={handleSaveLink}
          onCancel={() => setAddLinkOpen(false)}
        />
      )}

      {editItem && (
        <AddReferenceModal
          item={editItem}
          hasApiKey={hasApiKey}
          onSaveEdit={handleSaveEdit}
          onDescribe={handleDescribe}
          onCancel={() => setEditItem(null)}
        />
      )}
    </section>

    {viewItem && (
      <ReferenceDetailView
        item={viewItem}
        course={course}
        lecture={lecture}
        hasApiKey={hasApiKey}
        onClose={() => setViewItem(null)}
        onOpenLink={handleOpenLink}
      />
    )}
    </>
  );
}
