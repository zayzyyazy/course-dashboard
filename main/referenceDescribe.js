const fs = require('fs');
const path = require('path');
const { referenceFilePath } = require('./lectureReferences');

function parseDescribeJson(raw) {
  const text = String(raw || '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function mimeForFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/png';
}

async function describeReference({ openai, model, lecture, item, language = 'German' }) {
  const lectureTitle = lecture?.title || 'Lecture';
  const userHint = item.description ? `Student note: ${item.description}` : '';

  if (item.type === 'link') {
    const system = `You write short study captions for a university student's lecture reference shelf. Respond in ${language} as strict JSON only:
{"title":"short label (2-6 words)","description":"1-2 concise sentences — why this link helps for studying this lecture"}
Rules:
- Practical, exam-oriented tone
- Do not invent page contents you cannot know; focus on likely study value from URL/title
- Max 40 words in description`;
    const user = [
      `Lecture: ${lectureTitle}`,
      `URL: ${item.url}`,
      item.title ? `Current title: ${item.title}` : '',
      userHint,
      lecture?.lectureSummary ? `Lecture summary:\n${String(lecture.lectureSummary).slice(0, 1200)}` : ''
    ]
      .filter(Boolean)
      .join('\n\n');

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
      max_tokens: 220
    });
    const parsed = parseDescribeJson(response.choices?.[0]?.message?.content || '');
    if (!parsed?.description) return { success: false, error: 'Could not generate description' };
    return {
      success: true,
      title: String(parsed.title || item.title || '').trim().slice(0, 120),
      description: String(parsed.description || '').trim().slice(0, 2000)
    };
  }

  if (item.type === 'image') {
    const fp = referenceFilePath(item.lecturePath || lecture?.path, item.fileName);
    if (!fp || !fs.existsSync(fp)) {
      return { success: false, error: 'Image file not found' };
    }
    const buf = fs.readFileSync(fp);
    const mime = mimeForFile(fp);
    const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;

    const system = `You describe study screenshots/images for a university student. Respond in ${language} as strict JSON only:
{"title":"short label (2-6 words)","description":"1-2 concise sentences — what this shows and why it matters for studying"}
Rules:
- Describe visible content faithfully (ChatGPT answers, formulas, slides, diagrams)
- Practical revision tone, max 45 words in description`;
    const userContent = [
      { type: 'text', text: [`Lecture: ${lectureTitle}`, userHint].filter(Boolean).join('\n') },
      { type: 'image_url', image_url: { url: dataUrl } }
    ];

    const visionModel = model.includes('gpt-4') ? model : 'gpt-4o-mini';
    const response = await openai.chat.completions.create({
      model: visionModel,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent }
      ],
      temperature: 0.25,
      response_format: { type: 'json_object' },
      max_tokens: 260
    });
    const parsed = parseDescribeJson(response.choices?.[0]?.message?.content || '');
    if (!parsed?.description) return { success: false, error: 'Could not generate description' };
    return {
      success: true,
      title: String(parsed.title || item.title || '').trim().slice(0, 120),
      description: String(parsed.description || '').trim().slice(0, 2000)
    };
  }

  if (item.type === 'text') {
    const system = `You write short study captions for pasted text notes on a lecture reference shelf. Respond in ${language} as strict JSON only:
{"title":"short label (2-6 words)","description":"1-2 concise sentences — what this note contains and why it helps studying"}
Rules:
- Practical, exam-oriented tone
- Faithful to the pasted text; do not invent facts
- Max 45 words in description`;
    const user = [
      `Lecture: ${lectureTitle}`,
      `Pasted text:\n${String(item.body || '').slice(0, 3500)}`,
      userHint,
      lecture?.lectureSummary ? `Lecture summary:\n${String(lecture.lectureSummary).slice(0, 1200)}` : ''
    ]
      .filter(Boolean)
      .join('\n\n');

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
      max_tokens: 220
    });
    const parsed = parseDescribeJson(response.choices?.[0]?.message?.content || '');
    if (!parsed?.description) return { success: false, error: 'Could not generate description' };
    return {
      success: true,
      title: String(parsed.title || item.title || '').trim().slice(0, 120),
      description: String(parsed.description || '').trim().slice(0, 2000)
    };
  }

  return { success: false, error: 'Unknown reference type' };
}

async function classifyReferenceText({ openai, model, lecture, rawText, language = 'German' }) {
  const text = String(rawText || '').trim().slice(0, 8000);
  if (!text) return { success: false, error: 'Text is empty' };

  const lectureTitle = lecture?.title || 'Lecture';
  const system = `You organize pasted study material for a university student's lecture reference shelf. Respond in ${language} as strict JSON only:
{"items":[{"type":"link"|"text","url":"","title":"","description":"","body":""}]}
Rules:
- Extract every distinct http(s) URL as its own link item (YouTube, articles, docs, ChatGPT share links)
- Put remaining useful prose in one text item (body = cleaned content to keep; may omit duplicate URL lines)
- If the paste is ONLY a URL, return one link item with empty body
- If the paste is ONLY prose with no URLs, return one text item
- title: 2-6 words per item; description: 1-2 sentences on study value for this lecture
- Do not invent URLs or content not in the paste
- Max 5 items; prefer one text + separate links when both exist`;

  const user = [
    `Lecture: ${lectureTitle}`,
    lecture?.lectureSummary ? `Lecture summary:\n${String(lecture.lectureSummary).slice(0, 1500)}` : '',
    `Pasted content:\n${text}`
  ]
    .filter(Boolean)
    .join('\n\n');

  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature: 0.25,
    response_format: { type: 'json_object' },
    max_tokens: 900
  });

  const parsed = parseDescribeJson(response.choices?.[0]?.message?.content || '');
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  if (!items.length) return { success: false, error: 'Could not classify pasted text' };

  const normalized = [];
  for (const raw of items.slice(0, 5)) {
    const type = raw.type === 'link' ? 'link' : 'text';
    if (type === 'link') {
      const url = String(raw.url || '').trim();
      if (!url) continue;
      normalized.push({
        type: 'link',
        url,
        title: String(raw.title || '').trim(),
        description: String(raw.description || '').trim(),
        sourceHint: 'classified'
      });
    } else {
      const body = String(raw.body || text).trim();
      if (!body) continue;
      normalized.push({
        type: 'text',
        body,
        title: String(raw.title || '').trim(),
        description: String(raw.description || '').trim(),
        sourceHint: 'classified'
      });
    }
  }

  if (!normalized.length) return { success: false, error: 'No valid items from classification' };
  return { success: true, items: normalized };
}

module.exports = { describeReference, classifyReferenceText };
