const fs = require('fs');
const path = require('path');
const exerciseSheets = require('../shared/exerciseSheets.cjs');

const PAGE_INDEX_FILE = 'page_index.json';
const PAGE_IMAGES_DIR = 'page_images';
const SOFTWARE_TERMS =
  /\b(jamovi|spss|r studio|r\b|excel|output|tabelle|table|anova|regression|descriptive)\b/i;

let pdfjsLib = null;

function loadPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
  const workerPath = path.join(
    path.dirname(require.resolve('pdfjs-dist/package.json')),
    'legacy',
    'build',
    'pdf.worker.js'
  );
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
  return pdfjsLib;
}

function resolveSourcePdfPath(lecturePath, lecture, materialMode = 'lecture', exerciseId = '') {
  if (!lecturePath || !lecture) return null;
  if (materialMode === 'exercise') {
    const sheet = exerciseSheets.getExerciseSheet(lecture, exerciseId);
    if (sheet?.sourcePdf) {
      const fp = path.join(lecturePath, sheet.sourcePdf);
      if (fs.existsSync(fp)) return fp;
    }
  }
  if (lecture.sourcePdf) {
    const fp = path.join(lecturePath, lecture.sourcePdf);
    if (fs.existsSync(fp)) return fp;
  }
  return null;
}

function pageIndexPath(lecturePath) {
  return path.join(lecturePath, PAGE_INDEX_FILE);
}

function pageImagesDir(lecturePath) {
  return path.join(lecturePath, PAGE_IMAGES_DIR);
}

function pageImageFileName(pageNum) {
  return `p-${String(pageNum).padStart(3, '0')}.png`;
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function keywordSet({ topic, subtopic, cardMarkdown = '' }) {
  const words = new Set();
  for (const src of [topic?.title, subtopic?.title, cardMarkdown]) {
    for (const w of tokenize(src)) words.add(w);
  }
  return words;
}

function scorePage(entry, keywords, queryText) {
  const pageText = String(entry.text || '');
  const lower = pageText.toLowerCase();
  const queryLower = String(queryText || '').toLowerCase();
  let score = 0;

  for (const kw of keywords) {
    if (lower.includes(kw)) score += kw.length > 5 ? 3 : 2;
  }

  if (SOFTWARE_TERMS.test(pageText)) score += 4;
  if (SOFTWARE_TERMS.test(queryText)) {
    for (const term of ['jamovi', 'spss', 'output', 'tabelle', 'table', 'anova']) {
      if (lower.includes(term)) score += 3;
    }
  }

  const charCount = pageText.replace(/\s+/g, '').length;
  if (charCount < 120) score += 5;
  else if (charCount < 280) score += 3;

  if (queryLower && lower.includes(queryLower.slice(0, 40))) score += 4;

  return score;
}

function rankPages(pageIndex, { topic, subtopic, cardMarkdown = '', maxPages = 3 }) {
  const keywords = keywordSet({ topic, subtopic, cardMarkdown });
  const queryText = [subtopic?.title, topic?.title, cardMarkdown?.slice(0, 400)].filter(Boolean).join(' ');
  const ranked = (pageIndex || [])
    .map((entry) => ({
      page: entry.page,
      score: scorePage(entry, keywords, queryText)
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.page - b.page);

  const selected = [];
  const seen = new Set();
  for (const r of ranked) {
    if (seen.has(r.page)) continue;
    seen.add(r.page);
    selected.push(r.page);
    if (selected.length >= maxPages) break;
  }

  if (selected.length < maxPages && pageIndex?.length) {
    for (const entry of pageIndex) {
      if (selected.length >= maxPages) break;
      if (seen.has(entry.page)) continue;
      const charCount = String(entry.text || '').replace(/\s+/g, '').length;
      if (charCount < 200) {
        seen.add(entry.page);
        selected.push(entry.page);
      }
    }
  }

  return selected.sort((a, b) => a - b);
}

async function loadPdfDocument(pdfPath) {
  const pdfjs = loadPdfJs();
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  return pdfjs.getDocument({ data, disableFontFace: true }).promise;
}

async function buildPageIndex(pdfPath, outPath) {
  const doc = await loadPdfDocument(pdfPath);
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join(' ').replace(/\s+/g, ' ').trim();
    pages.push({ page: i, text });
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(pages, null, 2), 'utf8');
  return pages;
}

async function ensurePageIndex(lecturePath, pdfPath) {
  const indexPath = pageIndexPath(lecturePath);
  if (fs.existsSync(indexPath)) {
    try {
      return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    } catch {
      /* rebuild */
    }
  }
  if (!pdfPath || !fs.existsSync(pdfPath)) return [];
  return buildPageIndex(pdfPath, indexPath);
}

async function renderPagePng(pdfPath, pageNum, outPath, scale = 1.4) {
  const { createCanvas } = require('@napi-rs/canvas');
  const doc = await loadPdfDocument(pdfPath);
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
  return outPath;
}

function pageToDataUrl(pngPath) {
  const buf = fs.readFileSync(pngPath);
  return `data:image/png;base64,${buf.toString('base64')}`;
}

async function ensurePageImages(lecturePath, pdfPath, pageNumbers) {
  const dir = pageImagesDir(lecturePath);
  fs.mkdirSync(dir, { recursive: true });
  const figures = [];
  for (const page of pageNumbers) {
    const fileName = pageImageFileName(page);
    const outPath = path.join(dir, fileName);
    if (!fs.existsSync(outPath)) {
      await renderPagePng(pdfPath, page, outPath);
    }
    figures.push({ page, fileName });
  }
  return figures;
}

async function getRelevantPages({
  lecturePath,
  lecture,
  materialMode = 'lecture',
  exerciseId = '',
  topic,
  subtopic,
  maxPages = 3
}) {
  const pdfPath = resolveSourcePdfPath(lecturePath, lecture, materialMode, exerciseId);
  if (!pdfPath) {
    return { pdfPath: null, pageNumbers: [], figures: [], dataUrls: [] };
  }

  const pageIndex = await ensurePageIndex(lecturePath, pdfPath);
  if (!pageIndex.length) {
    return { pdfPath, pageNumbers: [], figures: [], dataUrls: [] };
  }

  const cardMarkdown = subtopic ? topic?.card?.markdown : topic?.card?.markdown;
  const pageNumbers = rankPages(pageIndex, {
    topic,
    subtopic,
    cardMarkdown,
    maxPages
  });

  if (!pageNumbers.length) {
    return { pdfPath, pageNumbers: [], figures: [], dataUrls: [] };
  }

  const figures = await ensurePageImages(lecturePath, pdfPath, pageNumbers);
  const dataUrls = figures.map((f) => pageToDataUrl(path.join(pageImagesDir(lecturePath), f.fileName)));

  return { pdfPath, pageNumbers, figures, dataUrls };
}

function getPageImageAsset(lecturePath, fileName) {
  const safe = path.basename(String(fileName || ''));
  if (!safe || !/^p-\d{3}\.png$/.test(safe)) {
    return { success: false, error: 'Invalid page image name' };
  }
  const fp = path.join(pageImagesDir(lecturePath), safe);
  if (!fs.existsSync(fp)) {
    return { success: false, error: 'Page image not found' };
  }
  const buf = fs.readFileSync(fp);
  return {
    success: true,
    mime: 'image/png',
    dataUrl: `data:image/png;base64,${buf.toString('base64')}`
  };
}

module.exports = {
  PAGE_INDEX_FILE,
  PAGE_IMAGES_DIR,
  resolveSourcePdfPath,
  rankPages,
  scorePage,
  keywordSet,
  ensurePageIndex,
  buildPageIndex,
  renderPagePng,
  pageToDataUrl,
  getRelevantPages,
  getPageImageAsset,
  pageImageFileName
};
