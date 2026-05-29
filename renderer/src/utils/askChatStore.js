/** In-memory ask-tutor sessions (survive navigation until cleared or app reload). */

const sessions = new Map();

export function askChatKey(lecturePath, topicId, materialMode = 'lecture') {
  const scope = topicId || '__lecture__';
  return `${lecturePath}|${scope}|${materialMode}`;
}

export function getAskChat(key) {
  if (!key) return null;
  const s = sessions.get(key);
  if (!s) return null;
  return { ...s };
}

export function setAskChat(key, session) {
  if (!key) return;
  sessions.set(key, {
    lastQuestion: session.lastQuestion || '',
    answer: session.answer || '',
    relevantNotes: Array.isArray(session.relevantNotes) ? session.relevantNotes : []
  });
}

export function clearAskChat(key) {
  if (key) sessions.delete(key);
}

export function hasAskChat(key) {
  const s = sessions.get(key);
  return Boolean(s?.answer || s?.lastQuestion);
}
