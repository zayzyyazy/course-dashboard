---
name: course-dashboard
description: Course Dashboard Electron app — vault, IPC, study LLM pipelines. Use only when editing Course_Dashboard.
disable-model-invocation: true
---

# Course Dashboard

**Scope:** This repo only. Do not load unless working here.

## Boundaries

- `renderer/` → UI only; use `window.api` (see `main/preload.js`)
- `main/` → vault, IPC, OpenAI (`*Llm.js` per pipeline stage)
- `shared/*.cjs` → pure functions for main + tests

## Vault

Course → Lecture → `structure.json`, `extracted.txt`, notes. See `main/vault.js`.

## LLM files (one stage = one file)

`lectureStructureLlm.js`, `exerciseStructureLlm.js`, `exerciseLinksLlm.js`, `expandContent.js`, `noteChat.js`, `promoteUnitLlm.js`

## Domain

Lecture / Übung / Topic / Subtopic / pins / KaTeX. Answers match lecture language (DE/EN).
