const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

function findEpcRoot() {
  const home = os.homedir();
  const candidates = [
    path.join(home, 'Desktop/Dev Projects/LLM projects/exam_practice/exam_practice_app'),
    path.join(home, 'Desktop/LLM projects/exam_practice/exam_practice_app'),
    path.join(home, 'Desktop/Exam Practice Coach')
  ];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, 'start.sh'))) return root;
    if (fs.existsSync(path.join(root, 'api_server.py'))) return root;
  }
  return null;
}

function findEpcApp() {
  const app = path.join(os.homedir(), 'Desktop/Exam Practice Coach.app');
  return fs.existsSync(app) ? app : null;
}

function findLaunchCommand(epcRoot) {
  const desktopCmd = path.join(os.homedir(), 'Desktop/Launch Exam Practice Coach.command');
  if (fs.existsSync(desktopCmd)) return desktopCmd;
  const app = findEpcApp();
  if (app) return app;
  const startSh = path.join(epcRoot, 'start.sh');
  if (fs.existsSync(startSh)) return startSh;
  return null;
}

function checkUrl(url, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function postPending(payload) {
  return new Promise((resolve) => {
    const body = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 8765,
        path: '/api/pending-deeplink',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      },
      (res) => {
        res.resume();
        resolve(res.statusCode >= 200 && res.statusCode < 300);
      }
    );
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
    req.write(body);
    req.end();
  });
}

function writePendingFile(epcRoot, payload) {
  const filePath = path.join(epcRoot, 'data', 'pending_deeplink.json');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload), 'utf8');
}

function launchCoach(launcher) {
  if (launcher.endsWith('.app')) {
    spawn('open', ['-a', launcher], { detached: true, stdio: 'ignore' }).unref();
    return;
  }
  if (launcher.endsWith('.command')) {
    spawn('open', [launcher], { detached: true, stdio: 'ignore' }).unref();
    return;
  }
  spawn('/bin/bash', [launcher], {
    cwd: path.dirname(launcher),
    detached: true,
    stdio: 'ignore'
  }).unref();
}

async function openExerciseCoach(payload = {}) {
  const epcRoot = findEpcRoot();
  if (!epcRoot) {
    return {
      success: false,
      error: 'Exam Practice Coach not found on Desktop'
    };
  }

  const pending = {
    vault: String(payload.vault || ''),
    unit: String(payload.unit || ''),
    topic: String(payload.topic || ''),
    subtopic: String(payload.subtopic || ''),
    exercise: String(payload.exercise || ''),
    mode: String(payload.mode || 'lecture')
  };

  writePendingFile(epcRoot, pending);
  await postPending(pending);

  const apiUp = await checkUrl('http://127.0.0.1:8765/api/health');
  const launcher = findLaunchCommand(epcRoot);

  if (!apiUp) {
    if (!launcher) {
      return { success: false, error: 'Could not launch Exercise Coach' };
    }
    launchCoach(launcher);
    return {
      success: true,
      started: true,
      message: 'Starting Exercise Coach — your topic will load automatically'
    };
  }

  if (launcher) {
    launchCoach(launcher);
  } else {
    spawn(
      'osascript',
      ['-e', 'tell application "Exam Practice Coach" to activate'],
      { detached: true, stdio: 'ignore' }
    ).unref();
  }

  return {
    success: true,
    started: false,
    message: 'Opened in Exercise Coach'
  };
}

module.exports = { openExerciseCoach };
