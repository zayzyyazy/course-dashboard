/**
 * Deterministic study-note title derivation.
 * Keeps titles short, concept-focused, and German-friendly.
 */

function stripMarkdown(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^$]+\$/g, ' ')
    .replace(/[#*_>[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeForMatch(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCaseToken(word) {
  if (!word) return '';
  if (/^(ss_between|ss_within|ss_total)$/i.test(word)) return word.toUpperCase();
  if (/^f-test$/i.test(word)) return 'F-Test';
  if (/^eta2$|^eta²$|^η²$/i.test(word)) return 'Eta²';
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function cleanTitle(raw) {
  let t = stripMarkdown(raw)
    .replace(/\s+/g, ' ')
    .replace(/[;:,.!?]+$/g, '')
    .replace(/\.{3,}$/g, '')
    .trim();
  if (!t) return '';
  const words = t.split(' ').filter(Boolean);
  if (words.length > 8) {
    t = words.slice(0, 8).join(' ');
  }
  return t.slice(0, 55).trim();
}

function isWeakNoteTitle(title, topicTitle = '') {
  const t = normalizeForMatch(title);
  const topic = normalizeForMatch(topicTitle);
  if (!t) return true;
  if (t.length < 3) return true;
  if (t.length > 70) return true;
  if (topic && t === topic) return true;
  if (topic && t.startsWith(topic) && t.length <= topic.length + 14) return true;
  if (/^(note|notiz|highlight|saved note|ai clarification|ai-erklaerung|ai erklärung)$/i.test(t)) {
    return true;
  }
  if (/^(aus topic tutor|tutor answer|from note study|aus notiz-chat)/i.test(t)) {
    return true;
  }
  if (/[.?!]\s/.test(t) && t.split(' ').length > 7) return true;
  return false;
}

function heuristicTitle(blob) {
  const b = normalizeForMatch(blob);
  if (!b) return '';

  if (/defining sets by enumeration|enumeration|aufz(a|ä)hlung|listing elements|mengen aufz(a|ä)hlen/i.test(b)) {
    return 'Mengen aufzählen';
  }
  if (/reihenfolge (irrelevant|egal)|order irrelevant|order does not matter|ordnung irrelevant/i.test(b)) {
    return 'Reihenfolge in Mengen';
  }
  if (/(eta[-\s]?(quadrat|2)|eta²|η²|effektst(a|ä)rke|effect size)/i.test(b)) {
    return 'Eta² / Effektstärke';
  }
  if (/(ss_between|ssbetween|sum of squares|quadratsumme|quadratsummen|ss_within|ss_total)/i.test(b)) {
    return /beispiel|example|aufgabe/i.test(b) ? 'Beispiel für SS_between' : 'SS_between berechnen';
  }
  if (/\bf[-\s]?test\b|f-wert|f statistic|anova|signifikanztest/i.test(b)) {
    return /beispiel|example|aufgabe/i.test(b) ? 'Beispiel für F-Test' : 'F-Test interpretieren';
  }
  if (/vereinigung|[^a-z]∪| union /i.test(b)) {
    return 'Vereinigung von Mengen';
  }
  if (/schnitt|[^a-z]∩| intersection /i.test(b)) {
    return 'Schnitt von Mengen';
  }
  if (/differenz|[^a-z]∖|\\setminus| minus /i.test(b)) {
    return 'Differenz von Mengen';
  }
  if (/kardinalit(a|ä)t|\|a\||\|b\||cardinality/i.test(b)) {
    return 'Kardinalität berechnen';
  }
  if (/leere menge|empty set|{}|∅/i.test(b)) {
    return 'Leere Menge als Element';
  }
  if (/belongs to set|zugeh(o|ö)rigkeit|[^a-z]∈|[^a-z]∉|element .* menge|membership|notin/i.test(b)) {
    return 'Element in Menge prüfen';
  }
  return '';
}

function anchorToLabel(anchor) {
  const a = String(anchor || '').trim();
  if (!a) return '';
  const cleaned = a.replace(/^sub-/, '').replace(/-/g, ' ').trim();
  if (!cleaned) return '';
  const words = cleaned.split(' ').filter(Boolean).slice(0, 6).map(titleCaseToken);
  return cleanTitle(words.join(' '));
}

function contextLabel({ sectionHeading, sectionAnchor, subtopicTitle, topicTitle, source }) {
  const section = cleanTitle(sectionHeading) || anchorToLabel(sectionAnchor);
  if (section && !isWeakNoteTitle(section, topicTitle)) return section;
  const subtopic = cleanTitle(subtopicTitle);
  if (subtopic && !isWeakNoteTitle(subtopic, topicTitle)) return subtopic;
  if (source === 'tutorChat' || source === 'noteChat') {
    const topic = cleanTitle(topicTitle);
    if (topic) return `${topic} klären`.slice(0, 55);
  }
  return cleanTitle(topicTitle);
}

function shortenNoteTitle(title) {
  const cleaned = cleanTitle(title);
  if (!cleaned) return '';
  const words = cleaned.split(' ').filter(Boolean);
  if (words.length <= 6 && cleaned.length <= 55) return cleaned;
  return words.slice(0, 6).join(' ').slice(0, 55).trim();
}

function deriveStudyNoteTitle(input = {}) {
  const explicit = cleanTitle(input.title);
  if (explicit && !isWeakNoteTitle(explicit, input.topicTitle)) {
    return shortenNoteTitle(explicit);
  }

  const blob = [
    input.sectionHeading,
    input.sectionAnchor,
    input.subtopicTitle,
    input.topicTitle,
    input.highlightedText,
    input.aiAnswerText,
    input.refinedNote,
    input.note,
    (input.keyIdeas || []).join(' ')
  ]
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .join('\n');

  const heuristic = heuristicTitle(blob);
  if (heuristic) return heuristic;

  const context = contextLabel(input);
  if (context && !isWeakNoteTitle(context, input.topicTitle)) {
    return shortenNoteTitle(context);
  }

  const fallback = cleanTitle(input.topicTitle) || 'Notiz';
  return shortenNoteTitle(fallback);
}

module.exports = {
  deriveStudyNoteTitle,
  isWeakNoteTitle,
  shortenNoteTitle
};
