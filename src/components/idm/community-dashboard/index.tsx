'use client';

import { useQuery } from '@tanstack/react-query';
import type { StatsData, TopPlayer } from '@/types/stats';
import {
  Users, Trophy, Crown,
  Radio,
  Target, Calendar,
  Clock, Gift, Zap, Shield, Gamepad2,
  Search, Play, CheckCircle2, XCircle,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import React, { useState, useRef, useMemo, useEffect, useCallback, startTransition } from 'react';
import { useCommunityTheme, getCommunityTheme } from '@/hooks/use-community-theme';
import { useDivisionTheme, getDivisionTheme } from '@/hooks/use-division-theme';
import { useAppStore } from '@/lib/store';
import { formatCurrencyShort, clubToString, getAvatarUrl } from '@/lib/utils';
import { AvatarMedia } from '@/components/ui/avatar-media';

// Import modular components — original
import { CommunityHero } from './community-hero';
import { CommunityLeaderboard, PeringkatHeader } from './community-leaderboard';

// Import modular components — new features

import { CommunityMatches } from './community-matches';
import { UpcomingMatches } from './upcoming-matches';
import { CommunityWeeklyChampions } from './weekly-champions';
import { WeeklyChampionCard } from './weekly-champion-card';
import { PlayerCard } from '../player-card';
import { WeekNavigator } from '../week-navigator';

// ★ Dynamic imports for modals — removes ~225KB (including framer-motion) from initial bundle
import dynamic from 'next/dynamic';
const DonationModal = dynamic(() => import('../donation-modal').then(m => ({ default: m.DonationModal })), { ssr: false, loading: () => null });
const RegistrationModal = dynamic(() => import('../registration-modal').then(m => ({ default: m.RegistrationModal })), { ssr: false, loading: () => null });
const PaymentModal = dynamic(() => import('../payment-modal').then(m => ({ default: m.PaymentModal })), { ssr: false, loading: () => null });
const PlayerProfile = dynamic(() => import('../player-profile').then(m => ({ default: m.PlayerProfile })), { ssr: false, loading: () => null });
const ClubProfile = dynamic(() => import('../club-profile').then(m => ({ default: m.ClubProfile })), { ssr: false, loading: () => null });

// ★ Dynamic imports for below-fold heavy sections
const TopDonorsWidget = dynamic(() => import('../dashboard/top-donors-widget').then(m => ({ default: m.TopDonorsWidget })), { ssr: false, loading: () => <div className="min-h-[400px]" /> });
const MvpHallOfFame = dynamic(() => import('./mvp-hall-of-fame').then(m => ({ default: m.MvpHallOfFame })), { ssr: false, loading: () => <div className="min-h-[300px]" /> });
const HistoricalSeasonView = dynamic(() => import('./historical-season-view').then(m => ({ default: m.HistoricalSeasonView })), { ssr: false, loading: () => <div className="min-h-[400px]" /> });

// Import division dashboard components — REUSE, do NOT duplicate
import { QuickStatsBar } from '../dashboard/quick-stats-bar';

import { MatchesTab } from '../dashboard/matches-tab';

// Import shared components
import { SkinBadgesRow, SkinName } from '../skin-renderer';
import { getPrimarySkin } from '@/lib/skin-utils';
import { StatusBadge } from '../status-badge';
import { SponsorBanner } from '../ui/sponsor-banner';

// Import season selector components
import { SeasonSelector, type SelectedSeason } from './season-selector';

// Import marquee ticker
import { MarqueeTicker } from '../marquee-ticker';

// Import live match scoreboard
import { LiveMatchScoreboard } from './live-match-scoreboard';

// Pusher real-time hook is already called in AppShell — no duplicate needed here

// Import landing shared components for visual enhancements
import { AnimatedSection } from '../landing/shared';

// Import dashboard shared components for bracket-style hasil section
import { SectionCard, MatchRow } from '../dashboard/shared';

// Import SharePopup for social sharing
import { SharePopup } from '../social-share-button';


/* ═══════════════════════════════════════════
   Internal Tab Bar — reusable within sections
   Desktop: Segmented control with larger targets
   Mobile: Horizontal scroll, no wrapping
   ═══════════════════════════════════════════ */
const SectionTabBar = React.memo(function SectionTabBar<T extends string>({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: { id: T; label: string; icon?: typeof Trophy }[];
  activeTab: T;
  onTabChange: (tab: T) => void;
}) {
  return (
    <div className="overflow-x-auto scrollbar-none -mx-1 px-1">
      <div className="flex items-center gap-0.5 p-1 rounded-lg bg-idm-gold-warm/5 border border-idm-gold-warm/10 min-w-max lg:min-w-0">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`compact-pill flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all whitespace-nowrap lg:px-4 lg:py-2 lg:text-xs ${
                isActive
                  ? 'bg-idm-gold-warm/20 text-idm-gold-warm shadow-sm border border-idm-gold-warm/25 activity-card-glass'
                  : 'text-muted-foreground hover:text-foreground border border-transparent hover:bg-muted/40'
              }`}
            >
              {Icon && <Icon className="w-3 h-3 lg:w-3.5 lg:h-3.5" />}
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
});


/* ═══════════════════════════════════════════
   Tournament Progress Steps — ported from dashboard
   ═══════════════════════════════════════════ */
const TournamentProgress = React.memo(function TournamentProgress({ status, divisionTheme }: { status: string; divisionTheme: ReturnType<typeof getDivisionTheme> }) {
  const dt = divisionTheme;
  const steps = [
    { key: 'setup', label: 'Setup' },
    { key: 'registration', label: 'Daftar' },
    { key: 'approval', label: 'Approval' },
    { key: 'team_generation', label: 'Tim' },
    { key: 'bracket_generation', label: 'Bracket' },
    { key: 'main_event', label: 'Main' },
    { key: 'finalization', label: 'Final' },
    { key: 'completed', label: 'Selesai' },
  ];
  const currentIdx = steps.findIndex(s => s.key === status);

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto pb-1 scrollbar-none">
      {steps.map((step, idx) => {
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <div key={step.key} className="flex items-center">
            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-semibold whitespace-nowrap ${
              isDone ? `${dt.bgSubtle} ${dt.neonText}` :
              isCurrent ? `${dt.bg} ${dt.text} ${dt.neonPulse}` :
              'bg-muted/30 text-muted-foreground/50'
            }`}>
              {isDone ? <CheckCircle2 className="w-2.5 h-2.5" /> :
               isCurrent ? <Play className="w-2.5 h-2.5" /> :
               <div className="w-2.5 h-2.5 rounded-full border border-current opacity-30" />}
              <span className="hidden sm:inline">{step.label}</span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`w-2 h-0.5 ${isDone ? dt.neonText : 'bg-muted/30'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
});


/* ═══════════════════════════════════════════
   Round Label Helper
   ═══════════════════════════════════════════ */
function getRoundLabelFromTotal(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return 'Grand Final';
  if (fromEnd === 1) return 'Semi Final';
  if (fromEnd === 2) return 'Quarter Final';
  return `Ronde ${round}`;
}

type DivisionFilter = 'all' | 'male' | 'female';



/* ═══════════════════════════════════════════
   Hasil Pertandingan Section — Bracket-style match results
   Cloned from Arena Live > Bracket > Hasil tab
   Shows completed matches grouped by round/bracket per division
   Uses BOTH LeagueMatch (recentMatches) AND Tournament matches (activeTournament.matches)
   With Semua/Male/Female tabs
   ═══════════════════════════════════════════ */

/* Unified match row type for display */
interface UnifiedMatchResult {
  id: string;
  name1: string;
  name2: string;
  score1: number | null;
  score2: number | null;
  round: number;
  bracket: string | null; // 'upper' | 'lower' | 'grand_final' | null (league matches)
  matchNumber: number | null;
  source: 'league' | 'tournament';
}

/* Get human-readable label for a bracket+round combination */
function getRoundLabel(bracket: string | null, round: number): string {
  if (!bracket) return `Round ${round}`;
  switch (bracket) {
    case 'grand_final':
      return '🏆 Grand Final';
    case 'upper':
      if (round === 1) return '⬆️ Semi Final Upper';
      if (round === 2) return '⬆️ Final Upper';
      return `⬆️ Upper R${round}`;
    case 'lower':
      if (round === 1) return '⬇️ Semi Final Lower';
      if (round === 2) return '⬇️ Final Lower';
      return `⬇️ Lower R${round}`;
    case 'winners':
      return `🏆 Winners R${round}`;
    case 'losers':
      return `💀 Losers R${round}`;
    default:
      return `Round ${round}`;
  }
}

/* Sort key for bracket+round (determines display order) */
function getRoundSortKey(bracket: string | null, round: number): number {
  if (!bracket) return round * 10;
  // Order: upper rounds → lower rounds → grand final
  switch (bracket) {
    case 'upper': return round * 10;
    case 'lower': return 100 + round * 10;
    case 'grand_final': return 999;
    case 'winners': return round * 10;
    case 'losers': return 100 + round * 10;
    default: return 500 + round * 10;
  }
}

/* Group key combining bracket and round */
function getGroupKey(m: UnifiedMatchResult): string {
  return m.bracket ? `${m.bracket}-${m.round}` : `round-${m.round}`;
}

const BracketHasilSection = React.memo(function BracketHasilSection({
  maleData,
  femaleData,
}: {
  maleData?: StatsData;
  femaleData?: StatsData;
}) {
  const ct = useCommunityTheme();
  const [hasilDivision, setHasilDivision] = useState<DivisionFilter>('all');

  // Merge LeagueMatch + Tournament matches into unified format per division
  const maleMatches = useMemo<UnifiedMatchResult[]>(() => {
    const results: UnifiedMatchResult[] = [];
    // 1. League matches (recentMatches — club-vs-club)
    for (const m of (maleData?.recentMatches ?? [])) {
      results.push({
        id: m.id,
        name1: m.club1.name,
        name2: m.club2.name,
        score1: m.score1,
        score2: m.score2,
        round: m.week,
        bracket: null,
        matchNumber: null,
        source: 'league',
      });
    }
    // 2. Tournament matches (activeTournament.matches — team-vs-team)
    const tMatches = maleData?.activeTournament?.matches?.filter(m => m.status === 'completed') ?? [];
    for (const m of tMatches) {
      results.push({
        id: m.id,
        name1: m.team1?.name ?? 'TBD',
        name2: m.team2?.name ?? 'TBD',
        score1: m.score1,
        score2: m.score2,
        round: m.round ?? 1,
        bracket: m.bracket ?? null,
        matchNumber: m.matchNumber ?? null,
        source: 'tournament',
      });
    }
    return results;
  }, [maleData?.recentMatches, maleData?.activeTournament?.matches]);

  const femaleMatches = useMemo<UnifiedMatchResult[]>(() => {
    const results: UnifiedMatchResult[] = [];
    // 1. League matches
    for (const m of (femaleData?.recentMatches ?? [])) {
      results.push({
        id: m.id,
        name1: m.club1.name,
        name2: m.club2.name,
        score1: m.score1,
        score2: m.score2,
        round: m.week,
        bracket: null,
        matchNumber: null,
        source: 'league',
      });
    }
    // 2. Tournament matches
    const tMatches = femaleData?.activeTournament?.matches?.filter(m => m.status === 'completed') ?? [];
    for (const m of tMatches) {
      results.push({
        id: m.id,
        name1: m.team1?.name ?? 'TBD',
        name2: m.team2?.name ?? 'TBD',
        score1: m.score1,
        score2: m.score2,
        round: m.round ?? 1,
        bracket: m.bracket ?? null,
        matchNumber: m.matchNumber ?? null,
        source: 'tournament',
      });
    }
    return results;
  }, [femaleData?.recentMatches, femaleData?.activeTournament?.matches]);

  // Group matches by round/bracket per division
  const maleMatchesGrouped = useMemo(() => {
    const map: Record<string, UnifiedMatchResult[]> = {};
    for (const m of maleMatches) {
      const key = getGroupKey(m);
      if (!map[key]) map[key] = [];
      map[key].push(m);
    }
    // Sort each group by matchNumber
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => (a.matchNumber ?? 0) - (b.matchNumber ?? 0));
    }
    return map;
  }, [maleMatches]);

  const femaleMatchesGrouped = useMemo(() => {
    const map: Record<string, UnifiedMatchResult[]> = {};
    for (const m of femaleMatches) {
      const key = getGroupKey(m);
      if (!map[key]) map[key] = [];
      map[key].push(m);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => (a.matchNumber ?? 0) - (b.matchNumber ?? 0));
    }
    return map;
  }, [femaleMatches]);

  // Sort group keys by round order (upper → lower → grand final)
  const sortGroupKeys = (keys: string[], matches: Record<string, UnifiedMatchResult[]>): string[] => {
    return keys.sort((a, b) => {
      const mA = matches[a]?.[0];
      const mB = matches[b]?.[0];
      if (!mA || !mB) return 0;
      return getRoundSortKey(mA.bracket, mA.round) - getRoundSortKey(mB.bracket, mB.round);
    });
  };

  const hasMaleMatches = maleMatches.length > 0;
  const hasFemaleMatches = femaleMatches.length > 0;
  const hasAnyMatches = hasMaleMatches || hasFemaleMatches;

  return (
    <div className="space-y-4">
      {/* Section Header + Division Tabs */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-5 h-5 rounded ${ct.iconBg} flex items-center justify-center shrink-0`}>
            <Radio className={`w-3 h-3 ${ct.neonText}`} />
          </div>
          <h3 className="text-xs font-semibold uppercase tracking-wider shrink-0" style={{
            background: 'linear-gradient(135deg, #FAF0DC 0%, #EFF923 30%, #F9CB25 50%, #F9CB25 70%, #EFF923 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>Hasil Pertandingan</h3>
          <SharePopup
            shareUrl={typeof window !== 'undefined' ? `${window.location.origin}/?view=hasil` : ''}
            title="Bagikan Hasil"
            subtitle="Hasil Pertandingan"
            shareText="Lihat hasil pertandingan Tarkam IDM!"
            buttonLabel="Bagikan hasil"
            size="sm"
          />
        </div>

        {/* Division pills — compact, right-aligned (same style as Champion) */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-idm-gold-warm/5 border border-idm-gold-warm/10">
          {([
            { key: 'all' as DivisionFilter, label: 'Semua' },
            { key: 'male' as DivisionFilter, label: 'Cowo' },
            { key: 'female' as DivisionFilter, label: 'Cewe' },
          ]).map(div => (
            <button
              key={div.key}
              onClick={() => setHasilDivision(div.key)}
              className={`compact-pill px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                hasilDivision === div.key
                  ? 'bg-idm-gold-warm/15 text-idm-gold-warm shadow-sm shadow-idm-gold-warm/10 border border-idm-gold-warm/25'
                  : 'text-muted-foreground/70 hover:text-foreground border border-transparent hover:bg-muted/40'
              }`}
            >
              {div.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results based on selected tab */}
      {hasAnyMatches ? (
        <div className="space-y-4">
          {/* Semua tab — show both divisions (always show both, ghost empty for missing) */}
          {hasilDivision === 'all' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <DivisionHasilCard
                division="male"
                matchesGrouped={maleMatchesGrouped}
                totalMatches={maleMatches.length}
                isEmpty={!hasMaleMatches}
              />
              <DivisionHasilCard
                division="female"
                matchesGrouped={femaleMatchesGrouped}
                totalMatches={femaleMatches.length}
                isEmpty={!hasFemaleMatches}
              />
            </div>
          )}

          {/* Male tab — show only male division */}
          {hasilDivision === 'male' && (
            <DivisionHasilCard
              division="male"
              matchesGrouped={maleMatchesGrouped}
              totalMatches={maleMatches.length}
              isEmpty={!hasMaleMatches}
            />
          )}

          {/* Female tab — show only female division */}
          {hasilDivision === 'female' && (
            <DivisionHasilCard
              division="female"
              matchesGrouped={femaleMatchesGrouped}
              totalMatches={femaleMatches.length}
              isEmpty={!hasFemaleMatches}
            />
          )}
        </div>
      ) : (
        <Card className={`${ct.casinoCard} overflow-hidden`}>
          <div className={ct.casinoBar} />
          <div className="p-8 text-center">
            <Gamepad2 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
            <h3 className="text-xs font-bold text-muted-foreground mb-0.5">Belum Ada Hasil Pertandingan</h3>
            <p className="text-[10px] text-muted-foreground/60">Hasil match akan muncul setelah pertandingan selesai</p>
          </div>
        </Card>
      )}
    </div>
  );
});


/* ─── Division Hasil Card — Per-division match results grouped by round/bracket ─── */
const DivisionHasilCard = React.memo(function DivisionHasilCard({
  division,
  matchesGrouped,
  totalMatches,
  isEmpty,
}: {
  division: 'male' | 'female';
  matchesGrouped: Record<string, UnifiedMatchResult[]>;
  totalMatches: number;
  isEmpty: boolean;
}) {
  const dt = getDivisionTheme(division);
  const emoji = division === 'male' ? '🕺' : '💃';

  // Sort group keys by round order
  const sortedKeys = Object.keys(matchesGrouped).sort((a, b) => {
    const mA = matchesGrouped[a]?.[0];
    const mB = matchesGrouped[b]?.[0];
    if (!mA || !mB) return 0;
    return getRoundSortKey(mA.bracket, mA.round) - getRoundSortKey(mB.bracket, mB.round);
  });

  // Ghost empty state — show skeleton rounds
  if (isEmpty) {
    return (
      <SectionCard title={`${emoji} Hasil Match`} icon={Trophy} badge="0 Match">
        <div className="space-y-3">
          {/* Ghost round placeholders */}
          {['⬆️ Semi Final', '⬇️ Semi Final', '🏆 Grand Final'].map((label, idx) => (
            <div key={idx} className="opacity-30">
              <div className="flex items-center gap-3 mb-2">
                <div className={`px-2 py-0.5 rounded-md ${dt.bg} ${dt.text} text-[9px] font-bold uppercase tracking-wider`}>
                  {label}
                </div>
                <div className={`flex-1 h-px ${dt.borderSubtle}`} />
                <span className="text-[8px] text-muted-foreground">—</span>
              </div>
              <div className="space-y-1.5">
                <div className={`rounded-lg ${dt.bgSubtle} ${dt.borderSubtle} border h-[52px] flex items-center justify-center`}>
                  <span className="text-[10px] text-muted-foreground/40 italic">Belum ada hasil</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title={`${emoji} Hasil Match`} icon={Trophy} badge={`${totalMatches} Match`}>
      <div className="space-y-4">
        {sortedKeys.map(key => {
          const matches = matchesGrouped[key];
          const firstMatch = matches[0];
          const roundLabel = firstMatch ? getRoundLabel(firstMatch.bracket, firstMatch.round) : `Round ${key}`;
          const isGrandFinal = firstMatch?.bracket === 'grand_final';

          return (
            <div key={key}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`px-2 py-0.5 rounded-md ${dt.bg} ${dt.text} text-[9px] font-bold uppercase tracking-wider whitespace-nowrap`}>
                  {roundLabel}
                </div>
                <div className={`flex-1 h-px ${dt.borderSubtle}`} />
                <span className="text-[8px] text-muted-foreground">{matches.length} match</span>
              </div>
              <div className="space-y-1.5">
                {matches.map(m => {
                  // Grand Final — special champion rendering
                  if (isGrandFinal && m.score1 != null && m.score2 != null) {
                    const winner1 = m.score1 > m.score2;
                    const winner2 = m.score2 > m.score1;
                    return (
                      <div key={m.id} className={`group flex items-stretch rounded-lg overflow-hidden border transition-all hover:shadow-sm ${dt.bgSubtle} border-idm-gold-warm/30`}>
                        {/* Champion left bar */}
                        <div className="w-10 shrink-0 flex items-center justify-center bg-idm-gold-warm/20 border-r border-idm-gold-warm/25">
                          <span className="text-base">🏆</span>
                        </div>
                        {/* Match content */}
                        <div className="flex-1 min-w-0">
                          {/* Team 1 */}
                          <div className={`flex items-center px-3 py-2 border-b ${dt.borderSubtle} ${winner1 ? 'bg-idm-gold-warm/10' : 'opacity-60'}`}>
                            {winner1 && <span className="text-sm mr-1.5">👑</span>}
                            <span className={`text-xs font-bold truncate flex-1 ${winner1 ? 'text-idm-gold-warm' : 'text-muted-foreground'}`}>
                              {m.name1}
                            </span>
                            {winner1 && <span className="text-[8px] font-black text-idm-gold-warm/70 uppercase tracking-wider mr-2">Champion</span>}
                            <span className={`text-sm font-bold tabular-nums w-6 text-right ${winner1 ? 'text-idm-gold-warm' : 'text-foreground'}`}>{m.score1}</span>
                          </div>
                          {/* Team 2 */}
                          <div className={`flex items-center px-3 py-2 ${winner2 ? 'bg-idm-gold-warm/10' : 'opacity-60'}`}>
                            {winner2 && <span className="text-sm mr-1.5">👑</span>}
                            <span className={`text-xs font-bold truncate flex-1 ${winner2 ? 'text-idm-gold-warm' : 'text-muted-foreground'}`}>
                              {m.name2}
                            </span>
                            {winner2 && <span className="text-[8px] font-black text-idm-gold-warm/70 uppercase tracking-wider mr-2">Champion</span>}
                            <span className={`text-sm font-bold tabular-nums w-6 text-right ${winner2 ? 'text-idm-gold-warm' : 'text-foreground'}`}>{m.score2}</span>
                          </div>
                        </div>
                        {/* Status */}
                        <div className="w-16 shrink-0 flex flex-col items-center justify-center border-l border-idm-gold-warm/20">
                          <Badge className="bg-idm-gold-warm/15 text-idm-gold-warm text-[8px] border border-idm-gold-warm/25 font-black">FT</Badge>
                        </div>
                      </div>
                    );
                  }
                  // Regular match — standard MatchRow
                  return (
                    <MatchRow
                      key={m.id}
                      club1={m.name1}
                      club2={m.name2}
                      score1={m.score1 ?? 0}
                      score2={m.score2 ?? 0}
                      status="completed"
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
});


/* ═══════════════════════════════════════════
   Division Standings Section — Community Leaderboard
   ═══════════════════════════════════════════ */

const DivisionStandingsSection = React.memo(function DivisionStandingsSection({
  maleData,
  femaleData,
  selectedDivision,
  onPlayerClick,
  onClubClick,
  leaderboardSort,
  onLeaderboardSortChange,
  divisionFilter,
  onDivisionFilterChange,
}: {
  maleData?: StatsData;
  femaleData?: StatsData;
  selectedDivision: DivisionFilter;
  onPlayerClick: (player: TopPlayer & { division?: string }, division: 'male' | 'female') => void;
  onClubClick: (club: StatsData['clubs'][0]) => void;
  leaderboardSort?: 'players' | 'clubs';
  onLeaderboardSortChange?: (sort: 'players' | 'clubs') => void;
  divisionFilter?: 'all' | 'male' | 'female';
  onDivisionFilterChange?: (filter: 'all' | 'male' | 'female') => void;
}) {
  return (
    <CommunityLeaderboard
      maleData={maleData}
      femaleData={femaleData}
      onPlayerClick={onPlayerClick}
      onClubClick={onClubClick}
      leaderboardSort={leaderboardSort}
      onLeaderboardSortChange={onLeaderboardSortChange}
      divisionFilter={divisionFilter}
      onDivisionFilterChange={onDivisionFilterChange}
    />
  );
});



/* ═══════════════════════════════════════════
   LayoutRow — pairs sections side-by-side on desktop
   ═══════════════════════════════════════════ */
function LayoutRow({ children, cols = '2', className = '' }: { children: React.ReactNode; cols?: '2' | '3-2' | '2-3'; className?: string }) {
  const gridClass = cols === '3-2'
    ? 'lg:grid-cols-5'
    : cols === '2-3'
      ? 'lg:grid-cols-5'
      : 'lg:grid-cols-2';

  return (
    <div className={`grid grid-cols-1 ${gridClass} gap-5 lg:gap-6 ${className}`}>
      {children}
    </div>
  );
}


/* ═══════════════════════════════════════════
   Section wrapper with staggered reveal
   ═══════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════
   LazySection — Skip JS execution + DOM creation for below-fold sections
   Unlike content-visibility: auto (which only skips layout/paint),
   this completely defers React component rendering until near viewport.
   ★ KEY for INP: reduces initial hydration work and DOM element count ★
   ═══════════════════════════════════════════════════════ */
const LazySection = React.memo(function LazySection({
  children,
  placeholderHeight = 500,
  placeholderHeightMobile,
  rootMargin = '300px',
}: {
  children: React.ReactNode;
  placeholderHeight?: number;
  placeholderHeightMobile?: number;
  rootMargin?: string;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Already visible (e.g. server-rendered above fold)
    if (isVisible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isVisible, rootMargin]);

  if (isVisible) return <>{children}</>;

  // Use smaller placeholder on mobile to reduce CLS
  const mobileHeight = placeholderHeightMobile ?? Math.round(placeholderHeight * 0.65);

  return (
    <div
      ref={ref}
      style={{
        height: mobileHeight,
        contain: 'layout style',
        minHeight: mobileHeight,
        // Desktop override via CSS custom property approach
        '--desktop-height': `${placeholderHeight}px`,
      } as React.CSSProperties}
      aria-hidden="true"
      className="sm:h-[var(--desktop-height)]"
    />
  );
});


const Section = React.memo(function Section({
  children,
  className = '',
  title,
  icon: Icon,
  iconColor = 'text-idm-gold-warm',
  sectionId,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  icon?: typeof Trophy;
  iconColor?: string;
  sectionId?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section
      className={className}
      id={sectionId ? `section-${sectionId}` : undefined}
      style={style}
    >
      {title && Icon && (
        <div className="flex items-center gap-2 mb-3">
          <Icon className={`w-4 h-4 ${iconColor}`} />
          <h2 className="text-sm font-bold uppercase tracking-wider">{title}</h2>
          <div className="flex-1 h-px bg-border/20" />
        </div>
      )}
      {children}
    </section>
  );
});


/* ═══════════════════════════════════════════
   Loading Skeleton
   ═══════════════════════════════════════════ */
const CommunityDashboardSkeleton = React.memo(function CommunityDashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="rounded-2xl bg-idm-gold-warm/5 border border-idm-gold-warm/10 p-8">
        <Skeleton className="h-6 w-20 rounded-full mb-4" />
        <Skeleton className="h-9 w-48 mb-2" />
        <Skeleton className="h-5 w-36 mb-4" />
        <div className="flex gap-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-idm-gold-warm/10 bg-idm-gold-warm/5 p-4">
            <div className="flex justify-between mb-3">
              <Skeleton className="w-9 h-9 rounded-2xl" />
              <Skeleton className="w-14 h-5" />
            </div>
            <Skeleton className="h-7 w-16 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-idm-gold-warm/10 bg-idm-gold-warm/5 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Skeleton className="w-10 h-10 rounded-2xl" />
              <Skeleton className="h-5 w-28" />
            </div>
            <Skeleton className="h-8 w-full rounded-lg mb-2" />
            <Skeleton className="h-8 w-full rounded-lg mb-2" />
            <Skeleton className="h-8 w-full rounded-lg mb-3" />
            <div className="flex justify-end"><Skeleton className="h-9 w-28 rounded-2xl" /></div>
          </div>
        ))}
      </div>
    </div>
  );
});





export function CommunityDashboard() {
  // Pusher real-time: already subscribed in AppShell (usePusherRealtime)
  // No duplicate subscription here to avoid double WebSocket connections

  // Selected player for profile modal
  const [selectedPlayer, setSelectedPlayer] = useState<(TopPlayer & { division?: string }) | null>(null);
  // Selected club for profile modal
  const [selectedClub, setSelectedClub] = useState<StatsData['clubs'][0] | null>(null);
  // Donation modal state
  const [donationOpen, setDonationOpen] = useState(false);
  // Registration modal state
  const [registrationOpen, setRegistrationOpen] = useState(false);
  // Payment modal state
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentDivision, setPaymentDivision] = useState<'male' | 'female'>('male');
  // Division filter — new state for division-specific content
  const [selectedDivision, setSelectedDivision] = useState<DivisionFilter>('all');
  // Peringkat leaderboard filter state — lifted from CommunityLeaderboard for sticky header
  const [leaderboardSort, setLeaderboardSort] = useState<'players' | 'clubs'>('players');
  const [leaderboardDivisionFilter, setLeaderboardDivisionFilter] = useState<'all' | 'male' | 'female'>('all');


  // Track if rankings section is visible — hide sticky champion header when it is
  const [isRankingsVisible, setIsRankingsVisible] = useState(false);
  useEffect(() => {
    const el = document.getElementById('section-rankings');
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsRankingsVisible(entry.isIntersecting),
      { threshold: 0, rootMargin: '-60px 0px 0px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  // Peringkat is no longer sticky — no need for intersection observer
  // Season selector — null means viewing the active season
  const [selectedSeason, setSelectedSeason] = useState<SelectedSeason | null>(null);

  // Derive effective division for division-specific queries
  const effectiveDivision: 'male' | 'female' = selectedDivision === 'female' ? 'female' : 'male';


  // Whether we're viewing a completed/past season
  const isViewingPastSeason = selectedSeason !== null && selectedSeason.status === 'completed';

  // When division changes while viewing a past season, reset to active season
  const handleDivisionChange = useCallback((d: DivisionFilter) => {
    startTransition(() => {
      setSelectedDivision(d);
      if (selectedSeason) {
        setSelectedSeason(null);
      }
    });
  }, [selectedSeason]);

  // Handle season change
  const handleSeasonChange = useCallback((season: SelectedSeason | null) => {
    startTransition(() => {
      setSelectedSeason(season);
      if (season && season.division !== effectiveDivision) {
        setSelectedDivision(season.division);
      }
    });
  }, [effectiveDivision]);



  // CMS settings for donation modal
  const { data: cms } = useQuery<Record<string, string>>({
    queryKey: ['cms-content'],
    queryFn: async () => {
      const res = await fetch('/api/cms/content');
      if (!res.ok) return { settings: {}, sections: {} };
      return res.json();
    },
    select: (data) => data.settings || {},
  });

  // Fetch male stats — placeholderData prevents CLS from empty→filled layout shift
  const { data: maleData } = useQuery<StatsData>({
    queryKey: ['stats', 'male'],
    queryFn: async () => {
      const res = await fetch('/api/stats?division=male');
      return res.json();
    },
    staleTime: 60 * 1000,
    refetchInterval: 300 * 1000,
    refetchIntervalInBackground: false,
    placeholderData: (prev) => prev,
    notifyOnChangeProps: ['data', 'error'],
  });

  // Fetch female stats
  const { data: femaleData } = useQuery<StatsData>({
    queryKey: ['stats', 'female'],
    queryFn: async () => {
      const res = await fetch('/api/stats?division=female');
      return res.json();
    },
    staleTime: 60 * 1000,
    refetchInterval: 300 * 1000,
    refetchIntervalInBackground: false,
    placeholderData: (prev) => prev,
    notifyOnChangeProps: ['data', 'error'],
  });

  // REMOVED: leagueData query — Liga IDM is not used in Tarkam

  // Player click handler
  const handlePlayerClick = useCallback((player: TopPlayer & { division?: string }, division: 'male' | 'female') => {
    setSelectedPlayer({
      ...player,
      division,
      club: clubToString(player.club as Parameters<typeof clubToString>[0]) || undefined,
    });
  }, []);

  // Modal handlers
  const handleDonate = useCallback(() => setDonationOpen(true), []);
  const handleRegister = useCallback(() => setRegistrationOpen(true), []);
  const handlePayment = useCallback((div: 'male' | 'female') => {
    setPaymentDivision(div);
    setPaymentOpen(true);
  }, []);
  const handleClosePlayer = useCallback(() => setSelectedPlayer(null), []);
  const handleCloseClub = useCallback(() => setSelectedClub(null), []);
  const handleClubClick = useCallback((club: StatsData['clubs'][0]) => setSelectedClub(club), []);
  const handleBackToActive = useCallback(() => setSelectedSeason(null), []);

  // Listen for deep-link club open events (from ?view=club&name=XXX URL param)
  useEffect(() => {
    const handler = (e: Event) => {
      const { name } = (e as CustomEvent).detail || {};
      if (!name) return;
      // Find club in already-loaded data
      const allClubs = [
        ...(maleData?.clubs || []),
        ...(femaleData?.clubs || []),
      ];
      const club = allClubs.find(c => c.name.toLowerCase() === name.toLowerCase());
      if (club) setSelectedClub(club);
    };
    window.addEventListener('tarkam:open-club', handler);
    return () => window.removeEventListener('tarkam:open-club', handler);
  }, [maleData, femaleData]);

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">

      {/* ═══ UNIFIED CONTENT SURFACE ═══
          Mobile: Full-bleed, no border-radius, no border — edge-to-edge like iOS apps
          Desktop: Premium elevated surface with rounded corners and border */}
      <div className="lg:community-surface lg:rounded-3xl lg:border lg:border-border/30 relative" style={{ overflow: 'clip' }}>
        {/* Subtle navy depth glow at top — dark canvas, no gold wash (desktop only) */}
        <div className="hidden lg:block absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-48 bg-slate-800/[0.08] rounded-full blur-3xl pointer-events-none" />

        <div className="relative">
          {/* Subtle atmospheric gradient */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'radial-gradient(ellipse at 30% 10%, rgba(239,249,35,0.03) 0%, transparent 50%), radial-gradient(ellipse at 70% 90%, rgba(239,249,35,0.02) 0%, transparent 50%)'
          }} />
          <div className="relative z-10 p-1.5 sm:p-4 lg:p-5 space-y-4 sm:space-y-6 lg:space-y-8">

      {/* Context Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-idm-gold-warm/10 flex items-center justify-center shrink-0">
          <Users className="w-4 h-4 text-idm-gold-warm" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-idm-gold-warm">Komunitas</h2>
          <p className="text-[10px] text-muted-foreground/60">Dashboard turnamen & statistik</p>
        </div>
      </div>

      {/* ═══ 1. Hero — top of unified surface ═══ */}
      <Section sectionId="hero">
        <CommunityHero maleData={maleData} femaleData={femaleData} onSawer={handleDonate} onRegister={handleRegister} onPayment={handlePayment} />
      </Section>

      {/* ═══ Marquee Ticker — Live activity feed (full-bleed within surface) ═══ */}
      <div className="relative z-40 -mx-2 sm:-mx-4 lg:-mx-5 py-2.5 bg-background/90 border-y border-idm-gold-warm/10" style={{ contain: 'layout style' }}>
        <MarqueeTicker maleData={maleData} femaleData={femaleData} />
      </div>

      {/* ═══ Live Match Scoreboard — prominently after marquee ═══ */}
      <Section sectionId="live-scoreboard">
        <LiveMatchScoreboard />
      </Section>

      {/* Sponsor Banner */}
      <SponsorBanner placement="dashboard" className="flex items-center justify-center gap-4 flex-wrap" />

      {/* ═══ 3. Hasil Pertandingan — Bracket-style match results ═══ */}
      <Section sectionId="matches">
        <LazySection placeholderHeight={500}>
          <AnimatedSection variant="fadeUp">
            <BracketHasilSection maleData={maleData} femaleData={femaleData} />
          </AnimatedSection>
        </LazySection>
      </Section>

      {/* ═══ 4. Top Saweran ═══ */}
      <Section sectionId="saweran">
        <LazySection placeholderHeight={400}>
          <TopDonorsWidget onDonate={handleDonate} statsData={selectedDivision === 'female' ? femaleData : maleData} statsData2={selectedDivision === 'female' ? maleData : femaleData} />
        </LazySection>
      </Section>

      {/* ═══ 4. Season Selector ═══ */}
      <Section sectionId="season-selector">
        <div className="flex items-center gap-2">
          <div className="ml-auto shrink-0">
            <SeasonSelector
              selectedSeason={selectedSeason}
              onSeasonChange={handleSeasonChange}
              selectedDivision={selectedDivision}
            />
          </div>
        </div>
      </Section>

      {/* ═══ HISTORICAL SEASON VIEW ═══ */}
      {isViewingPastSeason && selectedSeason ? (
        <HistoricalSeasonView
          season={selectedSeason}
          onBack={handleBackToActive}
        />
      ) : (
      <>

      {/* ═══ 4. ⭐ Champions & MVP + Peringkat ═══ */}
      <div className="space-y-4 sm:space-y-6">
        {/* Sticky Champion Header — hidden when rankings section is in view */}
        <div className={`sticky top-0 z-30 -mx-1.5 sm:-mx-4 lg:-mx-5 px-1.5 sm:px-4 lg:px-5 py-2.5 bg-background/95 sm:backdrop-blur-md border-b border-idm-gold-warm/10 transition-all duration-300 ${isRankingsVisible ? 'opacity-0 pointer-events-none -translate-y-full' : 'opacity-100 translate-y-0'}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Crown className="w-4 h-4 text-idm-gold-warm/70" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-idm-gold-warm/80">Champion</h3>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-lg bg-idm-gold-warm/5 border border-idm-gold-warm/10">
              {(['all', 'male', 'female'] as const).map(d => (
                <button key={d} onClick={() => handleDivisionChange(d)} className={`compact-pill px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${selectedDivision === d ? 'bg-idm-gold-warm/15 text-idm-gold-warm shadow-sm border border-idm-gold-warm/25' : 'text-muted-foreground/70 border border-transparent hover:bg-muted/40'}`}>{d === 'all' ? 'Semua' : d === 'male' ? 'Cowo' : 'Cewe'}</button>
              ))}
            </div>
          </div>
        </div>

        <Section sectionId="champions">
          <LazySection placeholderHeight={600}>
            <AnimatedSection>
              <MvpHallOfFame
                maleData={maleData}
                femaleData={femaleData}
                selectedDivision={selectedDivision}
              />
            </AnimatedSection>
          </LazySection>
        </Section>

        {/* ═══ 6. Peringkat/Standings — People check ranking changes after match ═══ */}
        <Section sectionId="rankings">
          <LazySection placeholderHeight={500}>
          <AnimatedSection variant="fadeUp">
            <div className="space-y-4">
              <PeringkatHeader
                leaderboardSort={leaderboardSort}
                onLeaderboardSortChange={(sort) => startTransition(() => setLeaderboardSort(sort))}
                divisionFilter={leaderboardDivisionFilter}
                onDivisionFilterChange={(filter) => startTransition(() => setLeaderboardDivisionFilter(filter))}
                maleData={maleData}
                femaleData={femaleData}
              />
              <DivisionStandingsSection
                maleData={maleData}
                femaleData={femaleData}
                selectedDivision={selectedDivision}
                onPlayerClick={handlePlayerClick}
                onClubClick={handleClubClick}
                leaderboardSort={leaderboardSort}
                onLeaderboardSortChange={(sort) => startTransition(() => setLeaderboardSort(sort))}
                divisionFilter={leaderboardDivisionFilter}
                onDivisionFilterChange={(filter) => startTransition(() => setLeaderboardDivisionFilter(filter))}
              />
            </div>
          </AnimatedSection>
          </LazySection>
        </Section>
      </div>

      {/* ═══ 7. Quick Stats Bar — Division-specific (when division selected) ═══ */}
      {selectedDivision !== 'all' && (
        <Section sectionId="quick-stats">
          {(effectiveDivision === 'male' ? maleData : femaleData) ? (
            <QuickStatsBar data={(effectiveDivision === 'male' ? maleData : femaleData)!} division={effectiveDivision} />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ═══ End Active Season View ═══ */}
      </>
      )}

        </div>{/* /unified content inner */}
        </div>{/* /atmospheric wrapper */}
      </div>{/* /unified content surface */}

      {/* ═══ Donation Modal ═══ */}
      <DonationModal
        open={donationOpen}
        onOpenChange={setDonationOpen}
        defaultType="weekly"
        cmsSettings={cms || {}}
      />

      {/* ═══ Registration Modal ═══ */}
      <RegistrationModal
        open={registrationOpen}
        onClose={() => setRegistrationOpen(false)}
      />

      {/* ═══ Payment Modal ═══ */}
      <PaymentModal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        division={paymentDivision}
      />

      {/* Player & Club Profile Modals */}
      {selectedPlayer && (
        <PlayerProfile
          player={selectedPlayer}
          onClose={handleClosePlayer}
          rank={((selectedPlayer.division === 'female' ? femaleData : maleData)?.topPlayers?.findIndex(p => p.id === selectedPlayer.id) ?? -1) + 1}
          skinMap={(selectedPlayer.division === 'female' ? femaleData : maleData)?.skinMap}
        />
      )}
      {selectedClub && (
        <ClubProfile
          club={selectedClub}
          onClose={handleCloseClub}
          onPlayerClick={(p) => {
            setSelectedPlayer({
              id: p.id,
              name: p.name || p.gamertag,
              gamertag: p.gamertag,
              avatar: p.avatar,
              tier: p.tier || 'C',
              points: p.points,
              totalWins: 0,
              totalMvp: 0,
              streak: 0,
              maxStreak: 0,
              matches: 0,
              division: p.division,
              city: p.city,
            });
            setSelectedClub(null);
          }}
        />
      )}
    </div>
  );
}
