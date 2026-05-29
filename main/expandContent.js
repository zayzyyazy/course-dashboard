const { detectLanguage } = require('./pdf');
const noteLanguage = require('../shared/noteLanguage.cjs');
const { buildRegenerateFeedbackBlock } = require('../shared/expandFeedback.cjs');
const { MATH_OUTPUT_HINT } = require('./courseProfile');

function resolveExpandLanguage(lecturePath, lecture, mode, exerciseId, topic, subtopic, extracted) {
  const { language } = noteLanguage.resolveNoteLanguage({
    lectureTitle: lecture?.title,
    lectureSummary: lecture?.lectureSummary || lecture?.summary,
    topicTitle: topic?.title,
    highlightedText: subtopic?.title || topic?.title || topic?.card?.markdown?.slice(0, 500),
    draftNote: topic?.practiceFocus,
    extractedText: extracted
  });
  return language || (detectLanguage(extracted) === 'German' ? 'German' : 'English');
}

function languageRule(language) {
  return noteLanguage.chatLanguagePreservationPrompt(language);
}

function buildTopicExpandSystem(mode, language, aiCtx) {
  const base =
    mode === 'exercise'
      ? `Expand this EXERCISE practice topic in ${language}. Markdown output.
Focus on problem types, procedures, calculations, worked logic, what to practice for exams — stay source-grounded.
${noteLanguage.languagePreservationPrompt(language)}`
      : `Expand this topic with deeper tutor explanation in ${language}. Markdown output.
Go deeper on mechanisms, examples, notation, comparisons — adaptive, not a rigid template.
If the topic is statistical, mathematical, or computational: include formulas, symbol meanings, procedure steps, and interpretation when the lecture material supports them.
${noteLanguage.languagePreservationPrompt(language)}`;

  return `${base}\n\n${languageRule(language)}\n\n${MATH_OUTPUT_HINT}\n\n${aiCtx.block}`;
}

function buildSubtopicExpandSystem(mode, language, aiCtx) {
  const base =
    mode === 'exercise'
      ? `Expand ONE subtopic from an exercise/practice sheet in ${language}. Markdown output only.
Scope strictly to this subtopic — not the whole parent topic. Focus on procedures, problem types, steps, and exam-relevant application.
Start with 2-3 short plain sentences as an intro, then deeper detail. Stay source-grounded.
${noteLanguage.languagePreservationPrompt(language)}`
      : `Expand ONE subtopic from a lecture topic in ${language}. Markdown output only.
Scope strictly to this subtopic — not the entire parent topic. Go deeper on mechanisms, notation, examples for THIS subtopic only.
Start with 2-3 short plain sentences as an intro, then deeper detail. Stay source-grounded.
${noteLanguage.languagePreservationPrompt(language)}`;

  return `${base}\n\n${languageRule(language)}\n\n${MATH_OUTPUT_HINT}\n\n${aiCtx.block}`;
}

function buildTopicExpandUser({ lecture, aiCtx, mode, topic, extracted, feedback, previousMarkdown }) {
  const parts = [
    `Lecture: ${lecture.title}`,
    `Course: ${aiCtx.displayName}`,
    `Mode: ${mode}`,
    `Topic: ${topic.title}`,
    topic.practiceFocus ? `Practice focus: ${topic.practiceFocus}` : '',
    `Existing card:\n${topic.card?.markdown || ''}`,
    `\nSource excerpt:\n${extracted.slice(0, 25000)}`
  ];
  if (previousMarkdown) {
    parts.push(`\nPrevious deeper explanation (replace — do not copy mistakes):\n${previousMarkdown.slice(0, 6000)}`);
  }
  parts.push(buildRegenerateFeedbackBlock(feedback));
  return parts.filter(Boolean).join('\n');
}

function buildSubtopicExpandUser({ lecture, aiCtx, topic, subtopic, subtopicId, extracted, feedback, previousMarkdown }) {
  const parts = [
    `Lecture: ${lecture.title}`,
    `Course: ${aiCtx.displayName}`,
    `Parent topic: ${topic.title}`,
    `Subtopic to expand: ${subtopic.title}`,
    `Other subtopics in this topic (context only): ${(topic.subtopics || [])
      .filter((s) => s.id !== subtopicId)
      .map((s) => s.title)
      .join('; ')}`,
    `Topic card:\n${topic.card?.markdown?.slice(0, 5000) || ''}`,
    `\nSource excerpt:\n${extracted.slice(0, 22000)}`
  ];
  if (previousMarkdown) {
    parts.push(`\nPrevious deeper explanation (replace — do not copy mistakes):\n${previousMarkdown.slice(0, 5000)}`);
  }
  parts.push(buildRegenerateFeedbackBlock(feedback));
  return parts.filter(Boolean).join('\n');
}

module.exports = {
  resolveExpandLanguage,
  buildTopicExpandSystem,
  buildSubtopicExpandSystem,
  buildTopicExpandUser,
  buildSubtopicExpandUser
};
