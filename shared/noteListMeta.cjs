/** Titles and list previews for lecture notes — scan-friendly, distinct from topic name. */

const { detectNoteLocale, metadataLooksMislocalized } = require('./noteLanguage.cjs');
const {
  deriveStudyNoteTitle,
  isWeakNoteTitle,
  shortenNoteTitle
} = require('./noteTitle.cjs');

function stripMarkdown(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^$]+\$/g, ' ')
    .replace(/[#*_>[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstSentence(text, maxLen = 100) {
  const s = stripMarkdown(text);
  if (!s) return '';
  const m = s.match(/^(.+?[.!?])(?:\s|$)/);
  const bit = (m ? m[1] : s).trim();
  return bit.length > maxLen ? `${bit.slice(0, maxLen - 1)}…` : bit;
}

function normalizeForCompare(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isWeakTitle(title, topicTitle) {
  return isWeakNoteTitle(title, topicTitle);
}

const SOURCE_HINTS = {
  en: {
    tutorChat: 'Tutor answer',
    noteChat: 'From note study',
    deep: 'Deeper dive',
    card: 'From topic card',
    exercise: 'Exercise',
    note: 'Note'
  },
  de: {
    tutorChat: 'Tutor-Antwort',
    noteChat: 'Aus Notiz-Chat',
    deep: 'Vertiefung',
    card: 'Aus Themenkarte',
    exercise: 'Übung',
    note: 'Notiz'
  }
};

function normalizeLocale(locale) {
  return locale === 'de' ? 'de' : 'en';
}

function stringsForLocale(locale) {
  const loc = normalizeLocale(locale);
  return {
    sourceHints: SOURCE_HINTS[loc],
    helpsWith: loc === 'de' ? 'Hilft bei' : 'Helps with',
    clarifiesDiff: loc === 'de' ? 'Erklärt Unterschiede zwischen Konzepten' : 'Clarifies how concepts differ',
    helpsFormulas:
      loc === 'de'
        ? 'Hilft bei Formeln und Rechenschritten'
        : 'Helps with formulas and calculation steps',
    helpsInterpret:
      loc === 'de'
        ? 'Hilft bei Interpretation und Schwellenwerten'
        : 'Helps interpret results and thresholds',
    helpsExamples:
      loc === 'de' ? 'Zeigt Anwendung an Beispielen' : 'Shows how to apply it in examples',
    helpsWhen:
      loc === 'de' ? 'Erklärt wann und warum man das nutzt' : 'Explains when and why to use this',
    explains: loc === 'de' ? 'Erklärt' : 'Explains',
    clarifies: loc === 'de' ? 'Erläutert' : 'Clarifies',
    usefulFor: loc === 'de' ? 'Nützlich für' : 'Useful for',
    savedReview: loc === 'de' ? 'Gespeicherte Erklärung zum Wiederholen' : 'Saved explanation to review',
    relatedNotes: loc === 'de' ? 'Verwandte Notizen' : 'Related notes',
    severalRelated: loc === 'de' ? 'Mehrere zusammenhängende Erklärungen' : 'Several related explanations saved'
  };
}

function pickFromKeyIdeas(keyIdeas) {
  const ideas = (keyIdeas || []).map((k) => String(k).trim()).filter(Boolean);
  if (!ideas.length) return '';
  if (ideas.length === 1) return ideas[0];
  return ideas.slice(0, 2).join(' · ');
}

function pickFromBody(refinedNote, note) {
  const raw = String(refinedNote || note || '');
  const lines = raw
    .split('\n')
    .map((l) => stripMarkdown(l))
    .filter((l) => l.length > 8 && !/^added while studying/i.test(l));
  for (const line of lines) {
    if (line.length >= 12 && line.length <= 90) return line;
  }
  return firstSentence(raw, 85);
}

function pickFromHighlight(highlightedText, topicTitle) {
  const h = stripMarkdown(highlightedText);
  if (!h || h.length < 8) return '';
  const topic = normalizeForCompare(topicTitle);
  if (topic && normalizeForCompare(h) === topic) return '';
  if (h.length <= 70) return h;
  return firstSentence(h, 70);
}

function buildNoteTitle({
  title,
  titleEdited,
  topicTitle,
  subtopicTitle,
  sectionAnchor,
  sectionHeading,
  keyIdeas,
  highlightedText,
  aiAnswerText,
  refinedNote,
  note,
  source,
  locale
}) {
  const derived = deriveStudyNoteTitle({
    title,
    titleEdited,
    topicTitle,
    subtopicTitle,
    sectionAnchor,
    sectionHeading,
    highlightedText,
    aiAnswerText,
    refinedNote,
    note,
    source,
    keyIdeas,
    locale
  });
  return shortenNoteTitle(derived).slice(0, 80);
}

function inferHelpsWithLine(blob, locale) {
  const s = stringsForLocale(locale);
  const b = normalizeForCompare(blob);
  if (/unterschied|difference|vs\.|versus|gegenüber/.test(b)) {
    return s.clarifiesDiff;
  }
  if (/berechnen|calculate|formel|formula|eta|omega|ssbetween|sswithin|f-wert|f test/.test(b)) {
    return s.helpsFormulas;
  }
  if (/interpret|bedeutung|cohen|threshold|schwellen/.test(b)) {
    return s.helpsInterpret;
  }
  if (/beispiel|example|anwendung|application|aufgabe/.test(b)) {
    return s.helpsExamples;
  }
  if (/annahme|assumption|voraussetzung|when to use/.test(b)) {
    return s.helpsWhen;
  }
  return '';
}

function buildNotePreview({
  keyIdeas,
  refinedNote,
  note,
  highlightedText,
  title,
  topicTitle,
  locale
}) {
  const s = stringsForLocale(locale);
  const cleanedBody = String(refinedNote || note || '')
    .replace(/---\s*AI clarification[\s\S]*?(?=\n##|\n---|$)/gi, '')
    .replace(/Added while studying[^\n]*/gi, '')
    .replace(/### Merged from:[^\n]*/gi, '');
  const body = firstSentence(stripMarkdown(cleanedBody), 140);
  if (body && normalizeForCompare(body) !== normalizeForCompare(title)) {
    return body.slice(0, 140);
  }

  const h = firstSentence(stripMarkdown(highlightedText), 120);
  if (h && normalizeForCompare(h) !== normalizeForCompare(title)) {
    return h.slice(0, 140);
  }

  const ideas = pickFromKeyIdeas(keyIdeas);
  if (ideas) {
    return ideas.slice(0, 140);
  }

  if (topicTitle) {
    return `${s.usefulFor} „${topicTitle}“`.slice(0, 140);
  }
  return s.savedReview;
}

function previewMatchesLocale(preview, locale) {
  if (!preview || !String(preview).trim()) return false;
  const detected = detectNoteLocale(preview);
  if (!detected) return true;
  return detected === normalizeLocale(locale);
}

function enrichNoteListFields(note, options = {}) {
  const topicTitle = note.topicTitle || '';
  const locale =
    options.locale ||
    detectNoteLocale(
      note.highlightedText,
      note.topicTitle,
      note.refinedNote,
      note.note,
      note.title,
      (note?.keyIdeas || []).join(' ')
    ) ||
    'de';
  const repair = Boolean(options.repairMetadata);
  const mislocalized = repair && metadataLooksMislocalized(note, locale);
  const keepTitle =
    Boolean(note.titleEdited) ||
    (!options.forceRetitle && !mislocalized && note.title && !isWeakTitle(note.title, topicTitle));
  const useTitle = keepTitle ? note.title : '';
  const title = buildNoteTitle({
    title: useTitle,
    titleEdited: note.titleEdited,
    topicTitle,
    subtopicTitle: note.subtopicTitle,
    sectionAnchor: note.sectionAnchor,
    sectionHeading: note.sectionHeading,
    keyIdeas: note.keyIdeas,
    highlightedText: note.highlightedText,
    aiAnswerText: note.source === 'tutorChat' ? note.note : '',
    refinedNote: note.refinedNote,
    note: note.note,
    source: note.source,
    locale
  });
  const preview = buildNotePreview({
    keyIdeas: note.keyIdeas,
    refinedNote: note.refinedNote,
    note: note.note,
    highlightedText: note.highlightedText,
    title,
    topicTitle,
    locale
  });
  return { ...note, title, preview, outputLocale: locale };
}

module.exports = {
  buildNoteTitle,
  buildNotePreview,
  enrichNoteListFields,
  stringsForLocale,
  metadataLooksMislocalized,
  previewMatchesLocale,
  isWeakTitle,
  stripMarkdown,
  normalizeForCompare
};
