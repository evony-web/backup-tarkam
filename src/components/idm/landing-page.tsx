'use client';

import { useQuery } from '@tanstack/react-query';
import { useAppStore, type AppView } from '@/lib/store';
import { useCrossTabInvalidation } from '@/lib/cross-tab-sync';

import Image from 'next/image';
import { Crown, Trophy, Swords, Music, LogIn, UserCircle, LogOut, Shield, Sun, Moon, Award, Home, Target, GitBranch } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { StatsData } from '@/types/stats';

// ★ Above-fold: keep synchronous for instant render
import { HeroSection } from './landing/hero-section';
import { LandingSkeleton } from './landing/landing-skeleton';

// ★ Below-fold sections: lazy loaded to reduce initial JS bundle by ~250KB
import dynamic from 'next/dynamic';
/* Mobile-optimized loading placeholders — responsive heights prevent CLS:
   Mobile: shorter placeholders match stacked mobile layouts (single column)
   Desktop: taller placeholders match wider multi-column layouts
   Using min-h ensures placeholder never clips content; actual height fills naturally */
const TournamentHub = dynamic(() => import('./landing/tournament-hub').then(m => ({ default: m.TournamentHub })), { ssr: false, loading: () => <div className="min-h-[320px] sm:min-h-[420px]" /> });
const DonorLeaderboardSection = dynamic(() => import('./landing/donor-leaderboard-section').then(m => ({ default: m.DonorLeaderboardSection })), { ssr: false, loading: () => <div className="min-h-[400px] sm:min-h-[500px]" /> });
// REMOVED: PlayersSection, HighlightsSection, SeasonChampionSection, ExperiencesSection — unused, not rendered
const ClubsSection = dynamic(() => import('./landing/clubs-section').then(m => ({ default: m.ClubsSection })), { ssr: false, loading: () => <div className="min-h-[300px] sm:min-h-[400px]" /> });
const SponsorsSection = dynamic(() => import('./landing/sponsors-section').then(m => ({ default: m.SponsorsSection })), { ssr: false, loading: () => null });
const LandingFooter = dynamic(() => import('./landing/landing-footer').then(m => ({ default: m.LandingFooter })), { ssr: false, loading: () => null });
const MarqueeTicker = dynamic(() => import('./marquee-ticker').then(m => ({ default: m.MarqueeTicker })), { ssr: false, loading: () => <div className="h-12" /> });
const MyTournamentCard = dynamic(() => import('./my-tournament-card').then(m => ({ default: m.MyTournamentCard })), { ssr: false, loading: () => <div className="h-[120px]" /> });
const BackToTop = dynamic(() => import('./ui/back-to-top').then(m => ({ default: m.BackToTop })), { ssr: false, loading: () => null });
const ScrollProgress = dynamic(() => import('./ui/scroll-progress').then(m => ({ default: m.ScrollProgress })), { ssr: false, loading: () => null });

// ★ Modals: lazy loaded — removes ~225KB (including framer-motion) from initial bundle
const PlayerProfile = dynamic(() => import('./player-profile').then(m => ({ default: m.PlayerProfile })), { ssr: false, loading: () => null });
const ClubProfile = dynamic(() => import('./club-profile').then(m => ({ default: m.ClubProfile })), { ssr: false, loading: () => null });
const RegistrationModal = dynamic(() => import('./registration-modal').then(m => ({ default: m.RegistrationModal })), { ssr: false, loading: () => null });
const VideoModal = dynamic(() => import('./video-modal').then(m => ({ default: m.VideoModal })), { ssr: false, loading: () => null });
const PaymentModal = dynamic(() => import('./payment-modal').then(m => ({ default: m.PaymentModal })), { ssr: false, loading: () => null });
const UnifiedLoginModal = dynamic(() => import('./unified-login-modal').then(m => ({ default: m.UnifiedLoginModal })), { ssr: false, loading: () => null });
const DonationModal = dynamic(() => import('./donation-modal').then(m => ({ default: m.DonationModal })), { ssr: false, loading: () => null });
const HasilSection = dynamic(() => import('./landing/hasil-section').then(m => ({ default: m.HasilSection })), { ssr: false, loading: () => <div className="min-h-[280px] sm:min-h-[360px]" /> });
// REMOVED from landing: ActivityFeedSection — redundant with MarqueeTicker
const TournamentPrizeSection = dynamic(() => import('./landing/tournament-prize-section').then(m => ({ default: m.TournamentPrizeSection })), { ssr: false, loading: () => <div className="min-h-[200px]" /> });
const PeringkatSection = dynamic(() => import('./landing/peringkat-section').then(m => ({ default: m.PeringkatSection })), { ssr: false, loading: () => <div className="min-h-[300px] sm:min-h-[400px]" /> });
// REMOVED from landing: WeeklyStatsOverview, TournamentCountdownSection, PlayerComparisonSection,
// BracketPreviewSection, SeasonHistorySection — have dedicated nav pages or are too granular

// Shared hooks & components
import { useSwipeNavigation, useScrollReveal, useParallax, SectionDivider } from './landing/shared';

/* ═══ Theme Toggle — Landing Page ═══
   Adapts to the landing page nav's scrolled state:
   - Not scrolled (transparent nav): white icons visible on dark hero
   - Scrolled (solid nav): themed icons visible on background
*/
const emptySubscribe = () => () => {};
function useIsMounted() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

function LandingThemeToggle({ scrolled }: { scrolled: boolean }) {
  const { theme, setTheme } = useTheme();
  const mounted = useIsMounted();

  if (!mounted) {
    return (
      <button
        className="compact-dot inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full transition-opacity opacity-50"
        aria-label="Toggle theme"
      >
        <div className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </button>
    );
  }

  const isDark = theme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`btn-press compact-dot inline-flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300 cursor-pointer border active:scale-95 ${
        scrolled
          ? 'border-idm-gold-warm/20 bg-idm-gold-warm/5 hover:bg-idm-gold-warm/15 text-idm-gold-warm'
          : 'border-foreground/10 bg-foreground/5 hover:bg-foreground/10 text-foreground/70 hover:text-foreground dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/15 dark:text-white/70 dark:hover:text-white'
      }`}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <div className="relative h-3.5 w-3.5 sm:h-4 sm:w-4 overflow-hidden">
        <Sun
          className={`absolute inset-0 h-3.5 w-3.5 sm:h-4 sm:w-4 transition-all duration-300 ${
            isDark
              ? 'rotate-90 scale-0 opacity-0'
              : 'rotate-0 scale-100 opacity-100'
          }`}
        />
        <Moon
          className={`absolute inset-0 h-3.5 w-3.5 sm:h-4 sm:w-4 transition-all duration-300 ${
            isDark
              ? 'rotate-0 scale-100 opacity-100'
              : '-rotate-90 scale-0 opacity-0'
          }`}
        />
      </div>
    </button>
  );
}

/* ═══ Landing Auth Button — Desktop Header ═══
   Compact login button for the landing page header.
   - Not logged in: Shows "Login" with icon
   - Logged in as player: Shows avatar + gamertag
   - Logged in as admin: Shows shield icon + username
   - Click: Opens login modal or shows logout dropdown
*/
function LandingAuthButton({
  onOpenLogin,
  onLogout,
  scrolled,
}: {
  onOpenLogin: (tab: 'peserta' | 'admin') => void;
  onLogout: () => void;
  scrolled: boolean;
}) {
  const { adminAuth, playerAuth } = useAppStore();
  const [showMenu, setShowMenu] = useState(false);

  const isLoggedIn = adminAuth.isAuthenticated || playerAuth.isAuthenticated;
  const displayName = adminAuth.isAuthenticated
    ? adminAuth.admin?.username
    : playerAuth.isAuthenticated
      ? playerAuth.account?.player?.gamertag
      : null;
  const isPlayer = playerAuth.isAuthenticated;
  const isAdmin = adminAuth.isAuthenticated;

  // Close dropdown on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => setShowMenu(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showMenu]);

  if (!isLoggedIn) {
    return (
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        <button
          onClick={() => onOpenLogin('peserta')}
          aria-label="Login akun"
          className={`btn-press compact-dot relative inline-flex items-center gap-1 px-2 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-[11px] sm:text-sm font-semibold transition-all duration-200 cursor-pointer border active:scale-95 ${
            scrolled
              ? 'border-idm-gold-warm/25 text-idm-gold-warm hover:bg-idm-gold-warm/10 hover:border-idm-gold-warm/40'
              : 'border-foreground/15 text-foreground/80 hover:bg-foreground/5 hover:border-foreground/25 dark:border-white/20 dark:text-white/80 dark:hover:bg-white/10 dark:hover:border-white/30'
          }`}
        >
          <LogIn className="w-3.5 h-3.5" />
          <span>Login</span>
        </button>
        {/* Admin login shortcut — subtle */}
        <button
          onClick={() => onOpenLogin('admin')}
          aria-label="Admin login"
          className={`btn-press compact-dot p-0.5 sm:p-1 rounded-md transition-all duration-200 cursor-pointer opacity-50 hover:opacity-100 ${
            scrolled ? 'text-idm-gold-warm/70 hover:text-idm-gold-warm' : 'text-foreground/50 hover:text-foreground/90 dark:text-white/50 dark:hover:text-white/90'
          }`}
          title="Login Admin"
        >
          <Shield className="w-3.5 h-3.5 text-idm-gold-warm drop-shadow-[0_0_4px_rgba(239,249,35,0.4)]" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
        aria-label="User menu"
        className={`btn-press flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full transition-all duration-200 cursor-pointer border active:scale-95 shrink-0 ${
          scrolled
            ? 'border-idm-gold-warm/20 bg-idm-gold-warm/5 hover:bg-idm-gold-warm/10'
            : 'border-foreground/10 bg-foreground/5 hover:bg-foreground/10 dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10'
        }`}
      >
        {/* Avatar */}
        {isPlayer && playerAuth.account?.player?.avatar ? (
          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full overflow-hidden ring-1 ring-idm-gold-warm/30">
            <Image
              src={playerAuth.account.player.avatar}
              alt={displayName || ''}
              width={24}
              height={24}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        ) : isAdmin ? (
          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-idm-gold-warm/20 flex items-center justify-center ring-1 ring-idm-gold-warm/40 shadow-[0_0_6px_rgba(239,249,35,0.15)]">
            <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-idm-gold-warm drop-shadow-[0_0_3px_rgba(239,249,35,0.4)]" />
          </div>
        ) : (
          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-muted/30 flex items-center justify-center ring-1 ring-idm-gold-warm/30">
            <UserCircle className="w-3 h-3 text-idm-gold-warm" />
          </div>
        )}
        <span className={`text-[10px] sm:text-xs font-semibold max-w-[60px] sm:max-w-[80px] truncate ${
          scrolled ? 'text-idm-gold-warm' : 'text-foreground/80 dark:text-white/80'
        }`}>
          {displayName}
        </span>
      </button>

      {/* Dropdown Menu */}
      {showMenu && (
        <div className="absolute right-0 top-full mt-1.5 w-48 rounded-2xl border border-idm-gold-warm/15 bg-background/98 backdrop-blur-xl shadow-xl shadow-black/30 overflow-hidden z-[60]">
          {/* User Info Header */}
          <div className="px-3 py-2.5 border-b border-idm-gold-warm/10 bg-idm-gold-warm/[0.03]">
            <p className="text-xs font-bold text-foreground truncate">{displayName}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {isAdmin ? `Admin · ${adminAuth.admin?.role}` : isPlayer ? `Peserta · ${playerAuth.account?.player?.division === 'male' ? '♂ Cowo' : '♀ Cewe'}` : ''}
            </p>
          </div>
          {/* Actions */}
          <div className="p-1.5">
            {isAdmin && (
              <button
                onClick={() => { setShowMenu(false); useAppStore.getState().setCurrentView('admin'); }}
                className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-muted-foreground hover:text-idm-gold-warm hover:bg-idm-gold-warm/5 rounded-lg transition-colors cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5 text-idm-gold-warm" /> Admin Panel
              </button>
            )}
            {isPlayer && (
              <button
                onClick={() => { setShowMenu(false); document.getElementById('cari-turnamen')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}
                className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-muted-foreground hover:text-idm-gold-warm hover:bg-idm-gold-warm/5 rounded-lg transition-colors cursor-pointer"
              >
                <Target className="w-3.5 h-3.5" /> Status Turnamen
              </button>
            )}
            <button
              onClick={() => { setShowMenu(false); onLogout(); }}
              className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-red-400/80 hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Keluar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function LandingPage() {
  const { setCurrentView, setDivision, currentView } = useAppStore();
  const [selectedPlayerRaw, setSelectedPlayerRaw] = useState<StatsData['topPlayers'][0] & { division?: string } | null>(null);
  const [preferredSkinType, setPreferredSkinType] = useState<string | null>(null);
  // Wrapper: always clear preferredSkinType when selecting from non-MVP contexts
  // The HighlightsSection MVP card calls setPreferredSkinType('mvp') AFTER setSelectedPlayer
  // to override this clearing, so MVP context is preserved.
  const setSelectedPlayer = useCallback((player: typeof selectedPlayerRaw) => {
    setSelectedPlayerRaw(player);
    setPreferredSkinType(null);
  }, []);
  const selectedPlayer = selectedPlayerRaw;
  const [selectedClub, setSelectedClub] = useState<(StatsData['clubs'][0] & { division?: string }) | null>(null);
  const [showAllClubs, setShowAllClubs] = useState(false);

  /* Season Selector State — null = active season */
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);

  /* Registration Modal State */
  const [registrationModalOpen, setRegistrationModalOpen] = useState(false);
  const [registrationDefaultDivision, setRegistrationDefaultDivision] = useState<'male' | 'female' | null>(null);

  /* Login Modal State */
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginDefaultTab, setLoginDefaultTab] = useState<'peserta' | 'admin'>('peserta');

  /* Video Modal State */
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [videoModalUrl, setVideoModalUrl] = useState('');
  const [videoModalTitle, setVideoModalTitle] = useState('');

  /* Payment Modal State */
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [donationModalOpen, setDonationModalOpen] = useState(false);
  const [paymentModalDivision, setPaymentModalDivision] = useState<'male' | 'female'>('male');
  const [donationTournamentId, setDonationTournamentId] = useState<string | null>(null);

  /* Mobile performance: defer non-critical queries on small screens */
  const [deferredQueriesReady, setDeferredQueriesReady] = useState(false);
  useEffect(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    const timer = setTimeout(() => setDeferredQueriesReady(true), isMobile ? 2000 : 0);
    return () => clearTimeout(timer);
  }, []);

  const openVideoModal = useCallback((url: string, title: string) => {
    setVideoModalUrl(url);
    setVideoModalTitle(title);
    setVideoModalOpen(true);
  }, []);

  /* Cross-tab cache sync — invalidates when admin updates logo/banner in another tab */
  useCrossTabInvalidation();
  // Note: usePusherRealtime() is already called in AppShell — no duplicate needed here

  /* Fast tournament status — lightweight query for registration button (loads in <100ms) */
  const { data: tournamentStatus } = useQuery<{
    male: { tournamentId: string | null; status: string | null; name: string | null; weekNumber: number | null; isRegistrationOpen: boolean };
    female: { tournamentId: string | null; status: string | null; name: string | null; weekNumber: number | null; isRegistrationOpen: boolean };
  }>({
    queryKey: ['tournament-status'],
    queryFn: async () => {
      const res = await fetch('/api/tournament-status');
      if (!res.ok) return { male: { tournamentId: null, status: null, name: null, weekNumber: null, isRegistrationOpen: false }, female: { tournamentId: null, status: null, name: null, weekNumber: null, isRegistrationOpen: false } };
      return res.json();
    },
    enabled: deferredQueriesReady,
    staleTime: 30000, // 30s — fast refresh since this is a lightweight query
    refetchInterval: 120000, // 2min polling — reduced from 60s to lower INP impact
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true, // ★ Keep for tournament-status — lightweight and critical for registration button
    gcTime: 60000,
    placeholderData: (prev) => prev, // keep previous data during refetch — prevents CLS
    notifyOnChangeProps: ['data', 'error'],
  });

  /* Data Queries — 1min polling, CDN-cached */
  const { data: maleData, isLoading: isMaleLoading, isPlaceholderData: isMalePlaceholder } = useQuery<StatsData>({
    queryKey: ['stats', 'male', selectedSeasonId],
    queryFn: async () => {
      const url = `/api/stats?division=male${selectedSeasonId ? `&seasonId=${selectedSeasonId}` : ''}`;
      const res = await fetch(url); return res.json();
    },
    staleTime: 120000, // 2min — reduced polling frequency to lower INP impact
    refetchInterval: 300000, // 5min polling — reduced from 2min for INP optimization
    refetchIntervalInBackground: false,
    notifyOnChangeProps: ['data', 'error'],
    refetchOnWindowFocus: false, // ★ OPTIMIZED: disabled — polling handles freshness, refetchOnFocus causes INP spikes
    gcTime: 300000,
    placeholderData: (prev) => prev, // keep previous data during refetch/season switch — prevents FOUC
  });

  const { data: femaleData, isLoading: isFemaleLoading, isPlaceholderData: isFemalePlaceholder } = useQuery<StatsData>({
    queryKey: ['stats', 'female', selectedSeasonId],
    queryFn: async () => {
      const url = `/api/stats?division=female${selectedSeasonId ? `&seasonId=${selectedSeasonId}` : ''}`;
      const res = await fetch(url); return res.json();
    },
    enabled: deferredQueriesReady,
    staleTime: 120000, // 2min — reduced polling frequency to lower INP impact
    refetchInterval: 330000, // 5.5min polling — staggered 30s from male to avoid simultaneous INP spikes
    refetchIntervalInBackground: false,
    notifyOnChangeProps: ['data', 'error'],
    refetchOnWindowFocus: false, // ★ OPTIMIZED: disabled — polling handles freshness
    gcTime: 300000,
    placeholderData: (prev) => prev, // keep previous data during refetch/season switch — prevents FOUC
  });

  const isDataLoading = isMaleLoading || (deferredQueriesReady && isFemaleLoading);
  // isSeasonSwitching: data exists (not initial load) but fetching new season data
  const isSeasonSwitching = !isDataLoading && (isMalePlaceholder || isFemalePlaceholder);
  // isSeasonDataPlaceholder: true when showing OLD season data during a season switch
  // Used by Hero section to show skeleton instead of stale champion
  const isSeasonDataPlaceholder = isMalePlaceholder || isFemalePlaceholder;

  // Derived: registration open state — use fast tournament-status as fallback when full stats data is still loading
  // This ensures the "Daftar" button responds quickly without waiting for the heavy /api/stats response
  const maleRegOpen = maleData?.activeTournament?.status === 'registration' || maleData?.activeTournament?.status === 'approval' || tournamentStatus?.male?.isRegistrationOpen || false;
  const femaleRegOpen = femaleData?.activeTournament?.status === 'registration' || femaleData?.activeTournament?.status === 'approval' || tournamentStatus?.female?.isRegistrationOpen || false;

  const { data: cmsData } = useQuery({
    queryKey: ['cms-content'],
    queryFn: async () => {
      const res = await fetch('/api/cms/content');
      if (!res.ok) return { settings: {}, sections: {} };
      return res.json();
    },
    enabled: deferredQueriesReady,
    staleTime: 300000, // CMS changes rarely — 5min stale is fine
    refetchInterval: 600000, // 10min polling — CMS data barely changes
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false, // ★ OPTIMIZED: disabled — CMS rarely changes
    gcTime: 300000,
    placeholderData: (prev) => prev, // keep previous data during refetch — prevents CLS
    notifyOnChangeProps: ['data', 'error'],
  });

  // REMOVED: leagueData query — Liga IDM is not used in Tarkam

  // CMS helpers
  const cms = cmsData?.settings || {};
  const cmsSections = cmsData?.sections || {};
  const cmsLogo = cms.logo_url || '/logo1.webp';
  const cmsSiteTitle = cms.site_title || 'Tarkam IDM';
  const cmsHeroTitle = cms.hero_title || 'Idol Meta';
  const cmsHeroSubtitle = cms.hero_subtitle || 'Fan Made Edition';
  const cmsFooterText = cms.footer_text || '© 2026 TARKAM IDM — Idol Meta Fan Made Edition.';
  const cmsFooterTagline = cms.footer_tagline || 'Dance. Compete. Dominate.';

  const enterApp = (division: 'male' | 'female') => {
    setDivision(division);
    setCurrentView('community');
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const enterBracket = (division: 'male' | 'female') => {
    setDivision(division);
    setCurrentView('bracket');
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const enterHasil = (division: 'male' | 'female') => {
    setDivision(division);
    setCurrentView('hasil');
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const enterCommunity = () => {
    setCurrentView('community');
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  /* Nav scroll state — optimized for INP:
     - Use refs to skip setState when value hasn't changed (prevents unnecessary re-renders)
     - rAF throttle already in place, now also guards against no-op state updates */
  const [scrolled, setScrolled] = useState(false);
  const scrolledRef = useRef(false);
  const scrollTickingRef = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      // Throttle scroll events using rAF — only 1 update per frame
      if (scrollTickingRef.current) return;
      scrollTickingRef.current = true;
      requestAnimationFrame(() => {
        const isScrolled = window.scrollY > 20;
        // Only update state when value actually changes — eliminates re-renders while scrolling in same zone
        if (scrolledRef.current !== isScrolled) {
          scrolledRef.current = isScrolled;
          setScrolled(isScrolled);
        }
        scrollTickingRef.current = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Section Reveal — REMOVED: redundant IntersectionObserver
     useScrollReveal() below already handles .reveal elements.
     The .section-reveal class is handled by the same CSS mechanism.
     Removing this eliminates a duplicate IntersectionObserver (was #3). */

  /* Open player modal from shared link — ?player=<id>
     Reads URL param once on mount, then opens the player profile modal.
     Uses a ref to track processed ID and setTimeout(0) to avoid synchronous setState in effect. */
  const sharedPlayerIdRef = useRef<string | null>(null);
  useEffect(() => {
    // Read player ID from URL once on mount
    if (!sharedPlayerIdRef.current) {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('player');
      if (id) sharedPlayerIdRef.current = id;
    }
    const playerId = sharedPlayerIdRef.current;
    if (!playerId || !maleData || !femaleData) return;

    // Try finding the player in already-loaded stats data first (instant, no extra fetch)
    const malePlayer = maleData.topPlayers?.find(p => p.id === playerId);
    const femalePlayer = femaleData.topPlayers?.find(p => p.id === playerId);

    if (malePlayer) {
      sharedPlayerIdRef.current = null;
      window.history.replaceState({}, '', window.location.pathname);
      // Use microtask to avoid synchronous setState in effect
      queueMicrotask(() => setSelectedPlayer({ ...malePlayer, division: 'male' }));
      return;
    }
    if (femalePlayer) {
      sharedPlayerIdRef.current = null;
      window.history.replaceState({}, '', window.location.pathname);
      queueMicrotask(() => setSelectedPlayer({ ...femalePlayer, division: 'female' }));
      return;
    }

    // Not in top players — fetch from API (only once)
    sharedPlayerIdRef.current = null;
    fetch(`/api/players/${encodeURIComponent(playerId)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data) return;
        setSelectedPlayerRaw({
          id: data.id,
          name: data.name || data.gamertag,
          gamertag: data.gamertag,
          avatar: data.avatar,
          tier: data.tier || 'B',
          points: data.points || 0,
          totalWins: data.totalWins || 0,
          streak: data.streak || 0,
          maxStreak: data.maxStreak || 0,
          totalMvp: data.totalMvp || 0,
          matches: data.matches || 0,
          division: data.division || 'male',
          city: data.city,
          club: data.clubMembers?.[0]?.profile?.name || data.club || undefined,
        });
        setPreferredSkinType(null);
        window.history.replaceState({}, '', window.location.pathname);
      })
      .catch(() => {});
  }, [maleData, femaleData]);

  /* Handle shared view deep links — ?view=bracket, ?view=peringkat, ?view=hasil, ?view=champion, ?view=club
     Reads URL param once on mount, navigates to the correct view/section. */
  const sharedViewRef = useRef<string | null>(null);
  useEffect(() => {
    if (sharedViewRef.current) return; // already processed
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (!view) return;
    sharedViewRef.current = view;
    window.history.replaceState({}, '', window.location.pathname);

    // Navigate based on view type
    switch (view) {
      case 'bracket':
        queueMicrotask(() => setCurrentView('bracket'));
        break;
      case 'hasil':
        queueMicrotask(() => setCurrentView('hasil'));
        break;
      case 'peringkat':
        // Navigate to the Peringkat page
        queueMicrotask(() => setCurrentView('peringkat'));
        break;
      case 'champion':
        // Navigate to community dashboard, then scroll to champions section
        queueMicrotask(() => {
          setCurrentView('community');
          setTimeout(() => {
            const el = document.getElementById('section-champions');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 500);
        });
        break;
      case 'club': {
        const clubName = params.get('name');
        if (clubName) {
          queueMicrotask(() => {
            setCurrentView('community');
            setTimeout(() => {
              // Trigger club profile opening via custom event
              window.dispatchEvent(new CustomEvent('tarkam:open-club', { detail: { name: clubName } }));
            }, 500);
          });
        }
        break;
      }
    }
  }, [setCurrentView]);

  useSwipeNavigation();
  useScrollReveal();

  /* Parallax — lightweight rAF-based depth layers on scroll */
  useParallax(
    typeof window !== 'undefined' && window.innerWidth >= 640
      ? [
          { selector: '.parallax-hero-bg', speed: 0.12 },
          { selector: '.parallax-hero-mid', speed: 0.08 },
          { selector: '.parallax-hero-slow', speed: 0.05 },
          { selector: '.parallax-section-bg', speed: 0.06 },
          { selector: '.parallax-particles', speed: 0.18 },
        ]
      : []
  );

  // ★ Show full-page skeleton while initial data is loading
  // OPTIMIZATION: Only wait for maleData (primary division) for faster LCP
  // Female data loads in background without blocking the initial render
  if (isMaleLoading) {
    return <LandingSkeleton />;
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-background landing-scroll pb-24 md:pb-0">

      {/* ========== FIXED NAVIGATION HEADER ========== */}
      <nav aria-label="Main navigation" className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-background/95 border-b border-idm-gold-warm/10 shadow-[0_4px_30px_rgba(0,0,0,0.3)] nav-scrolled-glow'
          : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-14 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className={`w-7 h-7 rounded-lg overflow-hidden shrink-0 transition-all duration-500 ${scrolled ? 'nav-logo-glow glow-pulse' : 'glow-pulse'}`}>
              <Image src={cmsLogo} alt="IDM" width={28} height={28} className="w-full h-full object-cover" priority />
            </div>
            <span className={`text-gradient-fury text-sm font-bold tracking-tight transition-all duration-500 ${scrolled ? 'nav-logo-text-glow' : ''}`}>{cmsSiteTitle}</span>
          </div>

          {/* Desktop Nav Links — compact on medium screens */}
          <div className="hidden sm:flex items-center gap-0.5 md:gap-1">
            {[
              { view: 'landing' as AppView, label: 'Beranda', special: false },
              { view: 'hasil' as AppView, label: 'Hasil', special: false },
              { view: 'bracket' as AppView, label: 'Bracket', special: false },
              { view: 'highlights' as AppView, label: 'Juara', special: true },
              { view: 'peringkat' as AppView, label: 'Peringkat', special: false },
              { view: 'players' as AppView, label: 'Pemain', special: false },
            ].map(item => (
              <button
                key={item.view}
                onClick={() => {
                  setCurrentView(item.view);
                  if (item.view !== 'landing') window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
                }}
                className={`relative px-2 md:px-3 py-1.5 text-xs md:text-sm transition-all duration-300 cursor-pointer rounded-md ${
                  currentView === item.view
                    ? 'text-idm-gold-warm font-semibold'
                    : item.special
                    ? 'text-idm-gold-warm/80 hover:text-idm-gold-warm'
                    : 'text-muted-foreground hover:text-idm-gold-warm/70'
                }`}
              >
                {item.special && <span className="absolute inset-0 rounded-md animate-pulse bg-idm-gold-warm/[0.06] border border-idm-gold-warm/15" />}
                <span className="relative flex items-center gap-1">
                  {item.special && <Crown className="w-3.5 h-3.5 drop-shadow-[0_0_4px_rgba(239,249,35,0.4)]" />}
                  {item.label}
                </span>
                {currentView === item.view && (
                  <div className="nav-indicator absolute bottom-0 left-1 right-1 h-[2px] bg-idm-gold-warm rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Right Actions: Theme Toggle + Login */}
          <div className="flex items-center gap-1 sm:gap-1.5 ml-1.5 sm:ml-0">
            {/* Theme Toggle */}
            <LandingThemeToggle scrolled={scrolled} />
            {/* Login / User Button */}
            <LandingAuthButton
              onOpenLogin={(tab) => { setLoginDefaultTab(tab); setLoginModalOpen(true); }}
              onLogout={() => {
                const { clearAdminAuth, clearPlayerAuth } = useAppStore.getState();
                clearAdminAuth();
                clearPlayerAuth();
                fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
                fetch('/api/account/logout', { method: 'POST' }).catch(() => {});
              }}
              scrolled={scrolled}
            />
          </div>
        </div>
      </nav>

      {/* ========== MOBILE BOTTOM NAVIGATION ========== */}
      <nav aria-label="Section navigation" className="md:hidden fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
        {/* Gradient border at top — premium separator */}
        <div className="h-px bg-gradient-to-r from-transparent via-idm-gold-warm/30 to-transparent" aria-hidden="true" />
        {/* Frosted glass background */}
        <div className="bg-background sm:bg-background/95 sm:backdrop-blur-lg">
          <div className="flex items-center justify-around h-16 px-1">
            {[
              { view: 'landing' as AppView, label: 'Beranda', icon: Home, special: false },
              { view: 'hasil' as AppView, label: 'Hasil', icon: Swords, special: false },
              { view: 'highlights' as AppView, label: 'Juara', icon: Crown, special: true },
              { view: 'peringkat' as AppView, label: 'Peringkat', icon: Award, special: false },
              { view: 'players' as AppView, label: 'Pemain', icon: Music, special: false },
            ].map(item => {
              const isActive = currentView === item.view;

              // FAB-style for Juara button
              if (item.special) {
                return (
                  <button
                    key={item.view}
                    onClick={() => { setCurrentView(item.view); if (item.view !== 'landing') window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); }}
                    className="relative -mt-5 z-20 cursor-pointer"
                  >
                    {/* Button body */}
                    <span className={`relative flex items-center justify-center w-14 h-14 rounded-full transition-all duration-300 active:scale-90 ${
                      isActive
                        ? 'bg-idm-gold-warm'
                        : 'bg-gradient-to-br from-idm-gold-warm/90 to-yellow-500'
                    }`}>
                      <Crown className={`w-6 h-6 ${isActive ? 'text-black' : 'text-black/90'} fill-current`} />
                    </span>
                    <span className="block text-center text-[9px] font-bold mt-1 text-idm-gold-warm">{item.label}</span>
                  </button>
                );
              }

              return (
                <button
                  key={item.view}
                  onClick={() => {
                    setCurrentView(item.view);
                    if (item.view !== 'landing') window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
                  }}
                  className={`relative flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1.5 px-2 rounded-xl transition-all duration-200 active:scale-90 ${
                    isActive
                    ? 'text-idm-gold-warm'
                    : 'text-muted-foreground hover:text-idm-gold-warm/70'
                  }`}
                >
                  <item.icon className="relative z-10 w-5 h-5" />
                  <span className="relative z-10 text-[10px] font-medium mt-0.5">{item.label}</span>
                  {isActive && (
                    <div className="absolute -bottom-0.5 w-1.5 h-1.5 rounded-full bg-idm-gold-warm shadow-[0_0_6px_rgba(239,249,35,0.6)]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* ========== BRACKET FAB (Mobile) ========== — hidden on Bracket view */}
      {currentView === 'landing' && (
        <button
          onClick={() => { setCurrentView('bracket'); window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); }}
          className={`md:hidden fixed right-4 bottom-24 z-40 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer bg-idm-gold-warm/90 shadow-idm-gold-warm/30`}
          title="Bracket"
        >
          <GitBranch className="w-5 h-5 text-black" />
        </button>
      )}

      {/* ========== SECTION COMPONENTS ========== */}
      <HeroSection
        maleData={maleData}
        femaleData={femaleData}
        cmsSections={cmsSections}
        cmsSettings={cms}
        onEnterApp={enterApp}
        onEnterCommunity={enterCommunity}
        onRegister={() => { setRegistrationDefaultDivision(null); setRegistrationModalOpen(true); }}
        onViewBracket={enterBracket}
        onVideoPlay={openVideoModal}
        isSeasonDataPlaceholder={isSeasonDataPlaceholder}
        tournamentStatus={tournamentStatus}
      />


      {/* Marquee Ticker — Live Stats & Feed */}
      <div className="relative z-10 border-y border-idm-gold-warm/10 bg-deep/80">
        <MarqueeTicker maleData={maleData} femaleData={femaleData} />
      </div>

      {/* Cari Turnamen Kamu — Search your tournament status */}
      <div id="cari-turnamen" className="section-reveal bg-deep border-y border-border/30 dark:border-0">
        <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-6">
          {/* Live Tournament Badge — pulses when a tournament is active */}
          {(maleData?.activeTournament?.status === 'in_progress' || femaleData?.activeTournament?.status === 'in_progress') && (
            <div className="flex justify-center mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-500/20 bg-red-500/5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Turnamen Berlangsung</span>
                {maleData?.activeTournament?.status === 'in_progress' && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-idm-male/10 text-idm-male border border-idm-male/20">♂ Cowo</span>
                )}
                {femaleData?.activeTournament?.status === 'in_progress' && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-idm-female/10 text-idm-female border border-idm-female/20">♀ Cewe</span>
                )}
              </div>
            </div>
          )}
          <MyTournamentCard />
        </div>
      </div>

      {/* Kompetisi — Tarkam Arena (first section after hero) */}
      <div className="section-reveal">
      <TournamentHub
        maleData={maleData}
        femaleData={femaleData}
        cmsSections={cmsSections}
        cmsSettings={cms}
        onEnterApp={enterApp}
        onRegister={(div) => { setRegistrationDefaultDivision(div || null); setRegistrationModalOpen(true); }}
        onDonate={(div) => {
          setPaymentModalDivision(div);
          const tid = div === 'male' ? tournamentStatus?.male?.tournamentId : tournamentStatus?.female?.tournamentId;
          setDonationTournamentId(tid || null);
          setDonationModalOpen(true);
        }}
        onViewBracket={enterHasil}
        onVideoPlay={openVideoModal}
        maleRegOpen={maleRegOpen}
        femaleRegOpen={femaleRegOpen}
      />
      </div>

      <SectionDivider />

      {/* Tournament Prize Pool */}
      <div className="section-reveal">
      <TournamentPrizeSection />
      </div>

      <SectionDivider />

      {/* Leaderboard Penyawer — Weekly donor leaderboard */}
      <div className="section-reveal">
      <DonorLeaderboardSection
        maleData={maleData}
        femaleData={femaleData}
        isDataLoading={isDataLoading}
      />
      </div>

      <SectionDivider />

      {/* Hasil — Semi Final & Grand Final Results */}
      <div className="section-reveal">
      <HasilSection
        maleData={maleData}
        femaleData={femaleData}
        isDataLoading={isDataLoading}
      />
      </div>

      <SectionDivider />

      {/* Peringkat — Compact leaderboard (top 5) */}
      <div className="section-reveal">
      <PeringkatSection
        maleData={maleData}
        femaleData={femaleData}
        isDataLoading={isDataLoading}
        setSelectedPlayer={setSelectedPlayer}
        setSelectedClub={setSelectedClub}
        maxPlayers={5}
        maxClubs={5}
        onViewAll={() => { setCurrentView('peringkat'); window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); }}
      />
      </div>

      <SectionDivider />

      {/* Clubs */}
      <div className="section-reveal">
      <ClubsSection
        maleData={maleData}
        femaleData={femaleData}
        isDataLoading={isDataLoading}
        cmsSections={cmsSections}
        setSelectedClub={setSelectedClub}
        showAllClubs={showAllClubs}
        setShowAllClubs={setShowAllClubs}
        selectedSeasonId={selectedSeasonId}
        setSelectedSeasonId={setSelectedSeasonId}
        isHistorical={maleData?.isHistorical || femaleData?.isHistorical || false}
      />
      </div>

      <SectionDivider />

      {/* Sponsors — "Didukung Oleh" */}
      <SponsorsSection />

      <LandingFooter
        cmsSettings={cms}
        className="mt-auto"
      />

      {/* ========== REGISTRATION MODAL ========== */}
      <RegistrationModal
        open={registrationModalOpen}
        onClose={() => setRegistrationModalOpen(false)}
        defaultDivision={registrationDefaultDivision}
      />

      {/* ========== LOGIN MODAL ========== */}
      <UnifiedLoginModal
        open={loginModalOpen}
        onOpenChange={setLoginModalOpen}
        defaultTab={loginDefaultTab}
        onOpenRegistration={() => {
          setLoginModalOpen(false);
          setRegistrationDefaultDivision('male');
          setRegistrationModalOpen(true);
        }}
      />

      {/* ========== VIDEO MODAL ========== */}
      <VideoModal
        isOpen={videoModalOpen}
        onClose={() => setVideoModalOpen(false)}
        videoUrl={videoModalUrl}
        title={videoModalTitle}
      />

      {/* ========== PAYMENT MODAL ========== */}
      <PaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        division={paymentModalDivision}
      />

      {/* ========== DONATION MODAL ========== */}
      <DonationModal
        open={donationModalOpen}
        onOpenChange={setDonationModalOpen}
        defaultType="weekly"
        division={paymentModalDivision}
        tournamentId={donationTournamentId}
        cmsSettings={cms}
        onSuccess={() => {
          // Don't close DonationModal — let it show the result step
          // with "Terima Kasih" + payment info. User clicks "Selesai" to close.
        }}
      />

      {/* ========== SCROLL PROGRESS BAR ========== */}
      <ScrollProgress />

      {/* ========== BACK TO TOP BUTTON ========== */}
      <BackToTop />

      {/* ========== PLAYER PROFILE MODAL ========== */}
      {selectedPlayer && (
        <PlayerProfile
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
          rank={((selectedPlayer.division === 'male' ? maleData : femaleData)?.topPlayers?.findIndex(p => p.id === selectedPlayer.id) ?? -1) + 1}
          skinMap={(selectedPlayer.division === 'male' ? maleData : femaleData)?.skinMap}
          preferredSkinType={preferredSkinType || undefined}
        />
      )}

      {/* ========== CLUB PROFILE MODAL ========== */}
      {selectedClub && (
        <ClubProfile
          club={selectedClub}
          rank={(selectedClub as any).rank}
          onClose={() => setSelectedClub(null)}
          onPlayerClick={(player) => {
            // Find the player in the appropriate division's top players
            const searchDivision = player.division || 'male';
            const data = searchDivision === 'male' ? maleData : femaleData;
            const found = data?.topPlayers?.find(p => p.id === player.id);
            // preferredSkinType is auto-cleared by setSelectedPlayer wrapper
            if (found) {
              setSelectedPlayer({ ...found, division: searchDivision });
            } else {
              // Player not in topPlayers list — create a minimal profile
              setSelectedPlayer({
                id: player.id,
                name: player.name || player.gamertag,
                gamertag: player.gamertag,
                avatar: player.avatar,
                tier: player.tier || 'B',
                points: player.points || 0,
                totalWins: 0,
                streak: 0,
                maxStreak: 0,
                totalMvp: 0,
                matches: 0,
                division: searchDivision,
                city: (player as { city?: string }).city,
                club: selectedClub?.name || undefined,
              });
            }
          }}
        />
      )}
    </div>
  );
}
