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

/** Per-course prioritization metadata for the study dashboard (not used by AI prompts). */
const DEFAULT_STUDY_META = {
  examDate: '',
  ects: null,
  personalDifficulty: 3
};

const MATH_OUTPUT_HINT = `For mathematical notation use $...$ for inline math and $$...$$ for display equations. Do not use \\( \\) or \\[ \\] delimiters. Write valid LaTeX inside delimiters (e.g. $\\mathbb{N}$, $\\frac{a}{b}$).`;

function settingsPath(vaultPath, storageKey) {
  return path.join(vault.courseDir(vaultPath, storageKey), SETTINGS_FILE);
}

function readSettingsFile(vaultPath, storageKey) {
  if (!vaultPath || !storageKey) return null;
  try {
    return JSON.parse(fs.readFileSync(settingsPath(vaultPath, storageKey), 'utf8'));
  } catch {
    return null;
  }
}

function loadProfile(vaultPath, storageKey) {
  const defaults = { ...DEFAULT_PROFILE };
  const data = readSettingsFile(vaultPath, storageKey);
  if (!data) return defaults;
  return { ...defaults, ...(data.aiProfile || data) };
}

function normalizeStudyMeta(raw) {
  const meta = { ...DEFAULT_STUDY_META, ...(raw || {}) };
  const examDate = String(meta.examDate || '').trim();
  let ects = meta.ects;
  if (ects != null && ects !== '') {
    const n = Number(ects);
    ects = Number.isFinite(n) && n > 0 ? Math.min(30, Math.round(n * 2) / 2) : null;
  } else {
    ects = null;
  }
  let personalDifficulty = Number(meta.personalDifficulty);
  if (!Number.isFinite(personalDifficulty)) personalDifficulty = 3;
  personalDifficulty = Math.min(5, Math.max(1, Math.round(personalDifficulty)));
  return { examDate, ects, personalDifficulty };
}

function loadStudyMeta(vaultPath, storageKey) {
  const data = readSettingsFile(vaultPath, storageKey);
  return normalizeStudyMeta(data?.studyMeta);
}

function saveProfile(vaultPath, storageKey, aiProfile) {
  const dir = vault.courseDir(vaultPath, storageKey);
  fs.mkdirSync(dir, { recursive: true });
  const existing = readSettingsFile(vaultPath, storageKey) || {};
  const payload = {
    version: 1,
    aiProfile: { ...DEFAULT_PROFILE, ...aiProfile },
    studyMeta: normalizeStudyMeta(existing.studyMeta),
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(settingsPath(vaultPath, storageKey), JSON.stringify(payload, null, 2), 'utf8');
  return payload.aiProfile;
}

function saveStudyMeta(vaultPath, storageKey, studyMeta) {
  const dir = vault.courseDir(vaultPath, storageKey);
  fs.mkdirSync(dir, { recursive: true });
  const existing = readSettingsFile(vaultPath, storageKey) || {};
  const payload = {
    version: 1,
    aiProfile: { ...DEFAULT_PROFILE, ...(existing.aiProfile || {}) },
    studyMeta: normalizeStudyMeta(studyMeta),
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(settingsPath(vaultPath, storageKey), JSON.stringify(payload, null, 2), 'utf8');
  return payload.studyMeta;
}

function saveCourseSettingsBundle(vaultPath, storageKey, { aiProfile, studyMeta }) {
  const dir = vault.courseDir(vaultPath, storageKey);
  fs.mkdirSync(dir, { recursive: true });
  const existing = readSettingsFile(vaultPath, storageKey) || {};
  const payload = {
    version: 1,
    aiProfile: aiProfile != null ? { ...DEFAULT_PROFILE, ...aiProfile } : { ...DEFAULT_PROFILE, ...(existing.aiProfile || {}) },
    studyMeta: studyMeta != null ? normalizeStudyMeta(studyMeta) : normalizeStudyMeta(existing.studyMeta),
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(settingsPath(vaultPath, storageKey), JSON.stringify(payload, null, 2), 'utf8');
  return { aiProfile: payload.aiProfile, studyMeta: payload.studyMeta };
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

/** Softer profile for “Go deeper” — clarity over verbosity. */
function buildExpandProfileBlock(profile, courseDisplayName, feedback = {}) {
  const p = { ...DEFAULT_PROFILE, ...profile };
  const presets = Array.isArray(feedback?.presets) ? feedback.presets : [];
  const wantMoreDepth = presets.includes('too_shallow') || presets.includes('too_short');

  const lines = [
    '--- EXPAND STYLE (clarify the card; do not invent lecture facts) ---',
    `Course: ${courseDisplayName || 'this course'}`,
    p.strugglesWith?.trim() ? `Student struggles with: ${p.strugglesWith.trim()}` : '',
    `Exam / assessment style: ${p.examStyle}`,
    p.emphasizeAufgaben
      ? 'When the source shows exercises or software steps, keep the practical workflow visible.'
      : '',
    wantMoreDepth && p.stepByStep
      ? 'Prefer clear step-by-step logic for procedures when the source supports it.'
      : '',
    wantMoreDepth && p.decodeFormulas
      ? 'When the source uses a formula, briefly name symbols — do not add extra formulas.'
      : '',
    wantMoreDepth && p.explainNotationCarefully
      ? 'Decode unfamiliar notation only when it appears in the source.'
      : '',
    p.extraInstructions?.trim() ? `Additional course instructions: ${p.extraInstructions.trim()}` : '',
    'Prefer clarity over completeness; never increase perceived difficulty.',
    'One level clearer than the topic card — not a textbook chapter.',
    '---'
  ];
  return lines.filter(Boolean).join('\n');
}

module.exports = {
  SETTINGS_FILE,
  DEFAULT_PROFILE,
  DEFAULT_STUDY_META,
  MATH_OUTPUT_HINT,
  loadProfile,
  loadStudyMeta,
  saveProfile,
  saveStudyMeta,
  saveCourseSettingsBundle,
  normalizeStudyMeta,
  buildPromptBlock,
  buildExpandProfileBlock
};
