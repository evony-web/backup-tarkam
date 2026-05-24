'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Trophy, History, Award, Shield, Crown,
  Calendar, TrendingUp, Minus,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getDivisionTheme } from '@/hooks/use-division-theme';

/* ─── Types ─── */
interface SeasonStatEntry {
  seasonId: string;
  seasonName: string;
  seasonNumber: number;
  seasonStatus: string;
  division: string;
  points: number;
  totalWins: number;
  totalMvp: number;
  streak: number;
  maxStreak: number;
  matches: number;
  rank: number | null;
  tier: string;
  champion: { id: string; gamertag: string; avatar?: string | null } | null;
  championClub: { id: string; name: string; logo?: string | null } | null;
  championPoints: number | null;
  startDate: string;
  endDate: string | null;
}

interface SeasonStatsResponse {
  player: {
    id: string;
    gamertag: string;
    division: string;
    currentTier: string;
    currentClub: string | null;
  };
  seasons: SeasonStatEntry[];
}

interface PlayerSeasonHistoryProps {
  playerId: string;
  playerDivision: string;
  /** Current season stats for the "active" row */
  currentPoints: number;
  currentTier: string;
  currentClub?: string | null;
}

/* ─── Season History Card (one per season) ─── */
function SeasonCard({
  seasonStat,
  isCurrentSeason,
  playerDivision,
  currentTier,
  currentClub,
}: {
  seasonStat: SeasonStatEntry;
  isCurrentSeason: boolean;
  playerDivision: string;
  currentTier: string;
  currentClub: string | null;
}) {
  const dt = getDivisionTheme(playerDivision as 'male' | 'female');

  const statusLabel = seasonStat.seasonStatus === 'completed'
    ? 'Selesai'
    : seasonStat.seasonStatus === 'active'
      ? 'Berlangsung'
      : 'Akan Datang';

  const statusColor = seasonStat.seasonStatus === 'completed'
    ? 'bg-green-500/10 text-green-500 border-green-500/20'
    : seasonStat.seasonStatus === 'active'
      ? `${dt.casinoBadge}`
      : 'bg-muted/20 text-muted-foreground border-muted/30';

  const points = seasonStat.points;
  const rank = seasonStat.rank;
  const tier = seasonStat.tier || currentTier;
  const club = seasonStat.seasonStatus === 'active' ? currentClub : null;

  return (
    <div className={`rounded-2xl border p-3 transition-colors ${
      isCurrentSeason
        ? `${dt.bgSubtle} ${dt.borderSubtle}`
        : 'bg-muted/5 border-border/10'
    }`}>
      {/* Season header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isCurrentSeason ? (
            <div className={`w-6 h-6 rounded-md ${dt.bgSubtle} border ${dt.borderSubtle} flex items-center justify-center`}>
              <TrendingUp className={`w-3 h-3 ${dt.text}`} />
            </div>
          ) : (
            <div className="w-6 h-6 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <History className="w-3 h-3 text-amber-400" />
            </div>
          )}
          <div>
            <span className="text-xs font-bold">{seasonStat.seasonName}</span>
            {isCurrentSeason && (
              <span className={`ml-1.5 text-[9px] ${dt.text} font-semibold`}>• Saat ini</span>
            )}
          </div>
        </div>
        <Badge className={`${statusColor} text-[8px] border`}>
          {statusLabel}
        </Badge>
      </div>

      {/* Player stats for this season */}
      {points > 0 || rank !== null ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Rank */}
            {rank != null && rank > 0 && (
              <div className="flex items-center gap-1">
                {rank === 1 ? (
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                ) : rank <= 3 ? (
                  <Trophy className="w-3 h-3 text-amber-500" />
                ) : (
                  <Award className="w-3 h-3 text-muted-foreground" />
                )}
                <span className={`text-xs font-bold ${
                  rank === 1 ? 'text-amber-400' :
                  rank <= 3 ? 'text-amber-500' :
                  'text-foreground'
                }`}>
                  #{rank}
                </span>
              </div>
            )}

            {/* Separator */}
            {rank != null && rank > 0 && (
              <span className="text-border text-[10px]">•</span>
            )}

            {/* Points */}
            <span className={`text-xs font-bold ${dt.neonGradient}`}>
              {points} pts
            </span>

            {/* Separator */}
            <span className="text-border text-[10px]">•</span>

            {/* Champion badge */}
            {rank === 1 && seasonStat.seasonStatus === 'completed' && (
              <>
                <span className="text-border text-[10px]">•</span>
                <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/25 text-[7px]">
                  🏆 Champion
                </Badge>
              </>
            )}
          </div>

          {/* Club */}
          {club && (
            <div className="flex items-center gap-1.5">
              <Shield className={`w-3 h-3 ${dt.text}`} />
              <span className={`text-[10px] ${dt.text} font-medium`}>{club}</span>
            </div>
          )}

          {/* Extra stats for completed seasons */}
          {seasonStat.seasonStatus === 'completed' && (seasonStat.totalWins > 0 || seasonStat.totalMvp > 0 || seasonStat.matches > 0) && (
            <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
              {seasonStat.matches > 0 && <span>{seasonStat.matches} match</span>}
              {seasonStat.totalWins > 0 && <><span className="text-border">•</span><span>{seasonStat.totalWins}W</span></>}
              {seasonStat.totalMvp > 0 && <><span className="text-border">•</span><span>{seasonStat.totalMvp} MVP</span></>}
              {seasonStat.maxStreak > 0 && <><span className="text-border">•</span><span>🔥{seasonStat.maxStreak} streak</span></>}
            </div>
          )}
        </div>
      ) : isCurrentSeason ? (
        /* Current season with 0 points */
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Saat ini:
          </span>
          <span className={`text-xs font-bold ${dt.neonGradient}`}>
            0 pts
          </span>
          <span className="text-border text-[10px]">•</span>
          {currentClub && (
            <>
              <span className="text-border text-[10px]">•</span>
              <div className="flex items-center gap-1">
                <Shield className={`w-2.5 h-2.5 ${dt.text}`} />
                <span className={`text-[10px] ${dt.text}`}>{currentClub}</span>
              </div>
            </>
          )}
        </div>
      ) : (
        /* Completed season with no participation */
        <div className="flex items-center gap-1.5">
          <Minus className="w-3 h-3 text-muted-foreground/40" />
          <span className="text-[10px] text-muted-foreground/60 italic">Tidak berpartisipasi</span>
        </div>
      )}
    </div>
  );
}

/* ─── Loading Skeleton ─── */
function SeasonHistorySkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-muted/10 border border-border/10 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-muted/20" />
              <div className="h-3 w-24 bg-muted/20 rounded" />
            </div>
            <div className="h-4 w-14 bg-muted/20 rounded-full" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-16 bg-muted/15 rounded" />
            <div className="h-3 w-12 bg-muted/15 rounded" />
            <div className="h-3 w-8 bg-muted/15 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Component ─── */
export function PlayerSeasonHistory({
  playerId,
  playerDivision,
  currentPoints,
  currentTier,
  currentClub,
}: PlayerSeasonHistoryProps) {
  const dt = getDivisionTheme(playerDivision as 'male' | 'female');

  // Fetch season stats from our new PlayerSeasonStats-based API
  const { data: statsData, isLoading } = useQuery<SeasonStatsResponse>({
    queryKey: ['player-season-stats', playerId],
    queryFn: async () => {
      const res = await fetch(`/api/players/${playerId}/season-stats`);
      if (!res.ok) throw new Error('Failed to fetch season stats');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!playerId,
  });

  if (isLoading) {
    return (
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2.5">
          <History className={`w-4 h-4 ${dt.text}`} />
          <h3 className="text-sm font-semibold">Riwayat Season</h3>
        </div>
        <SeasonHistorySkeleton />
      </div>
    );
  }

  const seasonStats = statsData?.seasons || [];

  // Don't render if there are no seasons at all
  if (seasonStats.length === 0 && currentPoints === 0) return null;

  // Combine historical stats + active season entry
  const allEntries: SeasonStatEntry[] = [];

  // Add historical seasons from API
  for (const stat of seasonStats) {
    if (stat.seasonStatus === 'completed') {
      allEntries.push(stat);
    }
  }

  // Add active season (current live stats)
  const hasActiveInStats = seasonStats.some(s => s.seasonStatus === 'active');
  if (!hasActiveInStats) {
    // Create an active season entry from current live stats
    allEntries.push({
      seasonId: 'current',
      seasonName: `Season 2 - ${playerDivision === 'male' ? 'Cowo' : 'Cewe'}`,
      seasonNumber: 2,
      seasonStatus: 'active',
      division: playerDivision,
      points: currentPoints,
      totalWins: 0,
      totalMvp: 0,
      streak: 0,
      maxStreak: 0,
      matches: 0,
      rank: null,
      tier: currentTier,
      champion: null,
      championClub: null,
      championPoints: null,
      startDate: new Date().toISOString(),
      endDate: null,
    });
  }

  // Sort: newest first
  allEntries.sort((a, b) => b.seasonNumber - a.seasonNumber);

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2.5">
        <History className={`w-4 h-4 ${dt.text}`} />
        <h3 className="text-sm font-semibold">Riwayat Season</h3>
        <Badge className={`${dt.casinoBadge} text-[8px] ml-auto`}>
          {allEntries.length} SEASON
        </Badge>
      </div>

      <div className={`p-4 sm:p-5 rounded-2xl ${dt.bgSubtle} border ${dt.borderSubtle} space-y-2`}>
        {allEntries.map((stat) => (
          <SeasonCard
            key={stat.seasonId}
            seasonStat={stat}
            isCurrentSeason={stat.seasonStatus === 'active'}
            playerDivision={playerDivision}
            currentTier={currentTier}
            currentClub={currentClub || null}
          />
        ))}

        {allEntries.length === 0 && (
          <div className="text-center py-3">
            <Calendar className={`w-5 h-5 ${dt.text} mx-auto mb-1.5 opacity-40`} />
            <p className="text-xs text-muted-foreground">Belum ada riwayat season</p>
          </div>
        )}
      </div>
    </div>
  );
}
