'use client';

import React from 'react';
import { useMemo, useState } from 'react';
import { AvatarMedia } from '@/components/ui/avatar-media';
import { useQuery } from '@tanstack/react-query';
import {
  Users, Award, Shield, Flame, Trophy,
  ChevronDown, ChevronUp, ChevronRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SkinBadgesRow, SkinName } from '../skin-renderer';
import { getPrimarySkin } from '@/lib/skin-utils';
import { ClubLogoImage } from '../club-logo-image';
import { getAvatarUrl, clubToString } from '@/lib/utils';
import { getDivisionTheme } from '@/hooks/use-division-theme';
import { useCommunityTheme } from '@/hooks/use-community-theme';
import { useAppStore } from '@/lib/store';
import type { StatsData, TopPlayer } from '@/types/stats';
import { SharePopup } from '../social-share-button';

/* ═══════════════════════════════════════════════════════
   Tarkam Club type — from /api/clubs/leaderboard?type=tarkam
   ═══════════════════════════════════════════════════════ */
interface TarkamClub {
  id: string;
  name: string;
  logo: string | null;
  bannerImage: string | null;
  points: number;
  malePoints: number;
  femalePoints: number;
  wins: number;
  losses: number;
  gameDiff: number;
  memberCount: number;
  maleMemberCount: number;
  femaleMemberCount: number;
  rank: number;
}

/* ═══════════════════════════════════════════════════════
   COMMUNITY LEADERBOARD — Card-per-row design (no table)
   ═══════════════════════════════════════════════════════ */
interface CommunityLeaderboardProps {
  maleData?: StatsData;
  femaleData?: StatsData;
  onPlayerClick: (player: TopPlayer & { division?: string }, division: 'male' | 'female') => void;
  onClubClick?: (club: StatsData['clubs'][0]) => void;
  leaderboardSort?: 'players' | 'clubs';
  onLeaderboardSortChange?: (sort: 'players' | 'clubs') => void;
  divisionFilter?: DivisionFilter;
  onDivisionFilterChange?: (filter: DivisionFilter) => void;
  maxPlayers?: number;
  maxClubs?: number;
  onViewAll?: () => void;
  showAll?: boolean;
}

type DivisionFilter = 'all' | 'male' | 'female';

/* ─── Rank badge component ─── */
function RankBadge({ rank }: { rank: number }) {
  return (
    <span className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-sm sm:text-base font-bold shrink-0 ${
      rank === 1
        ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-black shadow-md shadow-yellow-500/25'
        : rank === 2
          ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-black shadow-md shadow-gray-400/20'
          : rank === 3
            ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white shadow-md shadow-amber-600/20'
            : 'bg-muted text-muted-foreground'
    }`}>
      {rank}
    </span>
  );
}

export const CommunityLeaderboard = React.memo(function CommunityLeaderboard({
  maleData,
  femaleData,
  onPlayerClick,
  onClubClick,
  leaderboardSort: externalSort,
  onLeaderboardSortChange,
  divisionFilter: externalDivisionFilter,
  onDivisionFilterChange,
  maxPlayers = 10,
  maxClubs = 6,
  onViewAll,
  showAll = false,
}: CommunityLeaderboardProps) {
  const dt = useCommunityTheme();
  const division = useAppStore(s => s.division);
  const [internalSort, setInternalSort] = useState<'players' | 'clubs'>('players');
  const [internalDivisionFilter, setInternalDivisionFilter] = useState<DivisionFilter>('all');

  // Use external props if provided, otherwise internal state
  const leaderboardSort = externalSort ?? internalSort;
  const setLeaderboardSort = onLeaderboardSortChange ?? setInternalSort;
  const divisionFilter = externalDivisionFilter ?? internalDivisionFilter;
  const setDivisionFilter = onDivisionFilterChange ?? setInternalDivisionFilter;
  const [showAllPlayers, setShowAllPlayers] = useState(false);
  const [showAllClubs, setShowAllClubs] = useState(false);

  /* ─── Season champion clubs (for S1 badge) ─── */
  const seasonChampionClubIds = useMemo(() => {
    const allSeasons = [...(maleData?.allSeasons || []), ...(femaleData?.allSeasons || [])];
    const champMap = new Map<string, number>(); // clubId -> seasonNumber
    for (const s of allSeasons) {
      if (s.status === 'completed' && s.championClub) {
        champMap.set(s.championClub.id, s.number);
      }
    }
    return champMap;
  }, [maleData, femaleData]);

  /* ─── Fetch Tarkam club leaderboard ─── */
  const { data: tarkamClubData, isLoading: isClubLoading } = useQuery<{ clubs: TarkamClub[]; type: string }>({
    queryKey: ['clubs-leaderboard', 'tarkam'],
    queryFn: async () => {
      const res = await fetch('/api/clubs/leaderboard?type=tarkam');
      if (!res.ok) return { clubs: [], type: 'tarkam' };
      return res.json();
    },
    staleTime: 60000,
    refetchInterval: 180000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
    enabled: leaderboardSort === 'clubs',
  });

  // Skin maps from both divisions
  const skinMap = {
    ...maleData?.skinMap,
    ...femaleData?.skinMap,
  };

  // Merge top players from both divisions, re-sort by points
  const mergedPlayers = useMemo(() => {
    let male = (maleData?.topPlayers || []).map(p => ({ ...p, division: 'male' as const }));
    let female = (femaleData?.topPlayers || []).map(p => ({ ...p, division: 'female' as const }));

    if (divisionFilter === 'male') female = [];
    if (divisionFilter === 'female') male = [];

    return [...male, ...female].sort((a, b) => {
      // Primary sort: points descending
      if (b.points !== a.points) return b.points - a.points;
      // Tiebreaker: gamertag alphabetically (A-Z)
      return a.gamertag.localeCompare(b.gamertag);
    });
  }, [maleData, femaleData, divisionFilter]);

  const displayedPlayers = showAll ? mergedPlayers : (showAllPlayers ? mergedPlayers : mergedPlayers.slice(0, maxPlayers));
  const rawClubs = tarkamClubData?.clubs || [];
  // Filter clubs by division: male-only clubs, female-only clubs, or all
  const clubs = useMemo(() => {
    if (divisionFilter === 'all') return rawClubs;
    return rawClubs.filter(c => {
      if (divisionFilter === 'male') return c.maleMemberCount > 0;
      if (divisionFilter === 'female') return c.femaleMemberCount > 0;
      return true;
    });
  }, [rawClubs, divisionFilter]);
  const displayedClubs = showAll ? clubs : (showAllClubs ? clubs : clubs.slice(0, maxClubs));

  return (
    <div className="space-y-3">
      {/* ═══ Player Leaderboard — Card-per-row design ═══ */}
      {leaderboardSort === 'players' && (
        <>
          {/* Section header */}
          <div className={`flex items-center gap-2.5 px-1`}>
            <div className={`w-5 h-5 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
              <Award className={`w-3 h-3 ${dt.neonText}`} />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Peringkat Player</h3>
            <Badge className={`${dt.casinoBadge} ml-auto text-[10px]`}>TOP {displayedPlayers?.length || 10}</Badge>
          </div>

          {/* Card list */}
          <div className="space-y-2 sm:max-h-[680px] sm:overflow-y-auto custom-scrollbar pr-0.5">
            {displayedPlayers?.map((p, idx) => {
              const losses = p.matches - p.totalWins;
              const playerDivision = (p.division || 'male') as 'male' | 'female';
              const playerDt = getDivisionTheme(playerDivision);
              const playerSkins = skinMap[p.id];
              const primarySkin = playerSkins && playerSkins.length > 0 ? getPrimarySkin(playerSkins) : null;
              const trendUp = p.streak > 1;
              const isTop = idx < 3;

              return (
                <div
                  key={p.id}
                  onClick={() => onPlayerClick(p, playerDivision)}
                  className={`rounded-xl border cursor-pointer transition-all duration-200 ${
                    idx === 0
                      ? 'bg-gradient-to-br from-idm-gold-warm/[0.06] via-card/80 to-idm-gold-warm/[0.03] border-idm-gold-warm/20 shadow-[0_0_10px_rgba(239,249,35,0.06),0_0_20px_rgba(239,249,35,0.03)]'
                      : isTop
                        ? 'bg-card/60 border-border/30'
                        : idx % 2 === 0
                          ? 'bg-card/50 border-border/20'
                          : 'bg-card/35 border-border/15'
                  } hover:border-idm-gold-warm/20 hover:bg-card/70`}
                >
                  <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3">
                    {/* Rank */}
                    <RankBadge rank={idx + 1} />

                    {/* Avatar */}
                    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden shrink-0 ${
                      idx === 0 ? 'ring-2 ring-idm-gold-warm/50' :
                      idx === 1 ? 'ring-2 ring-gray-400/40' :
                      idx === 2 ? 'ring-2 ring-amber-600/40' : ''
                    }`}>
                      <AvatarMedia src={getAvatarUrl(p.gamertag, playerDivision, p.avatar)} alt={p.gamertag} width={40} height={40} className="w-full h-full" />
                    </div>

                    {/* Player info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <SkinName skin={primarySkin}>
                          <p className="text-sm sm:text-base font-medium truncate">{p.gamertag}</p>
                        </SkinName>
                        {playerSkins && playerSkins.length > 0 && <SkinBadgesRow skins={playerSkins} />}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge className={`${playerDt.badgeBg} text-[10px] border`}>
                          {playerDivision === 'male' ? '🕺 Cowo' : '💃 Cewe'}
                        </Badge>
                        {clubToString(p.club as any) && (
                          <span className="text-xs text-muted-foreground truncate">{clubToString(p.club as any)}</span>
                        )}
                      </div>
                    </div>

                    {/* Stats — Right side with divider */}
                    <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-border/40 shrink-0">
                      {/* Points — Always visible */}
                      <div className="text-center min-w-[36px]">
                        <p className={`text-sm sm:text-base font-bold ${isTop ? playerDt.neonText : ''}`}>{p.points}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">pts</p>
                      </div>

                      {/* W/L — Visible on sm+ */}
                      <div className="hidden sm:flex items-center gap-2">
                        <div className="text-center min-w-[20px]">
                          <p className="text-xs text-green-500 font-semibold">{p.totalWins}</p>
                          <p className="text-[10px] text-muted-foreground">W</p>
                        </div>
                        <div className="text-center min-w-[20px]">
                          <p className="text-xs text-red-500 font-semibold">{losses > 0 ? losses : 0}</p>
                          <p className="text-[10px] text-muted-foreground">L</p>
                        </div>
                      </div>

                      {/* Streak — Visible on md+ */}
                      <div className="hidden md:block text-center min-w-[28px]">
                        {p.streak > 1 ? (
                          <span className="text-orange-400 font-semibold flex items-center gap-0.5 justify-center text-xs"><Flame className="w-3 h-3" />{p.streak}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                        <p className="text-[10px] text-muted-foreground">streak</p>
                      </div>

                      {/* MVP — Visible on sm+ */}
                      <div className="hidden sm:block text-center min-w-[20px]">
                        {p.totalMvp > 0 ? (
                          <p className="text-yellow-500 font-semibold text-xs">{p.totalMvp}</p>
                        ) : (
                          <p className="text-muted-foreground text-xs">0</p>
                        )}
                        <p className="text-[10px] text-muted-foreground">mvp</p>
                      </div>

                      {/* Chevron */}
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 hidden sm:block" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Show more / less toggle or CTA */}
          {!showAll && mergedPlayers.length > maxPlayers && (
            <div className="flex items-center justify-center pt-1">
              {onViewAll ? (
                <button
                  onClick={onViewAll}
                  className="compact-pill flex items-center gap-1.5 text-xs font-semibold text-idm-gold-warm hover:text-idm-gold-warm/80 hover:underline cursor-pointer transition-colors"
                >
                  <ChevronDown className="w-3 h-3" /> Lihat Selengkapnya ({mergedPlayers.length} Pemain)
                </button>
              ) : (
                <button
                  onClick={() => setShowAllPlayers(!showAllPlayers)}
                  className={`compact-pill flex items-center gap-1 text-xs font-medium ${dt.text} hover:underline cursor-pointer`}
                >
                  {showAllPlayers ? <><ChevronUp className="w-3 h-3" /> Tampilkan Sedikit</> : <><ChevronDown className="w-3 h-3" /> Tampilkan Semua ({mergedPlayers.length})</>}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* ═══ Club Standings — Card-per-row design ═══ */}
      {leaderboardSort === 'clubs' && (
        <>
          {/* Section header */}
          <div className="flex items-center gap-2.5 px-1">
            <div className={`w-5 h-5 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
              <Shield className={`w-3 h-3 ${dt.neonText}`} />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Klasemen Club</h3>
            <Badge className={`${dt.casinoBadge} ml-auto text-[10px]`}>TARKAM</Badge>
          </div>

          {isClubLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-muted/20 animate-pulse" />
              ))}
            </div>
          ) : clubs.length > 0 ? (
            <>
              <div className="space-y-2 sm:max-h-[680px] sm:overflow-y-auto custom-scrollbar pr-0.5">
                {displayedClubs?.map((club, idx) => {
                  const memberLabel = club.maleMemberCount > 0 && club.femaleMemberCount > 0
                    ? `${club.maleMemberCount}M + ${club.femaleMemberCount}F`
                    : club.maleMemberCount > 0
                      ? `${club.maleMemberCount}M`
                      : `${club.femaleMemberCount}F`;
                  const isTop = idx < 4;

                  return (
                    <div
                      key={club.id}
                      onClick={() => onClubClick?.(club as StatsData['clubs'][0])}
                      className={`rounded-xl border cursor-pointer transition-all duration-200 ${
                        idx === 0
                          ? 'bg-gradient-to-br from-idm-gold-warm/[0.06] via-card/80 to-idm-gold-warm/[0.03] border-idm-gold-warm/20 shadow-[0_0_10px_rgba(239,249,35,0.06),0_0_20px_rgba(239,249,35,0.03)]'
                          : isTop
                            ? 'bg-card/60 border-border/30'
                            : idx % 2 === 0
                              ? 'bg-card/50 border-border/20'
                              : 'bg-card/35 border-border/15'
                      } hover:border-idm-gold-warm/20 hover:bg-card/70`}
                    >
                      <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3">
                        {/* Rank */}
                        <RankBadge rank={idx + 1} />

                        {/* Club logo */}
                        <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-lg overflow-hidden shrink-0">
                          {club.logo ? (
                            <ClubLogoImage clubName={club.name} dbLogo={club.logo} alt={club.name} width={40} height={40} className="w-full h-full object-cover" />
                          ) : (
                            <div className={`w-full h-full ${dt.iconBg} flex items-center justify-center`}>
                              <Shield className={`w-4 h-4 ${dt.text}`} />
                            </div>
                          )}
                          {/* Season champion badge */}
                          {seasonChampionClubIds.has(club.id) && (
                            <div className="absolute -top-1 -right-1 z-10 min-w-[14px] h-[14px] rounded-full bg-idm-gold-warm flex items-center justify-center border border-border/20">
                              <span className="text-[9px] font-black text-mid leading-none">S{seasonChampionClubIds.get(club.id)}</span>
                            </div>
                          )}
                        </div>

                        {/* Club info */}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm sm:text-base font-semibold truncate">{club.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-muted-foreground">{club.memberCount} anggota</span>
                            <span className="text-[10px] text-muted-foreground/60">({memberLabel})</span>
                          </div>
                        </div>

                        {/* Stats — Right side with divider */}
                        <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-border/40 shrink-0">
                          {/* Male points — Visible on sm+ */}
                          <div className="hidden sm:block text-center min-w-[28px]">
                            <p className="text-xs font-bold text-idm-male">{club.malePoints}</p>
                            <p className="text-[10px] text-muted-foreground">pts M</p>
                          </div>

                          {/* Female points — Visible on sm+ */}
                          <div className="hidden sm:block text-center min-w-[28px]">
                            <p className="text-xs font-bold text-idm-female">{club.femalePoints}</p>
                            <p className="text-[10px] text-muted-foreground">pts F</p>
                          </div>

                          {/* Total points */}
                          <div className="text-center min-w-[36px]">
                            <p className={`text-sm sm:text-base font-bold ${idx === 0 ? dt.neonGradient : isTop ? dt.neonText : ''}`}>{club.points}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">pts</p>
                          </div>

                          {/* Chevron */}
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 hidden sm:block" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {!showAll && clubs.length > maxClubs && (
                <div className="flex items-center justify-center pt-1">
                  {onViewAll ? (
                    <button
                      onClick={onViewAll}
                      className="compact-pill flex items-center gap-1.5 text-xs font-semibold text-idm-gold-warm hover:text-idm-gold-warm/80 hover:underline cursor-pointer transition-colors"
                    >
                      <ChevronDown className="w-3 h-3" /> Lihat Selengkapnya ({clubs.length} Klub)
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowAllClubs(!showAllClubs)}
                      className={`compact-pill flex items-center gap-1 text-xs font-medium ${dt.text} hover:underline cursor-pointer`}
                    >
                      {showAllClubs ? <><ChevronUp className="w-3 h-3" /> Tampilkan Sedikit</> : <><ChevronDown className="w-3 h-3" /> Tampilkan Semua ({clubs.length})</>}
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className={`p-6 rounded-2xl ${dt.bgSubtle} ${dt.border} text-center`}>
              <Shield className={`w-8 h-8 mx-auto mb-2 opacity-30 ${dt.text}`} />
              <p className="text-sm text-muted-foreground">Belum ada club terdaftar</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Poin klub dihitung dari total poin semua anggota</p>
            </div>
          )}
        </>
      )}
    </div>
  );
});


/* ═══════════════════════════════════════════════════════
   PERINGKAT HEADER — Standalone filter bar for sticky use
   Contains: Peringkat title + Player/Club toggle + Division filter
   ═══════════════════════════════════════════════════════ */
export const PeringkatHeader = React.memo(function PeringkatHeader({
  leaderboardSort,
  onLeaderboardSortChange,
  divisionFilter,
  onDivisionFilterChange,
  maleData,
  femaleData,
}: {
  leaderboardSort: 'players' | 'clubs';
  onLeaderboardSortChange: (sort: 'players' | 'clubs') => void;
  divisionFilter: DivisionFilter;
  onDivisionFilterChange: (filter: DivisionFilter) => void;
  maleData?: StatsData;
  femaleData?: StatsData;
}) {
  const ct = useCommunityTheme();

  // Compute counts for badges
  const playerCount = ((maleData?.topPlayers?.length || 0) + (femaleData?.topPlayers?.length || 0));
  const clubCount = (maleData?.clubs?.length || 0) + (femaleData?.clubs?.length || 0);

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      {/* Left — Title + Share */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className={`w-5 h-5 rounded ${ct.iconBg} flex items-center justify-center`}>
          <Trophy className={`w-3 h-3 ${ct.neonText}`} />
        </div>
        <h3 className="text-sm font-bold uppercase tracking-wider" style={{
          background: 'linear-gradient(135deg, #FAF0DC 0%, #EFF923 30%, #F9CB25 50%, #F9CB25 70%, #EFF923 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>Peringkat</h3>
        <SharePopup
          shareUrl={typeof window !== 'undefined' ? `${window.location.origin}/?view=peringkat` : ''}
          title="Bagikan Peringkat"
          subtitle="Peringkat Pemain"
          shareText="Lihat peringkat pemain Tarkam IDM!"
          buttonLabel="Bagikan peringkat"
          size="sm"
        />
      </div>

      {/* Right — Filter controls inline */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Player/Club toggle */}
        <div className={`flex items-center gap-1 p-1 rounded-lg ${ct.bgSubtle} ${ct.border}`}>
          <button
            onClick={() => onLeaderboardSortChange('players')}
            className={`compact-pill flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${leaderboardSort === 'players' ? `${ct.bg} ${ct.text} shadow-sm` : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Users className="w-3 h-3" /> Pemain
            <span className={`hidden sm:inline text-[10px] tabular-nums ${leaderboardSort === 'players' ? 'text-idm-gold-warm' : 'text-muted-foreground/50'}`}>
              {playerCount}
            </span>
          </button>
          <button
            onClick={() => onLeaderboardSortChange('clubs')}
            className={`compact-pill flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${leaderboardSort === 'clubs' ? `${ct.bg} ${ct.text} shadow-sm` : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Shield className="w-3 h-3" /> Klub
            <span className={`hidden sm:inline text-[9px] tabular-nums ${leaderboardSort === 'clubs' ? 'text-idm-gold-warm' : 'text-muted-foreground/50'}`}>
              {clubCount}
            </span>
          </button>
        </div>

        {/* Division filter pills */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-idm-gold-warm/5 border border-idm-gold-warm/10">
          {([
            { key: 'all' as DivisionFilter, label: 'Semua' },
            { key: 'male' as DivisionFilter, label: 'Cowo' },
            { key: 'female' as DivisionFilter, label: 'Cewe' },
          ]).map(f => (
            <button
              key={f.key}
              onClick={() => onDivisionFilterChange(f.key)}
              className={`compact-pill px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded-md transition-all whitespace-nowrap cursor-pointer ${
                divisionFilter === f.key
                  ? 'bg-idm-gold-warm/15 text-idm-gold-warm shadow-sm shadow-idm-gold-warm/10 border border-idm-gold-warm/25'
                  : 'text-muted-foreground/70 hover:text-foreground border border-transparent hover:bg-muted/40'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});
