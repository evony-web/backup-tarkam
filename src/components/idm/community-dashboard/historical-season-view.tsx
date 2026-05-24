'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Trophy, Crown, Medal, Users, Calendar, Shield,
  ArrowLeft, Star, Building2, Gamepad2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { SelectedSeason } from './season-selector';

/* ═══════════════════════════════════════════
   Types for Season Detail API Response
   (matches actual /api/seasons/[id] response)
   ═══════════════════════════════════════════ */
interface StandingPlayer {
  id: string;
  gamertag: string;
  division: string;
  avatar: string | null;
  points: number;
  rank: number | null;
  tier: string;
  club: string | null;
  tournamentCount: number;
}

interface StandingClub {
  id: string;
  profileId: string;
  division: string;
  seasonId: string;
  wins: number;
  losses: number;
  points: number;
  gameDiff: number;
  profile: {
    id: string;
    name: string;
    logo: string | null;
  };
  _count: {
    homeMatches: number;
    awayMatches: number;
  };
}

interface ChampionPlayer {
  id: string;
  gamertag: string;
  division: string;
  avatar: string | null;
  points: number;
}

interface ChampionClub {
  id: string;
  name: string;
  logo: string | null;
}

interface SeasonDetailResponse {
  id: string;
  name: string;
  number: number;
  division: string;
  status: string;
  startDate: string;
  endDate: string | null;
  championPlayer: ChampionPlayer | null;
  championClub: ChampionClub | null;
  championPlayerPoints: number | null;
  championPlayerSnapshot: Record<string, unknown> | null;
  championClubSnapshot: Record<string, unknown> | null;
  players: StandingPlayer[];
  clubs: StandingClub[];
  tournaments: unknown[];
  donations: unknown[];
  _count: { tournaments: number; clubs: number; donations: number };
}

/* ═══════════════════════════════════════════
   Historical Banner — Shows viewing past season
   ═══════════════════════════════════════════ */
function HistoricalBanner({ season }: { season: SelectedSeason }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/8 via-amber-500/5 to-transparent p-4">
      <div className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 10% 50%, rgba(245,158,11,0.08) 0%, transparent 60%)',
        }}
      />
      <div className="relative z-10 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-amber-500/15 flex items-center justify-center shrink-0">
          <Trophy className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-amber-400">
              Season {season.number} (Completed)
            </h3>
            <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/25 text-[10px]">
              🏆 Historical Data
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Viewing archived results from {season.name}
            {season.startDate && season.endDate && (
              <> · {new Date(season.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - {new Date(season.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</>
            )}
          </p>
        </div>
        <Badge className={`${season.division === 'male' ? 'bg-idm-male/15 text-idm-male border-idm-male/25' : 'bg-idm-female/15 text-idm-female border-idm-female/25'} text-[10px] border shrink-0`}>
          {season.division === 'male' ? '🕺 Cowo' : '💃 Cewe'}
        </Badge>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Champion Card — Shows season champion
   ═══════════════════════════════════════════ */
function ChampionCard({ season, championPoints }: { season: SeasonDetailResponse; championPoints: number | null }) {
  const isMale = season.division === 'male';

  // Prefer snapshot data for completed seasons
  const snapshot = season.championPlayerSnapshot as Record<string, string | number | null> | null;
  const championGamertag = (snapshot?.gamertag as string) || season.championPlayer?.gamertag || '-';
  const championClub = (snapshot?.club as string) || season.championClub?.name || null;

  return (
    <Card className={`${isMale ? 'border-idm-male/20' : 'border-idm-female/20'} overflow-hidden`}>
      <div className={`h-1 ${isMale ? 'bg-gradient-to-r from-idm-male/60 to-idm-male/20' : 'bg-gradient-to-r from-idm-female/60 to-idm-female/20'}`} />
      <CardContent className="p-5 relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <Crown className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider">Season {season.number} Champion</h3>
        </div>

        {season.championPlayer || season.championPlayerSnapshot ? (
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl ${isMale ? 'bg-idm-male/15 border-idm-male/25' : 'bg-idm-female/15 border-idm-female/25'} border flex items-center justify-center shrink-0`}>
              <Crown className={`w-6 h-6 ${isMale ? 'text-idm-male' : 'text-idm-female'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold truncate">{championGamertag}</span>
                <Badge className="bg-amber-500/15 text-amber-400 border-0 text-[10px]">
                  🏆 Champion
                </Badge>
              </div>
              {championPoints != null && (
                <div className="flex items-center gap-3 mt-1">
                  <span className={`text-lg font-black ${isMale ? 'text-idm-male' : 'text-idm-female'}`}>
                    {championPoints}
                  </span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Points</span>
                </div>
              )}
              {championClub && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Building2 className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{championClub}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No champion recorded
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════
   Standings List — Player rankings card-per-row
   ═══════════════════════════════════════════ */
function StandingsTable({ standings, division }: { standings: StandingPlayer[]; division: string }) {
  const isMale = division === 'male';

  if (standings.length === 0) {
    return (
      <div className="p-8 text-center">
        <Gamepad2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Tidak ada data pemain</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-0.5">
      {standings.map((player, idx) => {
        const rank = player.rank || idx + 1;
        const isTop3 = rank <= 3;
        return (
          <div
            key={player.id}
            className={`rounded-xl border transition-all duration-200 ${
              rank === 1
                ? 'bg-gradient-to-br from-idm-gold-warm/[0.06] via-card/80 to-idm-gold-warm/[0.03] border-idm-gold-warm/20 shadow-[0_0_10px_rgba(239,249,35,0.06),0_0_20px_rgba(239,249,35,0.03)]'
                : isTop3
                  ? 'bg-card/60 border-border/30'
                  : idx % 2 === 0
                    ? 'bg-card/50 border-border/20'
                    : 'bg-card/35 border-border/15'
            }`}
          >
            <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3">
              {/* Rank */}
              <span className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-sm sm:text-base font-bold shrink-0 ${
                rank === 1
                  ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-black shadow-md shadow-yellow-500/25'
                  : rank === 2
                    ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-black shadow-md shadow-gray-400/20'
                    : rank === 3
                      ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white shadow-md shadow-amber-600/20'
                      : 'bg-muted text-muted-foreground'
              }`}>{rank}</span>

              {/* Player info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={`text-sm sm:text-base font-semibold truncate ${isTop3 ? 'text-foreground' : 'text-foreground/80'}`}>
                    {player.gamertag}
                  </span>
                  {rank === 1 && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
                </div>
                {player.club && <p className="text-xs text-muted-foreground truncate">{player.club}</p>}
              </div>

              {/* Points */}
              <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-border/40 shrink-0">
                <div className="text-center min-w-[36px]">
                  <p className={`text-sm sm:text-base font-bold tabular-nums ${isTop3 ? (isMale ? 'text-idm-male' : 'text-idm-female') : 'text-foreground/70'}`}>
                    {player.points}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase">pts</p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Club Rankings — Card-per-row design
   ═══════════════════════════════════════════ */
function ClubRankingsTable({ clubs }: { clubs: StandingClub[] }) {
  if (clubs.length === 0) {
    return (
      <div className="p-8 text-center">
        <Building2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Tidak ada data klub</p>
      </div>
    );
  }

  // Sort by points descending
  const sortedClubs = [...clubs].sort((a, b) => b.points - a.points);

  return (
    <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-0.5">
      {sortedClubs.map((club, idx) => {
        const rank = idx + 1;
        const isTop3 = rank <= 3;
        return (
          <div
            key={club.id}
            className={`rounded-xl border transition-all duration-200 ${
              rank === 1
                ? 'bg-gradient-to-br from-idm-gold-warm/[0.06] via-card/80 to-idm-gold-warm/[0.03] border-idm-gold-warm/20 shadow-[0_0_10px_rgba(239,249,35,0.06),0_0_20px_rgba(239,249,35,0.03)]'
                : isTop3
                  ? 'bg-card/60 border-border/30'
                  : idx % 2 === 0
                    ? 'bg-card/50 border-border/20'
                    : 'bg-card/35 border-border/15'
            }`}
          >
            <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3">
              {/* Rank */}
              <span className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-sm sm:text-base font-bold shrink-0 ${
                rank === 1
                  ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-black shadow-md shadow-yellow-500/25'
                  : rank === 2
                    ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-black shadow-md shadow-gray-400/20'
                    : rank === 3
                      ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white shadow-md shadow-amber-600/20'
                      : 'bg-muted text-muted-foreground'
              }`}>{rank}</span>

              {/* Club logo + info */}
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg overflow-hidden shrink-0">
                {club.profile?.logo ? (
                  <img src={club.profile.logo} alt={club.profile.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-muted/30 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={`text-sm sm:text-base font-semibold truncate ${isTop3 ? 'text-foreground' : 'text-foreground/80'}`}>
                    {club.profile?.name || 'Unknown'}
                  </span>
                  {rank === 1 && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-border/40 shrink-0">
                <div className="hidden sm:block text-center min-w-[36px]">
                  <p className="text-xs text-muted-foreground tabular-nums">{club.wins}/{club.losses}</p>
                  <p className="text-[10px] text-muted-foreground">W/L</p>
                </div>
                <div className="text-center min-w-[36px]">
                  <p className={`text-sm sm:text-base font-bold tabular-nums ${isTop3 ? 'text-idm-gold-warm' : 'text-foreground/70'}`}>
                    {club.points}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase">pts</p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Loading Skeleton
   ═══════════════════════════════════════════ */
function HistoricalLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="rounded-2xl bg-idm-gold-warm/5 border border-idm-gold-warm/10 p-4">
        <Skeleton className="h-10 w-3/4 rounded-lg" />
      </div>
      <div className="rounded-2xl bg-idm-gold-warm/5 border border-idm-gold-warm/10 p-5">
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="flex items-center gap-4">
          <Skeleton className="w-14 h-14 rounded-2xl" />
          <div>
            <Skeleton className="h-5 w-24 mb-2" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      </div>
      <div className="rounded-2xl bg-idm-gold-warm/5 border border-idm-gold-warm/10 p-4">
        <Skeleton className="h-6 w-24 mb-3" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <Skeleton className="w-6 h-6 rounded-md" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Main HistoricalSeasonView Component
   ═══════════════════════════════════════════ */
interface HistoricalSeasonViewProps {
  season: SelectedSeason;
  onBack: () => void;
}

export const HistoricalSeasonView = React.memo(function HistoricalSeasonView({ season, onBack }: HistoricalSeasonViewProps) {
  const isMale = season.division === 'male';

  // Fetch season detail — API returns flat object with players[] and clubs[]
  const { data, isLoading, error } = useQuery<SeasonDetailResponse>({
    queryKey: ['season-detail', season.id],
    queryFn: async () => {
      const res = await fetch(`/api/seasons/${season.id}`);
      if (!res.ok) throw new Error('Failed to fetch season data');
      return res.json();
    },
    enabled: !!season.id,
    staleTime: 10 * 60 * 1000, // Cache longer for historical data
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <HistoricalBanner season={season} />
        <HistoricalLoadingSkeleton />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <HistoricalBanner season={season} />
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="p-5 text-center">
            <p className="text-sm text-red-400 mb-2">Gagal memuat data season</p>
            <button
              onClick={onBack}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Kembali ke season aktif
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Extract standings and clubs from the API response
  const standings: StandingPlayer[] = (data as unknown as Record<string, unknown>).players as StandingPlayer[] || [];
  const clubs: StandingClub[] = ((data as unknown as Record<string, unknown>).clubs || []) as StandingClub[];

  return (
    <div className="space-y-4">
      {/* Historical Banner */}
      <HistoricalBanner season={season} />

      {/* Back to Active Season Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3 h-3" />
        <span>Kembali ke season aktif</span>
      </button>

      {/* Champion Card */}
      <ChampionCard season={data} championPoints={data.championPlayerPoints} />

      {/* Player Standings — Card-per-row */}
      {standings.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Medal className={`w-4 h-4 ${isMale ? 'text-idm-male' : 'text-idm-female'}`} />
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Peringkat Pemain</h3>
            <Badge className={`${isMale ? 'bg-idm-male/15 text-idm-male' : 'bg-idm-female/15 text-idm-female'} border-0 text-[10px] ml-auto`}>
              {standings.length} Players
            </Badge>
          </div>
          <StandingsTable standings={standings} division={season.division} />
        </div>
      )}

      {/* Club Rankings — Card-per-row */}
      {clubs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Shield className="w-4 h-4 text-idm-gold-warm" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Peringkat Klub</h3>
            <Badge className="bg-idm-gold-warm/15 text-idm-gold-warm border-0 text-[10px] ml-auto">
              {clubs.length} Clubs
            </Badge>
          </div>
          <ClubRankingsTable clubs={clubs} />
        </div>
      )}

      {/* Season Info Footer */}
      <Card className="overflow-hidden">
        <CardContent className="p-4 sm:p-6 relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Info Season</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Season</p>
              <p className="text-sm font-bold">Season {data.number}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Divisi</p>
              <p className="text-sm font-bold">{data.division === 'male' ? '🕺 Cowo' : '💃 Cewe'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Periode</p>
              <p className="text-xs font-semibold">
                {data.startDate ? new Date(data.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                {' — '}
                {data.endDate ? new Date(data.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Turnamen</p>
              <p className="text-sm font-bold">{data._count?.tournaments || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
