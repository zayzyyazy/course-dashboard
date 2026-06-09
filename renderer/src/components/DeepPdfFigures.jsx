import React, { useEffect, useState } from 'react';

/** Thumbnail strip for PDF pages used in a “Go deeper” expansion. */
export default function DeepPdfFigures({ lecturePath, figures = [], className = '' }) {
  const [urls, setUrls] = useState({});
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    if (!lecturePath || !figures?.length) {
      setUrls({});
      return;
    }

    let cancelled = false;
    async function load() {
      const next = {};
      for (const fig of figures) {
        if (!fig?.fileName) continue;
        try {
          const res = await window.api.getPageImage({
            lecturePath,
            fileName: fig.fileName
          });
          if (res?.success && res.dataUrl) {
            next[fig.fileName] = res.dataUrl;
          }
        } catch {
          /* skip broken thumbnail */
        }
      }
      if (!cancelled) setUrls(next);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [lecturePath, figures]);

  if (!figures?.length) return null;

  const visible = figures.filter((f) => urls[f.fileName]);
  if (!visible.length) return null;

  return (
    <>
      <div className={`rounded-lg border border-border-subtle bg-bg-primary/40 p-3 ${className}`.trim()}>
        <p className="text-[10px] font-medium text-text-muted uppercase tracking-wide mb-2">
          From your PDF
        </p>
        <div className="flex flex-wrap gap-2">
          {visible.map((fig) => (
            <button
              key={fig.fileName}
              type="button"
              onClick={() => setLightbox(urls[fig.fileName])}
              className="group relative rounded-md overflow-hidden border border-border-DEFAULT hover:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/40"
              title={`Slide page ${fig.page}`}
            >
              <img
                src={urls[fig.fileName]}
                alt={`PDF page ${fig.page}`}
                className="h-20 w-auto max-w-[140px] object-cover object-top bg-white"
              />
              <span className="absolute bottom-0 inset-x-0 bg-black/55 text-[9px] text-white py-0.5 text-center">
                p.{fig.page}
              </span>
            </button>
          ))}
        </div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <img
            src={lightbox}
            alt="PDF slide enlarged"
            className="max-h-[90vh] max-w-full rounded-lg shadow-2xl bg-white"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
