'use client';

import React from 'react';
import { useState } from 'react';
import { Crown, TrendingUp, Flame, BarChart3, Music, Shield, Gem, Heart, Calendar, Zap } from 'lucide-react';
import { AvatarMedia } from '@/components/ui/avatar-media';
import { getAvatarUrl, hexToRgba } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PlayerCard } from '../player-card';
import { getDivisionTheme } from '@/hooks/use-division-theme';
import type { StatsData, TopPlayer, WeeklyPerformer, SultanOfWeekly } from '@/types/stats';

/* ═══════════════════════════════════════════════════════
   COMMUNITY CHAMPIONS — Tabbed: Top 3 / Top Form / Juara
   ═══════════════════════════════════════════════════════ */
type DivisionFilter = 'all' | 'male' | 'female';

interface CommunityChampionsProps {
  maleData?: StatsData;
  femaleData?: StatsData;
  selectedDivision?: DivisionFilter;
  onPlayerClick: (player: TopPlayer & { division?: string }, division: 'male' | 'female') => void;
}

export function CommunityChampions({ maleData, femaleData, selectedDivision = 'all', onPlayerClick }: CommunityChampionsProps) {
  const [activeTab, setActiveTab] = useState<'top3' | 'sultan'>('top3');

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex items-center gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('top3')}
          className={`compact-pill relative px-4 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'top3'
              ? 'border-idm-gold-warm text-idm-gold-warm'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Crown className="w-3 h-3 mr-1 inline" />
          Top 3
        </button>
        <button
          onClick={() => setActiveTab('sultan')}
          className={`compact-pill relative px-4 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'sultan'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Gem className="w-3 h-3 mr-1 inline" />
          Sultan
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'top3' && (
        <div className={`grid gap-5 ${selectedDivision === 'all' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {(selectedDivision === 'all' || selectedDivision === 'male') && (
            <ChampionsSection
              title="Cowo Champions"
              emoji="🕺"
              division="male"
              topPlayers={maleData?.topPlayers || []}
              onPlayerClick={onPlayerClick}
            />
          )}
          {(selectedDivision === 'all' || selectedDivision === 'female') && (
            <ChampionsSection
              title="Cewe Champions"
              emoji="💃"
              division="female"
              topPlayers={femaleData?.topPlayers || []}
              onPlayerClick={onPlayerClick}
            />
          )}
        </div>
      )}

      {activeTab === 'sultan' && (
        <div className={`grid gap-5 ${selectedDivision === 'all' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {(selectedDivision === 'all' || selectedDivision === 'male') && (
            <SultanOfWeekSection
              division="male"
              sultanData={maleData?.sultanOfWeekly}
              skinMap={maleData?.skinMap || {}}
              onPlayerClick={onPlayerClick}
            />
          )}
          {(selectedDivision === 'all' || selectedDivision === 'female') && (
            <SultanOfWeekSection
              division="female"
              sultanData={femaleData?.sultanOfWeekly}
              skinMap={femaleData?.skinMap || {}}
              onPlayerClick={onPlayerClick}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Per-division Champions Card ─── */
function ChampionsSection({
  title,
  emoji,
  division,
  topPlayers,
  onPlayerClick,
}: {
  title: string;
  emoji: string;
  division: 'male' | 'female';
  topPlayers: TopPlayer[];
  onPlayerClick: (player: TopPlayer & { division?: string }, division: 'male' | 'female') => void;
}) {
  const dt = getDivisionTheme(division);
  const top3 = topPlayers.slice(0, 3);

  return (
    <Card className={`${dt.casinoCard} overflow-hidden relative`}>
      <div className={dt.casinoBar} />
      {/* Decorative blur orb */}
      <div className={`hidden lg:block absolute top-8 right-8 w-32 h-32 rounded-full blur-3xl ${dt.bg} opacity-20 pointer-events-none`} />

      {/* Header */}
      <div className={`flex items-center gap-2.5 px-3 lg:px-6 py-3 border-b ${dt.borderSubtle}`}>
        <div className={`w-5 h-5 lg:w-6 lg:h-6 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
          <Crown className={`w-3 h-3 lg:w-3.5 lg:h-3.5 ${dt.neonText}`} />
        </div>
        <h3 className="text-xs lg:text-sm font-semibold uppercase tracking-wider">{title}</h3>
        {top3.length > 0 && (
          <Badge className={`hidden sm:inline-flex ${dt.casinoBadge} ml-auto text-[9px]`}>SEASON BEST</Badge>
        )}
      </div>

      {/* Content — top 3 players or empty state */}
      <div className="p-4 lg:p-6">
        {top3.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {top3.map((p, idx) => (
              <div key={p.id}>
                <PlayerCard
                  gamertag={p.gamertag}
                  avatar={p.avatar}
                  points={p.points}
                  totalWins={p.totalWins}
                  totalMvp={p.totalMvp}
                  streak={p.streak}
                  rank={idx + 1}
                  isMvp={p.totalMvp > 0 && idx === 0}
                  club={p.club}
                  onClick={() => onPlayerClick({ ...p, division }, division)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className={`p-8 rounded-2xl ${dt.bgSubtle} ${dt.border} text-center`}>
            <Crown className={`w-10 h-10 mx-auto mb-3 opacity-20 ${dt.text}`} />
            <p className="text-sm font-semibold text-muted-foreground/80 mb-1">Belum Ada Champion {division === 'male' ? 'Cowo' : 'Cewe'}</p>
            <p className="text-xs text-muted-foreground/50">Champion akan muncul setelah season dimulai dan pertandingan selesai</p>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ─── Sultan of the Week Section — Top Penyawer per division ─── */
const MAROON = '#800020';
const MAROON_LIGHT = '#d4576a';
export const SultanOfWeekSection = React.memo(function SultanOfWeekSection({
  division,
  sultanData,
  skinMap,
  onPlayerClick,
}: {
  division: 'male' | 'female';
  sultanData: SultanOfWeekly[] | undefined;
  skinMap: Record<string, any[]>;
  onPlayerClick: (player: TopPlayer & { division?: string }, division: 'male' | 'female') => void;
}) {
  const dt = getDivisionTheme(division);
  const accentColor = division === 'male' ? '#2E9FFF' : '#FF2D78';

  // Get the latest sultan (most recent week with donation data)
  const latestSultan = sultanData?.length ? sultanData[sultanData.length - 1] : undefined;

  // Cross-division: check if the Sultan's actual division differs from the tournament division
  const isCrossDivision = latestSultan?.isCrossDivision && latestSultan?.player;
  const donorDivision = latestSultan?.player?.division;
  const crossDivisionEmoji = donorDivision === 'female' ? '💃' : '🕺';
  const crossDivisionLabel = donorDivision === 'female' ? 'Cewe' : 'Cowo';

  const content = latestSultan ? (
    <div className="flex gap-3 sm:gap-4 items-stretch">
      {/* Avatar panel (LEFT) — 3/4 aspect ratio, full-body avatar */}
      <div
        className={`relative w-28 sm:w-36 lg:w-40 shrink-0 rounded-2xl overflow-hidden bg-gradient-to-br ${
          division === 'male' ? 'from-idm-male/25 to-idm-male/5' : 'from-idm-female/25 to-idm-female/5'
        }`}
        style={{ aspectRatio: '3/4' }}
      >
        {latestSultan.player ? (
          <AvatarMedia
            src={getAvatarUrl(latestSultan.player.gamertag, division, latestSultan.player.avatar)}
            alt={latestSultan.player.gamertag}
            fill
            sizes="(max-width: 640px) 112px, (max-width: 1024px) 144px, 160px"
            className="w-full h-full object-cover object-top"
            loading="lazy"
          />
        ) : (
          /* Anonymous donor — heart icon */
          <div className="w-full h-full flex items-center justify-center"
            style={{ background: hexToRgba(MAROON, 0.08) }}>
            <Heart className="w-8 h-8" style={{ color: hexToRgba(MAROON, 0.4) }} />
          </div>
        )}

        {/* Gradient overlay at bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />

        {/* Heart badge at top-right (maroon themed) */}
        <div className="absolute top-2 right-2 z-10">
          <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-full flex items-center justify-center shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${MAROON_LIGHT}, ${MAROON})`,
              boxShadow: `0 2px 8px ${hexToRgba(MAROON, 0.35)}`,
            }}>
            <Heart className="w-3 h-3 lg:w-3.5 lg:h-3.5 text-white" fill="white" />
          </div>
        </div>

        {/* Donation badge at bottom center */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
          <Badge className="text-[7px] font-black border-0 px-2 py-0.5 whitespace-nowrap shadow-lg"
            style={{ background: `linear-gradient(to right, ${MAROON_LIGHT}, ${MAROON})`, color: 'white' }}>
            {formatCurrencyShort(latestSultan.totalAmount)}
          </Badge>
        </div>
      </div>

      {/* Stats panel (RIGHT) */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        {/* Division label + Week badge */}
        <div>
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: accentColor }}>
              {division === 'male' ? 'COWO' : 'CEWE'}
            </span>
            {isCrossDivision && (
              <Badge className="bg-pink-500/15 text-pink-400 border-0 text-[8px]">
                {crossDivisionEmoji} {crossDivisionLabel}
              </Badge>
            )}
            <Badge className="border-0 text-[8px] ml-auto" style={{ background: hexToRgba(MAROON, 0.15), color: MAROON }}>
              W{latestSultan.weekNumber}
            </Badge>
          </div>

          {/* Player name */}
          <h3 className="text-sm lg:text-base font-black truncate">
            {latestSultan.player?.gamertag || latestSultan.donorName}
          </h3>

          {/* City/Club info */}
          {latestSultan.player && (latestSultan.player.city || latestSultan.player.club) && (
            <p className="text-[9px] lg:text-[10px] text-muted-foreground/70 truncate mt-0.5 mb-3">
              {[latestSultan.player.city, typeof latestSultan.player.club === 'string' ? latestSultan.player.club : latestSultan.player.club?.name].filter(Boolean).join(' · ')}
            </p>
          )}
          {!(latestSultan.player && (latestSultan.player.city || latestSultan.player.club)) && (
            <div className="mb-3" />
          )}
        </div>

        {/* Stats grid (2x2) */}
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mb-3">
          {/* Total Saweran */}
          <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-2xl ${dt.bgSubtle} border ${dt.borderSubtle}`}>
            <Heart className="w-3 h-3 shrink-0" style={{ color: MAROON_LIGHT }} />
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-black tabular-nums leading-tight" style={{ color: MAROON_LIGHT }}>
                {formatCurrencyShort(latestSultan.totalAmount)}
              </p>
              <p className="text-[7px] sm:text-[8px] text-muted-foreground/60 uppercase tracking-wider font-semibold leading-tight">
                Total Saweran
              </p>
            </div>
          </div>
          {/* Jumlah Sawer */}
          <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-2xl ${dt.bgSubtle} border ${dt.borderSubtle}`}>
            <Zap className="w-3 h-3 shrink-0" style={{ color: MAROON_LIGHT }} />
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-black tabular-nums leading-tight" style={{ color: MAROON_LIGHT }}>
                {latestSultan.donationCount}x
              </p>
              <p className="text-[7px] sm:text-[8px] text-muted-foreground/60 uppercase tracking-wider font-semibold leading-tight">
                Jumlah Sawer
              </p>
            </div>
          </div>
          {/* Week number */}
          <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-2xl ${dt.bgSubtle} border ${dt.borderSubtle}`}>
            <Calendar className="w-3 h-3 shrink-0" style={{ color: accentColor }} />
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-black tabular-nums leading-tight" style={{ color: accentColor }}>
                W{latestSultan.weekNumber}
              </p>
              <p className="text-[7px] sm:text-[8px] text-muted-foreground/60 uppercase tracking-wider font-semibold leading-tight">
                Week
              </p>
            </div>
          </div>
          {/* Placeholder / Tier info in 4th cell */}
          {latestSultan.player?.tier ? (
            <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-2xl ${dt.bgSubtle} border ${dt.borderSubtle}`}>
              <Gem className="w-3 h-3 shrink-0" style={{ color: accentColor }} />
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs font-black tabular-nums leading-tight" style={{ color: accentColor }}>
                  Tier {latestSultan.player.tier}
                </p>
                <p className="text-[7px] sm:text-[8px] text-muted-foreground/60 uppercase tracking-wider font-semibold leading-tight">
                  Rank
                </p>
              </div>
            </div>
          ) : (
            <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-2xl ${dt.bgSubtle} border ${dt.borderSubtle}`}>
              <Gem className="w-3 h-3 shrink-0 text-muted-foreground/30" />
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs font-black text-muted-foreground/30 leading-tight">—</p>
                <p className="text-[7px] sm:text-[8px] text-muted-foreground/60 uppercase tracking-wider font-semibold leading-tight">Rank</p>
              </div>
            </div>
          )}
        </div>

        {/* Tier badge (if available) */}
        {latestSultan.player?.tier && (
          <span className="text-[8px] font-bold inline-block px-2 py-0.5 rounded-md" style={{ color: MAROON_LIGHT, backgroundColor: hexToRgba(MAROON, 0.08) }}>
            Tier {latestSultan.player.tier}
          </span>
        )}
      </div>
    </div>
  ) : (
    /* Ghost/empty state — mirrors filled layout */
    <div className="flex gap-3 sm:gap-4 items-stretch opacity-50">
      {/* Ghost avatar panel — same 3/4 aspect ratio */}
      <div
        className={`relative w-28 sm:w-36 lg:w-40 shrink-0 rounded-2xl overflow-hidden bg-gradient-to-br ${
          division === 'male' ? 'from-idm-male/20 to-idm-male/5' : 'from-idm-female/20 to-idm-female/5'
        } border`}
        style={{ borderColor: accentColor + '20', aspectRatio: '3/4' }}
      >
        <Heart className="w-8 h-8 mx-auto absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-25" style={{ color: MAROON }} />
      </div>

      {/* Ghost stats panel */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <div className="h-3 w-10 rounded bg-muted/30" />
            <div className="h-4 w-6 rounded-full bg-muted/25 ml-auto" />
          </div>
          <div className="h-5 w-24 rounded bg-muted/35 mb-2" />
          <div className="h-3 w-20 rounded bg-muted/25 mb-4" />
        </div>

        {/* Ghost stats grid — 2x2 */}
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mb-3">
          {[
            { color: 'bg-red-400/20' },
            { color: 'bg-red-400/20' },
            { color: 'bg-idm-male/20' },
            { color: 'bg-idm-male/20' },
          ].map((stat, idx) => (
            <div key={idx} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-2xl ${dt.bgSubtle} border ${dt.borderSubtle}`}>
              <div className={`w-3 h-3 rounded ${stat.color} shrink-0`} />
              <div className="min-w-0">
                <div className="h-3 w-6 rounded bg-muted/30 mb-0.5" />
                <div className="h-2 w-8 rounded bg-muted/20" />
              </div>
            </div>
          ))}
        </div>

        {/* Ghost tier badge */}
        <div className="h-4 w-14 rounded bg-muted/15" />
      </div>
    </div>
  );

  return (
    <Card className={`${dt.casinoCard} overflow-hidden relative`}>
      <div className={dt.casinoBar} />
      <div className="hidden lg:block absolute top-8 right-8 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ background: 'rgba(128,0,32,0.15)' }} />

      {/* Header — Maroon Heart style */}
      <div className={`flex items-center gap-2.5 px-3 lg:px-6 py-3 border-b ${dt.borderSubtle}`}>
        <div className="w-5 h-5 lg:w-6 lg:h-6 rounded flex items-center justify-center shrink-0" style={{ background: 'rgba(128,0,32,0.15)' }}>
          <Heart className="w-3 h-3 lg:w-3.5 lg:h-3.5" style={{ color: '#800020' }} />
        </div>
        <h3 className="text-xs lg:text-sm font-semibold uppercase tracking-wider">
          {division === 'male' ? 'Cowo' : 'Cewe'} Sultan of the Week
        </h3>
        {latestSultan && (
          <Badge className="hidden sm:inline-flex border-0 ml-auto text-[9px]" style={{ background: 'rgba(128,0,32,0.15)', color: '#800020' }}>❤️ MINGGU INI</Badge>
        )}
      </div>

      {/* Content */}
      <div className="p-4 lg:p-6">
        {content}
      </div>
    </Card>
  );
});

/* ─── Top Form Section — Weekly Best Performer per division (LEGACY — kept for backward compat) ─── */
export function TopFormSection({
  division,
  performer,
  onPlayerClick,
  bare = false,
}: {
  division: 'male' | 'female';
  performer: WeeklyPerformer | undefined;
  onPlayerClick: (player: TopPlayer & { division?: string }, division: 'male' | 'female') => void;
  bare?: boolean;
}) {
  const dt = getDivisionTheme(division);
  const accentColor = division === 'male' ? '#2E9FFF' : '#FF2D78';
  const DivisionIcon = division === 'male' ? Music : Shield;
  const genderSymbol = division === 'male' ? '♂' : '♀';

  /* ─── Shared content — performer banner, player card, composite breakdown ─── */
  const content = performer ? (
    <div className="space-y-3">
      {/* Top Form banner */}
      <div className={`flex items-center gap-3 p-4 sm:p-5 rounded-2xl ${dt.bgSubtle} ${dt.border}`}>
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shrink-0">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-amber-400 truncate">{performer.gamertag}</p>
          <p className="text-[10px] text-muted-foreground">Week {performer.weekNumber} • Composite {performer.compositeScore}</p>
        </div>
        <Badge className="bg-amber-500/15 text-amber-500 border-0 text-[9px]">🔥 TOP FORM</Badge>
      </div>
      {/* Player Card + Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div>
          <PlayerCard
            gamertag={performer.gamertag}
            avatar={performer.avatar}
            points={performer.points}
            totalWins={performer.weeklyWins}
            totalLosses={performer.weeklyLosses}
            totalMvp={0}
            streak={performer.streak}
            rank={1}
            club={performer.club ? { id: '', name: performer.club } : undefined}
            onClick={() => onPlayerClick({
              ...performer,
              name: performer.gamertag,
              totalWins: performer.weeklyWins,
              totalMvp: 0,
              maxStreak: performer.streak,
              matches: performer.weeklyMatches,
              division,
            } as TopPlayer & { division?: string }, division)}
          />
        </div>
        {/* Composite Score Breakdown */}
        <div className={`col-span-2 flex flex-col justify-center gap-2 p-4 sm:p-5 rounded-2xl ${dt.bgSubtle} ${dt.border}`}>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-bold text-amber-400">{performer.compositeScore}</span>
            <span className="text-[9px] text-muted-foreground">COMPOSITE</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className={`p-3 sm:p-4 rounded-2xl ${dt.bgSubtle} ${dt.borderSubtle} text-center`}>
              <p className={`text-sm font-bold ${dt.neonText}`}>{performer.weeklyWins}W/{performer.weeklyLosses}L</p>
              <p className="text-[9px] text-muted-foreground">Record</p>
            </div>
            <div className={`p-3 sm:p-4 rounded-2xl ${dt.bgSubtle} ${dt.borderSubtle} text-center`}>
              <p className={`text-sm font-bold ${dt.neonText}`}>{performer.weeklyWinRate}%</p>
              <p className="text-[9px] text-muted-foreground">Win%</p>
            </div>
            <div className={`p-3 sm:p-4 rounded-2xl ${dt.bgSubtle} ${dt.borderSubtle} text-center`}>
              <div className="flex items-center justify-center gap-0.5">
                <Flame className="w-3 h-3 text-orange-400" />
                <p className={`text-sm font-bold ${dt.neonText}`}>{performer.streak}</p>
              </div>
              <p className="text-[9px] text-muted-foreground">Streak</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : (
    /* Ghost empty state — mirrors filled layout structure */
    <div className="space-y-3 opacity-50">
      {/* Ghost Top Form banner */}
      <div className={`flex items-center gap-3 p-4 sm:p-5 rounded-2xl ${dt.bgSubtle} ${dt.border}`}>
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/25 to-orange-600/25 flex items-center justify-center shrink-0">
          <TrendingUp className="w-5 h-5 text-amber-500/40" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="h-4 w-24 rounded bg-muted/35 mb-1.5" />
          <div className="h-3 w-36 rounded bg-muted/25" />
        </div>
        <div className="h-5 w-16 rounded-full bg-muted/25 shrink-0" />
      </div>

      {/* Ghost player card + stats grid */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {/* Ghost player card */}
        <div className={`rounded-2xl overflow-hidden border ${dt.borderSubtle}`}>
          <div
            className="w-full flex items-center justify-center"
            style={{ aspectRatio: '3/4', background: `linear-gradient(135deg, ${accentColor}18, ${accentColor}08)` }}
          >
            <TrendingUp className="w-5 h-5 opacity-30" style={{ color: accentColor }} />
          </div>
          <div className="p-2 space-y-1.5">
            <div className="h-3 w-10 mx-auto rounded bg-muted/35" />
            <div className="h-2 w-6 mx-auto rounded bg-muted/25" />
          </div>
        </div>

        {/* Ghost composite stats */}
        <div className={`col-span-2 flex flex-col justify-center gap-2 p-4 sm:p-5 rounded-2xl ${dt.bgSubtle} ${dt.border}`}>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-amber-400/20" />
            <div className="h-4 w-8 rounded bg-muted/35" />
            <div className="h-3 w-14 rounded bg-muted/25" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className={`p-3 sm:p-4 rounded-2xl ${dt.bgSubtle} ${dt.borderSubtle} text-center`}>
                <div className="h-4 w-8 mx-auto rounded bg-muted/30 mb-1" />
                <div className="h-2 w-6 mx-auto rounded bg-muted/20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  /* ─── Bare mode — no Card wrapper, just content with division label ─── */
  if (bare) {
    return (
      <div className={`p-4 sm:p-5 rounded-2xl ${dt.bgSubtle} ${dt.borderSubtle}`}>
        {/* Division label */}
        <div className="flex items-center gap-1.5 mb-3">
          <DivisionIcon className="w-3 h-3 shrink-0" style={{ color: accentColor }} />
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: accentColor }}>
            {division === 'male' ? 'COWO' : 'CEWE'} {genderSymbol}
          </span>
        </div>
        {content}
      </div>
    );
  }

  /* ─── Full mode — Card wrapper with header, casino bar, etc. ─── */
  return (
    <Card className={`${dt.casinoCard} overflow-hidden relative`}>
      <div className={dt.casinoBar} />
      <div className={`hidden lg:block absolute top-8 right-8 w-32 h-32 rounded-full blur-3xl ${dt.bg} opacity-20 pointer-events-none`} />

      {/* Header */}
      <div className={`flex items-center gap-2.5 px-3 lg:px-6 py-3 border-b ${dt.borderSubtle}`}>
        <div className={`w-5 h-5 lg:w-6 lg:h-6 rounded bg-amber-500/15 flex items-center justify-center shrink-0`}>
          <TrendingUp className="w-3 h-3 lg:w-3.5 lg:h-3.5 text-amber-400" />
        </div>
        <h3 className="text-xs lg:text-sm font-semibold uppercase tracking-wider">
          {division === 'male' ? 'Cowo' : 'Cewe'} Top Form
        </h3>
        {performer && (
          <Badge className="hidden sm:inline-flex bg-amber-500/15 text-amber-500 border-0 ml-auto text-[9px]">🔥 MINGGU INI</Badge>
        )}
      </div>

      {/* Content */}
      <div className="p-4 lg:p-6">
        {content}
      </div>
    </Card>
  );
}

/** Compact currency formatting for widget display */
function formatCurrencyShort(amount: number): string {
  if (amount >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `Rp ${(amount / 1_000).toFixed(0)}K`;
  return `Rp ${amount}`;
}
