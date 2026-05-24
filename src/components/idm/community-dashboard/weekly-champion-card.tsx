'use client';

import React, { useState } from 'react';
import { AvatarMedia } from '@/components/ui/avatar-media';
import { Crown, Trophy, Zap, Flame, Music, Shield, Star, Wallet, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { WeekNavigator } from '../week-navigator';
import { getDivisionTheme } from '@/hooks/use-division-theme';
import { getCommunityTheme } from '@/hooks/use-community-theme';
import { getAvatarUrl, formatCurrencyShort } from '@/lib/utils';
import type { StatsData, WeeklyChampion, TopPlayer } from '@/types/stats';

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */
type DivisionFilter = 'all' | 'male' | 'female';

type PlayerClickHandler = (player: TopPlayer & { division?: string }, division: 'male' | 'female') => void;

interface WeeklyChampionCardProps {
  maleData?: StatsData;
  femaleData?: StatsData;
  selectedDivision?: DivisionFilter;
  onPlayerClick?: PlayerClickHandler;
}

/* ═══════════════════════════════════════════
   Per-Division Champion Card (Dashboard)
   Clean version — no excessive effects
   ═══════════════════════════════════════════ */
function DivisionChampionCard({
  division,
  champions,
  totalWeeks,
  seasonNumber,
  onPlayerClick,
}: {
  division: 'male' | 'female';
  champions: WeeklyChampion[];
  totalWeeks: number;
  seasonNumber?: number;
  onPlayerClick?: PlayerClickHandler;
}) {
  const dt = getDivisionTheme(division);
  const accent = division === 'male' ? '#2E9FFF' : '#FF2D78';
  const accentLight = division === 'male' ? '#57B5FF' : '#FF5C9A';
  const DivisionIcon = division === 'male' ? Music : Shield;
  const genderSymbol = division === 'male' ? '♂' : '♀';

  // Week navigator state — default to latest completed week
  const completedWeeks = champions.map(c => c.weekNumber);
  const defaultWeek = completedWeeks.length > 0 ? completedWeeks[completedWeeks.length - 1] : 1;
  const [selectedWeek, setSelectedWeek] = useState<number>(defaultWeek);

  // Find the selected week's champion data
  const selectedChampion = champions.find(c => c.weekNumber === selectedWeek) || champions[champions.length - 1] || null;
  const winnerTeam = selectedChampion?.winnerTeam;
  const championPlayers = winnerTeam?.players || [];
  const mvpPlayer = selectedChampion?.mvp;

  /* ─── Empty state ─── */
  if (champions.length === 0) {
    return (
      <div className={`rounded-2xl ${dt.casinoCard} overflow-hidden`}>
        <div className={dt.casinoBar} />
        <div className={`hidden lg:block absolute top-8 right-8 w-32 h-32 rounded-full blur-3xl ${dt.bg} opacity-20 pointer-events-none`} />

        {/* Header */}
        <div className={`flex items-center gap-2.5 px-3 lg:px-5 py-2.5 border-b ${dt.borderSubtle}`}>
          <div className={`w-5 h-5 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
            <Trophy className={`w-3 h-3 ${dt.neonText}`} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-idm-gold-warm">Juara Tarkam</span>
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: accent }}>
            {division === 'male' ? 'COWO' : 'CEWE'} {genderSymbol}
          </span>
        </div>

        {/* Empty content */}
        <div className="p-4 lg:p-6">
          <div className={`flex items-center justify-center p-8 rounded-2xl ${dt.bgSubtle} ${dt.border}`}>
            <div className="text-center">
              <Trophy className={`w-10 h-10 mx-auto mb-3 opacity-20 ${dt.text}`} />
              <p className="text-sm font-semibold text-muted-foreground/80 mb-1">Belum Ada Juara Tarkam</p>
              <p className="text-xs text-muted-foreground/50">Juara weekly akan muncul setelah turnamen selesai</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Filled state ─── */
  // All players are equal champions — no podium reordering
  const displayPlayers = championPlayers;

  return (
    <div className={`rounded-2xl ${dt.casinoCard} overflow-hidden relative`}>
      <div className={dt.casinoBar} />
      <div className={`hidden lg:block absolute top-8 right-8 w-32 h-32 rounded-full blur-3xl ${dt.bg} opacity-20 pointer-events-none`} />

      {/* Header */}
      <div className={`flex items-center gap-2.5 px-3 lg:px-5 py-2.5 border-b ${dt.borderSubtle}`}>
        <div className={`w-5 h-5 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
          <Trophy className={`w-3 h-3 ${dt.neonText}`} />
        </div>
        <h3 className="text-xs lg:text-sm font-semibold uppercase tracking-wider truncate">
          🏆 Juara Tarkam
        </h3>
        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: accent }}>
          {division === 'male' ? 'COWO' : 'CEWE'} {genderSymbol}
        </span>
        {champions.length > 0 && (
          <Badge className={`ml-auto ${dt.casinoBadge} text-[9px]`}>
            W{selectedChampion?.weekNumber}
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="p-4 lg:p-6">
        {/* Team banner */}
        <div className={`flex items-center gap-3 p-4 sm:p-5 rounded-2xl ${dt.bgSubtle} ${dt.border} mb-4`}>
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center shadow-lg shrink-0">
            <Crown className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-yellow-400 truncate">{winnerTeam?.name || 'TBD'}</p>
            <p className="text-[10px] text-muted-foreground">
              {selectedChampion ? `Week ${selectedChampion.weekNumber} Champion` : 'Belum ada pemenang'}
            </p>
          </div>
          {selectedChampion && selectedChampion.prizePool > 0 && (
            <div className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: 'linear-gradient(135deg, rgba(249,203,37,0.15), rgba(249,203,37,0.05))' }}>
              <Wallet className="w-3 h-3 text-idm-gold-warm" />
              <span className="text-[10px] font-black text-idm-gold-warm">
                {selectedChampion.prizePool >= 1_000_000
                  ? `${(selectedChampion.prizePool / 1_000_000).toFixed(1)}M`
                  : selectedChampion.prizePool >= 1_000
                    ? `${(selectedChampion.prizePool / 1_000).toFixed(0)}K`
                    : `${selectedChampion.prizePool}`}
              </span>
            </div>
          )}
        </div>

        {/* Player Cards — all equal, same height, no rank differentiation */}
        {championPlayers.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
            {displayPlayers.map((player) => {
              const isMvp = mvpPlayer?.id === player.id;
              const avatarUrl = getAvatarUrl(player.gamertag, division, player.avatar);

              return (
                <div
                  key={player.id}
                  className="relative cursor-pointer"
                  onClick={onPlayerClick ? () => onPlayerClick({
                    id: player.id,
                    name: player.gamertag,
                    gamertag: player.gamertag,
                    avatar: player.avatar,
                    tier: player.tier,
                    points: player.points,
                    totalWins: player.totalWins,
                    totalMvp: player.totalMvp,
                    streak: player.streak,
                    maxStreak: player.streak,
                    matches: player.matches,
                    club: winnerTeam?.name,
                    city: player.city,
                    division,
                  }, division) : undefined}
                >
                  {/* Avatar container — all same height */}
                  <div className="relative w-full">
                    <div
                      className="w-full rounded-2xl overflow-hidden border-2 border-yellow-500/50"
                      style={{ aspectRatio: '3/4' }}
                    >
                      <AvatarMedia
                        src={avatarUrl}
                        alt={player.gamertag}
                        fill
                        sizes="(max-width: 768px) 33vw, 200px"
                        objectPosition="top"
                        loading="lazy"
                      />
                      {/* Dark overlay gradient */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                      {/* MVP badge */}
                      {isMvp && (
                        <div className="absolute top-2 right-2 z-10">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', boxShadow: '0 0 8px rgba(251, 191, 36, 0.5)' }}>
                            <Star className="w-3 h-3 text-white" />
                          </div>
                        </div>
                      )}

                      {/* Bottom info overlay */}
                      <div className="absolute bottom-0 inset-x-0 p-2 z-10">
                        <p className="text-xs font-bold truncate text-center text-idm-gold-warm">
                          {player.gamertag}
                        </p>
                        <div className="flex items-center justify-center gap-1.5 mt-1">
                          <span className="text-[9px] font-bold text-idm-gold-warm">{player.points}pts</span>
                          <span className="text-[8px] text-white/30">·</span>
                          <span className="text-[9px] font-bold text-green-400">{player.totalWins}W</span>
                          {player.streak > 1 && (
                            <>
                              <span className="text-[8px] text-white/30">·</span>
                              <div className="flex items-center gap-0.5">
                                <Flame className="w-2.5 h-2.5 text-orange-400" />
                                <span className="text-[9px] font-bold text-orange-400">{player.streak}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* MVP label below avatar */}
                  {isMvp && (
                    <Badge
                      className="mt-1.5 text-[7px] font-black px-2 py-0.5 border-0"
                      style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#1a1a2e' }}
                    >
                      <Star className="w-2.5 h-2.5 mr-0.5" />MVP
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={`p-6 rounded-2xl ${dt.bgSubtle} ${dt.border} text-center`}>
            <p className="text-sm text-muted-foreground">Belum ada data week ini</p>
          </div>
        )}
      </div>

      {/* Week Navigator */}
      {champions.length > 0 && (
        <div className="px-3 pb-3 lg:px-6 lg:pb-6">
          <WeekNavigator
            totalWeeks={totalWeeks}
            completedWeeks={completedWeeks}
            selectedWeek={selectedWeek}
            onWeekChange={setSelectedWeek}
            accent={accent}
            accentLight={accentLight}
            size="xs"
          />
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════
   Main Component — WeeklyChampionCard
   "all" → both divisions stacked (or side by side on desktop)
   specific division → single division card
   ═══════════════════════════════════════════ */
export const WeeklyChampionCard = React.memo(function WeeklyChampionCard({ maleData, femaleData, selectedDivision = 'all', onPlayerClick }: WeeklyChampionCardProps) {
  const showMale = selectedDivision === 'all' || selectedDivision === 'male';
  const showFemale = selectedDivision === 'all' || selectedDivision === 'female';

  const maleChampions = maleData?.weeklyChampions || [];
  const femaleChampions = femaleData?.weeklyChampions || [];
  const maleTotalWeeks = maleData?.seasonProgress?.totalWeeks || 10;
  const femaleTotalWeeks = femaleData?.seasonProgress?.totalWeeks || 10;
  const maleSeasonNumber = maleData?.season?.number;
  const femaleSeasonNumber = femaleData?.season?.number;

  // When "all" selected, show both divisions side by side on desktop, stacked on mobile
  if (selectedDivision === 'all') {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {showMale && (
          <DivisionChampionCard
            division="male"
            champions={maleChampions}
            totalWeeks={maleTotalWeeks}
            seasonNumber={maleSeasonNumber}
            onPlayerClick={onPlayerClick}
          />
        )}
        {showFemale && (
          <DivisionChampionCard
            division="female"
            champions={femaleChampions}
            totalWeeks={femaleTotalWeeks}
            seasonNumber={femaleSeasonNumber}
            onPlayerClick={onPlayerClick}
          />
        )}
      </div>
    );
  }

  // Single division selected
  const division = selectedDivision === 'female' ? 'female' : 'male';
  const champions = division === 'female' ? femaleChampions : maleChampions;
  const totalWeeks = division === 'female' ? femaleTotalWeeks : maleTotalWeeks;
  const seasonNumber = division === 'female' ? femaleSeasonNumber : maleSeasonNumber;

  return (
    <DivisionChampionCard
      division={division}
      champions={champions}
      totalWeeks={totalWeeks}
      seasonNumber={seasonNumber}
      onPlayerClick={onPlayerClick}
    />
  );
});
