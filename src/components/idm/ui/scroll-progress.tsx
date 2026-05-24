'use client';

import { useEffect, useRef } from 'react';

/* ── Scroll Progress Bar — INP-optimized ──
   Uses direct DOM manipulation (no React re-renders on scroll).
   rAF-throttled: only 1 update per frame.
   GPU-only: scaleX transform — no layout/paint. */
export function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null);
  const tickingRef = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      if (tickingRef.current) return;
      tickingRef.current = true;
      requestAnimationFrame(() => {
        const el = barRef.current;
        if (el) {
          const scrollTop = window.scrollY;
          const docHeight = document.documentElement.scrollHeight - window.innerHeight;
          const progress = docHeight > 0 ? scrollTop / docHeight : 0;
          el.style.transform = `scaleX(${progress})`;
        }
        tickingRef.current = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      ref={barRef}
      className="scroll-progress-bar"
      style={{ transform: 'scaleX(0)' }}
      aria-hidden="true"
    />
  );
}
