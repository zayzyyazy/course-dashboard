/** Compose a weekly-friendly rewind markdown from existing lecture data. */

function firstSentence(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  const match = t.match(/^[^.!?]+[.!?]/);
  return match ? match[0].trim() : t.slice(0, 160);
}

function firstNSentences(text, n = 2) {
  const t = String(text || '').trim();
  if (!t) return '';
  const sentences = t.match(/[^.!?]+[.!?]+/g);
  if (!sentences?.length) return t.slice(0, 280);
  return sentences
    .slice(0, n)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripMarkdownInline(md) {
  return String(md || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[#*_>\[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractCardTakeaway(markdown, maxLen = 280) {
  const raw = String(markdown || '').trim();
  if (!raw) return '';

  const bullet = raw.match(/^[-*•]\s+(.+)$/m);
  if (bullet?.[1]) {
    const line = stripMarkdownInline(bullet[1]);
    if (line.length >= 20) return line.slice(0, maxLen) + (line.length > maxLen ? '…' : '');
  }

  const plain = stripMarkdownInline(raw);
  const sentences = plain.match(/[^.!?]+[.!?]+/g);
  if (sentences?.length) {
    let out = '';
    for (const s of sentences) {
      if ((out + s).length > maxLen) break;
      out += s;
      if (out.length >= 80) break;
    }
    out = out.trim();
    if (out.length >= 40) return out.slice(0, maxLen) + (out.length > maxLen ? '…' : '');
  }

  return plain.slice(0, maxLen) + (plain.length > maxLen ? '…' : '');
}

function importanceLabel(importance) {
  const map = {
    core: 'Core',
    supporting: 'Supporting',
    foundation: 'Foundation'
  };
  return map[importance] || importance || 'Core';
}

function topicTakeaway(topic) {
  if (topic?.card?.deepMarkdown) {
    const deep = extractCardTakeaway(topic.card.deepMarkdown, 320);
    if (deep.length >= 40) return deep;
  }
  if (topic?.card?.markdown) {
    const card = extractCardTakeaway(topic.card.markdown, 280);
    if (card.length >= 40) return card;
  }
  const subs = topic?.subtopics || [];
  const withSummary = subs.find((s) => s.summary?.trim());
  if (withSummary) return extractCardTakeaway(withSummary.summary, 220);
  if (subs.length) return `Covers: ${subs.map((s) => s.title).join(', ')}.`;
  return '';
}

function composeRewindFromLecture(lecture, options = {}) {
  const summary = String(lecture?.lectureSummary || lecture?.summary || '').trim();
  const topics = lecture?.topics || [];
  const parts = [];

  parts.push('## What this lecture is about\n');
  parts.push(firstNSentences(summary, 2) || '_No summary yet._');

  if (topics.length) {
    parts.push('\n## Topics to recall\n');
    for (const topic of topics) {
      parts.push(`### ${topic.title} *(${importanceLabel(topic.importance)})*`);
      const subs = topic?.subtopics || [];
      if (subs.length) {
        parts.push('');
        for (const sub of subs) {
          parts.push(`- ${sub.title}`);
        }
      }
      const takeaway = topicTakeaway(topic);
      if (takeaway) {
        parts.push('');
        parts.push(`**Remember:** ${takeaway}`);
      }
      parts.push('');
    }
  }

  const ct = lecture?.courseThread;
  if (ct?.summary?.trim()) {
    parts.push('## Where this fits\n');
    parts.push(firstNSentences(ct.summary, 2));
    if (ct.continuesFrom?.trim() || ct.leadsTo?.trim()) {
      parts.push('');
      if (ct.continuesFrom?.trim()) parts.push(`- **Builds on:** ${ct.continuesFrom.trim()}`);
      if (ct.leadsTo?.trim()) parts.push(`- **Prepares:** ${ct.leadsTo.trim()}`);
    }
    parts.push('');
  }

  if (options.includeFooter !== false) {
    const lastOpened = lecture?.studyState?.lastOpenedAt;
    if (lastOpened) {
      const d = new Date(lastOpened);
      if (!Number.isNaN(d.getTime())) {
        parts.push('---\n');
        parts.push(`*Last studied: ${d.toLocaleDateString()}*`);
      }
    }
  }

  return parts.join('\n').trim();
}

function getRewindMarkdown(lecture) {
  const ai = String(lecture?.rewind?.markdown || '').trim();
  if (ai) return { markdown: ai, source: 'ai' };
  return { markdown: composeRewindFromLecture(lecture), source: 'composed' };
}

module.exports = {
  composeRewindFromLecture,
  getRewindMarkdown,
  firstSentence,
  firstNSentences,
  topicTakeaway,
  extractCardTakeaway,
  importanceLabel
};
