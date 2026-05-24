'use client';

import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { Gem, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { SectionHeader } from './shared';

/* ── Sponsor data shape from API ── */
interface Sponsor {
  id: string;
  name: string;
  logo: string | null;
  website: string | null;
  tier: string;
  description: string | null;
  isActive: boolean;
  _count?: {
    tournamentSponsors: number;
    sponsoredPrizes: number;
    banners: number;
  };
}

/* ═══════════════════════════════════════════════════════════════
   Sponsors Section — "Didukung Oleh" (Supported By)
   - Mobile: Auto-sliding carousel with touch/swipe, dot indicators
   - Desktop: Grid layout with premium cards
   ═══════════════════════════════════════════════════════════════ */
export function SponsorsSection() {
  const { data, isLoading } = useQuery<{ sponsors: Sponsor[] }>({
    queryKey: ['sponsors-active'],
    queryFn: async () => {
      const res = await fetch('/api/sponsors?active=true');
      if (!res.ok) return { sponsors: [] };
      return res.json();
    },
    staleTime: 120000,
    gcTime: 300000,
  });

  const sponsors = data?.sponsors ?? [];

  // Don't render anything if no sponsors or still loading with no prior data
  if (!isLoading && sponsors.length === 0) return null;

  // Still loading and no data yet — show skeleton
  if (isLoading && sponsors.length === 0) {
    return (
      <section aria-label="Sponsors" className="relative py-12 sm:py-16 px-4 overflow-hidden bg-deep">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="h-4 w-24 rounded bg-idm-gold-warm/10 animate-pulse" />
          </div>
          {/* Mobile: carousel skeleton */}
          <div className="sm:hidden flex justify-center">
            <div className="w-[280px] h-36 rounded-2xl bg-idm-gold-warm/5 animate-pulse" />
          </div>
          {/* Desktop: grid skeleton */}
          <div className="hidden sm:grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-28 rounded-xl bg-idm-gold-warm/5 animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Didukung Oleh"
      className="relative py-10 sm:py-16 overflow-hidden bg-deep"
    >
      {/* ── Top edge glow ── */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-idm-gold-warm/25 to-transparent" aria-hidden="true" />

      {/* ── Background ── */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(239,249,35,0.05) 0%, transparent 60%)' }} />

      {/* ── Bottom edge glow ── */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-idm-gold-warm/15 to-transparent" aria-hidden="true" />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <SectionHeader
          icon={Gem}
          label="Didukung Oleh"
          title="Sponsor & Partner"
          subtitle="Mendukung ekosistem Tarkam IDM"
        />

        {/* ── Mobile: Auto-sliding Carousel ── */}
        <div className="sm:hidden">
          <SponsorCarousel sponsors={sponsors} />
        </div>

        {/* ── Desktop: Grid layout ── */}
        <div className="hidden sm:grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 px-4">
          {sponsors.map(sponsor => (
            <SponsorCardDesktop key={sponsor.id} sponsor={sponsor} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Mobile Carousel — Auto-sliding with touch/swipe support
   - Auto-advances every 3.5 seconds
   - Pauses on touch/interaction
   - Resume after 6s of no interaction
   - Dot indicators with active state
   - Left/Right nav buttons
   ═══════════════════════════════════════════════════════════════ */
function SponsorCarousel({ sponsors }: { sponsors: Sponsor[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isDraggingRef = useRef(false);

  const total = sponsors.length;

  const goTo = useCallback((index: number) => {
    setActiveIndex(((index % total) + total) % total);
  }, [total]);

  const goNext = useCallback(() => {
    goTo(activeIndex + 1);
  }, [activeIndex, goTo]);

  const goPrev = useCallback(() => {
    goTo(activeIndex - 1);
  }, [activeIndex, goTo]);

  // Auto-play interval
  useEffect(() => {
    if (isPaused || total <= 1) {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
      return;
    }
    autoPlayRef.current = setInterval(() => {
      setActiveIndex(prev => ((prev + 1) % total));
    }, 3500);
    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, [isPaused, total]);

  // Touch handlers for swipe
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    isDraggingRef.current = true;
    setIsPaused(true);
    // Clear any existing pause timer
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;

    // Only count as swipe if horizontal distance > vertical and fast enough
    if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy) && dt < 500) {
      if (dx < 0) goNext();
      else goPrev();
    }

    isDraggingRef.current = false;
    touchStartRef.current = null;

    // Resume auto-play after 6 seconds of no interaction
    pauseTimerRef.current = setTimeout(() => setIsPaused(false), 6000);
  }, [goNext, goPrev]);

  return (
    <div className="relative px-4">
      {/* Carousel viewport */}
      <div
        className="relative overflow-hidden rounded-2xl"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Slides container */}
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {sponsors.map(sponsor => (
            <div key={sponsor.id} className="w-full shrink-0 px-1">
              <SponsorCarouselCard sponsor={sponsor} />
            </div>
          ))}
        </div>

        {/* Left/Right nav arrows — only show if more than 1 sponsor */}
        {total > 1 && (
          <>
            <button
              onClick={goPrev}
              aria-label="Previous sponsor"
              className="absolute left-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm border border-idm-gold-warm/20 flex items-center justify-center text-muted-foreground dark:text-white/70 hover:text-idm-gold-warm hover:bg-black/60 transition-all duration-200 cursor-pointer z-10 active:scale-90"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={goNext}
              aria-label="Next sponsor"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm border border-idm-gold-warm/20 flex items-center justify-center text-muted-foreground dark:text-white/70 hover:text-idm-gold-warm hover:bg-black/60 transition-all duration-200 cursor-pointer z-10 active:scale-90"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Dot indicators — compact, subtle */}
      {total > 1 && (
        <div className="flex items-center justify-center gap-2 mt-3 py-2" role="tablist">
          {sponsors.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === activeIndex}
              aria-label={`Go to sponsor ${i + 1}`}
              onClick={() => { goTo(i); setIsPaused(true); if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current); pauseTimerRef.current = setTimeout(() => setIsPaused(false), 6000); }}
              style={{ minWidth: 'unset', minHeight: 'unset', width: i === activeIndex ? 16 : 4, height: 4 }}
              className={`compact-dot transition-all duration-300 rounded-full cursor-pointer ${
                i === activeIndex
                  ? 'bg-idm-gold-warm shadow-[0_0_4px_color-mix(in_srgb,var(--color-idm-gold-warm)_40%,transparent)]'
                  : 'bg-idm-gold-warm/25 hover:bg-idm-gold-warm/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Carousel Card — Full-width slide with premium styling ── */
function SponsorCarouselCard({ sponsor }: { sponsor: Sponsor }) {
  const logo = sponsor.logo;
  const inner = (
    <div className="group relative w-full h-36 rounded-2xl border border-idm-gold-warm/20 overflow-hidden transition-all duration-300 bg-idm-gold-warm/[0.04]">
      {logo ? (
        <>
          <Image
            src={logo}
            alt={sponsor.name}
            fill
            sizes="100vw"
            className="object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-300"
            style={{ objectPosition: 'center 30%' }}
          />
          {/* Gradient overlay at bottom with name */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-10 pb-3 px-4">
            <span className="text-sm font-bold text-white/95 truncate block text-center drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
              {sponsor.name}
            </span>
            {sponsor.description && (
              <span className="text-[10px] text-white/60 truncate block text-center mt-0.5">
                {sponsor.description}
              </span>
            )}
          </div>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6">
          <span className="text-lg font-bold text-idm-gold-warm/80 text-center">
            {sponsor.name}
          </span>
          {sponsor.description && (
            <span className="text-[11px] text-idm-gold-warm/40 text-center line-clamp-2">
              {sponsor.description}
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (sponsor.website) {
    return (
      <a
        href={sponsor.website}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Visit ${sponsor.name}`}
        className="block"
      >
        {inner}
      </a>
    );
  }

  return inner;
}

/* ── Desktop Card ── */
function SponsorCardDesktop({ sponsor }: { sponsor: Sponsor }) {
  const logo = sponsor.logo;
  const inner = (
    <div className="group relative rounded-xl border border-idm-gold-warm/15 bg-idm-gold-warm/[0.04] h-28 overflow-hidden transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_24px_color-mix(in_srgb,var(--color-idm-gold-warm)_12%,transparent)]">
      {logo ? (
        <>
          <Image
            src={logo}
            alt={sponsor.name}
            fill
            sizes="(max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
            className="object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-300"
            style={{ objectPosition: 'center 30%' }}
          />
          {/* Name overlay on hover */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent h-1/3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end pb-1.5 px-2">
            <span className="text-[10px] font-semibold text-white/90 truncate">
              {sponsor.name}
            </span>
          </div>
        </>
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-xs sm:text-sm font-semibold text-idm-gold-warm/70 group-hover:text-idm-gold-warm transition-colors text-center px-2">
          {sponsor.name}
        </span>
      )}
    </div>
  );

  if (sponsor.website) {
    return (
      <a
        href={sponsor.website}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Visit ${sponsor.name}`}
      >
        {inner}
      </a>
    );
  }

  return <div>{inner}</div>;
}
