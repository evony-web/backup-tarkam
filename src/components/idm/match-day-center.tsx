'use client';

import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/lib/store';
// Note: motion.div removed — replaced with CSS animations
import {
  Trophy, Crown, Radio, Clock, Flame,
  Star, ChevronDown, Gamepad2, Swords,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShareButton } from './ui/share-button';
import {
  MatchDayHeroSkeleton,
  MatchRowSkeleton,
  StatsRowSkeleton,
} from './ui/skeleton';
import { useState, useMemo, useEffect } from 'react';
import { getDivisionTheme, type DivisionTheme } from '@/hooks/use-division-theme';
import { useCommunityTheme } from '@/hooks/use-community-theme';
import { formatCurrency, parseWitaDate, formatWIBWeekdayShort } from '@/lib/utils';
import type { StatsData } from '@/types/stats';
import { BracketView } from './bracket-view';
import { SponsorBanner, PresentedBy, SponsoredPrizes } from './ui/sponsor-banner';
// container/item removed — replaced with CSS stagger-item classes

/* ─── Season Results Types (shared with hasil-section) ─── */
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

/* ─── Bracket/Round label helpers ─── */
function getFullRoundLabel(bracket: string, round: number): string {
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

/* ─── Live Pulse Indicator ─── */
function LivePulse() {
  return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
      </span>
      <span className="text-[10px] font-black text-red-500 uppercase tracking-wider">Live</span>
    </div>
  );
}


/* ─── Section Card ─── */
function SectionCard({ title, icon: Icon, badge, children, className = '', theme }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  children: React.ReactNode;
  className?: string;
  theme?: DivisionTheme;
}) {
  const storeTheme = useCommunityTheme();
  const dt = theme ?? storeTheme;
  return (
    <Card className={`${dt.casinoCard} overflow-hidden ${className}`}>
      <div className={dt.casinoBar} />
      <CardContent className="p-0 relative z-10">
        <div className={`flex items-center gap-2.5 px-4 py-3 border-b ${dt.borderSubtle}`}>
          <div className={`w-5 h-5 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
            <Icon className={`w-3 h-3 ${dt.neonText}`} />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-wider">{title}</h3>
          {badge && <Badge className={`${dt.casinoBadge} ml-auto text-[10px]`}>{badge}</Badge>}
        </div>
        <div className="p-4">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════
   DETAILED MATCH ROWS — for Bracket > Hasil tab
   2-line rows with round grouping, MVP, champion
   ═══════════════════════════════════════════════ */

/* ─── Detailed Tournament Match Row (2-line) ─── */
function DetailTournamentMatchRow({ m, dt }: { m: WeekResult['tournamentMatches'][0]; dt: DivisionTheme }) {
  const winner1 = m.score1 != null && m.score2 != null && m.score1 > m.score2;
  const winner2 = m.score1 != null && m.score2 != null && m.score2 > m.score1;
  const isGrandFinal = m.bracket === 'grand_final';

  if (isGrandFinal) {
    return (
      <div className="group flex items-stretch rounded-lg overflow-hidden border bg-idm-gold-warm/5 border-idm-gold-warm/20 transition-all hover:shadow-sm hover:border-idm-gold-warm/35">
        <div className="w-9 shrink-0 flex items-center justify-center bg-idm-gold-warm/15 border-r border-idm-gold-warm/20">
          <span className="text-sm">🏆</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className={`flex items-center px-3 py-2 border-b border-idm-gold-warm/10 ${winner1 ? 'bg-idm-gold-warm/10' : 'opacity-60'}`}>
            {winner1 && <span className="text-xs mr-1">👑</span>}
            <span className={`text-sm font-bold truncate flex-1 ${winner1 ? 'text-idm-gold-warm' : 'text-muted-foreground'}`}>
              {m.team1?.name || 'TBD'}
            </span>
            <span className={`text-sm font-black tabular-nums w-6 text-right ${winner1 ? 'text-idm-gold-warm' : 'text-foreground'}`}>{m.score1 ?? '-'}</span>
          </div>
          <div className={`flex items-center px-3 py-2 ${winner2 ? 'bg-idm-gold-warm/10' : 'opacity-60'}`}>
            {winner2 && <span className="text-xs mr-1">👑</span>}
            <span className={`text-sm font-bold truncate flex-1 ${winner2 ? 'text-idm-gold-warm' : 'text-muted-foreground'}`}>
              {m.team2?.name || 'TBD'}
            </span>
            <span className={`text-sm font-black tabular-nums w-6 text-right ${winner2 ? 'text-idm-gold-warm' : 'text-foreground'}`}>{m.score2 ?? '-'}</span>
          </div>
        </div>
        <div className="w-14 shrink-0 flex flex-col items-center justify-center border-l border-idm-gold-warm/15">
          <Badge className="bg-green-500/10 text-green-500 text-[9px] border border-green-500/20 font-black">✓ FT</Badge>
          {m.mvpPlayer && (
            <span className="text-[9px] text-idm-gold-warm mt-0.5 flex items-center gap-0.5" title={`MVP: ${m.mvpPlayer.gamertag}`}>
              ⭐ <span className="truncate max-w-[40px]">{m.mvpPlayer.gamertag}</span>
            </span>
          )}
        </div>
      </div>
    );
  }

  // Regular match row
  return (
    <div className={`group flex items-stretch rounded-lg overflow-hidden ${dt.bgSubtle} ${dt.borderSubtle} border transition-all ${dt.hoverBorder} hover:shadow-sm`}>
      <div className="flex-1 min-w-0">
        <div className={`flex items-center px-3 py-1.5 border-b ${dt.borderSubtle} ${winner1 ? '' : 'opacity-60'}`}>
          <span className={`text-sm font-semibold truncate flex-1 ${winner1 ? dt.neonText : 'text-muted-foreground'}`}>
            {winner1 && <span className="mr-1">▸</span>}
            {m.team1?.name || 'TBD'}
          </span>
          <span className={`text-sm font-bold tabular-nums w-6 text-right ${winner1 ? dt.neonText : 'text-foreground'}`}>
            {m.score1 ?? '-'}
          </span>
        </div>
        <div className={`flex items-center px-3 py-1.5 ${winner2 ? '' : 'opacity-60'}`}>
          <span className={`text-sm font-semibold truncate flex-1 ${winner2 ? dt.neonText : 'text-muted-foreground'}`}>
            {winner2 && <span className="mr-1">▸</span>}
            {m.team2?.name || 'TBD'}
          </span>
          <span className={`text-sm font-bold tabular-nums w-6 text-right ${winner2 ? dt.neonText : 'text-foreground'}`}>
            {m.score2 ?? '-'}
          </span>
        </div>
      </div>
      <div className="w-12 shrink-0 flex flex-col items-center justify-center border-l border-idm-gold-warm/10">
        <Badge className="bg-green-500/10 text-green-500 text-[9px] border border-green-500/20 font-bold">✓ FT</Badge>
        {m.mvpPlayer && (
          <span className="text-[8px] text-idm-gold-warm mt-0.5 flex items-center gap-0.5" title={`MVP: ${m.mvpPlayer.gamertag}`}>
            ⭐ <span className="truncate max-w-[32px]">{m.mvpPlayer.gamertag}</span>
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Detailed League Match Row (2-line) ─── */
function DetailLeagueMatchRow({ m, dt }: { m: WeekResult['leagueMatches'][0]; dt: DivisionTheme }) {
  const winner1 = m.score1 != null && m.score2 != null && m.score1 > m.score2;
  const winner2 = m.score1 != null && m.score2 != null && m.score2 > m.score1;

  return (
    <div className={`group flex items-stretch rounded-lg overflow-hidden ${dt.bgSubtle} ${dt.borderSubtle} border transition-all ${dt.hoverBorder} hover:shadow-sm`}>
      <div className="flex-1 min-w-0">
        <div className={`flex items-center px-3 py-1.5 border-b ${dt.borderSubtle} ${winner1 ? '' : 'opacity-60'}`}>
          <span className={`text-sm font-semibold truncate flex-1 ${winner1 ? dt.neonText : 'text-muted-foreground'}`}>
            {winner1 && <span className="mr-1">▸</span>}
            {m.club1.name}
          </span>
          <span className={`text-sm font-bold tabular-nums w-6 text-right ${winner1 ? dt.neonText : 'text-foreground'}`}>
            {m.score1 ?? '-'}
          </span>
        </div>
        <div className={`flex items-center px-3 py-1.5 ${winner2 ? '' : 'opacity-60'}`}>
          <span className={`text-sm font-semibold truncate flex-1 ${winner2 ? dt.neonText : 'text-muted-foreground'}`}>
            {winner2 && <span className="mr-1">▸</span>}
            {m.club2.name}
          </span>
          <span className={`text-sm font-bold tabular-nums w-6 text-right ${winner2 ? dt.neonText : 'text-foreground'}`}>
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

/* ─── Detail Week Card — full 2-line match rows, round group headers ─── */
function DetailWeekCard({ week, dt, accentColor, defaultExpanded }: { week: WeekResult; dt: DivisionTheme; accentColor: string; defaultExpanded: boolean }) {
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

  // Find champion (Grand Final winner)
  const grandFinalMatch = week.tournamentMatches.find(m => m.bracket === 'grand_final');
  const championTeam = grandFinalMatch
    ? (grandFinalMatch.score1 != null && grandFinalMatch.score2 != null
        ? (grandFinalMatch.score1 > grandFinalMatch.score2 ? grandFinalMatch.team1 : grandFinalMatch.team2)
        : null)
    : null;

  const isCompleted = week.tournamentStatus === 'completed';

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all duration-300 ${
      expanded
        ? 'border-border/50 bg-card/80 shadow-sm hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)]'
        : 'border-border/30 bg-card/40 hover:border-border/50'
    }`}>
      {/* Top accent line */}
      <div className="h-[2px]" style={{ background: `linear-gradient(90deg, transparent 5%, ${accentColor} 30%, ${accentColor} 70%, transparent 95%)` }} />

      {/* Week header — clickable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/5 transition-colors"
      >
        <div className={`w-8 h-8 rounded-lg ${dt.iconBg} flex items-center justify-center shrink-0`}>
          <Gamepad2 className={`w-4 h-4 ${dt.neonText}`} />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${dt.neonText}`}>Week {week.weekNumber}</span>
            {isCompleted && (
              <Badge className="bg-green-500/10 text-green-500 text-[8px] border-0 px-1.5 py-0">Selesai</Badge>
            )}
          </div>
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
          <Badge className={`${dt.iconBg} ${dt.neonText} text-[9px] border-0`}>{totalMatches}</Badge>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Expanded content */}
      {expanded && totalMatches > 0 && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/10 pt-3">
          {/* Tournament matches grouped by round */}
          {groupedTournamentMatches.map(([key, matches]) => {
            const firstMatch = matches[0];
            const roundLabel = getFullRoundLabel(firstMatch.bracket, firstMatch.round);
            const isGrandFinal = firstMatch.bracket === 'grand_final';

            return (
              <div key={key}>
                {/* Round header */}
                <div className="flex items-center gap-3 mb-2">
                  <div className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
                    isGrandFinal
                      ? 'bg-idm-gold-warm/15 text-idm-gold-warm'
                      : `${dt.iconBg} ${dt.neonText}`
                  }`}>
                    {roundLabel}
                  </div>
                  <div className={`flex-1 h-px ${dt.borderSubtle}`} />
                  <span className="text-[10px] text-muted-foreground">{matches.length} match</span>
                </div>
                {/* Match rows */}
                <div className="space-y-1.5">
                  {matches.map(m => (
                    <DetailTournamentMatchRow key={m.id} m={m} dt={dt} />
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
                <div className={`flex-1 h-px ${dt.borderSubtle}`} />
                <span className="text-[10px] text-muted-foreground">{week.leagueMatches.length} match</span>
              </div>
              <div className="space-y-1.5">
                {week.leagueMatches.map(m => (
                  <DetailLeagueMatchRow key={m.id} m={m} dt={dt} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Ghost Week Card ─── */
function DetailGhostWeekCard({ dt, accentColor }: { dt: DivisionTheme; accentColor: string }) {
  return (
    <div className="border border-border/20 rounded-2xl overflow-hidden bg-card/30 opacity-40">
      <div className="h-[2px]" style={{ background: `linear-gradient(90deg, transparent 5%, ${accentColor} 30%, ${accentColor} 70%, transparent 95%)`}} />
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={`w-8 h-8 rounded-lg ${dt.iconBg} flex items-center justify-center shrink-0`}>
          <Gamepad2 className={`w-4 h-4 ${dt.neonText}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${dt.neonText}`}>Week —</p>
          <p className="text-[11px] text-muted-foreground/50">Belum ada hasil</p>
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════
   SINGLE DIVISION: MatchDayContent
   Renders the full match day view for ONE specific division
   ═══════════════════════════════════════════════ */
export function MatchDayContent({ divisionProp }: { divisionProp: 'male' | 'female' }) {
  // Use division theme for ALL card interior styling — male=cyan, female=purple.
  // Outer shell background (community-surface + useShellTheme) handles the neutral gold base.
  const ct = getDivisionTheme(divisionProp);
  const dt = ct; // alias for readability in division-specific contexts
  const [selectedMatchIdx, setSelectedMatchIdx] = useState(0);
  const { playerAuth, initialBracketTab, setInitialBracketTab } = useAppStore();
  const loggedInGamertag = playerAuth.isAuthenticated ? playerAuth.account?.player.gamertag : null;

  // Bracket sub-tab state — reads initialBracketTab from store (set by landing "Lihat Semua Hasil" button)
  const [activeBracketTab, setActiveBracketTab] = useState(() => initialBracketTab || 'bracket');

  // Consume initialBracketTab once — adjust state during rendering (React pattern)
  const [prevBracketTab, setPrevBracketTab] = useState(initialBracketTab);
  if (initialBracketTab !== prevBracketTab && initialBracketTab) {
    setPrevBracketTab(initialBracketTab);
    setActiveBracketTab(initialBracketTab);
  }
  // Side effects: scroll to top & clear store value
  useEffect(() => {
    if (initialBracketTab) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const timer = setTimeout(() => setInitialBracketTab(null), 100);
      return () => clearTimeout(timer);
    }
  }, [initialBracketTab, setInitialBracketTab]);

  const { data, isLoading } = useQuery<StatsData>({
    queryKey: ['stats', divisionProp],
    queryFn: async () => {
      const res = await fetch(`/api/stats?division=${divisionProp}`);
      return res.json();
    },
  });

  // Fetch season results for full history in Hasil tab
  const { data: seasonResults, isLoading: seasonLoading } = useQuery<SeasonResultsData>({
    queryKey: ['season-results', divisionProp],
    queryFn: async () => {
      const res = await fetch(`/api/season-results?division=${divisionProp}`);
      if (!res.ok) return { season: { id: '', name: '', number: 0, status: '' }, weeks: [] } as SeasonResultsData;
      return res.json() as Promise<SeasonResultsData>;
    },
    staleTime: 30000,
  });

  const [bracketTypeManual, setBracketTypeManual] = useState<string | null>(null);
  // Auto-detect from tournament format, but allow manual override
  const tournamentFormat = data?.activeTournament?.format;
  const bracketType = bracketTypeManual || tournamentFormat || 'swiss';

  if (isLoading) {
    return (
      <div className="space-y-5">
        <MatchDayHeroSkeleton />
        <div className="border-b border-border">
          <div className="flex items-center gap-0">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton-shimmer h-9 w-24 rounded-none" aria-hidden="true" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-3">
            <div className="skeleton-shimmer h-5 w-32 rounded" aria-hidden="true" />
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="skeleton-shimmer h-6 w-full rounded-lg" aria-hidden="true" />
              ))}
            </div>
          </div>
          <StatsRowSkeleton count={3} className="grid-cols-3" />
        </div>
        <MatchRowSkeleton count={4} />
      </div>
    );
  }

  if (!data?.hasData) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className={`w-8 h-8 border-2 ${ct.border} border-t-transparent rounded-full animate-spin`} />
      </div>
    );
  }

  const t = data.activeTournament;
  const tournamentMatches = t?.matches || [];
  const selectedMatch = tournamentMatches[selectedMatchIdx] || tournamentMatches[0];

  const divisionAccentColor = divisionProp === 'male' ? '#2E9FFF' : '#FF2D78';

  // Season results
  const seasonWeeks = seasonResults?.weeks || [];
  const hasSeasonResults = seasonWeeks.some(w => w.tournamentMatches.length > 0 || w.leagueMatches.length > 0);
  const completedWeeks = seasonWeeks.filter(w => w.tournamentMatches.length > 0 || w.leagueMatches.length > 0).length;

  return (
    <div className="space-y-5 rounded-2xl overflow-hidden" style={{ borderTop: `3px solid ${divisionAccentColor}` }}>

      {/* ═══════ HERO: Featured Match Banner ═══════ */}
      <div className="stagger-item-subtle stagger-d0">
        <Card className={`${ct.casinoCard} ${ct.casinoGlow} casino-shimmer overflow-hidden`}>
          <div className={ct.casinoBar} />
          <div className="relative">
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-background/95" />

            <div className="relative z-10 p-4 lg:p-6">
              {/* Top Bar: Tournament Info + Live Indicator */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                  <Badge className={`${ct.casinoBadge} text-[10px]`}>
                    <Flame className="w-3 h-3 mr-1" />
                    Week {t?.weekNumber ?? '-'}
                  </Badge>
                  <Badge className={`${ct.casinoBadge} text-[10px]`}>
                    {t?.name || 'Turnamen IDM'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <ShareButton
                    title={t?.name || 'Tarkam IDM'}
                    description={`Week ${t?.weekNumber ?? '-'} — ${divisionProp === 'male' ? 'Cowo' : 'Cewe'} Division`}
                    variant="icon"
                  />
                  {(selectedMatch?.status === 'live' || selectedMatch?.status === 'main_event') ? (
                    <LivePulse />
                  ) : selectedMatch?.status === 'completed' ? (
                    <Badge className="bg-green-500/10 text-green-500 text-[10px] font-black border-0">SELESAI</Badge>
                  ) : (
                    <Badge className={`${ct.casinoBadge} text-[10px]`}>MENDATANG</Badge>
                  )}
                </div>
              </div>

              {/* Match Selection Tabs */}
              {tournamentMatches.length > 1 && (
                <div className="flex gap-2 mb-4 overflow-x-auto custom-scrollbar pb-1">
                  {tournamentMatches.map((m, idx) => {
                    const isActive = idx === selectedMatchIdx;
                    const isLive = m.status === 'live' || m.status === 'main_event';
                    return (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMatchIdx(idx)}
                        className={`shrink-0 px-3 py-2 rounded-md text-xs min-h-[36px] font-semibold transition-all border ${
                          isActive
                            ? `${ct.bg} ${ct.text} ${ct.border} shadow-sm`
                            : `${ct.bgSubtle} ${ct.borderSubtle} text-muted-foreground hover:text-foreground`
                        } ${isLive ? 'border-red-500/30' : ''}`}
                      >
                        {isLive && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5 live-dot" />}
                        {m.team1?.name || 'TBD'} vs {(m.team2?.name || 'TBD')}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ═══ Main Match Display ═══ */}
              {selectedMatch && (
                <div className="flex items-center gap-4 lg:gap-8">
                  {/* Team 1 */}
                  <div className={`flex-1 text-center ${selectedMatch.score1 !== null && selectedMatch.score2 !== null && selectedMatch.score1! > selectedMatch.score2! ? '' : 'opacity-80'}`}>
                    <div
                      className={`hover-scale-md w-20 h-20 lg:w-28 lg:h-28 mx-auto rounded-2xl flex items-center justify-center text-2xl lg:text-4xl font-black shadow-lg ${
                        selectedMatch.score1 !== null && selectedMatch.score2 !== null && selectedMatch.score1! > selectedMatch.score2!
                          ? `bg-gradient-to-br ${divisionProp === 'male' ? 'from-idm-male to-idm-male-light' : 'from-idm-female to-idm-female-light'} text-white glow-champion`
                          : `${ct.iconBg} ${ct.text}`
                      }`}
                    >
                      {(selectedMatch.team1?.name || 'TBD').slice(0, 2).toUpperCase()}
                    </div>
                    <p className={`text-sm lg:text-xl font-bold mt-3 ${selectedMatch.score1 !== null && selectedMatch.score2 !== null && selectedMatch.score1! > selectedMatch.score2! ? dt.neonText : ''}`}>
                      {selectedMatch.team1?.name || 'TBD'}
                    </p>
                    {selectedMatch.score1 !== null && selectedMatch.score2 !== null && selectedMatch.score1! > selectedMatch.score2! && (
                      <Badge className="bg-yellow-500/10 text-yellow-500 text-[10px] border-0 mt-1">
                        <Crown className="w-2.5 h-2.5 mr-0.5" /> WINNER
                      </Badge>
                    )}
                  </div>

                  {/* VS / Score Center */}
                  <div className="flex flex-col items-center shrink-0">
                    {selectedMatch.score1 !== null && selectedMatch.score2 !== null ? (
                      <div className="flex items-center gap-3 lg:gap-5">
                        <span
                          className={`stagger-item-subtle text-4xl lg:text-6xl font-black tabular-nums ${
                            selectedMatch.score1 > selectedMatch.score2 ? dt.neonGradient : 'text-foreground/30'
                          }`}
                        >
                          {selectedMatch.score1}
                        </span>
                        <div className="flex flex-col items-center">
                          <div className={`w-10 h-10 lg:w-14 lg:h-14 rounded-full ${ct.bgSubtle} ${ct.border} border flex items-center justify-center`}>
                            <Star className={`w-5 h-5 lg:w-7 lg:h-7 ${ct.neonText}`} />
                          </div>
                          <span className="text-[10px] text-muted-foreground mt-1 font-semibold uppercase">
                            {selectedMatch.status === 'completed' ? 'Final' : 'BO3'}
                          </span>
                        </div>
                        <span
                          className={`stagger-item-subtle text-4xl lg:text-6xl font-black tabular-nums ${
                            selectedMatch.score2 > selectedMatch.score1 ? dt.neonGradient : 'text-foreground/30'
                          }`}
                        >
                          {selectedMatch.score2}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <div
                          className={`animate-pulse-scale w-16 h-16 lg:w-24 lg:h-24 rounded-full ${ct.bgSubtle} ${ct.border} border-2 flex items-center justify-center`}
                        >
                          <span className={`text-xl lg:text-3xl font-black ${ct.neonGradient}`}>VS</span>
                        </div>
                        <span className="text-xs text-muted-foreground mt-2 font-semibold">Segera Dimulai</span>
                      </div>
                    )}

                    {/* MVP */}
                    {selectedMatch.mvpPlayer && (
                      <div
                        className={`stagger-item-subtle flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg ${ct.bgSubtle} ${ct.border} border`}
                      >
                        <Crown className="w-3.5 h-3.5 text-yellow-500" />
                        <span className="text-xs font-semibold text-yellow-500">MVP: {selectedMatch.mvpPlayer.gamertag}</span>
                      </div>
                    )}
                  </div>

                  {/* Team 2 */}
                  <div className={`flex-1 text-center ${selectedMatch.score1 !== null && selectedMatch.score2 !== null && selectedMatch.score2! > selectedMatch.score1! ? '' : 'opacity-80'}`}>
                    <div
                      className={`hover-scale-md w-20 h-20 lg:w-28 lg:h-28 mx-auto rounded-2xl flex items-center justify-center text-2xl lg:text-4xl font-black shadow-lg ${
                        selectedMatch.score1 !== null && selectedMatch.score2 !== null && selectedMatch.score2! > selectedMatch.score1!
                          ? `bg-gradient-to-br ${divisionProp === 'male' ? 'from-idm-male to-idm-male-light' : 'from-idm-female to-idm-female-light'} text-white glow-champion`
                          : `${ct.iconBg} ${ct.text}`
                      }`}
                    >
                      {(selectedMatch.team2?.name || 'TBD').slice(0, 2).toUpperCase()}
                    </div>
                    <p className={`text-sm lg:text-xl font-bold mt-3 ${selectedMatch.score1 !== null && selectedMatch.score2 !== null && selectedMatch.score2! > selectedMatch.score1! ? dt.neonText : ''}`}>
                      {selectedMatch.team2?.name || 'TBD'}
                    </p>
                    {selectedMatch.score1 !== null && selectedMatch.score2 !== null && selectedMatch.score2! > selectedMatch.score1! && (
                      <Badge className="bg-yellow-500/10 text-yellow-500 text-[10px] border-0 mt-1">
                        <Crown className="w-2.5 h-2.5 mr-0.5" /> WINNER
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Score Bar */}
              {selectedMatch && selectedMatch.score1 !== null && selectedMatch.score2 !== null && (selectedMatch.score1 + selectedMatch.score2) > 0 && (
                <div className="mt-4">
                  <div className={`h-2 rounded-full ${ct.bgSubtle} overflow-hidden flex`}>
                    <div
                      className={`h-full rounded-l-full bg-gradient-to-r ${divisionProp === 'male' ? 'from-idm-male to-idm-male-light' : 'from-idm-female to-idm-female-light'}`}
                      style={{ width: `${(selectedMatch.score1 / (selectedMatch.score1 + selectedMatch.score2)) * 100}%`, transition: 'width 0.8s ease-out' }}
                    />
                    <div
                      className={`h-full rounded-r-full bg-gradient-to-r ${divisionProp === 'male' ? 'from-idm-male-light to-idm-male' : 'from-idm-female-light to-idm-female'}`}
                      style={{ width: `${(selectedMatch.score2 / (selectedMatch.score1 + selectedMatch.score2)) * 100}%`, opacity: 0.5, transition: 'width 0.8s ease-out' }}
                    />
                  </div>
                </div>
              )}

              {/* Match Meta */}
              {t && (
                <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{t.scheduledAt ? (parseWitaDate(t.scheduledAt) ? formatWIBWeekdayShort(parseWitaDate(t.scheduledAt)!) : 'TBD') : 'TBD'}</span>
                  <span className="flex items-center gap-1"><Flame className="w-3 h-3" />Week {t.weekNumber}</span>
                  <span className="flex items-center gap-1"><Trophy className="w-3 h-3" />{formatCurrency(t.prizePool)}</span>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Sponsor Banner — Bracket Top */}
      <SponsorBanner placement="bracket_top" className="flex items-center justify-center gap-4 flex-wrap" />

      {/* Tournament Sponsor Info */}
      {t?.id && (
        <div className="space-y-3">
          <PresentedBy tournamentId={t.id} className="flex items-center gap-2 text-xs text-muted-foreground" />
          <SponsoredPrizes tournamentId={t.id} />
        </div>
      )}

      {/* ═══════ TABS: Bracket / Results ═══════ */}
      <Tabs value={activeBracketTab} onValueChange={setActiveBracketTab} className="w-full">
        <div className={`border-b ${ct.border}`}>
          <TabsList className="bg-transparent h-auto p-0 gap-0 rounded-none">
            {[
              { value: 'bracket', label: 'Bracket', icon: Trophy },
              { value: 'results', label: 'Hasil', icon: Trophy },
            ].map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className={`relative px-3 py-2.5 text-[11px] sm:text-xs sm:px-4 font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-current data-[state=active]:bg-transparent data-[state=active]:shadow-none ${divisionProp === 'male' ? 'data-[state=active]:text-idm-male' : 'data-[state=active]:text-idm-female'} text-muted-foreground hover:text-foreground transition-colors`}
              >
                <tab.icon className="w-3.5 h-3.5 mr-1.5 inline" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* ═══ BRACKET TAB — MPL Style Visual Bracket ═══ */}
        <TabsContent value="bracket" className="mt-4 space-y-4">
          <div className="space-y-4">
            {/* Bracket Type Selector */}
            <div className="flex items-center gap-1.5 px-1 overflow-x-auto scrollbar-none">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1.5 shrink-0">Format:</span>
              {[
                { value: 'swiss', label: '🇨🇭 Swiss' },
                { value: 'single_elimination', label: 'Elim. Langsung' },
                { value: 'group_stage', label: 'Fase Grup' },
                { value: 'upper_semi', label: '🏆 Upper Semi' },
                { value: 'round_robin', label: 'Round Robin' },
              ].map(bt => (
                <button
                  key={bt.value}
                  onClick={() => setBracketTypeManual(bt.value)}
                  className={`compact-pill shrink-0 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                    bracketType === bt.value
                      ? 'bg-idm-gold-warm/15 text-idm-gold-warm border border-idm-gold-warm/25 shadow-sm'
                      : 'text-muted-foreground hover:text-foreground border border-transparent hover:bg-muted/40'
                  }`}
                >
                  {bt.label}
                </button>
              ))}
            </div>

            {/* MPL Visual Bracket */}
            {tournamentMatches.length === 0 ? (
              <SectionCard title="Bracket Turnamen" icon={Trophy} theme={ct}>
                <div className="text-center py-8">
                  <Trophy className={`w-10 h-10 mx-auto mb-3 opacity-30`} />
                  <p className="text-sm text-muted-foreground">Belum ada bracket — turnamen belum dimulai</p>
                </div>
              </SectionCard>
            ) : (
              <BracketView
                matches={tournamentMatches.map(m => ({
                  ...m,
                  round: m.round ?? 1,
                }))}
                bracketType={bracketType as any}
              />
            )}
          </div>
        </TabsContent>

        {/* ═══ RESULTS TAB — Full Season History ═══ */}
        <TabsContent value="results" className="mt-4 space-y-4">
          {seasonLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="h-48 rounded-2xl border border-border/30 bg-card/40 animate-pulse" />
              ))}
            </div>
          ) : !hasSeasonResults ? (
            <SectionCard title="Hasil Pertandingan" icon={Trophy} theme={ct}>
              <div className="text-center py-8">
                <Trophy className={`w-10 h-10 mx-auto mb-3 opacity-30`} />
                <p className="text-sm text-muted-foreground">Belum ada hasil pertandingan</p>
                <p className="text-xs text-muted-foreground/50 mt-1">Hasil match akan muncul setelah pertandingan selesai</p>
              </div>
            </SectionCard>
          ) : (
            <div className="space-y-4">
              {/* Season overview header */}
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-lg ${ct.iconBg} flex items-center justify-center shrink-0`}>
                  <Swords className={`w-4 h-4 ${ct.neonText}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${dt.neonText}`}>
                      {seasonResults?.season?.name || `Season ${seasonResults?.season?.number || 1}`}
                    </span>
                    <Badge className={`${ct.iconBg} ${dt.neonText} text-[9px] border-0`}>{completedWeeks} Minggu</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Riwayat hasil pertandingan lengkap</p>
                </div>
              </div>

              {/* Week-by-week results */}
              {seasonWeeks.map((w, idx) => (
                <DetailWeekCard
                  key={w.weekNumber}
                  week={w}
                  dt={ct}
                  accentColor={divisionAccentColor}
                  defaultExpanded={idx === seasonWeeks.findIndex(sw => sw.tournamentMatches.length > 0 || sw.leagueMatches.length > 0)}
                />
              ))}

              {/* Ghost for future weeks */}
              {seasonWeeks.length === 0 && (
                <DetailGhostWeekCard dt={ct} accentColor={divisionAccentColor} />
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   BracketContent — Format selector + BracketView + Sponsor
   Used by the new BracketPage primary "Bracket" tab
   Hero Banner is in ResultsContent (match scores = hasil context)
   Sponsor stays in Bracket (sponsors fund the tournament/bracket)
   ═══════════════════════════════════════════════ */
export function BracketContent({ divisionProp }: { divisionProp: 'male' | 'female' }) {
  const ct = getDivisionTheme(divisionProp);
  const divisionAccentColor = divisionProp === 'male' ? '#2E9FFF' : '#FF2D78';

  const { data, isLoading } = useQuery<StatsData>({
    queryKey: ['stats', divisionProp],
    queryFn: async () => {
      const res = await fetch(`/api/stats?division=${divisionProp}`);
      return res.json();
    },
  });

  const [bracketTypeManual, setBracketTypeManual] = useState<string | null>(null);
  const tournamentFormat = data?.activeTournament?.format;
  const bracketType = bracketTypeManual || tournamentFormat || 'swiss';

  const tournamentMatches = data?.activeTournament?.matches || [];

  if (isLoading) {
    return (
      <div className="space-y-4 rounded-2xl overflow-hidden" style={{ borderTop: `3px solid ${divisionAccentColor}` }}>
        <div className="h-12 rounded-lg bg-muted/20 animate-pulse" />
        <div className="h-64 rounded-2xl border border-border/30 bg-card/40 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl overflow-hidden" style={{ borderTop: `3px solid ${divisionAccentColor}` }}>
      {/* Sponsor Banner — above bracket */}
      <SponsorBanner placement="bracket_top" className="flex items-center justify-center gap-4 flex-wrap" />
      {data?.activeTournament?.id && (
        <div className="space-y-3">
          <PresentedBy tournamentId={data.activeTournament.id} className="flex items-center gap-2 text-xs text-muted-foreground" />
          <SponsoredPrizes tournamentId={data.activeTournament.id} />
        </div>
      )}

      {/* Bracket Type Selector */}
      <div className="flex items-center gap-1.5 px-1 overflow-x-auto scrollbar-none">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1.5 shrink-0">Format:</span>
        {[
          { value: 'swiss', label: '🇨🇭 Swiss' },
          { value: 'single_elimination', label: 'Elim. Langsung' },
          { value: 'group_stage', label: 'Fase Grup' },
          { value: 'upper_semi', label: '🏆 Upper Semi' },
          { value: 'round_robin', label: 'Round Robin' },
        ].map(bt => (
          <button
            key={bt.value}
            onClick={() => setBracketTypeManual(bt.value)}
            className={`shrink-0 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
              bracketType === bt.value
                ? 'bg-idm-gold-warm/15 text-idm-gold-warm border border-idm-gold-warm/25 shadow-sm'
                : 'text-muted-foreground hover:text-foreground border border-transparent hover:bg-muted/40'
            }`}
          >
            {bt.label}
          </button>
        ))}
      </div>

      {/* Bracket View */}
      {tournamentMatches.length === 0 ? (
        <SectionCard title="Bracket Turnamen" icon={Trophy} theme={ct}>
          <div className="text-center py-8">
            <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm text-muted-foreground">Belum ada bracket — turnamen belum dimulai</p>
          </div>
        </SectionCard>
      ) : (
        <BracketView
          matches={tournamentMatches.map(m => ({
            ...m,
            round: m.round ?? 1,
          }))}
          bracketType={bracketType as any}
        />
      )}

    </div>
  );
}

/* ═══════════════════════════════════════════════
   ResultsContent — Hero Banner + Season Results
   Used by the new BracketPage primary "Hasil" tab
   Hero Banner here because match scores are "hasil" context
   Sponsor stays in BracketContent (sponsors fund the tournament/bracket)
   ═══════════════════════════════════════════════ */
export function ResultsContent({ divisionProp }: { divisionProp: 'male' | 'female' }) {
  const ct = getDivisionTheme(divisionProp);
  const dt = ct;
  const [selectedMatchIdx, setSelectedMatchIdx] = useState(0);
  const divisionAccentColor = divisionProp === 'male' ? '#2E9FFF' : '#FF2D78';

  const { data, isLoading } = useQuery<StatsData>({
    queryKey: ['stats', divisionProp],
    queryFn: async () => {
      const res = await fetch(`/api/stats?division=${divisionProp}`);
      return res.json();
    },
  });

  const { data: seasonResults, isLoading: seasonLoading } = useQuery<SeasonResultsData>({
    queryKey: ['season-results', divisionProp],
    queryFn: async () => {
      const res = await fetch(`/api/season-results?division=${divisionProp}`);
      if (!res.ok) return { season: { id: '', name: '', number: 0, status: '' }, weeks: [] } as SeasonResultsData;
      return res.json() as Promise<SeasonResultsData>;
    },
    staleTime: 30000,
  });

  const seasonWeeks = seasonResults?.weeks || [];
  const hasSeasonResults = seasonWeeks.some(w => w.tournamentMatches.length > 0 || w.leagueMatches.length > 0);
  const completedWeeks = seasonWeeks.filter(w => w.tournamentMatches.length > 0 || w.leagueMatches.length > 0).length;

  // Smart hero data: if active tournament has no results, fall back to last completed week
  const activeTournament = data?.activeTournament;
  const activeHasResults = (activeTournament?.matches || []).some(m => m.score1 !== null && m.score2 !== null);

  // Find last week with results (iterate from end)
  const lastResultWeek = [...seasonWeeks].reverse().find(w => w.tournamentMatches.length > 0 || w.leagueMatches.length > 0);

  // Decide which data to show in hero banner
  const heroData = useMemo(() => {
    if (activeTournament && activeHasResults) {
      // Active tournament has results — show it
      return {
        weekNumber: activeTournament.weekNumber,
        name: activeTournament.name,
        scheduledAt: activeTournament.scheduledAt,
        prizePool: activeTournament.prizePool,
        matches: activeTournament.matches || [],
        isFallback: false,
      };
    }
    if (lastResultWeek) {
      // No active results — fall back to last completed week from season results
      return {
        weekNumber: lastResultWeek.weekNumber,
        name: lastResultWeek.tournamentName,
        scheduledAt: null,
        prizePool: null,
        matches: lastResultWeek.tournamentMatches.map(m => ({
          id: m.id,
          team1: m.team1,
          team2: m.team2,
          score1: m.score1,
          score2: m.score2,
          status: 'completed' as const,
          round: m.round,
          bracket: m.bracket,
          format: m.format,
          mvpPlayer: m.mvpPlayer,
        })),
        isFallback: true,
      };
    }
    // No data at all
    return null;
  }, [activeTournament, activeHasResults, lastResultWeek]);

  const tournamentMatches = heroData?.matches || [];
  const selectedMatch = tournamentMatches[selectedMatchIdx] || tournamentMatches[0];

  // Reset match selection when hero data changes (e.g., active → fallback)
  // Using render-time state adjustment (React pattern) instead of useEffect
  const [prevHeroWeek, setPrevHeroWeek] = useState(heroData?.weekNumber);
  const [prevHeroFallback, setPrevHeroFallback] = useState(heroData?.isFallback);
  if (heroData?.weekNumber !== prevHeroWeek || heroData?.isFallback !== prevHeroFallback) {
    setPrevHeroWeek(heroData?.weekNumber);
    setPrevHeroFallback(heroData?.isFallback);
    setSelectedMatchIdx(0);
  }

  if (isLoading || seasonLoading) {
    return (
      <div className="space-y-5 rounded-2xl overflow-hidden" style={{ borderTop: `3px solid ${divisionAccentColor}` }}>
        <MatchDayHeroSkeleton />
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-48 rounded-2xl border border-border/30 bg-card/40 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-2xl overflow-hidden" style={{ borderTop: `3px solid ${divisionAccentColor}` }}>

      {/* ═══════ HERO: Featured Match Banner ═══════ */}
      {heroData && (
        <div className="stagger-item-subtle stagger-d0">
          <Card className={`${ct.casinoCard} ${ct.casinoGlow} casino-shimmer overflow-hidden`}>
            <div className={ct.casinoBar} />
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-background/95" />
              <div className="relative z-10 p-4 lg:p-6">
                {/* Top Bar: Tournament Info + Live Indicator */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2.5">
                    <Badge className={`${ct.casinoBadge} text-[10px]`}>
                      <Flame className="w-3 h-3 mr-1" />
                      Week {heroData.weekNumber ?? '-'}
                    </Badge>
                    <Badge className={`${ct.casinoBadge} text-[10px]`}>
                      {heroData.name || 'Turnamen IDM'}
                    </Badge>
                    {heroData.isFallback && (
                      <Badge className="bg-idm-gold-warm/10 text-idm-gold-warm text-[9px] border border-idm-gold-warm/20 font-bold">Hasil Terakhir</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <ShareButton
                      title={heroData.name || 'Tarkam IDM'}
                      description={`Week ${heroData.weekNumber ?? '-'} — ${divisionProp === 'male' ? 'Cowo' : 'Cewe'} Division`}
                      variant="icon"
                    />
                    {(selectedMatch?.status === 'live' || selectedMatch?.status === 'main_event') ? (
                      <LivePulse />
                    ) : selectedMatch?.status === 'completed' ? (
                      <Badge className="bg-green-500/10 text-green-500 text-[10px] font-black border-0">SELESAI</Badge>
                    ) : (
                      <Badge className={`${ct.casinoBadge} text-[10px]`}>MENDATANG</Badge>
                    )}
                  </div>
                </div>

                {/* Match Selection Tabs */}
                {tournamentMatches.length > 1 && (
                  <div className="flex gap-2 mb-4 overflow-x-auto custom-scrollbar pb-1">
                    {tournamentMatches.map((m, idx) => {
                      const isActive = idx === selectedMatchIdx;
                      const isLive = m.status === 'live' || m.status === 'main_event';
                      return (
                        <button
                          key={m.id}
                          onClick={() => setSelectedMatchIdx(idx)}
                          className={`shrink-0 px-3 py-2 rounded-md text-xs min-h-[36px] font-semibold transition-all border ${
                            isActive
                              ? `${ct.bg} ${ct.text} ${ct.border} shadow-sm`
                              : `${ct.bgSubtle} ${ct.borderSubtle} text-muted-foreground hover:text-foreground`
                          } ${isLive ? 'border-red-500/30' : ''}`}
                        >
                          {isLive && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5 live-dot" />}
                          {m.team1?.name || 'TBD'} vs {m.team2?.name || 'TBD'}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Main Match Display */}
                {selectedMatch && (
                  <div className="flex items-center gap-4 lg:gap-8">
                    {/* Team 1 */}
                    <div className={`flex-1 text-center ${selectedMatch.score1 !== null && selectedMatch.score2 !== null && selectedMatch.score1! > selectedMatch.score2! ? '' : 'opacity-80'}`}>
                      <div
                        className={`hover-scale-md w-20 h-20 lg:w-28 lg:h-28 mx-auto rounded-2xl flex items-center justify-center text-2xl lg:text-4xl font-black shadow-lg ${
                          selectedMatch.score1 !== null && selectedMatch.score2 !== null && selectedMatch.score1! > selectedMatch.score2!
                            ? `bg-gradient-to-br ${divisionProp === 'male' ? 'from-idm-male to-idm-male-light' : 'from-idm-female to-idm-female-light'} text-white glow-champion`
                            : `${ct.iconBg} ${ct.text}`
                        }`}
                      >
                        {(selectedMatch.team1?.name || 'TBD').slice(0, 2).toUpperCase()}
                      </div>
                      <p className={`text-sm lg:text-xl font-bold mt-3 ${selectedMatch.score1 !== null && selectedMatch.score2 !== null && selectedMatch.score1! > selectedMatch.score2! ? dt.neonText : ''}`}>
                        {selectedMatch.team1?.name || 'TBD'}
                      </p>
                      {selectedMatch.score1 !== null && selectedMatch.score2 !== null && selectedMatch.score1! > selectedMatch.score2! && (
                        <Badge className="bg-yellow-500/10 text-yellow-500 text-[10px] border-0 mt-1">
                          <Crown className="w-2.5 h-2.5 mr-0.5" /> WINNER
                        </Badge>
                      )}
                    </div>

                    {/* VS / Score Center */}
                    <div className="flex flex-col items-center shrink-0">
                      {selectedMatch.score1 !== null && selectedMatch.score2 !== null ? (
                        <div className="flex items-center gap-3 lg:gap-5">
                          <span className={`stagger-item-subtle text-4xl lg:text-6xl font-black tabular-nums ${selectedMatch.score1 > selectedMatch.score2 ? dt.neonGradient : 'text-foreground/30'}`}>
                            {selectedMatch.score1}
                          </span>
                          <div className="flex flex-col items-center">
                            <div className={`w-10 h-10 lg:w-14 lg:h-14 rounded-full ${ct.bgSubtle} ${ct.border} border flex items-center justify-center`}>
                              <Star className={`w-5 h-5 lg:w-7 lg:h-7 ${ct.neonText}`} />
                            </div>
                            <span className="text-[10px] text-muted-foreground mt-1 font-semibold uppercase">
                              {selectedMatch.status === 'completed' ? 'Final' : 'BO3'}
                            </span>
                          </div>
                          <span className={`stagger-item-subtle text-4xl lg:text-6xl font-black tabular-nums ${selectedMatch.score2 > selectedMatch.score1 ? dt.neonGradient : 'text-foreground/30'}`}>
                            {selectedMatch.score2}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <div className={`animate-pulse-scale w-16 h-16 lg:w-24 lg:h-24 rounded-full ${ct.bgSubtle} ${ct.border} border-2 flex items-center justify-center`}>
                            <span className={`text-xl lg:text-3xl font-black ${ct.neonGradient}`}>VS</span>
                          </div>
                          <span className="text-xs text-muted-foreground mt-2 font-semibold">Segera Dimulai</span>
                        </div>
                      )}

                      {selectedMatch.mvpPlayer && (
                        <div className={`stagger-item-subtle flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg ${ct.bgSubtle} ${ct.border} border`}>
                          <Crown className="w-3.5 h-3.5 text-yellow-500" />
                          <span className="text-xs font-semibold text-yellow-500">MVP: {selectedMatch.mvpPlayer.gamertag}</span>
                        </div>
                      )}
                    </div>

                    {/* Team 2 */}
                    <div className={`flex-1 text-center ${selectedMatch.score1 !== null && selectedMatch.score2 !== null && selectedMatch.score2! > selectedMatch.score1! ? '' : 'opacity-80'}`}>
                      <div
                        className={`hover-scale-md w-20 h-20 lg:w-28 lg:h-28 mx-auto rounded-2xl flex items-center justify-center text-2xl lg:text-4xl font-black shadow-lg ${
                          selectedMatch.score1 !== null && selectedMatch.score2 !== null && selectedMatch.score2! > selectedMatch.score1!
                            ? `bg-gradient-to-br ${divisionProp === 'male' ? 'from-idm-male to-idm-male-light' : 'from-idm-female to-idm-female-light'} text-white glow-champion`
                            : `${ct.iconBg} ${ct.text}`
                        }`}
                      >
                        {(selectedMatch.team2?.name || 'TBD').slice(0, 2).toUpperCase()}
                      </div>
                      <p className={`text-sm lg:text-xl font-bold mt-3 ${selectedMatch.score1 !== null && selectedMatch.score2 !== null && selectedMatch.score2! > selectedMatch.score1! ? dt.neonText : ''}`}>
                        {selectedMatch.team2?.name || 'TBD'}
                      </p>
                      {selectedMatch.score1 !== null && selectedMatch.score2 !== null && selectedMatch.score2! > selectedMatch.score1! && (
                        <Badge className="bg-yellow-500/10 text-yellow-500 text-[10px] border-0 mt-1">
                          <Crown className="w-2.5 h-2.5 mr-0.5" /> WINNER
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Score Bar */}
                {selectedMatch && selectedMatch.score1 !== null && selectedMatch.score2 !== null && (selectedMatch.score1 + selectedMatch.score2) > 0 && (
                  <div className="mt-4">
                    <div className={`h-2 rounded-full ${ct.bgSubtle} overflow-hidden flex`}>
                      <div
                        className={`h-full rounded-l-full bg-gradient-to-r ${divisionProp === 'male' ? 'from-idm-male to-idm-male-light' : 'from-idm-female to-idm-female-light'}`}
                        style={{ width: `${(selectedMatch.score1 / (selectedMatch.score1 + selectedMatch.score2)) * 100}%`, transition: 'width 0.8s ease-out' }}
                      />
                      <div
                        className={`h-full rounded-r-full bg-gradient-to-r ${divisionProp === 'male' ? 'from-idm-male-light to-idm-male' : 'from-idm-female-light to-idm-female'}`}
                        style={{ width: `${(selectedMatch.score2 / (selectedMatch.score1 + selectedMatch.score2)) * 100}%`, opacity: 0.5, transition: 'width 0.8s ease-out' }}
                      />
                    </div>
                  </div>
                )}

                {/* Match Meta */}
                <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{heroData.scheduledAt ? (parseWitaDate(heroData.scheduledAt) ? formatWIBWeekdayShort(parseWitaDate(heroData.scheduledAt)!) : 'TBD') : 'TBD'}</span>
                  <span className="flex items-center gap-1"><Flame className="w-3 h-3" />Week {heroData.weekNumber}</span>
                  {heroData.prizePool != null && <span className="flex items-center gap-1"><Trophy className="w-3 h-3" />{formatCurrency(heroData.prizePool)}</span>}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ═══════ Season Results History ═══════ */}
      {!hasSeasonResults ? (
        <SectionCard title="Hasil Pertandingan" icon={Trophy} theme={ct}>
          <div className="text-center py-8">
            <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm text-muted-foreground">Belum ada hasil pertandingan</p>
            <p className="text-xs text-muted-foreground/50 mt-1">Hasil match akan muncul setelah pertandingan selesai</p>
          </div>
        </SectionCard>
      ) : (
        <div className="space-y-4">
          {/* Season overview header */}
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-8 h-8 rounded-lg ${ct.iconBg} flex items-center justify-center shrink-0`}>
              <Swords className={`w-4 h-4 ${ct.neonText}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${dt.neonText}`}>
                  {seasonResults?.season?.name || `Season ${seasonResults?.season?.number || 1}`}
                </span>
                <Badge className={`${ct.iconBg} ${dt.neonText} text-[9px] border-0`}>{completedWeeks} Minggu</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">Riwayat hasil pertandingan lengkap</p>
            </div>
          </div>

          {/* Week-by-week results */}
          {seasonWeeks.map((w, idx) => (
            <DetailWeekCard
              key={w.weekNumber}
              week={w}
              dt={ct}
              accentColor={divisionAccentColor}
              defaultExpanded={idx === seasonWeeks.findIndex(sw => sw.tournamentMatches.length > 0 || sw.leagueMatches.length > 0)}
            />
          ))}

          {/* Ghost for future weeks */}
          {seasonWeeks.length === 0 && (
            <DetailGhostWeekCard dt={ct} accentColor={divisionAccentColor} />
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN COMPONENT: MatchDayCenter
   Shows division selector + one or two MatchDayContent views
   ═══════════════════════════════════════════════ */
export function MatchDayCenter() {
  const { division, setDivision } = useAppStore();

  return (
    <div className="lg:community-surface lg:rounded-3xl lg:border lg:border-border/30 overflow-hidden relative">
      {/* Subtle gold radial glow at top — desktop only */}
      <div className="hidden lg:block absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-48 bg-idm-gold-warm/[0.05] rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 p-2 sm:p-4 lg:p-5 space-y-4 sm:space-y-5">
      {/* ═══ Context Header — consistent with all views ═══ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-idm-gold-warm/15 flex items-center justify-center shrink-0">
            <Radio className="w-4 h-4 text-idm-gold-warm" />
          </div>
          <div>
            <h2 className="text-base font-bold text-idm-gold-warm">Arena Live</h2>
            <p className="text-xs text-muted-foreground/60">Pertandingan real-time Tarkam IDM</p>
          </div>
        </div>
      </div>

      {/* ═══════ Division Selector ═══════ */}
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-muted/20 border border-border/10">
          {([
            { key: 'semua' as const, label: 'Semua' },
            { key: 'male' as const, label: 'Cowo' },
            { key: 'female' as const, label: 'Cewe' },
          ]).map(div => (
            <button
              key={div.key}
              onClick={() => setDivision(div.key)}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                division === div.key
                  ? div.key === 'semua'
                    ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm'
                    : div.key === 'male'
                      ? 'bg-idm-male/15 text-idm-male border border-idm-male/30 shadow-sm'
                      : 'bg-idm-female/15 text-idm-female border border-idm-female/30 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30 border border-transparent'
              }`}
            >
              {div.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════ Content: Both divisions or Single ═══════ */}
      {division === 'semua' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <MatchDayContent divisionProp="male" />
          <MatchDayContent divisionProp="female" />
        </div>
      ) : (
        <MatchDayContent divisionProp={division === 'female' ? 'female' : 'male'} />
      )}
      </div>
    </div>
  );
}
