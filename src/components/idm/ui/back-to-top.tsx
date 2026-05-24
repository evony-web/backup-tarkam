'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowUp } from 'lucide-react';

/* ── Back to Top Button — INP-optimized ──
   Uses rAF-throttled scroll listener + ref guard to skip
   no-op React re-renders (only re-renders when show state changes). */
export function BackToTop() {
  const [show, setShow] = useState(false);
  const showRef = useRef(false);
  const tickingRef = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      if (tickingRef.current) return;
      tickingRef.current = true;
      requestAnimationFrame(() => {
        const shouldShow = window.scrollY > 300;
        // Only trigger re-render when value actually changes
        if (showRef.current !== shouldShow) {
          showRef.current = shouldShow;
          setShow(shouldShow);
        }
        tickingRef.current = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <>
      {show && (
        <button
          onClick={scrollToTop}
          aria-label="Scroll to top"
          className="animate-fade-enter-sm fixed right-4 bottom-24 md:bottom-8 z-50 w-11 h-11 rounded-full bg-idm-gold-warm/15 border border-idm-gold-warm/30 flex items-center justify-center text-idm-gold-warm hover:bg-idm-gold-warm/20 hover:border-idm-gold-warm/50 hover:shadow-[0_0_20px_rgba(239,249,35,0.2)] transition-all duration-300 cursor-pointer"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </>
  );
}
