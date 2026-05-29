/**
 * Clean text captured from DOM selection (KaTeX often duplicates MathML + HTML).
 * Conservative: dedupe KaTeX echoes, repair collapsed words/spacing — do not strip prose spaces.
 */

const SET_OPS = '∪∩∈∉⊆⊂∅∖×';
const GLUE_WORDS = [
  'betrachten',
  'wir',
  'zwei',
  'drei',
  'vier',
  'fünf',
  'sechs',
  'sieben',
  'neun',
  'zehn',
  'und',
  'oder',
  'der',
  'die',
  'das',
  'den',
  'dem',
  'des',
  'ein',
  'eine',
  'einer',
  'ist',
  'sind',
  'nicht',
  'kein',
  'keine',
  'menge',
  'mengen',
  'notation',
  'definition',
  'beispiel',
  'übungsaufgabe',
  'lösung',
  'schnitt',
  'vereinigung',
  'differenz',
  'enthält',
  'element',
  'jedes',
  'jede',
  'jeder',
  'alle',
  'wenn',
  'für',
  'mit',
  'von',
  'auf',
  'aus',
  'bei',
  'nach',
  'vor',
  'über',
  'unter',
  'zwischen',
  'leere',
  'teilmenge'
];

function normalizeWhitespace(text) {
  return String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeForDupCompare(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

/** e.g. `A = {4,+,1} A={4,+,1}` → `A = {4,+,1}` */
function dedupeAdjacentExactCopy(text) {
  const s = normalizeWhitespace(text);
  if (s.length < 6) return s;

  for (let i = 1; i < s.length; i++) {
    if (s[i] !== ' ') continue;
    const left = s.slice(0, i).trim();
    const right = s.slice(i + 1).trim();
    if (left.length < 3 || right.length < 3) continue;
    const nl = normalizeForDupCompare(left);
    const nr = normalizeForDupCompare(right);
    if (nl && nl === nr) return left;
    if (nl && nr.startsWith(nl) && nr.length <= nl.length * 1.15) return left;
  }
  return s;
}

const UNICODE_MATH_TAIL =
  /[∪∩∈∉⊆⊂∅∖×÷±²³ηΩαβγδλμσ₀₁₂₃₄₅₆₇₈₉]/;

/** e.g. `A ∪ B AuB` → `A ∪ B` */
function removeTrailingAsciiMathEcho(text) {
  const s = normalizeWhitespace(text);
  const m = s.match(/^(.+?\s)([A-Za-z0-9{}+,^_{}\\]+)$/);
  if (!m) return s;
  const left = m[1].trim();
  const ascii = m[2].trim();
  if (!UNICODE_MATH_TAIL.test(left)) return s;
  if (!isAsciiTransliteration(left, ascii)) return s;
  return left;
}

function isAsciiTransliteration(unicodeExpr, ascii) {
  const letters = [...unicodeExpr].filter((c) => /[A-Za-z]/.test(c)).map((c) => c.toLowerCase());
  if (!letters.length || ascii.length < 2) return false;
  const a = ascii.toLowerCase();
  let pos = 0;
  for (const c of letters) {
    const idx = a.indexOf(c, pos);
    if (idx === -1) return false;
    pos = idx + 1;
  }
  const compactUnicode = unicodeExpr.replace(/\s/g, '');
  return ascii.length <= Math.max(compactUnicode.length * 2, 12);
}

/** Collapse consecutive duplicate chunks split by double spaces. */
function dedupeConsecutiveSegments(text) {
  const parts = text.split(/\s{2,}/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return text;
  const out = [];
  for (const p of parts) {
    const prev = out[out.length - 1];
    if (prev && normalizeForDupCompare(prev) === normalizeForDupCompare(p)) continue;
    out.push(p);
  }
  return out.length === 1 ? out[0] : out.join('  ');
}

/** DOM selection often glues German words: BetrachtenwirzweiMengen */
function repairCollapsedWords(text) {
  let t = String(text || '');
  if (!t || !/[\p{L}]{8,}/u.test(t.replace(/\s/g, ''))) return t;

  const sorted = [...GLUE_WORDS].sort((a, b) => b.length - a.length);
  for (const word of sorted) {
    const re = new RegExp(
      `([\\p{L}]{2,})(${word})(?=[\\p{L}\\p{N}=:,{\\[(|∪∩∈∉]|$)`,
      'giu'
    );
    t = t.replace(re, (match, before, found) => {
      if ((before + found).toLowerCase() === word.toLowerCase()) return match;
      if (before.length < 3 && found.length < 4) return match;
      if (found.length < 4 && !/^(wir|und|der|die|das|von|zu|im|am|ist|ein)$/i.test(found)) {
        return match;
      }
      return `${before} ${found}`;
    });
  }

  t = t.replace(/([\p{Ll}äöüß]{2,})([\p{Lu}ÄÖÜ][\p{Ll}äöüß]{2,})/gu, '$1 $2');
  t = t.replace(/(:)([A-ZÄÖÜ=])/g, '$1 $2');
  t = t.replace(/([.!?])([A-ZÄÖÜ])/g, '$1 $2');
  return t;
}

function repairMathSymbolSpacingLine(line) {
  let t = String(line || '');
  const opClass = `[${SET_OPS.replace(/[\]\\^-]/g, '\\$&')}]`;

  t = t.replace(new RegExp(`([A-Za-z0-9}\\])])(${opClass})`, 'gu'), '$1 $2');
  t = t.replace(new RegExp(`(${opClass})([A-Za-z0-9\\[{])`, 'gu'), '$1 $2');
  t = t.replace(/([A-Za-z0-9}\]])=/g, '$1 = ');
  t = t.replace(/=\s*\{/g, '= {');
  t = t.replace(/,\s*/g, ', ');
  t = t.replace(/\{\s*/g, '{ ');
  t = t.replace(/\s*\}/g, ' }');
  t = t.replace(/([0-9}\]])([A-Za-z])/g, '$1 $2');
  return t.replace(/[ \t]+/g, ' ').trim();
}

/** Light spacing around math symbols; preserves newlines between blocks. */
function repairMathSymbolSpacing(text) {
  const s = String(text || '');
  if (!/[∪∩∈∉⊆⊂∅{}=,|]/.test(s)) return s;
  return s
    .split('\n')
    .map((line) => {
      if (!line.trim()) return '';
      return repairMathSymbolSpacingLine(line);
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

/** KaTeX selection often loses │ — shows as capital I glued to x. */
function fixSetBuilderNotation(text) {
  return String(text || '')
    .replace(/(\{\s*)([xX])\s*I\s*([xX])\s*∈/gi, '$1$2 | $3 ∈')
    .replace(/(\{\s*)([xX])\s*I\s*∈/gi, '$1$2 | x ∈')
    .replace(/([{,\s])([xX])I([xX])∈/gi, '$1$2 | $3 ∈')
    .replace(/([{,\s])([xX])I∈/gi, '$1$2 | x ∈');
}

function cleanHighlightText(raw) {
  let text = String(raw || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!text) return '';

  text = dedupeAdjacentExactCopy(text);
  text = removeTrailingAsciiMathEcho(text);
  text = dedupeAdjacentExactCopy(text);
  text = dedupeConsecutiveSegments(text);

  const glued = /[\p{Ll}äöüß]{4,}[\p{Lu}ÄÖÜ][\p{Ll}äöüß]{2,}/u.test(text.replace(/\s/g, ''));
  if (glued || /\b(betrachtenwir|wirzwei|zweimengen|notationder)\b/i.test(text.replace(/\s/g, ''))) {
    text = repairCollapsedWords(text);
  }

  if (/[∪∩∈∉⊆⊂∅{}=,|]/.test(text)) {
    text = text
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return '';
        if (!/[∪∩∈∉⊆⊂∅{}=,|]/.test(trimmed)) return trimmed;
        return fixSetBuilderNotation(repairMathSymbolSpacingLine(trimmed));
      })
      .filter(Boolean)
      .join('\n');
  }

  return normalizeWhitespace(text);
}

module.exports = {
  cleanHighlightText,
  normalizeWhitespace,
  normalizeForDupCompare,
  dedupeAdjacentExactCopy,
  removeTrailingAsciiMathEcho,
  repairCollapsedWords,
  repairMathSymbolSpacing,
  fixSetBuilderNotation
};
