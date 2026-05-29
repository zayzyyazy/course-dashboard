/**
 * Chat-only clarify / unstuck tutor behavior.
 * Used by Ask Tutor and note-study chat — NOT topic cards or lecture generation.
 */

const CONFUSION_RE =
  /don't get|don't understand|do not get|confus|makes no sense|what does this mean|why is this|still don't|overcomplicat|explain.*simply|in simple|plain language|literally don't|doesn't make sense|what even|mixing up|stuck|help me understand|no idea|lost/i;

const BRIDGE_RE =
  /connect|relation|link|relate|how does this fit|prerequisite|builds on|difference between| vs | versus |compared to|how is this related/i;

const DECODE_RE =
  /formula|symbol|notation|calculate|calculation|step|procedure|what does .* mean|decode|interpret|equation|frac|sigma|mu|lambda|alpha|beta|variable|term|coefficient|proof step|algorithm/i;

const DEEPER_RE =
  /exam depth|in detail|go deeper|thorough|comprehensive|full explanation|derive|derivation|walk me through everything|explain fully|all steps|complete explanation/i;

const noteLanguage = require('../shared/noteLanguage.cjs');

const ANTI_MIRROR = `REFERENCE RULE (critical):
You receive notes, topic cards, and lecture excerpts as background only — the student already read them.
Do NOT restate, summarize, or lightly reword that material.
Explain the same idea in DIFFERENT plain language, another angle, or a simpler mental model.
Never sound like a topic card, lecture summary, or study sheet.`;

function detectAnswerMode(question) {
  const q = String(question || '').toLowerCase();
  if (DEEPER_RE.test(q)) return 'deeper';
  if (DECODE_RE.test(q)) return 'decode';
  if (BRIDGE_RE.test(q)) return 'bridge';
  if (CONFUSION_RE.test(q)) return 'clarify';
  return 'clarify';
}

function modeInstructions(mode) {
  switch (mode) {
    case 'bridge':
      return `MODE: bridge — short connection only (max ~5 sentences).
State how two ideas relate; no recap of either topic. No bullet lists unless essential.`;
    case 'decode':
      return `MODE: decode — translate symbols/steps into plain language (max ~8 sentences).
Order: (1) what it means in words (2) what each symbol/part does (3) why the step exists (4) one tiny intuition if helpful.
No long derivation unless the student explicitly asked for full detail.`;
    case 'deeper':
      return `MODE: deeper — student asked for more depth; you may use up to ~220 words.
Still avoid copying topic-card structure; stay direct, not a mini textbook chapter.`;
    default:
      return `MODE: clarify (default) — unstuck tutor, NOT study mode.
Default length: 3–7 sentences. No headers, no multi-section essays, no "comprehensive overview".
Order when helpful:
1) one-sentence plain meaning ("In simple terms…")
2) what they may be mixing up
3) one tiny example or comparison
4) optional short check-in ("Does that part click now?")
Use phrases like "What this really means…", "The confusing part is…", "Think of it as…", "The difference is just…"`;
  }
}

function maxTokensForMode(mode) {
  switch (mode) {
    case 'bridge':
      return 380;
    case 'decode':
      return 550;
    case 'deeper':
      return 950;
    default:
      return 480;
  }
}

function temperatureForMode(mode) {
  return mode === 'deeper' ? 0.26 : 0.34;
}

function buildChatSystemPrompt({
  language,
  surface,
  materialMode,
  answerMode,
  courseProfileBlock = '',
  mathHint = ''
}) {
  const surfaceNote =
    surface === 'noteStudy'
      ? 'The student is studying ONE saved note — answer what they asked about that note, not the whole lecture.'
      : materialMode === 'exercise'
        ? 'Exercise / Übung chat — ground in practice steps, but still clarify simply when stuck.'
        : 'Ask Tutor chat on a lecture/topic — clarify what they asked, not the whole topic.';

  return `You are an **unstuck clarify tutor** in Course Dashboard chat — NOT a lecture writer or topic-card generator. Answer in ${language}.

${noteLanguage.chatLanguagePreservationPrompt(language)}

${surfaceNote}

${ANTI_MIRROR}

${modeInstructions(answerMode || 'clarify')}

CHAT vs STUDY CONTENT:
- Topic cards and lecture pages = structured study material (you are NOT generating those).
- Chat = help when confused: simpler, different wording, one idea at a time.

MATH / STATS / CS (when relevant):
- Say what the formula/step *means* in words before symbols.
- Keep $...$ for inline math when it helps; do not dump long LaTeX blocks in clarify mode.

AVOID: "Here is a comprehensive explanation…", repeating the note/card, textbook tone, generic recap, answering a question they did not ask.

${mathHint}

${courseProfileBlock}`.trim();
}

function buildNoteStudySystem(language, answerMode, extras = {}) {
  return buildChatSystemPrompt({
    language,
    surface: 'noteStudy',
    materialMode: 'lecture',
    answerMode,
    ...extras
  });
}

function buildAskTutorSystem(language, answerMode, materialMode, extras = {}) {
  return buildChatSystemPrompt({
    language,
    surface: 'askTutor',
    materialMode,
    answerMode,
    ...extras
  });
}

function contextUsagePreamble() {
  return `[CONTEXT BELOW = reference only. Do not mirror its wording or structure in your answer.]\n`;
}

module.exports = {
  detectAnswerMode,
  maxTokensForMode,
  temperatureForMode,
  buildNoteStudySystem,
  buildAskTutorSystem,
  contextUsagePreamble,
  ANTI_MIRROR
};
