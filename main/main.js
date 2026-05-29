const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const vault = require('./vault');
const pipeline = require('./pipeline');
const coursesApi = require('./courses');
const lectureNotes = require('./lectureNotes');
const noteStudyAppend = require('./noteStudyAppend');
const noteAutoSave = require('./noteAutoSave');
const noteChat = require('./noteChat');
const chatClarify = require('./chatClarify');
const noteRelevance = require('../shared/noteRelevance.cjs');
const studyUnits = require('./studyUnits');
const courseProfile = require('./courseProfile');
const dashboard = require('./dashboard');
const { detectLanguage } = require('./pdf');
const noteLanguage = require('./noteLanguage');
const expandContent = require('./expandContent');

const store = new Store({
  schema: {
    apiKey: { type: 'string', default: '' },
    generationModel: { type: 'string', default: 'gpt-4o' },
    vaultPath: {
      type: 'string',
      default: path.join(app.getPath('documents'), 'CourseDashboard')
    },
    courses: {
      type: 'array',
      default: [],
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          color: { type: 'string' },
          emoji: { type: 'string' }
        }
      }
    },
    courseOrder: {
      type: 'array',
      default: [],
      items: { type: 'string' }
    }
  }
});

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: 'Course Dashboard',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5174');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/dist/index.html'));
  }
}

app.whenReady().then(() => {
  const vp = store.get('vaultPath');
  if (vp && !fs.existsSync(vp)) fs.mkdirSync(vp, { recursive: true });
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

function getModel() {
  return store.get('generationModel') || 'gpt-4o';
}

function getTemperature() {
  return 0.15;
}

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

const exerciseSheets = require('../shared/exerciseSheets.cjs');

function getExtractedForItem(itemPath, item, materialMode = 'lecture', exerciseId = '') {
  if (materialMode === 'exercise') {
    const sheet = exerciseSheets.getExerciseSheet(item, exerciseId);
    if (sheet?.extractedFile) {
      const named = safeRead(path.join(itemPath, sheet.extractedFile));
      if (named) return named;
    }
    const ex = safeRead(path.join(itemPath, 'exercise_extracted.txt'));
    if (ex) return ex;
  }
  let extracted = safeRead(path.join(itemPath, 'extracted.txt'));
  if (!extracted && item?.source?.lecturePath) {
    extracted = safeRead(path.join(item.source.lecturePath, 'extracted.txt'));
  }
  return extracted;
}

/** Notes pipeline: prefer highlight/topic language over PDF extraction alone. */
function resolveNotesPipelineLanguage(lecturePath, lecture, materialMode, data = {}) {
  const extracted = getExtractedForItem(
    lecturePath,
    lecture,
    materialMode || 'lecture',
    data.exerciseId || ''
  );
  return noteLanguage.resolveNoteLanguage({
    lectureTitle: lecture?.title,
    lectureSummary: lecture?.lectureSummary || lecture?.summary,
    topicTitle: data.topicTitle,
    highlightedText: data.highlightedText,
    draftNote: data.draftNote,
    note: data.note,
    extractedText: extracted
  });
}

function getTopicsForMode(item, materialMode = 'lecture', exerciseId = '') {
  if (materialMode === 'exercise') {
    return exerciseSheets.getExerciseTopics(item, exerciseId);
  }
  return item?.topics || [];
}

function findTopicForMode(item, topicId, materialMode = 'lecture', exerciseId = '') {
  if (materialMode === 'exercise') {
    return exerciseSheets.findExerciseTopicInLecture(item, topicId, exerciseId).topic;
  }
  return (item?.topics || []).find((t) => t.id === topicId);
}

function findSubtopicInTopic(topic, subtopicId) {
  return (topic?.subtopics || []).find((s) => s.id === subtopicId);
}

function resolveStorageKey(ref) {
  const course = coursesApi.resolveCourse(store, ref);
  return course?.storageKey || (typeof ref === 'string' ? vault.sanitizeName(ref) : '');
}

function aiCourseContext({ courseId, courseStorageKey, courseName }) {
  const course = courseId
    ? coursesApi.getCourseById(store, courseId)
    : coursesApi.resolveCourse(store, courseStorageKey || courseName);
  const storageKey = course?.storageKey || courseStorageKey || resolveStorageKey(courseName);
  const displayName = course?.name || courseName || '';
  const vaultPath = store.get('vaultPath');
  const profile = courseProfile.loadProfile(vaultPath, storageKey);
  const block = courseProfile.buildPromptBlock(profile, displayName);
  return { course, storageKey, displayName, profile, block };
}

ipcMain.handle('store:getAll', () => store.store);
ipcMain.handle('store:set', (_, key, value) => {
  store.set(key, value);
  if (key === 'vaultPath' && value && !fs.existsSync(value)) {
    fs.mkdirSync(value, { recursive: true });
  }
  return true;
});

ipcMain.handle('dialog:openPdf', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
    title: 'Select lecture PDF'
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('dialog:openExercisePdf', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
    title: 'Select exercise / Übung PDF'
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('courses:list', () => coursesApi.listOrderedCourses(store));

ipcMain.handle('courses:create', (_, data) => coursesApi.createCourse(store, data));

ipcMain.handle('courses:reorder', (_, { courseIds }) => {
  try {
    if (!Array.isArray(courseIds) || !courseIds.length) {
      return { success: false, error: 'Invalid course order' };
    }
    const courses = coursesApi.reorderCourses(store, courseIds);
    return { success: true, courses };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('courses:delete', (_, { courseId, deleteFromDisk }) => {
  return coursesApi.deleteCourse(store, courseId, { deleteFromDisk: Boolean(deleteFromDisk) });
});

ipcMain.handle('dashboard:getOverview', () => dashboard.buildDashboardOverview(store));

ipcMain.handle('courses:getSettings', (_, courseId) => coursesApi.getCourseSettings(store, courseId));

ipcMain.handle('courses:saveSettings', (_, data) => coursesApi.saveCourseSettings(store, data));

ipcMain.handle('courses:getFolderPath', (_, courseStorageKey) => {
  const vaultPath = store.get('vaultPath');
  const key = resolveStorageKey(courseStorageKey);
  if (!vaultPath || !key) return '';
  return vault.courseDir(vaultPath, key);
});

ipcMain.handle('course:getLectures', (_, courseStorageKey) => {
  const vaultPath = store.get('vaultPath');
  const key = resolveStorageKey(courseStorageKey);
  if (!vaultPath || !key) {
    return { lectures: [], stats: { total: 0, opened: 0, topicsTotal: 0, topicsStudied: 0 } };
  }
  const lectures = vault.loadCourseLectures(vaultPath, key);
  return { lectures, stats: vault.courseStats(lectures) };
});

ipcMain.handle('course:reorderLectures', (_, { courseStorageKey, lectureIds }) => {
  try {
    const vaultPath = store.get('vaultPath');
    const key = resolveStorageKey(courseStorageKey);
    if (!vaultPath || !key) return { success: false, error: 'Missing vault or course' };
    const lectures = vault.reorderLectures(vaultPath, key, lectureIds);
    return { success: true, lectures, stats: vault.courseStats(lectures) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('course:deleteLecture', (_, { courseStorageKey, lectureId, deleteFromDisk }) => {
  try {
    const vaultPath = store.get('vaultPath');
    const key = resolveStorageKey(courseStorageKey);
    if (!vaultPath) return { success: false, error: 'No vault path' };
    return vault.deleteLecture(vaultPath, key, lectureId, {
      deleteFromDisk: Boolean(deleteFromDisk)
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('lecture:getFolderPath', (_, { courseStorageKey, lectureId }) => {
  const vaultPath = store.get('vaultPath');
  const key = resolveStorageKey(courseStorageKey);
  if (!vaultPath || !key || !lectureId) return '';
  return path.join(vault.courseDir(vaultPath, key), lectureId);
});

ipcMain.handle('lecture:get', (_, lecturePath) => {
  const item = vault.readCourseItem(lecturePath);
  if (!item) return null;
  return { ...item, path: lecturePath };
});

ipcMain.handle('course:promoteTopic', async (event, data) => {
  try {
    const ctx = aiCourseContext({
      courseId: data.courseId,
      courseStorageKey: data.courseStorageKey,
      courseName: data.courseName
    });
    const result = await studyUnits.promoteTopic({
      vaultPath: store.get('vaultPath'),
      courseStorageKey: ctx.storageKey,
      courseName: ctx.displayName,
      courseProfileBlock: ctx.block,
      lecturePath: data.lecturePath,
      topicId: data.topicId,
      apiKey: store.get('apiKey'),
      model: getModel(),
      temperature: getTemperature(),
      onStatus: (status) => {
        try {
          if (!event.sender.isDestroyed()) event.sender.send('process:status', status);
        } catch (_) {}
      }
    });
    return result;
  } catch (err) {
    return { success: false, error: err.message, code: err.code };
  }
});

ipcMain.handle('lecture:markOpened', (_, lecturePath) => {
  return vault.markLectureOpened(lecturePath);
});

ipcMain.handle('lecture:markTopicStudied', (_, { lecturePath, topicId, materialMode, exerciseId }) => {
  const updated = vault.toggleTopicStudied(
    lecturePath,
    topicId,
    materialMode || 'lecture',
    exerciseId || ''
  );
  if (!updated) return null;
  return { ...vault.enrichItem(updated, lecturePath), path: lecturePath };
});

ipcMain.handle('lecture:toggleSubtopicStudied', (_, { lecturePath, topicId, subtopicId, materialMode, exerciseId }) => {
  if (!lecturePath || !topicId || !subtopicId) return null;
  const updated = vault.toggleSubtopicStudied(
    lecturePath,
    topicId,
    subtopicId,
    materialMode || 'lecture',
    exerciseId || ''
  );
  if (!updated) return null;
  const fresh = vault.readCourseItem(lecturePath);
  const item = fresh || updated;
  return { ...vault.enrichItem(item, lecturePath), path: lecturePath };
});

ipcMain.handle('lecture:cycleSubtopicConfidence', async (_, { lecturePath, topicId, subtopicId }) => {
  if (!lecturePath || !topicId || !subtopicId) return null;
  const updated = vault.cycleSubtopicConfidence(lecturePath, topicId, subtopicId);
  if (!updated) return null;
  const fresh = vault.readCourseItem(lecturePath);
  const item = fresh || updated;
  return { ...vault.enrichItem(item, lecturePath), path: lecturePath };
});

ipcMain.handle('lecture:listNotes', (_, { lecturePath }) => {
  try {
    return { success: true, notes: lectureNotes.listNotes(lecturePath) };
  } catch (err) {
    return { success: false, error: err.message, notes: [] };
  }
});

ipcMain.handle('lecture:saveHighlightNote', (_, data) => {
  try {
    return lectureNotes.addNote(data.lecturePath, data);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('lecture:autoSaveHighlightNote', async (_, data) => {
  const apiKey = store.get('apiKey');
  if (!apiKey) return { success: false, error: 'Missing API key' };
  const {
    lecturePath,
    highlightedText,
    topicId,
    topicTitle,
    subtopicId,
    subtopicTitle,
    sectionAnchor,
    sourceKind,
    markdownSource,
    noteId,
    source,
    materialMode,
    courseName,
    courseId,
    courseStorageKey
  } = data || {};
  if (!lecturePath || !highlightedText) {
    return { success: false, error: 'Missing highlight' };
  }

  const lecture = vault.readCourseItem(lecturePath);
  const { language } = resolveNotesPipelineLanguage(lecturePath, lecture, materialMode || 'lecture', {
    topicTitle,
    highlightedText,
    exerciseId: data.exerciseId || ''
  });
  const ctx = aiCourseContext({ courseId, courseStorageKey, courseName });
  const { OpenAI } = require('openai');
  const openai = new OpenAI({ apiKey });

  try {
    return await noteAutoSave.autoSaveHighlight({
      lecturePath,
      highlightedText,
      topicId,
      topicTitle,
      subtopicId,
      subtopicTitle,
      sectionAnchor,
      sourceKind,
      markdownSource,
      noteId,
      source: source || 'card',
      materialMode: materialMode || 'lecture',
      lecture,
      language,
      courseBlock: ctx.block,
      mathHint: courseProfile.MATH_OUTPUT_HINT,
      openai,
      model: getModel()
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('lecture:appendToNoteFromStudy', async (_, data) => {
  const apiKey = store.get('apiKey');
  if (!apiKey) return { success: false, error: 'Missing API key' };

  const { lecturePath, noteId, excerpt, isSelection, note, courseName, courseId, courseStorageKey } =
    data || {};
  if (!lecturePath || !noteId || !excerpt?.trim()) {
    return { success: false, error: 'Missing note or content' };
  }

  const lecture = vault.readCourseItem(lecturePath);
  const { language, locale } = resolveNotesPipelineLanguage(lecturePath, lecture, 'lecture', {
    note: note || {}
  });
  const ctx = aiCourseContext({ courseId, courseStorageKey, courseName });

  let sectionLabel = noteStudyAppend.defaultSectionLabel(locale);
  let content = noteStudyAppend.fallbackContent(excerpt);

  try {
    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey });
    const integrated = await noteStudyAppend.integrateExcerpt({
      openai,
      model: getModel(),
      language,
      courseBlock: ctx.block,
      note: note || {},
      excerpt,
      isSelection: Boolean(isSelection)
    });
    if (integrated) {
      sectionLabel = integrated.sectionLabel;
      content = integrated.content;
    }
  } catch (_) {
    /* use fallback content */
  }

  try {
    return lectureNotes.appendStudyBlock(lecturePath, noteId, { sectionLabel, content });
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('lecture:deleteNoteStudyBlock', (_, { lecturePath, noteId, additionId }) => {
  try {
    return lectureNotes.deleteStudyAddition(lecturePath, noteId, additionId);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('lecture:deleteNote', (_, { lecturePath, noteId }) => {
  try {
    return lectureNotes.deleteNote(lecturePath, noteId);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('pins:toggleLecture', (_, { lecturePath }) => {
  try {
    if (!lecturePath) return { success: false, error: 'Missing lecture path' };
    const updated = vault.toggleItemPinned(lecturePath);
    if (!updated) return { success: false, error: 'Lecture not found' };
    return { success: true, lecture: { ...vault.enrichItem(updated, lecturePath), path: lecturePath } };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('pins:toggleTopic', (_, { lecturePath, topicId, materialMode, exerciseId }) => {
  try {
    if (!lecturePath || !topicId) return { success: false, error: 'Missing topic context' };
    const updated = vault.toggleTopicPinned(
      lecturePath,
      topicId,
      materialMode || 'lecture',
      exerciseId || ''
    );
    if (!updated) return { success: false, error: 'Topic not found' };
    return { success: true, lecture: { ...vault.enrichItem(updated, lecturePath), path: lecturePath } };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('pins:toggleSubtopic', (_, { lecturePath, topicId, subtopicId, materialMode, exerciseId }) => {
  try {
    if (!lecturePath || !topicId || !subtopicId) return { success: false, error: 'Missing subtopic context' };
    const updated = vault.toggleSubtopicPinned(
      lecturePath,
      topicId,
      subtopicId,
      materialMode || 'lecture',
      exerciseId || ''
    );
    if (!updated) return { success: false, error: 'Subtopic not found' };
    return { success: true, lecture: { ...vault.enrichItem(updated, lecturePath), path: lecturePath } };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('pins:toggleNote', (_, { lecturePath, noteId }) => {
  try {
    if (!lecturePath || !noteId) return { success: false, error: 'Missing note context' };
    return lectureNotes.toggleNotePinned(lecturePath, noteId);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('pins:listForLecture', (_, { lecturePath }) => {
  try {
    if (!lecturePath) return { success: false, error: 'Missing lecture path', items: [] };
    const items = [...vault.listPinnedInItem(lecturePath), ...lectureNotes.listPinnedNotes(lecturePath)].sort(
      (a, b) => new Date(b.pinnedAt || 0) - new Date(a.pinnedAt || 0)
    );
    return { success: true, items };
  } catch (err) {
    return { success: false, error: err.message, items: [] };
  }
});

ipcMain.handle('pins:listAll', () => {
  try {
    const items = require('./pinsAggregate').collectAllPinned(store);
    return { success: true, items };
  } catch (err) {
    return { success: false, error: err.message, items: [] };
  }
});

ipcMain.handle('notes:reorder', (_, { lecturePath, orderedIds, topicId }) => {
  try {
    if (!lecturePath) return { success: false, error: 'Missing lecture path' };
    return lectureNotes.reorderNotes(lecturePath, orderedIds, { topicId });
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('notes:merge', (_, { lecturePath, sourceNoteId, targetNoteId }) => {
  try {
    if (!lecturePath) return { success: false, error: 'Missing lecture path' };
    return lectureNotes.mergeNotes(lecturePath, { sourceNoteId, targetNoteId });
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('lecture:rebuildNoteMetadata', (_, { lecturePath, topicId, forceRetitle }) => {
  try {
    if (!lecturePath) return { success: false, error: 'Missing lecture path' };
    return lectureNotes.rebuildNoteMetadata(lecturePath, { topicId, forceRetitle });
  } catch (err) {
    return { success: false, error: err.message };
  }
});

function parseRefineJson(raw) {
  const text = (raw || '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

ipcMain.handle('lecture:refineNote', async (_, data) => {
  const apiKey = store.get('apiKey');
  if (!apiKey) return { success: false, error: 'Missing API key' };
  const { lecturePath, topicTitle, highlightedText, draftNote, courseName, courseId, courseStorageKey } =
    data || {};
  const lecture = vault.readCourseItem(lecturePath);
  const { language } = resolveNotesPipelineLanguage(lecturePath, lecture, 'lecture', {
    topicTitle,
    highlightedText,
    draftNote
  });
  const ctx = aiCourseContext({ courseId, courseStorageKey, courseName });

  const { OpenAI } = require('openai');
  const openai = new OpenAI({ apiKey });
  const system = `You help a university student sharpen their study notes for quick exam revision. Respond in ${language} as strict JSON only:
{"title":"short note title (3-8 words)","keyIdeas":["short phrase",...],"refinedNote":"markdown study note"}
Rules:
- title: specific DISTINCT label for scanning a list — capture the actual insight (formula, contrast, step, misconception). NEVER repeat the topic name alone
- keyIdeas: 2-4 crisp phrases (not generic labels)
- refinedNote: CONCISE revision note — tighten and clarify THEIR meaning; short bullets or 2-3 tiny sections max
- Target length: 40-120 words (hard max 140). Do NOT expand into a long essay
- No filler, no repetition, no generic tutoring voice; faithful to highlight + draft
- Formulas/notation only when essential; use $...$ for inline math
- Do not invent facts beyond highlight/context
${noteLanguage.languagePreservationPrompt(language)}
${courseProfile.MATH_OUTPUT_HINT}

${ctx.block}`;
  const user = [
    `Course: ${ctx.displayName || ''}`,
    `Lecture: ${lecture?.title || ''}`,
    `Topic: ${topicTitle || ''}`,
    `Highlighted passage:\n${highlightedText || ''}`,
    `Student draft note:\n${draftNote || '(none yet)'}`,
    lecture?.lectureSummary ? `Lecture context:\n${lecture.lectureSummary.slice(0, 1500)}` : ''
  ].join('\n\n');

  try {
    const response = await openai.chat.completions.create({
      model: getModel(),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.22,
      response_format: { type: 'json_object' },
      max_tokens: 500
    });
    const parsed = parseRefineJson(response.choices?.[0]?.message?.content || '');
    if (!parsed?.refinedNote) {
      return { success: false, error: 'Could not refine note' };
    }
    let refinedNote = String(parsed.refinedNote).trim();
    const words = refinedNote.split(/\s+/).length;
    if (words > 160) {
      refinedNote = refinedNote.split(/\s+/).slice(0, 160).join(' ') + '…';
    }
    return {
      success: true,
      title: String(parsed.title || topicTitle || '').trim().slice(0, 120),
      keyIdeas: Array.isArray(parsed.keyIdeas) ? parsed.keyIdeas.slice(0, 4) : [],
      refinedNote
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('lecture:processPdf', async (event, { pdfPath, courseName, courseId, courseStorageKey }) => {
  try {
    const ctx = aiCourseContext({ courseId, courseStorageKey, courseName });
    const result = await pipeline.processLecturePdf({
      pdfPath,
      courseStorageKey: ctx.storageKey,
      courseName: ctx.displayName,
      courseProfileBlock: ctx.block,
      vaultPath: store.get('vaultPath'),
      apiKey: store.get('apiKey'),
      model: getModel(),
      temperature: getTemperature(),
      onStatus: (status) => {
        try {
          if (!event.sender.isDestroyed()) event.sender.send('process:status', status);
        } catch (_) {}
      }
    });
    return result;
  } catch (err) {
    return { success: false, error: err.message, code: err.code };
  }
});

ipcMain.handle('lecture:attachExercisePdf', async (event, { lecturePath, pdfPath, courseName, courseId, courseStorageKey }) => {
  try {
    const ctx = aiCourseContext({ courseId, courseStorageKey, courseName });
    const result = await pipeline.processExercisePdf({
      lecturePath,
      pdfPath,
      courseStorageKey: ctx.storageKey,
      courseName: ctx.displayName,
      courseProfileBlock: ctx.block,
      vaultPath: store.get('vaultPath'),
      apiKey: store.get('apiKey'),
      model: getModel(),
      temperature: getTemperature(),
      onStatus: (status) => {
        try {
          if (!event.sender.isDestroyed()) event.sender.send('process:status', status);
        } catch (_) {}
      }
    });
    return result;
  } catch (err) {
    return { success: false, error: err.message, code: err.code };
  }
});

ipcMain.handle('lecture:askAboutNote', async (_, data) => {
  const apiKey = store.get('apiKey');
  if (!apiKey) return { success: false, error: 'Missing API key' };
  const { lecturePath, courseName, courseId, courseStorageKey, note, question, history } = data || {};
  if (!lecturePath || !note || !question) {
    return { success: false, error: 'Missing note or question' };
  }

  const vaultPath = store.get('vaultPath');
  const aiCtx = aiCourseContext({ courseId, courseStorageKey, courseName });
  const ctx = noteChat.gatherNoteContext({
    lecturePath,
    courseStorageKey: aiCtx.storageKey,
    courseName: aiCtx.displayName,
    note,
    vaultPath
  });
  if (!ctx) return { success: false, error: 'Lecture not found' };

  const item = vault.readCourseItem(lecturePath);
  const { language } = resolveNotesPipelineLanguage(lecturePath, item, 'lecture', { note });
  const answerMode = chatClarify.detectAnswerMode(question);
  const system = `${noteChat.buildNoteChatSystem(language, answerMode)}\n\n${noteLanguage.languagePreservationPrompt(language)}\n\n${aiCtx.block}\n${courseProfile.MATH_OUTPUT_HINT}`;
  const contextBlock = noteChat.buildNoteContextBlock({
    note,
    lecture: ctx.lecture,
    topic: ctx.topic,
    extracted: ctx.extracted,
    concepts: ctx.concepts,
    courseContext: ctx.courseContext,
    siblingLectures: ctx.siblingLectures,
    courseName: aiCtx.displayName
  });

  const prior = Array.isArray(history)
    ? history
        .filter((h) => h?.role && h?.content)
        .slice(-8)
        .map((h) => ({
          role: h.role === 'assistant' ? 'assistant' : 'user',
          content: String(h.content).slice(0, 4000)
        }))
    : [];

  const messages = [{ role: 'system', content: system }];
  if (prior.length === 0) {
    messages.push({
      role: 'user',
      content: `[CONTEXT]\n${contextBlock}\n\n[QUESTION]\n${question}`
    });
  } else {
    messages.push({ role: 'user', content: `[CONTEXT]\n${contextBlock}` });
    messages.push(...prior);
    messages.push({ role: 'user', content: question });
  }

  const allNotes = lectureNotes.listNotes(lecturePath);
  const relevantNotes = noteRelevance.findRelevantNotes(allNotes, question, {
    topicId: note.topicId || '',
    materialMode: note.materialMode || 'lecture',
    excludeNoteId: note.id,
    limit: 2,
    minScore: 0.22
  });
  const relevantBlock = noteRelevance.buildRelevantNotesContextBlock(relevantNotes, language);

  const { OpenAI } = require('openai');
  const openai = new OpenAI({ apiKey });
  try {
    if (relevantBlock) {
      messages.splice(messages.length - 1, 0, {
        role: 'user',
        content: relevantBlock
      });
    }
    const response = await openai.chat.completions.create({
      model: getModel(),
      messages,
      temperature: chatClarify.temperatureForMode(answerMode),
      max_tokens: chatClarify.maxTokensForMode(answerMode)
    });
    const answer = (response.choices?.[0]?.message?.content || '').trim();
    if (!answer) return { success: false, error: 'Empty response' };
    return { success: true, answer, relevantNotes };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('lecture:askAboutSelection', async (_, data) => {
  const apiKey = store.get('apiKey');
  if (!apiKey) return { success: false, error: 'Missing API key' };

  const {
    lecturePath,
    topicId,
    question,
    selectedText,
    courseName,
    courseId,
    courseStorageKey,
    materialMode,
    lectureTitle,
    topicTitle,
    subtopicTitle,
    noteTitle,
    exerciseId: selectionExerciseId
  } = data || {};

  if (!lecturePath || !question || !selectedText) {
    return { success: false, error: 'Missing selection or question' };
  }

  const lecture = vault.readCourseItem(lecturePath);
  if (!lecture) return { success: false, error: 'Lecture not found' };

  const mode = materialMode === 'exercise' ? 'exercise' : 'lecture';
  const exerciseId = selectionExerciseId || '';
  const topic = topicId ? findTopicForMode(lecture, topicId, mode, exerciseId) : null;
  const { language } = resolveNotesPipelineLanguage(lecturePath, lecture, mode, {
    topicTitle: topicTitle || topic?.title || '',
    highlightedText: selectedText,
    exerciseId
  });
  const aiCtx = aiCourseContext({ courseId, courseStorageKey, courseName });
  const selectionAsk = require('./selectionAsk');

  const answerMode = chatClarify.detectAnswerMode(question);
  const system = selectionAsk.buildSelectionAskSystem(language, answerMode, mode, {
    courseProfileBlock: aiCtx.block,
    mathHint: courseProfile.MATH_OUTPUT_HINT
  });

  const user = selectionAsk.buildSelectionAskUserMessage({
    displayName: aiCtx.displayName,
    lectureTitle: lectureTitle || lecture.title,
    materialMode: mode,
    topicTitle: topicTitle || topic?.title || '',
    subtopicTitle: subtopicTitle || '',
    noteTitle: noteTitle || '',
    selectedText,
    question
  });

  const { OpenAI } = require('openai');
  const openai = new OpenAI({ apiKey });

  try {
    const response = await openai.chat.completions.create({
      model: getModel(),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: chatClarify.temperatureForMode(answerMode),
      max_tokens: chatClarify.maxTokensForMode(answerMode)
    });
    const answer = (response.choices?.[0]?.message?.content || '').trim();
    if (!answer) return { success: false, error: 'Empty response' };
    return { success: true, answer };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('lecture:ask', async (_, { lecturePath, topicId, question, courseName, courseId, courseStorageKey, materialMode, exerciseId: askExerciseId }) => {
  const apiKey = store.get('apiKey');
  if (!apiKey) return { success: false, error: 'Missing API key' };
  const lecture = vault.readCourseItem(lecturePath);
  if (!lecture) return { success: false, error: 'Lecture not found' };
  const mode = materialMode === 'exercise' ? 'exercise' : 'lecture';
  const exerciseId = askExerciseId || '';
  const topic = findTopicForMode(lecture, topicId, mode, exerciseId);
  const extracted = getExtractedForItem(lecturePath, lecture, mode, exerciseId);
  const { language } = resolveNotesPipelineLanguage(lecturePath, lecture, mode, {
    topicTitle: topic?.title || '',
    highlightedText: topic?.card?.markdown?.slice(0, 2000) || '',
    exerciseId
  });
  const aiCtx = aiCourseContext({ courseId, courseStorageKey, courseName });

  const { OpenAI } = require('openai');
  const openai = new OpenAI({ apiKey });

  const answerMode = chatClarify.detectAnswerMode(question);

  const exerciseBlock =
    mode === 'exercise'
      ? `Exercise context (reference): ${exerciseSheets.getExerciseSummary(lecture, exerciseId).slice(0, 400)}`
      : '';

  const system = chatClarify.buildAskTutorSystem(language, answerMode, mode, {
    courseProfileBlock: `${exerciseBlock}\n${aiCtx.block}`.trim(),
    mathHint: courseProfile.MATH_OUTPUT_HINT
  });

  const lectureLinkNote =
    mode === 'exercise' && topic?.lectureLink?.note
      ? `Link to lecture topic: ${topic.lectureLink.note}`
      : '';

  const allNotes = lectureNotes
    .listNotes(lecturePath)
    .filter((n) => !materialMode || n.materialMode === materialMode);

  const relevantNotes = noteRelevance.findRelevantNotes(allNotes, question, {
    topicId: topicId || '',
    materialMode: mode,
    limit: 2,
    minScore: 0.24
  });
  const { language: notesLanguage } = resolveNotesPipelineLanguage(lecturePath, lecture, mode, {
    topicTitle: topic?.title,
    highlightedText: question
  });
  const relevantBlock = noteRelevance.buildRelevantNotesContextBlock(relevantNotes, notesLanguage);

  const user = [
    chatClarify.contextUsagePreamble(),
    `Course: ${aiCtx.displayName}`,
    `Lecture: ${lecture.title}`,
    `Mode: ${mode === 'exercise' ? 'Übung / exercise practice' : 'Vorlesung / lecture'}`,
    topic ? `Current topic: ${topic.title}` : 'No specific topic selected',
    lectureLinkNote,
    mode === 'exercise'
      ? `Exercise summary (reference): ${exerciseSheets.getExerciseSummary(lecture, exerciseId).slice(0, 800)}`
      : `Lecture summary (reference, do not recap): ${(lecture.lectureSummary || lecture.summary || '').slice(0, 600)}`,
    topic?.card?.markdown
      ? `Topic card (reference — explain differently):\n${topic.card.markdown.slice(0, 4000)}`
      : '',
    mode === 'lecture' && lecture.courseThread?.summary
      ? `Course thread (reference): ${lecture.courseThread.summary.slice(0, 300)}`
      : '',
    relevantBlock,
    `Student question: ${question}`
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const response = await openai.chat.completions.create({
      model: getModel(),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: chatClarify.temperatureForMode(answerMode),
      max_tokens: chatClarify.maxTokensForMode(answerMode)
    });
    const answer = (response.choices?.[0]?.message?.content || '').trim();
    if (!answer) return { success: false, error: 'Empty response' };
    return { success: true, answer, relevantNotes };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle(
  'lecture:expandTopic',
  async (_, { lecturePath, topicId, courseName, courseId, courseStorageKey, materialMode, exerciseId, force, feedback }) => {
    const apiKey = store.get('apiKey');
    if (!apiKey) return { success: false, error: 'Missing API key' };
    const lecture = vault.readCourseItem(lecturePath);
    const mode = materialMode === 'exercise' ? 'exercise' : 'lecture';
    const topic = findTopicForMode(lecture, topicId, mode, exerciseId || '');
    if (!topic) return { success: false, error: 'Topic not found' };

    const existing = topic.card?.deepMarkdown || '';
    if (existing && !force) {
      return { success: true, markdown: existing, cached: true };
    }

    const extracted = getExtractedForItem(lecturePath, lecture, mode, exerciseId || '');
    const language = expandContent.resolveExpandLanguage(
      lecturePath,
      lecture,
      mode,
      exerciseId || '',
      topic,
      null,
      extracted
    );
    const aiCtx = aiCourseContext({ courseId, courseStorageKey, courseName });

    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey });
    const system = expandContent.buildTopicExpandSystem(mode, language, aiCtx);
    const user = expandContent.buildTopicExpandUser({
      lecture,
      aiCtx,
      mode,
      topic,
      extracted,
      feedback,
      previousMarkdown: force ? existing : ''
    });

    try {
      const response = await openai.chat.completions.create({
        model: getModel(),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: 0.28,
        max_tokens: 1800
      });
      const markdown = (response.choices?.[0]?.message?.content || '').trim();
      if (!markdown) return { success: false, error: 'Empty expansion' };
      topic.card = topic.card || {};
      topic.card.deepMarkdown = markdown;
      topic.card.deepGeneratedAt = new Date().toISOString();
      vault.writeCourseItem(lecturePath, lecture);
      return { success: true, markdown };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
);

ipcMain.handle(
  'lecture:expandSubtopic',
  async (
    _,
    { lecturePath, topicId, subtopicId, courseName, courseId, courseStorageKey, materialMode, exerciseId, force, feedback }
  ) => {
    const apiKey = store.get('apiKey');
    if (!apiKey) return { success: false, error: 'Missing API key' };
    const lecture = vault.readCourseItem(lecturePath);
    const mode = materialMode === 'exercise' ? 'exercise' : 'lecture';
    const topic = findTopicForMode(lecture, topicId, mode, exerciseId || '');
    const subtopic = findSubtopicInTopic(topic, subtopicId);
    if (!topic || !subtopic) return { success: false, error: 'Subtopic not found' };

    const existing = subtopic.deepMarkdown || '';
    if (existing && !force) {
      return { success: true, topic, markdown: existing, summary: subtopic.summary || '', cached: true };
    }

    const extracted = getExtractedForItem(lecturePath, lecture, mode, exerciseId || '');
    const language = expandContent.resolveExpandLanguage(
      lecturePath,
      lecture,
      mode,
      exerciseId || '',
      topic,
      subtopic,
      extracted
    );
    const aiCtx = aiCourseContext({ courseId, courseStorageKey, courseName });

    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey });
    const system = expandContent.buildSubtopicExpandSystem(mode, language, aiCtx);
    const user = expandContent.buildSubtopicExpandUser({
      lecture,
      aiCtx,
      topic,
      subtopic,
      subtopicId,
      extracted,
      feedback,
      previousMarkdown: force ? existing : ''
    });

    try {
      const response = await openai.chat.completions.create({
        model: getModel(),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: 0.28,
        max_tokens: 1400
      });
      const markdown = (response.choices?.[0]?.message?.content || '').trim();
      if (!markdown) return { success: false, error: 'Empty expansion' };

      const plain = markdown.replace(/[#*_>`]/g, '').replace(/\s+/g, ' ').trim();
      subtopic.summary = plain.slice(0, 220) + (plain.length > 220 ? '…' : '');
      subtopic.deepMarkdown = markdown;
      subtopic.deepGeneratedAt = new Date().toISOString();

      vault.writeCourseItem(lecturePath, lecture);
      return { success: true, topic, markdown, summary: subtopic.summary };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
);
