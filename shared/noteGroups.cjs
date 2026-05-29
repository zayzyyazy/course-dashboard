/** Display-only grouping for related notes (raw notes unchanged). */

const { normalizeForCompare, stripMarkdown, stringsForLocale } = require('./noteListMeta.cjs');
const { detectNoteLocale } = require('./noteLanguage.cjs');

const CONCEPT_PATTERNS_EN = [
  { key: 'eta', label: 'Eta² / effect size', re: /\beta|eta|effektgr|effect size|cohen/i },
  { key: 'omega', label: 'Omega²', re: /omega/i },
  { key: 'ss', label: 'Sums of squares (SS)', re: /ssbetween|sswithin|ss total|quadratsumme|sum of squares|ss_between|ss_within/i },
  { key: 'f-test', label: 'F-test / ANOVA test', re: /\bf[\s-]?test|f-wert|f-statistic|anova.*test/i },
  { key: 'anova', label: 'ANOVA overview', re: /anova|varianzanalyse/i },
  { key: 'interpret', label: 'Interpretation', re: /interpret|bedeutung|threshold|schwellen|cohen/i },
  { key: 'formula', label: 'Formulas & calculation', re: /formel|formula|berechnen|calculate|gleichung|equation/i }
];

const CONCEPT_PATTERNS_DE = [
  { key: 'eta', label: 'Eta² / Effektstärke', re: /\beta|eta|effektgr|effect size|cohen/i },
  { key: 'omega', label: 'Omega²', re: /omega/i },
  { key: 'ss', label: 'Quadratsummen (SS)', re: /ssbetween|sswithin|ss total|quadratsumme|sum of squares|ss_between|ss_within/i },
  { key: 'f-test', label: 'F-Test / ANOVA-Test', re: /\bf[\s-]?test|f-wert|f-statistic|anova.*test/i },
  { key: 'anova', label: 'ANOVA Überblick', re: /anova|varianzanalyse/i },
  { key: 'interpret', label: 'Interpretation', re: /interpret|bedeutung|threshold|schwellen|cohen/i },
  { key: 'formula', label: 'Formeln & Rechnung', re: /formel|formula|berechnen|calculate|gleichung|equation/i }
];

function patternsForLocale(locale) {
  return locale === 'de' ? CONCEPT_PATTERNS_DE : CONCEPT_PATTERNS_EN;
}

function tokenSet(text) {
  const n = normalizeForCompare(stripMarkdown(text));
  if (!n) return new Set();
  return new Set(n.split(' ').filter((w) => w.length > 2));
}

function conceptKeyForNote(note, patterns) {
  if (note.sectionAnchor) return `anchor:${note.sectionAnchor}`;
  if (note.subtopicId) return `sub:${note.subtopicId}`;

  const blob = [
    note.title,
    note.preview,
    (note.keyIdeas || []).join(' '),
    stripMarkdown(note.highlightedText),
    stripMarkdown(note.refinedNote || note.note)
  ].join(' ');

  for (const p of patterns) {
    if (p.re.test(blob)) return p.key;
  }
  return '';
}

function clusterLabelForNotes(notes, conceptKey, locale) {
  const patterns = patternsForLocale(locale);
  if (conceptKey) {
    const p = patterns.find((x) => x.key === conceptKey);
    if (p) return p.label;
  }
  const best = notes[0];
  if (best?.title) return best.title;
  if (best?.keyIdeas?.[0]) return best.keyIdeas[0];
  return stringsForLocale(locale).relatedNotes;
}

function localeForNotes(notes) {
  const blobs = notes.map((n) =>
    [n.title, n.preview, n.topicTitle, n.highlightedText, n.refinedNote, n.note].join(' ')
  );
  return detectNoteLocale(...blobs) || 'de';
}

function groupNotesWithinTopic(notes) {
  if (!notes.length) return [];
  const locale = localeForNotes(notes);
  const patterns = patternsForLocale(locale);
  const sorted = [...notes].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  );
  const groups = [];

  for (const note of sorted) {
    const concept = conceptKeyForNote(note, patterns);
    const tokens = tokenSet(
      `${note.title} ${note.preview} ${(note.keyIdeas || []).join(' ')}`
    );
    let placed = false;

    for (const g of groups) {
      if (concept && g.conceptKey === concept) {
        g.notes.push(note);
        placed = true;
        break;
      }
      if (note.sectionAnchor || note.subtopicId) {
        continue;
      }
      if (!concept && g.tokens && jaccard(tokens, g.tokens) >= 0.42) {
        g.notes.push(note);
        placed = true;
        break;
      }
    }

    if (!placed) {
      groups.push({
        id: `g-${note.id}`,
        conceptKey: concept || '',
        tokens,
        notes: [note]
      });
    }
  }

  return groups.map((g) => ({
    id: g.id,
    label: clusterLabelForNotes(g.notes, g.conceptKey, locale),
    helpsWith: buildGroupHelpsWith(g.notes, locale),
    notes: g.notes,
    count: g.notes.length
  }));
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

function buildGroupHelpsWith(notes, locale) {
  const s = stringsForLocale(locale);
  const previews = notes.map((n) => n.preview).filter(Boolean);
  if (previews.length === 1) return previews[0];
  const ideas = new Set();
  for (const n of notes) {
    for (const k of n.keyIdeas || []) ideas.add(k);
  }
  if (ideas.size) return `${s.helpsWith}: ${[...ideas].slice(0, 2).join(' · ')}`;
  if (previews.length > 1) return previews[0];
  return s.severalRelated;
}

/**
 * Build display model: topic sections → concept clusters → notes.
 * Raw note objects are preserved inside clusters.
 */
function buildNoteDisplayModel(notes) {
  const byTopic = new Map();
  for (const n of notes) {
    const key = n.topicId || n.topicTitle || '_other';
    if (!byTopic.has(key)) {
      byTopic.set(key, { topicId: n.topicId, topicTitle: n.topicTitle || 'Other', notes: [] });
    }
    byTopic.get(key).notes.push(n);
  }

  const sections = [];
  for (const [, section] of byTopic) {
    const clusters = groupNotesWithinTopic(section.notes);
    sections.push({
      topicId: section.topicId,
      topicTitle: section.topicTitle,
      clusters,
      noteCount: section.notes.length
    });
  }

  sections.sort((a, b) =>
    (a.topicTitle || '').localeCompare(b.topicTitle || '', undefined, { sensitivity: 'base' })
  );

  return { sections, totalNotes: notes.length };
}

module.exports = {
  buildNoteDisplayModel,
  groupNotesWithinTopic,
  conceptKeyForNote,
  localeForNotes
};
