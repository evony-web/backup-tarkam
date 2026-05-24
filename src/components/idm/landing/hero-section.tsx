'use client';

import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { Star, Eye, ArrowRight, Users, Trophy, Swords, PenLine, X, Music } from 'lucide-react';
import { AvatarMedia } from '@/components/ui/avatar-media';
import { ClubLogoImage } from '@/components/idm/club-logo-image';
import { getAvatarUrl } from '@/lib/utils';
import type { StatsData, TopPlayer, WeeklyChampion } from '@/types/stats';

/* ═══════════════════════════════════════════════════════════════
   TARKAM IDM — TARKAM ARENA HERO
   International esports tournament aesthetic
   Inspired by Valorant Champions / LoL Worlds / BLAST Premier
   Performance-optimized for mid-range devices
   ═══════════════════════════════════════════════════════════════ */

/* ─── Animated Count-Up Hook ───
   Smooth number animation using requestAnimationFrame.
   Triggers when element enters viewport (IntersectionObserver).
   Respects prefers-reduced-motion. */
function useCountUp(target: number, duration = 1200, delay = 400) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Use useSyncExternalStore for prefers-reduced-motion (SSR-safe, no setState in effect)
  const prefersReduced = useSyncExternalStore(
    (callback) => {
      const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
      mql.addEventListener('change', callback);
      return () => mql.removeEventListener('change', callback);
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false // SSR fallback
  );

  // Observe when stats bar enters viewport
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  // Animate count when started (only if motion is allowed)
  useEffect(() => {
    if (!started || target <= 0 || prefersReduced) return;
    let startTime: number | null = null;
    let rafId: number;
    const delayTimeout = setTimeout(() => {
      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease-out cubic for smooth deceleration
        const eased = 1 - Math.pow(1 - progress, 3);
        setCount(Math.round(eased * target));
        if (progress < 1) {
          rafId = requestAnimationFrame(animate);
        }
      };
      rafId = requestAnimationFrame(animate);
    }, delay);
    return () => {
      clearTimeout(delayTimeout);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [started, target, duration, delay, prefersReduced]);

  // Derive display value: if reduced motion, show target directly; if target is 0 show 0
  const displayCount = prefersReduced ? target : (target > 0 ? count : 0);

  return { count: displayCount, ref };
}

interface HeroSectionProps {
  maleData: StatsData | undefined;
  femaleData: StatsData | undefined;
  cmsSections: Record<string, any>;
  cmsSettings: Record<string, string>;
  onEnterApp: (division: 'male' | 'female') => void;
  onEnterCommunity: () => void;
  onRegister: (division: 'male' | 'female') => void;
  onViewBracket: (division: 'male' | 'female') => void;
  onVideoPlay?: (url: string, title: string) => void;
  /** True when showing stale data from a previous season during a season switch.
   *  Used to show skeleton instead of old champion avatar. */
  isSeasonDataPlaceholder?: boolean;
  /** Tournament status for live badge — from /api/tournament-status */
  tournamentStatus?: {
    male: { tournamentId: string | null; status: string | null; name: string | null; weekNumber: number | null; isRegistrationOpen: boolean };
    female: { tournamentId: string | null; status: string | null; name: string | null; weekNumber: number | null; isRegistrationOpen: boolean };
  };
}

/* ═══════════════════════════════════════════════════════════════
   MAIN HERO SECTION
   ═══════════════════════════════════════════════════════════════ */

export function HeroSection({
  maleData,
  femaleData,
  cmsSections,
  cmsSettings,
  onEnterApp,
  onEnterCommunity,
  onRegister,
  onViewBracket,
  onVideoPlay,
  isSeasonDataPlaceholder = false,
  tournamentStatus,
}: HeroSectionProps) {
  /* ─── Extract CMS content ─── */
  // ★ No hardcoded fallback text — SSR provides CMS data via React Query cache.
  // This prevents "stale flash" where old text appears before fresh data loads.
  const hasCms = Object.keys(cmsSettings).length > 0;
  const siteTitle = cmsSettings.site_title || 'TARKAM IDM';
  const heroTitle = cmsSettings.hero_title || '';
  const heroSubtitle = cmsSettings.hero_subtitle || '';
  const heroTagline = cmsSettings.hero_tagline || '';
  const heroBgDesktop = cmsSettings.hero_bg_desktop || '';
  const heroBgMobile = cmsSettings.hero_bg_mobile || '';
  const heroBgVideo = cmsSettings.hero_bg_video || '';

  /* ─── Bracket division picker modal state ─── */
  const [showBracketPicker, setShowBracketPicker] = useState(false);

  /* ─── YouTube iframe facade — defer loading until after LCP ─── */
  // ★ OPTIMIZED: Disable YouTube on mobile entirely — heavy JS (500KB+) blocks main thread causing high INP
  const isMobile = useSyncExternalStore(
    (callback) => {
      const mql = window.matchMedia('(max-width: 767px)');
      mql.addEventListener('change', callback);
      return () => mql.removeEventListener('change', callback);
    },
    () => window.innerWidth < 768,
    () => false // SSR fallback
  );
  const [ytIframeReady, setYtIframeReady] = useState(false);
  useEffect(() => {
    // Defer YouTube iframe load — 5s on desktop (was 3s), skip on mobile
    if (!isMobile) {
      const timer = setTimeout(() => setYtIframeReady(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [isMobile]);

  /* ─── Compute stats ─── */
  const malePlayers = maleData?.totalPlayers || 0;
  const femalePlayers = femaleData?.totalPlayers || 0;
  const maleClubs = maleData?.clubs?.length || 0;
  const femaleClubs = femaleData?.clubs?.length || 0;
  // Count matches from active tournament or recent/upcoming
  const maleMatches = maleData?.activeTournament?.matches?.length || (maleData?.recentMatches?.length || 0) + (maleData?.upcomingMatches?.length || 0);
  const femaleMatches = femaleData?.activeTournament?.matches?.length || (femaleData?.recentMatches?.length || 0) + (femaleData?.upcomingMatches?.length || 0);
  const totalPlayers = malePlayers + femalePlayers;
  const totalClubs = maleClubs + femaleClubs;
  const totalMatches = maleMatches + femaleMatches;

  /* ─── Animated stats counters ─── */
  const { count: playersCount, ref: playersRef } = useCountUp(totalPlayers, 1200, 300);
  const { count: clubsCount, ref: clubsRef } = useCountUp(totalClubs, 1200, 500);
  const { count: matchesCount, ref: matchesRef } = useCountUp(totalMatches, 1200, 700);

  /* ─── Season Rank #1 — Player & Club ─── */
  // Top #1 player per division (from leaderboard topPlayers — season ranking)
  const maleTopPlayer: TopPlayer | null = !isSeasonDataPlaceholder && maleData?.topPlayers?.length ? maleData.topPlayers[0] : null;
  const femaleTopPlayer: TopPlayer | null = !isSeasonDataPlaceholder && femaleData?.topPlayers?.length ? femaleData.topPlayers[0] : null;

  // Top #1 club per week — from latest weeklyChampion (winner team)
  const allChampions = [
    ...(maleData?.weeklyChampions || []),
    ...(femaleData?.weeklyChampions || []),
  ].sort((a, b) => b.weekNumber - a.weekNumber);
  const latestChampionWeek = !isSeasonDataPlaceholder && allChampions.length > 0 ? allChampions[0] : null;
  // Extract club info from the winning team's players
  const championClubInfo = (() => {
    if (!latestChampionWeek?.winnerTeam?.players?.length) return null;
    // Find the first player with a club object
    const playerWithClub = latestChampionWeek.winnerTeam.players.find(p => p.club && typeof p.club === 'object');
    if (playerWithClub && typeof playerWithClub.club === 'object' && playerWithClub.club !== null) {
      return { name: playerWithClub.club.name, logo: playerWithClub.club.logo };
    }
    // Fallback: use the team name as club name
    return { name: latestChampionWeek.winnerTeam.name, logo: null };
  })();
  const championWeekNumber = latestChampionWeek?.weekNumber ?? 0;

  const showChampionSkeleton = isSeasonDataPlaceholder || (!maleData && !femaleData);
  const hasMaleTop = !!maleTopPlayer;
  const hasFemaleTop = !!femaleTopPlayer;
  const hasChampionClub = !!championClubInfo;

  return (
    <>
      {/* ═══════════════ HERO SECTION ═══════════════ */}
      <section
        id="hero"
        className="relative min-h-[92vh] sm:min-h-screen flex flex-col items-center justify-center"
        aria-label="Tarkam IDM Hero"
      >
        {/* ── Background Layers ── */}

        {/* Base: Deep dark gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, var(--bg-deep) 0%, var(--bg-mid) 40%, var(--background) 100%)`,
          }}
        />

        {/* CMS Video Background — takes priority over images when set */}
        {heroBgVideo && !isMobile ? (
          (() => {
            // Detect YouTube URL and extract video ID + optional start time
            const ytMatch = heroBgVideo.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
            const startTimeMatch = heroBgVideo.match(/[?&]t=(\d+)/);
            const startTime = startTimeMatch ? `&start=${startTimeMatch[1]}` : '';

            if (ytMatch) {
              // YouTube embed — deferred facade: only load iframe AFTER LCP completes
              // This prevents YouTube's heavy JS from blocking initial paint
              return (
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  {ytIframeReady ? (
                    <div className="absolute inset-0" style={{ width: '177.78vh', height: '56.25vw', minWidth: '100%', minHeight: '100%', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
                      <iframe
                        src={`https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&mute=1&loop=1&playlist=${ytMatch[1]}&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1&disablekb=1&fs=0&iv_load_policy=3${startTime}`}
                        title="Hero background video"
                        allow="autoplay; encrypted-media"
                        className="w-full h-full"
                        style={{ border: 'none', opacity: 0.3 }}
                        aria-hidden="true"
                      />
                    </div>
                  ) : (
                    /* Placeholder — static dark gradient while iframe loads */
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, var(--bg-deep) 0%, var(--bg-mid) 40%, var(--background) 100%)' }} />
                  )}
                </div>
              );
            }
            // Direct video URL (MP4, WebM, etc.)
            return (
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <video
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover opacity-30"
                  aria-hidden="true"
                >
                  <source src={heroBgVideo} type="video/mp4" />
                  <source src={heroBgVideo} type="video/webm" />
                </video>
              </div>
            );
          })()
        ) : (
          /* Fallback: CMS Background Images (only shown when no video) */
          (heroBgDesktop || heroBgMobile) ? (
            <>
              {/* Desktop — landscape hero image */}
              {heroBgDesktop && (
                <div className="absolute inset-0 hidden sm:block">
                  <Image src={heroBgDesktop} alt="" fill priority sizes="100vw" className="object-cover opacity-80" aria-hidden="true" />
                </div>
              )}
              {/* Mobile — use mobile-optimized image if available, else desktop image */}
              {(heroBgMobile || heroBgDesktop) && (
                <div className="absolute inset-0 sm:hidden">
                  <Image src={heroBgMobile || heroBgDesktop!} alt="" fill priority sizes="100vw" className="object-cover object-center opacity-80" aria-hidden="true" />
                </div>
              )}
            </>
          ) : null
        )}

        {/* Decorative glow layers — hidden on mobile to reduce paint cost */}
        {!heroBgVideo && (
          <div
            className="hidden sm:block absolute inset-0 pointer-events-none"
            style={{
              background: `
                radial-gradient(ellipse at 50% 45%, rgba(239,249,35,0.02) 0%, transparent 65%),
                radial-gradient(ellipse at 15% 30%, rgba(46,159,255,0.04) 0%, transparent 50%),
                radial-gradient(ellipse at 85% 70%, rgba(255,45,120,0.04) 0%, transparent 50%)
              `,
            }}
          />
        )}

        {/* 7. Cinematic Vignette — Blue-tinted, darker edges */}
        <div className="hero-vignette-cinematic" />
        {/* Original vignette fallback for video bg */}
        {heroBgVideo && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, transparent 20%, rgba(4,6,16,0.8) 100%)',
            }}
          />
        )}

        {/* Grid overlay — subtle esports tech feel — only when no video, hidden on mobile */}
        {!heroBgVideo && (
          <div
            className="hidden sm:block absolute inset-0 pointer-events-none opacity-[0.015]"
            style={{
              backgroundImage: `
                linear-gradient(rgba(239,249,35,0.3) 1px, transparent 1px),
                linear-gradient(90deg, rgba(239,249,35,0.3) 1px, transparent 1px)
              `,
              backgroundSize: '60px 60px',
            }}
          />
        )}

        {/* Decorative elements — hidden on mobile for performance */}
        <div className="hidden sm:block" aria-hidden="true">
          <div className="hero-diagonal-line hero-diagonal-line-1" />
          <div className="hero-diagonal-line hero-diagonal-line-2" />
          <div className="hero-diagonal-line hero-diagonal-line-3" />
          <div className="hero-geo-accent hero-geo-diamond-1" />
          <div className="hero-geo-accent hero-geo-diamond-2" />
          <div className="hero-geo-accent hero-geo-hex" />
        </div>

        {/* ── Floating Gold Particles — Premium ambient effect ── */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="hero-particle-dot hero-particle-dot-1" />
          <div className="hero-particle-dot hero-particle-dot-2" />
          <div className="hero-particle-dot hero-particle-dot-3" />
          <div className="hero-particle-dot hero-particle-dot-4" />
          <div className="hero-particle-dot hero-particle-dot-5" />
          <div className="hero-particle-dot hero-particle-dot-6" />
          <div className="hero-particle-dot hero-particle-dot-7" />
        </div>




        {/* ═══════════════ HERO CONTENT ═══════════════ */}
        <div className="relative z-10 text-center px-4 sm:px-6 max-w-5xl mx-auto w-full flex-1 flex flex-col items-center justify-center pt-[8vh] sm:pt-[18vh] pb-20 sm:pb-24">

          {/* ── iOS Frosted Glass Badge ── */}
          <div className="hero-enter-1 mb-5 sm:mb-7">
            <div className="flex items-center justify-center gap-3">
              <div className="h-px w-12 sm:w-24 bg-gradient-to-r from-transparent to-idm-gold-warm/50" />
              <div className="ios-badge frost-glass flex items-center gap-2 px-4 py-1.5" style={{ borderColor: 'rgba(239,249,35,0.2)', background: 'rgba(239,249,35,0.06)' }}>
                <Star className="w-3 h-3 text-idm-gold-warm/80" />
                <span className="text-[10px] sm:text-[11px] text-idm-gold-warm/80 font-bold tracking-[0.2em] uppercase">
                  {siteTitle}
                </span>
                <Star className="w-3 h-3 text-idm-gold-warm/80" />
              </div>
              <div className="h-px w-12 sm:w-24 bg-gradient-to-l from-transparent to-idm-gold-warm/50" />
            </div>
          </div>

          {/* ── Main Title — Gold gradient with dramatic letter-spacing entrance ── */}
          <div className="hero-enter-2 relative mb-3 sm:mb-4">
            {/* Subtle breathing gold glow behind title — CSS only, opacity-based for performance */}
            <div
              className="absolute inset-0 -top-8 -bottom-8 pointer-events-none hero-title-breath"
              aria-hidden="true"
            />

            <h1
              className="hero-title-entrance hero-title-glow-enhanced hero-title-glitch ios-heading relative text-4xl sm:text-6xl md:text-7xl uppercase leading-[1.05] min-h-[3.5rem]"
              data-text={heroTitle}
              style={{
                background: 'linear-gradient(135deg, #FAF0DC 0%, #EFF923 30%, #F9CB25 50%, #F9CB25 70%, #EFF923 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: 'none',
              }}
            >
              {heroTitle}
            </h1>

            {/* 6. Dramatic underline with shimmer sweep */}
            <div className="hero-underline-dramatic mx-auto mt-3 sm:mt-4" style={{ width: '60%' }} />
          </div>

          {/* ── Subtitle — Clean Apple typography — lighter weight for hierarchy contrast ── */}
          <p className="hero-enter-3 text-base sm:text-xl lg:text-2xl font-extralight tracking-widest uppercase mb-2 min-h-[1.5rem] leading-normal text-foreground/70 dark:text-[#e8d5a3]/80">
            {heroSubtitle}
          </p>

          {/* ── Tagline — Lighter weight, iOS style ── */}
          <p className="hero-enter-4 text-sm sm:text-base font-light max-w-xl mx-auto mb-6 sm:mb-8 leading-relaxed text-muted-foreground dark:text-muted-foreground/70">
            {heroTagline}
          </p>

          {/* ═══════════════ WEEKLY TOP RANK #1: Cowo | Club | Cewe — Premium Cards ═══════════════ */}
          {showChampionSkeleton ? (
            /* ─── Skeleton placeholder during season switch / initial load ─── */
            <div className="hero-enter-5 flex items-stretch justify-center gap-2 sm:gap-3 mb-6 sm:mb-10">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex flex-col items-center p-3 sm:p-4 rounded-2xl border border-idm-gold-warm/10 bg-idm-gold-warm/[0.03]">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-idm-gold-warm/10" />
                  <div className="mt-2 space-y-1.5 text-center">
                    <div className="w-16 h-2 rounded bg-idm-gold-warm/10 mx-auto" />
                    <div className="w-10 h-1.5 rounded bg-idm-gold-warm/5 mx-auto" />
                  </div>
                </div>
              ))}
            </div>
          ) : (hasMaleTop || hasChampionClub || hasFemaleTop) ? (
            /* ─── Weekly Top Rank #1: 3 Premium Cards ─── */
            <div className="hero-enter-5 flex items-stretch justify-center gap-2 sm:gap-3 mb-6 sm:mb-10">

              {/* 🥇 Top #1 Cowo — Left Card */}
              {maleTopPlayer ? (
                <div className="flex flex-col items-center px-3 py-3 sm:px-4 sm:py-4 rounded-2xl border transition-colors duration-300"
                  style={{ background: 'rgba(87,181,255,0.06)', borderColor: 'rgba(87,181,255,0.25)', boxShadow: '0 0 18px rgba(87,181,255,0.08)' }}>
                  {/* Rank #1 badge + Diamond avatar with blue frame */}
                  <div className="relative mb-1.5">
                    <div className="absolute -top-1 -right-1 z-10 w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[8px] sm:text-[9px] font-black"
                      style={{ background: 'linear-gradient(135deg, #57B5FF, #2E9FFF)', color: '#fff', boxShadow: '0 0 8px rgba(87,181,255,0.4)' }}>
                      1
                    </div>
                    <div className="relative w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 shrink-0"
                      style={{
                        clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                        background: 'linear-gradient(135deg, #57B5FF, #8FCEFF, #57B5FF)',
                        padding: '2px',
                      }}>
                      <div className="relative w-full h-full overflow-hidden"
                        style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}>
                        <AvatarMedia
                          src={getAvatarUrl(maleTopPlayer.gamertag, 'male', maleTopPlayer.avatar)}
                          alt={maleTopPlayer.gamertag}
                          fill
                          sizes="64px"
                          className="object-cover object-top"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  </div>
                  {/* Name and stats below avatar */}
                  <div className="flex flex-col items-center mt-1.5 min-w-0">
                    <div className="flex items-center gap-1">
                      <Music className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" style={{ color: '#57B5FF' }} />
                      <span className="text-[10px] sm:text-xs font-black tracking-wider uppercase truncate" style={{ color: '#57B5FF' }}>
                        {maleTopPlayer.gamertag}
                      </span>
                    </div>
                    <span className="text-[7px] sm:text-[8px] font-bold tracking-[0.12em] uppercase mt-0.5" style={{ color: 'rgba(87,181,255,0.85)' }}>
                      #1 Cowo
                    </span>
                    {/* Quick stats — season wins/losses */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[7px] sm:text-[8px] font-bold" style={{ color: 'rgba(87,181,255,0.95)' }}>
                        {maleTopPlayer.totalWins}W
                      </span>
                      <span className="text-[7px] sm:text-[8px]" style={{ color: 'rgba(87,181,255,0.7)' }}>/</span>
                      <span className="text-[7px] sm:text-[8px] font-bold" style={{ color: 'rgba(87,181,255,0.8)' }}>
                        {Math.max(0, maleTopPlayer.matches - maleTopPlayer.totalWins)}L
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* 🏆 Top #1 Club — Center Card */}
              {championClubInfo ? (
                <div className="flex flex-col items-center px-3 py-3 sm:px-4 sm:py-4 rounded-2xl border transition-colors duration-300"
                  style={{ background: 'rgba(239,249,35,0.05)', borderColor: 'rgba(239,249,35,0.2)', boxShadow: '0 0 20px rgba(239,249,35,0.08)' }}>
                  {/* Rank #1 badge + Club Logo */}
                  <div className="relative mb-1.5">
                    <div className="absolute -top-1 -right-1 z-10 w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[8px] sm:text-[9px] font-black"
                      style={{ background: 'linear-gradient(135deg, #EFF923, #F9CB25)', color: '#1c1917', boxShadow: '0 0 8px rgba(239,249,35,0.4)' }}>
                      1
                    </div>
                    <div className="relative w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl overflow-hidden shrink-0"
                      style={{ boxShadow: '0 0 14px rgba(239,249,35,0.2)', border: '2px solid rgba(239,249,35,0.25)' }}>
                      <ClubLogoImage
                        clubName={championClubInfo.name}
                        dbLogo={championClubInfo.logo}
                        alt={championClubInfo.name}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                  {/* Name and description below avatar */}
                  <div className="flex flex-col items-center mt-1.5 min-w-0">
                    <div className="flex items-center gap-1">
                      <Trophy className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0 text-idm-gold-warm/80" />
                      <span className="text-[10px] sm:text-xs font-black tracking-wider uppercase text-idm-gold-warm/90 truncate">
                        {championClubInfo.name}
                      </span>
                    </div>
                    <span className="text-[7px] sm:text-[8px] font-bold tracking-[0.12em] uppercase text-idm-gold-warm/70 mt-0.5">
                      {championWeekNumber > 0 ? `#1 Club W${championWeekNumber}` : '#1 Club'}
                    </span>
                    {/* MVP name */}
                    {latestChampionWeek?.mvp && (
                      <div className="flex items-center gap-1 mt-1">
                        <Star className="w-2 h-2 shrink-0 text-idm-gold-warm/75" />
                        <span className="text-[7px] sm:text-[8px] font-bold text-idm-gold-warm/75 truncate">
                          MVP: {latestChampionWeek.mvp.gamertag}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {/* 🥇 Top #1 Cewe — Right Card */}
              {femaleTopPlayer ? (
                <div className="flex flex-col items-center px-3 py-3 sm:px-4 sm:py-4 rounded-2xl border transition-colors duration-300"
                  style={{ background: 'rgba(255,92,154,0.06)', borderColor: 'rgba(255,92,154,0.25)', boxShadow: '0 0 18px rgba(255,92,154,0.08)' }}>
                  {/* Rank #1 badge + Diamond avatar with pink frame */}
                  <div className="relative mb-1.5">
                    <div className="absolute -top-1 -right-1 z-10 w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[8px] sm:text-[9px] font-black"
                      style={{ background: 'linear-gradient(135deg, #FF5C9A, #FF8FBC)', color: '#fff', boxShadow: '0 0 8px rgba(255,92,154,0.4)' }}>
                      1
                    </div>
                    <div className="relative w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 shrink-0"
                      style={{
                        clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                        background: 'linear-gradient(135deg, #FF5C9A, #FF8FBC, #FF5C9A)',
                        padding: '2px',
                      }}>
                      <div className="relative w-full h-full overflow-hidden"
                        style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}>
                        <AvatarMedia
                          src={getAvatarUrl(femaleTopPlayer.gamertag, 'female', femaleTopPlayer.avatar)}
                          alt={femaleTopPlayer.gamertag}
                          fill
                          sizes="64px"
                          className="object-cover object-top"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  </div>
                  {/* Name and stats below avatar */}
                  <div className="flex flex-col items-center mt-1.5 min-w-0">
                    <div className="flex items-center gap-1">
                      <Music className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" style={{ color: '#FF5C9A' }} />
                      <span className="text-[10px] sm:text-xs font-black tracking-wider uppercase truncate" style={{ color: '#FF5C9A' }}>
                        {femaleTopPlayer.gamertag}
                      </span>
                    </div>
                    <span className="text-[7px] sm:text-[8px] font-bold tracking-[0.12em] uppercase mt-0.5" style={{ color: 'rgba(255,92,154,0.85)' }}>
                      #1 Cewe
                    </span>
                    {/* Quick stats — season wins/losses */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[7px] sm:text-[8px] font-bold" style={{ color: 'rgba(255,92,154,0.95)' }}>
                        {femaleTopPlayer.totalWins}W
                      </span>
                      <span className="text-[7px] sm:text-[8px]" style={{ color: 'rgba(255,92,154,0.7)' }}>/</span>
                      <span className="text-[7px] sm:text-[8px] font-bold" style={{ color: 'rgba(255,92,154,0.8)' }}>
                        {Math.max(0, femaleTopPlayer.matches - femaleTopPlayer.totalWins)}L
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}

            </div>
          ) : null}

          {/* ═══════════════ CTA BUTTONS ═══════════════ */}
          <div className={`flex flex-col sm:flex-row items-center justify-center gap-[18px] sm:gap-4 mx-auto mb-6 sm:mb-10 ${(hasMaleTop || hasChampionClub || hasFemaleTop) ? '' : 'hero-enter-5'}`}>
            {/* Daftar Tarkam — Primary CTA → Registration — with animated gradient border */}
            <button
              onClick={() => onRegister('male')}
              className="btn-press hero-cta-breath hero-cta-pulse-enhanced group relative cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-idm-gold-warm/50 focus-visible:ring-offset-2 focus-visible:ring-offset-deep rounded-xl sm:rounded-2xl p-[1.5px] overflow-hidden"
            >
              {/* Animated gradient border layer */}
              <div className="absolute inset-[-50%] w-[200%] h-[200%] pointer-events-none" aria-hidden="true" style={{
                background: 'conic-gradient(from 0deg, rgba(239,249,35,0.5), rgba(249,203,37,0.2), rgba(239,249,35,0.5), transparent, rgba(239,249,35,0.5))',
                animation: 'agb-rotate 3s linear infinite',
              }} />
              {/* Stronger pulse glow ring */}
              <div className="absolute -inset-1 rounded-2xl hero-cta-pulse-ring" style={{ background: 'rgba(239,249,35,0.08)', boxShadow: '0 0 15px rgba(239,249,35,0.2)' }} />
              {/* Glow background */}
              <div className="absolute -inset-1.5 rounded-2xl blur-lg opacity-0 group-hover:opacity-50 transition-opacity duration-500" style={{ background: 'rgba(239,249,35,0.22)' }} />
              <div className="relative flex items-center justify-center gap-2.5 px-6 sm:px-7 py-2.5 sm:py-3 min-h-[44px] sm:min-h-[48px] rounded-xl sm:rounded-2xl font-extrabold text-[13px] sm:text-sm tracking-wide uppercase transition-all duration-300 hero-cta-primary-inner overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #EFF923 0%, #F9CB25 50%, #F9CB25 100%)',
                  color: '#1c1917',
                  boxShadow: '0 4px 20px rgba(239,249,35,0.35), inset 0 1px 0 rgba(255,255,255,0.3)',
                }}
              >
                {/* Shimmer sweep overlay */}
                <div className="hero-cta-shimmer-sweep" aria-hidden="true" />
                <PenLine className="w-4 h-4 relative z-10" />
                <span className="relative z-10">Daftar Tarkam</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform relative z-10" />
              </div>
            </button>

            {/* Lihat Bracket — Secondary CTA → Show division picker modal */}
            <button
              onClick={() => setShowBracketPicker(true)}
              className="btn-press hero-cta-breath group relative cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-idm-gold-warm/50 focus-visible:ring-offset-2 focus-visible:ring-offset-deep"
            >
              {/* Glow on hover */}
              <div className="absolute -inset-1 rounded-2xl blur-md opacity-0 group-hover:opacity-30 transition-opacity duration-500" style={{ background: 'rgba(239,249,35,0.10)' }} />
              <div className="relative flex items-center justify-center gap-2.5 px-6 sm:px-7 py-2.5 sm:py-3 min-h-[44px] sm:min-h-[48px] rounded-xl sm:rounded-2xl font-bold text-[13px] sm:text-sm tracking-wide uppercase border transition-all duration-300 hero-cta-secondary-inner backdrop-blur-sm"
                style={{
                  background: 'rgba(239,249,35,0.08)',
                  borderColor: 'rgba(239,249,35,0.3)',
                  color: '#EFF923',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.25), inset 0 1px 0 rgba(239,249,35,0.1)',
                }}
              >
                <Eye className="w-4 h-4" />
                Lihat Bracket
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          </div>

          {/* ═══ Live Tournament Status Badge ═══ */}
          {(() => {
            const maleStatus = tournamentStatus?.male?.status;
            const femaleStatus = tournamentStatus?.female?.status;
            // Determine overall status: prefer LIVE > REGISTRASI > UPCOMING
            const isInProgress = maleStatus === 'in_progress' || maleStatus === 'active' || femaleStatus === 'in_progress' || femaleStatus === 'active';
            const isRegistration = tournamentStatus?.male?.isRegistrationOpen || tournamentStatus?.female?.isRegistrationOpen;
            const hasUpcoming = (maleStatus === 'registration' || maleStatus === 'approval' || femaleStatus === 'registration' || femaleStatus === 'approval' || tournamentStatus?.male?.tournamentId || tournamentStatus?.female?.tournamentId);

            if (isInProgress) {
              return (
                <div className="hero-enter-5 flex justify-center mb-4 sm:mb-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-500/30 bg-red-500/10 shadow-[0_0_16px_rgba(239,68,68,0.2)]">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                    </span>
                    <span className="text-[10px] sm:text-xs font-black text-red-400 uppercase tracking-wider">LIVE</span>
                    <span className="text-[9px] sm:text-[10px] text-red-400/60 font-medium">Turnamen Berlangsung</span>
                  </div>
                </div>
              );
            }

            if (isRegistration) {
              return (
                <div className="hero-enter-5 flex justify-center mb-4 sm:mb-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-idm-gold-warm/25 bg-idm-gold-warm/[0.08] shadow-[0_0_12px_rgba(239,249,35,0.1)] animate-pulse">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-bounce inline-flex rounded-full h-2 w-2 bg-idm-gold-warm" />
                    </span>
                    <span className="text-[10px] sm:text-xs font-black text-idm-gold-warm uppercase tracking-wider">REGISTRASI</span>
                    <span className="text-[9px] sm:text-[10px] text-idm-gold-warm/60 font-medium">Daftar Sekarang!</span>
                  </div>
                </div>
              );
            }

            if (hasUpcoming) {
              return (
                <div className="hero-enter-5 flex justify-center mb-4 sm:mb-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-idm-gold-warm/15 bg-idm-gold-warm/[0.04]">
                    <span className="inline-flex rounded-full h-2 w-2 bg-idm-gold-warm/50" />
                    <span className="text-[10px] sm:text-xs font-bold text-idm-gold-warm/70 uppercase tracking-wider">UPCOMING</span>
                    <span className="text-[9px] sm:text-[10px] text-idm-gold-warm/40 font-medium">Turnamen Mendatang</span>
                  </div>
                </div>
              );
            }

            return null;
          })()}

          {/* 3. iOS Frosted Glass Stats Counter Bar — compact on mobile */}
          <div className="ios-hero-stats mt-4 sm:mt-8 mx-auto max-w-md px-3 sm:px-6 py-2 sm:py-3" ref={playersRef}>
            <div className="flex items-center justify-center gap-1.5 sm:gap-4">
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-idm-gold-warm/50" />
                <span className="text-xs sm:text-sm font-bold text-idm-gold-warm/80 tabular-nums">{playersCount}</span>
                <span className="text-[9px] sm:text-[10px] text-idm-gold-warm/40 uppercase tracking-wider font-semibold">Pemain</span>
              </div>
              <div className="hero-stats-dot" />
              <div className="flex items-center gap-1">
                <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-idm-gold-warm/50" />
                <span className="text-xs sm:text-sm font-bold text-idm-gold-warm/80 tabular-nums">{clubsCount}</span>
                <span className="text-[9px] sm:text-[10px] text-idm-gold-warm/40 uppercase tracking-wider font-semibold">Club</span>
              </div>
              <div className="hero-stats-dot" />
              <div className="flex items-center gap-1">
                <Swords className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-idm-gold-warm/50" />
                <span className="text-xs sm:text-sm font-bold text-idm-gold-warm/80 tabular-nums">{matchesCount}</span>
                <span className="text-[9px] sm:text-[10px] text-idm-gold-warm/40 uppercase tracking-wider font-semibold">Match</span>
              </div>
            </div>
          </div>




        </div>

        {/* 4. Premium Scroll Indicator — Mouse icon + bouncing animation */}
        <div className="absolute bottom-20 sm:bottom-10 left-1/2 -translate-x-1/2 z-10 hero-scroll-bounce" style={{ animation: 'reveal-fade-up 0.5s 2s cubic-bezier(0.16,1,0.3,1) both' }} aria-hidden="true">
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] sm:text-[11px] text-idm-gold-warm/60 uppercase tracking-[0.2em] font-semibold">Explore</span>
            <div className="hero-scroll-mouse-enhanced">
              <div className="hero-scroll-mouse-dot-enhanced" />
            </div>
            <svg className="w-4 h-4 text-idm-gold-warm/50 hero-scroll-arrow" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Bottom fade gradient to next section */}
        <div
          className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none z-10"
          style={{
            background: 'linear-gradient(to top, var(--background), transparent)',
          }}
        />
      </section>

      {/* ══════ BRACKET DIVISION PICKER MODAL ══════ */}
      {showBracketPicker && typeof document !== 'undefined' && createPortal(
        <div
          className="modal-backdrop modal-backdrop-enter z-[9999] p-3 sm:p-4"
          onClick={() => setShowBracketPicker(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Pilih Divisi Bracket"
        >
          <div
            className="modal-container modal-container-md modal-enter-slide"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="modal-header justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-idm-gold-warm/10">
                  <Eye className="w-5 h-5 text-idm-gold-warm" />
                </div>
                <div className="min-w-0">
                  <h2 className="modal-header-title text-gradient-fury">Lihat Bracket</h2>
                  <p className="modal-header-subtitle">Pilih divisi untuk melihat bracket</p>
                </div>
              </div>
              <button
                onClick={() => setShowBracketPicker(false)}
                aria-label="Tutup"
                className="modal-close"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Division Cards */}
            <div className="modal-body">
              <div className="grid grid-cols-2 gap-4">
                {/* Cowo Division Card */}
                <button
                  onClick={() => { setShowBracketPicker(false); onViewBracket('male'); }}
                  className="group relative flex flex-col items-center gap-3 p-5 sm:p-6 rounded-2xl border-2 border-idm-male/20 bg-idm-male/5 hover:border-idm-male/50 hover:bg-idm-male/10 transition-all duration-300 cursor-pointer active:scale-95"
                >
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-idm-male/15 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Music className="w-7 h-7 sm:w-8 sm:h-8 text-idm-male" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-base sm:text-lg font-black text-idm-male uppercase tracking-wider">Cowo</h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Divisi Laki-laki</p>
                  </div>
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" style={{ boxShadow: '0 0 24px rgba(46,159,255,0.15)' }} />
                </button>

                {/* Cewe Division Card */}
                <button
                  onClick={() => { setShowBracketPicker(false); onViewBracket('female'); }}
                  className="group relative flex flex-col items-center gap-3 p-5 sm:p-6 rounded-2xl border-2 border-idm-female/20 bg-idm-female/5 hover:border-idm-female/50 hover:bg-idm-female/10 transition-all duration-300 cursor-pointer active:scale-95"
                >
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-idm-female/15 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Users className="w-7 h-7 sm:w-8 sm:h-8 text-idm-female" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-base sm:text-lg font-black text-idm-female uppercase tracking-wider">Cewe</h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Divisi Perempuan</p>
                  </div>
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" style={{ boxShadow: '0 0 24px rgba(255,45,120,0.15)' }} />
                </button>
              </div>

              <p className="text-[10px] text-muted-foreground/50 text-center mt-1">
                Pilih divisi untuk melihat bracket pertandingan
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
