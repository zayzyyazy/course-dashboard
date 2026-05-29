const chatClarify = require('./chatClarify');
const noteLanguage = require('../shared/noteLanguage.cjs');

/**
 * Thin wrapper for contextual "Ask AI" on a text highlight.
 * Reuses chatClarify modes + ask tutor tone; focuses answer on selection only.
 */
function buildSelectionAskSystem(language, answerMode, materialMode, extras = {}) {
  const base = chatClarify.buildAskTutorSystem(language, answerMode, materialMode, extras);
  return `${base}

${noteLanguage.chatLanguagePreservationPrompt(language)}

SELECTION TUTOR (critical):
The student highlighted a specific passage while studying. Answer ONLY about that excerpt.
Do NOT recap the lecture, topic card, or whole note.
If they ask whether something is correct or missing (e.g. empty set, null, symbol), answer directly first (yes/no/unclear), then explain briefly.
Default length: 3–6 sentences unless they asked for more depth.`;
}

function buildSelectionAskUserMessage({
  displayName,
  lectureTitle,
  materialMode,
  topicTitle,
  subtopicTitle,
  noteTitle,
  selectedText,
  question
}) {
  const mode = materialMode === 'exercise' ? 'Übung / exercise' : 'Vorlesung / lecture';
  const excerpt = String(selectedText || '').trim().slice(0, 4000);
  const q = String(question || '').trim();

  return [
    chatClarify.contextUsagePreamble(),
    `Course: ${displayName || 'Course'}`,
    `Lecture / study unit: ${lectureTitle || '—'}`,
    `Mode: ${mode}`,
    topicTitle ? `Topic: ${topicTitle}` : '',
    subtopicTitle ? `Subtopic: ${subtopicTitle}` : '',
    noteTitle ? `Note: ${noteTitle}` : '',
    `HIGHLIGHTED SELECTION (answer about this excerpt only):\n"""${excerpt}"""`,
    `Student question: ${q}`
  ]
    .filter(Boolean)
    .join('\n\n');
}

module.exports = {
  buildSelectionAskSystem,
  buildSelectionAskUserMessage
};
