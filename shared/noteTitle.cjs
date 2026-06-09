/**
 * Deterministic study-note title derivation.
 * Priority: user title → subtopic → section → key idea → body line → short highlight → source + topic.
 */

const SOURCE_HINTS = {
  tutorChat: 'Tutor answer',
  noteChat: 'Note study',
  deep: 'Deeper dive',
  card: 'Topic card',
  exercise: 'Exercise',
  note: 'Note'
};

const SOURCE_HINTS_DE = {
  tutorChat: 'Tutor-Antwort',
  noteChat: 'Notiz-Chat',
  deep: 'Vertiefung',
  card: 'Themenkarte',
  exercise: 'Übung',
  note: 'Notiz'
};

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
  const raw = String(title || '').trim();
  const t = normalizeForMatch(raw);
  const topic = normalizeForMatch(topicTitle);
  if (!t) return true;
  if (t.length < 3) return true;
  if (t.length > 55) return true;
  const words = t.split(' ').filter(Boolean);
  if (words.length > 8) return true;
  if (topic && t === topic) return true;
  if (topic && t.startsWith(topic) && t.length <= topic.length + 14) return true;
  if (/^(note|notiz|highlight|saved note|ai clarification|ai-erklaerung|ai erklärung)$/i.test(t)) {
    return true;
  }
  if (/^(aus topic tutor|tutor answer|from note study|aus notiz-chat)/i.test(t)) {
    return true;
  }
  if (/^helps with:|^hilft bei:/i.test(t)) return true;
  if (/^explains:|^erklärt:|^clarifies:|^erlaeutert:/i.test(t)) return true;
  if (/^[a-zäöüß]/.test(raw)) return true;
  if (
    /\b(von|und|der|die|das|den|dem|des|ein|eine|einer|einem|einen|ob|wenn|dass|als|mit|für|bei|an|in|zu|the|a|an|of|to|and|or|if|that|when|with|for|by|at|in|on)$/i.test(
      t
    )
  ) {
    return true;
  }
  if (/angenommen|beispiel:|example:|ein beispiel|assume /i.test(t) && words.length > 4) return true;
  return false;
}

function anchorToLabel(anchor) {
  const a = String(anchor || '').trim();
  if (!a) return '';
  const cleaned = a.replace(/^sub-/, '').replace(/-/g, ' ').trim();
  if (!cleaned) return '';
  return cleanTitle(cleaned);
}

function firstWords(text, maxWords = 6) {
  const h = stripMarkdown(text);
  if (!h || h.length < 8) return '';
  return h.split(/\s+/).filter(Boolean).slice(0, maxWords).join(' ');
}

function firstBodyLine(refinedNote, note) {
  const raw = String(refinedNote || note || '')
    .replace(/---\s*AI clarification[\s\S]*?(?=\n##|\n---|$)/gi, '')
    .replace(/Added while studying[^\n]*/gi, '');
  const lines = raw
    .split('\n')
    .map((l) => stripMarkdown(l))
    .filter((l) => l.length >= 12 && l.length <= 70 && !/^merged from:/i.test(l));
  return lines[0] || '';
}

function sourceHint(source, locale) {
  const map = locale === 'de' ? SOURCE_HINTS_DE : SOURCE_HINTS;
  return map[source] || map.note;
}

function shortenNoteTitle(title) {
  const cleaned = cleanTitle(title);
  if (!cleaned) return '';
  const words = cleaned.split(' ').filter(Boolean);
  if (words.length <= 8 && cleaned.length <= 55) return cleaned;
  return words.slice(0, 8).join(' ').slice(0, 55).trim();
}

function deriveStudyNoteTitle(input = {}) {
  if (input.titleEdited && input.title) {
    return shortenNoteTitle(input.title);
  }

  const rawTitle = String(input.title || '').trim();
  if (rawTitle && !isWeakNoteTitle(rawTitle, input.topicTitle)) {
    return shortenNoteTitle(cleanTitle(rawTitle));
  }

  const subtopic = cleanTitle(input.subtopicTitle);
  if (
    subtopic &&
    normalizeForMatch(subtopic) !== normalizeForMatch(input.topicTitle) &&
    !isWeakNoteTitle(subtopic, input.topicTitle)
  ) {
    return shortenNoteTitle(subtopic);
  }

  const section = cleanTitle(input.sectionHeading) || anchorToLabel(input.sectionAnchor);
  if (section && !isWeakNoteTitle(section, input.topicTitle)) {
    return shortenNoteTitle(section);
  }

  const idea = cleanTitle((input.keyIdeas || [])[0]);
  if (idea && !isWeakNoteTitle(idea, input.topicTitle)) {
    return shortenNoteTitle(idea);
  }

  const bodyLine = cleanTitle(firstBodyLine(input.refinedNote, input.note));
  if (bodyLine && !isWeakNoteTitle(bodyLine, input.topicTitle)) {
    return shortenNoteTitle(bodyLine);
  }

  const highlight = cleanTitle(firstWords(input.highlightedText, 6));
  if (highlight && !isWeakNoteTitle(highlight, input.topicTitle)) {
    return shortenNoteTitle(highlight);
  }

  const locale = input.locale === 'de' ? 'de' : 'en';
  const topic = cleanTitle(input.topicTitle);
  if (input.source && topic) {
    return shortenNoteTitle(`${sourceHint(input.source, locale)} · ${topic}`);
  }

  return shortenNoteTitle(topic) || (locale === 'de' ? 'Notiz' : 'Note');
}

module.exports = {
  deriveStudyNoteTitle,
  isWeakNoteTitle,
  shortenNoteTitle,
  firstWords,
  firstBodyLine
};
