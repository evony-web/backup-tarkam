'use client';

import { useCallback, useRef } from 'react';

/**
 * Tracks mouse position on an element and updates CSS custom properties
 * `--mouse-x` and `--mouse-y` for the premium-glow-hover / cursor-glow-section
 * radial gradient effects.
 *
 * Usage:
 *   const ref = useCursorGlow<HTMLDivElement>();
 *   return <div ref={ref} className="premium-glow-hover">...</div>;
 */
export function useCursorGlow<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<T>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty('--mouse-x', `${x}%`);
    el.style.setProperty('--mouse-y', `${y}%`);
  }, []);

  return { ref, onMouseMove: handleMouseMove };
}
