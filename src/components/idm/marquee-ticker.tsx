'use client';

import React, { useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { hexToRgba, formatCurrency } from '@/lib/utils';
import type { StatsData } from '@/types/stats';

/* ═══════════════════════════════════════════════════════════════
   TARKAM IDM — ESPN-STYLE MARQUEE TICKER
   ★ OPTIMIZED: CSS animation replaces rAF for compositor-thread
   scrolling — eliminates main-thread INP impact entirely.
   ═══════════════════════════════════════════════════════════════ */

/* ========== Speed Configuration ========== */
// Duration in seconds for one full scroll cycle — longer = slower (more readable)
// Smooth & readable: slow enough to comfortably read, still feels alive
const DESKTOP_DURATION = 90;
const MOBILE_DURATION = 110;
const MOBILE_BREAKPOINT = 768;

/* ========== Feed Item Types ========== */
interface FeedItem {
  id: string;
  type: 'transfer' | 'donation' | 'score' | 'champion' | 'mvp' | 'registration' | 'tournament_signup' | 'stat';
  icon: string;
  title: string;
  subtitle: string;
  timestamp: string;
  division?: string;
  accent: string;
  numericValue?: number;
}

/* ========== Time Formatter ========== */
function formatTimeAgo(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Baru';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}j`;
  if (days < 7) return `${days}h`;
  return new Date(timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

/* ========== Accent colors per type ========== */
const TYPE_ACCENT: Record<FeedItem['type'], string> = {
  champion: '#EFF923',
  mvp: '#eab308',
  donation: '#22c55e',
  score: '#2E9FFF',
  transfer: '#FF2D78',
  registration: '#57B5FF',
  tournament_signup: '#f59e0b',
  stat: '#EFF923',
};

/* ========== Light-mode accent overrides ========== */
const LIGHT_ACCENT_MAP: Record<string, string> = {
  '#EFF923': '#92780C',
  '#eab308': '#92780C',
  '#f59e0b': '#B8860B',
};

function resolveAccent(hex: string, isLight: boolean): string {
  if (!isLight) return hex;
  const upper = hex.toUpperCase();
  for (const [bright, dark] of Object.entries(LIGHT_ACCENT_MAP)) {
    if (upper === bright.toUpperCase()) return dark;
  }
  return hex;
}

/* ========== Pre-computed card style cache ========== */
// Avoids re-computing hexToRgba on every render
const styleCache = new Map<string, { bg: string; border: string; shadow: string; timeColor: string; timeBg: string }>();
function getCardStyles(accent: string) {
  const cached = styleCache.get(accent);
  if (cached) return cached;
  const styles = {
    bg: `linear-gradient(135deg, ${hexToRgba(accent, 0x08)} 0%, ${hexToRgba(accent, 0x03)} 100%)`,
    border: hexToRgba(accent, 0x20),
    shadow: `drop-shadow(0 0 4px ${hexToRgba(accent, 0x40)})`,
    timeColor: hexToRgba(accent, 0xaa),
    timeBg: hexToRgba(accent, 0x10),
  };
  styleCache.set(accent, styles);
  return styles;
}

/* ========== Single Feed Card — Optimized: no useTheme per card ========== */
function FeedCard({ item, isLight }: { item: FeedItem; isLight: boolean }) {
  const rawAccent = item.accent || TYPE_ACCENT[item.type] || '#EFF923';
  const accent = resolveAccent(rawAccent, isLight);
  const isStat = item.type === 'stat';
  const styles = getCardStyles(accent);

  const displayTitle = isStat && item.numericValue && item.numericValue > 0
    ? item.numericValue.toLocaleString('id-ID')
    : item.title;

  return (
    <div
      className="flex items-center gap-2 px-3.5 py-1.5 rounded-md shrink-0 border select-none"
      style={{ background: styles.bg, borderColor: styles.border }}
    >
      <span
        className="text-sm shrink-0"
        style={{ filter: styles.shadow }}
      >
        {item.icon}
      </span>

      <p
        className={`font-bold whitespace-nowrap truncate max-w-[180px] sm:max-w-[220px] ${
          isStat ? 'text-xs' : 'text-[11px] sm:text-xs'
        }`}
        style={{ color: isStat ? accent : undefined }}
      >
        {displayTitle}
      </p>

      {item.subtitle && (
        <>
          <span className="text-muted-foreground/20 shrink-0 text-[8px]">◆</span>
          <p className="text-[10px] text-muted-foreground/70 truncate max-w-[100px] sm:max-w-[130px] hidden sm:block">
            {item.subtitle}
          </p>
        </>
      )}

      {!isStat && (
        <span
          className="text-[9px] font-medium shrink-0 tabular-nums px-1.5 py-0.5 rounded"
          style={{ color: styles.timeColor, background: styles.timeBg }}
        >
          {formatTimeAgo(item.timestamp)}
        </span>
      )}

      {!isStat && item.division && (
        <span
          className="w-2 h-2 rounded-full shrink-0 ring-1 ring-offset-1 ring-offset-background"
          style={{
            backgroundColor: item.division === 'male' ? '#2E9FFF' : '#FF2D78',
          }}
        />
      )}
    </div>
  );
}

/* ========== Separator ========== */
function Separator() {
  return (
    <span className="text-[8px] text-idm-gold-warm/25 shrink-0 mx-1 select-none">◆</span>
  );
}

/* ========== Combined Marquee Props ========== */
interface UnifiedMarqueeProps {
  maleData?: StatsData;
  femaleData?: StatsData;
}

/* ========== Unified Marquee — CSS animation (compositor thread) ========== */
export function MarqueeTicker({ maleData, femaleData }: UnifiedMarqueeProps = {}) {
  const qc = useQueryClient();
  const trackRef = useRef<HTMLDivElement>(null);
  const isMobileRef = useRef(false);
  const [resizeTick, setResizeTick] = React.useState(0);

  // Track mobile via ref + force re-render on resize
  useEffect(() => {
    isMobileRef.current = window.innerWidth < MOBILE_BREAKPOINT;
    const onResize = () => {
      const now = window.innerWidth < MOBILE_BREAKPOINT;
      if (isMobileRef.current !== now) {
        isMobileRef.current = now;
        setResizeTick(t => t + 1);
      }
    };
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isMobile = isMobileRef.current;

  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';

  const { data } = useQuery<{ items: FeedItem[] }>({
    queryKey: ['feed'],
    queryFn: async () => {
      const res = await fetch('/api/feed');
      if (!res.ok) throw new Error('Feed fetch failed');
      return res.json();
    },
    staleTime: 120000,
    refetchInterval: 300000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false, // ★ OPTIMIZED: don't refetch on focus — reduces INP
    refetchOnReconnect: true,
    placeholderData: (prev) => prev,
  });

  // Pusher real-time — ★ deferred to idle to avoid competing with initial interactions (INP)
  // ★ OPTIMIZED: debounce invalidation to max once per 30s
  useEffect(() => {
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!pusherKey || !pusherCluster) return;

    let pusher: any;
    let channel: any;
    let idleId: number | ReturnType<typeof setTimeout> | undefined;
    let debounceRef: ReturnType<typeof setTimeout> | undefined;

    const connectPusher = () => {
      import('pusher-js').then(({ default: PusherJS }) => {
        pusher = new PusherJS(pusherKey, { cluster: pusherCluster });
        channel = pusher.subscribe('idm-feed');
        // ★ Debounce: max one invalidation per 30 seconds
        channel.bind('feed-updated', () => {
          clearTimeout(debounceRef);
          debounceRef = setTimeout(() => {
            qc.invalidateQueries({ queryKey: ['feed'] });
          }, 30000);
        });
      }).catch(() => {});
    };

    // Defer Pusher connection until idle — reduces main thread work during initial load
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = (window as unknown as { requestIdleCallback(cb: () => void, opts?: { timeout: number }): number })
        .requestIdleCallback(connectPusher, { timeout: 5000 }); // ★ increased timeout from 3s to 5s
    } else {
      idleId = setTimeout(connectPusher, 5000); // ★ increased from 2s to 5s
    }

    return () => {
      clearTimeout(debounceRef);
      if (idleId !== undefined) {
        if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
          (window as unknown as { cancelIdleCallback(id: number): void }).cancelIdleCallback(idleId as unknown as number);
        } else {
          clearTimeout(idleId as ReturnType<typeof setTimeout>);
        }
      }
      if (channel) {
        channel.unbind_all();
        channel.unsubscribe();
      }
      if (pusher) pusher.disconnect();
    };
  }, [qc]);

  // Build combined items
  const combinedItems = useMemo(() => {
    const stats: FeedItem[] = [];

    const totalPlayers = (maleData?.totalPlayers || 0) + (femaleData?.totalPlayers || 0);
    const totalPrizePool = (maleData?.activeTournamentPrizePool ?? maleData?.totalPrizePool ?? 0) + (femaleData?.activeTournamentPrizePool ?? femaleData?.totalPrizePool ?? 0);
    const totalMatches = (maleData?.recentMatches?.length || 0) + (femaleData?.recentMatches?.length || 0);
    const totalClubs = (maleData?.clubs?.length || 0) + (femaleData?.clubs?.length || 0);
    const completedMatches = 0;
    const seasonInfo = 'Season Berjalan';

    stats.push(
      { id: 'stat-players', type: 'stat', icon: '👥', title: `${totalPlayers}`, subtitle: 'Total Pemain', timestamp: new Date().toISOString(), accent: '#57B5FF', numericValue: totalPlayers },
      { id: 'stat-clubs', type: 'stat', icon: '🏛️', title: `${totalClubs}`, subtitle: 'Total Klub', timestamp: new Date().toISOString(), accent: '#EFF923', numericValue: totalClubs },
    );

    if (totalPrizePool > 0) {
      stats.push({ id: 'stat-prize', type: 'stat', icon: '💰', title: formatCurrency(totalPrizePool), subtitle: 'Hadiah', timestamp: new Date().toISOString(), accent: '#22c55e', numericValue: totalPrizePool });
    }

    if (totalMatches > 0) {
      stats.push({ id: 'stat-matches', type: 'stat', icon: '⚔️', title: `${totalMatches}`, subtitle: 'Pertandingan', timestamp: new Date().toISOString(), accent: '#FF2D78', numericValue: totalMatches });
    }

    if (completedMatches > 0 && completedMatches !== totalMatches) {
      stats.push({ id: 'stat-completed', type: 'stat', icon: '✅', title: `${completedMatches}`, subtitle: 'Selesai', timestamp: new Date().toISOString(), accent: '#22c55e', numericValue: completedMatches });
    }

    stats.push(
      { id: 'stat-season', type: 'stat', icon: '📅', title: seasonInfo, subtitle: 'Season Berjalan', timestamp: new Date().toISOString(), accent: '#f59e0b' },
    );

    const feedItems = (data?.items && data.items.length > 0) ? data.items : [];

    return [...stats, ...feedItems];
  }, [data?.items, maleData, femaleData]);

  // Build the track with separators
  const trackContent = useMemo(() => {
    const elements: React.ReactNode[] = [];
    combinedItems.forEach((item, i) => {
      elements.push(<FeedCard key={`card-${item.id}-${i}`} item={item} isLight={isLight} />);
      if (i < combinedItems.length - 1) {
        elements.push(<Separator key={`sep-${i}`} />);
      }
    });
    return elements;
  }, [combinedItems, isLight]);

  // ★ CSS animation duration based on content count and device
  const scrollDuration = useMemo(() => {
    // More items = longer duration, but cap the factor so it never feels stalled
    const baseDuration = isMobile ? MOBILE_DURATION : DESKTOP_DURATION;
    const itemFactor = Math.max(1, Math.min(combinedItems.length / 10, 2.5));
    return Math.round(baseDuration * itemFactor);
  }, [combinedItems.length, isMobile, resizeTick]);

  if (combinedItems.length === 0) return <div className="w-full h-10" />;

  return (
    <div className="w-full overflow-hidden relative group">
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-12 sm:w-20 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to right, hsl(var(--background)), transparent)' }}
      />
      <div className="absolute right-0 top-0 bottom-0 w-12 sm:w-20 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to left, hsl(var(--background)), transparent)' }}
      />

      {/* Scrolling track — 2x for seamless loop, CSS animation on compositor thread */}
      <div
        ref={trackRef}
        className="flex items-center marquee-track"
        style={{
          width: 'max-content',
          willChange: 'transform',
          animation: `marquee-scroll ${scrollDuration}s linear infinite`,
        }}
      >
        {trackContent}
        {trackContent}
      </div>
    </div>
  );
}
