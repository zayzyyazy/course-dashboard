const fs = require('fs');
const path = require('path');
const vault = require('./vault');

const SETTINGS_FILE = 'course_settings.json';

const DEFAULT_PROFILE = {
  strengthLevel: 'okay',
  strugglesWith: '',
  examStyle: 'balanced',
  focusBalance: 'balanced',
  emphasizeAufgaben: false,
  explainNotationCarefully: true,
  decodeFormulas: true,
  stepByStep: true,
  extraInstructions: ''
};

const MATH_OUTPUT_HINT = `For mathematical notation use $...$ for inline math and $$...$$ for display equations. Do not use \\( \\) or \\[ \\] delimiters. Write valid LaTeX inside delimiters (e.g. $\\mathbb{N}$, $\\frac{a}{b}$).`;

function settingsPath(vaultPath, storageKey) {
  return path.join(vault.courseDir(vaultPath, storageKey), SETTINGS_FILE);
}

function loadProfile(vaultPath, storageKey) {
  const defaults = { ...DEFAULT_PROFILE };
  if (!vaultPath || !storageKey) return defaults;
  try {
    const data = JSON.parse(fs.readFileSync(settingsPath(vaultPath, storageKey), 'utf8'));
    return { ...defaults, ...(data.aiProfile || data) };
  } catch {
    return defaults;
  }
}

function saveProfile(vaultPath, storageKey, aiProfile) {
  const dir = vault.courseDir(vaultPath, storageKey);
  fs.mkdirSync(dir, { recursive: true });
  const payload = {
    version: 1,
    aiProfile: { ...DEFAULT_PROFILE, ...aiProfile },
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(settingsPath(vaultPath, storageKey), JSON.stringify(payload, null, 2), 'utf8');
  return payload.aiProfile;
}

function buildPromptBlock(profile, courseDisplayName) {
  const p = { ...DEFAULT_PROFILE, ...profile };
  const lines = [
    '--- COURSE LEARNING PROFILE (adapt style; do not invent lecture facts) ---',
    `Course: ${courseDisplayName || 'this course'}`,
    `Strength in this course: ${p.strengthLevel}`,
    p.strugglesWith?.trim() ? `Student struggles with: ${p.strugglesWith.trim()}` : '',
    `Exam / assessment style: ${p.examStyle}`,
    `Theory vs application emphasis: ${p.focusBalance}`,
    p.emphasizeAufgaben
      ? 'Emphasize Aufgaben, worked examples, procedures, and application steps when the material supports it.'
      : '',
    p.explainNotationCarefully
      ? 'Explain notation and symbols carefully; decode unfamiliar symbols.'
      : '',
    p.decodeFormulas
      ? 'When formulas appear, name each symbol and what the formula is for.'
      : '',
    p.stepByStep ? 'Prefer clear step-by-step logic for procedures and calculations.' : '',
    p.extraInstructions?.trim() ? `Additional course instructions: ${p.extraInstructions.trim()}` : '',
    'This profile guides tone and emphasis only; lecture source material remains authoritative.',
    '---'
  ];
  return lines.filter(Boolean).join('\n');
}

module.exports = {
  SETTINGS_FILE,
  DEFAULT_PROFILE,
  MATH_OUTPUT_HINT,
  loadProfile,
  saveProfile,
  buildPromptBlock
};
