const fs = require('fs');
const path = require('path');

async function extractPdfText(pdfPath) {
  const pdfParse = require('pdf-parse');
  const pdfBuffer = fs.readFileSync(pdfPath);
  let pdfData;
  try {
    pdfData = await pdfParse(pdfBuffer);
  } catch (parseErr) {
    const err = new Error(parseErr.message);
    err.code = 'PDF_PARSE_ERROR';
    throw err;
  }
  const extractedText = (pdfData.text || '').trim();
  if (!extractedText || extractedText.length < 50) {
    const err = new Error('This PDF appears to be scanned. Use a text-based PDF.');
    err.code = 'SCANNED_PDF';
    throw err;
  }
  const textForAI =
    extractedText.length > 80000
      ? `${extractedText.substring(0, 80000)}\n\n[Text truncated]`
      : extractedText;
  return {
    extractedText,
    textForAI,
    pdfBaseName: path.basename(pdfPath, '.pdf')
  };
}

function normalizeLectureName(baseName, extractedText = '') {
  const noExt = baseName.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  const clean = noExt
    .replace(/^(lecture|lec|vorlesung|vl)\s*[-:_]?\s*\d+\s*[-:_]?\s*/i, '')
    .replace(/^\d+\s*[-:_]\s*/i, '')
    .replace(/\b(final|slides|notes|script)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length >= 6) return toTitle(clean);
  return toTitle(noExt);
}

function toTitle(value) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function detectLanguage(text) {
  const sample = (text || '').slice(0, 8000);
  const de = (sample.match(/\b(und|der|die|das|nicht|wird|sind|eine|Vorlesung)\b/gi) || []).length;
  const en = (sample.match(/\b(the|and|is|are|was|with|for|this)\b/gi) || []).length;
  return de > en * 1.2 ? 'German' : 'English';
}

module.exports = { extractPdfText, normalizeLectureName, detectLanguage, toTitle };
