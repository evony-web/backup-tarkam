'use client';

import { useRef, useEffect, useState, useMemo, type ReactNode } from 'react';

/* ========== Swipe Navigation Hook (DISABLED) ========== */
export function useSwipeNavigation() {
  // Intentionally empty — users scroll freely; bottom nav provides quick section navigation.
}

/* ========== Lightweight Parallax Hook ==========
  Drives `transform: translate3d(0, Ypx, 0)` on cached elements via rAF.
  No Framer Motion — pure CSS + requestAnimationFrame for mid-range devices.

  Key optimizations over naive approach:
  - Element references are CACHED once (no querySelectorAll per frame!)
  - Layers are stabilized via useMemo (no re-subscribe cascade)
  - Single rAF loop with double-buffered scrollY (no layout thrash)
  - GPU-only properties: will-change + contain + translate3d
  - Movement capped ±300px for safety
*/
interface ParallaxLayer {
  selector: string;
  speed: number;
}

interface CachedLayer {
  speed: number;
  els: HTMLElement[];
}

export function useParallax(layers: ParallaxLayer[]) {
  const rafRef = useRef<number>(0);
  const cacheRef = useRef<CachedLayer[]>([]);
  const scrollYRef = useRef(0);
  const lastAppliedRef = useRef(0); // Track last applied scroll to skip no-op frames
  const isVisibleRef = useRef(true); // Track if hero section is visible

  // Stabilize layers with a key-based comparison to avoid re-subscribe cascade
  const layersKey = layers.map(l => `${l.selector}:${l.speed}`).join('|');
  const [stableLayers] = useState(() => layers.map(l => ({ selector: l.selector, speed: l.speed })));

  useEffect(() => {
    // ── Step 1: Cache all element references ONCE ──
    const cached: CachedLayer[] = stableLayers.map(layer => ({
      speed: layer.speed,
      els: Array.from(document.querySelectorAll<HTMLElement>(layer.selector)),
    }));
    cacheRef.current = cached;

    // Apply GPU hints once
    for (const c of cached) {
      for (const el of c.els) {
        el.style.willChange = 'transform';
        el.style.contain = 'layout style';
      }
    }

    // ── Step 1.5: IntersectionObserver — only run parallax when hero is visible ──
    // This prevents wasted GPU cycles on transforms when the hero is scrolled past
    let cleanupVis: (() => void) | null = null;
    const heroEl = document.querySelector('.hero-section-immediate') || cached[0]?.els[0]?.parentElement;
    if (heroEl) {
      const visibilityIO = new IntersectionObserver(
        ([entry]) => { isVisibleRef.current = entry.isIntersecting; },
        { rootMargin: '100px 0px', threshold: 0 }
      );
      visibilityIO.observe(heroEl);
      cleanupVis = () => visibilityIO.disconnect();
    }

    // ── Step 2: Single rAF loop — reads scrollY, writes transforms ──
    const tick = () => {
      rafRef.current = 0;
      const scrollY = scrollYRef.current;

      // Skip if scroll hasn't changed since last apply OR hero not visible
      if (scrollY === lastAppliedRef.current || !isVisibleRef.current) return;
      lastAppliedRef.current = scrollY;

      for (const c of cacheRef.current) {
        const offset = Math.max(-300, Math.min(300, scrollY * c.speed));
        const transform = `translate3d(0,${offset}px,0)`;
        for (const el of c.els) {
          el.style.transform = transform;
        }
      }
    };

    const onScroll = () => {
      scrollYRef.current = window.scrollY;
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // initial position

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      if (cleanupVis) cleanupVis();
    };
  }, [stableLayers]);
}

/* ========== Parallax Background Component ==========
  Wraps children in a parallax-enabled container.
  Uses cached element ref — no DOM query per frame.
*/
export function ParallaxBg({ children, className = '', speed = 0.12 }: {
  children: ReactNode;
  className?: string;
  speed?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const scrollYRef = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.style.willChange = 'transform';
    el.style.contain = 'layout style';

    // Cache element's initial document-top position (doesn't change on scroll)
    const docTop = el.getBoundingClientRect().top + window.scrollY;

    const tick = () => {
      rafRef.current = 0;
      const scrollY = scrollYRef.current;
      // Offset based on how far element is from viewport center
      const offset = Math.max(-200, Math.min(200, (scrollY - docTop) * speed));
      el.style.transform = `translate3d(0,${offset}px,0)`;
    };

    const onScroll = () => {
      scrollYRef.current = window.scrollY;
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // initial

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [speed]);

  return (
    <div ref={ref} className={`parallax-bg ${className}`}>
      {children}
    </div>
  );
}

/* ========== Scroll Reveal Hook ==========
  Observes all `.reveal:not(.reveal--visible)` and `.section-reveal:not(.section-reveal--visible)`
  elements and adds their respective visible class when they scroll into view.
  Uses a single persistent IntersectionObserver — NO MutationObserver.

  INP optimization: Removed MutationObserver on document.body which fired on
  every DOM change. Instead, we observe elements once on mount. For dynamically
  added elements (after data loads), they will be picked up when the section
  components re-render and their wrapper divs already have the CSS class.
*/
export function useScrollReveal() {
  useEffect(() => {
    // Create a single IntersectionObserver for all reveal elements
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (entry.target.classList.contains('section-reveal')) {
              entry.target.classList.add('section-reveal--visible');
            } else {
              entry.target.classList.add('reveal--visible');
            }
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px', threshold: 0.01 }
    );

    // Helper: observe all un-revealed elements
    const observeAll = () => {
      document.querySelectorAll('.reveal:not(.reveal--visible)').forEach((el) => {
        io.observe(el);
      });
      document.querySelectorAll('.section-reveal:not(.section-reveal--visible)').forEach((el) => {
        io.observe(el);
      });
    };

    // Observe all existing elements on mount
    observeAll();

    // ★ INP OPTIMIZATION: Replace MutationObserver (which fires on every DOM change
    // and blocks the main thread during interactions) with lightweight idle-time polling.
    // Runs 4 scans over ~3 seconds to catch dynamically-loaded components, then stops.
    // This eliminates the constant DOM mutation monitoring that was the #1 INP killer.
    let scanCount = 0;
    let idleHandle: ReturnType<typeof requestIdleCallback> | null = null;

    const scanOnIdle = () => {
      if (scanCount >= 4) return;
      scanCount++;
      observeAll();
      // Schedule next scan during idle time
      if (typeof requestIdleCallback !== 'undefined') {
        idleHandle = requestIdleCallback(scanOnIdle, { timeout: 1500 });
      } else {
        setTimeout(scanOnIdle, 1000);
      }
    };

    // Start scanning after a brief delay (let initial render settle)
    if (typeof requestIdleCallback !== 'undefined') {
      idleHandle = requestIdleCallback(scanOnIdle, { timeout: 1000 });
    } else {
      setTimeout(scanOnIdle, 500);
    }

    return () => {
      io.disconnect();
      if (idleHandle !== null && typeof cancelIdleCallback !== 'undefined') {
        cancelIdleCallback(idleHandle);
      }
    };
  }, []);
}

/* ========== Shared Singleton IntersectionObserver for AnimatedSection ==========
  Prevents creating a new IntersectionObserver per AnimatedSection instance.
  On mobile, each observer costs ~2KB memory + compositor overhead.
  Sharing one observer across all instances reduces memory & INP impact.
*/
const revealObserver = typeof IntersectionObserver !== 'undefined'
  ? new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal--visible');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px', threshold: 0.01 }
    )
  : { observe: () => {}, unobserve: () => {} } as unknown as IntersectionObserver;

/* ========== Scroll-triggered Section Wrapper (CSS-only, Enhanced) ==========
  Premium reveal animation with blur-from + scale + opacity transition.
  Uses shared singleton IntersectionObserver to add `.reveal--visible`, triggering a
  spring-like CSS transition (cubic-bezier spring approximation).
  All GPU-only: transform, opacity, filter — no layout thrash.
*/
export function AnimatedSection({ children, className = '', variant = 'fadeUp', delay = 0 }: {
  children: ReactNode;
  className?: string;
  variant?: 'fadeUp' | 'fadeLeft' | 'fadeRight' | 'scaleIn' | 'premium' | 'slideUpSmooth';
  /** Optional stagger delay in ms */
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Use shared singleton observer to avoid creating one per AnimatedSection instance
    revealObserver.observe(el);
    return () => revealObserver.unobserve(el);
  }, []);

  const variantClass = {
    fadeUp: 'reveal-fade-up',
    fadeLeft: 'reveal-fade-left',
    fadeRight: 'reveal-fade-right',
    scaleIn: 'reveal-scale-in',
    premium: 'reveal-premium',
    slideUpSmooth: 'reveal-slide-up-smooth',
  }[variant] || 'reveal-fade-up';

  return (
    <div
      ref={ref}
      className={`reveal ${variantClass} ${className}`}
      style={delay > 0 ? { animationDelay: `${delay}ms` } as React.CSSProperties : undefined}
    >
      {children}
    </div>
  );
}

/* ========== Section Header Component (Premium Enhanced) ==========
  Premium section header with:
  - Decorative accent lines flanking the label
  - Gradient text effect on title (gold shimmer)
  - Subtle background glow behind section headers
  - Compact label pill with icon
  - Professional sizing — elegant, not overwhelming
*/
export function SectionHeader({ icon: Icon, label, title, subtitle }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="relative text-center mb-6 sm:mb-8">
      {/* Subtle background glow behind header — tighter spread */}
      <div className="absolute inset-0 -top-4 -bottom-4 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(239,249,35,0.03) 0%, transparent 40%)' }} aria-hidden="true" />

      {/* Decorative accent line above label */}
      <div className="flex items-center justify-center mb-3">
        <div className="h-px flex-1 max-w-[60px] sm:max-w-[80px] bg-gradient-to-r from-transparent to-idm-gold-warm/25" />
        <div className="mx-2 w-1.5 h-1.5 rounded-full bg-idm-gold-warm/40" />
        <div className="h-px w-6 sm:w-10 bg-idm-gold-warm/20" />
      </div>

      {/* Label pill */}
      <div className="relative flex items-center justify-center gap-2.5 mb-3">
        <div className="h-px w-6 sm:w-10 bg-gradient-to-r from-transparent to-idm-gold-warm/40" />
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-idm-gold-warm/20 bg-idm-gold-warm/[0.05]">
          <Icon className="w-3.5 h-3.5 text-idm-gold-warm" />
          <span className="text-[10px] font-bold text-idm-gold-warm uppercase tracking-widest">{label}</span>
        </div>
        <div className="h-px w-6 sm:w-10 bg-gradient-to-l from-transparent to-idm-gold-warm/40" />
      </div>

      {/* Title — concentrated gradient gold shimmer (narrower yellow zone) */}
      <h2 className="relative text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-idm-gold-warm/60 via-yellow-400 via-60% to-idm-gold-warm/60 bg-clip-text text-transparent">{title}</h2>

      {/* Decorative accent line below title */}
      <div className="flex items-center justify-center mt-2.5">
        <div className="h-px w-6 sm:w-10 bg-idm-gold-warm/20" />
        <div className="mx-2 w-1.5 h-1.5 rounded-full bg-idm-gold-warm/40" />
        <div className="h-px flex-1 max-w-[60px] sm:max-w-[80px] bg-gradient-to-l from-transparent to-idm-gold-warm/25" />
      </div>

      {/* Subtitle — lighter weight for contrast */}
      {subtitle && (
        <p className="text-[11px] sm:text-sm font-light text-muted-foreground/80 mt-2.5 max-w-lg mx-auto leading-relaxed">{subtitle}</p>
      )}
    </div>
  );
}

/* ========== Stat Card (CSS-only animation) ========== */
export function StatCard({ icon: Icon, value, label, delay }: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
  delay: number;
}) {
  const numericMatch = value.match(/^(\d+)/);
  const numericValue = numericMatch ? parseInt(numericMatch[1], 10) : 0;
  const suffix = numericMatch ? value.slice(numericMatch[0].length) : value;
  const isNumeric = numericMatch !== null && numericValue > 0;

  const delayClass = delay <= 0.08 ? 'reveal-delay-1' : delay <= 0.16 ? 'reveal-delay-2' : delay <= 0.24 ? 'reveal-delay-3' : delay <= 0.32 ? 'reveal-delay-4' : 'reveal-delay-5';

  return (
    <div className={`reveal reveal-fade-up ${delayClass} group relative`}>
      <div className="relative p-4 sm:p-6 rounded-2xl sm:rounded-2xl border border-idm-gold-warm/10 bg-idm-gold-warm/5 dark:bg-white/[0.06] text-center transition-all duration-300 hover:shadow-[0_0_30px_color-mix(in_srgb,var(--color-idm-gold-warm)_15%,transparent)] hover:border-idm-gold-warm/20">
        <div className="absolute inset-0 rounded-2xl sm:rounded-2xl overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-idm-gold-warm/[0.02] dark:from-white/[0.04] to-transparent" />
        </div>
        <div className="relative z-10">
          <div className="w-7 h-7 sm:w-10 sm:h-10 mx-auto mb-1.5 sm:mb-3 rounded-lg sm:rounded-2xl bg-idm-gold-warm/10 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Icon className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-idm-gold-warm" />
          </div>
          <p className="text-lg sm:text-2xl font-black text-gradient-fury">
            {isNumeric ? (
              <span
                className="stat-count-up inline-block"
                style={{ '--count-target': numericValue } as React.CSSProperties}
                data-suffix={suffix}
              >
                {numericValue}{suffix}
              </span>
            ) : (
              value
            )}
          </p>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 sm:mt-1 uppercase tracking-wider">{label}</p>
        </div>
      </div>
    </div>
  );
}

/* ========== Premium Section Divider (Enhanced v2) ==========
  Animated gradient line divider with:
  - Pulsing gradient lines (gold shimmer sweep)
  - Glowing central diamond orb with enhanced shimmer
  - Ambient glow that breathes
  - Floating particle dots
  - CSS-only animations — no JS animation libraries.
*/
export function SectionDivider() {
  return (
    <div className="section-divider-premium max-w-4xl mx-auto" aria-hidden="true">
      {/* Left gradient line — pulsing */}
      <span className="sdp-line sdp-line-l">
        <span className="sdp-line-shimmer" />
      </span>
      {/* Center orb group */}
      <span className="sdp-center">
        <span className="sdp-orb" />
        <span className="sdp-glow" />
        <span className="sdp-dot sdp-dot-1" />
        <span className="sdp-dot sdp-dot-2" />
        <span className="sdp-dot sdp-dot-3" />
      </span>
      {/* Right gradient line — pulsing */}
      <span className="sdp-line sdp-line-r">
        <span className="sdp-line-shimmer" />
      </span>
    </div>
  );
}

/* ========== Wave Section Divider (SVG Gradient Wave) ==========
  Premium wave divider using SVG with gradient fill.
  Replaces the orb+line divider for a more modern,
  fluid section transition. Mobile-first responsive.
*/
export function WaveDivider({ variant = 'gold' }: { variant?: 'gold' | 'subtle' }) {
  // Deterministic ID to avoid hydration mismatch (no Math.random)
  const gradientId = variant === 'subtle' ? 'wave-grad-subtle' : 'wave-grad-gold';
  const opacity = variant === 'subtle' ? 0.06 : 0.12;
  return (
    <div className="relative w-full overflow-hidden -my-px" aria-hidden="true" style={{ height: '40px' }}>
      <svg
        className="absolute bottom-0 left-0 w-full"
        viewBox="0 0 1200 40"
        preserveAspectRatio="none"
        style={{ height: '40px' }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--color-idm-gold-warm)" stopOpacity={opacity * 0.3} />
            <stop offset="30%" stopColor="var(--color-idm-gold-warm)" stopOpacity={opacity} />
            <stop offset="50%" stopColor="var(--color-idm-gold-warm)" stopOpacity={opacity * 1.4} />
            <stop offset="70%" stopColor="var(--color-idm-gold-warm)" stopOpacity={opacity} />
            <stop offset="100%" stopColor="var(--color-idm-gold-warm)" stopOpacity={opacity * 0.3} />
          </linearGradient>
        </defs>
        <path
          d="M0 20 Q150 0 300 15 T600 20 T900 15 T1200 20 L1200 40 L0 40 Z"
          fill={`url(#${gradientId})`}
        />
        <path
          d="M0 25 Q200 10 400 22 T800 25 T1200 22 L1200 40 L0 40 Z"
          fill={`url(#${gradientId})`}
          opacity="0.5"
        />
      </svg>
    </div>
  );
}

/* ========== Glassmorphism Card Wrapper ==========
  Adds backdrop-blur + semi-transparent background
  for a frosted glass effect. Works on dark and light themes.
*/
export function GlassCard({ children, className = '', hover = false }: {
  children: ReactNode;
  className?: string;
  /** Enable hover scale/shadow micro-interaction */
  hover?: boolean;
}) {
  return (
    <div
      className={`
        backdrop-blur-md
        bg-white/[0.04] dark:bg-white/[0.06]
        border border-white/[0.08] dark:border-white/[0.1]
        rounded-2xl
        shadow-[0_4px_30px_rgba(0,0,0,0.1)]
        ${hover ? 'transition-all duration-300 hover:scale-[1.015] hover:shadow-[0_8px_40px_rgba(0,0,0,0.15)] hover:bg-white/[0.06] dark:hover:bg-white/[0.08] active:scale-[0.99]' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

/* ========== Interactive Card Wrapper ==========
  Adds hover micro-interactions (scale + shadow) to any card.
  Subtle and performant — uses transform + box-shadow only.
*/
export function InteractiveCard({ children, className = '', as: Tag = 'div' }: {
  children: ReactNode;
  className?: string;
  /** HTML element to render (default: div) */
  as?: React.ElementType;
}) {
  return (
    <Tag
      className={`
        transition-all duration-300 ease-out
        hover:scale-[1.02] hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)]
        active:scale-[0.99]
        ${className}
      `}
    >
      {children}
    </Tag>
  );
}

/* ========== Animated Gradient Border ==========
  Wraps children in a container with an animated gradient border.
  The gradient rotates around the border continuously.
  Uses CSS conic-gradient + @keyframes for performance.
*/
export function AnimatedGradientBorder({ children, className = '', colors = 'gold' }: {
  children: ReactNode;
  className?: string;
  /** Preset color scheme: 'gold' (idm-gold-warm), 'male' (idm-male), 'female' (idm-female) */
  colors?: 'gold' | 'male' | 'female';
}) {
  const colorMap = {
    gold: {
      from: 'rgba(239,249,35,0.6)',
      via: 'rgba(249,203,37,0.3)',
      to: 'rgba(239,249,35,0.6)',
      shadow: '0 0 20px rgba(239,249,35,0.15)',
    },
    male: {
      from: 'rgba(46,159,255,0.6)',
      via: 'rgba(239,249,35,0.3)',
      to: 'rgba(46,159,255,0.6)',
      shadow: '0 0 20px rgba(46,159,255,0.15)',
    },
    female: {
      from: 'rgba(255,45,120,0.6)',
      via: 'rgba(239,249,35,0.3)',
      to: 'rgba(255,45,120,0.6)',
      shadow: '0 0 20px rgba(255,45,120,0.15)',
    },
  };
  const c = colorMap[colors];

  return (
    <div className={`relative rounded-2xl p-[1.5px] animated-gradient-border ${className}`} style={{ '--agb-from': c.from, '--agb-via': c.via, '--agb-to': c.to } as React.CSSProperties}>
      {/* Animated gradient border layer */}
      <div className="absolute inset-0 rounded-2xl animated-gradient-border-bg" aria-hidden="true" />
      {/* Inner content */}
      <div className="relative rounded-2xl bg-background overflow-hidden" style={{ boxShadow: c.shadow }}>
        {children}
      </div>
    </div>
  );
}

/* ========== Backward-compatible exports (empty, no longer needed) ========== */
export const fadeUp = {};
export const fadeLeft = {};
export const fadeRight = {};
export const scaleIn = {};
export const stagger = {};
