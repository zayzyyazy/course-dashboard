# Course Dashboard

Local-first desktop app: **Course -> Lectures -> Topics -> Tutor study cards**.

## Install

Run these commands from the project root:

    npm install

## Run Locally

    npm run dev

Set your OpenAI API key in **Settings** inside the app. The key is stored locally by Electron Store and is not committed to the repository.

## Build Desktop App

    npm run build

Packaged output is generated in `dist-app/`. Do not commit packaged apps, DMGs, zips, or build artifacts.

## Local Data

By default, imported lectures and generated study data are stored under the current user Documents folder at `CourseDashboard`. You can change the vault folder in **Settings**.

The local vault may contain source PDFs, extracted lecture text, generated topic cards, notes, and course-specific settings. It is intentionally excluded from Git.

## After Cloning

1. Run `npm install`.
2. Run `npm run dev`.
3. Add your OpenAI API key in Settings.
4. Choose or create a local vault folder for your own course data.
