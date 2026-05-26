const fs = require('fs');
const path = require('path');
const vault = require('./vault');
const promoteUnitLlm = require('./promoteUnitLlm');
const topicCardsLlm = require('./topicCardsLlm');
const { detectLanguage } = require('./pdf');
const { inferDomain } = require('./pipeline');

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function makeUnitFolderId(topicTitle) {
  const base = (topicTitle || 'unit')
    .replace(/[^a-zA-Z0-9\u00C0-\u024F\s_-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 50);
  return `unit_${base}_${Date.now().toString(36).slice(-5)}`;
}

function buildProvenanceLabel(sourceLecture, sourceTopic) {
  const lecOrder = sourceLecture.order ? `Lecture ${sourceLecture.order}` : sourceLecture.title;
  return `Promoted from ${lecOrder}: ${sourceTopic.title}`;
}

function structureToStudyUnit(structure, meta) {
  const { makeId } = require('./lectureNormalize');
  return {
    version: 1,
    type: 'promoted',
    id: meta.id,
    title: structure.lectureTitle || meta.title,
    lectureSummary: structure.lectureSummary,
    summary: structure.lectureSummary,
    order: meta.order,
    processedAt: new Date().toISOString(),
    courseThread: structure.courseThread,
    source: meta.source,
    provenanceLabel: meta.provenanceLabel,
    promotedAt: new Date().toISOString(),
    topics: structure.topics.map((t, ti) => ({
      id: t.id || makeId('t', t.title, ti),
      title: t.title,
      importance: t.importance,
      subtopics: t.subtopics || [],
      connections: t.connections || {},
      card: null,
      studyState: 'new'
    })),
    studyState: { opened: false, lastOpenedAt: null, topicsStudied: 0 }
  };
}

function insertAfterSource(order, sourceLectureId, newId) {
  const idx = order.indexOf(sourceLectureId);
  if (idx >= 0) {
    const next = [...order];
    next.splice(idx + 1, 0, newId);
    return next;
  }
  return [...order, newId];
}

async function promoteTopic({
  vaultPath,
  courseName,
  courseStorageKey,
  courseProfileBlock,
  lecturePath,
  topicId,
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

  const sourceLecture = vault.readCourseItem(lecturePath);
  if (!sourceLecture || sourceLecture.itemType === 'promoted') {
    return { success: false, error: 'Source lecture not found' };
  }

  const sourceTopic = sourceLecture.topics?.find((t) => t.id === topicId);
  if (!sourceTopic) {
    return { success: false, error: 'Topic not found' };
  }

  if (sourceTopic.promotedToUnitId) {
    const storageKey = courseStorageKey || vault.sanitizeName(courseName);
    const existingPath = path.join(vault.courseDir(vaultPath, storageKey), sourceTopic.promotedToUnitId);
    const existing = vault.readCourseItem(existingPath);
    if (existing) {
      return {
        success: false,
        error: 'This topic already has a study unit',
        existingUnit: { ...existing, path: existingPath }
      };
    }
    delete sourceTopic.promotedToUnitId;
  }

  const extracted = safeRead(path.join(lecturePath, 'extracted.txt'));
  const language = detectLanguage(extracted);
  const domainHint = inferDomain(courseName, extracted);

  const { OpenAI } = require('openai');
  const openai = new OpenAI({ apiKey });
  const callLlm = async (system, user) => {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature,
      response_format: { type: 'json_object' }
    });
    return (response.choices?.[0]?.message?.content || '').trim();
  };

  send('Building study unit structure…');
  const structResult = await promoteUnitLlm.extractPromotedUnitStructure({
    outputLanguage: language,
    domainHint,
    courseProfileBlock,
    sourceLectureTitle: sourceLecture.title,
    sourceTopic,
    extracted,
    callLlm
  });

  if (!structResult.ok) {
    return { success: false, error: structResult.error || 'Structure generation failed' };
  }

  const storageKey = courseStorageKey || vault.sanitizeName(courseName);
  const courseDirPath = vault.courseDir(vaultPath, storageKey);
  const unitId = makeUnitFolderId(sourceTopic.title);
  const unitPath = path.join(courseDirPath, unitId);
  fs.mkdirSync(unitPath, { recursive: true });

  const order = vault.readLectureOrder(courseDirPath);
  const newOrder = insertAfterSource(order, sourceLecture.id, unitId);
  const orderIndex = newOrder.indexOf(unitId) + 1;

  const provenanceLabel = buildProvenanceLabel(sourceLecture, sourceTopic);
  let unit = structureToStudyUnit(structResult.structure, {
    id: unitId,
    title: structResult.structure.lectureTitle,
    order: orderIndex,
    source: {
      courseName,
      lectureId: sourceLecture.id,
      lectureTitle: sourceLecture.title,
      lecturePath,
      topicId: sourceTopic.id,
      topicTitle: sourceTopic.title
    },
    provenanceLabel
  });

  send('Writing tutor topic cards…');
  const cardsResult = await topicCardsLlm.generateTopicCards({
    extracted,
    lecture: unit,
    outputLanguage: language,
    domainHint,
    courseProfileBlock,
    callLlm
  });

  if (!cardsResult.ok) {
    try {
      fs.rmSync(unitPath, { recursive: true, force: true });
    } catch (_) {}
    return { success: false, error: cardsResult.error || 'Topic card generation failed' };
  }

  unit = topicCardsLlm.applyCardsToLecture(unit, cardsResult.cards);
  vault.writeStudyUnit(unitPath, unit);

  fs.writeFileSync(
    path.join(unitPath, 'source_ref.json'),
    JSON.stringify(
      {
        lecturePath,
        lectureId: sourceLecture.id,
        topicId: sourceTopic.id
      },
      null,
      2
    ),
    'utf8'
  );

  sourceTopic.promotedToUnitId = unitId;
  sourceTopic.promotedAt = new Date().toISOString();
  sourceTopic.promotedProvenance = provenanceLabel;
  vault.writeLecture(lecturePath, sourceLecture);

  vault.writeLectureOrder(courseDirPath, newOrder);
  newOrder.forEach((id, index) => {
    const itemPath = path.join(courseDirPath, id);
    const item = vault.readCourseItem(itemPath);
    if (item) {
      item.order = index + 1;
      if (item.type === 'promoted') vault.writeStudyUnit(itemPath, item);
      else vault.writeLecture(itemPath, item);
    }
  });

  send('Done');
  const items = vault.loadCourseLectures(vaultPath, storageKey);
  const promoted = items.find((i) => i.id === unitId);
  return {
    success: true,
    unitId,
    unitPath,
    unit: promoted ? { ...promoted, path: unitPath } : { ...unit, path: unitPath, itemType: 'promoted' },
    provenanceLabel
  };
}

module.exports = { promoteTopic, buildProvenanceLabel };
