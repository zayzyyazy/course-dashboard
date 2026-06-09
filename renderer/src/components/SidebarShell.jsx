import React, { useEffect } from 'react';

/**
 * Collapsible course sidebar: full width or hidden for study focus.
 * In compact (half-screen) mode, an open sidebar overlays content instead of shrinking it.
 */
export default function SidebarShell({ hidden, onToggle, compact = false, children }) {
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        onToggle?.();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onToggle]);

  const sidebarWidth = compact ? 'w-52' : 'w-56';
  const innerWidth = compact ? 'w-52' : 'w-56';

  const sidebarPanel = (
    <div className={`${innerWidth} flex flex-col h-full flex-shrink-0`}>{children}</div>
  );

  if (compact && !hidden) {
    return (
      <>
        <button
          type="button"
          aria-label="Sidebar schließen"
          className="no-drag fixed inset-0 z-[140] bg-black/40 backdrop-blur-[1px]"
          onClick={onToggle}
        />
        <aside
          className={`fixed left-0 top-0 bottom-0 z-[145] ${sidebarWidth} bg-bg-secondary border-r border-border-DEFAULT shadow-2xl flex flex-col overflow-hidden`}
        >
          {sidebarPanel}
          <button
            type="button"
            onClick={onToggle}
            className="no-drag absolute -right-3 top-14 z-30 w-6 h-14 rounded-r-md border border-border-DEFAULT border-l-0 bg-bg-secondary text-text-muted hover:text-accent hover:border-accent/40 shadow-md flex items-center justify-center text-sm"
            title="Sidebar ausblenden (⌘\)"
            aria-label="Sidebar ausblenden"
          >
            ‹
          </button>
        </aside>
      </>
    );
  }

  return (
    <>
      <aside
        className={`relative flex-shrink-0 bg-bg-secondary flex flex-col h-full transition-[width,border-color] duration-200 ease-out overflow-hidden ${
          hidden ? 'w-0 border-r-0' : `${sidebarWidth} border-r border-border-DEFAULT`
        }`}
        aria-hidden={hidden}
      >
        <div
          className={`${innerWidth} flex flex-col h-full flex-shrink-0 ${
            hidden ? 'pointer-events-none opacity-0' : 'opacity-100'
          }`}
        >
          {children}
        </div>
        {!hidden && (
          <button
            type="button"
            onClick={onToggle}
            className="no-drag absolute -right-3 top-14 z-30 w-6 h-14 rounded-r-md border border-border-DEFAULT border-l-0 bg-bg-secondary text-text-muted hover:text-accent hover:border-accent/40 shadow-md flex items-center justify-center text-sm"
            title="Sidebar ausblenden (⌘\)"
            aria-label="Sidebar ausblenden"
          >
            ‹
          </button>
        )}
      </aside>

      {hidden && (
        <button
          type="button"
          onClick={onToggle}
          className="no-drag fixed left-0 top-1/2 -translate-y-1/2 z-[150] flex flex-col items-center gap-0.5 py-3 pl-1 pr-2 rounded-r-lg border border-l-0 border-border-DEFAULT bg-bg-secondary/95 text-text-muted hover:text-accent hover:border-accent/40 shadow-lg backdrop-blur-sm"
          title="Sidebar einblenden (⌘\)"
          aria-label="Sidebar einblenden"
        >
          <span className="text-base leading-none">☰</span>
          <span
            className="text-[9px] uppercase tracking-wide font-medium"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            Kurse
          </span>
        </button>
      )}
    </>
  );
}
