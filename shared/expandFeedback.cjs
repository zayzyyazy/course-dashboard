/**
 * Optional user feedback when regenerating AI-generated study expansions.
 */

const PRESETS = {
  language_de: 'Write entirely in German (Deutsch), matching the lecture and topic language.',
  language_en: 'Write entirely in English.',
  too_long: 'Make it shorter and more focused — fewer sections, tighter prose.',
  too_short: 'Add more detail, examples, and step-by-step explanation.',
  too_shallow: 'Go deeper — more intuition, notation, and worked reasoning.',
  wrong_level: 'Adjust difficulty to match an introductory university lecture/exercise sheet.',
  too_complicated: 'Make it shorter and simpler — fewer sections, plain language, less jargon.',
  too_theoretical: 'Focus on Jamovi/software procedure and what to do — less theory and notation.',
  too_alarmist: 'Do not stress assumptions, caveats, or difficulty beyond what the source mentions.'
};

function buildRegenerateFeedbackBlock(feedback = {}) {
  const fb = feedback && typeof feedback === 'object' ? feedback : {};
  const lines = [];
  const presets = Array.isArray(fb.presets) ? fb.presets : [];
  for (const key of presets) {
    if (PRESETS[key]) lines.push(`- ${PRESETS[key]}`);
  }
  const text = String(fb.text || '').trim();
  if (text) lines.push(`- User note: ${text.slice(0, 800)}`);
  if (!lines.length) return '';
  return `\n\nREGENERATION — fix the previous attempt:\n${lines.join('\n')}`;
}

module.exports = {
  PRESETS,
  buildRegenerateFeedbackBlock
};
