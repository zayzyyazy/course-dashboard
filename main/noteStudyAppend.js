const courseProfile = require('./courseProfile');
const { normalizeNoteMarkdown } = require('../shared/noteMarkdown.cjs');
const {
  languagePreservationPrompt,
  detectNoteLocale,
  localeToPromptLanguage
} = require('../shared/noteLanguage.cjs');

const SECTION_LABELS_EN = new Set([
  'AI clarification',
  'Formula explanation',
  'Example',
  'Connection',
  'AI-added explanation'
]);

const SECTION_LABELS_DE = new Set([
  'KI-Erläuterung',
  'Formelerklärung',
  'Beispiel',
  'Zusammenhang',
  'KI-Ergänzung'
]);

function parseJson(raw) {
  const text = (raw || '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function fallbackContent(excerpt) {
  const { cleanHighlightText } = require('../shared/cleanHighlightText.cjs');
  return normalizeNoteMarkdown(cleanHighlightText(excerpt)).slice(0, 4000);
}

function sectionLabelsForLocale(locale) {
  return locale === 'de' ? SECTION_LABELS_DE : SECTION_LABELS_EN;
}

function defaultSectionLabel(locale) {
  return locale === 'de' ? 'KI-Ergänzung' : 'AI-added explanation';
}

async function integrateExcerpt({
  openai,
  model,
  language,
  courseBlock,
  note,
  excerpt,
  isSelection
}) {
  const { cleanHighlightText } = require('../shared/cleanHighlightText.cjs');
  const cleanedExcerpt = cleanHighlightText(excerpt);
  const locale = detectNoteLocale(
    note.refinedNote,
    note.note,
    note.highlightedText,
    note.topicTitle,
    cleanedExcerpt
  );
  const lang = language || localeToPromptLanguage(locale);
  const labels = sectionLabelsForLocale(locale);
  const labelHint =
    locale === 'de'
      ? 'KI-Erläuterung|Formelerklärung|Beispiel|Zusammenhang|KI-Ergänzung'
      : 'AI clarification|Formula explanation|Example|Connection|AI-added explanation';

  const existing = String(note.refinedNote || note.note || '').trim();
  const system = `You integrate a short excerpt from an AI tutoring reply into a student's existing study note. Respond in ${lang} as strict JSON only:
{"sectionLabel":"${labelHint}","content":"markdown"}
Rules:
- Pick the best sectionLabel for this excerpt (use the exact German labels when source is German)
- content: lightly cleaned study text (40-100 words; hard max 120) that fits the existing note
- Preserve meaning; do not invent facts; no tutoring filler
- Keep essential formulas with $...$ inline or $$...$$ display math
- Short bullets or 1-2 short paragraphs; not an essay
- Do not repeat large chunks of the existing note
${languagePreservationPrompt(lang)}
${courseProfile.MATH_OUTPUT_HINT}

${courseBlock || ''}`;

  const user = [
    `Topic: ${note.topicTitle || ''}`,
    `Note highlight:\n${(note.highlightedText || '').slice(0, 800)}`,
    `Current note body:\n${existing.slice(0, 2500) || '(empty)'}`,
    `Save mode: ${isSelection ? 'selected excerpt only' : 'full AI answer (summarize to essentials)'}`,
    `AI excerpt to integrate:\n${cleanedExcerpt.slice(0, 3500)}`
  ].join('\n\n');

  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature: 0.25,
    response_format: { type: 'json_object' },
    max_tokens: 450
  });

  const parsed = parseJson(response.choices?.[0]?.message?.content || '');
  if (!parsed?.content) return null;

  let sectionLabel = String(parsed.sectionLabel || defaultSectionLabel(locale)).trim();
  if (!labels.has(sectionLabel)) sectionLabel = defaultSectionLabel(locale);

  let content = normalizeNoteMarkdown(String(parsed.content).trim());
  const words = content.split(/\s+/).length;
  if (words > 130) {
    content = `${content.split(/\s+/).slice(0, 130).join(' ')}…`;
  }

  return { sectionLabel, content };
}

module.exports = {
  fallbackContent,
  integrateExcerpt,
  defaultSectionLabel
};
