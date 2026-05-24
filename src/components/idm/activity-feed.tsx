'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, useRef, useCallback, useEffect } from 'react';
import { Activity, Clock, Loader2, ArrowUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Activity {
  id: string;
  type: 'registration' | 'match_result' | 'donation' | 'achievement';
  title: string;
  description: string;
  icon: string;
  timestamp: string;
  division?: string;
}

// Relative time formatter for Indonesian locale
function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Baru saja';
  if (diffMinutes < 60) return `${diffMinutes} menit lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  if (diffDays < 7) return `${diffDays} hari lalu`;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

/** Get opacity class based on activity age for visual hierarchy */
function getAgeOpacity(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffHours = (now.getTime() - date.getTime()) / 3600000;

  if (diffHours < 1) return 'opacity-100';       // Fresh — full opacity
  if (diffHours < 6) return 'opacity-90';         // Recent — slightly dimmed
  if (diffHours < 24) return 'opacity-75';        // Older — more dimmed
  return 'opacity-60';                             // Stale — most dimmed
}

const typeStyles = {
  registration: {
    dot: 'bg-cyan-400',
    border: 'border-cyan-500/20',
    bg: 'bg-cyan-500/5',
    text: 'text-cyan-400',
    glow: 'shadow-cyan-500/20',
  },
  match_result: {
    dot: 'bg-amber-400',
    border: 'border-amber-500/20',
    bg: 'bg-amber-500/5',
    text: 'text-amber-400',
    glow: 'shadow-amber-500/20',
  },
  donation: {
    dot: 'bg-pink-400',
    border: 'border-pink-500/20',
    bg: 'bg-pink-500/5',
    text: 'text-pink-400',
    glow: 'shadow-pink-500/20',
  },
  achievement: {
    dot: 'bg-purple-400',
    border: 'border-purple-500/20',
    bg: 'bg-purple-500/5',
    text: 'text-purple-400',
    glow: 'shadow-purple-500/20',
  },
};

/* framer-motion variants removed — replaced with CSS animations */

function ActivityItem({ activity }: { activity: Activity }) {
  const style = typeStyles[activity.type];
  const ageOpacity = getAgeOpacity(activity.timestamp);

  return (
    <div
      className={`activity-card-glass group relative flex gap-3 p-4 sm:p-5 rounded-lg ${style.bg} ${style.border} border transition-all hover:shadow-md ${style.glow} ${ageOpacity} animate-fade-enter-sm`}
    >
      {/* Timeline dot & line */}
      <div className="flex flex-col items-center shrink-0 pt-0.5">
        <div className={`w-2.5 h-2.5 rounded-full ${style.dot} ring-2 ring-background shadow-sm`} />
        <div className="w-px flex-1 bg-border/50 mt-1 min-h-[16px]" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-sm" role="img" aria-hidden="true">{activity.icon}</span>
              <span className={`text-xs font-semibold ${style.text}`}>{activity.title}</span>
            </div>
            <p className="text-sm text-foreground/80 truncate">{activity.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Clock className="w-3 h-3 text-muted-foreground/60" />
          <span className="text-[10px] text-muted-foreground/80">{formatRelativeTime(activity.timestamp)}</span>
          {activity.division && (
            <span className="text-[10px] text-muted-foreground/60">
              · {activity.division === 'male' ? 'Cowo' : 'Cewe'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-12 text-center animate-fade-enter"
    >
      <div className="animate-float-subtle mb-4">
        <Activity className="w-10 h-10 text-muted-foreground/30" />
      </div>
      <p className="text-sm text-muted-foreground/60 font-medium">Belum ada aktivitas</p>
      <p className="text-xs text-muted-foreground/40 mt-1">Aktivitas terbaru akan muncul di sini</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-3 p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-3 p-3 animate-pulse">
          <div className="w-2.5 h-2.5 rounded-full bg-muted shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="h-3 w-full rounded bg-muted/70" />
            <div className="h-2 w-16 rounded bg-muted/50" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ActivityFeed() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['activity-feed'],
    queryFn: async () => {
      const res = await fetch('/api/activity');
      if (!res.ok) throw new Error('Failed to fetch activity');
      return res.json();
    },
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const activities: Activity[] = data?.activities ?? [];
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setShowScrollTop(scrollRef.current.scrollTop > 120);
    }
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <Card className="perspective-card overflow-hidden relative h-full flex flex-col">
      <CardHeader className="pb-3 shrink-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="w-4 h-4 text-amber-400" />
          Aktivitas Terbaru
          {!isLoading && activities.length > 0 && (
            <span className="ml-auto text-[10px] text-muted-foreground font-normal flex items-center gap-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
              </span>
              Live
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="relative">
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">Gagal memuat aktivitas</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Coba lagi nanti</p>
          </div>
        ) : activities.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="relative">
            <div ref={scrollRef} className="max-h-80 lg:max-h-64 overflow-y-auto overflow-x-hidden custom-scrollbar pr-1">
              <div
                key={activities.map(a => a.id).join(',')}
                className="flex flex-col gap-2"
              >
                {activities.map((activity) => (
                  <ActivityItem key={activity.id} activity={activity} />
                ))}
              </div>
            </div>

            {/* Scroll to top button — appears when feed is scrolled down */}
            {showScrollTop && (
              <button
                onClick={scrollToTop}
                aria-label="Scroll to top of activity feed"
                className="scroll-top-btn-enter absolute bottom-2 right-2 z-20 w-8 h-8 rounded-full bg-idm-gold-warm/15 border border-idm-gold-warm/30 flex items-center justify-center text-idm-gold-warm hover:bg-idm-gold-warm/25 hover:border-idm-gold-warm/50 transition-all duration-200 cursor-pointer"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
