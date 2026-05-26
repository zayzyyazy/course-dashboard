const topicExtraction = require('./topicExtraction');

function slugify(value) {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function makeId(prefix, title, index) {
  const base = slugify(title) || `item-${index}`;
  return `${prefix}-${base}`.slice(0, 48);
}

function normalizeStructure(raw) {
  if (!raw || !Array.isArray(raw.topics)) return null;
  const topics = raw.topics.map((topic, ti) => {
    const title = topicExtraction.normalizeTopicLabel(topic.title);
    if (!title || topicExtraction.isStructuralHeading(title)) return null;
    const topicId = topic.id || makeId('t', title, ti);
    const subtopics = (topic.subtopics || []).map((sub, si) => {
      const subTitle = topicExtraction.normalizeTopicLabel(sub.title || sub);
      if (!subTitle || topicExtraction.isStructuralHeading(subTitle)) return null;
      return { id: sub.id || makeId(`${topicId}-s`, subTitle, si), title: subTitle };
    }).filter(Boolean);
    return {
      id: topicId,
      title,
      importance: topic.importance || 'core',
      subtopics,
      connections: {
        buildsOn: topic.connections?.buildsOn || [],
        continuesIn: topic.connections?.continuesIn || [],
        relatedInCourse: topic.connections?.relatedInCourse || []
      },
      card: topic.card || null,
      studyState: topic.studyState || 'new'
    };
  }).filter(Boolean);
  if (!topics.length) return null;
  return {
    version: topicExtraction.STRUCTURE_VERSION,
    extractedAt: raw.extractedAt || new Date().toISOString(),
    source: raw.source || 'llm',
    lectureTitle: topicExtraction.normalizeTopicLabel(raw.lectureTitle || '') || '',
    lectureSummary: String(raw.lectureSummary || '').trim(),
    topics,
    courseThread: raw.courseThread || {
      summary: '',
      continuesFrom: '',
      leadsTo: '',
      positionNote: ''
    }
  };
}

module.exports = {
  normalizeStructure,
  makeId,
  slugify,
  structureQualityOk: topicExtraction.structureQualityOk
};
