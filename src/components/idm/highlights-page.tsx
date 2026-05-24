'use client';

import React, { useState, useCallback, startTransition } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Crown, Music, Shield, ChevronDown, Trophy, Users, Heart, Gem, Zap, Banknote, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AvatarMedia } from '@/components/ui/avatar-media';
import type { StatsData, TopPlayer, SeasonChampionPlayer, SultanOfWeekly, SultanPlayer } from '@/types/stats';
import { useCommunityTheme } from '@/hooks/use-community-theme';
import { getDivisionTheme } from '@/hooks/use-division-theme';
import { getAvatarUrl, clubToString, hexToRgba } from '@/lib/utils';
import { ClubLogoImage } from '@/components/idm/club-logo-image';

// Import champion section components
import { WeeklyChampionCard } from './community-dashboard/weekly-champion-card';
import { MvpSpotlight } from './community-dashboard/mvp-spotlight';
import { MvpHallOfFame } from './community-dashboard/mvp-hall-of-fame';
import { SharePopup } from './social-share-button';

/** color-mix shorthand for theme-aware transparency */
const cm = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

// Lazy load section components
import dynamic from 'next/dynamic';
const PlayerProfile = dynamic(() => import('./player-profile').then(m => ({ default: m.PlayerProfile })), { ssr: false, loading: () => null });


type DivisionFilter = 'all' | 'male' | 'female';


/* ═══════════════════════════════════════════
   Champion Collapsible — Dropdown wrapper for champion sections
   Collapsed: compact header bar with icon + title + summary
   Expanded: full content + optional extra content below
   ═══════════════════════════════════════════ */
function ChampionCollapsible({
  icon: Icon,
  iconColor,
  title,
  badge,
  badgeColor = 'idm-gold-warm',
  summary,
  defaultOpen = false,
  children,
  extraContent,
}: {
  icon: typeof Crown;
  iconColor: string;
  title: string;
  badge?: React.ReactNode;
  badgeColor?: string;
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  extraContent?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-idm-gold-warm/10 bg-card/60 overflow-hidden transition-all duration-300">
      {/* Collapsible Header — always visible */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3 lg:px-5 py-2.5 cursor-pointer hover:bg-idm-gold-warm/[0.03] transition-colors"
      >
        <div
          className="w-5 h-5 rounded flex items-center justify-center shrink-0"
          style={{ backgroundColor: hexToRgba(iconColor, 0.15), border: `1px solid ${hexToRgba(iconColor, 0.25)}` }}
        >
          <Icon className="w-3 h-3" style={{ color: iconColor }} />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: iconColor }}>
          {title}
        </span>
        {summary && (
          <span className="text-[10px] text-muted-foreground/60 truncate flex-1 text-right">
            {summary}
          </span>
        )}
        {badge && (
          <span className="ml-auto">{badge}</span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 text-muted-foreground/50 shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Collapsible Content */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${open ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="border-t border-idm-gold-warm/8">
          {children}
        </div>
        {extraContent}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════
   Champion Header — Sticky heading with division filter tabs
   ═══════════════════════════════════════════ */
const ChampionsMvpHeader = React.memo(function ChampionsMvpHeader({
  selectedDivision,
  onDivisionChange,
}: {
  selectedDivision: DivisionFilter;
  onDivisionChange: (d: DivisionFilter) => void;
}) {
  const ct = useCommunityTheme();

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className={`w-5 h-5 rounded ${ct.iconBg} flex items-center justify-center shrink-0`}>
          <Crown className={`w-3 h-3 ${ct.neonText}`} />
        </div>
        <h3 className="text-xs font-semibold uppercase tracking-wider shrink-0" style={{
          background: 'linear-gradient(135deg, #FAF0DC 0%, #EFF923 30%, #F9CB25 50%, #F9CB25 70%, #EFF923 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>Champion</h3>
      </div>

      {/* Division pills — compact, right-aligned */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-idm-gold-warm/5 border border-idm-gold-warm/10">
        {([
          { key: 'all' as DivisionFilter, label: 'Semua' },
          { key: 'male' as DivisionFilter, label: 'Cowo' },
          { key: 'female' as DivisionFilter, label: 'Cewe' },
        ]).map(div => (
          <button
            key={div.key}
            onClick={() => onDivisionChange(div.key)}
            className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
              selectedDivision === div.key
                ? 'bg-idm-gold-warm/15 text-idm-gold-warm shadow-sm shadow-idm-gold-warm/10 border border-idm-gold-warm/25'
                : 'text-muted-foreground/70 hover:text-foreground border border-transparent hover:bg-muted/40'
            }`}
          >
            {div.label}
          </button>
        ))}
      </div>
    </div>
  );
});


/* ═══════════════════════════════════════════
   Champion Division Card — MVP-style horizontal layout
   Avatar panel LEFT + Stats panel RIGHT
   ═══════════════════════════════════════════ */
const ChampionDivisionCard = React.memo(function ChampionDivisionCard({
  champion,
  seasonNumber,
  division,
  onPlayerClick,
  bare = false,
}: {
  champion: SeasonChampionPlayer;
  seasonNumber: number;
  division: 'male' | 'female';
  onPlayerClick: (player: TopPlayer & { division?: string }, division: 'male' | 'female') => void;
  bare?: boolean;
}) {
  const dt = getDivisionTheme(division);
  const emoji = division === 'male' ? '🕺' : '💃';
  const DivisionIcon = division === 'male' ? Music : Shield;
  const genderSymbol = division === 'male' ? '♂' : '♀';
  const accentColor = division === 'male' ? '#2E9FFF' : '#FF2D78';
  const divisionGradient = division === 'male'
    ? 'from-idm-male/25 to-idm-male/5'
    : 'from-idm-female/25 to-idm-female/5';

  const clubName = clubToString(champion.club as Parameters<typeof clubToString>[0]);

  const stats = [
    { label: 'Points', value: champion.points, icon: Trophy, color: 'text-idm-gold-warm' },
    { label: 'Wins', value: champion.totalWins, icon: Crown, color: 'text-green-400' },
    { label: 'Season', value: `S${seasonNumber}`, icon: Calendar, color: 'text-idm-gold-warm/80' },
  ];

  const content = (
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
        {/* Avatar panel — LEFT */}
        <div
          className={`relative w-28 sm:w-36 lg:w-40 shrink-0 rounded-2xl overflow-hidden bg-gradient-to-br ${divisionGradient}`}
          style={{ aspectRatio: '3/4' }}
        >
          <AvatarMedia
            src={getAvatarUrl(champion.gamertag, division, champion.avatar)}
            alt={champion.gamertag}
            width={128}
            height={200}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
          {/* Crown badge — top right */}
          <div className="absolute top-2 right-2 z-10">
            <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-full bg-idm-gold-warm flex items-center justify-center shadow-[0_0_12px_rgba(239,249,35,0.4)]">
              <Crown className="w-3 h-3 lg:w-3.5 lg:h-3.5 text-background" />
            </div>
          </div>
          {/* Division badge — bottom */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
            <Badge className={`${dt.badgeBg} text-[7px] lg:text-[8px] border py-0 px-1.5 whitespace-nowrap`}>
              {emoji} {division === 'male' ? 'Cowo' : 'Cewe'}
            </Badge>
          </div>
        </div>

        {/* Stats panel — RIGHT */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          {/* Player name + badges */}
          <div>
            <h3 className="text-sm lg:text-base font-black truncate">{champion.gamertag}</h3>
            <div className="flex items-center gap-1.5 mb-3">
              {clubName && (
                <span className="text-[9px] lg:text-[10px] text-muted-foreground/70 truncate">{clubName}</span>
              )}
              <Badge className={`${dt.badgeBg} text-[7px] lg:text-[8px] border py-0 px-1.5`}>
                {emoji} {division === 'male' ? 'Cowo' : 'Cewe'}
              </Badge>
            </div>
          </div>

          {/* Stats grid */}
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

          {/* CTA button */}
          <button
            onClick={() => onPlayerClick({
              ...champion,
              name: champion.gamertag,
              club: champion.club ?? undefined,
              division,
            }, division)}
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

  if (bare) {
    return (
      <div className={`rounded-2xl border ${dt.borderSubtle} ${dt.bgSubtle} dashboard-card-glow overflow-hidden`}>
        {content}
      </div>
    );
  }

  return content;
});


/* ─── Ghost Champion Division Card — Empty state matching MVP-style layout ─── */
const GhostChampionDivisionCard = React.memo(function GhostChampionDivisionCard({
  division,
  bare = false,
}: {
  division: 'male' | 'female';
  bare?: boolean;
}) {
  const dt = getDivisionTheme(division);
  const DivisionIcon = division === 'male' ? Music : Shield;
  const genderSymbol = division === 'male' ? '♂' : '♀';
  const accentColor = division === 'male' ? '#2E9FFF' : '#FF2D78';
  const divisionGradient = division === 'male'
    ? 'from-idm-male/20 to-idm-male/5'
    : 'from-idm-female/20 to-idm-female/5';

  const content = (
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

      <div className="flex gap-3 sm:gap-4 items-stretch opacity-50">
        {/* Ghost avatar panel — same 3/4 aspect ratio */}
        <div
          className={`relative w-28 sm:w-36 lg:w-40 shrink-0 rounded-2xl overflow-hidden bg-gradient-to-br ${divisionGradient} border`}
          style={{ borderColor: accentColor + '20', aspectRatio: '3/4' }}
        >
          <Crown className="w-10 h-10 mx-auto absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-25" style={{ color: accentColor }} />
        </div>

        {/* Ghost stats panel */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          <div>
            <div className="h-5 w-24 rounded bg-muted/35 mb-2" />
            <div className="h-3 w-16 rounded bg-muted/25 mb-4" />
          </div>

          {/* Ghost stats grid */}
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mb-3">
            {[
              { color: 'bg-idm-gold-warm/20' },
              { color: 'bg-green-400/20' },
              { color: 'bg-idm-gold-warm/15' },
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

  if (bare) {
    return (
      <div className={`rounded-2xl border ${dt.borderSubtle} ${dt.bgSubtle} overflow-hidden opacity-55`}>
        {content}
      </div>
    );
  }

  return <div className="opacity-55">{content}</div>;
});


/* ═══════════════════════════════════════════
   Season Champion & Sultan of Season — Tabbed Card
   Merges both sections into one card with pill tabs.
   ═══════════════════════════════════════════ */
const SeasonChampionSultanTabs = React.memo(function SeasonChampionSultanTabs({
  maleData,
  femaleData,
  selectedDivision,
  onPlayerClick,
  seasonChampionSummary,
  seasonChampionNumber,
  sultanSummary,
  sultanSeasonNumber,
  maleSeasonSultans,
  femaleSeasonSultans,
}: {
  maleData?: StatsData;
  femaleData?: StatsData;
  selectedDivision: DivisionFilter;
  onPlayerClick: (player: TopPlayer & { division?: string }, division: 'male' | 'female') => void;
  seasonChampionSummary: string;
  seasonChampionNumber: number;
  sultanSummary: string;
  sultanSeasonNumber: number;
  maleSeasonSultans: { seasonNumber: number; sultan: SultanPlayer }[];
  femaleSeasonSultans: { seasonNumber: number; sultan: SultanPlayer }[];
}) {
  const ct = useCommunityTheme();
  const [activeTab, setActiveTab] = useState<'champion' | 'sultan'>(
    seasonChampionSummary ? 'champion' : sultanSummary ? 'sultan' : 'champion'
  );

  const tabs = [
    {
      key: 'champion' as const,
      label: 'Season Champion',
      icon: Crown,
      color: '#EFF923',
      summary: seasonChampionSummary,
      badge: seasonChampionNumber > 0 ? (
        <Badge className="bg-idm-gold-warm/15 text-idm-gold-warm border border-idm-gold-warm/25 text-[8px] font-bold">
          <Crown className="w-2.5 h-2.5 mr-0.5" />S{seasonChampionNumber}
        </Badge>
      ) : (
        <Badge className="bg-muted/20 text-muted-foreground/40 border border-border/10 text-[8px] font-bold">TBA</Badge>
      ),
    },
    {
      key: 'sultan' as const,
      label: 'Sultan of Season',
      icon: Gem,
      color: '#43A047',
      summary: sultanSummary,
      badge: sultanSeasonNumber > 0 ? (
        <Badge className="text-[8px] font-bold border" style={{
          color: '#66BB6A', backgroundColor: 'rgba(67,160,71,0.1)',
          borderColor: 'rgba(67,160,71,0.2)' }}>
          💎 S{sultanSeasonNumber}
        </Badge>
      ) : (
        <Badge className="bg-muted/20 text-muted-foreground/40 border border-border/10 text-[8px] font-bold">TBA</Badge>
      ),
    },
  ];

  const activeTabData = tabs.find(t => t.key === activeTab)!;

  return (
    <div className="rounded-2xl border border-idm-gold-warm/10 bg-card/60 overflow-hidden transition-all duration-300">
      {/* Header with pill tabs */}
      <div className="flex items-center gap-2 px-3 lg:px-5 py-2.5 border-b border-idm-gold-warm/10">
        {/* Pill tabs */}
        <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-0.5">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-card shadow-sm text-foreground'
                    : 'text-muted-foreground/60 hover:text-muted-foreground/90 hover:bg-muted/40'
                }`}
              >
                <tab.icon className="w-3 h-3 shrink-0" style={{ color: isActive ? tab.color : undefined }} />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.key === 'champion' ? 'Champion' : 'Sultan'}</span>
              </button>
            );
          })}
        </div>

        {/* Active tab summary */}
        {activeTabData.summary && (
          <span className="text-[10px] text-muted-foreground/60 truncate flex-1 text-right">
            {activeTabData.summary}
          </span>
        )}

        {/* Active tab badge */}
        <div className="shrink-0">
          {activeTabData.badge}
        </div>
      </div>

      {/* Tab content */}
      <div className="animate-fade-enter-sm">
        {activeTab === 'champion' ? (
          <SeasonChampionPlaque
            maleData={maleData}
            femaleData={femaleData}
            selectedDivision={selectedDivision}
            onPlayerClick={onPlayerClick}
            bare
          />
        ) : (
          <SultanOfSeasonCardPage
            maleSultans={maleSeasonSultans}
            femaleSultans={femaleSeasonSultans}
            selectedDivision={selectedDivision}
            onPlayerClick={onPlayerClick}
            bare
          />
        )}
      </div>
    </div>
  );
});


/* ═══════════════════════════════════════════
   Season Champion Plaque — MVP-style horizontal layout
   Shows the most recent completed season's champions.
   ═══════════════════════════════════════════ */
const SeasonChampionPlaque = React.memo(function SeasonChampionPlaque({
  maleData,
  femaleData,
  selectedDivision,
  onPlayerClick,
  bare = false,
}: {
  maleData?: StatsData;
  femaleData?: StatsData;
  selectedDivision: DivisionFilter;
  onPlayerClick: (player: TopPlayer & { division?: string }, division: 'male' | 'female') => void;
  bare?: boolean;
}) {
  const ct = useCommunityTheme();

  // Extract most recent COMPLETED season champion per division.
  // Only show champions from completed seasons (admin-assigned),
  // NOT the current leaderboard leader from active seasons.
  // This ensures the Season Champion section shows the actual
  // season winner (e.g. Aiuren, AiTan from S1) and is distinct
  // from the hero banner top rank (e.g. zmz, reptil from live leaderboard).
  const maleSeasonsWithChampion = maleData?.allSeasons?.filter(s => s.championPlayer && s.status === 'completed') || [];
  const femaleSeasonsWithChampion = femaleData?.allSeasons?.filter(s => s.championPlayer && s.status === 'completed') || [];

  // Sort descending by season number, take first = most recent
  const latestMale = maleSeasonsWithChampion.sort((a, b) => b.number - a.number)[0];
  const latestFemale = femaleSeasonsWithChampion.sort((a, b) => b.number - a.number)[0];

  const hasMale = !!latestMale?.championPlayer;
  const hasFemale = !!latestFemale?.championPlayer;
  const showMale = selectedDivision === 'all' || selectedDivision === 'male';
  const showFemale = selectedDivision === 'all' || selectedDivision === 'female';

  // Determine which season label to show
  const seasonNumber = hasMale && hasFemale
    ? Math.max(latestMale.number, latestFemale.number)
    : hasMale ? latestMale.number : hasFemale ? latestFemale.number : 0;

  const content = (
    <>
      {/* Header — "Season Champion" with season badge — only shown when NOT bare */}
      {!bare && (
        <>
          <div className={ct.casinoBar} />
          <div className={`flex items-center gap-2.5 px-3 lg:px-5 py-2.5 border-b ${ct.borderSubtle}`}>
            <div className={`w-5 h-5 rounded ${ct.iconBg} flex items-center justify-center shrink-0`}>
              <Crown className={`w-3 h-3 ${ct.neonText}`} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-idm-gold-warm">Season Champion</span>
            <SharePopup
              shareUrl={typeof window !== 'undefined' ? `${window.location.origin}/?view=champion` : ''}
              title="Bagikan Juara"
              subtitle="Season Champion"
              shareText="Lihat juara Tarkam IDM!"
              buttonLabel="Bagikan juara"
              size="sm"
            />
            {seasonNumber > 0 ? (
              <Badge className="bg-idm-gold-warm/15 text-idm-gold-warm border border-idm-gold-warm/25 ml-auto text-[9px] font-bold">
                <Crown className="w-2.5 h-2.5 mr-0.5" />S{seasonNumber}
              </Badge>
            ) : (
              <Badge className="bg-muted/20 text-muted-foreground/40 border border-border/10 ml-auto text-[9px] font-bold">
                TBA
              </Badge>
            )}
          </div>
        </>
      )}

      {/* Content — MVP-style division cards */}
      {selectedDivision === 'all' ? (
        /* Unified "all" mode: male/female side-by-side on desktop, stacked on mobile */
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {showMale && (
            <div className={`border-b lg:border-b-0 lg:border-r ${ct.borderSubtle}`}>
              {hasMale && latestMale?.championPlayer ? (
                <ChampionDivisionCard
                  champion={latestMale.championPlayer}
                  seasonNumber={latestMale.number}
                  division="male"
                  onPlayerClick={onPlayerClick}
                  bare
                />
              ) : (
                <GhostChampionDivisionCard division="male" bare />
              )}
            </div>
          )}
          {showFemale && (
            <div>
              {hasFemale && latestFemale?.championPlayer ? (
                <ChampionDivisionCard
                  champion={latestFemale.championPlayer}
                  seasonNumber={latestFemale.number}
                  division="female"
                  onPlayerClick={onPlayerClick}
                  bare
                />
              ) : (
                <GhostChampionDivisionCard division="female" bare />
              )}
            </div>
          )}
        </div>
      ) : (
        /* Specific division mode — single card */
        <div>
          {showMale && (
            hasMale && latestMale?.championPlayer ? (
              <ChampionDivisionCard
                champion={latestMale.championPlayer}
                seasonNumber={latestMale.number}
                division="male"
                onPlayerClick={onPlayerClick}
              />
            ) : (
              <GhostChampionDivisionCard division="male" />
            )
          )}
          {showFemale && (
            hasFemale && latestFemale?.championPlayer ? (
              <ChampionDivisionCard
                champion={latestFemale.championPlayer}
                seasonNumber={latestFemale.number}
                division="female"
                onPlayerClick={onPlayerClick}
              />
            ) : (
              <GhostChampionDivisionCard division="female" />
            )
          )}
        </div>
      )}
    </>
  );

  if (bare) {
    return content;
  }

  return (
    <div className="animate-fade-enter-sm">
      <div className={`rounded-2xl ${ct.casinoCard} overflow-hidden`}>
        {content}
      </div>
    </div>
  );
});


/* ─── Club Champion Member type ─── */
interface ClubChampionMember {
  id: string;
  gamertag: string;
  avatar?: string | null;
  tier: string;
  points: number;
  division: 'male' | 'female';
}

/* ═══════════════════════════════════════════
   Season 1 Club Champion Card
   Premium showcase of the club that won Season 1
   ═══════════════════════════════════════════ */
const SeasonOneClubChampion = React.memo(function SeasonOneClubChampion({
  maleData,
  femaleData,
  selectedDivision,
  bare = false,
}: {
  maleData?: StatsData;
  femaleData?: StatsData;
  selectedDivision: DivisionFilter;
  bare?: boolean;
}) {
  const ct = useCommunityTheme();

  // Find season 1 completed data from both divisions
  const maleSeason1 = maleData?.allSeasons?.find(s => s.number === 1 && s.status === 'completed' && s.championClub);
  const femaleSeason1 = femaleData?.allSeasons?.find(s => s.number === 1 && s.status === 'completed' && s.championClub);

  // Merge champion club entries from both divisions
  const clubEntries: { club: NonNullable<StatsData['allSeasons']>[0]['championClub']; division: 'male' | 'female' }[] = [];
  if (maleSeason1?.championClub) clubEntries.push({ club: maleSeason1.championClub, division: 'male' });
  if (femaleSeason1?.championClub) clubEntries.push({ club: femaleSeason1.championClub, division: 'female' });

  const hasData = clubEntries.length > 0;

  // Check division filter
  const showMale = selectedDivision === 'all' || selectedDivision === 'male';
  const showFemale = selectedDivision === 'all' || selectedDivision === 'female';
  const filteredEntries = hasData ? clubEntries.filter(e => (e.division === 'male' ? showMale : showFemale)) : [];

  // Merge members from all filtered entries (deduplicate by id, sum points)
  const memberMap = new Map<string, ClubChampionMember>();
  for (const entry of filteredEntries) {
    if (entry.club?.members) {
      for (const m of entry.club.members) {
        const existing = memberMap.get(m.id);
        if (existing) {
          existing.points += m.points;
        } else {
          memberMap.set(m.id, { ...m });
        }
      }
    }
  }
  const allMembers = Array.from(memberMap.values()).sort((a, b) => b.points - a.points);
  const clubData = filteredEntries[0]?.club;

  const totalPoints = clubData?.totalPoints || allMembers.reduce((s, m) => s + m.points, 0);
  const memberCount = allMembers.length;
  const maleMembers = allMembers.filter(m => m.division === 'male');
  const femaleMembers = allMembers.filter(m => m.division === 'female');
  const captainMember = allMembers[0];

  const headerSection = !bare ? (
    <>
      <div className={ct.casinoBar} />
      <div className={`flex items-center gap-2.5 px-3 lg:px-5 py-2.5 border-b ${ct.borderSubtle}`}>
        <div className={`w-5 h-5 rounded ${ct.iconBg} flex items-center justify-center shrink-0`}>
          <Trophy className={`w-3 h-3 ${ct.neonText}`} />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-idm-gold-warm">Season 1 Club Champion</span>
        {hasData ? (
          <Badge className="bg-idm-gold-warm/15 text-idm-gold-warm border border-idm-gold-warm/25 ml-auto text-[9px] font-bold">
            <Trophy className="w-2.5 h-2.5 mr-0.5" />S1
          </Badge>
        ) : (
          <Badge className="bg-muted/20 text-muted-foreground/40 border border-border/10 ml-auto text-[9px] font-bold">
            TBA
          </Badge>
        )}
      </div>
    </>
  ) : null;

  const content = (
    <>
      {headerSection}
      {hasData && clubData ? (
      /* ═══ Data State — Full club champion display ═══ */
      <div className="p-3 sm:p-5">
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
          {/* Club Logo + Crown */}
          <div className="relative shrink-0">
                <div
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border border-idm-gold-warm/15 bg-white/[0.02]"
                  style={{ boxShadow: '0 0 24px rgba(239,249,35,0.06)' }}
                >
                  <ClubLogoImage clubName={clubData.name} dbLogo={clubData.logo} alt={clubData.name} width={96} height={96} className="w-full h-full object-cover" />
                </div>
                {/* Crown badge */}
                <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-idm-gold-warm/80 flex items-center justify-center" style={{ boxShadow: '0 0 12px rgba(239,249,35,0.3)' }}>
                  <Crown className="w-3 h-3 text-[#080a14]" />
                </div>
              </div>

              {/* Club Info */}
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <h4 className="text-lg sm:text-xl font-black uppercase tracking-wide text-foreground">
                  {clubData.name}
                </h4>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                  Club terbaik Tarkam IDM Season 1
                </p>

                {/* Stats row */}
                <div className="flex items-center gap-2 mt-2.5 justify-center sm:justify-start flex-wrap">
                  <span className="bg-idm-gold-warm/10 text-idm-gold-warm text-[10px] border border-idm-gold-warm/15 px-2 py-0.5 rounded-md font-bold tabular-nums">
                    {totalPoints}pts
                  </span>
                  {maleMembers.length > 0 && (
                    <span className="bg-idm-male/8 text-idm-male-light text-[10px] border border-idm-male/12 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                      <Users className="w-3 h-3" />{maleMembers.length} Cowo
                    </span>
                  )}
                  {femaleMembers.length > 0 && (
                    <span className="bg-idm-female/8 text-idm-female-light text-[10px] border border-idm-female/12 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                      <Users className="w-3 h-3" />{femaleMembers.length} Cewe
                    </span>
                  )}
                  <span className="bg-muted/5 text-muted-foreground text-[10px] border border-border/15 px-2 py-0.5 rounded-md font-bold">
                    {memberCount} Total
                  </span>
                </div>
              </div>
            </div>

            {/* Top Performers — member avatars */}
            {allMembers.length > 0 && (
              <div className="mt-4 pt-3 border-t border-idm-gold-warm/8">
                <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider font-semibold mb-2.5">Top Performers</p>
                <div className="flex flex-wrap gap-2">
                  {allMembers.slice(0, 5).map((member) => (
                    <div key={member.id} className="group/member relative flex flex-col items-center">
                      <div
                        className={`w-11 h-11 rounded-xl overflow-hidden border transition-all duration-200 ${
                          member.division === 'male'
                            ? 'border-idm-male/15'
                            : 'border-idm-female/15'
                        } ${captainMember?.id === member.id ? 'ring-1 ring-idm-gold-warm/30 border-idm-gold-warm/20' : ''}`}
                      >
                        <AvatarMedia
                          src={getAvatarUrl(member.gamertag, member.division, member.avatar)}
                          alt={member.gamertag}
                          width={44}
                          height={44}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        {/* Captain badge */}
                        {captainMember?.id === member.id && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-idm-gold-warm/70 flex items-center justify-center z-10">
                            <Crown className="w-2 h-2 text-[#080a14]" />
                          </div>
                        )}
                      </div>
                      <p className="text-[8px] font-bold mt-0.5 truncate max-w-[44px] text-center text-foreground/60">{member.gamertag}</p>
                      <p className="text-[7px] font-black tabular-nums" style={{ color: member.division === 'male' ? 'var(--idm-male-light)' : 'var(--idm-female-light)' }}>{member.points}pts</p>
                    </div>
                  ))}
                  {allMembers.length > 5 && (
                    <div className="flex flex-col items-center">
                      <div className="w-11 h-11 rounded-xl flex flex-col items-center justify-center border border-dashed border-border/30 bg-muted/5">
                        <span className="text-[10px] font-black text-muted-foreground/50">+{allMembers.length - 5}</span>
                      </div>
                      <p className="text-[8px] font-bold mt-0.5 text-muted-foreground/40">lainnya</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ═══ Ghost Empty State — Matching layout with skeleton placeholders ═══ */
          <div className="p-3 sm:p-5">
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
              {/* Ghost Club Logo */}
              <div className="relative shrink-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border border-idm-gold-warm/8 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(239,249,35,0.06), rgba(239,249,35,0.02))' }}>
                  <Trophy className="w-8 h-8 text-idm-gold-warm/20" />
                </div>
                {/* Ghost crown */}
                <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-muted/30 flex items-center justify-center">
                  <Crown className="w-3 h-3 text-muted-foreground/30" />
                </div>
              </div>

              {/* Ghost Club Info */}
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <div className="h-6 w-36 rounded bg-muted/30 mx-auto sm:mx-0 mb-2" />
                <div className="h-3 w-48 rounded bg-muted/20 mx-auto sm:mx-0" />

                {/* Ghost Stats row */}
                <div className="flex items-center gap-2 mt-3 justify-center sm:justify-start">
                  <div className="h-5 w-14 rounded-md bg-muted/20" />
                  <div className="h-5 w-16 rounded-md bg-muted/15" />
                  <div className="h-5 w-16 rounded-md bg-muted/15" />
                  <div className="h-5 w-14 rounded-md bg-muted/10" />
                </div>
              </div>
            </div>

            {/* Ghost Top Performers */}
            <div className="mt-4 pt-3 border-t border-idm-gold-warm/5">
              <p className="text-[9px] text-muted-foreground/25 uppercase tracking-wider font-semibold mb-2.5">Top Performers</p>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={`ghost-member-${i}`} className="flex flex-col items-center">
                    <div className="w-11 h-11 rounded-xl bg-muted/15 border border-muted/10" />
                    <div className="h-2 w-8 rounded bg-muted/15 mt-1" />
                    <div className="h-2 w-6 rounded bg-muted/10 mt-0.5" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </>
    );

  if (bare) {
    return content;
  }

  return (
    <div className="animate-fade-enter-sm">
      <div className={`rounded-2xl ${ct.casinoCard} overflow-hidden ${!hasData ? 'opacity-55' : ''}`}>
        {content}
      </div>
    </div>
  );
});


/* ═══════════════════════════════════════════
   Sultan of the Week Card — 🪙 COIN / MEDALLION shape
   Circular avatar frame with embossed ridge & maroon theme
   ═══════════════════════════════════════════ */
const MAROON = '#800020';
const MAROON_LIGHT = '#d4576a';

function SultanOfWeekCard({
  sultan,
  onPlayerClick,
}: {
  sultan: SultanOfWeekly;
  onPlayerClick: (player: TopPlayer & { division?: string }, division: 'male' | 'female') => void;
}) {
  const ct = useCommunityTheme();
  const sultanDivision = sultan.tournamentDivision as 'male' | 'female';
  const divisionAccent = sultanDivision === 'male' ? '#2E9FFF' : '#FF2D78';
  const divisionLabel = sultanDivision === 'male' ? 'COWO' : 'CEWE';
  const DivisionIcon = sultanDivision === 'male' ? Music : Shield;
  const hasPlayer = !!sultan.player;

  return (
    <div className="animate-fade-enter-sm">
      <div className={`rounded-2xl ${ct.casinoCard} overflow-hidden`}
        style={{ borderColor: hexToRgba(MAROON, 0.2) }}>
        {/* Maroon accent bar */}
        <div className="h-1" style={{ background: `linear-gradient(90deg, ${MAROON}, ${MAROON_LIGHT}, ${MAROON})` }} />

        {/* Header */}
        <div className={`flex items-center gap-2.5 px-3 lg:px-5 py-2.5 border-b ${ct.borderSubtle}`}>
          <div className="w-5 h-5 rounded flex items-center justify-center shrink-0"
            style={{ backgroundColor: hexToRgba(MAROON, 0.15), border: `1px solid ${hexToRgba(MAROON, 0.25)}` }}>
            <Heart className="w-3 h-3" style={{ color: MAROON_LIGHT }} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: MAROON_LIGHT }}>
            Sultan of the Week
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <Badge className="text-[8px] font-bold border" style={{
              color: divisionAccent, backgroundColor: hexToRgba(divisionAccent, 0.1),
              borderColor: hexToRgba(divisionAccent, 0.2) }}>
              {divisionLabel}
            </Badge>
            <Badge className="text-[8px] font-bold border" style={{
              color: MAROON_LIGHT, backgroundColor: hexToRgba(MAROON, 0.1),
              borderColor: hexToRgba(MAROON, 0.2) }}>
              W{sultan.weekNumber}
            </Badge>
          </div>
        </div>

        {/* Body — COIN / MEDALLION layout — large coin with full-body avatar */}
        <div className="p-4 sm:p-6">
          {hasPlayer ? (
            <button
              onClick={() => onPlayerClick({
                ...sultan.player!,
                name: sultan.player!.gamertag,
                club: sultan.player!.club ?? undefined,
                maxStreak: 0,
                matches: 0,
                division: sultanDivision,
              }, sultanDivision)}
              className="flex flex-col items-center w-full cursor-pointer group/sultan"
            >
              {/* 🪙 Large Coin Container — circular medallion with full-body avatar */}
              <div className="relative flex items-center justify-center">
                {/* Radial glow behind coin */}
                <div className="absolute inset-0 pointer-events-none"
                  style={{ background: `radial-gradient(circle at 50% 45%, rgba(128,0,32,0.12), transparent 60%)` }} />

                {/* Outer ridge — embossed coin edge */}
                <div className="relative w-48 h-48 sm:w-60 sm:h-60 rounded-full p-[4px]"
                  style={{
                    background: `conic-gradient(from 0deg, ${MAROON}, ${MAROON_LIGHT}, ${MAROON}, ${MAROON_LIGHT}, ${MAROON}, ${MAROON_LIGHT}, ${MAROON}, ${MAROON_LIGHT}, ${MAROON})`,
                    boxShadow: `0 0 30px ${hexToRgba(MAROON, 0.25)}, 0 6px 20px rgba(0,0,0,0.2), inset 0 1px 0 ${hexToRgba(MAROON_LIGHT, 0.3)}`,
                  }}>
                  {/* Inner coin body — full-body avatar */}
                  <div className="w-full h-full rounded-full overflow-hidden border-2"
                    style={{ borderColor: hexToRgba(MAROON_LIGHT, 0.4) }}>
                    <AvatarMedia
                      src={getAvatarUrl(sultan.player!.gamertag, sultanDivision, sultan.player!.avatar)}
                      alt={sultan.player!.gamertag}
                      fill
                      sizes="(max-width: 640px) 192px, 240px"
                      className="object-cover object-top group-hover/sultan:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  </div>
                </div>

                {/* Heart badge — top center (crown of coin) */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shadow-lg border-2"
                    style={{
                      background: `linear-gradient(135deg, ${MAROON_LIGHT}, ${MAROON})`,
                      borderColor: hexToRgba(MAROON_LIGHT, 0.5),
                      boxShadow: `0 2px 8px ${hexToRgba(MAROON, 0.4)}`,
                    }}>
                    <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="white" />
                  </div>
                </div>

                {/* Notch details — decorative dots around coin */}
                {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
                  <div key={deg} className="absolute w-1 h-1 rounded-full"
                    style={{
                      top: '50%', left: '50%',
                      transform: `rotate(${deg}deg) translateY(-110px) sm:-translateY-[140px] translate(-50%, -50%)`,
                      background: hexToRgba(MAROON_LIGHT, 0.2),
                    }} />
                ))}
              </div>

              {/* Name — below coin */}
              <p className="text-base sm:text-lg font-black mt-4 group-hover/sultan:text-idm-gold-warm transition-colors text-center">
                {sultan.player!.gamertag}
              </p>
              <p className="text-[9px] text-muted-foreground/60 mt-0.5">Top Penyawer Week {sultan.weekNumber}</p>
              {(sultan.player!.city || sultan.player!.club) && (
                <p className="text-[8px] text-muted-foreground/40 truncate mt-0.5 max-w-[200px]">
                  {[sultan.player!.city, typeof sultan.player!.club === 'string' ? sultan.player!.club : sultan.player!.club?.name].filter(Boolean).join(' · ')}
                </p>
              )}

              {/* Coin value ribbon — donation stats */}
              <div className="flex items-center gap-2 mt-2.5">
                <span className="text-[10px] font-black tabular-nums px-2.5 py-1 rounded-full"
                  style={{ color: MAROON_LIGHT, backgroundColor: hexToRgba(MAROON, 0.1), border: `1px solid ${hexToRgba(MAROON, 0.2)}` }}>
                  Rp {sultan.totalAmount >= 1000 ? `${(sultan.totalAmount / 1000).toFixed(0)}K` : sultan.totalAmount}
                </span>
                <span className="text-[9px] text-muted-foreground/85 tabular-nums">{sultan.donationCount}x sawer</span>
              </div>
            </button>
          ) : (
            /* No player matched — show donor name only */
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="w-48 h-48 sm:w-60 sm:h-60 rounded-full p-[4px]"
                  style={{
                    background: `conic-gradient(from 0deg, ${hexToRgba(MAROON, 0.3)}, ${hexToRgba(MAROON_LIGHT, 0.3)}, ${hexToRgba(MAROON, 0.3)}, ${hexToRgba(MAROON_LIGHT, 0.3)}, ${hexToRgba(MAROON, 0.3)})`,
                  }}>
                  <div className="w-full h-full rounded-full flex items-center justify-center border-2"
                    style={{ borderColor: hexToRgba(MAROON, 0.2), background: hexToRgba(MAROON, 0.06) }}>
                    <Heart className="w-12 h-12 sm:w-14 sm:h-14" style={{ color: hexToRgba(MAROON, 0.4) }} />
                  </div>
                </div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shadow-lg border-2"
                    style={{ background: `linear-gradient(135deg, ${MAROON_LIGHT}, ${MAROON})`, borderColor: hexToRgba(MAROON_LIGHT, 0.5) }}>
                    <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="white" />
                  </div>
                </div>
              </div>
              <p className="text-base font-bold mt-4">{sultan.donorName}</p>
              <p className="text-[9px] text-muted-foreground/60 mt-0.5">Top Penyawer Week {sultan.weekNumber}</p>
              <div className="flex items-center gap-2 mt-2.5">
                <span className="text-[10px] font-black tabular-nums px-2.5 py-1 rounded-full"
                  style={{ color: MAROON_LIGHT, backgroundColor: hexToRgba(MAROON, 0.1), border: `1px solid ${hexToRgba(MAROON, 0.2)}` }}>
                  Rp {sultan.totalAmount >= 1000 ? `${(sultan.totalAmount / 1000).toFixed(0)}K` : sultan.totalAmount}
                </span>
                <span className="text-[9px] text-muted-foreground/85 tabular-nums">{sultan.donationCount}x sawer</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


/* ─── Ghost Sultan of the Week — Empty state (coin shape) ─── */
function GhostSultanOfWeekCard() {
  const ct = useCommunityTheme();

  return (
    <div className="animate-fade-enter-sm">
      <div className={`rounded-2xl ${ct.casinoCard} overflow-hidden opacity-55`}
        style={{ borderColor: hexToRgba(MAROON, 0.1) }}>
        {/* Maroon accent bar — dimmed */}
        <div className="h-1" style={{ background: `linear-gradient(90deg, ${hexToRgba(MAROON, 0.3)}, ${hexToRgba(MAROON_LIGHT, 0.3)}, ${hexToRgba(MAROON, 0.3)})` }} />

        {/* Header */}
        <div className={`flex items-center gap-2.5 px-3 lg:px-5 py-2.5 border-b ${ct.borderSubtle}`}>
          <div className="w-5 h-5 rounded flex items-center justify-center shrink-0"
            style={{ backgroundColor: hexToRgba(MAROON, 0.08), border: `1px solid ${hexToRgba(MAROON, 0.12)}` }}>
            <Heart className="w-3 h-3" style={{ color: hexToRgba(MAROON_LIGHT, 0.3) }} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: hexToRgba(MAROON_LIGHT, 0.4) }}>
            Sultan of the Week
          </span>
          <Badge className="bg-muted/20 text-muted-foreground/30 border-border/10 ml-auto text-[8px] font-bold">TBA</Badge>
        </div>

        {/* Ghost body — large coin shape */}
        <div className="p-4 sm:p-6 flex flex-col items-center">
          <div className="w-48 h-48 sm:w-60 sm:h-60 rounded-full p-[4px]"
            style={{ background: `conic-gradient(from 0deg, ${hexToRgba(MAROON, 0.15)}, ${hexToRgba(MAROON_LIGHT, 0.15)}, ${hexToRgba(MAROON, 0.15)}, ${hexToRgba(MAROON_LIGHT, 0.15)}, ${hexToRgba(MAROON, 0.15)})` }}>
            <div className="w-full h-full rounded-full flex items-center justify-center border-2"
              style={{ borderColor: hexToRgba(MAROON, 0.08), background: hexToRgba(MAROON, 0.03) }}>
              <Heart className="w-12 h-12 sm:w-14 sm:h-14" style={{ color: hexToRgba(MAROON, 0.15) }} />
            </div>
          </div>
          <div className="h-4 w-24 rounded bg-muted/30 mt-4 mb-1.5" />
          <div className="h-3 w-32 rounded bg-muted/20" />
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════
   Sultan of Season — Side-by-side Male & Female (💎 DIAMOND full avatar portrait)
   Emerald theme with gem accents, diamond rhombus shape
   ═══════════════════════════════════════════ */
const EMERALD = '#43A047';
const EMERALD_LIGHT = '#66BB6A';
const EMERALD_DARK = '#2E7D32';

function SultanOfSeasonCardPage({
  maleSultans,
  femaleSultans,
  selectedDivision,
  onPlayerClick,
  bare = false,
}: {
  maleSultans: { seasonNumber: number; sultan: SultanPlayer }[];
  femaleSultans: { seasonNumber: number; sultan: SultanPlayer }[];
  selectedDivision: DivisionFilter;
  onPlayerClick: (player: TopPlayer & { division?: string }, division: 'male' | 'female') => void;
  bare?: boolean;
}) {
  const ct = useCommunityTheme();
  const showMale = selectedDivision === 'all' || selectedDivision === 'male';
  const showFemale = selectedDivision === 'all' || selectedDivision === 'female';

  const headerSection = !bare ? (
    <>
      {/* Emerald accent bar */}
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${EMERALD}, ${EMERALD_LIGHT}, ${EMERALD})` }} />
      {/* Header */}
      <div className={`flex items-center gap-2.5 px-3 lg:px-5 py-2.5 border-b ${ct.borderSubtle}`}>
        <div className="w-5 h-5 rounded flex items-center justify-center shrink-0"
          style={{ backgroundColor: hexToRgba(EMERALD, 0.15), border: `1px solid ${hexToRgba(EMERALD, 0.25)}` }}>
          <Gem className="w-3 h-3" style={{ color: EMERALD_LIGHT }} />
        </div>
        <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: EMERALD_LIGHT }}>
          Sultan of Season
        </span>
      </div>
    </>
  ) : null;

  const content = (
    <>
      {headerSection}
      {/* Content — side-by-side DIAMOND cards on desktop, stacked on mobile */}
      {selectedDivision === 'all' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {showMale && (
            <div className={`border-b lg:border-b-0 lg:border-r ${ct.borderSubtle}`}>
              {maleSultans.length > 0 ? (
                <SultanSeasonDiamondCard
                  sultanData={maleSultans[0]}
                  division="male"
                  onPlayerClick={onPlayerClick}
                  bare
                />
              ) : (
                <GhostSultanSeasonDiamondCard division="male" bare />
              )}
            </div>
          )}
          {showFemale && (
            <div>
              {femaleSultans.length > 0 ? (
                <SultanSeasonDiamondCard
                  sultanData={femaleSultans[0]}
                  division="female"
                  onPlayerClick={onPlayerClick}
                  bare
                />
              ) : (
                <GhostSultanSeasonDiamondCard division="female" bare />
              )}
            </div>
          )}
        </div>
      ) : (
        <div>
          {showMale && (
            maleSultans.length > 0 ? (
              <SultanSeasonDiamondCard
                sultanData={maleSultans[0]}
                division="male"
                onPlayerClick={onPlayerClick}
              />
            ) : (
              <GhostSultanSeasonDiamondCard division="male" />
            )
          )}
          {showFemale && (
            femaleSultans.length > 0 ? (
              <SultanSeasonDiamondCard
                sultanData={femaleSultans[0]}
                division="female"
                onPlayerClick={onPlayerClick}
              />
            ) : (
              <GhostSultanSeasonDiamondCard division="female" />
            )
          )}
        </div>
      )}
    </>
  );

  if (bare) {
    return content;
  }

  return (
    <div className="animate-fade-enter-sm">
      <div className={`rounded-2xl ${ct.casinoCard} overflow-hidden`}
        style={{ borderColor: hexToRgba(EMERALD, 0.2) }}>
        {content}
      </div>
    </div>
  );
}


/* ─── Sultan of Season — 💎 DIAMOND Division Card (MVP horizontal layout, diamond avatar) ─── */
function SultanSeasonDiamondCard({
  sultanData,
  division,
  onPlayerClick,
  bare = false,
}: {
  sultanData: { seasonNumber: number; sultan: SultanPlayer };
  division: 'male' | 'female';
  onPlayerClick: (player: TopPlayer & { division?: string }, division: 'male' | 'female') => void;
  bare?: boolean;
}) {
  const dt = getDivisionTheme(division);
  const DivisionIcon = division === 'male' ? Music : Shield;
  const genderSymbol = division === 'male' ? '♂' : '♀';
  const accentColor = division === 'male' ? '#2E9FFF' : '#FF2D78';

  const { sultan, seasonNumber } = sultanData;
  const clubName = sultan.club?.name;
  const cityInfo = sultan.city;
  const locationText = [cityInfo, clubName].filter(Boolean).join(' · ');

  const stats = [
    { label: 'Points', value: `${sultan.points}`, icon: Zap, color: 'text-idm-gold-warm/80' },
    { label: 'Season', value: `S${seasonNumber}`, icon: Calendar, color: 'text-idm-gold-warm/70' },
    { label: 'Tier', value: sultan.tier || '-', icon: Gem, color: 'text-idm-gold-warm/80' },
  ];

  const content = (
    <div className="p-4 lg:p-6">
      {/* Division label — only in bare mode (side-by-side) */}
      {bare && (
        <div className="flex items-center gap-1.5 mb-3">
          <DivisionIcon className="w-3.5 h-3.5 shrink-0" style={{ color: accentColor }} />
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accentColor }}>
            {division === 'male' ? 'COWO' : 'CEWE'} {genderSymbol}
          </span>
          <Badge className="ml-auto text-[7px] font-bold border py-0 px-1.5"
            style={{
              color: EMERALD_LIGHT,
              backgroundColor: hexToRgba(EMERALD, 0.08),
              borderColor: hexToRgba(EMERALD, 0.15),
            }}>
            <Gem className="w-2 h-2 mr-0.5" />S{seasonNumber}
          </Badge>
        </div>
      )}

      <div className="flex gap-3 sm:gap-4 items-stretch">
        {/* 💎 Diamond avatar panel — LEFT */}
        <div
          className="relative shrink-0 cursor-pointer group/sultan-season"
          onClick={() => onPlayerClick({
            id: sultan.id,
            name: sultan.gamertag,
            gamertag: sultan.gamertag,
            avatar: sultan.avatar,
            tier: sultan.tier,
            points: sultan.points,
            totalWins: 0,
            streak: 0,
            maxStreak: 0,
            totalMvp: 0,
            matches: 0,
            division,
            city: sultan.city ?? undefined,
            club: sultan.club?.name ?? undefined,
          }, division)}
        >
          {/* Outer glow / facet reflection */}
          <div className="absolute inset-0 scale-125"
            style={{
              clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
              background: `conic-gradient(from 45deg, ${EMERALD}, ${EMERALD_LIGHT}, ${EMERALD}, transparent, ${EMERALD}, ${EMERALD_LIGHT}, ${EMERALD})`,
              opacity: 0.25,
              filter: 'blur(8px)',
            }} />

          {/* Emerald radial glow behind diamond */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(circle at 50% 50%, rgba(67,160,71,0.15), transparent 60%)` }} />

          {/* Diamond frame — outer faceted border */}
          <div className="relative w-28 h-28 sm:w-36 sm:h-36 lg:w-40 lg:h-40"
            style={{
              clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
              background: `linear-gradient(135deg, ${EMERALD}, ${EMERALD_LIGHT}, ${EMERALD})`,
              boxShadow: `0 0 30px ${hexToRgba(EMERALD, 0.3)}, 0 6px 20px rgba(0,0,0,0.15)`,
              padding: '4px',
            }}>
            {/* Inner diamond — full-body avatar */}
            <div className="relative w-full h-full overflow-hidden"
              style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}>
              <AvatarMedia
                src={getAvatarUrl(sultan.gamertag, division, sultan.avatar)}
                alt={sultan.gamertag}
                fill
                sizes="(max-width: 640px) 112px, 160px"
                className="object-cover object-top group-hover/sultan-season:scale-110 transition-transform duration-500"
                loading="lazy"
              />
              {/* Facet overlay — prism/light reflection effect */}
              <div className="absolute inset-0 pointer-events-none"
                style={{
                  clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.05) 100%)',
                }} />
            </div>
          </div>

          {/* Gem badge — top center (crown of diamond) */}
          <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 z-10">
            <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-full flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${EMERALD_LIGHT}, ${EMERALD})`,
                boxShadow: `0 0 12px ${hexToRgba(EMERALD, 0.4)}`,
              }}>
              <Gem className="w-3 h-3 lg:w-3.5 lg:h-3.5 text-white" />
            </div>
          </div>
        </div>

        {/* Stats panel — RIGHT */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          {/* Player name + location */}
          <div>
            <h3 className="text-sm lg:text-base font-black truncate" style={{ color: EMERALD_LIGHT }}>
              {sultan.gamertag}
            </h3>
            <div className="flex items-center gap-1.5 mb-1">
              {locationText && (
                <span className="text-[9px] lg:text-[10px] text-muted-foreground/70 truncate">{locationText}</span>
              )}
              <Badge className={`${dt.badgeBg} text-[7px] lg:text-[8px] border py-0 px-1.5`}>
                {division === 'male' ? '🕺 Cowo' : '💃 Cewe'}
              </Badge>
            </div>
            {/* Tier badge */}
            {sultan.tier && (
              <Badge className="text-[7px] font-bold border py-0 px-1.5 mb-2"
                style={{
                  color: EMERALD_LIGHT,
                  backgroundColor: hexToRgba(EMERALD, 0.08),
                  borderColor: hexToRgba(EMERALD, 0.15),
                }}>
                <Gem className="w-2 h-2 mr-0.5" style={{ color: EMERALD_LIGHT }} />
                {sultan.tier}
              </Badge>
            )}
          </div>

          {/* Stats grid */}
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

          {/* CTA button */}
          <button
            onClick={() => onPlayerClick({
              id: sultan.id,
              name: sultan.gamertag,
              gamertag: sultan.gamertag,
              avatar: sultan.avatar,
              tier: sultan.tier,
              points: sultan.points,
              totalWins: 0,
              streak: 0,
              maxStreak: 0,
              totalMvp: 0,
              matches: 0,
              division,
              city: sultan.city ?? undefined,
              club: sultan.club?.name ?? undefined,
            }, division)}
            className="w-full py-1.5 rounded-lg border text-[9px] sm:text-[10px] font-bold hover:brightness-110 transition-all flex items-center justify-center gap-1 cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${hexToRgba(EMERALD, 0.15)}, ${hexToRgba(EMERALD_LIGHT, 0.08)})`,
              borderColor: hexToRgba(EMERALD, 0.2),
              color: EMERALD_LIGHT,
            }}
          >
            <Gem className="w-2.5 h-2.5" />
            Lihat Profil
          </button>
        </div>
      </div>
    </div>
  );

  if (bare) {
    return (
      <div className={`rounded-2xl border ${dt.borderSubtle} ${dt.bgSubtle} dashboard-card-glow overflow-hidden`}
        style={{ borderColor: hexToRgba(EMERALD, 0.15) }}>
        {content}
      </div>
    );
  }

  return content;
}


/* ─── Ghost Sultan of Season — 💎 DIAMOND Division Card (empty state, MVP horizontal) ─── */
function GhostSultanSeasonDiamondCard({
  division,
  bare = false,
}: {
  division: 'male' | 'female';
  bare?: boolean;
}) {
  const dt = getDivisionTheme(division);
  const DivisionIcon = division === 'male' ? Music : Shield;
  const genderSymbol = division === 'male' ? '♂' : '♀';
  const accentColor = division === 'male' ? '#2E9FFF' : '#FF2D78';

  const content = (
    <div className="p-4 lg:p-6">
      {/* Division label — only in bare mode */}
      {bare && (
        <div className="flex items-center gap-1.5 mb-3">
          <DivisionIcon className="w-3.5 h-3.5 shrink-0" style={{ color: hexToRgba(accentColor, 0.4) }} />
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: hexToRgba(accentColor, 0.4) }}>
            {division === 'male' ? 'COWO' : 'CEWE'} {genderSymbol}
          </span>
          <Badge className="ml-auto text-[7px] font-bold border py-0 px-1.5 bg-muted/20 text-muted-foreground/30 border-border/10">
            TBA
          </Badge>
        </div>
      )}

      <div className="flex gap-3 sm:gap-4 items-stretch opacity-50">
        {/* Ghost diamond avatar panel */}
        <div className="relative shrink-0">
          {/* Ghost diamond frame */}
          <div className="relative w-28 h-28 sm:w-36 sm:h-36 lg:w-40 lg:h-40"
            style={{
              clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
              background: `linear-gradient(135deg, ${hexToRgba(EMERALD, 0.2)}, ${hexToRgba(EMERALD_LIGHT, 0.15)}, ${hexToRgba(EMERALD, 0.2)})`,
              padding: '4px',
            }}>
            {/* Inner ghost diamond */}
            <div className="w-full h-full flex items-center justify-center"
              style={{
                clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                background: `linear-gradient(135deg, ${hexToRgba(EMERALD, 0.08)}, ${hexToRgba(EMERALD, 0.03)})`,
              }}>
              <Gem className="w-10 h-10 sm:w-12 sm:h-12 opacity-20" style={{ color: EMERALD_LIGHT }} />
            </div>
          </div>

          {/* Ghost gem badge */}
          <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 z-10">
            <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-full flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${hexToRgba(EMERALD_LIGHT, 0.4)}, ${hexToRgba(EMERALD, 0.4)})`,
              }}>
              <Gem className="w-3 h-3 lg:w-3.5 lg:h-3.5 text-white/40" />
            </div>
          </div>
        </div>

        {/* Ghost stats panel */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          <div>
            <div className="h-5 w-24 rounded bg-muted/35 mb-2" />
            <div className="h-3 w-16 rounded bg-muted/25 mb-4" />
          </div>

          {/* Ghost stats grid */}
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mb-3">
            {[
              { color: 'bg-idm-gold-warm/15' },
              { color: 'bg-idm-gold-warm/12' },
              { color: 'bg-idm-gold-warm/10' },
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

  if (bare) {
    return (
      <div className={`rounded-2xl border ${dt.borderSubtle} ${dt.bgSubtle} overflow-hidden opacity-55`}
        style={{ borderColor: hexToRgba(EMERALD, 0.08) }}>
        {content}
      </div>
    );
  }

  return <div className="opacity-55">{content}</div>;
}


/* ═══════════════════════════════════════════
   Sultan of the Week — Division Card (inline, no outer casino wrapper)
   Renders compact horizontal card for one division's sultan
   ═══════════════════════════════════════════ */
function SultanOfWeekDivisionCard({
  sultan,
  division,
  onPlayerClick,
}: {
  sultan: SultanOfWeekly;
  division: 'male' | 'female';
  onPlayerClick: (player: TopPlayer & { division?: string }, division: 'male' | 'female') => void;
}) {
  const divisionAccent = division === 'male' ? '#2E9FFF' : '#FF2D78';
  const divisionLabel = division === 'male' ? 'COWO' : 'CEWE';
  const DivisionIcon = division === 'male' ? Music : Shield;
  const hasPlayer = !!sultan.player;

  return (
    <div className={`rounded-xl border p-3 sm:p-4 transition-all`}
      style={{
        borderColor: hexToRgba(divisionAccent, 0.15),
        background: `linear-gradient(135deg, ${hexToRgba(divisionAccent, 0.04)}, ${hexToRgba(MAROON, 0.03)})`,
      }}>
      {/* Division label */}
      <div className="flex items-center gap-1.5 mb-2.5">
        <DivisionIcon className="w-3 h-3 shrink-0" style={{ color: divisionAccent }} />
        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: divisionAccent }}>
          {divisionLabel} ⚡
        </span>
        <Badge className="text-[7px] font-bold border ml-auto" style={{
          color: MAROON_LIGHT, backgroundColor: hexToRgba(MAROON, 0.1),
          borderColor: hexToRgba(MAROON, 0.2) }}>
          W{sultan.weekNumber}
        </Badge>
      </div>

      {hasPlayer ? (
        <button
          onClick={() => onPlayerClick({
            ...sultan.player!,
            name: sultan.player!.gamertag,
            club: sultan.player!.club ?? undefined,
            maxStreak: 0,
            matches: 0,
            division,
          }, division)}
          className="flex items-center gap-3 w-full text-left cursor-pointer group/sultan"
        >
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden border-2"
              style={{ borderColor: hexToRgba(MAROON, 0.4), boxShadow: `0 0 10px ${hexToRgba(MAROON, 0.12)}` }}>
              <AvatarMedia
                src={getAvatarUrl(sultan.player!.gamertag, division, sultan.player!.avatar)}
                alt={sultan.player!.gamertag}
                width={56} height={56}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            {/* Heart badge */}
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${MAROON_LIGHT}, ${MAROON})` }}>
              <Heart className="w-2 h-2 text-white" />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate group-hover/sultan:text-idm-gold-warm transition-colors">
              {sultan.player!.gamertag}
            </p>
            {(sultan.player!.city || sultan.player!.club) && (
              <p className="text-[8px] text-muted-foreground/40 truncate mt-0.5">
                {[sultan.player!.city, typeof sultan.player!.club === 'string' ? sultan.player!.club : sultan.player!.club?.name].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="shrink-0 flex flex-col items-end gap-0.5">
            <span className="text-[10px] font-black tabular-nums" style={{ color: MAROON_LIGHT }}>
              Rp {sultan.totalAmount >= 1000 ? `${(sultan.totalAmount / 1000).toFixed(0)}K` : sultan.totalAmount}
            </span>
            <span className="text-[8px] text-muted-foreground/85 tabular-nums">{sultan.donationCount}x sawer</span>
          </div>
        </button>
      ) : (
        /* No player — show donor name only */
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center border-2"
            style={{ borderColor: hexToRgba(MAROON, 0.15), background: hexToRgba(MAROON, 0.04) }}>
            <Heart className="w-4 h-4" style={{ color: hexToRgba(MAROON, 0.3) }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{sultan.donorName}</p>
            <p className="text-[8px] text-muted-foreground/50 mt-0.5">Top Penyawer Week {sultan.weekNumber}</p>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-0.5">
            <span className="text-[10px] font-black tabular-nums" style={{ color: MAROON_LIGHT }}>
              Rp {sultan.totalAmount >= 1000 ? `${(sultan.totalAmount / 1000).toFixed(0)}K` : sultan.totalAmount}
            </span>
            <span className="text-[8px] text-muted-foreground/85 tabular-nums">{sultan.donationCount}x sawer</span>
          </div>
        </div>
      )}
    </div>
  );
}


/* ─── Ghost Sultan of the Week — Division Card empty state ─── */
function GhostSultanOfWeekDivisionCard({ division }: { division: 'male' | 'female' }) {
  const divisionAccent = division === 'male' ? '#2E9FFF' : '#FF2D78';
  const divisionLabel = division === 'male' ? 'COWO' : 'CEWE';
  const DivisionIcon = division === 'male' ? Music : Shield;

  return (
    <div className={`rounded-xl border p-3 sm:p-4 opacity-55`}
      style={{ borderColor: hexToRgba(divisionAccent, 0.1), background: hexToRgba(divisionAccent, 0.02) }}>
      <div className="flex items-center gap-1.5 mb-2.5">
        <DivisionIcon className="w-3 h-3 shrink-0" style={{ color: divisionAccent }} />
        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: divisionAccent }}>
          {divisionLabel}
        </span>
        <Badge className="bg-muted/20 text-muted-foreground/30 border-border/10 ml-auto text-[7px] font-bold">TBA</Badge>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center border-2"
          style={{ borderColor: hexToRgba(MAROON, 0.08), background: hexToRgba(MAROON, 0.02) }}>
          <Heart className="w-4 h-4" style={{ color: hexToRgba(MAROON, 0.12) }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="h-4 w-20 rounded bg-muted/30 mb-1.5" />
          <div className="h-3 w-28 rounded bg-muted/20" />
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════
   Sultan of the Week Section — 🪙 Dual COIN medallion layout
   Shows Sultan Cowo and Sultan Cewe as large coin medallions side by side
   ═══════════════════════════════════════════ */

/** 💎 Diamond clipPath — reusable polygon for diamond shape */
const DIAMOND_CLIP = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';

/** Sultan Week Division Card — 💎 DIAMOND avatar, MVP horizontal layout, maroon theme */
function SultanWeekDivisionCard({
  sultan,
  division,
  onPlayerClick,
  bare = false,
}: {
  sultan: SultanOfWeekly;
  division: 'male' | 'female';
  onPlayerClick: (player: TopPlayer & { division?: string }, division: 'male' | 'female') => void;
  bare?: boolean;
}) {
  const dt = getDivisionTheme(division);
  const DivisionIcon = division === 'male' ? Music : Shield;
  const genderSymbol = division === 'male' ? '♂' : '♀';
  const accentColor = division === 'male' ? '#2E9FFF' : '#FF2D78';
  const hasPlayer = !!sultan.player;

  const clubName = hasPlayer
    ? clubToString(sultan.player!.club as Parameters<typeof clubToString>[0])
    : undefined;
  const cityInfo = hasPlayer ? sultan.player!.city : undefined;
  const locationText = [cityInfo, clubName].filter(Boolean).join(' · ');

  const formatRp = (amount: number) =>
    amount >= 1000 ? `Rp ${(amount / 1000).toFixed(0)}K` : `Rp ${amount}`;

  const stats = [
    { label: 'Total Sawer', value: formatRp(sultan.totalAmount), icon: Banknote, color: 'text-[#d4576a]' },
    { label: 'Jumlah Sawer', value: `${sultan.donationCount}x`, icon: Zap, color: 'text-[#d4576a]/80' },
    { label: 'Week', value: `W${sultan.weekNumber}`, icon: Calendar, color: 'text-idm-gold-warm/80' },
  ];

  const content = (
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

      {hasPlayer ? (
        <div className="flex gap-3 sm:gap-4 items-stretch">
          {/* 💎 Diamond avatar panel — LEFT */}
          <div
            className="relative shrink-0 cursor-pointer group/sultan-week"
            onClick={() => onPlayerClick({
              ...sultan.player!,
              name: sultan.player!.gamertag,
              club: sultan.player!.club ?? undefined,
              maxStreak: 0,
              matches: 0,
              division,
            }, division)}
          >
            {/* Outer glow / facet reflection */}
            <div className="absolute inset-0 scale-125"
              style={{
                clipPath: DIAMOND_CLIP,
                background: `conic-gradient(from 45deg, ${MAROON}, ${MAROON_LIGHT}, ${MAROON}, transparent, ${MAROON}, ${MAROON_LIGHT}, ${MAROON})`,
                opacity: 0.25,
                filter: 'blur(8px)',
              }} />

            {/* Maroon radial glow behind diamond */}
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: `radial-gradient(circle at 50% 50%, rgba(128,0,32,0.15), transparent 60%)` }} />

            {/* Diamond frame — outer faceted border */}
            <div className="relative w-28 h-28 sm:w-36 sm:h-36 lg:w-40 lg:h-40"
              style={{
                clipPath: DIAMOND_CLIP,
                background: `linear-gradient(135deg, ${MAROON}, ${MAROON_LIGHT}, ${MAROON})`,
                boxShadow: `0 0 30px ${hexToRgba(MAROON, 0.3)}, 0 6px 20px rgba(0,0,0,0.15)`,
                padding: '4px',
              }}>
              {/* Inner diamond — full-body avatar */}
              <div className="relative w-full h-full overflow-hidden"
                style={{ clipPath: DIAMOND_CLIP }}>
                <AvatarMedia
                  src={getAvatarUrl(sultan.player!.gamertag, division, sultan.player!.avatar)}
                  alt={sultan.player!.gamertag}
                  fill
                  sizes="(max-width: 640px) 112px, 160px"
                  className="object-cover object-top group-hover/sultan-week:scale-110 transition-transform duration-500"
                  loading="lazy"
                />
                {/* Facet overlay — prism/light reflection effect */}
                <div className="absolute inset-0 pointer-events-none"
                  style={{
                    clipPath: DIAMOND_CLIP,
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.05) 100%)',
                  }} />
              </div>
            </div>

            {/* Heart badge — top center (crown of diamond) */}
            <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 z-10">
              <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-full flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${MAROON_LIGHT}, ${MAROON})`,
                  boxShadow: `0 0 12px ${hexToRgba(MAROON, 0.4)}`,
                }}>
                <Heart className="w-3 h-3 lg:w-3.5 lg:h-3.5 text-white" fill="white" />
              </div>
            </div>
          </div>

          {/* Stats panel — RIGHT */}
          <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
            {/* Player name + location */}
            <div>
              <h3 className="text-sm lg:text-base font-black truncate">{sultan.player!.gamertag}</h3>
              <div className="flex items-center gap-1.5 mb-1">
                {locationText && (
                  <span className="text-[9px] lg:text-[10px] text-muted-foreground/70 truncate">{locationText}</span>
                )}
                <Badge className={`${dt.badgeBg} text-[7px] lg:text-[8px] border py-0 px-1.5`}>
                  {division === 'male' ? '🕺 Cowo' : '💃 Cewe'}
                </Badge>
              </div>
              {/* Tier badge */}
              {sultan.player!.tier && (
                <Badge className="text-[7px] font-bold border py-0 px-1.5 mb-2"
                  style={{
                    color: MAROON_LIGHT,
                    backgroundColor: hexToRgba(MAROON, 0.08),
                    borderColor: hexToRgba(MAROON, 0.15),
                  }}>
                  <Heart className="w-2 h-2 mr-0.5" style={{ color: MAROON_LIGHT }} />
                  {sultan.player!.tier}
                </Badge>
              )}
            </div>

            {/* Stats grid */}
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

            {/* CTA button */}
            <button
              onClick={() => onPlayerClick({
                ...sultan.player!,
                name: sultan.player!.gamertag,
                club: sultan.player!.club ?? undefined,
                maxStreak: 0,
                matches: 0,
                division,
              }, division)}
              className="w-full py-1.5 rounded-lg border text-[9px] sm:text-[10px] font-bold hover:brightness-110 transition-all flex items-center justify-center gap-1 cursor-pointer"
              style={{
                background: `linear-gradient(to right, ${hexToRgba(MAROON, 0.15)}, ${hexToRgba(MAROON_LIGHT, 0.08)})`,
                borderColor: hexToRgba(MAROON, 0.2),
                color: MAROON_LIGHT,
              }}
            >
              <Zap className="w-2.5 h-2.5" />
              Lihat Profil
            </button>
          </div>
        </div>
      ) : (
        /* No player matched — show donor name only */
        <div className="flex gap-3 sm:gap-4 items-stretch">
          {/* 💎 Diamond avatar panel (no player) */}
          <div className="relative shrink-0">
            {/* Outer glow */}
            <div className="absolute inset-0 scale-125"
              style={{
                clipPath: DIAMOND_CLIP,
                background: `conic-gradient(from 45deg, ${hexToRgba(MAROON, 0.15)}, ${hexToRgba(MAROON_LIGHT, 0.15)}, ${hexToRgba(MAROON, 0.1)})`,
                opacity: 0.3,
                filter: 'blur(8px)',
              }} />

            {/* Diamond frame — ghost */}
            <div className="relative w-28 h-28 sm:w-36 sm:h-36 lg:w-40 lg:h-40"
              style={{
                clipPath: DIAMOND_CLIP,
                background: `linear-gradient(135deg, ${hexToRgba(MAROON, 0.2)}, ${hexToRgba(MAROON_LIGHT, 0.15)}, ${hexToRgba(MAROON, 0.2)})`,
                padding: '4px',
              }}>
              {/* Inner ghost diamond */}
              <div className="w-full h-full flex items-center justify-center"
                style={{
                  clipPath: DIAMOND_CLIP,
                  background: `linear-gradient(135deg, ${hexToRgba(MAROON, 0.08)}, ${hexToRgba(MAROON, 0.03)})`,
                }}>
                <Heart className="w-10 h-10 sm:w-12 sm:h-12 opacity-20" style={{ color: MAROON_LIGHT }} />
              </div>
            </div>

            {/* Heart badge */}
            <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 z-10">
              <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-full flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${hexToRgba(MAROON_LIGHT, 0.4)}, ${hexToRgba(MAROON, 0.4)})`,
                }}>
                <Heart className="w-3 h-3 lg:w-3.5 lg:h-3.5 text-white/40" />
              </div>
            </div>
          </div>

          {/* Donor info panel */}
          <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
            <div>
              <h3 className="text-sm lg:text-base font-black truncate">{sultan.donorName}</h3>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[9px] text-muted-foreground/60">Top Penyawer</span>
                <Badge className={`${dt.badgeBg} text-[7px] lg:text-[8px] border py-0 px-1.5`}>
                  {division === 'male' ? '🕺 Cowo' : '💃 Cewe'}
                </Badge>
              </div>
            </div>

            {/* Stats grid */}
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

            {/* No profile CTA — show "Donor Only" badge */}
            <div className="w-full py-1.5 rounded-lg border text-[9px] sm:text-[10px] font-bold flex items-center justify-center gap-1"
              style={{
                borderColor: hexToRgba(MAROON, 0.15),
                color: hexToRgba(MAROON_LIGHT, 0.6),
                backgroundColor: hexToRgba(MAROON, 0.04),
              }}>
              <Heart className="w-2.5 h-2.5" />
              Donor
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (bare) {
    return (
      <div className={`rounded-2xl border ${dt.borderSubtle} ${dt.bgSubtle} dashboard-card-glow overflow-hidden`}
        style={{ borderColor: hexToRgba(MAROON, 0.15) }}>
        {content}
      </div>
    );
  }

  return content;
}


/** Ghost Sultan Week Division Card — 💎 DIAMOND empty state, MVP horizontal layout */
function GhostSultanWeekDivisionCard({
  division,
  bare = false,
}: {
  division: 'male' | 'female';
  bare?: boolean;
}) {
  const dt = getDivisionTheme(division);
  const DivisionIcon = division === 'male' ? Music : Shield;
  const genderSymbol = division === 'male' ? '♂' : '♀';
  const accentColor = division === 'male' ? '#2E9FFF' : '#FF2D78';

  const content = (
    <div className="p-4 lg:p-6">
      {/* Division label — only in bare mode */}
      {bare && (
        <div className="flex items-center gap-1.5 mb-3">
          <DivisionIcon className="w-3.5 h-3.5 shrink-0" style={{ color: hexToRgba(accentColor, 0.4) }} />
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: hexToRgba(accentColor, 0.4) }}>
            {division === 'male' ? 'COWO' : 'CEWE'} {genderSymbol}
          </span>
        </div>
      )}

      <div className="flex gap-3 sm:gap-4 items-stretch opacity-50">
        {/* Ghost diamond avatar panel */}
        <div className="relative shrink-0">
          {/* Ghost diamond frame */}
          <div className="relative w-28 h-28 sm:w-36 sm:h-36 lg:w-40 lg:h-40"
            style={{
              clipPath: DIAMOND_CLIP,
              background: `linear-gradient(135deg, ${hexToRgba(MAROON, 0.2)}, ${hexToRgba(MAROON_LIGHT, 0.15)}, ${hexToRgba(MAROON, 0.2)})`,
              padding: '4px',
            }}>
            {/* Inner ghost diamond */}
            <div className="w-full h-full flex items-center justify-center"
              style={{
                clipPath: DIAMOND_CLIP,
                background: `linear-gradient(135deg, ${hexToRgba(MAROON, 0.08)}, ${hexToRgba(MAROON, 0.03)})`,
              }}>
              <Heart className="w-10 h-10 sm:w-12 sm:h-12 opacity-20" style={{ color: MAROON_LIGHT }} />
            </div>
          </div>

          {/* Ghost heart badge */}
          <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 z-10">
            <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-full flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${hexToRgba(MAROON_LIGHT, 0.4)}, ${hexToRgba(MAROON, 0.4)})`,
              }}>
              <Heart className="w-3 h-3 lg:w-3.5 lg:h-3.5 text-white/40" />
            </div>
          </div>
        </div>

        {/* Ghost stats panel */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          <div>
            <div className="h-5 w-24 rounded bg-muted/35 mb-2" />
            <div className="h-3 w-16 rounded bg-muted/25 mb-4" />
          </div>

          {/* Ghost stats grid */}
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mb-3">
            {[
              { color: 'bg-[#d4576a]/20' },
              { color: 'bg-[#d4576a]/15' },
              { color: 'bg-idm-gold-warm/15' },
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

  if (bare) {
    return (
      <div className={`rounded-2xl border ${dt.borderSubtle} ${dt.bgSubtle} overflow-hidden opacity-55`}
        style={{ borderColor: hexToRgba(MAROON, 0.08) }}>
        {content}
      </div>
    );
  }

  return <div className="opacity-55">{content}</div>;
}


const SultanOfWeekSection = React.memo(function SultanOfWeekSection({
  maleSultan,
  femaleSultan,
  selectedDivision,
  onPlayerClick,
}: {
  maleSultan: SultanOfWeekly | null;
  femaleSultan: SultanOfWeekly | null;
  selectedDivision: DivisionFilter;
  onPlayerClick: (player: TopPlayer & { division?: string }, division: 'male' | 'female') => void;
}) {
  const ct = useCommunityTheme();
  const showMale = selectedDivision === 'all' || selectedDivision === 'male';
  const showFemale = selectedDivision === 'all' || selectedDivision === 'female';

  return (
    <div className="animate-fade-enter-sm">
      <div className={`rounded-2xl ${ct.casinoCard} overflow-hidden`}
        style={{ borderColor: hexToRgba(MAROON, 0.2) }}>
        {/* Maroon accent bar */}
        <div className="h-1" style={{ background: `linear-gradient(90deg, ${MAROON}, ${MAROON_LIGHT}, ${MAROON})` }} />

        {/* Header */}
        <div className={`flex items-center gap-2.5 px-3 lg:px-5 py-2.5 border-b ${ct.borderSubtle}`}>
          <div className="w-5 h-5 rounded flex items-center justify-center shrink-0"
            style={{ backgroundColor: hexToRgba(MAROON, 0.15), border: `1px solid ${hexToRgba(MAROON, 0.25)}` }}>
            <Heart className="w-3 h-3" style={{ color: MAROON_LIGHT }} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: MAROON_LIGHT }}>
            Sultan of the Week
          </span>
        </div>

        {/* Content — MVP-style division cards */}
        {selectedDivision === 'all' ? (
          /* Unified "all" mode: male/female side-by-side on desktop, stacked on mobile */
          <div className="grid grid-cols-1 lg:grid-cols-2">
            {showMale && (
              <div className={`border-b lg:border-b-0 lg:border-r ${ct.borderSubtle}`}>
                {maleSultan ? (
                  <SultanWeekDivisionCard
                    sultan={maleSultan}
                    division="male"
                    onPlayerClick={onPlayerClick}
                    bare
                  />
                ) : (
                  <GhostSultanWeekDivisionCard division="male" bare />
                )}
              </div>
            )}
            {showFemale && (
              <div>
                {femaleSultan ? (
                  <SultanWeekDivisionCard
                    sultan={femaleSultan}
                    division="female"
                    onPlayerClick={onPlayerClick}
                    bare
                  />
                ) : (
                  <GhostSultanWeekDivisionCard division="female" bare />
                )}
              </div>
            )}
          </div>
        ) : (
          /* Specific division mode — single card */
          <div>
            {showMale && (
              maleSultan ? (
                <SultanWeekDivisionCard
                  sultan={maleSultan}
                  division="male"
                  onPlayerClick={onPlayerClick}
                />
              ) : (
                <GhostSultanWeekDivisionCard division="male" />
              )
            )}
            {showFemale && (
              femaleSultan ? (
                <SultanWeekDivisionCard
                  sultan={femaleSultan}
                  division="female"
                  onPlayerClick={onPlayerClick}
                />
              ) : (
                <GhostSultanWeekDivisionCard division="female" />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
});


/* ═══════════════════════════════════════════
   Highlights (Juara) Page — Main Component
   Contains: Season Champion, Season 1 Club Champion, Sultan of Season, Weekly Champions, MVP Spotlight, Sultan of the Week, MVP Hall of Fame
   ═══════════════════════════════════════════ */
export function HighlightsPage() {

  // State
  const [selectedPlayer, setSelectedPlayer] = useState<(StatsData['topPlayers'][0] & { division?: string }) | null>(null);
  const [selectedDivision, setSelectedDivision] = useState<DivisionFilter>('all');

  // Division change handler
  const handleDivisionChange = useCallback((d: DivisionFilter) => {
    startTransition(() => setSelectedDivision(d));
  }, []);

  // Player click handler
  const handlePlayerClick = useCallback((player: TopPlayer & { division?: string }, division: 'male' | 'female') => {
    setSelectedPlayer({
      ...player,
      division,
      club: clubToString(player.club as Parameters<typeof clubToString>[0]) || undefined,
    });
  }, []);

  // Data fetching — male stats
  const { data: maleData } = useQuery<StatsData>({
    queryKey: ['stats', 'male'],
    queryFn: async () => {
      const res = await fetch('/api/stats?division=male');
      return res.json();
    },
    staleTime: 120000,
    refetchInterval: 300000,
    refetchIntervalInBackground: false,
    notifyOnChangeProps: ['data', 'error'],
    refetchOnWindowFocus: true,
    gcTime: 300000,
    placeholderData: (prev) => prev,
  });

  // Data fetching — female stats
  const { data: femaleData } = useQuery<StatsData>({
    queryKey: ['stats', 'female'],
    queryFn: async () => {
      const res = await fetch('/api/stats?division=female');
      return res.json();
    },
    staleTime: 120000,
    refetchInterval: 330000,
    refetchIntervalInBackground: false,
    notifyOnChangeProps: ['data', 'error'],
    refetchOnWindowFocus: true,
    gcTime: 300000,
    placeholderData: (prev) => prev,
  });

  // ─── Sultan of the Week data (per division) ───
  const maleSultanList = maleData?.sultanOfWeekly || [];
  const femaleSultanList = femaleData?.sultanOfWeekly || [];
  const latestMaleSultan = maleSultanList.length > 0 ? maleSultanList[maleSultanList.length - 1] : null;
  const latestFemaleSultan = femaleSultanList.length > 0 ? femaleSultanList[femaleSultanList.length - 1] : null;
  const showMaleSultan = selectedDivision === 'all' || selectedDivision === 'male';
  const showFemaleSultan = selectedDivision === 'all' || selectedDivision === 'female';

  // ─── Sultan of Season data (separated by division) ───
  const { maleSeasonSultans, femaleSeasonSultans } = React.useMemo(() => {
    const maleSultans: { seasonNumber: number; sultan: SultanPlayer }[] = [];
    const femaleSultans: { seasonNumber: number; sultan: SultanPlayer }[] = [];

    // Male seasons
    const seenMale = new Set<number>();
    for (const season of (maleData?.allSeasons || [])) {
      if (season.status === 'completed' && season.sultanPlayer && !seenMale.has(season.number)) {
        seenMale.add(season.number);
        maleSultans.push({ seasonNumber: season.number, sultan: season.sultanPlayer });
      }
    }
    maleSultans.sort((a, b) => b.seasonNumber - a.seasonNumber);

    // Female seasons
    const seenFemale = new Set<number>();
    for (const season of (femaleData?.allSeasons || [])) {
      if (season.status === 'completed' && season.sultanPlayer && !seenFemale.has(season.number)) {
        seenFemale.add(season.number);
        femaleSultans.push({ seasonNumber: season.number, sultan: season.sultanPlayer });
      }
    }
    femaleSultans.sort((a, b) => b.seasonNumber - a.seasonNumber);

    return { maleSeasonSultans: maleSultans, femaleSeasonSultans: femaleSultans };
  }, [maleData, femaleData]);

  // ─── Summary data for collapsible headers ───
  const seasonChampionSummary = React.useMemo(() => {
    const parts: string[] = [];
    // Only show champions from COMPLETED seasons (admin-assigned),
    // not the current leaderboard leader from active seasons.
    const maleSeasonsWithChampion = maleData?.allSeasons?.filter(s => s.championPlayer && s.status === 'completed') || [];
    const femaleSeasonsWithChampion = femaleData?.allSeasons?.filter(s => s.championPlayer && s.status === 'completed') || [];
    const latestMale = maleSeasonsWithChampion.sort((a, b) => b.number - a.number)[0];
    const latestFemale = femaleSeasonsWithChampion.sort((a, b) => b.number - a.number)[0];
    if (latestMale?.championPlayer) parts.push(latestMale.championPlayer.gamertag);
    if (latestFemale?.championPlayer) parts.push(latestFemale.championPlayer.gamertag);
    return parts.length > 0 ? parts.join(' · ') : '';
  }, [maleData, femaleData]);

  const seasonChampionNumber = React.useMemo(() => {
    // Only show season number from COMPLETED seasons
    const maleSeasonsWithChampion = maleData?.allSeasons?.filter(s => s.championPlayer && s.status === 'completed') || [];
    const femaleSeasonsWithChampion = femaleData?.allSeasons?.filter(s => s.championPlayer && s.status === 'completed') || [];
    const m = maleSeasonsWithChampion.sort((a, b) => b.number - a.number)[0]?.number || 0;
    const f = femaleSeasonsWithChampion.sort((a, b) => b.number - a.number)[0]?.number || 0;
    return Math.max(m, f);
  }, [maleData, femaleData]);

  const clubChampionSummary = React.useMemo(() => {
    const maleSeason1 = maleData?.allSeasons?.find(s => s.number === 1 && s.status === 'completed' && s.championClub);
    const femaleSeason1 = femaleData?.allSeasons?.find(s => s.number === 1 && s.status === 'completed' && s.championClub);
    const names: string[] = [];
    if (maleSeason1?.championClub) names.push(maleSeason1.championClub.name);
    if (femaleSeason1?.championClub && femaleSeason1.championClub.name !== (maleSeason1?.championClub?.name)) names.push(femaleSeason1.championClub.name);
    return names.length > 0 ? names.join(' · ') : '';
  }, [maleData, femaleData]);

  const hasClubData = React.useMemo(() => {
    const m = maleData?.allSeasons?.find(s => s.number === 1 && s.status === 'completed' && s.championClub);
    const f = femaleData?.allSeasons?.find(s => s.number === 1 && s.status === 'completed' && s.championClub);
    return !!(m || f);
  }, [maleData, femaleData]);

  const sultanSummary = React.useMemo(() => {
    const parts: string[] = [];
    if (maleSeasonSultans.length > 0) parts.push(maleSeasonSultans[0].sultan.gamertag);
    if (femaleSeasonSultans.length > 0) parts.push(femaleSeasonSultans[0].sultan.gamertag);
    return parts.length > 0 ? parts.join(' · ') : '';
  }, [maleSeasonSultans, femaleSeasonSultans]);

  const sultanSeasonNumber = React.useMemo(() => {
    const m = maleSeasonSultans[0]?.seasonNumber || 0;
    const f = femaleSeasonSultans[0]?.seasonNumber || 0;
    return Math.max(m, f);
  }, [maleSeasonSultans, femaleSeasonSultans]);

  return (
    <div className="min-h-screen bg-background">
      {/* Content */}
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 px-3 sm:px-4 lg:px-6 py-4">

        {/* ═══ 1. Champion & MVP Sections ═══ */}
        <div className="space-y-3 sm:space-y-4">
          {/* Sticky Division Filter Header — sticks below fixed nav (h-14) */}
          <div className="sticky top-14 z-30 -mx-1.5 sm:-mx-2 lg:-mx-3 px-1.5 sm:px-2 lg:px-3 py-2.5 bg-background/95 backdrop-blur-md border-b border-idm-gold-warm/10">
            <ChampionsMvpHeader
              selectedDivision={selectedDivision}
              onDivisionChange={handleDivisionChange}
            />
          </div>

          {/* Weekly Champions */}
          <div className="animate-fade-enter-sm">
            <WeeklyChampionCard maleData={maleData} femaleData={femaleData} selectedDivision={selectedDivision} onPlayerClick={handlePlayerClick} />
          </div>

          {/* MVP Spotlight */}
          <div className="animate-fade-enter-sm">
            <MvpSpotlight maleData={maleData} femaleData={femaleData} selectedDivision={selectedDivision} onPlayerClick={handlePlayerClick} />
          </div>

          {/* Sultan of the Week — above MVP Hall of Fame */}
          <SultanOfWeekSection
            maleSultan={latestMaleSultan}
            femaleSultan={latestFemaleSultan}
            selectedDivision={selectedDivision}
            onPlayerClick={handlePlayerClick}
          />

          {/* MVP Hall of Fame */}
          <div className="animate-fade-enter-sm">
            <MvpHallOfFame maleData={maleData} femaleData={femaleData} selectedDivision={selectedDivision} />
          </div>
        </div>

        {/* ═══ 2. Season Champions & Sultan Sections — Tabbed ═══ */}
        <div className="space-y-3 sm:space-y-4">
          {/* Season Champion & Sultan of Season — tabbed card */}
          <SeasonChampionSultanTabs
            maleData={maleData}
            femaleData={femaleData}
            selectedDivision={selectedDivision}
            onPlayerClick={handlePlayerClick}
            seasonChampionSummary={seasonChampionSummary}
            seasonChampionNumber={seasonChampionNumber}
            sultanSummary={sultanSummary}
            sultanSeasonNumber={sultanSeasonNumber}
            maleSeasonSultans={maleSeasonSultans}
            femaleSeasonSultans={femaleSeasonSultans}
          />

          {/* Club Champion — winning club of completed seasons */}
          {hasClubData && (
            <ChampionCollapsible
              icon={Trophy}
              iconColor="#EFF923"
              title="Club Champion"
              summary={clubChampionSummary || undefined}
              defaultOpen={false}
              badge={(
                <Badge className="bg-idm-gold-warm/15 text-idm-gold-warm border border-idm-gold-warm/25 text-[8px] font-bold">
                  <Trophy className="w-2.5 h-2.5 mr-0.5" />S1
                </Badge>
              )}
            >
              <SeasonOneClubChampion
                maleData={maleData}
                femaleData={femaleData}
                selectedDivision={selectedDivision}
                bare
              />
            </ChampionCollapsible>
          )}
        </div>


      </div>

      {/* Modals */}
      {selectedPlayer && (
        <PlayerProfile
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
          skinMap={{ ...maleData?.skinMap, ...femaleData?.skinMap }}
        />
      )}
    </div>
  );
}
