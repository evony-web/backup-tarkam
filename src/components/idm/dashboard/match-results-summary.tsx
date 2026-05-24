'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Trophy, Star, Clock, Swords } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { useAppStore } from '@/lib/store';

/* ─── Types ─── */
interface MatchPlayer {
  id: string;
  gamertag: string;
  avatar: string | null;
  tier: string;
}

interface MatchTeam {
  id: string | null;
  name: string;
  score: number | null;
  players: MatchPlayer[];
}

interface RecentMatch {
  id: string;
  tournamentName: string;
  weekNumber: number;
  team1: MatchTeam;
  team2: MatchTeam;
  winnerId: string | null;
  winnerName: string | null;
  mvpPlayer: {
    id: string;
    gamertag: string;
    avatar: string | null;
    tier: string;
  } | null;
  completedAt: string | null;
  format: string;
}

interface RecentMatchesData {
  matches: RecentMatch[];
}

/* ─── Helpers ─── */

/** Relative time in Indonesian */
function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Baru saja';
  if (diffMinutes < 60) return `${diffMinutes} mnt lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  if (diffDays < 30) return `${diffDays} hari lalu`;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

/* ─── Loading skeleton ─── */
function LoadingSkeleton() {
  const dt = useDivisionTheme();

  return (
    <Card className={`${dt.casinoCard} overflow-hidden`}>
      <div className={dt.casinoBar} />
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-36 rounded" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className={`flex items-center gap-2 p-3 rounded-lg ${i % 2 === 0 ? 'bg-muted/5' : ''}`}>
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-4 w-6 rounded" />
            <span className="text-[10px] text-muted-foreground/30">vs</span>
            <Skeleton className="h-4 w-6 rounded" />
            <Skeleton className="h-3 w-20 rounded flex-1" />
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ─── Empty state ─── */
function EmptyMatchResultsState() {
  const dt = useDivisionTheme();

  return (
    <Card className={`${dt.casinoCard} overflow-hidden`}>
      <div className={dt.casinoBar} />
      <div className="p-4 text-center">
        <CheckCircle2 className={`w-8 h-8 mx-auto mb-2 opacity-30 ${dt.text}`} />
        <p className="text-xs text-muted-foreground/70 mb-1">
          Belum ada hasil pertandingan
        </p>
        <p className="text-[10px] text-muted-foreground/50">
          Hasil match akan muncul di sini setelah turnamen selesai
        </p>
      </div>
    </Card>
  );
}

/* ─── Main Component ─── */
export function MatchResultsSummary() {
  const dt = useDivisionTheme();
  const division = useAppStore((s) => s.division);

  const { data, isLoading } = useQuery<RecentMatchesData>({
    queryKey: ['recent-matches', division],
    queryFn: async () => {
      const res = await fetch(`/api/matches/recent?division=${division}&limit=5`);
      if (!res.ok) throw new Error('Failed to fetch recent matches');
      return res.json();
    },
    staleTime: 30000,
  });

  if (isLoading) return <LoadingSkeleton />;

  const matches = data?.matches ?? [];

  if (matches.length === 0) return <EmptyMatchResultsState />;

  return (
    <Card className={`${dt.casinoCard} overflow-hidden`}>
      <div className={dt.casinoBar} />

      {/* Header */}
      <div className={`flex items-center gap-2.5 px-4 py-3 border-b ${dt.borderSubtle}`}>
        <div className={`w-5 h-5 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
          <CheckCircle2 className={`w-3 h-3 text-green-400`} />
        </div>
        <h3 className="text-xs font-semibold uppercase tracking-wider">Hasil Pertandingan</h3>
        <Badge className={`${dt.casinoBadge} ml-auto text-[9px] shrink-0`}>
          <Swords className="w-2.5 h-2.5 mr-0.5" />
          {matches.length}
        </Badge>
      </div>

      <div className="max-h-96 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {matches.map((match, i) => {
          const team1Won = match.winnerId === match.team1.id;
          const team2Won = match.winnerId === match.team2.id;

          return (
            <div
              key={match.id}
              className={`flex items-center gap-2 px-4 py-2.5 transition-colors hover:bg-idm-gold-warm/5 ${
                i % 2 === 0 ? 'bg-transparent' : 'bg-muted/[0.03]'
              } ${i < matches.length - 1 ? `border-b ${dt.borderSubtle}` : ''}`}
            >
              {/* Team 1 */}
              <div className={`flex-1 min-w-0 text-right ${team1Won ? '' : 'opacity-60'}`}>
                <p className={`text-[11px] font-semibold truncate ${team1Won ? 'text-idm-gold-warm' : ''}`}>
                  {match.team1.name}
                  {team1Won && <Trophy className="w-2.5 h-2.5 inline ml-1" />}
                </p>
                <p className="text-[9px] text-muted-foreground/50 truncate">
                  {match.team1.players.map((p) => p.gamertag).join(', ')}
                </p>
              </div>

              {/* Score */}
              <div className="flex items-center gap-1.5 shrink-0 px-1">
                <span className={`text-sm font-black tabular-nums w-5 text-center ${
                  team1Won ? 'text-idm-gold-warm' : 'text-muted-foreground'
                }`}>
                  {match.team1.score ?? '-'}
                </span>
                <span className="text-[10px] text-muted-foreground/40">vs</span>
                <span className={`text-sm font-black tabular-nums w-5 text-center ${
                  team2Won ? 'text-idm-gold-warm' : 'text-muted-foreground'
                }`}>
                  {match.team2.score ?? '-'}
                </span>
              </div>

              {/* Team 2 */}
              <div className={`flex-1 min-w-0 text-left ${team2Won ? '' : 'opacity-60'}`}>
                <p className={`text-[11px] font-semibold truncate ${team2Won ? 'text-idm-gold-warm' : ''}`}>
                  {team2Won && <Trophy className="w-2.5 h-2.5 inline mr-1" />}
                  {match.team2.name}
                </p>
                <p className="text-[9px] text-muted-foreground/50 truncate">
                  {match.team2.players.map((p) => p.gamertag).join(', ')}
                </p>
              </div>

              {/* MVP badge */}
              {match.mvpPlayer && (
                <Badge
                  className="shrink-0 text-[8px] px-1.5 py-0 h-4 bg-amber-500/15 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                >
                  <Star className="w-2 h-2 mr-0.5" />
                  {match.mvpPlayer.gamertag}
                </Badge>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer with last update time */}
      {matches[0]?.completedAt && (
        <div className={`flex items-center gap-1.5 px-4 py-2 border-t ${dt.borderSubtle}`}>
          <Clock className="w-2.5 h-2.5 text-muted-foreground/40" />
          <span className="text-[9px] text-muted-foreground/50">
            Terakhir: {formatRelativeTime(matches[0].completedAt)}
          </span>
        </div>
      )}
    </Card>
  );
}
