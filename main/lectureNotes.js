const fs = require('fs');
const path = require('path');

const NOTES_FILE = 'lecture_notes.json';

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

function listNotes(lecturePath) {
  const data = readNotes(lecturePath);
  return data.notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function addNote(lecturePath, entry) {
  const data = readNotes(lecturePath);
  const note = {
    id: `note-${Date.now()}`,
    topicId: entry.topicId || '',
    topicTitle: String(entry.topicTitle || '').trim(),
    source: entry.source === 'deep' ? 'deep' : 'card',
    highlightedText: String(entry.highlightedText || '').trim().slice(0, 4000),
    note: String(entry.note || '').trim().slice(0, 8000),
    keyIdeas: Array.isArray(entry.keyIdeas)
      ? entry.keyIdeas.map((k) => String(k).trim()).filter(Boolean).slice(0, 8)
      : [],
    refinedNote: String(entry.refinedNote || '').trim().slice(0, 12000),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (!note.highlightedText) {
    return { success: false, error: 'Highlighted text is empty' };
  }
  data.notes.push(note);
  writeNotes(lecturePath, data);
  return { success: true, note };
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
  deleteNote
};
