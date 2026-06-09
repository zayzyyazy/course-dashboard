const { detectLanguage } = require('./pdf');
const noteLanguage = require('../shared/noteLanguage.cjs');
const { buildRegenerateFeedbackBlock } = require('../shared/expandFeedback.cjs');
const { MATH_OUTPUT_HINT, buildExpandProfileBlock } = require('./courseProfile');
const { inferDomain } = require('./pipeline');

const DEPTH_RULES = {
  subtopic:
    'Length: 250–450 words. Structure: 2–3 sentence plain intro → 2–4 short sections max → optional one mini example.',
  topic:
    'Length: 350–550 words. Structure: 2–3 sentence plain intro → 2–4 short sections max → optional one mini example.'
};

const CLARITY_RULES = `Hard rules:
- Clarify what the card already says — do not add content absent from the source.
- Do not list every assumption, caveat, or edge case.
- Do not make the material sound harder than the lecture.
- No vague "go deeper" filler — be direct and practical.`;

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

function isStatisticsDomain(courseName, extracted, topic, subtopic) {
  const hay = [
    courseName,
    extracted?.slice(0, 8000),
    topic?.title,
    topic?.card?.markdown,
    subtopic?.title
  ]
    .filter(Boolean)
    .join('\n');
  return inferDomain(courseName || '', hay).startsWith('statistics');
}

function buildStatisticsExpandBlock(extracted) {
  const src = String(extracted || '').slice(0, 12000).toLowerCase();
  const mentionsSoftware = /jamovi|r\b|spss|excel|software|menü|menu|button|klick|click/.test(src);
  const softwareLine = mentionsSoftware
    ? '- Lead with the software workflow shown in the source (menus, buttons, output tables) when relevant.'
    : '- Prefer practical procedure steps over theory when the source supports it.';
  return `STATISTICS / JAMOVI EMPHASIS (when source supports it):
${softwareLine}
- Include formulas only when the source slide uses them; otherwise describe what to click or read in output.
- Tone: practical exam prep — not textbook anxiety. Do not stress assumptions beyond what the source mentions.`;
}

function buildVisionExpandAddition() {
  return `Attached slide screenshots are from the student's lecture PDF. Describe faithfully what you see (Jamovi UI, tables, diagrams) and align steps with those screenshots. Do not invent UI elements not visible in the images.`;
}

function expandProfileBlock(profile, displayName, feedback) {
  return buildExpandProfileBlock(profile, displayName, feedback);
}

function buildTopicExpandSystem(mode, language, aiCtx, options = {}) {
  const { extracted = '', feedback = {}, hasVision = false } = options;
  const profileBlock = expandProfileBlock(aiCtx.profile, aiCtx.displayName, feedback);
  const statsBlock = isStatisticsDomain(aiCtx.displayName, extracted, options.topic, null)
    ? `\n\n${buildStatisticsExpandBlock(extracted)}`
    : '';
  const visionBlock = hasVision ? `\n\n${buildVisionExpandAddition()}` : '';

  const base =
    mode === 'exercise'
      ? `Expand this EXERCISE practice topic in ${language}. Markdown output.
One level clearer than the card — focused on problem types, procedures, and exam-relevant steps. Stay source-grounded.
${DEPTH_RULES.topic}
${CLARITY_RULES}
${noteLanguage.languagePreservationPrompt(language)}`
      : `Expand this lecture topic in ${language}. Markdown output.
Clarify the topic card — one level clearer, not longer for its own sake. Stay source-grounded.
${DEPTH_RULES.topic}
${CLARITY_RULES}
${noteLanguage.languagePreservationPrompt(language)}`;

  return `${base}${statsBlock}${visionBlock}\n\n${languageRule(language)}\n\n${MATH_OUTPUT_HINT}\n\n${profileBlock}`;
}

function buildSubtopicExpandSystem(mode, language, aiCtx, options = {}) {
  const { extracted = '', feedback = {}, topic, subtopic, hasVision = false } = options;
  const profileBlock = expandProfileBlock(aiCtx.profile, aiCtx.displayName, feedback);
  const statsBlock = isStatisticsDomain(aiCtx.displayName, extracted, topic, subtopic)
    ? `\n\n${buildStatisticsExpandBlock(extracted)}`
    : '';
  const visionBlock = hasVision ? `\n\n${buildVisionExpandAddition()}` : '';

  const base =
    mode === 'exercise'
      ? `Expand ONE subtopic from an exercise/practice sheet in ${language}. Markdown output only.
Scope strictly to this subtopic — not the whole parent topic. Focus on procedures, problem types, and exam-relevant application.
${DEPTH_RULES.subtopic}
${CLARITY_RULES}
${noteLanguage.languagePreservationPrompt(language)}`
      : `Expand ONE subtopic from a lecture topic in ${language}. Markdown output only.
Scope strictly to this subtopic — not the entire parent topic. Clarify what the card already covers.
${DEPTH_RULES.subtopic}
${CLARITY_RULES}
${noteLanguage.languagePreservationPrompt(language)}`;

  return `${base}${statsBlock}${visionBlock}\n\n${languageRule(language)}\n\n${MATH_OUTPUT_HINT}\n\n${profileBlock}`;
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
  buildSubtopicExpandUser,
  buildStatisticsExpandBlock,
  buildVisionExpandAddition,
  isStatisticsDomain,
  DEPTH_RULES,
  CLARITY_RULES
};
