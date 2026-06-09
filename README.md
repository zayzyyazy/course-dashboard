# Course Dashboard

Local-first macOS desktop app for university study: import lecture PDFs, get AI-generated topic cards, track progress, save notes, and practice with linked Übung sheets.

**Hierarchy:** Course → Lectures / Study units → Topics → Subtopics → Notes & Tutor

Built with Electron, React, and the OpenAI API. All course data stays on your machine in a local vault.

## What it does

### Import & structure
- Import **lecture PDFs** — AI extracts topics, subtopics, and tutor-style summary cards
- **Course settings** — per-course AI profile (strength, exam style, focus, difficulty, exam date, ECTS)
- **Promote topic → study unit** — turn a heavy lecture topic into its own mini-unit with a finer breakdown

### Lecture ↔ Übung (exercise sheets)
- Attach **one or more exercise PDFs** per lecture (Übung 1, Übung 2, …)
- Switch between **Lecture** and **Exercise** material on the same lecture
- Exercise pipeline focuses on **problem types and procedures**, not re-summarizing the lecture
- **Lecture ↔ Übung links** on subtopics jump to related practice material

### Study progress
- Mark **topics** and **subtopics** as studied
- **Subtopic confidence** after marking studied (lecture mode)
- **Progress bar** and **study map** per lecture
- **Study depth badges** on topics

### AI tutor & deeper content
- **Ask tutor** on lectures and topics
- **Ask about saved notes** and **Ask AI on highlighted text**
- **Go deeper** on topics and subtopics (cached expansions)
- **Regenerate** deeper content with feedback chips (German, shorter, more detail, etc.) and optional notes
- **Language-aware AI** — answers follow lecture/topic language (German/English), not raw PDF extraction alone
- **KaTeX math** in titles and markdown

### Highlights & notes
- Select text → **Save note**, **Pin to screen**, or **Ask AI**
- **Auto-save** and **AI refine** for highlight notes
- **Note study view** — read, chat, append tutor answers into the note
- **Notes list** — filter by topic, drag reorder, Alt+drag merge
- **Rebuild note metadata** — re-title/repair notes with AI
- Clean highlight text and readable plain-text previews

### Dashboard & pins
- **Home dashboard** — pinned shortcuts, best next step, per-course next step, exam countdown
- **Persistent pins** on lectures, topics, subtopics, and notes (dashboard shortcuts)
- **Pin to screen** — session-only floating sticky cards over content

## Install

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Set your OpenAI API key in **Settings**. The key is stored locally (Electron Store) and is never committed.

## Build desktop app

```bash
npm run build
```

Packaged output goes to `dist-app/`. To copy a fresh build to your Desktop:

```bash
npm run deploy:desktop
```

Do not commit packaged apps, DMGs, zips, or build artifacts.

## Local data

Default vault: `~/Documents/CourseDashboard` (change in **Settings**).

The vault holds source PDFs, extracted text, generated topic cards, notes, pins, and course settings. It is intentionally excluded from Git.

## After cloning

1. Run `npm install`
2. Run `npm run dev`
3. Add your OpenAI API key in Settings
4. Import a lecture PDF or point Settings at your vault folder

## Tests

```bash
node scripts/test-exercise-sheets.cjs
node scripts/test-expand-feedback.cjs
node scripts/test-pin-state.cjs
node scripts/test-clean-highlight-text.cjs
node scripts/test-note-title.cjs
node scripts/test-note-routing.cjs
node scripts/test-note-merge.cjs
```

## Tech stack

Electron · React · Vite · Tailwind CSS · OpenAI API · pdf-parse · KaTeX · react-markdown

## Author

**zayzyyazy** — https://github.com/zayzyyazy
