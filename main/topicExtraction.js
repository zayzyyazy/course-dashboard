/**
 * Topic extraction: domain concepts from lecture materials.
 * Priority: lecture_structure.json > overview Kernthemen bullets > concepts ###/bold > concept map.
 */

const fs = require('fs');
const path = require('path');

const STRUCTURE_VERSION = 4;
const MAX_MAIN_TOPICS = 5;
const MAX_MAIN_TOPICS_HIGH_CONF = 7;
const MIN_SCORE_MAIN = 9;

const RELATION_WORDS = [
  'builds_on', 'requires', 'enables', 'contrasts_with', 'part_of', 'generalizes', 'specializes',
  'erfordert', 'ermöglicht', 'baut auf', 'gegensatz', 'teil von', 'spezialisiert', 'verallgemeinert'
];

/** AI-generated concepts.md / summary.md section headers — not study topics */
const META_SECTION_HEADINGS = new Set([
  'bausteine', 'syntax & muster', 'syntax und muster', 'ablauf einer ausführung',
  'typische fehler', 'bezug zu früheren vorlesungen', 'konzeptuelle bausteine',
  'beziehungen', 'wiederkehrende themen', 'wiederkehrende kursfäden',
  'symbols & objects', 'symbols and objects', 'core procedures',
  'relationships', 'assumptions & failure modes', 'compare/contrast pairs',
  'objects & methods', 'objekte & methoden', 'dependency & build order',
  'pitfalls & sanity checks', '10-minute practice path', '10-minute review path'
]);

const STRUCTURAL_PATTERNS = [
  /^fokusthema\b/i, /^kernthemen?\b/i, /^unterthemen\b/i, /\bunterthemen\s+und\s+navigation/i,
  /\bund\s+navigation\b/i, /^navigation\b/i, /^aufbau\b/i, /^struktur\s+(der|von|des)\b/i,
  /^gliederung\b/i, /^organisation\b/i, /typische\s+fehler/i, /häufige\s+fehler/i,
  /voraussetzungen?\s+(und\s+)?anschluss/i, /wiederkehrende?\s+kursf/i, /kursfad/i,
  /bezug\s+zu\s+früher/i, /früheren?\s+vorlesungen/i, /was\s+ist\s+zentral/i, /was\s+unterstützt/i,
  /lecture\s+arc/i, /vorlesungsbogen/i, /concept\s+map/i, /beziehungskarte/i,
  /build\s+order/i, /study\s+sequence/i, /lernreihenfolge/i, /abhängigkeitskette/i,
  /pitfall/i, /fallstricke/i, /review\s+path/i, /practice\s+path/i, /10.minuten/i,
  /objects?\s+(&|und)\s+methods/i, /objekte\s+(&|und)\s+methoden/i,
  /^konzeptuelle\s+bausteine$/i, /^beziehungen$/i, /^wiederkehrende\s+themen$/i,
  /^bausteine$/i, /^syntax\s*&\s*muster$/i, /^ablauf\s+einer\s+ausführung$/i,
  /^symbols?\s*&\s*objects?$/i, /^core\s+procedures$/i, /^relationships$/i,
  /^assumptions\b/i, /^compare\/contrast/i, /^spannungen\b/i, /^tensions\b/i,
  /^deep\s+dive/i, /^overview\b/i, /^übersicht$/i, /^zusammenfassung$/i,
  /^einordnung\b/i, /^orientierung\b/i, /^agenda$/i, /^inhalt$/i, /^fazit$/i,
  /^sicher\s+erklären\s+können/i
];

function normalizeTopicLabel(title) {
  return String(title || '')
    .replace(/\*+/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\d]+[\.\):\-]\s*/, '')
    .replace(/^[-–—•]\s*/, '')
    .trim();
}

function isMetaSectionHeading(title) {
  const key = normalizeTopicLabel(title).toLowerCase();
  return META_SECTION_HEADINGS.has(key);
}

function isLowQualityLabel(title) {
  const t = normalizeTopicLabel(title);
  if (!t) return true;
  if (!/\s/.test(t) && t.length > 22) return true;
  if (/solltensie|auszur|merkhilfe|begriffbedeutung|zb\s*$/i.test(t)) return true;
  if (/^(der|die|das|ein|eine)\s+\w+$/i.test(t) && t.length < 12) return true;
  const words = t.split(/\s+/).filter((w) => w.length >= 2);
  if (words.length === 0) return true;
  const letters = t.replace(/\s/g, '');
  if (letters.length > 18 && !/\s/.test(t)) return true;
  return false;
}

function isStructuralHeading(title) {
  const t = normalizeTopicLabel(title);
  if (!t || t.length < 3 || t.length > 95) return true;
  if (isMetaSectionHeading(t)) return true;
  if (isLowQualityLabel(t)) return true;
  if (STRUCTURAL_PATTERNS.some((pat) => pat.test(t))) return true;
  if (/^(was|wie|warum|wann|welche)\s.+\?$/.test(t)) return true;
  if (/^\d+\s*(minuten|minute|min)\b/i.test(t)) return true;
  return false;
}

function isValidTopic(title) {
  return !isStructuralHeading(title);
}

function dedupeKey(title) {
  return normalizeTopicLabel(title).toLowerCase()
    .replace(/[^\wäöüßàáâãäåæçèéêëìíîïñòóôõöùúûüýÿœ\s-]/gi, '')
    .replace(/\s+/g, ' ');
}

function areNearDuplicate(a, b) {
  const ka = dedupeKey(a);
  const kb = dedupeKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  if (ka.length > 10 && kb.length > 10 && (ka.includes(kb) || kb.includes(ka))) return true;
  return false;
}

function addCandidate(pool, candidate, log) {
  const title = normalizeTopicLabel(candidate.title);
  if (!isValidTopic(title)) {
    if (log) log.rejected.push({ title: candidate.title, reason: candidate.rejectReason || 'structural_or_low_quality', source: candidate.source });
    return;
  }
  const key = dedupeKey(title);
  const existing = pool.get(key);
  const entry = {
    title,
    score: candidate.score || 5,
    isSubtopic: Boolean(candidate.isSubtopic),
    parent: candidate.parent || null,
    source: candidate.source || 'unknown'
  };
  if (!existing || existing.score < entry.score) {
    pool.set(key, entry);
    if (log) log.raw.push({ title, score: entry.score, source: entry.source, isSubtopic: entry.isSubtopic });
  }
}

function extractConceptMapNodes(overviewMd, pool, log) {
  const lines = (overviewMd || '').split('\n');
  const relationRx = new RegExp(`(${RELATION_WORDS.join('|')})`, 'i');
  for (const line of lines) {
    if (!relationRx.test(line) && !/[*—–-]\s*(enables|requires|builds|baut|erfordert)/i.test(line)) continue;
    const boldRx = /\*\*([^*]+?)\*\*/g;
    let m;
    while ((m = boldRx.exec(line)) !== null) {
      addCandidate(pool, { title: m[1], score: 12, source: 'concept_map', isSubtopic: false }, log);
    }
  }
}

/** Kernthemen / Unterthemen bullets in German overview template — real topics live here */
function extractTopicsFromOverviewContent(overviewMd, pool, log) {
  let section = '';
  let parentTopic = null;

  for (const line of (overviewMd || '').split('\n')) {
    const h2 = line.match(/^##\s+(.+)/);
    if (h2) {
      section = normalizeTopicLabel(h2[1]);
      parentTopic = null;
      continue;
    }

    const inKernthemen = /kernthemen/i.test(section);
    const inUnterthemen = /unterthemen/i.test(section);

    const topBold = line.match(/^[-*]\s+\*\*([^*]+)\*\*/);
    if (inKernthemen && topBold) {
      const title = normalizeTopicLabel(topBold[1].split(' - ')[0]);
      addCandidate(pool, { title, score: 15, source: 'overview_kernthemen' }, log);
      continue;
    }

    if (inUnterthemen) {
      const parentOnly = line.match(/^[-*]\s+\*\*([^*]+)\*\*\s*$/);
      const parentWithNote = line.match(/^[-*]\s+\*\*([^*]+)\*\*\s*[-–—]/);
      if (parentOnly || parentWithNote) {
        parentTopic = normalizeTopicLabel((parentOnly || parentWithNote)[1]);
        addCandidate(pool, { title: parentTopic, score: 14, source: 'overview_unterthemen_parent' }, log);
        continue;
      }
      const sub = line.match(/^\s{2,}[-*]\s+(.+)/);
      if (sub && parentTopic) {
        const subTitle = normalizeTopicLabel(sub[1]);
        addCandidate(pool, {
          title: subTitle,
          score: 12,
          isSubtopic: true,
          parent: parentTopic,
          source: 'overview_unterthemen_sub'
        }, log);
      }
    }
  }
}

/** concepts.md: use ### and **bold** only — skip ## meta sections */
function extractFromConceptsContent(conceptsMd, pool, log) {
  let inMetaSection = false;
  for (const line of (conceptsMd || '').split('\n')) {
    const h2 = line.match(/^##\s+(.+)/);
    if (h2) {
      inMetaSection = isMetaSectionHeading(h2[1]) || isStructuralHeading(h2[1]);
      if (!inMetaSection) {
        const title = normalizeTopicLabel(h2[1]);
        if (isValidTopic(title)) {
          addCandidate(pool, { title, score: 8, source: 'concepts_h2_domain' }, log);
        }
      }
      continue;
    }
    const h3 = line.match(/^###\s+(.+)/);
    if (h3 && !inMetaSection) {
      addCandidate(pool, { title: h3[1], score: 11, isSubtopic: true, source: 'concepts_h3' }, log);
      continue;
    }
    if (!inMetaSection) {
      for (const term of (line.match(/\*\*([^*]{3,80})\*\*/g) || [])) {
        addCandidate(pool, {
          title: term.replace(/\*\*/g, ''),
          score: 10,
          source: 'concepts_bold'
        }, log);
      }
    }
  }
}

function importFromLectureStructureJson(lecturePath, safeReadJson) {
  const readJson = safeReadJson || ((p) => {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
  });
  const raw = readJson(path.join(lecturePath, 'lecture_structure.json'));
  if (!raw || !Array.isArray(raw.topicTree) || raw.topicTree.length === 0) return null;

  const topicMap = new Map();

  function attachSub(parentTitle, subTitle) {
    const pKey = dedupeKey(parentTitle);
    if (!topicMap.has(pKey)) return;
    const node = topicMap.get(pKey);
    if (!node.subtopics.find((s) => dedupeKey(s) === dedupeKey(subTitle))) {
      node.subtopics.push(normalizeTopicLabel(subTitle));
    }
  }

  function addMain(label, subs = [], core = false) {
    const title = normalizeTopicLabel(label);
    if (!isValidTopic(title)) return;
    const key = dedupeKey(title);
    if (!topicMap.has(key)) {
      topicMap.set(key, {
        title,
        importance: core ? 'core' : 'supporting',
        subtopics: []
      });
    } else if (core) {
      topicMap.get(key).importance = 'core';
    }
    for (const sub of subs) {
      const st = normalizeTopicLabel(typeof sub === 'string' ? sub : sub?.label || sub);
      if (isValidTopic(st)) attachSub(title, st);
    }
  }

  const coreSet = new Set((raw.coreThemes || []).map((t) => dedupeKey(t)));

  for (const node of raw.topicTree) {
    const subs = (node.subtopics || []).map((s) => (typeof s === 'string' ? s : s?.label)).filter(Boolean);
    const core = node.role === 'Fokusthema' || coreSet.has(dedupeKey(node.label));
    addMain(node.label, subs, core);
  }

  if (raw.focusTheme) addMain(raw.focusTheme, [], true);

  for (const nav of raw.navigableTopics || []) {
    const label = nav.label;
    if (!label) continue;
    if (nav.role === 'Unterthema' && nav.parent) {
      addMain(nav.parent, [], false);
      attachSub(nav.parent, label);
    } else {
      addMain(label, [], nav.role === 'Fokusthema' || coreSet.has(dedupeKey(label)));
    }
  }

  for (const d of raw.deepDiveTopics || []) {
    const label = d.label || d.rawLabel;
    if (!label) continue;
    if (d.role === 'Unterthema' && d.parent) {
      addMain(d.parent, [], false);
      attachSub(d.parent, label);
    } else {
      addMain(label, [], d.role === 'Fokusthema' || coreSet.has(dedupeKey(label)));
    }
  }

  for (const sec of raw.deepDiveSections || []) {
    addMain(sec.label, [], sec.role === 'Fokusthema');
    for (const sub of sec.subtopics || []) {
      if (sub?.label) attachSub(sec.label, sub.label);
    }
  }

  const topics = [...topicMap.values()]
    .filter((t) => isValidTopic(t.title))
    .slice(0, MAX_MAIN_TOPICS_HIGH_CONF);

  if (topics.length < 2) return null;

  return {
    version: STRUCTURE_VERSION,
    extractedAt: new Date().toISOString(),
    source: 'lecture_structure.json',
    topics: topics.map((t) => ({
      title: t.title,
      importance: t.importance,
      subtopics: t.subtopics.slice(0, 5).map((st) => ({ title: st })),
      connections: { buildsOn: [], continuesIn: [], relatedInCourse: [] }
    })),
    courseThread: {
      summary: raw.focusTheme ? `Fokus: ${raw.focusTheme}` : '',
      continuesFrom: (raw.prerequisites || [])[0] || '',
      leadsTo: '',
      positionNote: ''
    }
  };
}

function poolToStructure(pool, overviewMd, source) {
  const merged = [...pool.values()].sort((a, b) => b.score - a.score);
  const mains = merged.filter((c) => !c.isSubtopic && c.score >= MIN_SCORE_MAIN);
  const maxMain = mains.some((m) => m.score >= 14) ? MAX_MAIN_TOPICS_HIGH_CONF : MAX_MAIN_TOPICS;
  const mainTopics = mains.slice(0, maxMain);

  if (mainTopics.length === 0) {
    const fallback = merged.filter((c) => !c.isSubtopic).slice(0, MAX_MAIN_TOPICS);
    if (!fallback.length) return null;
    mainTopics.push(...fallback);
  }

  const topics = mainTopics.map((main) => {
    const subs = merged
      .filter((c) => c.isSubtopic && (c.parent === main.title || areNearDuplicate(c.parent, main.title)))
      .slice(0, 4);
    const extraSubs = merged
      .filter((c) => c.isSubtopic && !subs.includes(c) && !areNearDuplicate(c.title, main.title))
      .slice(0, 2);

    const subtopics = [...subs, ...extraSubs]
      .filter((s, i, arr) => arr.findIndex((x) => dedupeKey(x.title) === dedupeKey(s.title)) === i)
      .slice(0, 5)
      .map((s) => ({ title: s.title }));

    return {
      title: main.title,
      importance: main.score >= 13 ? 'core' : 'supporting',
      subtopics,
      connections: { buildsOn: [], continuesIn: [], relatedInCourse: [] }
    };
  });

  return {
    version: STRUCTURE_VERSION,
    extractedAt: new Date().toISOString(),
    source,
    topics,
    courseThread: extractCourseThreadNote(overviewMd)
  };
}

function buildStructureFromLectureMaterials(lecturePath, safeRead, overviewMd, safeReadJson) {
  const log = { raw: [], rejected: [], surviving: [] };
  const overview = overviewMd || safeRead(path.join(lecturePath, 'overview.md'));

  const imported = importFromLectureStructureJson(lecturePath, safeReadJson);
  if (imported?.topics?.length >= 2) {
    log.surviving = imported.topics.map((t) => t.title);
    log.source = 'lecture_structure.json';
    return imported;
  }

  const pool = new Map();
  extractTopicsFromOverviewContent(overview, pool, log);
  extractConceptMapNodes(overview, pool, log);
  extractFromConceptsContent(safeRead(path.join(lecturePath, 'concepts.md')), pool, log);
  extractFromConceptsContent(safeRead(path.join(lecturePath, 'summary.md')), pool, log);

  const structure = poolToStructure(pool, overview, 'lecture_materials_heuristic');
  if (structure?.topics?.length) {
    log.surviving = structure.topics.map((t) => t.title);
  }
  return structure;
}

function debugTopicExtraction(lecturePath, safeRead, safeReadJson) {
  const log = { lecturePath, raw: [], rejected: [], surviving: [], source: null };
  const overview = safeRead(path.join(lecturePath, 'overview.md'));

  const imported = importFromLectureStructureJson(lecturePath, safeReadJson);
  if (imported?.topics?.length >= 2) {
    log.source = 'lecture_structure.json';
    log.surviving = imported.topics.map((t) => ({
      title: t.title,
      subtopics: (t.subtopics || []).map((s) => s.title)
    }));
    return { structure: imported, log };
  }

  const pool = new Map();
  extractTopicsFromOverviewContent(overview, pool, log);
  extractConceptMapNodes(overview, pool, log);
  extractFromConceptsContent(safeRead(path.join(lecturePath, 'concepts.md')), pool, log);
  extractFromConceptsContent(safeRead(path.join(lecturePath, 'summary.md')), pool, log);

  const structure = poolToStructure(pool, overview, 'lecture_materials_heuristic');
  log.source = structure?.source || null;
  log.surviving = (structure?.topics || []).map((t) => ({
    title: t.title,
    subtopics: (t.subtopics || []).map((s) => s.title)
  }));
  return { structure, log };
}

function extractCourseThreadNote(overviewMd) {
  const text = (overviewMd || '').slice(0, 4000);
  const continues = text.match(/(?:continuesFrom|baut auf|Builds on|Voraussetzungen)[:\s]+([^\n.]+)/i);
  const leads = text.match(/(?:leadsTo|führt zu|Leads to|Anschluss)[:\s]+([^\n.]+)/i);
  return {
    summary: '',
    continuesFrom: continues ? normalizeTopicLabel(continues[1]) : '',
    leadsTo: leads ? normalizeTopicLabel(leads[1]) : '',
    positionNote: ''
  };
}

function structureQualityOk(structure) {
  if (!structure?.topics?.length) return false;
  if ((structure.version || 1) < STRUCTURE_VERSION) return false;
  if (structure.source !== 'llm') return false;
  for (const t of structure.topics) {
    if (!isValidTopic(t.title)) return false;
    for (const s of t.subtopics || []) {
      if (!isValidTopic(s.title)) return false;
    }
  }
  if (structure.topics.length > MAX_MAIN_TOPICS_HIGH_CONF) return false;
  const thread = structure.courseThread || {};
  if (
    !String(thread.summary || '').trim() &&
    !String(thread.continuesFrom || '').trim() &&
    !String(thread.leadsTo || '').trim()
  ) {
    return false;
  }
  return true;
}

function needsStructureRefresh(structure) {
  if (!structure?.topics?.length) return true;
  return !structureQualityOk(structure);
}

function filterStructureTopics(structure) {
  if (!structure?.topics) return structure;
  const topics = structure.topics
    .map((topic) => {
      const title = normalizeTopicLabel(topic.title);
      if (!isValidTopic(title)) return null;
      const subtopics = (topic.subtopics || [])
        .map((s) => ({ ...s, title: normalizeTopicLabel(s.title || s) }))
        .filter((s) => isValidTopic(s.title));
      return { ...topic, title, subtopics };
    })
    .filter(Boolean);
  return { ...structure, version: STRUCTURE_VERSION, topics };
}

function getTopicTitlesFromStructure(structure) {
  const titles = [];
  for (const t of structure?.topics || []) {
    if (isValidTopic(t.title)) titles.push(t.title);
    for (const s of t.subtopics || []) {
      if (isValidTopic(s.title)) titles.push(s.title);
    }
  }
  const unique = [];
  for (const item of titles) {
    if (!unique.some((u) => u.toLowerCase() === item.toLowerCase())) unique.push(item);
  }
  return unique.slice(0, 14);
}

function buildStructureExtractionPrompt(language) {
  const lectureStructureLlm = require('./lectureStructureLlm');
  return lectureStructureLlm.buildStructureExtractionPrompt(language);
}

module.exports = {
  STRUCTURE_VERSION,
  normalizeTopicLabel,
  isStructuralHeading,
  isValidTopic,
  isLowQualityLabel,
  dedupeKey,
  areNearDuplicate,
  importFromLectureStructureJson,
  buildStructureFromLectureMaterials,
  debugTopicExtraction,
  structureQualityOk,
  needsStructureRefresh,
  filterStructureTopics,
  getTopicTitlesFromStructure,
  buildStructureExtractionPrompt,
  extractConceptMapNodes
};
