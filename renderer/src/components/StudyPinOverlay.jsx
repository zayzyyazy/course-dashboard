import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useStudyPins } from '../state/studyPins.jsx';
import HighlightPreviewText from './HighlightPreviewText';

const BASE_WIDTH = 380;
const BASE_HEIGHT = 180;
const HEADER_HEIGHT = 44;

/** Scale body text with card size (bigger card → bigger type). */
export function studyPinTextScale(pin) {
  const w = pin.width ?? BASE_WIDTH;
  const h = pin.collapsed ? BASE_HEIGHT : Math.max(100, pin.height ?? BASE_HEIGHT);
  const contentH = Math.max(56, h - HEADER_HEIGHT);
  const scaleW = w / BASE_WIDTH;
  const scaleH = contentH / (BASE_HEIGHT - HEADER_HEIGHT);
  return Math.min(2.35, Math.max(0.68, Math.sqrt(scaleW * scaleH)));
}

function FloatingStudyPinCard({ pin, onUpdate, onRemove, onFocus }) {
  const cardRef = useRef(null);
  const dragRef = useRef(null);
  const resizeRef = useRef(null);

  const startDrag = useCallback(
    (e) => {
      e.preventDefault();
      onFocus(pin.id);
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: pin.x,
        origY: pin.y
      };
    },
    [pin.id, pin.x, pin.y, onFocus]
  );

  const startResize = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      onFocus(pin.id);
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origW: pin.width,
        origH: pin.height
      };
    },
    [pin.id, pin.width, pin.height, onFocus]
  );

  useEffect(() => {
    function onMove(e) {
      if (dragRef.current) {
        const d = dragRef.current;
        onUpdate(pin.id, {
          x: Math.max(8, d.origX + (e.clientX - d.startX)),
          y: Math.max(8, d.origY + (e.clientY - d.startY))
        });
      }
      if (resizeRef.current) {
        const r = resizeRef.current;
        onUpdate(pin.id, {
          width: Math.max(220, r.origW + (e.clientX - r.startX)),
          height: Math.max(100, r.origH + (e.clientY - r.startY))
        });
      }
    }
    function onUp() {
      dragRef.current = null;
      resizeRef.current = null;
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [pin.id, onUpdate]);

  const textScale = useMemo(() => studyPinTextScale(pin), [pin.width, pin.height, pin.collapsed]);
  const bodyFontPx = Math.round(15 * textScale);
  const headerFontPx = Math.round(10 * textScale);
  const contentPad = Math.round(12 * textScale);

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label="Pinned study card"
      className="pointer-events-auto fixed flex flex-col rounded-xl border border-accent/35 bg-bg-secondary/95 shadow-2xl backdrop-blur-sm overflow-hidden"
      style={{
        left: pin.x,
        top: pin.y,
        width: pin.width,
        height: pin.collapsed ? 'auto' : pin.height,
        zIndex: pin.zIndex || 1000
      }}
      onMouseDown={() => onFocus(pin.id)}
    >
      <div
        className="flex items-center gap-2 px-2.5 py-1.5 border-b border-border-subtle bg-bg-primary/60 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={startDrag}
      >
        <span className="text-[10px] text-text-muted flex-shrink-0">⋮⋮</span>
        <div className="min-w-0 flex-1" style={{ fontSize: headerFontPx }}>
          <p className="text-accent/90 uppercase tracking-wide truncate leading-tight">
            {pin.kind || 'Text'}
          </p>
          <p className="text-text-muted truncate leading-tight" title={pin.sourceTitle}>
            {pin.sourceTitle}
          </p>
        </div>
        <button
          type="button"
          className="px-1.5 py-0.5 rounded text-text-muted hover:text-accent"
          style={{ fontSize: headerFontPx }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => onUpdate(pin.id, { collapsed: !pin.collapsed })}
          title={pin.collapsed ? 'Expand' : 'Collapse'}
        >
          {pin.collapsed ? '▢' : '−'}
        </button>
        <button
          type="button"
          className="px-1.5 py-0.5 rounded text-text-muted hover:text-red-400"
          style={{ fontSize: headerFontPx }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => onRemove(pin.id)}
          title="Close"
        >
          ✕
        </button>
      </div>

      {!pin.collapsed && (
        <div
          className="study-pin-card-content relative flex-1 min-h-0 overflow-auto prose-note text-text-primary"
          style={{
            fontSize: bodyFontPx,
            padding: contentPad
          }}
        >
          <HighlightPreviewText text={pin.text} className="study-pin-markdown" />
          <div
            role="presentation"
            className="absolute right-0 bottom-0 w-4 h-4 cursor-nwse-resize opacity-40 hover:opacity-100"
            style={{
              background:
                'linear-gradient(135deg, transparent 50%, rgba(139,92,246,0.5) 50%)'
            }}
            onMouseDown={startResize}
          />
        </div>
      )}
    </div>
  );
}

export default function StudyPinOverlay() {
  const { pins, updatePin, removePin, bringToFront } = useStudyPins();

  if (!pins.length) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[200]"
      aria-live="polite"
    >
      {pins.map((pin) => (
        <FloatingStudyPinCard
          key={pin.id}
          pin={pin}
          onUpdate={updatePin}
          onRemove={removePin}
          onFocus={bringToFront}
        />
      ))}
    </div>
  );
}
