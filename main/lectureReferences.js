const fs = require('fs');
const path = require('path');

const REFERENCES_FILE = 'lecture_references.json';
const REFERENCES_DIR = 'references';
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

function referencesPath(lecturePath) {
  return path.join(lecturePath, REFERENCES_FILE);
}

function referencesDir(lecturePath) {
  return path.join(lecturePath, REFERENCES_DIR);
}

function ensureReferencesDir(lecturePath) {
  const dir = referencesDir(lecturePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function readReferences(lecturePath) {
  try {
    const data = JSON.parse(fs.readFileSync(referencesPath(lecturePath), 'utf8'));
    return Array.isArray(data.items) ? data : { version: 1, items: [] };
  } catch {
    return { version: 1, items: [] };
  }
}

function writeReferences(lecturePath, payload) {
  fs.writeFileSync(referencesPath(lecturePath), JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

function compareReferences(a, b) {
  const orderA = Number.isFinite(a.sortIndex) ? a.sortIndex : Number.MAX_SAFE_INTEGER;
  const orderB = Number.isFinite(b.sortIndex) ? b.sortIndex : Number.MAX_SAFE_INTEGER;
  if (orderA !== orderB) return orderA - orderB;
  return new Date(b.createdAt) - new Date(a.createdAt);
}

function hydrateReference(item, lecturePath) {
  return { ...item, lecturePath };
}

function listReferences(lecturePath) {
  const data = readReferences(lecturePath);
  return data.items.map((item) => hydrateReference(item, lecturePath)).sort(compareReferences);
}

function detectImageExt(sourcePath, mimeType = '') {
  const ext = path.extname(String(sourcePath || '')).toLowerCase();
  if (IMAGE_EXT.has(ext)) return ext;
  if (/png/i.test(mimeType)) return '.png';
  if (/jpe?g/i.test(mimeType)) return '.jpg';
  if (/webp/i.test(mimeType)) return '.webp';
  if (/gif/i.test(mimeType)) return '.gif';
  return '.png';
}

function copyImageIntoReferences(lecturePath, sourcePath, idPrefix = 'ref') {
  ensureReferencesDir(lecturePath);
  const ext = detectImageExt(sourcePath);
  const fileName = `${idPrefix}-${Date.now()}${ext}`;
  const dest = path.join(referencesDir(lecturePath), fileName);
  fs.copyFileSync(sourcePath, dest);
  return fileName;
}

function saveBufferIntoReferences(lecturePath, buffer, mimeType = 'image/png', idPrefix = 'ref') {
  ensureReferencesDir(lecturePath);
  const ext = detectImageExt('', mimeType);
  const fileName = `${idPrefix}-${Date.now()}${ext}`;
  const dest = path.join(referencesDir(lecturePath), fileName);
  fs.writeFileSync(dest, buffer);
  return fileName;
}

function referenceFilePath(lecturePath, fileName) {
  if (!fileName) return '';
  const safe = path.basename(String(fileName));
  return path.join(referencesDir(lecturePath), safe);
}

function deleteReferenceFile(lecturePath, fileName) {
  if (!fileName) return;
  try {
    const fp = referenceFilePath(lecturePath, fileName);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  } catch (_) {}
}

function getReferenceAsset(lecturePath, fileName) {
  const fp = referenceFilePath(lecturePath, fileName);
  if (!fp || !fs.existsSync(fp)) {
    return { success: false, error: 'File not found' };
  }
  const buf = fs.readFileSync(fp);
  const ext = path.extname(fp).toLowerCase();
  const mime =
    ext === '.jpg' || ext === '.jpeg'
      ? 'image/jpeg'
      : ext === '.webp'
        ? 'image/webp'
        : ext === '.gif'
          ? 'image/gif'
          : 'image/png';
  return {
    success: true,
    dataUrl: `data:${mime};base64,${buf.toString('base64')}`
  };
}

function normalizeUrl(raw) {
  const url = String(raw || '').trim();
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function linkTitleFromUrl(url) {
  try {
    const u = new URL(url);
    if (/youtube\.com|youtu\.be/i.test(u.hostname)) return 'YouTube video';
    return u.hostname.replace(/^www\./, '');
  } catch {
    return 'Link';
  }
}

function addReference(lecturePath, entry = {}) {
  const data = readReferences(lecturePath);
  const type = ['link', 'image', 'text'].includes(entry.type) ? entry.type : 'image';
  const now = new Date().toISOString();
  const maxOrder = data.items.reduce((m, n) => Math.max(m, Number(n.sortIndex) || 0), 0);

  const item = {
    id: entry.id || `ref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    title: String(entry.title || '').trim().slice(0, 120),
    description: String(entry.description || '').trim().slice(0, 2000),
    body: type === 'text' ? String(entry.body || '').trim().slice(0, 12000) : '',
    url: type === 'link' ? normalizeUrl(entry.url) : '',
    fileName: type === 'image' ? String(entry.fileName || '').trim() : '',
    sourceHint: ['pasted', 'imported', 'manual', 'classified'].includes(entry.sourceHint)
      ? entry.sourceHint
      : 'manual',
    sortIndex: Number.isFinite(entry.sortIndex) ? entry.sortIndex : maxOrder + 1,
    createdAt: now,
    updatedAt: now
  };

  if (type === 'link' && !item.url) {
    return { success: false, error: 'URL is required' };
  }
  if (type === 'image' && !item.fileName) {
    return { success: false, error: 'Image file is required' };
  }
  if (type === 'text' && !item.body) {
    return { success: false, error: 'Text body is required' };
  }
  if (type === 'link' && !item.title) {
    item.title = linkTitleFromUrl(item.url);
  }
  if (type === 'text' && !item.title) {
    item.title = item.body.split(/\s+/).slice(0, 6).join(' ').slice(0, 80);
  }

  data.items.push(item);
  writeReferences(lecturePath, data);
  return { success: true, item: hydrateReference(item, lecturePath) };
}

function addReferencesBatch(lecturePath, entries = []) {
  const saved = [];
  for (const entry of entries) {
    const res = addReference(lecturePath, entry);
    if (res.success) saved.push(res.item);
  }
  if (!saved.length) return { success: false, error: 'Nothing saved' };
  return { success: true, items: saved, count: saved.length };
}

function importReferenceImage(lecturePath, sourcePath, meta = {}) {
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return { success: false, error: 'Image file not found' };
  }
  const id = `ref-${Date.now()}`;
  const fileName = copyImageIntoReferences(lecturePath, sourcePath, id);
  return addReference(lecturePath, {
    type: 'image',
    fileName,
    title: meta.title || '',
    description: meta.description || '',
    sourceHint: 'imported'
  });
}

function importReferenceClipboard(lecturePath, { dataUrl, mimeType } = {}) {
  const raw = String(dataUrl || '').trim();
  const match = raw.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return { success: false, error: 'Invalid clipboard image' };
  const mime = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) return { success: false, error: 'Empty image data' };
  const id = `ref-${Date.now()}`;
  const fileName = saveBufferIntoReferences(lecturePath, buffer, mimeType || mime, id);
  return addReference(lecturePath, {
    type: 'image',
    fileName,
    sourceHint: 'pasted'
  });
}

function updateReference(lecturePath, { id, title, description, url, body } = {}) {
  const data = readReferences(lecturePath);
  const idx = data.items.findIndex((n) => n.id === id);
  if (idx < 0) return { success: false, error: 'Reference not found' };

  const item = data.items[idx];
  if (title !== undefined) item.title = String(title || '').trim().slice(0, 120);
  if (description !== undefined) item.description = String(description || '').trim().slice(0, 2000);
  if (body !== undefined && item.type === 'text') {
    item.body = String(body || '').trim().slice(0, 12000);
    if (!item.body) return { success: false, error: 'Text body is required' };
  }
  if (url !== undefined && item.type === 'link') {
    item.url = normalizeUrl(url);
    if (!item.url) return { success: false, error: 'URL is required' };
  }
  item.updatedAt = new Date().toISOString();
  data.items[idx] = item;
  writeReferences(lecturePath, data);
  return { success: true, item: hydrateReference(item, lecturePath) };
}

function deleteReference(lecturePath, id) {
  const data = readReferences(lecturePath);
  const idx = data.items.findIndex((n) => n.id === id);
  if (idx < 0) return { success: false, error: 'Reference not found' };
  const item = data.items[idx];
  if (item.type === 'image') deleteReferenceFile(lecturePath, item.fileName);
  data.items.splice(idx, 1);
  writeReferences(lecturePath, data);
  return { success: true };
}

function getReferenceById(lecturePath, id) {
  const data = readReferences(lecturePath);
  const item = data.items.find((n) => n.id === id);
  return item ? hydrateReference(item, lecturePath) : null;
}

function extractUrls(text) {
  const re = /https?:\/\/[^\s<>"')\]]+/gi;
  return [...new Set(String(text || '').match(re) || [])];
}

function importReferenceTextHeuristic(lecturePath, rawText) {
  const text = String(rawText || '').trim();
  if (!text) return { success: false, error: 'Text is empty' };

  const urls = extractUrls(text);
  const entries = [];
  for (const url of urls) {
    entries.push({ type: 'link', url, sourceHint: 'manual' });
  }

  const withoutUrls = text
    .replace(/https?:\/\/[^\s<>"')\]]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (withoutUrls) {
    entries.push({ type: 'text', body: withoutUrls, sourceHint: 'manual' });
  } else if (!entries.length) {
    entries.push({ type: 'text', body: text, sourceHint: 'manual' });
  }

  return addReferencesBatch(lecturePath, entries);
}

module.exports = {
  listReferences,
  addReference,
  addReferencesBatch,
  importReferenceTextHeuristic,
  updateReference,
  deleteReference,
  importReferenceImage,
  importReferenceClipboard,
  getReferenceAsset,
  getReferenceById,
  referenceFilePath,
  normalizeUrl
};
