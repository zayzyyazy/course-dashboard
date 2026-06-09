const fs = require('fs');
const path = require('path');
const { extractPdfText, normalizeLectureName, detectLanguage } = require('./pdf');
const vault = require('./vault');
const lectureStructureLlm = require('./lectureStructureLlm');
const lectureNormalize = require('./lectureNormalize');
const topicCardsLlm = require('./topicCardsLlm');
const exerciseSheets = require('../shared/exerciseSheets.cjs');
const exerciseStructureLlm = require('./exerciseStructureLlm');
const exerciseTopicCardsLlm = require('./exerciseTopicCardsLlm');
const exerciseLinksLlm = require('./exerciseLinksLlm');
const { applySubtopicExerciseLinks } = require('../shared/subtopicExerciseLink.cjs');

function makeLectureFolderId(pdfBaseName) {
  const base = pdfBaseName
    .replace(/[^a-zA-Z0-9\u00C0-\u024F\s_-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 80);
  const suffix = Date.now().toString(36).slice(-4);
  return `${base}_${suffix}`;
}

function structureToLecture(structure, meta) {
  const { makeId } = lectureNormalize;
  return {
    version: 1,
    id: meta.id,
    title: structure.lectureTitle || meta.title,
    lectureSummary: structure.lectureSummary,
    summary: structure.lectureSummary,
    order: meta.order,
    sourcePdf: meta.sourcePdf,
    processedAt: new Date().toISOString(),
    courseThread: structure.courseThread,
    topics: structure.topics.map((t, ti) => ({
      id: t.id || makeId('t', t.title, ti),
      title: t.title,
      importance: t.importance,
      subtopics: t.subtopics || [],
      connections: t.connections || {},
      card: null,
      studyState: 'new'
    })),
    studyState: { opened: false, lastOpenedAt: null, topicsStudied: 0, lastRewindAt: null }
  };
}

async function processLecturePdf({
  pdfPath,
  courseName,
  courseStorageKey,
  courseProfileBlock,
  vaultPath,
  apiKey,
  model,
  temperature,
  onStatus
}) {
  if (!apiKey) {
    const err = new Error('API key required — add in Settings');
    err.code = 'NO_API_KEY';
    throw err;
  }

  const send = (message) => onStatus?.({ message });

  send('Extracting PDF text…');
  const { extractedText, textForAI, pdfBaseName } = await extractPdfText(pdfPath);
  const language = detectLanguage(extractedText);
  const domainHint = inferDomain(courseName, extractedText);

  const storageKey = courseStorageKey || vault.sanitizeName(courseName);
  const courseDirPath = vault.courseDir(vaultPath, storageKey);
  fs.mkdirSync(courseDirPath, { recursive: true });

  const lectureId = makeLectureFolderId(pdfBaseName);
  const lecturePath = path.join(courseDirPath, lectureId);
  fs.mkdirSync(lecturePath, { recursive: true });

  fs.writeFileSync(path.join(lecturePath, 'extracted.txt'), extractedText, 'utf8');
  fs.copyFileSync(pdfPath, path.join(lecturePath, path.basename(pdfPath)));

  const title = normalizeLectureName(pdfBaseName, extractedText);
  fs.writeFileSync(
    path.join(lecturePath, 'meta.json'),
    JSON.stringify({ inferredLectureName: title, sourceFile: path.basename(pdfPath) }, null, 2),
    'utf8'
  );

  const order = vault.syncLectureOrder(courseDirPath, lectureId);
  const orderIndex = order.indexOf(lectureId) + 1;

  const { OpenAI } = require('openai');
  const openai = new OpenAI({ apiKey, timeout: 120_000, maxRetries: 1 });
  const callLlm = async (system, user, options = {}) => {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature,
      max_tokens: options.maxTokens ?? 4096,
      response_format: { type: 'json_object' }
    });
    return (response.choices?.[0]?.message?.content || '').trim();
  };

  send('Building lecture structure (AI)…');
  const structResult = await lectureStructureLlm.extractLectureStructureWithLlm({
    lecturePath,
    outputLanguage: language,
    callLlm,
    normalizeStructure: lectureNormalize.normalizeStructure,
    structureQualityOk: lectureNormalize.structureQualityOk
  });

  if (!structResult.ok) {
    const err = new Error(structResult.error || 'Structure extraction failed');
    err.code = 'STRUCTURE_FAILED';
    err.debug = structResult.debug;
    throw err;
  }
  let lecture = structureToLecture(structResult.structure, {
    id: lectureId,
    title,
    order: orderIndex,
    sourcePdf: path.basename(pdfPath)
  });

  send('Writing tutor topic cards (1/?)…');
  const cardsResult = await topicCardsLlm.generateTopicCards({
    extracted: extractedText,
    lecture,
    outputLanguage: language,
    domainHint,
    courseProfileBlock,
    callLlm,
    onProgress: (message) => send(message)
  });

  if (!cardsResult.ok) {
    const err = new Error(cardsResult.error || 'Topic cards failed');
    err.code = 'TOPIC_CARDS_FAILED';
    throw err;
  }

  lecture = topicCardsLlm.applyCardsToLecture(lecture, cardsResult.cards);
  vault.writeLecture(lecturePath, lecture);

  send('Done');
  return {
    success: true,
    lectureId,
    lecturePath,
    lecture: { ...lecture, path: lecturePath, topicCount: lecture.topics.length }
  };
}

function inferDomain(courseName, text) {
  const hay = `${courseName} ${text}`.toLowerCase();
  if (
    /statistik|statistics|anova|varianz|variance|regression|chi-?square|f-?test|t-?test|hypothesis|wahrscheinlichkeit|probability|streuung|standardabweichung|normalverteilung|effect size|summe der quadrate|sum of squares/.test(
      hay
    )
  ) {
    return 'statistics — include formulas, test logic, assumptions, computation steps, and interpretation when central';
  }
  if (
    /mathemat|mathematics|menge|funktion|beweis|proof|algebra|venn|relation|ableitung|integral|matrix|notation|formel|formula|gleichung|equation|lemma|theorem/.test(
      hay
    )
  ) {
    return 'mathematics — include notation, formulas, symbol meanings, and step logic when central';
  }
  if (
    /programm|programming|algorithm|python|java|javascript|code|datenstruktur|software|syntax|huffman|komplexität|complexity|recursion|loop|api/.test(
      hay
    )
  ) {
    return 'computer science — include procedures, algorithm steps, syntax patterns, and application when central';
  }
  if (/psycholog|experiment|kognition|verhalten|theorie|quantitative|messung|scale|reliability/.test(hay)) {
    return 'psychology / behavioral science — include methods, constructs, and quantitative procedures when central';
  }
  if (/medien|gestalt|wahrnehmung|design|codierung/.test(hay)) {
    return 'digital media / design';
  }
  return 'general university lecture — include formulas and procedures when the source material makes them central';
}

function structureToExerciseLayer(structure, meta) {
  const { makeId } = lectureNormalize;
  return {
    title: structure.exerciseTitle || meta.title || 'Übung',
    exerciseSummary: structure.exerciseSummary,
    sourcePdf: meta.sourcePdf,
    processedAt: new Date().toISOString(),
    topics: structure.topics.map((t, ti) => ({
      id: makeId('ex', t.title, ti),
      title: t.title,
      importance: t.importance,
      practiceFocus: t.practiceFocus || '',
      problemTypes: t.problemTypes || [],
      procedures: t.procedures || [],
      subtopics: t.subtopics || [],
      card: null,
      studyState: 'new'
    })),
    lectureLinks: [],
    studyState: { opened: false, lastOpenedAt: null, topicsStudied: 0, lastRewindAt: null }
  };
}

async function processExercisePdf({
  lecturePath,
  pdfPath,
  courseName,
  courseStorageKey,
  courseProfileBlock,
  vaultPath,
  apiKey,
  model,
  temperature,
  onStatus
}) {
  if (!apiKey) {
    const err = new Error('API key required — add in Settings');
    err.code = 'NO_API_KEY';
    throw err;
  }

  const lecture = vault.readCourseItem(lecturePath);
  if (!lecture) {
    throw new Error('Lecture not found');
  }

  const send = (message) => onStatus?.({ message });

  send('Extracting exercise PDF…');
  const { extractedText, pdfBaseName } = await extractPdfText(pdfPath);
  const language = detectLanguage(extractedText);
  const domainHint = inferDomain(courseName, `${extractedText}\n${lecture.lectureSummary || ''}`);

  exerciseSheets.normalizeLectureExercises(lecture);
  const sheetIndex = lecture.exercises.length;
  const { makeId } = require('./lectureNormalize');
  const sheetId = makeId('exsheet', pdfBaseName, sheetIndex);
  const extractedFile = exerciseSheets.extractedFileName(sheetId, sheetIndex);
  const exercisePdfName = `exercise_${sheetId}_${path.basename(pdfPath)}`;
  fs.writeFileSync(path.join(lecturePath, extractedFile), extractedText, 'utf8');
  fs.copyFileSync(pdfPath, path.join(lecturePath, exercisePdfName));

  const { OpenAI } = require('openai');
  const openai = new OpenAI({ apiKey });
  const callLlm = async (system, user, options = {}) => {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature,
      max_tokens: options.maxTokens ?? 4096,
      response_format: { type: 'json_object' }
    });
    return (response.choices?.[0]?.message?.content || '').trim();
  };

  send('Building exercise structure (AI)…');
  const structResult = await exerciseStructureLlm.extractExerciseStructureWithLlm({
    lecturePath,
    lectureTitle: lecture.title,
    lectureTopics: lecture.topics || [],
    outputLanguage: language,
    callLlm
  });

  if (!structResult.ok) {
    throw new Error(structResult.error || 'Exercise structure failed');
  }

  let exerciseLayer = structureToExerciseLayer(structResult.structure, {
    title: normalizeLectureName(pdfBaseName, extractedText),
    sourcePdf: exercisePdfName
  });
  exerciseLayer.id = sheetId;
  exerciseLayer.label = exerciseSheets.nextSheetLabel(lecture);
  exerciseLayer.extractedFile = extractedFile;

  send('Writing exercise practice cards…');
  const cardsResult = await exerciseTopicCardsLlm.generateExerciseTopicCards({
    extracted: extractedText,
    exerciseLayer,
    lectureTitle: lecture.title,
    lectureSummary: lecture.lectureSummary || lecture.summary,
    outputLanguage: language,
    domainHint,
    courseProfileBlock,
    callLlm
  });

  if (!cardsResult.ok) {
    throw new Error(cardsResult.error || 'Exercise cards failed');
  }

  exerciseLayer = exerciseTopicCardsLlm.applyCardsToExercise(exerciseLayer, cardsResult.cards);

  send('Linking exercise to lecture topics…');
  const linksResult = await exerciseLinksLlm.generateExerciseLectureLinks({
    lectureTopics: lecture.topics || [],
    exerciseTopics: exerciseLayer.topics,
    lectureSummary: lecture.lectureSummary,
    exerciseSummary: exerciseLayer.exerciseSummary,
    outputLanguage: language,
    callLlm
  });

  if (linksResult.ok) {
    exerciseLayer = exerciseLinksLlm.attachLinksToTopics(exerciseLayer, linksResult.links);
  }

  exerciseSheets.appendExerciseSheet(lecture, exerciseLayer);
  applySubtopicExerciseLinks(lecture);
  vault.writeCourseItem(lecturePath, lecture);

  send('Done');
  return {
    success: true,
    lecturePath,
    exerciseId: sheetId,
    lecture: { ...lecture, path: lecturePath, hasExercise: true }
  };
}

module.exports = { processLecturePdf, processExercisePdf, inferDomain };
