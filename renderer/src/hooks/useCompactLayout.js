import { useEffect, useState } from 'react';

/** Viewport is narrow enough for half-screen / tiled window use. */
export const COMPACT_BREAKPOINT = 880;

export function useCompactLayout() {
  const [compact, setCompact] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < COMPACT_BREAKPOINT
  );

  useEffect(() => {
    function onResize() {
      setCompact(window.innerWidth < COMPACT_BREAKPOINT);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return compact;
}
