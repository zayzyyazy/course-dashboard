/**
 * Language detection and preservation for the notes pipeline only.
 * Prefer source/highlight/topic language over PDF extraction alone.
 */

const GERMAN_MARKERS =
  /\b(und|der|die|das|nicht|wird|sind|eine|einer|einem|für|mit|auf|ist|sich|werden|auch|von|dem|den|des|ein|wenn|dass|oder|wie|nach|bei|zur|zum|Vorlesung|Übung|Erklärung|Bedeutung|Unterschied|Formel|Berechnung|Varianz|Hypothese|Stichprobe|Wert|Größe|Effekt|Quadrat|Interpretation|Annahme|Beispiel|Aufgabe|Zusammenfassung|Merke|wichtig|bedeutet|heißt|deshalb|daher|während|zwischen|unter|über)\b/gi;

const ENGLISH_MARKERS =
  /\b(the|and|is|are|was|with|for|this|that|from|have|will|not|you|helps|explains|clarifies|understanding|interpretation|formula|calculation|effect size|related notes|saved explanation)\b/gi;

function scoreText(text) {
  const sample = String(text || '').slice(0, 16000);
  if (!sample.trim()) return { de: 0, en: 0 };
  const de = (sample.match(GERMAN_MARKERS) || []).length;
  const en = (sample.match(ENGLISH_MARKERS) || []).length;
  const umlaut = (sample.match(/[äöüßÄÖÜ]/g) || []).length;
  return { de: de + umlaut * 3, en };
}

/** @returns {'de'|'en'} */
function detectNoteLocale(...texts) {
  let de = 0;
  let en = 0;
  for (const t of texts) {
    const s = scoreText(t);
    de += s.de;
    en += s.en;
  }
  if (de === 0 && en === 0) return null;
  if (de >= en * 1.05) return 'de';
  return 'en';
}

function localeToPromptLanguage(locale) {
  return locale === 'de' ? 'German' : 'English';
}

function resolveNoteLanguage({
  lectureTitle,
  lectureSummary,
  topicTitle,
  highlightedText,
  draftNote,
  note,
  extractedText
} = {}) {
  const primary = [highlightedText, topicTitle, lectureTitle, lectureSummary, draftNote].filter(Boolean).join('\n');
  const primaryLocale = detectNoteLocale(primary);

  const full = [
    highlightedText,
    topicTitle,
    lectureTitle,
    lectureSummary,
    draftNote,
    note?.refinedNote,
    note?.note,
    note?.highlightedText,
    note?.title,
    (note?.keyIdeas || []).join(' '),
    extractedText
  ];
  const fullLocale = detectNoteLocale(...full);

  let locale = primaryLocale || fullLocale;
  if (primaryLocale === 'de' || fullLocale === 'de') locale = 'de';
  else if (primaryLocale === 'en' || fullLocale === 'en') locale = 'en';
  else locale = 'de';
  return {
    locale,
    language: localeToPromptLanguage(locale)
  };
}

/** Chat / Ask AI — answer in lecture language even if the question is in another language. */
function chatLanguagePreservationPrompt(language) {
  const lang = language === 'German' ? 'German (Deutsch)' : 'English';
  return `RESPONSE LANGUAGE (mandatory):
- Write your entire reply in ${lang} — the same language as the lecture, topic, and highlighted selection.
- The student may ask in another language; still answer in ${lang}.
- Never switch to English when the study material is German.`;
}

function languagePreservationPrompt(language) {
  const lang = language === 'German' ? 'German (Deutsch)' : 'English';
  return `CRITICAL LANGUAGE RULE (non-negotiable):
- ALL JSON string values MUST be written in ${lang} — the same language as the highlight, topic, and lecture source.
- NEVER translate into another language. No English output when the source is German.
- Titles, keyIdeas, refinedNote, sectionLabel, and content must match the source language.
- Do not use English helper phrases (e.g. "Helps with", "Related highlight") unless the source material is English.`;
}

function noteLocaleFromNote(note, lecture) {
  return resolveNoteLanguage({
    lectureTitle: lecture?.title,
    lectureSummary: lecture?.lectureSummary || lecture?.summary,
    topicTitle: note?.topicTitle,
    highlightedText: note?.highlightedText,
    note
  }).locale;
}

function looksEnglishDominant(text) {
  const { de, en } = scoreText(text);
  return en > 0 && en > de * 1.4;
}

function looksGermanDominant(text) {
  const { de, en } = scoreText(text);
  return de > 0 && de >= en * 0.75;
}

/** Title/preview likely wrong language vs note body (conservative — repair path only). */
function metadataLooksMislocalized(note, locale) {
  const body = [note?.refinedNote, note?.note, note?.highlightedText, ...(note?.keyIdeas || [])]
    .filter(Boolean)
    .join(' ');
  const meta = [note?.title, note?.preview].filter(Boolean).join(' ');
  if (!body.trim() || !meta.trim()) return false;

  const bodyLocale = detectNoteLocale(body);
  const metaLocale = detectNoteLocale(meta);
  if (!bodyLocale || !metaLocale || bodyLocale === metaLocale) return false;

  const target = locale === 'de' || bodyLocale === 'de' ? 'de' : 'en';
  if (target !== 'de') return bodyLocale === 'en' && metaLocale === 'de';

  const bodyScore = scoreText(body);
  const metaScore = scoreText(meta);
  if (bodyScore.de < 2) return false;
  if (metaScore.en < 2) return false;
  return bodyLocale === 'de' && metaLocale === 'en';
}

module.exports = {
  detectNoteLocale,
  localeToPromptLanguage,
  resolveNoteLanguage,
  chatLanguagePreservationPrompt,
  languagePreservationPrompt,
  noteLocaleFromNote,
  looksEnglishDominant,
  looksGermanDominant,
  metadataLooksMislocalized,
  scoreText
};
