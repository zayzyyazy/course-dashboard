const lectureNotes = require('./lectureNotes');
const { pickNoteToAppend } = require('../shared/noteAppendPick.cjs');
const { buildNoteTitle, buildNotePreview } = require('../shared/noteListMeta.cjs');
const { normalizeNoteMarkdown } = require('../shared/noteMarkdown.cjs');
const { languagePreservationPrompt, detectNoteLocale } = require('../shared/noteLanguage.cjs');
const { resolveSaveAnchors } = require('../shared/noteAnchor.cjs');

function parseRefineJson(raw) {
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

async function generateNewNoteFromHighlight({
  openai,
  model,
  language,
  courseBlock,
  mathHint,
  lectureTitle,
  topicTitle,
  highlightedText,
  lectureSummary
}) {
  const system = `You save a highlighted passage into the student's lecture notes. Respond in ${language} as strict JSON only:
{"title":"short distinct note title (3-8 words)","keyIdeas":["phrase",...],"refinedNote":"markdown study note","appendToExisting":false}
Rules:
- title: specific insight label — never just the topic name
- keyIdeas: 2-4 short phrases
- refinedNote: concise revision note (40-120 words) from the highlight; faithful; $...$ for inline math
- appendToExisting: always false here (routing decided separately)
${languagePreservationPrompt(language)}
${mathHint}
${courseBlock}`;

  const user = [
    `Lecture: ${lectureTitle || ''}`,
    `Topic: ${topicTitle || ''}`,
    `Highlight to save:\n${highlightedText}`,
    lectureSummary ? `Lecture context:\n${lectureSummary.slice(0, 1200)}` : ''
  ].join('\n\n');

  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature: 0.22,
    response_format: { type: 'json_object' },
    max_tokens: 520
  });

  const parsed = parseRefineJson(response.choices?.[0]?.message?.content || '');
  if (!parsed?.refinedNote) return null;

  let refinedNote = String(parsed.refinedNote).trim();
  const words = refinedNote.split(/\s+/).length;
  if (words > 160) {
    refinedNote = `${refinedNote.split(/\s+/).slice(0, 160).join(' ')}…`;
  }

  return {
    title: String(parsed.title || topicTitle || '').trim().slice(0, 120),
    keyIdeas: Array.isArray(parsed.keyIdeas) ? parsed.keyIdeas.slice(0, 4) : [],
    refinedNote
  };
}

async function autoSaveHighlight({
  lecturePath,
  highlightedText,
  topicId,
  topicTitle,
  subtopicId,
  subtopicTitle,
  sectionAnchor: sectionAnchorIn,
  sourceKind: sourceKindIn,
  markdownSource,
  noteId,
  source = 'card',
  materialMode = 'lecture',
  lecture,
  language,
  courseBlock,
  mathHint,
  openai,
  model
}) {
  const { cleanHighlightText } = require('../shared/cleanHighlightText.cjs');
  const highlight = cleanHighlightText(String(highlightedText || '')).slice(0, 4000);
  if (!highlight) {
    return { success: false, error: 'Nothing highlighted' };
  }

  const locale =
    detectNoteLocale(highlight, topicTitle, subtopicTitle, lecture?.title, lecture?.lectureSummary) ||
    'de';
  const anchors = resolveSaveAnchors({
    source,
    sourceKind: sourceKindIn,
    markdownSource,
    highlightedText: highlight,
    subtopic: subtopicId
      ? { id: subtopicId, title: subtopicTitle }
      : null,
    topicId: topicId || ''
  });
  const sectionAnchor = sectionAnchorIn || anchors.sectionAnchor || '';
  const sourceKind = sourceKindIn || anchors.sourceKind || source;

  const existing = lectureNotes.listNotes(lecturePath);
  const match = pickNoteToAppend(existing, highlight, {
    noteId,
    topicId: topicId || '',
    subtopicId: anchors.subtopicId || subtopicId || '',
    subtopicTitle: subtopicTitle || '',
    sectionAnchor,
    sourceKind
  });

  if (match) {
    const block =
      locale === 'de'
        ? normalizeNoteMarkdown(
            `**Markierung**\n\n> ${highlight.replace(/\n/g, '\n> ')}\n\n*Zur gleichen Idee wie diese Notiz hinzugefügt.*`
          )
        : normalizeNoteMarkdown(
            `**Highlight**\n\n> ${highlight.replace(/\n/g, '\n> ')}\n\n*Added to this note — same concept as before.*`
          );
    const appended = lectureNotes.appendStudyBlock(lecturePath, match.id, {
      sectionLabel: locale === 'de' ? 'Verwandte Markierung' : 'Related highlight',
      content: block,
      retitleContext: {
        highlightedText: highlight
      }
    });
    if (!appended.success) return appended;
    return {
      success: true,
      note: appended.note,
      mode: 'appended',
      message:
        locale === 'de'
          ? `Zu bestehender Notiz hinzugefügt: ${match.title || 'deine Notiz'}`
          : `Added to existing note: ${match.title || 'your note'}`
    };
  }

  const generated = await generateNewNoteFromHighlight({
    openai,
    model,
    language,
    courseBlock,
    mathHint,
    lectureTitle: lecture?.title,
    topicTitle,
    highlightedText: highlight,
    lectureSummary: lecture?.lectureSummary || lecture?.summary
  });

  if (!generated) {
    return { success: false, error: 'Could not generate note' };
  }

  const title = buildNoteTitle({
    title: generated.title,
    topicTitle,
    subtopicTitle: subtopicTitle || anchors.subtopicTitle || '',
    sectionAnchor,
    keyIdeas: generated.keyIdeas,
    highlightedText: highlight,
    aiAnswerText: source === 'tutorChat' ? generated.refinedNote : '',
    refinedNote: generated.refinedNote,
    source,
    locale
  });

  const preview = buildNotePreview({
    keyIdeas: generated.keyIdeas,
    refinedNote: generated.refinedNote,
    highlightedText: highlight,
    title,
    topicTitle,
    locale
  });

  const created = lectureNotes.addNote(lecturePath, {
    topicId: topicId || '',
    topicTitle: topicTitle || '',
    subtopicId: anchors.subtopicId || subtopicId || '',
    subtopicTitle: subtopicTitle || anchors.subtopicTitle || '',
    sectionAnchor,
    sourceKind,
    source,
    materialMode,
    highlightedText: highlight,
    note: generated.refinedNote,
    refinedNote: generated.refinedNote,
    keyIdeas: generated.keyIdeas,
    title,
    preview
  });

  if (!created.success) return created;
  return {
    success: true,
    note: created.note,
    mode: 'created',
    message: locale === 'de' ? 'Als neue Notiz gespeichert' : 'Saved as a new note'
  };
}

module.exports = {
  autoSaveHighlight
};
