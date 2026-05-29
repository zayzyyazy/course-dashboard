import React, { useEffect, useState } from 'react';

const STRENGTH_OPTIONS = [
  { value: 'beginner', label: 'Beginner — need more scaffolding' },
  { value: 'okay', label: 'Okay — standard depth' },
  { value: 'strong', label: 'Strong — can go faster' }
];

const EXAM_OPTIONS = [
  { value: 'theory', label: 'Theory-heavy exams' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'calculation', label: 'Calculation-heavy exams' }
];

const FOCUS_OPTIONS = [
  { value: 'theory', label: 'More theory / concepts' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'application', label: 'More application / Aufgaben' }
];

const DIFFICULTY_OPTIONS = [
  { value: 1, label: '1 — Easy for me' },
  { value: 2, label: '2 — Mostly easy' },
  { value: 3, label: '3 — Medium' },
  { value: 4, label: '4 — Quite hard' },
  { value: 5, label: '5 — Hard for me' }
];

export default function CourseSettingsPage({ course, onBack, onSaved }) {
  const [name, setName] = useState('');
  const [profile, setProfile] = useState(null);
  const [studyMeta, setStudyMeta] = useState({ examDate: '', ects: '', personalDifficulty: 3 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!course?.id) return;
    setLoading(true);
    window.api.getCourseSettings(course.id).then((res) => {
      if (res.success) {
        setName(res.course.name);
        setProfile(res.aiProfile);
        const m = res.studyMeta || {};
        setStudyMeta({
          examDate: m.examDate || '',
          ects: m.ects != null ? String(m.ects) : '',
          personalDifficulty: m.personalDifficulty ?? 3
        });
      }
      setLoading(false);
    });
  }, [course?.id]);

  function setField(key, value) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  function setMetaField(key, value) {
    setStudyMeta((m) => ({ ...m, [key]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!course?.id || !profile) return;
    setSaving(true);
    setMessage('');
    const res = await window.api.saveCourseSettings({
      courseId: course.id,
      name: name.trim(),
      aiProfile: profile,
      studyMeta: {
        examDate: studyMeta.examDate.trim(),
        ects: studyMeta.ects === '' ? null : Number(studyMeta.ects),
        personalDifficulty: Number(studyMeta.personalDifficulty)
      }
    });
    setSaving(false);
    if (res.success) {
      setMessage('Saved');
      onSaved?.(res.course, res.courses);
    } else {
      setMessage(res.error || 'Could not save');
    }
  }

  if (loading || !profile) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted text-sm no-drag">
        Loading settings…
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden no-drag">
      <div className="h-8 drag-region flex-shrink-0" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto px-8 py-6 pb-16">
          <button type="button" onClick={onBack} className="text-xs text-text-muted hover:text-accent mb-4">
            ← Back to course
          </button>

          <h1 className="text-2xl font-bold text-text-primary mb-1">Course settings</h1>
          <p className="text-sm text-text-secondary mb-6">
            AI uses this profile for topic cards, tutor answers, note refinement, and study units in this
            course.
          </p>

          <form onSubmit={handleSave} className="space-y-5">
            <div className="rounded-lg border border-accent/25 bg-accent/5 p-4 space-y-4">
              <p className="text-xs font-medium text-accent uppercase tracking-wide">
                Study dashboard (prioritization)
              </p>
              <label className="block">
                <span className="text-xs text-text-muted uppercase tracking-wide">Exam date</span>
                <input
                  type="date"
                  value={studyMeta.examDate}
                  onChange={(e) => setMetaField('examDate', e.target.value)}
                  className="mt-1 w-full bg-bg-tertiary border border-border-DEFAULT rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                />
              </label>
              <label className="block">
                <span className="text-xs text-text-muted uppercase tracking-wide">
                  Leistungspunkte / ECTS
                </span>
                <input
                  type="number"
                  min="0.5"
                  max="30"
                  step="0.5"
                  value={studyMeta.ects}
                  onChange={(e) => setMetaField('ects', e.target.value)}
                  placeholder="e.g. 6"
                  className="mt-1 w-full bg-bg-tertiary border border-border-DEFAULT rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                />
              </label>
              <label className="block">
                <span className="text-xs text-text-muted uppercase tracking-wide">
                  Difficulty for you personally
                </span>
                <select
                  value={studyMeta.personalDifficulty}
                  onChange={(e) => setMetaField('personalDifficulty', Number(e.target.value))}
                  className="mt-1 w-full bg-bg-tertiary border border-border-DEFAULT rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                >
                  {DIFFICULTY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-xs text-text-muted uppercase tracking-wide">Course name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full bg-bg-tertiary border border-border-DEFAULT rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                required
              />
            </label>

            <label className="block">
              <span className="text-xs text-text-muted uppercase tracking-wide">Your level in this course</span>
              <select
                value={profile.strengthLevel}
                onChange={(e) => setField('strengthLevel', e.target.value)}
                className="mt-1 w-full bg-bg-tertiary border border-border-DEFAULT rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                {STRENGTH_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs text-text-muted uppercase tracking-wide">What you struggle with</span>
              <textarea
                value={profile.strugglesWith}
                onChange={(e) => setField('strugglesWith', e.target.value)}
                rows={2}
                placeholder="e.g. notation, ANOVA assumptions, proofs…"
                className="mt-1 w-full bg-bg-tertiary border border-border-DEFAULT rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-y"
              />
            </label>

            <label className="block">
              <span className="text-xs text-text-muted uppercase tracking-wide">Exam style</span>
              <select
                value={profile.examStyle}
                onChange={(e) => setField('examStyle', e.target.value)}
                className="mt-1 w-full bg-bg-tertiary border border-border-DEFAULT rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                {EXAM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs text-text-muted uppercase tracking-wide">Theory vs application</span>
              <select
                value={profile.focusBalance}
                onChange={(e) => setField('focusBalance', e.target.value)}
                className="mt-1 w-full bg-bg-tertiary border border-border-DEFAULT rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                {FOCUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-2 rounded-lg border border-border-DEFAULT bg-bg-secondary/50 p-4">
              <p className="text-xs text-text-muted uppercase tracking-wide mb-2">Study preferences</p>
              {[
                ['emphasizeAufgaben', 'Emphasize Aufgaben, procedures & worked examples'],
                ['explainNotationCarefully', 'Explain notation carefully'],
                ['decodeFormulas', 'Always decode formulas (symbols + meaning)'],
                ['stepByStep', 'Prefer step-by-step explanations']
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(profile[key])}
                    onChange={(e) => setField(key, e.target.checked)}
                    className="rounded border-border-DEFAULT"
                  />
                  {label}
                </label>
              ))}
            </div>

            <label className="block">
              <span className="text-xs text-text-muted uppercase tracking-wide">Extra instructions</span>
              <textarea
                value={profile.extraInstructions}
                onChange={(e) => setField('extraInstructions', e.target.value)}
                rows={3}
                placeholder="Anything else the AI should know for this course…"
                className="mt-1 w-full bg-bg-tertiary border border-border-DEFAULT rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-y"
              />
            </label>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="px-5 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save settings'}
              </button>
              {message && (
                <span className={`text-sm ${message === 'Saved' ? 'text-accent' : 'text-red-400'}`}>
                  {message}
                </span>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
