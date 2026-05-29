const fs = require('fs');
const path = require('path');
const {
  normalizeNoteMarkdown,
  formatStudyBlock,
  ensureRefinedNoteCore,
  rebuildRefinedNote
} = require('../shared/noteMarkdown.cjs');
const {
  buildNoteTitle,
  buildNotePreview,
  enrichNoteListFields,
  stringsForLocale,
  isWeakTitle
} = require('../shared/noteListMeta.cjs');
const { detectNoteLocale } = require('../shared/noteLanguage.cjs');
const { buildNoteRoutingKey } = require('../shared/noteAnchor.cjs');

const NOTES_FILE = 'lecture_notes.json';
const VALID_SOURCES = new Set(['card', 'deep', 'noteChat', 'exercise', 'tutorChat']);

function notesPath(lecturePath) {
  return path.join(lecturePath, NOTES_FILE);
}

function readNotes(lecturePath) {
  try {
    const data = JSON.parse(fs.readFileSync(notesPath(lecturePath), 'utf8'));
    return Array.isArray(data.notes) ? data : { version: 1, notes: [] };
  } catch {
    return { version: 1, notes: [] };
  }
}

function writeNotes(lecturePath, payload) {
  fs.writeFileSync(notesPath(lecturePath), JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

function compareNotes(a, b) {
  const topicA = (a.topicTitle || '\uffff').toLowerCase();
  const topicB = (b.topicTitle || '\uffff').toLowerCase();
  if (topicA !== topicB) return topicA.localeCompare(topicB);
  const orderA = Number.isFinite(a.sortIndex) ? a.sortIndex : Number.MAX_SAFE_INTEGER;
  const orderB = Number.isFinite(b.sortIndex) ? b.sortIndex : Number.MAX_SAFE_INTEGER;
  if (orderA !== orderB) return orderA - orderB;
  return new Date(a.createdAt) - new Date(b.createdAt);
}

function hydrateNoteForDisplay(note) {
  let hydrated = { ...note };
  if (Array.isArray(note.studyAdditions) && note.studyAdditions.length > 0) {
    hydrated.refinedNote = rebuildRefinedNote(hydrated);
  }
  const locale =
    detectNoteLocale(
      hydrated.highlightedText,
      hydrated.topicTitle,
      hydrated.refinedNote,
      hydrated.note,
      hydrated.title
    ) || 'de';
  const needsFill =
    !hydrated.title?.trim() ||
    isWeakTitle(hydrated.title, hydrated.topicTitle) ||
    !hydrated.preview?.trim();
  if (needsFill) {
    return enrichNoteListFields(hydrated, { locale });
  }
  return { ...hydrated, outputLocale: locale };
}

function listNotes(lecturePath) {
  const data = readNotes(lecturePath);
  return data.notes.map(hydrateNoteForDisplay).sort(compareNotes);
}

function addNote(lecturePath, entry) {
  const data = readNotes(lecturePath);
  const topicTitle = String(entry.topicTitle || '').trim();
  const source = VALID_SOURCES.has(entry.source) ? entry.source : 'card';
  const parentLabel = String(entry.parentNoteTitle || topicTitle || 'note').trim();

  const { cleanHighlightText } = require('../shared/cleanHighlightText.cjs');
  let highlightedText = cleanHighlightText(String(entry.highlightedText || '')).slice(0, 4000);
  const locale =
    detectNoteLocale(topicTitle, entry.highlightedText, entry.refinedNote, entry.note) || 'de';
  const hints = stringsForLocale(locale);
  if (!highlightedText && source === 'noteChat') {
    highlightedText =
      locale === 'de'
        ? `Aus Notiz-Chat · verknüpft mit „${parentLabel}”`
        : `From note study · linked to “${parentLabel}”`;
    highlightedText = highlightedText.slice(0, 4000);
  }
  if (!highlightedText && source === 'tutorChat') {
    highlightedText =
      locale === 'de'
        ? `Aus Topic-Tutor · ${topicTitle || 'Thema'}`
        : `From topic tutor · ${topicTitle || 'topic'}`;
    highlightedText = highlightedText.slice(0, 4000);
  }

  const body = String(entry.note || entry.refinedNote || '').trim();
  if (!highlightedText) {
    return { success: false, error: 'Highlighted text is empty' };
  }
  if (!body && source !== 'noteChat' && source !== 'tutorChat') {
    return { success: false, error: 'Note body is empty' };
  }

  const refinedRaw = String(entry.refinedNote || entry.note || '').trim();
  const keyIdeas = Array.isArray(entry.keyIdeas)
    ? entry.keyIdeas.map((k) => String(k).trim()).filter(Boolean).slice(0, 8)
    : [];
  const title = buildNoteTitle({
    title: entry.title,
    topicTitle,
    subtopicTitle: String(entry.subtopicTitle || '').trim(),
    sectionAnchor: String(entry.sectionAnchor || '').trim(),
    sectionHeading: String(entry.sectionHeading || '').trim(),
    keyIdeas,
    highlightedText,
    aiAnswerText: source === 'tutorChat' ? String(entry.note || entry.refinedNote || '') : '',
    refinedNote: refinedRaw,
    note: entry.note,
    source,
    locale
  });
  const preview = buildNotePreview({
    keyIdeas,
    refinedNote: refinedRaw,
    note: entry.note,
    highlightedText,
    title,
    topicTitle,
    locale
  });

  const maxOrder = data.notes.reduce((m, n) => Math.max(m, Number(n.sortIndex) || 0), 0);
  const note = {
    id: `note-${Date.now()}`,
    title,
    preview,
    topicId: entry.topicId || '',
    topicTitle,
    subtopicId: String(entry.subtopicId || '').trim(),
    subtopicTitle: String(entry.subtopicTitle || '').trim(),
    sectionAnchor: String(entry.sectionAnchor || '').trim(),
    sectionHeading: String(entry.sectionHeading || '').trim(),
    sourceKind: String(entry.sourceKind || entry.source || 'card').trim(),
    routingKey: buildNoteRoutingKey({
      lecturePath,
      topicId: entry.topicId || '',
      subtopicId: String(entry.subtopicId || '').trim(),
      sectionAnchor: String(entry.sectionAnchor || '').trim(),
      sourceKind: String(entry.sourceKind || entry.source || 'card').trim(),
      materialMode: ['lecture', 'exercise'].includes(entry.materialMode) ? entry.materialMode : 'lecture',
      exerciseId: String(entry.exerciseId || '').trim()
    }),
    source,
    highlightedText,
    note: String(entry.note || '').trim().slice(0, 8000),
    keyIdeas,
    refinedNote: normalizeNoteMarkdown(refinedRaw).slice(0, 12000),
    refinedNoteCore: normalizeNoteMarkdown(refinedRaw).slice(0, 12000),
    studyAdditions: [],
    relatedNoteId: String(entry.relatedNoteId || '').trim(),
    materialMode: ['lecture', 'exercise'].includes(entry.materialMode) ? entry.materialMode : 'lecture',
    exerciseId:
      entry.materialMode === 'exercise' ? String(entry.exerciseId || '').trim() : '',
    sortIndex: maxOrder + 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    outputLocale: locale
  };

  if (source === 'noteChat' && !note.note) {
    note.note = note.refinedNote || body;
  }
  if (source === 'tutorChat' && !note.note) {
    note.note = note.refinedNote || body;
  }

  data.notes.push(note);
  writeNotes(lecturePath, data);
  return { success: true, note: hydrateNoteForDisplay(note) };
}

function reorderNotes(lecturePath, orderedIds = [], options = {}) {
  const data = readNotes(lecturePath);
  const ids = Array.isArray(orderedIds) ? orderedIds : [];
  if (!ids.length) return { success: true, updated: 0 };
  const byId = new Map(data.notes.map((n) => [n.id, n]));
  const scopedNotes = String(options.topicId || '').trim()
    ? data.notes.filter((n) => n.topicId === String(options.topicId || '').trim())
    : data.notes;
  const scopedIds = new Set(scopedNotes.map((n) => n.id));
  const validIds = ids.filter((id) => byId.has(id) && scopedIds.has(id));
  if (!validIds.length) return { success: true, updated: 0 };

  let cursor = 10;
  for (const id of validIds) {
    const note = byId.get(id);
    note.sortIndex = cursor;
    cursor += 10;
    note.updatedAt = new Date().toISOString();
  }

  const untouched = scopedNotes.filter((n) => !validIds.includes(n.id)).sort(compareNotes);
  for (const note of untouched) {
    note.sortIndex = cursor;
    cursor += 10;
  }

  writeNotes(lecturePath, data);
  return { success: true, updated: validIds.length };
}

function mergeNotes(lecturePath, { sourceNoteId, targetNoteId } = {}) {
  const data = readNotes(lecturePath);
  if (!sourceNoteId || !targetNoteId || sourceNoteId === targetNoteId) {
    return { success: false, error: 'Invalid merge ids' };
  }
  const sourceIdx = data.notes.findIndex((n) => n.id === sourceNoteId);
  const targetIdx = data.notes.findIndex((n) => n.id === targetNoteId);
  if (sourceIdx < 0 || targetIdx < 0) return { success: false, error: 'Note not found' };

  const source = data.notes[sourceIdx];
  const target = data.notes[targetIdx];
  const mergedAt = new Date().toISOString();
  const sourceBody = normalizeNoteMarkdown(source.refinedNote || source.note || '');
  const marker = `### Merged from: ${source.title || 'note'}`;
  const mergedContent = sourceBody ? `${marker}\n\n${sourceBody}` : marker;

  const merged = appendStudyBlock(lecturePath, target.id, {
    sectionLabel: 'Merged note',
    content: mergedContent,
    retitleContext: {
      highlightedText: `${target.highlightedText || ''}\n${source.highlightedText || ''}`
    }
  });
  if (!merged.success) return merged;

  const fresh = readNotes(lecturePath);
  const tIdx = fresh.notes.findIndex((n) => n.id === target.id);
  const sIdx = fresh.notes.findIndex((n) => n.id === source.id);
  if (tIdx < 0 || sIdx < 0) return { success: false, error: 'Merge refresh failed' };
  const tNote = fresh.notes[tIdx];
  const sNote = fresh.notes[sIdx];

  if (isWeakTitle(tNote.title, tNote.topicTitle) && !isWeakTitle(sNote.title, tNote.topicTitle)) {
    tNote.title = sNote.title;
  }
  tNote.keyIdeas = [...new Set([...(tNote.keyIdeas || []), ...(sNote.keyIdeas || [])])].slice(0, 8);
  tNote.highlightedText = [tNote.highlightedText, sNote.highlightedText].filter(Boolean).join('\n\n').slice(0, 4000);
  tNote.updatedAt = mergedAt;

  fresh.notes[tIdx] = tNote;
  fresh.notes.splice(sIdx, 1);
  writeNotes(lecturePath, fresh);
  return { success: true, note: hydrateNoteForDisplay(tNote), removedNoteId: sourceNoteId };
}

function toggleNotePinned(lecturePath, noteId) {
  const data = readNotes(lecturePath);
  const idx = data.notes.findIndex((n) => n.id === noteId);
  if (idx < 0) return { success: false, error: 'Note not found' };
  const note = data.notes[idx];
  const next = !Boolean(note.pinned);
  note.pinned = next;
  if (next) note.pinnedAt = new Date().toISOString();
  else delete note.pinnedAt;
  note.updatedAt = new Date().toISOString();
  data.notes[idx] = note;
  writeNotes(lecturePath, data);
  return { success: true, note: hydrateNoteForDisplay(note) };
}

function listPinnedNotes(lecturePath) {
  return listNotes(lecturePath)
    .filter((n) => n.pinned)
    .map((n) => ({
      type: 'note',
      id: n.id,
      title: n.title || n.topicTitle || 'Note',
      lecturePath,
      topicId: n.topicId || null,
      materialMode: n.materialMode || 'lecture',
      breadcrumb: n.topicTitle || '',
      pinnedAt: n.pinnedAt || null
    }))
    .sort((a, b) => new Date(b.pinnedAt || 0) - new Date(a.pinnedAt || 0));
}

function appendStudyBlock(lecturePath, noteId, { sectionLabel, content, retitleContext }) {
  const data = readNotes(lecturePath);
  const idx = data.notes.findIndex((n) => n.id === noteId);
  if (idx < 0) {
    return { success: false, error: 'Note not found' };
  }

  const normalized = normalizeNoteMarkdown(content);
  if (!normalized) {
    return { success: false, error: 'Nothing to add' };
  }

  const note = data.notes[idx];
  const addedAt = new Date().toISOString();
  const label = String(sectionLabel || 'AI-added explanation').trim().slice(0, 80);

  if (note.refinedNoteCore == null || note.refinedNoteCore === '') {
    note.refinedNoteCore = ensureRefinedNoteCore(note);
  }

  if (!Array.isArray(note.studyAdditions)) note.studyAdditions = [];
  note.studyAdditions.push({
    id: `add-${Date.now()}`,
    label,
    content: normalized,
    addedAt,
    source: 'noteStudy'
  });

  note.refinedNote = rebuildRefinedNote(note);
  if (isWeakTitle(note.title, note.topicTitle)) {
    const maybeBetter = buildNoteTitle({
      title: note.title,
      topicTitle: note.topicTitle,
      subtopicTitle: note.subtopicTitle,
      sectionAnchor: note.sectionAnchor,
      sectionHeading: note.sectionHeading,
      keyIdeas: note.keyIdeas,
      highlightedText: retitleContext?.highlightedText || note.highlightedText,
      aiAnswerText: note.source === 'tutorChat' ? note.note : '',
      refinedNote: note.refinedNote,
      note: note.note,
      source: note.source,
      locale: note.outputLocale
    });
    if (maybeBetter && maybeBetter !== note.title) {
      note.title = maybeBetter;
    }
  }
  note.updatedAt = addedAt;

  data.notes[idx] = note;
  writeNotes(lecturePath, data);
  return { success: true, note: hydrateNoteForDisplay(note) };
}

function deleteStudyAddition(lecturePath, noteId, additionId) {
  const data = readNotes(lecturePath);
  const idx = data.notes.findIndex((n) => n.id === noteId);
  if (idx < 0) {
    return { success: false, error: 'Note not found' };
  }

  const note = data.notes[idx];
  if (!Array.isArray(note.studyAdditions)) {
    return { success: false, error: 'No removable sections' };
  }

  const before = note.studyAdditions.length;
  note.studyAdditions = note.studyAdditions.filter((a) => a.id !== additionId);
  if (note.studyAdditions.length === before) {
    return { success: false, error: 'Section not found' };
  }

  note.refinedNote = rebuildRefinedNote(note);
  note.updatedAt = new Date().toISOString();

  data.notes[idx] = note;
  writeNotes(lecturePath, data);
  return { success: true, note: hydrateNoteForDisplay(note) };
}

function rebuildNoteMetadata(lecturePath, options = {}) {
  const data = readNotes(lecturePath);
  const topicIdFilter = String(options.topicId || '').trim();
  const forceRetitle = Boolean(options.forceRetitle);
  let updated = 0;
  const changed = [];
  data.notes = data.notes.map((raw) => {
    let note = { ...raw };
    if (topicIdFilter && note.topicId !== topicIdFilter) return note;
    if (Array.isArray(note.studyAdditions) && note.studyAdditions.length > 0) {
      note.refinedNote = rebuildRefinedNote(note);
    }
    const beforeTitle = note.title;
    const beforePreview = note.preview;
    note = enrichNoteListFields(note, { repairMetadata: true, forceRetitle });
    if (note.title !== beforeTitle || note.preview !== beforePreview) updated += 1;
    if (note.title !== beforeTitle) {
      changed.push({
        id: note.id,
        before: beforeTitle || '',
        after: note.title || ''
      });
    }
    note.updatedAt = new Date().toISOString();
    return note;
  });
  writeNotes(lecturePath, data);
  if (changed.length) {
    console.info('[notes] retitled notes', changed.slice(0, 25));
  }
  return { success: true, updated, total: topicIdFilter ? data.notes.filter((n) => n.topicId === topicIdFilter).length : data.notes.length };
}

function deleteNote(lecturePath, noteId) {
  const data = readNotes(lecturePath);
  const before = data.notes.length;
  data.notes = data.notes.filter((n) => n.id !== noteId);
  if (data.notes.length === before) {
    return { success: false, error: 'Note not found' };
  }
  writeNotes(lecturePath, data);
  return { success: true };
}

module.exports = {
  NOTES_FILE,
  listNotes,
  addNote,
  reorderNotes,
  mergeNotes,
  toggleNotePinned,
  listPinnedNotes,
  appendStudyBlock,
  deleteStudyAddition,
  deleteNote,
  rebuildNoteMetadata,
  compareNotes
};
