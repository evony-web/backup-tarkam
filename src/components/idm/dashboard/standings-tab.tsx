'use client';

import React, { useState } from 'react';
import { AvatarMedia } from '@/components/ui/avatar-media';

import {
  Users, Shield, Award, Flame, ChevronDown, ChevronUp, ChevronRight, Search,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SkinBadgesRow, SkinName } from '../skin-renderer';
import { getPrimarySkin } from '@/lib/skin-utils';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { ClubLogoImage } from '@/components/idm/club-logo-image';
import { PlayerSearch } from '../player-search';
import { useAppStore } from '@/lib/store';
import { getAvatarUrl, clubToString, toStrictDivision } from '@/lib/utils';

import type { StatsData } from '@/types/stats';

type Division = 'male' | 'female';

// Division badge colors for the mixed table
const DIVISION_BADGE: Record<Division, { bg: string; text: string; icon: string; label: string }> = {
  male: { bg: 'rgba(46,159,255,0.12)', text: '#57B5FF', icon: '♂', label: 'Cowo' },
  female: { bg: 'rgba(255,45,120,0.12)', text: '#FF5C9A', icon: '♀', label: 'Cewe' },
};

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

interface StandingsTabProps {
  data: StatsData;
  otherDivisionData: StatsData | undefined;
  currentDivision: Division;
  setSelectedPlayer: (player: any) => void;
  setSelectedClub: (club: any) => void;
}

export function StandingsTab({ data, otherDivisionData, currentDivision, setSelectedPlayer, setSelectedClub }: StandingsTabProps) {
  const dt = useDivisionTheme();
  const division = useAppStore(s => s.division);
  const playerAuth = useAppStore(s => s.playerAuth);

  // Skin map from API — contains skins for ALL players in the division
  const skinMap = { ...(data?.skinMap || {}), ...(otherDivisionData?.skinMap || {}) };

  const [leaderboardSort, setLeaderboardSort] = useState<'players' | 'clubs'>('players');
  const [showAllPlayers, setShowAllPlayers] = useState(false);
  const [showAllClubs, setShowAllClubs] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // ── Merge both divisions' players into one unified list ──
  const allPlayers = React.useMemo(() => {
    const currentPlayers = (data?.topPlayers ?? []).map(p => ({
      ...p,
      division: currentDivision as Division,
    }));
    const otherPlayers = (otherDivisionData?.topPlayers ?? []).map(p => ({
      ...p,
      division: (currentDivision === 'male' ? 'female' : 'male') as Division,
    }));
    return [...currentPlayers, ...otherPlayers].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return a.gamertag.localeCompare(b.gamertag);
    });
  }, [data?.topPlayers, otherDivisionData?.topPlayers, currentDivision]);

  const displayedPlayers = showAllPlayers ? allPlayers : allPlayers.slice(0, 15);
  const clubs = data?.clubs ?? [];
  const displayedClubs = showAllClubs ? clubs : clubs.slice(0, 6);

  // Count per division for badge
  const maleCount = allPlayers.filter(p => p.division === 'male').length;
  const femaleCount = allPlayers.filter(p => p.division === 'female').length;

  return (
    <div className="space-y-4">

      {/* Sub-tabs for Players/Clubs + Search button */}
      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-1 p-1 rounded-lg ${dt.bgSubtle} ${dt.border}`}>
          <button
            onClick={() => setLeaderboardSort('players')}
            className={`compact-dot flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${leaderboardSort === 'players' ? `${dt.bg} ${dt.text} shadow-sm` : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Users className="w-3 h-3" /> Pemain
          </button>
          <button
            onClick={() => setLeaderboardSort('clubs')}
            className={`compact-dot flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${leaderboardSort === 'clubs' ? `${dt.bg} ${dt.text} shadow-sm` : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Shield className="w-3 h-3" /> Klub
          </button>
        </div>
        <button
          onClick={() => setSearchOpen(true)}
          className={`compact-dot flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${dt.bgSubtle} ${dt.border} border ${dt.text} hover:${dt.bg} cursor-pointer`}
        >
          <Search className="w-3 h-3" /> Cari
        </button>
      </div>

      {/* ═══ Player Leaderboard — Card-per-row design ═══ */}
      {leaderboardSort === 'players' && (
        <div className="stagger-item-subtle stagger-d0 space-y-3">
          {/* Section header */}
          <div className="flex items-center gap-2.5 px-1">
            <div className={`w-5 h-5 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
              <Award className={`w-3 h-3 ${dt.neonText}`} />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Peringkat Player</h3>
            <div className="ml-auto flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: DIVISION_BADGE.male.bg, color: DIVISION_BADGE.male.text }}>♂ {maleCount}</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: DIVISION_BADGE.female.bg, color: DIVISION_BADGE.female.text }}>♀ {femaleCount}</span>
            </div>
          </div>

          {/* Card list */}
          <div className="space-y-2 sm:max-h-[680px] sm:overflow-y-auto custom-scrollbar pr-0.5">
            {displayedPlayers?.map((p, idx) => {
              const losses = p.matches - p.totalWins;
              const isMe = playerAuth.isAuthenticated && playerAuth.account && playerAuth.account.player.id === p.id;
              const playerSkins = skinMap[p.id];
              const primarySkin = playerSkins && playerSkins.length > 0 ? getPrimarySkin(playerSkins) : null;
              const trendUp = p.streak > 1;
              const playerDiv = (p.division || currentDivision) as Division;
              const divBadge = DIVISION_BADGE[playerDiv];
              const isTop = idx < 3;

              return (
                <div
                  key={`${p.division}-${p.id}`}
                  onClick={() => setSelectedPlayer({ ...p, division: playerDiv })}
                  className={`rounded-xl border cursor-pointer transition-all duration-200 ${
                    idx === 0
                      ? 'bg-gradient-to-br from-idm-gold-warm/[0.06] via-card/80 to-idm-gold-warm/[0.03] border-idm-gold-warm/20 shadow-[0_0_10px_rgba(239,249,35,0.06),0_0_20px_rgba(239,249,35,0.03)]'
                      : isTop
                        ? 'bg-card/60 border-border/30'
                        : idx % 2 === 0
                          ? 'bg-card/50 border-border/20'
                          : 'bg-card/35 border-border/15'
                  } ${isMe ? 'border-idm-gold-warm/30 bg-idm-gold-warm/[0.04]' : ''} hover:border-idm-gold-warm/20 hover:bg-card/70`}
                  style={{ animationDelay: `${idx * 40}ms` }}
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
                      <AvatarMedia src={getAvatarUrl(p.gamertag, playerDiv, p.avatar)} alt={p.gamertag} width={40} height={40} className="w-full h-full" />
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
                        <span
                          className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: divBadge.bg, color: divBadge.text }}
                        >
                          {divBadge.icon} {divBadge.label}
                        </span>
                        {clubToString(p.club as any) && (
                          <span className="text-xs text-muted-foreground truncate">{clubToString(p.club as any)}</span>
                        )}
                      </div>
                    </div>

                    {/* Stats — Right side with divider */}
                    <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-border/40 shrink-0">
                      {/* Points */}
                      <div className="text-center min-w-[36px]">
                        <p className={`text-sm sm:text-base font-bold ${isTop ? dt.neonText : ''}`}>{p.points}</p>
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

          {/* Show more / less toggle */}
          {allPlayers.length > 15 && (
            <div className="flex items-center justify-center pt-1">
              <button
                onClick={() => setShowAllPlayers(!showAllPlayers)}
                className={`compact-pill flex items-center gap-1 text-xs font-medium ${dt.text} hover:underline cursor-pointer`}
              >
                {showAllPlayers ? <><ChevronUp className="w-3 h-3" /> Tampilkan Sedikit</> : <><ChevronDown className="w-3 h-3" /> Tampilkan Semua ({allPlayers.length})</>}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Player Search Dialog */}
      <PlayerSearch
        division={toStrictDivision(division)}
        onSelectPlayer={(p) => { setSelectedPlayer(p); setSearchOpen(false); }}
        open={searchOpen}
        onOpenChange={setSearchOpen}
      />

      {/* ═══ Club Standings — Card-per-row design ═══ */}
      {leaderboardSort === 'clubs' && (
        <div className="stagger-item-subtle stagger-d1 space-y-3">
          {/* Section header */}
          <div className="flex items-center gap-2.5 px-1">
            <div className={`w-5 h-5 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
              <Shield className={`w-3 h-3 ${dt.neonText}`} />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Klasemen Club</h3>
            <Badge className={`${dt.casinoBadge} ml-auto text-[10px]`}>{data.clubs?.length || 0} Clubs</Badge>
          </div>

          {data.clubs?.length > 0 ? (
            <>
              <div className="space-y-2 sm:max-h-[680px] sm:overflow-y-auto custom-scrollbar pr-0.5">
                {displayedClubs?.map((club, idx) => {
                  const isTop = idx < 4;
                  const isSeasonChampion = data.allSeasons?.some(s => s.status === 'completed' && s.championClub?.id === club.id);
                  const championSeason = isSeasonChampion ? data.allSeasons?.find(s => s.status === 'completed' && s.championClub?.id === club.id) : null;

                  return (
                    <div
                      key={club.id}
                      onClick={() => setSelectedClub(club)}
                      className={`rounded-xl border cursor-pointer transition-all duration-200 ${
                        idx === 0
                          ? 'bg-gradient-to-br from-idm-gold-warm/[0.06] via-card/80 to-idm-gold-warm/[0.03] border-idm-gold-warm/20 shadow-[0_0_10px_rgba(239,249,35,0.06),0_0_20px_rgba(239,249,35,0.03)]'
                          : isTop
                            ? 'bg-card/60 border-border/30'
                            : idx % 2 === 0
                              ? 'bg-card/50 border-border/20'
                              : 'bg-card/35 border-border/15'
                      } hover:border-idm-gold-warm/20 hover:bg-card/70`}
                      style={{ animationDelay: `${idx * 40}ms` }}
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
                          {isSeasonChampion && championSeason && (
                            <div className="absolute -top-1 -right-1 z-10 min-w-[14px] h-[14px] rounded-full bg-idm-gold-warm flex items-center justify-center border border-border/20">
                              <span className="text-[9px] font-black text-mid leading-none">S{championSeason.number}</span>
                            </div>
                          )}
                        </div>

                        {/* Club info */}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm sm:text-base font-semibold truncate">{club.name}</p>
                        </div>

                        {/* Stats — Right side with divider */}
                        <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-border/40 shrink-0">
                          {/* W/L — Visible on sm+ */}
                          <div className="hidden sm:flex items-center gap-2">
                            <div className="text-center min-w-[20px]">
                              <p className="text-xs text-green-500 font-semibold">{club.wins}</p>
                              <p className="text-[10px] text-muted-foreground">W</p>
                            </div>
                            <div className="text-center min-w-[20px]">
                              <p className="text-xs text-red-500 font-semibold">{club.losses}</p>
                              <p className="text-[10px] text-muted-foreground">L</p>
                            </div>
                          </div>

                          {/* Game diff — Visible on md+ */}
                          <div className="hidden md:block text-center min-w-[28px]">
                            <span className={`text-xs font-semibold ${club.gameDiff > 0 ? 'text-green-500' : club.gameDiff < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                              {club.gameDiff > 0 ? '+' : ''}{club.gameDiff}
                            </span>
                            <p className="text-[10px] text-muted-foreground">selisih</p>
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

              {data.clubs?.length > 6 && (
                <div className="flex items-center justify-center pt-1">
                  <button
                    onClick={() => setShowAllClubs(!showAllClubs)}
                    className={`compact-pill flex items-center gap-1 text-xs font-medium ${dt.text} hover:underline cursor-pointer`}
                  >
                    {showAllClubs ? <><ChevronUp className="w-3 h-3" /> Tampilkan Sedikit</> : <><ChevronDown className="w-3 h-3" /> Tampilkan Semua ({data.clubs.length})</>}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className={`p-6 rounded-2xl ${dt.bgSubtle} ${dt.border} text-center`}>
              <Shield className={`w-8 h-8 mx-auto mb-2 opacity-30 ${dt.text}`} />
              <p className="text-sm text-muted-foreground">Belum ada club terdaftar</p>
              <p className="text-xs text-muted-foreground/80 mt-1">Club akan muncul setelah pendaftaran</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
