'use client';

import { useQuery } from '@tanstack/react-query';
import { Swords, Heart, UserPlus, Crown, Clock, Zap } from 'lucide-react';
import { SectionHeader, GlassCard } from './shared';
import { useEffect, useState, useRef } from 'react';

/* ═══════════════════════════════════════════════════════════════
   ACTIVITY FEED SECTION
   Shows the latest 5 activities from the community
   Vertical timeline with icons and timestamps
   ═══════════════════════════════════════════════════════════════ */

/* ─── Feed Item type (matches /api/feed response) ─── */
interface FeedItem {
  id: string;
  type: 'transfer' | 'donation' | 'score' | 'champion' | 'mvp' | 'registration' | 'tournament_signup';
  icon: string;
  title: string;
  subtitle: string;
  timestamp: string;
  division?: string;
  accent: string;
}

/* ─── Activity type mapping to lucide icons ─── */
const activityIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  score: Swords,
  donation: Heart,
  registration: UserPlus,
  tournament_signup: UserPlus,
  mvp: Crown,
  champion: Crown,
  transfer: Zap,
};

const activityColorMap: Record<string, string> = {
  score: 'text-idm-male',
  donation: 'text-green-400',
  registration: 'text-idm-gold-warm',
  tournament_signup: 'text-amber-400',
  mvp: 'text-idm-gold-warm',
  champion: 'text-idm-gold-warm',
  transfer: 'text-idm-female',
};

const activityBgMap: Record<string, string> = {
  score: 'bg-idm-male/10 border-idm-male/20',
  donation: 'bg-green-500/10 border-green-500/20',
  registration: 'bg-idm-gold-warm/10 border-idm-gold-warm/20',
  tournament_signup: 'bg-amber-500/10 border-amber-500/20',
  mvp: 'bg-idm-gold-warm/10 border-idm-gold-warm/20',
  champion: 'bg-idm-gold-warm/10 border-idm-gold-warm/20',
  transfer: 'bg-idm-female/10 border-idm-female/20',
};

/* ─── Time ago helper ─── */
function timeAgo(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 0) return 'Baru saja';

  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) return 'Baru saja';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m lalu`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}j lalu`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}h lalu`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}mg lalu`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}bln lalu`;
}

/* ─── Skeleton ─── */
function FeedSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex items-start gap-3 animate-pulse">
          <div className="w-8 h-8 rounded-lg bg-idm-gold-warm/10 shrink-0" />
          <div className="flex-1 space-y-1.5 py-1">
            <div className="h-3 w-3/4 rounded bg-idm-gold-warm/10" />
            <div className="h-2.5 w-1/3 rounded bg-idm-gold-warm/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Animated Feed Item ─── */
function FeedItemRow({ item, index }: { item: FeedItem; index: number }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), index * 80);
    return () => clearTimeout(timer);
  }, [index]);

  const IconComponent = activityIconMap[item.type] || Zap;
  const iconColor = activityColorMap[item.type] || 'text-idm-gold-warm';
  const bgColor = activityBgMap[item.type] || 'bg-idm-gold-warm/10 border-idm-gold-warm/20';

  return (
    <div
      ref={ref}
      className={`flex items-start gap-3 transition-all duration-500 hover:translate-x-1 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
      }`}
    >
      {/* Icon */}
      <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shrink-0 border ${bgColor}`}>
        <IconComponent className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${iconColor}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 py-0.5">
        <p className="text-xs sm:text-sm font-medium text-foreground/90 leading-snug line-clamp-2">
          {item.title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {item.subtitle && (
            <span className="text-[10px] text-muted-foreground truncate max-w-[180px] sm:max-w-none">
              {item.subtitle}
            </span>
          )}
          <span className="flex items-center gap-1 text-[9px] text-muted-foreground/60 shrink-0">
            <Clock className="w-2.5 h-2.5" />
            {timeAgo(item.timestamp)}
          </span>
        </div>
      </div>

      {/* Division dot */}
      {item.division && (
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-2 ${
          item.division === 'male' ? 'bg-idm-male/50' : 'bg-idm-female/50'
        }`} title={item.division === 'male' ? 'Cowo' : 'Cewe'} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN ACTIVITY FEED SECTION
   ═══════════════════════════════════════════════════════════════ */
export function ActivityFeedSection() {
  const { data, isLoading, error } = useQuery<{ items: FeedItem[] }>({
    queryKey: ['activity-feed'],
    queryFn: async () => {
      const res = await fetch('/api/feed');
      if (!res.ok) throw new Error('Failed to fetch feed');
      return res.json();
    },
    staleTime: 60000,
    refetchInterval: 120000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const items = data?.items?.slice(0, 5) || [];

  return (
    <section className="landing-section relative py-6 sm:py-12 px-4 sm:px-6 lg:px-8 overflow-hidden bg-deep border-y border-border/30 dark:border-0" aria-label="Aktivitas Terbaru">
      {/* Background — dot pattern (shifted position) */}
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(239,249,35,0.5) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      {/* Radial glow — shifted to top-right for variety */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 70% 15%, rgba(239,249,35,0.04) 0%, transparent 50%), radial-gradient(ellipse at 30% 70%, rgba(46,159,255,0.03) 0%, transparent 40%)' }} />
      {/* Top edge glow */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-idm-gold-warm/25 to-transparent" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-idm-gold-warm/[2] to-transparent pointer-events-none" aria-hidden="true" />
      {/* Bottom edge glow */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-idm-gold-warm/12 to-transparent" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        {/* Section Header */}
        <SectionHeader
          icon={Zap}
          label="Aktivitas"
          title="Aktivitas Terbaru"
          subtitle="Yang terjadi di komunitas Tarkam IDM"
        />

        {/* Feed content */}
        <div className="max-w-xl mx-auto">
          {isLoading ? (
            <FeedSkeleton />
          ) : error || items.length === 0 ? (
            <div className="text-center py-8">
              <Zap className="w-10 h-10 text-idm-gold-warm/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {error ? 'Gagal memuat aktivitas' : 'Belum ada aktivitas'}
              </p>
            </div>
          ) : (
            <div className="relative space-y-3 sm:space-y-4 backdrop-blur-md bg-white/[0.03] dark:bg-white/[0.05] border border-white/[0.06] dark:border-white/[0.08] rounded-2xl p-4 shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
              {/* Timeline line */}
              <div className="absolute left-4 sm:left-[18px] top-4 bottom-4 w-px bg-gradient-to-b from-idm-gold-warm/15 via-idm-gold-warm/8 to-transparent" aria-hidden="true" />

              {items.map((item, idx) => (
                <FeedItemRow key={item.id} item={item} index={idx} />
              ))}

              {/* Fade-out gradient at bottom */}
              <div
                className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none"
                style={{
                  background: 'linear-gradient(to top, var(--background), transparent)',
                }}
                aria-hidden="true"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
