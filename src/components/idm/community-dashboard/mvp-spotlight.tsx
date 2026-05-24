'use client';

import React from 'react';
import { Trophy, Star, Flame, Crown, Zap, Award, Music, Shield } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getDivisionTheme } from '@/hooks/use-division-theme';
import { getCommunityTheme } from '@/hooks/use-community-theme';
import { getAvatarUrl, clubToString } from '@/lib/utils';
import { AvatarMedia } from '@/components/ui/avatar-media';
import type { StatsData, TopPlayer, MvpHallOfFameEntry } from '@/types/stats';

/* ═══════════════════════════════════════════
   MVP Spotlight Props
   ═══════════════════════════════════════════ */
type DivisionFilter = 'all' | 'male' | 'female';

interface MvpSpotlightProps {
  maleData?: StatsData;
  femaleData?: StatsData;
  selectedDivision?: DivisionFilter;
  onPlayerClick: (player: TopPlayer & { division?: string }, division: 'male' | 'female') => void;
}

/* ═══════════════════════════════════════════
   MVP Division Card — Same structure as ChampionsSection
   Header bar + inner content with horizontal MVP layout

   When `bare=true`, skip Card/casinoBar/blurOrb wrapper and
   add a small division label so users know which division
   they're looking at inside the unified card.
   ═══════════════════════════════════════════ */
function MvpDivisionCard({
  division,
  data,
  onPlayerClick,
  bare = false,
}: {
  division: 'male' | 'female';
  data?: StatsData;
  onPlayerClick: (player: TopPlayer & { division?: string }, division: 'male' | 'female') => void;
  bare?: boolean;
}) {
  const dt = getDivisionTheme(division);
  const emoji = division === 'male' ? '🕺' : '💃';

  // Division label helpers for bare mode
  const DivisionIcon = division === 'male' ? Music : Shield;
  const genderSymbol = division === 'male' ? '♂' : '♀';
  const accentColor = division === 'male' ? '#2E9FFF' : '#FF2D78';
  const divisionGradient = division === 'male'
    ? 'from-idm-male/20 to-idm-male/5'
    : 'from-idm-female/20 to-idm-female/5';

  // Priority: first entry from mvpHallOfFame, otherwise #1 from topPlayers
  const mvpEntry = data?.mvpHallOfFame?.[0];
  const topPlayer = data?.topPlayers?.[0];

  const featuredPlayer: (TopPlayer & { division?: string }) | null = mvpEntry
    ? {
        id: mvpEntry.id,
        name: mvpEntry.gamertag,
        gamertag: mvpEntry.gamertag,
        avatar: mvpEntry.avatar,
        tier: mvpEntry.tier,
        points: mvpEntry.points,
        totalWins: mvpEntry.totalWins,
        streak: mvpEntry.streak,
        maxStreak: mvpEntry.streak,
        totalMvp: mvpEntry.totalMvp,
        matches: 0,
        division,
      }
    : topPlayer
      ? { ...topPlayer, division }
      : null;

  /* ─── Empty state (no featured player) — Ghost layout matching filled MVP card ─── */
  if (!featuredPlayer) {
    // Bare mode: ghost layout with division label
    if (bare) {
      return (
        <div className={`rounded-2xl border ${dt.bgSubtle} ${dt.borderSubtle} p-4 lg:p-6`}>
          {/* Division label */}
          <div className="flex items-center gap-1.5 mb-3">
            <DivisionIcon className="w-3.5 h-3.5 shrink-0" style={{ color: accentColor }} />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accentColor }}>
              {division === 'male' ? 'COWO' : 'CEWE'} {genderSymbol}
            </span>
          </div>

          <div className="flex gap-3 sm:gap-4 items-stretch opacity-50">
            {/* Ghost avatar panel — same 3/4 aspect ratio */}
            <div
              className={`relative w-28 sm:w-36 lg:w-40 shrink-0 rounded-2xl overflow-hidden bg-gradient-to-br ${divisionGradient} border`}
              style={{ borderColor: accentColor + '20', aspectRatio: '3/4' }}
            >
              <Award className="w-10 h-10 mx-auto absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-25" style={{ color: accentColor }} />
            </div>

            {/* Ghost stats panel */}
            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
              {/* Ghost name */}
              <div>
                <div className="h-5 w-24 rounded bg-muted/35 mb-2" />
                <div className="h-3 w-16 rounded bg-muted/25 mb-4" />
              </div>

              {/* Ghost stats grid — 2x2 */}
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mb-3">
                {[
                  { color: 'bg-idm-gold-warm/20' },
                  { color: 'bg-green-400/20' },
                  { color: 'bg-yellow-400/20' },
                  { color: 'bg-orange-400/20' },
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

              {/* Ghost CTA button */}
              <div className="w-full h-7 rounded-lg bg-muted/20 border border-border/10" />
            </div>
          </div>
        </div>
      );
    }

    // Full card empty state — ghost layout
    return (
      <Card className={`${dt.casinoCard} overflow-hidden relative`}>
        <div className={dt.casinoBar} />
        {/* Header */}
        <div className={`flex items-center gap-2.5 px-3 lg:px-6 py-3 border-b ${dt.borderSubtle}`}>
          <div className={`w-5 h-5 lg:w-6 lg:h-6 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
            <Star className={`w-3 h-3 lg:w-3.5 lg:h-3.5 ${dt.neonText}`} />
          </div>
          <h3 className="text-xs lg:text-sm font-semibold uppercase tracking-wider">MVP {division === 'male' ? 'Cowo' : 'Cewe'}</h3>
        </div>
        <div className="p-4 lg:p-6">
          <div className="flex gap-3 sm:gap-4 items-stretch opacity-50">
            {/* Ghost avatar panel */}
            <div
              className={`relative w-28 sm:w-36 lg:w-40 shrink-0 rounded-2xl overflow-hidden bg-gradient-to-br ${divisionGradient} border`}
              style={{ borderColor: accentColor + '20', aspectRatio: '3/4' }}
            >
              <Award className="w-10 h-10 mx-auto absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-25" style={{ color: accentColor }} />
            </div>

            {/* Ghost stats panel */}
            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
              <div>
                <div className="h-5 w-24 rounded bg-muted/35 mb-2" />
                <div className="h-3 w-16 rounded bg-muted/25 mb-4" />
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mb-3">
                {[
                  { color: 'bg-idm-gold-warm/20' },
                  { color: 'bg-green-400/20' },
                  { color: 'bg-yellow-400/20' },
                  { color: 'bg-orange-400/20' },
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
              <div className="w-full h-7 rounded-lg bg-muted/20 border border-border/10" />
            </div>
          </div>
        </div>
      </Card>
    );
  }

  const clubName = clubToString(
    ('club' in featuredPlayer ? featuredPlayer.club : undefined) as Parameters<typeof clubToString>[0]
  );

  const stats = [
    { label: 'Points', value: featuredPlayer.points, icon: Trophy, color: 'text-idm-gold-warm' },
    { label: 'Wins', value: featuredPlayer.totalWins, icon: Crown, color: 'text-green-400' },
    { label: 'MVP', value: featuredPlayer.totalMvp, icon: Star, color: 'text-yellow-400' },
    { label: 'Streak', value: featuredPlayer.streak, icon: Flame, color: 'text-orange-400' },
  ];

  /* ─── Inner content — shared between bare & full modes ─── */
  const mvpContent = (
    <div className="p-4 lg:p-6">
      {/* Division label — only in bare mode */}
      {bare && (
        <div className="flex items-center gap-1.5 mb-3">
          <DivisionIcon className="w-3.5 h-3.5 shrink-0" style={{ color: accentColor }} />
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accentColor }}>
            {division === 'male' ? 'COWO' : 'CEWE'} {genderSymbol}
          </span>
        </div>
      )}

      <div className="flex gap-3 sm:gap-4 items-stretch">
        {/* Avatar panel */}
        <div className={`relative w-28 sm:w-36 lg:w-40 shrink-0 rounded-2xl overflow-hidden bg-gradient-to-br ${
          division === 'male' ? 'from-idm-male/25 to-idm-male/5' : 'from-idm-female/25 to-idm-female/5'
        }`} style={{ aspectRatio: '3/4' }}>
          {/* Full-cover avatar */}
          <AvatarMedia
            src={getAvatarUrl(featuredPlayer.gamertag, division, featuredPlayer.avatar)}
            alt={featuredPlayer.gamertag}
            width={128}
            height={200}
            className="w-full h-full object-cover"
            loading="lazy"
          />

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />

          {/* Crown badge — top right */}
          <div className="absolute top-2 right-2 z-10">
            <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-full bg-idm-gold-warm flex items-center justify-center shadow-[0_0_12px_rgba(239,249,35,0.4)] mvp-platinum-pulse">
              <Crown className="w-3 h-3 lg:w-3.5 lg:h-3.5 text-background" />
            </div>
          </div>

          {/* MVP badge — bottom */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
            <Badge className="bg-gradient-to-r from-idm-gold-warm to-amber-500 text-black text-[7px] font-black border-0 px-2 py-0.5 shadow-[0_0_8px_rgba(249,203,37,0.3)] whitespace-nowrap">
              <Star className="w-2 h-2 mr-0.5" />
              MVP
            </Badge>
          </div>
        </div>

        {/* Stats + Info panel */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          {/* Player name + badges */}
          <div>
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <h3 className="text-sm lg:text-base font-black truncate">{featuredPlayer.gamertag}</h3>
            </div>
            <div className="flex items-center gap-1.5 mb-3">
              {clubName && (
                <span className="text-[9px] lg:text-[10px] text-muted-foreground/70 truncate">{clubName}</span>
              )}
              <Badge className={`${dt.badgeBg} text-[7px] lg:text-[8px] border py-0 px-1.5`}>
                {emoji} {division === 'male' ? 'Cowo' : 'Cewe'}
              </Badge>
            </div>
          </div>

          {/* Stats grid — 2x2 */}
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mb-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-2xl ${dt.bgSubtle} border ${dt.borderSubtle}`}
              >
                <stat.icon className={`w-3 h-3 shrink-0 ${stat.color}`} />
                <div className="min-w-0">
                  <p className={`text-[10px] sm:text-xs font-black tabular-nums ${stat.color} leading-tight`}>
                    {stat.value}
                  </p>
                  <p className="text-[7px] sm:text-[8px] text-muted-foreground/60 uppercase tracking-wider font-semibold leading-tight">
                    {stat.label}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* MVP info (if from Hall of Fame) */}
          {mvpEntry && (
            <div className="flex items-center gap-1 mb-2">
              <Trophy className="w-2.5 h-2.5 text-idm-gold-warm/60 shrink-0" />
              <span className="text-[8px] text-muted-foreground/50 truncate">
                MVP W{mvpEntry.weekNumber} — {mvpEntry.tournamentName}
              </span>
            </div>
          )}

          {/* CTA button */}
          <button
            onClick={() => onPlayerClick(featuredPlayer, division)}
            className={`w-full py-1.5 rounded-lg bg-gradient-to-r ${
              division === 'male'
                ? 'from-idm-male/20 to-idm-male-light/10 border-idm-male/20'
                : 'from-idm-female/20 to-idm-female-light/10 border-idm-female/20'
            } border text-[9px] sm:text-[10px] font-bold ${dt.text} hover:brightness-110 transition-all flex items-center justify-center gap-1 cursor-pointer`}
          >
            <Zap className="w-2.5 h-2.5" />
            Lihat Profil
          </button>
        </div>
      </div>
    </div>
  );

  /* ─── Bare mode: just the inner content with subtle tint wrapper ─── */
  if (bare) {
    return (
      <div className={`rounded-2xl border ${dt.borderSubtle} ${dt.bgSubtle} dashboard-card-glow overflow-hidden`}>
        {mvpContent}
      </div>
    );
  }

  /* ─── Full card mode ─── */
  return (
    <Card className={`${dt.casinoCard} dashboard-card-alive dashboard-card-glow overflow-hidden relative`}>
      <div className={dt.casinoBar} />
      {/* Decorative blur orb — same as ChampionsSection */}
      <div className={`hidden lg:block absolute top-8 right-8 w-32 h-32 rounded-full blur-3xl ${dt.bg} opacity-20 pointer-events-none`} />

      {/* Header — same structure as ChampionsSection */}
      <div className={`flex items-center gap-2.5 px-3 lg:px-6 py-3 border-b ${dt.borderSubtle}`}>
        <div className={`w-5 h-5 lg:w-6 lg:h-6 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
          <Star className={`w-3 h-3 lg:w-3.5 lg:h-3.5 ${dt.neonText}`} />
        </div>
        <h3 className="text-xs lg:text-sm font-semibold uppercase tracking-wider">MVP {division === 'male' ? 'Cowo' : 'Cewe'}</h3>
        <Badge className={`hidden sm:inline-flex ${dt.casinoBadge} ml-auto text-[9px]`}>MVP SPOTLIGHT</Badge>
      </div>

      {mvpContent}
    </Card>
  );
}

/* ═══════════════════════════════════════════
   Main Component — MVP Spotlight
   When "all" → unified card with community gold theme,
     male & female MVPs side by side (desktop) / stacked (mobile)
   When specific division → single card as before
   ═══════════════════════════════════════════ */
export const MvpSpotlight = React.memo(function MvpSpotlight({ maleData, femaleData, selectedDivision = 'all', onPlayerClick }: MvpSpotlightProps) {
  const ct = getCommunityTheme();

  const showMale = selectedDivision === 'all' || selectedDivision === 'male';
  const showFemale = selectedDivision === 'all' || selectedDivision === 'female';

  // When both divisions shown ("all"), use unified card
  if (selectedDivision === 'all') {
    // Check if both have no data → unified empty state
    const maleMvp = maleData?.mvpHallOfFame?.[0] || maleData?.topPlayers?.[0];
    const femaleMvp = femaleData?.mvpHallOfFame?.[0] || femaleData?.topPlayers?.[0];
    const bothEmpty = !maleMvp && !femaleMvp;

    return (
      <Card className={`${ct.casinoCard} dashboard-card-alive overflow-hidden relative`}>
        <div className={ct.casinoBar} />

        {/* Unified header — "MVP Spotlight" (no division label) */}
        <div className={`flex items-center gap-2.5 px-3 lg:px-6 py-3 border-b ${ct.borderSubtle}`}>
          <div className={`w-5 h-5 lg:w-6 lg:h-6 rounded ${ct.iconBg} flex items-center justify-center shrink-0`}>
            <Star className={`w-3 h-3 lg:w-3.5 lg:h-3.5 ${ct.neonText}`} />
          </div>
          <h3 className="text-xs lg:text-sm font-semibold uppercase tracking-wider">MVP Spotlight</h3>
          <Badge className={`hidden sm:inline-flex ${ct.casinoBadge} ml-auto text-[9px]`}>MVP SPOTLIGHT</Badge>
        </div>

        {bothEmpty ? (
          /* Unified ghost state — both divisions empty */
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2">
              <div className={`border-b lg:border-b-0 lg:border-r ${ct.borderSubtle}`}>
                <MvpDivisionCard
                  division="male"
                  data={maleData}
                  onPlayerClick={onPlayerClick}
                  bare
                />
              </div>
              <div>
                <MvpDivisionCard
                  division="female"
                  data={femaleData}
                  onPlayerClick={onPlayerClick}
                  bare
                />
              </div>
            </div>
          </div>
        ) : (
          /* Division sub-sections side by side on desktop, stacked on mobile */
          <div className="grid grid-cols-1 lg:grid-cols-2">
            {showMale && (
              <div className={`border-b lg:border-b-0 lg:border-r ${ct.borderSubtle}`}>
                <MvpDivisionCard
                  division="male"
                  data={maleData}
                  onPlayerClick={onPlayerClick}
                  bare
                />
              </div>
            )}
            {showFemale && (
              <div>
                <MvpDivisionCard
                  division="female"
                  data={femaleData}
                  onPlayerClick={onPlayerClick}
                  bare
                />
              </div>
            )}
          </div>
        )}
      </Card>
    );
  }

  // Specific division → single card as before
  return (
    <div className="grid grid-cols-1">
      {showMale && (
        <MvpDivisionCard
          division="male"
          data={maleData}
          onPlayerClick={onPlayerClick}
        />
      )}
      {showFemale && (
        <MvpDivisionCard
          division="female"
          data={femaleData}
          onPlayerClick={onPlayerClick}
        />
      )}
    </div>
  );
});
