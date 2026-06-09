const coursesApi = require('./courses');
const exerciseSheets = require('../shared/exerciseSheets.cjs');
const {
  buildDashboardOverview,
  getStudyItemsForCourse,
  lectureProgress
} = require('./dashboard');
const studyState = require('../shared/studyState.cjs');

const MAX_MATERIAL_HEAVY = 12;
const MAX_CONNECTION_LINES = 30;
const MAX_TOPICS_PER_ITEM = 12;

/** How demanding the topic is structurally — NOT user settings or notes. */
function topicMaterialWeight(topic) {
  if (!topic) return 0;
  let w = 0;
  if (topic.importance === 'foundation') w += 2;
  else if (topic.importance === 'core') w += 4;
  else if (topic.importance === 'supporting') w += 1;

  const depth = topic.studyDepth || '';
  if (depth === 'examHeavy') w += 6;
  else if (depth === 'high') w += 4;
  else if (depth === 'medium') w += 2;

  const subs = topic.subtopics || [];
  w += subs.length * 1.8;
  for (const sub of subs) {
    if (sub.studyDepth === 'examHeavy') w += 3;
    else if (sub.studyDepth === 'high') w += 2;
    else if (sub.studyDepth === 'medium') w += 1;
  }

  return Math.round(w * 10) / 10;
}

function topicGist(topic) {
  const md = topic.card?.markdown?.trim();
  if (!md) return '';
  return md
    .replace(/[#*_>`[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 110);
}

function analyzeCourseMaterial(studyItems) {
  let topicCount = 0;
  let subtopicCount = 0;
  let examHeavy = 0;
  let highFocus = 0;
  let foundation = 0;
  let core = 0;
  let supporting = 0;
  let examHeavySubs = 0;
  let exerciseTopics = 0;
  let exerciseExamHeavy = 0;
  const heaviest = [];

  for (const lec of studyItems) {
    for (const topic of lec.topics || []) {
      topicCount += 1;
      subtopicCount += (topic.subtopics || []).length;
      if (topic.importance === 'foundation') foundation += 1;
      if (topic.importance === 'core') core += 1;
      if (topic.importance === 'supporting') supporting += 1;
      if (topic.studyDepth === 'examHeavy') examHeavy += 1;
      if (topic.studyDepth === 'high') highFocus += 1;

      for (const sub of topic.subtopics || []) {
        if (sub.studyDepth === 'examHeavy') examHeavySubs += 1;
      }

      const weight = topicMaterialWeight(topic);
      if (weight >= 6) {
        heaviest.push({
          weight,
          lectureTitle: lec.title,
          topicTitle: topic.title,
          importance: topic.importance,
          studyDepth: topic.studyDepth,
          subtopicCount: (topic.subtopics || []).length,
          gist: topicGist(topic),
          status: studyState.topicStudyStatus(topic)
        });
      }
    }

    exerciseSheets.normalizeLectureExercises(lec);
    for (const sheet of exerciseSheets.getExerciseSheets(lec)) {
      for (const t of sheet.topics || []) {
        exerciseTopics += 1;
        if (t.studyDepth === 'examHeavy' || t.practiceFocus) exerciseExamHeavy += 1;
      }
    }
  }

  heaviest.sort((a, b) => b.weight - a.weight);

  const demandScore =
    examHeavy * 8 +
    highFocus * 4 +
    foundation * 2 +
    core * 2 +
    subtopicCount * 0.6 +
    topicCount * 0.3 +
    exerciseTopics * 1.5;

  let examCharacter = 'mixed conceptual + applied';
  const proceduralRatio = topicCount > 0 ? examHeavy / topicCount : 0;
  if (proceduralRatio >= 0.35 || examHeavySubs >= 8) {
    examCharacter = 'procedures, calculations, formulas, applied exercises (exam-heavy topics dominate)';
  } else if (proceduralRatio >= 0.18) {
    examCharacter = 'mixed: core concepts plus procedural/application blocks';
  } else if (foundation >= 3 && examHeavy < 3) {
    examCharacter = 'conceptual foundations, definitions, structural understanding';
  }

  let graspEstimate = 'medium';
  if (demandScore >= 120 || examHeavy >= 10) graspEstimate = 'high — many deep/exam-heavy topics and subtopics';
  else if (demandScore >= 70) graspEstimate = 'medium-high — substantial core and exam-relevant material';
  else if (demandScore < 35) graspEstimate = 'lighter — fewer deep topics';

  return {
    topicCount,
    subtopicCount,
    examHeavy,
    highFocus,
    foundation,
    core,
    supporting,
    examHeavySubs,
    exerciseTopics,
    exerciseExamHeavy,
    demandScore: Math.round(demandScore),
    examCharacter,
    graspEstimate,
    heaviest: heaviest.slice(0, 8)
  };
}

function collectUnfinishedFoundations(studyItems) {
  const blocking = [];
  for (const lec of studyItems) {
    for (const topic of lec.topics || []) {
      if (topic.importance !== 'foundation') continue;
      if (studyState.isTopicStudied(topic)) continue;
      const needs = topic.connections?.buildsOn?.length
        ? ` (later topics need: ${topic.connections.buildsOn.join(', ')})`
        : '';
      blocking.push(`${lec.title} → ${topic.title}${needs}`);
    }
  }
  return blocking.slice(0, 6);
}

function formatTopicCompact(topic) {
  const status = studyState.topicStudyStatus(topic);
  const weight = topicMaterialWeight(topic);
  const tags = [`grasp-burden:${weight}`, status];
  if (topic.importance) tags.push(topic.importance);
  if (topic.studyDepth) tags.push(topic.studyDepth);

  const subs = topic.subtopics || [];
  if (subs.length) {
    const { total, studied } = studyState.subtopicsProgress(topic);
    tags.push(`${subs.length} subs (${studied}/${total} done)`);
    const shaky = subs
      .filter((s) => s.studyState === 'studied' && studyState.normalizeConfidence(s.studyConfidence) === 'low')
      .map((s) => s.title);
    if (shaky.length) tags.push(`not solid yet: ${shaky.slice(0, 2).join(', ')}`);
  }

  const gist = topicGist(topic);
  const conn = [];
  const c = topic.connections || {};
  if (c.buildsOn?.length) conn.push(`needs: ${c.buildsOn.slice(0, 3).join(' + ')}`);
  if (c.continuesIn?.length) conn.push(`feeds: ${c.continuesIn.slice(0, 3).join(' + ')}`);

  const gistStr = gist ? ` — "${gist}"` : '';
  const connStr = conn.length ? ` | ${conn.join(' · ')}` : '';
  return `    · ${topic.title} [${tags.join(' · ')}]${gistStr}${connStr}`;
}

function collectLowConfidenceSubtopics(studyItems, maxPerCourse = 8) {
  const found = [];
  for (const lec of studyItems) {
    for (const topic of lec.topics || []) {
      for (const sub of topic.subtopics || []) {
        if (sub.studyState !== 'studied') continue;
        const conf = studyState.normalizeConfidence(sub.studyConfidence);
        if (conf !== 'low') continue;
        found.push({
          lectureTitle: lec.title,
          topicTitle: topic.title,
          subtopicTitle: sub.title
        });
        if (found.length >= maxPerCourse) return found;
      }
    }
  }
  return found;
}

function collectCourseConnections(studyItems) {
  const lines = [];

  for (const lec of studyItems) {
    const thread = lec.courseThread;
    if (thread?.summary?.trim()) {
      lines.push(`[${lec.title}] thread: ${thread.summary.trim().slice(0, 200)}`);
      if (thread.continuesFrom?.trim()) lines.push(`  ← continues from: ${thread.continuesFrom.trim().slice(0, 120)}`);
      if (thread.leadsTo?.trim()) lines.push(`  → leads to: ${thread.leadsTo.trim().slice(0, 120)}`);
    }

    const summary = (lec.lectureSummary || lec.summary || '').trim();
    if (summary) lines.push(`[${lec.title}] lecture summary: ${summary.slice(0, 180)}`);

    for (const topic of lec.topics || []) {
      const c = topic.connections || {};
      const hasConn = c.buildsOn?.length || c.continuesIn?.length || c.relatedInCourse?.length;
      if (!hasConn) continue;

      const parts = [];
      if (c.buildsOn?.length) parts.push(`builds on: ${c.buildsOn.join(', ')}`);
      if (c.continuesIn?.length) parts.push(`continues in: ${c.continuesIn.join(', ')}`);
      if (c.relatedInCourse?.length) parts.push(`related: ${c.relatedInCourse.join(', ')}`);
      lines.push(`  ${lec.title} → ${topic.title}: ${parts.join(' | ')}`);
    }
  }

  return lines.slice(0, MAX_CONNECTION_LINES);
}

function formatExerciseBlock(lecture) {
  exerciseSheets.normalizeLectureExercises(lecture);
  const sheets = exerciseSheets.getExerciseSheets(lecture);
  if (!sheets.length) return [];

  const lines = [];
  for (const sheet of sheets) {
    const topics = sheet.topics || [];
    const studied = topics.filter((t) => studyState.isTopicStudied(t)).length;
    const open = topics
      .filter((t) => !studyState.isTopicStudied(t))
      .map((t) => {
        const focus = t.practiceFocus ? ` (${t.practiceFocus.slice(0, 60)})` : '';
        return `${t.title}${focus}`;
      })
      .slice(0, 5);

    lines.push(`    Übung "${sheet.label}": ${studied}/${topics.length} done`);
    if (sheet.exerciseSummary?.trim()) {
      lines.push(`      exam/practice style: ${sheet.exerciseSummary.trim().slice(0, 160)}`);
    }
    if (open.length) lines.push(`      open: ${open.join('; ')}`);
  }
  return lines;
}

function formatStudyItemBlock(lec) {
  const progress = lectureProgress(lec);
  const type = lec.itemType === 'promoted' ? 'study-unit' : 'lecture';
  const lines = [
    `  ${lec.title} (${type}) · ${progress.percent}% · ${progress.topicsStudied}/${progress.topicsTotal} topics`
  ];

  const summary = (lec.lectureSummary || lec.summary || '').trim();
  if (summary) lines.push(`    Lecture scope: ${summary.slice(0, 200)}`);

  const sortedTopics = [...(lec.topics || [])].sort(
    (a, b) => topicMaterialWeight(b) - topicMaterialWeight(a)
  );

  if (sortedTopics.length) {
    lines.push('    Topics (sorted by material depth, highest first):');
    lines.push(...sortedTopics.slice(0, MAX_TOPICS_PER_ITEM).map((t) => formatTopicCompact(t)));
  }

  const exerciseLines = formatExerciseBlock(lec);
  if (exerciseLines.length) {
    lines.push('    Übungen:');
    lines.push(...exerciseLines);
  }

  return lines.join('\n');
}

function formatExamDays(days) {
  if (days == null) return 'not set';
  if (days < 0) return `${Math.abs(days)}d ago`;
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days}d`;
}

function formatNextStep(step) {
  if (!step) return 'none';
  const parts = [step.lectureTitle];
  if (step.topicTitle) parts.push(step.topicTitle);
  if (step.subtopicTitle) parts.push(step.subtopicTitle);
  return parts.join(' → ');
}

function buildCourseSnapshotBlock({ course, card, vaultPath, materialRank, allMaterialHeavy }) {
  const studyItems = getStudyItemsForCourse(vaultPath, course.storageKey);
  const material = analyzeCourseMaterial(studyItems);
  const connections = collectCourseConnections(studyItems);
  const unfinishedFoundations = collectUnfinishedFoundations(studyItems);
  const lowConfidence = collectLowConfidenceSubtopics(studyItems);
  const courseHeavy = allMaterialHeavy.filter((h) => h.courseName === card.name);

  const lines = [
    `Course: ${card.name} (material demand rank #${materialRank}, score ${material.demandScore})`,
    `Progress: ${card.percent}% (${card.topicsStudied}/${card.topicsTotal} topics studied)`,
    `Structure: ${material.topicCount} topics, ${material.subtopicCount} subtopics (${material.subtopicCount && material.topicCount ? (material.subtopicCount / material.topicCount).toFixed(1) : 0} subs/topic avg)`,
    `Depth mix: ${material.examHeavy} exam-heavy, ${material.highFocus} high-focus, ${material.foundation} foundation, ${material.core} core topics`,
    `Relative grasp workload: ${material.graspEstimate}`,
    `Likely exam character (from topic depth + Übungen): ${material.examCharacter}`,
    material.exerciseTopics > 0
      ? `Übungen: ${material.exerciseTopics} exercise topics imported (${material.exerciseExamHeavy} with practice/application focus)`
      : 'Übungen: none imported',
    `Exam date: ${formatExamDays(card.daysUntilExam)}${card.studyMeta?.examDate ? ` (${card.studyMeta.examDate})` : ''}`,
    `Next open step: ${formatNextStep(card.nextStep)}`
  ];

  if (material.heaviest.length) {
    lines.push('Heaviest topics by structure (importance + depth + subtopic count):');
    for (const h of material.heaviest.slice(0, 6)) {
      const gist = h.gist ? ` — ${h.gist}` : '';
      lines.push(
        `  - ${h.lectureTitle} → ${h.topicTitle} (burden ${h.weight}, ${h.importance || '?'}, ${h.studyDepth || '?'}, ${h.subtopicCount} subs, ${h.status})${gist}`
      );
    }
  }

  if (unfinishedFoundations.length) {
    lines.push('Unfinished foundation topics (block later material):');
    for (const f of unfinishedFoundations) lines.push(`  - ${f}`);
  }

  if (connections.length) {
    lines.push('Connections & sequence in course:');
    lines.push(...connections);
  }

  lines.push('Study items:');
  for (const lec of studyItems) {
    lines.push(formatStudyItemBlock(lec));
  }

  if (lowConfidence.length) {
    lines.push('Topics marked not-solid after studying (behavioral, not settings):');
    for (const s of lowConfidence) {
      lines.push(`  - ${s.lectureTitle} → ${s.topicTitle} → ${s.subtopicTitle}`);
    }
  }

  return lines.join('\n');
}

function buildDashboardAiContext(store) {
  const overview = buildDashboardOverview(store);
  const vaultPath = store.get('vaultPath');
  const courses = coursesApi.listOrderedCourses(store);

  if (!courses.length) {
    return {
      snapshot:
        'No courses in the vault yet. The student has not imported any lectures or set up course metadata.',
      topPick: null,
      generatedAt: overview.generatedAt
    };
  }

  const courseById = new Map(courses.map((c) => [c.id, c]));
  const materialProfiles = [];

  for (const card of overview.courseCards || []) {
    const course = courseById.get(card.id);
    if (!course) continue;
    const studyItems = getStudyItemsForCourse(vaultPath, course.storageKey);
    const material = analyzeCourseMaterial(studyItems);
    materialProfiles.push({ card, course, material, studyItems });
  }

  materialProfiles.sort((a, b) => b.material.demandScore - a.material.demandScore);

  const allMaterialHeavy = [];
  for (const { card, material } of materialProfiles) {
    for (const h of material.heaviest) {
      allMaterialHeavy.push({
        courseName: card.name,
        ...h,
        reasons: `${h.importance || 'topic'}, ${h.studyDepth || 'depth'}, ${h.subtopicCount} subs, burden ${h.weight}`
      });
    }
  }
  allMaterialHeavy.sort((a, b) => b.weight - a.weight);

  const blocks = [`Snapshot generated: ${overview.generatedAt}`, ''];

  blocks.push('COURSE COMPARISON BY MATERIAL (NOT user settings — from lecture/topic structure):');
  for (let i = 0; i < materialProfiles.length; i += 1) {
    const { card, material } = materialProfiles[i];
    blocks.push(
      `  #${i + 1} ${card.name}: demand ${material.demandScore}, ${material.topicCount} topics, ${material.examHeavy} exam-heavy, grasp=${material.graspEstimate}, exam style=${material.examCharacter}`
    );
  }
  blocks.push('');

  if (allMaterialHeavy.length) {
    blocks.push('DEEPEST TOPICS ACROSS ALL COURSES (structural burden):');
    for (const h of allMaterialHeavy.slice(0, MAX_MATERIAL_HEAVY)) {
      const gist = h.gist ? ` — ${h.gist}` : '';
      blocks.push(`  - [${h.courseName}] ${h.lectureTitle} → ${h.topicTitle} (${h.reasons})${gist}`);
    }
    blocks.push('');
  }

  if (overview.topPick) {
    const t = overview.topPick;
    blocks.push('Suggested next open step (sequence only):');
    blocks.push(`  ${t.courseName} → ${t.lectureTitle}${t.topicTitle ? ` → ${t.topicTitle}` : ''}`);
    blocks.push('');
  }

  blocks.push('FULL COURSE DETAIL:');
  blocks.push('');

  materialProfiles.forEach(({ card, course, material }, index) => {
    blocks.push(
      buildCourseSnapshotBlock({
        course,
        card,
        vaultPath,
        materialRank: index + 1,
        allMaterialHeavy
      })
    );
    blocks.push('');
  });

  return {
    snapshot: blocks.join('\n').trim(),
    topPick: overview.topPick || null,
    generatedAt: overview.generatedAt
  };
}

function buildDashboardChatSystem(language = 'German') {
  return `You are a study analyst on the student's Course Dashboard.
Answer in ${language}. Use ONLY the STUDY SNAPSHOT.

CRITICAL — do NOT use these for comparisons (they are intentionally excluded or de-emphasized):
- Personal difficulty ratings (1–5)
- "Student struggles with" / self-reported weaknesses
- Priority scores from settings
- Phrases like "you rated this as hard" or "you said math is your enemy"

Instead, compare courses and topics using MATERIAL EVIDENCE from the snapshot:
- COURSE COMPARISON BY MATERIAL (demand score, exam-heavy count, subtopic density)
- Heaviest topics by structure (grasp-burden, importance, studyDepth, subtopic count)
- Topic gists (what the lecture actually covers)
- Likely exam character derived from exam-heavy topics and Übung focus
- Foundation chains and connections (builds on / feeds / lecture threads)
- Relative grasp workload estimates
- Behavioral gaps ONLY when the student marked subtopics "not solid" after studying — mention as secondary, not as proof of course difficulty

For "hardest course":
- Rank using material demand score and depth mix across courses
- Explain WHY in terms of topic count, exam-heavy density, foundation chains, and what exams likely test
- Name 2–4 specific heaviest topics with what makes them deep (many subs, exam-heavy, core+procedural)

For "hard topics to grasp":
- Use grasp-burden scores and heaviest-topic lists
- Estimate time/effort qualitatively (e.g. "many subtopics + exam-heavy = multi-session topic") from structure, not feelings

For "how might the exam look":
- Infer from exam character lines, exam-heavy topics, Übung practice style, practiceFocus fields
- Mention procedural vs conceptual vs mixed based on snapshot only

For connections:
- Use builds on / feeds / lecture thread / continues from / leads to

Keep answers specific: name topics and lectures. 6–12 sentences or short bullets. No generic study advice.`;
}

function buildDashboardUserMessage({ snapshot, question }) {
  return `STUDY SNAPSHOT:\n${snapshot}\n\n---\n\nStudent question:\n${String(question || '').trim()}`;
}

function normalizeHistory(history) {
  return Array.isArray(history)
    ? history
        .filter((h) => h?.role && h?.content)
        .slice(-6)
        .map((h) => ({
          role: h.role === 'assistant' ? 'assistant' : 'user',
          content: String(h.content).slice(0, 4000)
        }))
    : [];
}

async function askDashboard({ openai, model, store, question, history, language = 'German' }) {
  const q = String(question || '').trim();
  if (!q) return { success: false, error: 'Missing question' };

  const { snapshot, topPick, generatedAt } = buildDashboardAiContext(store);
  const system = buildDashboardChatSystem(language);
  const userMessage = buildDashboardUserMessage({ snapshot, question: q });

  const prior = normalizeHistory(history);
  const messages = [{ role: 'system', content: system }, ...prior, { role: 'user', content: userMessage }];

  const response = await openai.chat.completions.create({
    model,
    messages,
    temperature: 0.2,
    max_tokens: 1100
  });

  const answer = (response.choices?.[0]?.message?.content || '').trim();
  if (!answer) return { success: false, error: 'Empty answer' };

  return {
    success: true,
    answer,
    topPick,
    generatedAt
  };
}

module.exports = {
  buildDashboardAiContext,
  buildDashboardChatSystem,
  buildDashboardUserMessage,
  analyzeCourseMaterial,
  topicMaterialWeight,
  collectLowConfidenceSubtopics,
  collectCourseConnections,
  askDashboard
};
