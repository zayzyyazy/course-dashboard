const noteLanguage = require('../shared/noteLanguage.cjs');
const { buildRegenerateFeedbackBlock } = require('../shared/expandFeedback.cjs');
const { MATH_OUTPUT_HINT } = require('./courseProfile');

function buildRewindSystemPrompt(language, aiCtx) {
  return `You write a weekly "Rewind" for ONE university lecture — a memory refresh the student reads in 2–4 minutes before an exam or after a week away.

LANGUAGE: ${language}
${noteLanguage.languagePreservationPrompt(language)}

${MATH_OUTPUT_HINT}

${aiCtx.block || ''}

OUTPUT: Markdown only. Use EXACTLY this structure:

## In one minute
2–3 short sentences: what this lecture is for and the main idea (not a textbook intro).

## Three things to remember
- (concrete, exam-useful point 1 — name methods, formulas, or distinctions from THIS lecture)
- (point 2)
- (point 3)

## Topic checklist
For EACH main topic from the input, one bullet:
- **Topic name** — what to recall in one line (procedure, definition, or when to use it)

## Watch out for
One short paragraph: the most common confusion or mistake for this lecture.

RULES:
- Memory-focused: what to recall, not a re-lecture
- Use subtopic names and concrete terms from the source
- Lecture-faithful; no invented content
- Scannable bullets; no filler or meta commentary
- Use $...$ for inline math when needed`;
}

function buildRewindUserPayload({ lecture, extracted, topics, feedback, previousMarkdown }) {
  const topicList = (topics || [])
    .map((t, i) => {
      const subs = (t.subtopics || []).map((s) => s.title).join('; ');
      const cardSnippet = t.card?.markdown
        ? `\n   Tutor card: ${String(t.card.markdown).slice(0, 600)}`
        : '';
      return `${i + 1}. ${t.title} (${t.importance || 'core'})${
        subs ? `\n   Subtopics to hit: ${subs}` : ''
      }${cardSnippet}`;
    })
    .join('\n');

  const parts = [
    `Lecture: ${lecture.title}`,
    `Summary: ${lecture.lectureSummary || lecture.summary || ''}`,
    lecture.courseThread?.summary ? `Course position: ${lecture.courseThread.summary}` : '',
    '',
    'Topics (cover each in Topic checklist):',
    topicList,
    '',
    '--- Source excerpt ---',
    extracted.slice(0, 35000)
  ];

  if (previousMarkdown) {
    parts.push(
      '',
      '--- Previous rewind (replace — do not copy mistakes) ---',
      previousMarkdown.slice(0, 8000)
    );
  }
  parts.push(buildRegenerateFeedbackBlock(feedback));
  return parts.filter(Boolean).join('\n');
}

function resolveRewindLanguage(lecture, extracted) {
  const { language } = noteLanguage.resolveNoteLanguage({
    lectureTitle: lecture?.title,
    lectureSummary: lecture?.lectureSummary || lecture?.summary,
    extractedText: extracted
  });
  return language || 'English';
}

module.exports = {
  buildRewindSystemPrompt,
  buildRewindUserPayload,
  resolveRewindLanguage
};
