import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const StudyPinsContext = createContext(null);

const DEFAULT_WIDTH = 380;
const DEFAULT_HEIGHT = 180;
const MIN_WIDTH = 220;
const MIN_HEIGHT = 100;

function storageKey(lecturePath) {
  return `screenPins:${lecturePath || '__none__'}`;
}

function loadPins(lecturePath) {
  if (!lecturePath) return [];
  try {
    const raw = localStorage.getItem(storageKey(lecturePath));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePins(lecturePath, pins) {
  if (!lecturePath) return;
  try {
    localStorage.setItem(storageKey(lecturePath), JSON.stringify(pins));
  } catch {
    /* quota / private mode */
  }
}

function inferPinKind(text) {
  const t = String(text || '');
  if (/[$\\]|η|SS_|∪|∩|∖|∈|∀|∃|→|≤|≥|≈|≠|\^|_\{/.test(t)) return 'Formula';
  if (/definition|definiert|bedeutet|ist definiert als/i.test(t)) return 'Definition';
  return 'Text';
}

function buildSourceTitle(source = {}) {
  const parts = [source.lectureTitle, source.topicTitle, source.subtopicTitle].filter(Boolean);
  return parts.join(' · ') || source.lecturePath || 'Study';
}

export function StudyPinsProvider({ activeLecturePath = '', children }) {
  const [pins, setPins] = useState([]);

  useEffect(() => {
    setPins(loadPins(activeLecturePath));
  }, [activeLecturePath]);

  useEffect(() => {
    if (activeLecturePath) savePins(activeLecturePath, pins);
  }, [activeLecturePath, pins]);

  const addPin = useCallback(
    (payload) => {
      const text = String(payload.text || '').trim();
      if (!text || !activeLecturePath) return null;

      const id = `sp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const maxZ = pins.reduce((m, p) => Math.max(m, p.zIndex || 0), 1000);

      const pin = {
        id,
        text: text.slice(0, 8000),
        sourceType: payload.sourceType || 'unknown',
        sourceTitle: buildSourceTitle(payload),
        lecturePath: activeLecturePath,
        kind: inferPinKind(text),
        createdAt: new Date().toISOString(),
        x: 72 + (pins.length % 4) * 36,
        y: 88 + (pins.length % 5) * 32,
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        collapsed: false,
        zIndex: maxZ + 1
      };

      setPins((prev) => [...prev, pin]);
      return pin;
    },
    [activeLecturePath, pins]
  );

  const updatePin = useCallback((id, patch) => {
    setPins((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
    );
  }, []);

  const removePin = useCallback((id) => {
    setPins((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const bringToFront = useCallback((id) => {
    setPins((prev) => {
      const maxZ = prev.reduce((m, p) => Math.max(m, p.zIndex || 0), 1000);
      return prev.map((p) => (p.id === id ? { ...p, zIndex: maxZ + 1 } : p));
    });
  }, []);

  const value = useMemo(
    () => ({
      pins,
      activeLecturePath,
      addPin,
      updatePin,
      removePin,
      bringToFront,
      MIN_WIDTH,
      MIN_HEIGHT
    }),
    [pins, activeLecturePath, addPin, updatePin, removePin, bringToFront]
  );

  return (
    <StudyPinsContext.Provider value={value}>{children}</StudyPinsContext.Provider>
  );
}

export function useStudyPins() {
  const ctx = useContext(StudyPinsContext);
  if (!ctx) {
    throw new Error('useStudyPins must be used within StudyPinsProvider');
  }
  return ctx;
}

export function useStudyPinsOptional() {
  return useContext(StudyPinsContext);
}
