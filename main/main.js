const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const vault = require('./vault');
const pipeline = require('./pipeline');
const coursesApi = require('./courses');
const lectureNotes = require('./lectureNotes');
const noteChat = require('./noteChat');
const studyUnits = require('./studyUnits');
const courseProfile = require('./courseProfile');
const { detectLanguage } = require('./pdf');

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

function getExtractedForItem(itemPath, item) {
  let extracted = safeRead(path.join(itemPath, 'extracted.txt'));
  if (!extracted && item?.source?.lecturePath) {
    extracted = safeRead(path.join(item.source.lecturePath, 'extracted.txt'));
  }
  return extracted;
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

ipcMain.handle('lecture:markTopicStudied', (_, { lecturePath, topicId }) => {
  return vault.markTopicStudied(lecturePath, topicId);
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

ipcMain.handle('lecture:deleteNote', (_, { lecturePath, noteId }) => {
  try {
    return lectureNotes.deleteNote(lecturePath, noteId);
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
  const extracted = getExtractedForItem(lecturePath, lecture);
  const language = detectLanguage(extracted);
  const ctx = aiCourseContext({ courseId, courseStorageKey, courseName });

  const { OpenAI } = require('openai');
  const openai = new OpenAI({ apiKey });
  const system = `You help a university student sharpen their study notes. Respond in ${language} as strict JSON only:
{"keyIdeas":["short phrase",...],"refinedNote":"markdown study note"}
Rules:
- keyIdeas: 2-5 crisp phrases from the highlight + their note (not generic labels)
- refinedNote: clarify and structure THEIR note for review; keep their meaning; use short markdown (bullets ok); under 220 words unless essential
- Do not invent facts beyond highlight/context; study-oriented not fluffy
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
      max_tokens: 900
    });
    const parsed = parseRefineJson(response.choices?.[0]?.message?.content || '');
    if (!parsed?.refinedNote) {
      return { success: false, error: 'Could not refine note' };
    }
    return {
      success: true,
      keyIdeas: Array.isArray(parsed.keyIdeas) ? parsed.keyIdeas : [],
      refinedNote: String(parsed.refinedNote).trim()
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
  const extracted = getExtractedForItem(lecturePath, item);
  const language = detectLanguage(extracted);
  const system = `${noteChat.buildNoteChatSystem(language)}\n\n${aiCtx.block}\n${courseProfile.MATH_OUTPUT_HINT}`;
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

  const { OpenAI } = require('openai');
  const openai = new OpenAI({ apiKey });
  try {
    const response = await openai.chat.completions.create({
      model: getModel(),
      messages,
      temperature: 0.28,
      max_tokens: 1100
    });
    const answer = (response.choices?.[0]?.message?.content || '').trim();
    if (!answer) return { success: false, error: 'Empty response' };
    return { success: true, answer };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('lecture:ask', async (_, { lecturePath, topicId, question, courseName, courseId, courseStorageKey }) => {
  const apiKey = store.get('apiKey');
  if (!apiKey) return { success: false, error: 'Missing API key' };
  const lecture = vault.readCourseItem(lecturePath);
  if (!lecture) return { success: false, error: 'Lecture not found' };
  const topic = lecture.topics?.find((t) => t.id === topicId);
  const extracted = getExtractedForItem(lecturePath, lecture);
  const language = detectLanguage(extracted);
  const aiCtx = aiCourseContext({ courseId, courseStorageKey, courseName });

  const { OpenAI } = require('openai');
  const openai = new OpenAI({ apiKey });
  const system = `You are a contextual university tutor inside Course Dashboard. Answer in ${language}. Be clear, concise, and subject-aware. Use lecture structure and topic card when provided. Under 280 words unless math requires more.
${courseProfile.MATH_OUTPUT_HINT}

${aiCtx.block}`;
  const user = [
    `Course: ${aiCtx.displayName}`,
    `Lecture: ${lecture.title}`,
    topic ? `Current topic: ${topic.title}` : 'No specific topic selected',
    `Lecture summary: ${lecture.lectureSummary || lecture.summary || ''}`,
    topic?.card?.markdown ? `Topic card:\n${topic.card.markdown.slice(0, 6000)}` : '',
    `Course thread: ${JSON.stringify(lecture.courseThread || {})}`,
    `All topics: ${(lecture.topics || []).map((t) => t.title).join('; ')}`,
    `Student question: ${question}`
  ].join('\n\n');

  try {
    const response = await openai.chat.completions.create({
      model: getModel(),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.25,
      max_tokens: 900
    });
    const answer = (response.choices?.[0]?.message?.content || '').trim();
    if (!answer) return { success: false, error: 'Empty response' };
    return { success: true, answer };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('lecture:expandTopic', async (_, { lecturePath, topicId, courseName, courseId, courseStorageKey }) => {
  const apiKey = store.get('apiKey');
  if (!apiKey) return { success: false, error: 'Missing API key' };
  const lecture = vault.readCourseItem(lecturePath);
  const topic = lecture?.topics?.find((t) => t.id === topicId);
  if (!topic) return { success: false, error: 'Topic not found' };
  const extracted = getExtractedForItem(lecturePath, lecture);
  const language = detectLanguage(extracted);
  const aiCtx = aiCourseContext({ courseId, courseStorageKey, courseName });

  const { OpenAI } = require('openai');
  const openai = new OpenAI({ apiKey });
  const system = `Expand this topic with deeper tutor explanation in ${language}. Markdown output.
Go deeper on mechanisms, examples, notation, comparisons — adaptive, not a rigid template.
If the topic is statistical, mathematical, or computational: include formulas, symbol meanings, procedure steps, and interpretation when the lecture material supports them.
${courseProfile.MATH_OUTPUT_HINT}

${aiCtx.block}`;
  const user = `Lecture: ${lecture.title}\nCourse: ${aiCtx.displayName}\nTopic: ${topic.title}\nExisting card:\n${topic.card?.markdown || ''}\n\nSource excerpt:\n${extracted.slice(0, 25000)}`;

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
});
