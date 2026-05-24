'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Trophy, Swords, ChevronRight, ChevronDown,
  Gamepad2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AnimatedSection, SectionHeader } from './shared';
import { useAppStore } from '@/lib/store';

/* ─── Types ─── */
interface WeekResult {
  weekNumber: number;
  tournamentName: string;
  tournamentStatus: string;
  hasTournament: boolean;
  tournamentMatches: Array<{
    id: string;
    round: number;
    bracket: string;
    score1: number | null;
    score2: number | null;
    format: string;
    team1: { id: string; name: string } | null;
    team2: { id: string; name: string } | null;
    mvpPlayer: { id: string; gamertag: string } | null;
  }>;
  leagueMatches: Array<{
    id: string;
    week: number;
    score1: number | null;
    score2: number | null;
    format: string;
    club1: { id: string; name: string; logo: string | null };
    club2: { id: string; name: string; logo: string | null };
  }>;
}

interface SeasonResultsData {
  season: {
    id: string;
    name: string;
    number: number;
    status: string;
  };
  weeks: WeekResult[];
}

/* ─── Division config ─── */
const DIVISION_STYLE = {
  male: {
    color: '#2E9FFF',
    bg: 'bg-idm-male/10',
    text: 'text-idm-male',
    borderSubtle: 'border-idm-male/10',
    bgSubtle: 'bg-idm-male/5',
    hoverBorder: 'hover:border-idm-male/20',
    label: '🕺 Cowo',
    emoji: '🕺',
  },
  female: {
    color: '#FF2D78',
    bg: 'bg-idm-female/10',
    text: 'text-idm-female',
    borderSubtle: 'border-idm-female/10',
    bgSubtle: 'bg-idm-female/5',
    hoverBorder: 'hover:border-idm-female/20',
    label: '💃 Cewe',
    emoji: '💃',
  },
} as const;

type DivisionStyle = (typeof DIVISION_STYLE)[keyof typeof DIVISION_STYLE];

/* ─── Bracket/Round label helper ─── */
function getRoundLabel(bracket: string, round: number): string {
  switch (bracket) {
    case 'grand_final':
      return '🏆 Grand Final';
    case 'upper':
      if (round === 1) return 'Final';
      if (round === 2) return 'Semi Final';
      if (round === 3) return 'Quarter Final';
      return `R${round}`;
    case 'lower':
      if (round === 1) return 'Lower Final';
      if (round === 2) return 'Lower Semi';
      return `Lower R${round}`;
    case 'swiss':
      return `Swiss R${round}`;
    case 'group':
      return `Group R${round}`;
    default:
      return `R${round}`;
  }
}

function getRoundSortKey(bracket: string, round: number): number {
  switch (bracket) {
    case 'upper': return round * 10;
    case 'lower': return 100 + round * 10;
    case 'grand_final': return 999;
    default: return 500 + round * 10;
  }
}

/* ─── Helper: find index of last week with results ─── */
function lastResultIdx(weeks: WeekResult[]): number {
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (weeks[i].tournamentMatches.length > 0 || weeks[i].leagueMatches.length > 0) return i;
  }
  return -1;
}

/* ─── Max weeks shown on beranda ─── */
const BERANDA_WEEKS_LIMIT = 3;

/* ─── Match Row — Tournament (2-line) — Enhanced ─── */
function TournamentMatchRow({ m, divStyle }: { m: WeekResult['tournamentMatches'][0]; divStyle: DivisionStyle }) {
  const winner1 = m.score1 != null && m.score2 != null && m.score1 > m.score2;
  const winner2 = m.score1 != null && m.score2 != null && m.score2 > m.score1;
  const isGrandFinal = m.bracket === 'grand_final';

  if (isGrandFinal) {
    return (
      <div className="group flex items-stretch rounded-lg overflow-hidden border bg-idm-gold-warm/5 border-idm-gold-warm/20 transition-all hover:shadow-[0_0_12px_rgba(239,249,35,0.08)] hover:border-idm-gold-warm/35">
        <div className="w-9 shrink-0 flex items-center justify-center bg-idm-gold-warm/15 border-r border-idm-gold-warm/20">
          <span className="text-sm">🏆</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className={`flex items-center px-3 py-2 border-b border-idm-gold-warm/10 ${winner1 ? 'bg-idm-gold-warm/10' : 'opacity-60'}`}>
            {winner1 && <span className="text-xs mr-1.5">👑</span>}
            <span className={`text-sm font-bold truncate flex-1 ${winner1 ? 'text-idm-gold-warm' : 'text-muted-foreground'}`}>
              {m.team1?.name || 'TBD'}
            </span>
            <span className={`text-sm font-black tabular-nums w-6 text-right ${winner1 ? 'text-green-400' : 'text-foreground'}`}>{m.score1 ?? '-'}</span>
          </div>
          <div className={`flex items-center px-3 py-2 ${winner2 ? 'bg-idm-gold-warm/10' : 'opacity-60'}`}>
            {winner2 && <span className="text-xs mr-1.5">👑</span>}
            <span className={`text-sm font-bold truncate flex-1 ${winner2 ? 'text-idm-gold-warm' : 'text-muted-foreground'}`}>
              {m.team2?.name || 'TBD'}
            </span>
            <span className={`text-sm font-black tabular-nums w-6 text-right ${winner2 ? 'text-green-400' : 'text-foreground'}`}>{m.score2 ?? '-'}</span>
          </div>
        </div>
        <div className="w-14 shrink-0 flex flex-col items-center justify-center border-l border-idm-gold-warm/15">
          <Badge className="bg-idm-gold-warm/15 text-idm-gold-warm text-[9px] border border-idm-gold-warm/25 font-black">FT</Badge>
          {m.mvpPlayer && (
            <span className="text-[9px] text-idm-gold-warm mt-0.5 flex items-center gap-0.5" title={`MVP: ${m.mvpPlayer.gamertag}`}>
              ⭐ <span className="truncate max-w-[40px]">{m.mvpPlayer.gamertag}</span>
            </span>
          )}
        </div>
      </div>
    );
  }

  // Regular match row — enhanced with win/loss colors and VS indicator
  return (
    <div className={`group flex items-stretch rounded-lg overflow-hidden ${divStyle.bgSubtle} ${divStyle.borderSubtle} border transition-all ${divStyle.hoverBorder} hover:shadow-sm hover:scale-[1.01] active:scale-[0.995]`}>
      <div className="flex-1 min-w-0">
        <div className={`flex items-center px-3 py-1.5 border-b ${divStyle.borderSubtle} ${winner1 ? '' : 'opacity-60'}`}>
          <span className={`text-sm font-semibold truncate flex-1 ${winner1 ? 'text-green-400' : 'text-muted-foreground'}`}>
            {winner1 && <span className="mr-1">▸</span>}
            {m.team1?.name || 'TBD'}
          </span>
          <span className={`text-sm font-bold tabular-nums w-6 text-right ${winner1 ? 'text-green-400' : winner2 ? 'text-red-400/60' : 'text-foreground'}`}>
            {m.score1 ?? '-'}
          </span>
        </div>
        <div className={`flex items-center px-3 py-1.5 ${winner2 ? '' : 'opacity-60'}`}>
          <span className={`text-sm font-semibold truncate flex-1 ${winner2 ? 'text-green-400' : 'text-muted-foreground'}`}>
            {winner2 && <span className="mr-1">▸</span>}
            {m.team2?.name || 'TBD'}
          </span>
          <span className={`text-sm font-bold tabular-nums w-6 text-right ${winner2 ? 'text-green-400' : winner1 ? 'text-red-400/60' : 'text-foreground'}`}>
            {m.score2 ?? '-'}
          </span>
        </div>
      </div>
      {/* VS / FT indicator */}
      <div className="w-12 shrink-0 flex flex-col items-center justify-center border-l border-idm-gold-warm/10">
        {m.score1 != null && m.score2 != null ? (
          <Badge className="bg-green-500/10 text-green-500 text-[9px] border-0">FT</Badge>
        ) : (
          <span className="text-[9px] font-black text-muted-foreground/40">VS</span>
        )}
        {m.mvpPlayer && (
          <span className="text-[8px] text-idm-gold-warm mt-0.5 flex items-center gap-0.5" title={`MVP: ${m.mvpPlayer.gamertag}`}>
            ⭐ <span className="truncate max-w-[32px]">{m.mvpPlayer.gamertag}</span>
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Match Row — League (2-line) ─── */
function LeagueMatchRow({ m, divStyle }: { m: WeekResult['leagueMatches'][0]; divStyle: DivisionStyle }) {
  const winner1 = m.score1 != null && m.score2 != null && m.score1 > m.score2;
  const winner2 = m.score1 != null && m.score2 != null && m.score2 > m.score1;

  return (
    <div className={`group flex items-stretch rounded-lg overflow-hidden ${divStyle.bgSubtle} ${divStyle.borderSubtle} border transition-all ${divStyle.hoverBorder} hover:shadow-sm hover:scale-[1.01] active:scale-[0.995]`}>
      <div className="flex-1 min-w-0">
        <div className={`flex items-center px-3 py-1.5 border-b ${divStyle.borderSubtle} ${winner1 ? '' : 'opacity-60'}`}>
          <span className={`text-sm font-semibold truncate flex-1 ${winner1 ? 'text-idm-gold-warm' : 'text-muted-foreground'}`}>
            {winner1 && <span className="mr-1">▸</span>}
            {m.club1.name}
          </span>
          <span className={`text-sm font-bold tabular-nums w-6 text-right ${winner1 ? 'text-idm-gold-warm' : 'text-foreground'}`}>
            {m.score1 ?? '-'}
          </span>
        </div>
        <div className={`flex items-center px-3 py-1.5 ${winner2 ? '' : 'opacity-60'}`}>
          <span className={`text-sm font-semibold truncate flex-1 ${winner2 ? 'text-idm-gold-warm' : 'text-muted-foreground'}`}>
            {winner2 && <span className="mr-1">▸</span>}
            {m.club2.name}
          </span>
          <span className={`text-sm font-bold tabular-nums w-6 text-right ${winner2 ? 'text-idm-gold-warm' : 'text-foreground'}`}>
            {m.score2 ?? '-'}
          </span>
        </div>
      </div>
      <div className="w-12 shrink-0 flex items-center justify-center border-l border-idm-gold-warm/10">
        <Badge className="bg-muted/20 text-muted-foreground text-[9px] border-0">Liga</Badge>
      </div>
    </div>
  );
}

/* ─── Week Card — grouped results for one week ─── */
function WeekCard({ week, divStyle, defaultExpanded }: { week: WeekResult; divStyle: DivisionStyle; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const totalMatches = week.tournamentMatches.length + week.leagueMatches.length;

  // Group tournament matches by bracket/round
  const groupedTournamentMatches = useMemo(() => {
    const groups: Record<string, WeekResult['tournamentMatches']> = {};
    for (const m of week.tournamentMatches) {
      const key = `${m.bracket}-${m.round}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    }
    const sorted = Object.entries(groups).sort(([, a], [, b]) => {
      const mA = a[0];
      const mB = b[0];
      return getRoundSortKey(mA.bracket, mA.round) - getRoundSortKey(mB.bracket, mB.round);
    });
    return sorted;
  }, [week.tournamentMatches]);

  // Find the champion (Grand Final winner)
  const grandFinalMatch = week.tournamentMatches.find(m => m.bracket === 'grand_final');
  const championTeam = grandFinalMatch
    ? (grandFinalMatch.score1 != null && grandFinalMatch.score2 != null
        ? (grandFinalMatch.score1 > grandFinalMatch.score2 ? grandFinalMatch.team1 : grandFinalMatch.team2)
        : null)
    : null;

  const isCompleted = week.tournamentStatus === 'completed';

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.005] ${
      expanded
        ? 'border-border/50 bg-card/60 backdrop-blur-md shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:border-idm-gold-warm/15'
        : 'border-border/30 bg-card/40 hover:border-border/50'
    }`}>
      {/* Top accent line */}
      <div className="h-[2px]" style={{ background: `linear-gradient(90deg, transparent 5%, ${divStyle.color} 30%, ${divStyle.color} 70%, transparent 95%)` }} />

      {/* Week header — clickable to expand/collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/5 transition-colors"
      >
        <div className={`w-8 h-8 rounded-lg ${divStyle.bg} flex items-center justify-center shrink-0`}>
          <Gamepad2 className={`w-4 h-4 ${divStyle.text}`} />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-extrabold ${divStyle.text}`}>Week {week.weekNumber}</span>
            {isCompleted && (
              <Badge className="bg-green-500/10 text-green-500 text-[8px] border-0 px-1.5 py-0">Selesai</Badge>
            )}
          </div>
          {/* Champion or match count summary */}
          {championTeam ? (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              👑 <span className="font-semibold text-idm-gold-warm">{championTeam.name}</span>
              <span className="text-muted-foreground/50">·</span>
              {totalMatches} match
            </p>
          ) : totalMatches > 0 ? (
            <p className="text-[11px] text-muted-foreground">{totalMatches} match dimainkan</p>
          ) : (
            <p className="text-[11px] text-muted-foreground/50">Belum ada hasil</p>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <Badge className={`${divStyle.bg} ${divStyle.text} text-[9px] border-0`}>{totalMatches}</Badge>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Expanded content */}
      {expanded && totalMatches > 0 && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/10 pt-3">
          {/* Tournament matches grouped by round */}
          {groupedTournamentMatches.map(([key, matches]) => {
            const firstMatch = matches[0];
            const roundLabel = getRoundLabel(firstMatch.bracket, firstMatch.round);
            const isGrandFinal = firstMatch.bracket === 'grand_final';

            return (
              <div key={key}>
                {/* Round header */}
                <div className="flex items-center gap-3 mb-2">
                  <div className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
                    isGrandFinal
                      ? 'bg-idm-gold-warm/15 text-idm-gold-warm'
                      : `${divStyle.bg} ${divStyle.text}`
                  }`}>
                    {roundLabel}
                  </div>
                  <div className={`flex-1 h-px ${divStyle.borderSubtle}`} />
                  <span className="text-[10px] text-muted-foreground">{matches.length} match</span>
                </div>
                {/* Match rows */}
                <div className="space-y-1.5">
                  {matches.map(m => (
                    <TournamentMatchRow key={m.id} m={m} divStyle={divStyle} />
                  ))}
                </div>
              </div>
            );
          })}

          {/* League matches */}
          {week.leagueMatches.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="px-2 py-0.5 rounded-md bg-muted/20 text-muted-foreground text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                  Liga
                </div>
                <div className={`flex-1 h-px ${divStyle.borderSubtle}`} />
                <span className="text-[10px] text-muted-foreground">{week.leagueMatches.length} match</span>
              </div>
              <div className="space-y-1.5">
                {week.leagueMatches.map(m => (
                  <LeagueMatchRow key={m.id} m={m} divStyle={divStyle} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Ghost Week Card — empty state (Enhanced) ─── */
function GhostWeekCard({ divStyle }: { divStyle: DivisionStyle }) {
  return (
    <div className="border border-border/20 rounded-2xl overflow-hidden bg-card/30 opacity-40">
      <div className="h-[2px]" style={{ background: `linear-gradient(90deg, transparent 5%, ${divStyle.color} 30%, ${divStyle.color} 70%, transparent 95%)` }} />
      <div className="flex flex-col items-center justify-center py-8 px-4">
        <div className={`w-12 h-12 rounded-xl ${divStyle.bg} flex items-center justify-center mb-3`}>
          <Swords className={`w-5 h-5 ${divStyle.text} opacity-50`} />
        </div>
        <p className={`text-sm font-bold ${divStyle.text} opacity-50`}>Belum ada hasil</p>
        <p className="text-[11px] text-muted-foreground/40 mt-1">Hasil pertandingan akan muncul setelah selesai</p>
      </div>
    </div>
  );
}

/* ─── Beranda highlight filter: only Semi Final + Grand Final ─── */
function filterHighlightMatches(matches: WeekResult['tournamentMatches']) {
  return matches.filter(m =>
    m.bracket === 'grand_final' ||
    (m.bracket === 'upper' && m.round === 2)  // Semi Final
  );
}

/* ─── Week List (beranda: last 3 weeks, highlight rounds only) ─── */
function WeekList({ weeks, divStyle }: { weeks: WeekResult[]; divStyle: DivisionStyle }) {
  // Reverse so newest week is at the top + filter to highlight matches only
  const reversedWeeks = useMemo(() =>
    [...weeks].reverse().map(w => ({
      ...w,
      tournamentMatches: filterHighlightMatches(w.tournamentMatches),
      // Keep leagueMatches empty for beranda summary — full detail in Bracket > Hasil
      leagueMatches: [],
    })),
    [weeks]
  );
  const expandIdx = lastResultIdx(reversedWeeks);

  // Only show last 3 weeks on beranda — full history in Bracket > Hasil
  const visibleWeeks = reversedWeeks.slice(0, BERANDA_WEEKS_LIMIT);

  return (
    <div className="space-y-3">
      {visibleWeeks.map((w, idx) => (
        <WeekCard key={w.weekNumber} week={w} divStyle={divStyle} defaultExpanded={idx === expandIdx} />
      ))}
    </div>
  );
}

/* ─── Main Component ─── */
export function HasilSection({ maleData, femaleData, isDataLoading }: {
  maleData: any;
  femaleData: any;
  isDataLoading: boolean;
}) {
  const setCurrentView = useAppStore(s => s.setCurrentView);

  // Fetch season results for both divisions
  const { data: maleResults, isLoading: maleLoading } = useQuery({
    queryKey: ['season-results', 'male'],
    queryFn: async () => {
      const res = await fetch('/api/season-results?division=male');
      if (!res.ok) return { season: { id: '', name: '', number: 0, status: '' }, weeks: [] } as SeasonResultsData;
      return res.json() as Promise<SeasonResultsData>;
    },
    staleTime: 30000,
  });

  const { data: femaleResults, isLoading: femaleLoading } = useQuery({
    queryKey: ['season-results', 'female'],
    queryFn: async () => {
      const res = await fetch('/api/season-results?division=female');
      if (!res.ok) return { season: { id: '', name: '', number: 0, status: '' }, weeks: [] } as SeasonResultsData;
      return res.json() as Promise<SeasonResultsData>;
    },
    staleTime: 30000,
  });

  const maleWeeks = maleResults?.weeks || [];
  const femaleWeeks = femaleResults?.weeks || [];
  const hasMaleResults = maleWeeks.some(w => w.tournamentMatches.length > 0 || w.leagueMatches.length > 0);
  const hasFemaleResults = femaleWeeks.some(w => w.tournamentMatches.length > 0 || w.leagueMatches.length > 0);
  const hasAnyResults = hasMaleResults || hasFemaleResults;
  const isLoadingResults = maleLoading || femaleLoading;

  return (
    <section
      id="hasil"
      role="region"
      aria-label="Hasil"
      className="landing-section relative py-6 sm:py-12 px-4 sm:px-6 lg:px-8 overflow-hidden bg-deep border-t border-border/10 dark:border-t-0"
    >
      {/* Background decorations */}
      <div className="absolute inset-0 opacity-[0.018]" style={{ backgroundImage: 'radial-gradient(circle, rgba(239,249,35,0.5) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(239,249,35,0.05) 0%, transparent 50%), radial-gradient(ellipse at 20% 70%, rgba(46,159,255,0.03) 0%, transparent 40%), radial-gradient(ellipse at 80% 70%, rgba(255,45,120,0.03) 0%, transparent 40%)' }} />
      {/* Top edge glow */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-idm-gold-warm/30 to-transparent" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-idm-gold-warm/[2.5] to-transparent pointer-events-none" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Section Header */}
        <AnimatedSection>
          <SectionHeader
            icon={Trophy}
            label="Hasil"
            title="Hasil Pertandingan"
            subtitle="Hasil pertandingan tarkam setiap minggu — bracket, skor & MVP"
          />
        </AnimatedSection>

        {/* Section Title Row */}
        <div className="stagger-item-fast flex items-center gap-2.5 mb-6">
          <div className="w-5 h-5 rounded bg-idm-gold-warm/10 flex items-center justify-center shrink-0">
            <Trophy className="w-3 h-3 text-idm-gold-warm" />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-wider" style={{
            background: 'linear-gradient(135deg, #FAF0DC 0%, #EFF923 30%, #F9CB25 50%, #F9CB25 70%, #EFF923 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>Hasil Pertandingan</h3>
        </div>

        {/* Content */}
        {isLoadingResults || isDataLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2].map(i => (
              <div key={i} className="h-48 rounded-2xl border border-border/30 bg-card/40 animate-pulse" />
            ))}
          </div>
        ) : !hasAnyResults ? (
          /* Empty state — Enhanced */
          <AnimatedSection variant="fadeUp">
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-idm-gold-warm/5 border border-idm-gold-warm/10 flex items-center justify-center mx-auto mb-4 relative">
                {/* Subtle glow behind icon */}
                <div className="absolute -inset-3 rounded-3xl" style={{ background: 'radial-gradient(circle, rgba(239,249,35,0.06) 0%, transparent 70%)' }} aria-hidden="true" />
                <Trophy className="relative w-8 h-8 text-idm-gold-warm/30" />
              </div>
              <p className="text-sm font-semibold text-muted-foreground mb-1">Belum Ada Hasil Pertandingan</p>
              <p className="text-xs text-muted-foreground/60 max-w-xs mx-auto">Hasil match akan muncul setelah pertandingan selesai. Cek kembali nanti!</p>
            </div>
          </AnimatedSection>
        ) : (
          <div className="space-y-4">
            {/* Both divisions side by side on desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Male column */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">{DIVISION_STYLE.male.emoji}</span>
                  <span className={`text-xs font-bold ${DIVISION_STYLE.male.text}`}>Cowo</span>
                  <Badge className={`${DIVISION_STYLE.male.bg} ${DIVISION_STYLE.male.text} text-[8px] border-0`}>{maleWeeks.filter(w => w.tournamentMatches.length > 0).length} Minggu</Badge>
                </div>
                {hasMaleResults ? (
                  <WeekList weeks={maleWeeks} divStyle={DIVISION_STYLE.male} />
                ) : (
                  <GhostWeekCard divStyle={DIVISION_STYLE.male} />
                )}
              </div>
              {/* Female column */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">{DIVISION_STYLE.female.emoji}</span>
                  <span className={`text-xs font-bold ${DIVISION_STYLE.female.text}`}>Cewe</span>
                  <Badge className={`${DIVISION_STYLE.female.bg} ${DIVISION_STYLE.female.text} text-[8px] border-0`}>{femaleWeeks.filter(w => w.tournamentMatches.length > 0).length} Minggu</Badge>
                </div>
                {hasFemaleResults ? (
                  <WeekList weeks={femaleWeeks} divStyle={DIVISION_STYLE.female} />
                ) : (
                  <GhostWeekCard divStyle={DIVISION_STYLE.female} />
                )}
              </div>
            </div>

            {/* CTA — Lihat Semua Hasil → Bracket > Hasil tab */}
            <div className="flex justify-center mt-5">
              <button
                onClick={() => {
                  setCurrentView('hasil');
                  setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
                }}
                className="compact-pill flex items-center gap-2 px-4 py-2 rounded-full bg-idm-gold-warm/[0.06] text-sm font-bold text-idm-gold-warm transition-all duration-300 hover:bg-idm-gold-warm/[0.12] hover:shadow-[0_0_16px_rgba(249,203,37,0.12)] cursor-pointer active:scale-[0.97]"
              >
                <span>VS</span>
                <span>Lihat Semua Hasil</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
