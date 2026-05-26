const fs = require('fs');
const path = require('path');
const vault = require('./vault');
const lectureStructureLlm = require('./lectureStructureLlm');

function safeRead(filePath, max = 0) {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    return max > 0 ? text.slice(0, max) : text;
  } catch {
    return '';
  }
}

function gatherNoteContext({ lecturePath, courseStorageKey, courseName, note, vaultPath }) {
  const lecture = vault.readCourseItem(lecturePath);
  if (!lecture) return null;

  const topic = (lecture.topics || []).find((t) => t.id === note.topicId) || null;
  let extracted = safeRead(path.join(lecturePath, 'extracted.txt'), 28000);
  if (!extracted && lecture.source?.lecturePath) {
    extracted = safeRead(path.join(lecture.source.lecturePath, 'extracted.txt'), 28000);
  }
  const concepts = safeRead(path.join(lecturePath, 'concepts.md'), 8000);
  const courseDir = path.dirname(lecturePath);
  const courseContext = lectureStructureLlm.gatherCourseContext(courseDir, path.basename(lecturePath));

  let siblingLectures = '';
  const key = courseStorageKey || vault.sanitizeName(courseName);
  if (vaultPath && key) {
    const siblings = vault.loadCourseLectures(vaultPath, key).filter(
      (l) => l.id !== lecture.id
    );
    if (siblings.length) {
      siblingLectures = siblings
        .map((l) => `- ${l.title} (${l.topicCount || 0} topics)`)
        .join('\n');
    }
  }

  return { lecture, topic, extracted, concepts, courseContext, siblingLectures };
}

function buildNoteChatSystem(language) {
  return `You are a focused study tutor inside Course Dashboard. The student is in **note study mode** — their saved note is the anchor. Answer in ${language}.

CONTEXT PRIORITY (strict):
1. The opened note (highlight + their words + key ideas) — answer as if helping them understand *this* note
2. The current topic card and subtopics for that topic
3. This lecture's source materials (extracted text, concepts)
4. Other topics in the same lecture (for connections only)
5. Sibling lectures in the course (prerequisites / what comes next)

RULES:
- Ground answers in the note first; use lecture materials to support, not replace, the note
- For formulas, notation, procedures: explain symbols, steps, and meaning clearly; use $...$ for math when helpful
- Be tutor-like: examples, intuition, "what you might be missing", memory hooks — not generic filler
- If the note seems wrong or incomplete, say so gently and correct using lecture context
- Under 320 words unless a derivation or multi-step procedure truly needs more
- Do not mention JSON, prompts, or "context blocks"`;
}

function buildNoteContextBlock({ note, lecture, topic, extracted, concepts, courseContext, siblingLectures, courseName }) {
  const noteBody = note.refinedNote || note.note || '';
  const parts = [
    '=== PRIMARY: OPENED NOTE ===',
    `Topic: ${note.topicTitle || topic?.title || '—'}`,
    `Source: ${note.source === 'deep' ? 'deeper explanation' : 'topic card'}`,
    `Highlighted passage:\n${note.highlightedText || ''}`,
    note.keyIdeas?.length ? `Key ideas: ${note.keyIdeas.join(' · ')}` : '',
    noteBody ? `Student note:\n${noteBody}` : '',
    note.note && note.refinedNote && note.note !== note.refinedNote
      ? `Original draft:\n${note.note}`
      : '',
    '',
    '=== TOPIC CARD (current topic) ===',
    topic?.card?.markdown ? topic.card.markdown.slice(0, 5500) : '(no card)',
    topic?.card?.deepMarkdown
      ? `\n--- Deeper explanation (excerpt) ---\n${topic.card.deepMarkdown.slice(0, 3500)}`
      : '',
    topic?.subtopics?.length
      ? `Subtopics: ${topic.subtopics.map((s) => s.title).join('; ')}`
      : '',
    topic?.connections
      ? `Connections: builds on ${(topic.connections.buildsOn || []).join('; ') || '—'}; related ${(topic.connections.relatedInCourse || []).join('; ') || '—'}`
      : '',
    '',
    '=== LECTURE ===',
    `Course: ${courseName || courseContext?.courseLabel || ''}`,
    `Lecture: ${lecture.title}`,
    `Summary: ${(lecture.lectureSummary || lecture.summary || '').slice(0, 1200)}`,
    lecture.courseThread?.summary ? `Course thread: ${lecture.courseThread.summary}` : '',
    lecture.courseThread?.continuesFrom ? `Builds on: ${lecture.courseThread.continuesFrom}` : '',
    lecture.courseThread?.leadsTo ? `Prepares: ${lecture.courseThread.leadsTo}` : '',
    '',
    '=== OTHER TOPICS IN THIS LECTURE ===',
    (lecture.topics || [])
      .map((t, i) => `${i + 1}. ${t.title}${t.id === topic?.id ? ' [current]' : ''}`)
      .join('\n'),
    '',
    '=== LECTURE SOURCE (supporting) ===',
    concepts ? `Concepts file:\n${concepts.slice(0, 4000)}` : '',
    `Extracted text (excerpt):\n${extracted.slice(0, 12000)}`,
    siblingLectures ? `\n=== OTHER LECTURES IN COURSE ===\n${siblingLectures}` : ''
  ];
  return parts.filter(Boolean).join('\n');
}

module.exports = {
  gatherNoteContext,
  buildNoteChatSystem,
  buildNoteContextBlock
};
