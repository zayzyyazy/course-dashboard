const fs = require('fs');
const { referenceFilePath } = require('./lectureReferences');

function mimeForFile(filePath) {
  const ext = require('path').extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/png';
}

function buildReferenceContextBlock({ lecture, item, language }) {
  const lines = [`Lecture: ${lecture?.title || 'Lecture'}`];
  if (lecture?.lectureSummary) {
    lines.push(`Lecture summary:\n${String(lecture.lectureSummary).slice(0, 1500)}`);
  }
  lines.push(`Reference type: ${item.type}`);
  if (item.title) lines.push(`Title: ${item.title}`);
  if (item.description) lines.push(`Caption: ${item.description}`);
  if (item.type === 'link') lines.push(`URL: ${item.url}`);
  if (item.type === 'text') lines.push(`Text:\n${String(item.body || '').slice(0, 6000)}`);
  lines.push(`Respond in ${language}.`);
  return lines.join('\n\n');
}

async function askAboutReference({ openai, model, lecture, item, question, history, language = 'German' }) {
  const q = String(question || '').trim();
  if (!q) return { success: false, error: 'Missing question' };
  if (!item) return { success: false, error: 'Missing reference' };

  const system = `You help a university student study lecture reference material they saved (screenshots, pasted notes, links).
Answer in ${language}. Be practical and exam-focused.
Ground answers in the reference content provided — do not invent facts not supported by the reference or lecture context.`;

  const contextBlock = buildReferenceContextBlock({ lecture, item, language });
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

  if (item.type === 'image') {
    const fp = referenceFilePath(item.lecturePath || lecture?.path, item.fileName);
    if (!fp || !fs.existsSync(fp)) {
      return { success: false, error: 'Image file not found' };
    }
    const buf = fs.readFileSync(fp);
    const mime = mimeForFile(fp);
    const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
    const visionModel = model.includes('gpt-4') ? model : 'gpt-4o-mini';

    if (prior.length === 0) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: `[REFERENCE CONTEXT]\n${contextBlock}\n\n[QUESTION]\n${q}` },
          { type: 'image_url', image_url: { url: dataUrl } }
        ]
      });
    } else {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: `[REFERENCE CONTEXT]\n${contextBlock}` },
          { type: 'image_url', image_url: { url: dataUrl } }
        ]
      });
      messages.push(...prior);
      messages.push({ role: 'user', content: q });
    }

    const response = await openai.chat.completions.create({
      model: visionModel,
      messages,
      temperature: 0.35,
      max_tokens: 900
    });
    const answer = (response.choices?.[0]?.message?.content || '').trim();
    if (!answer) return { success: false, error: 'Empty response' };
    return { success: true, answer };
  }

  if (prior.length === 0) {
    messages.push({
      role: 'user',
      content: `[REFERENCE CONTEXT]\n${contextBlock}\n\n[QUESTION]\n${q}`
    });
  } else {
    messages.push({ role: 'user', content: `[REFERENCE CONTEXT]\n${contextBlock}` });
    messages.push(...prior);
    messages.push({ role: 'user', content: q });
  }

  const response = await openai.chat.completions.create({
    model,
    messages,
    temperature: 0.35,
    max_tokens: 900
  });
  const answer = (response.choices?.[0]?.message?.content || '').trim();
  if (!answer) return { success: false, error: 'Empty response' };
  return { success: true, answer };
}

module.exports = { askAboutReference };
