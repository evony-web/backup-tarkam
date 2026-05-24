'use client';

import { useEffect, useSyncExternalStore, useState, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { Radio, Swords, Trophy, Calendar, Gamepad2, Zap, ChevronDown, ChevronUp, Crown, Clock, Flame } from 'lucide-react';
import { BracketContent, ResultsContent } from './match-day-center';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { getDivisionTheme } from '@/hooks/use-division-theme';

/* ─── Mobile detection (SSR-safe) ─── */
const emptySubscribe = () => () => {};
function useIsMobile() {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia('(max-width: 767px)');
      mql.addEventListener('change', cb);
      return () => mql.removeEventListener('change', cb);
    },
    () => window.innerWidth < 768,
    () => false,
  );
}

/* ─── Division filter chips ─── */
function DivisionChips({
  division,
  setDivision,
  hideSemua = false,
}: {
  division: string;
  setDivision: (d: 'semua' | 'male' | 'female') => void;
  hideSemua?: boolean;
}) {
  const options = [
    { key: 'semua' as const, label: 'Semua' },
    { key: 'male' as const, label: 'Cowo' },
    { key: 'female' as const, label: 'Cewe' },
  ].filter(opt => !hideSemua || opt.key !== 'semua');

  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-idm-gold-warm/5 border border-idm-gold-warm/10 shrink-0">
      {options.map(div => (
        <button
          key={div.key}
          onClick={() => setDivision(div.key)}
          className={`compact-pill px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
            division === div.key
              ? 'bg-idm-gold-warm/15 text-idm-gold-warm shadow-sm shadow-idm-gold-warm/10 border border-idm-gold-warm/25'
              : 'text-muted-foreground/70 hover:text-foreground border border-idm-gold-warm/10 hover:bg-muted/40'
          }`}
        >
          {div.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Live Pulse Badge ─── */
function LivePulseBadge() {
  return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
      </span>
      <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">LIVE</span>
    </div>
  );
}

/* ═══ Tournament Info Header ═══
   Shows week number, season, division, status for the active tournament */
function TournamentInfoHeader({ division }: { division: string }) {
  const divisionProp = division === 'female' ? 'female' as const : 'male' as const;
  const dt = getDivisionTheme(divisionProp);

  const { data: statsData } = useQuery({
    queryKey: ['stats', divisionProp],
    queryFn: async () => {
      const res = await fetch(`/api/stats?division=${divisionProp}`);
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  const tournament = statsData?.activeTournament;
  const season = statsData?.season;

  if (!tournament && !season) return null;

  const statusMap: Record<string, { label: string; color: string; pulse: boolean }> = {
    setup: { label: 'Setup', color: 'bg-muted text-muted-foreground', pulse: false },
    registration: { label: 'Registrasi', color: 'bg-blue-500/10 text-blue-400', pulse: false },
    approval: { label: 'Approval', color: 'bg-amber-500/10 text-amber-400', pulse: false },
    team_generation: { label: 'Buat Tim', color: 'bg-purple-500/10 text-purple-400', pulse: false },
    bracket_generation: { label: 'Buat Bracket', color: 'bg-purple-500/10 text-purple-400', pulse: false },
    main_event: { label: 'Berlangsung', color: 'bg-red-500/10 text-red-500', pulse: true },
    finalization: { label: 'Finalisasi', color: 'bg-idm-gold-warm/10 text-idm-gold-warm', pulse: false },
    completed: { label: 'Selesai', color: 'bg-green-500/10 text-green-500', pulse: false },
  };

  const status = tournament?.status || 'setup';
  const statusInfo = statusMap[status] || statusMap.setup;

  return (
    <Card className="overflow-hidden border border-border/30 bg-card/60">
      <div className="h-[2px] bg-gradient-to-r from-transparent via-idm-gold-warm/30 to-transparent" />
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Season info */}
          {season && (
            <div className="flex items-center gap-1.5">
              <Calendar className={`w-3.5 h-3.5 ${dt.text}`} />
              <span className="text-xs font-bold">{season.name || `Season ${season.number}`}</span>
            </div>
          )}

          {/* Divider */}
          {season && tournament && (
            <span className="text-border text-[10px]">•</span>
          )}

          {/* Week number */}
          {tournament && (
            <div className="flex items-center gap-1.5">
              <Gamepad2 className="w-3.5 h-3.5 text-idm-gold-warm" />
              <span className="text-xs font-bold">Week {tournament.weekNumber ?? '-'}</span>
            </div>
          )}

          {/* Divider */}
          <span className="text-border text-[10px]">•</span>

          {/* Division */}
          <Badge className={`${dt.casinoBadge} text-[9px]`}>
            {divisionProp === 'male' ? '🕺 Cowo' : '💃 Cewe'}
          </Badge>

          {/* Tournament status */}
          <div className="flex items-center gap-1.5">
            {statusInfo.pulse && <LivePulseBadge />}
            <Badge className={`${statusInfo.color} text-[9px] border`}>
              {statusInfo.label}
            </Badge>
          </div>

          {/* Match format */}
          {tournament?.format && (
            <>
              <span className="text-border text-[10px]">•</span>
              <span className="text-[10px] text-muted-foreground font-medium">
                {tournament.format === 'single_elimination' ? 'Eliminasi Langsung' :
                 tournament.format === 'swiss' ? 'Swiss' :
                 tournament.format === 'group_stage' ? 'Fase Grup' :
                 tournament.format === 'round_robin' ? 'Round Robin' :
                 tournament.format}
              </span>
            </>
          )}

          {/* Prize pool */}
          {tournament?.prizePool > 0 && (
            <>
              <span className="text-border text-[10px]">•</span>
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-idm-gold-warm" />
                <span className="text-[10px] font-bold text-idm-gold-warm">
                  {new Intl.NumberFormat('id-ID').format(tournament.prizePool)} IDR
                </span>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══ Match Status Summary ═══
   Shows count of live, completed, and upcoming matches */
function MatchStatusSummary({ division }: { division: string }) {
  const divisionProp = division === 'female' ? 'female' as const : 'male' as const;

  const { data } = useQuery({
    queryKey: ['matches-live-count', divisionProp],
    queryFn: async () => {
      const res = await fetch(`/api/matches/live-count?division=${divisionProp}`);
      return res.json();
    },
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000,
  });

  if (!data) return null;

  return (
    <div className="flex items-center gap-2">
      {data.liveNow && (
        <Badge className="bg-red-500/10 text-red-500 text-[9px] border border-red-500/20 flex items-center gap-1">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
          </span>
          LIVE
        </Badge>
      )}
      {data.completedMatches > 0 && (
        <Badge className="bg-green-500/10 text-green-500 text-[9px] border border-green-500/20">
          ✓ {data.completedMatches} Selesai
        </Badge>
      )}
      {data.upcomingMatches > 0 && (
        <Badge className="bg-muted/20 text-muted-foreground text-[9px] border">
          {data.upcomingMatches} Mendatang
        </Badge>
      )}
      {data.activeTournaments > 0 && (
        <Badge className="bg-idm-gold-warm/10 text-idm-gold-warm text-[9px] border border-idm-gold-warm/20">
          {data.activeTournaments} Turnamen Aktif
        </Badge>
      )}
    </div>
  );
}

/* ═══ Shared header component for both Hasil & Bracket views ═══ */
function ViewHeader({
  icon: Icon,
  title,
  subtitle,
  division,
  setDivision,
  hideSemua = false,
  showTournamentInfo = false,
}: {
  icon: typeof Radio;
  title: string;
  subtitle: string;
  division: string;
  setDivision: (d: 'semua' | 'male' | 'female') => void;
  hideSemua?: boolean;
  showTournamentInfo?: boolean;
}) {
  return (
    <div className="border-b border-idm-gold-warm/10 bg-gradient-to-b from-idm-gold-warm/[0.03] to-transparent">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        {/* Row 1: Title + Match Status */}
        <div className="flex items-center gap-2.5 pt-3 sm:pt-4">
          <div className="w-8 h-8 rounded-lg bg-idm-gold-warm/15 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-idm-gold-warm" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-foreground leading-tight">{title}</h1>
              {division !== 'semua' && <MatchStatusSummary division={division} />}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight hidden sm:block">{subtitle}</p>
          </div>
        </div>

        {/* Row 2: Division chips */}
        <div className="flex items-center justify-end gap-2 py-2.5 overflow-x-auto">
          <DivisionChips division={division} setDivision={setDivision} hideSemua={hideSemua} />
        </div>
      </div>

      {/* Tournament Info Header — below the main header for bracket view */}
      {showTournamentInfo && division !== 'semua' && (
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pb-3">
          <TournamentInfoHeader division={division} />
        </div>
      )}
      {showTournamentInfo && division === 'semua' && (
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pb-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
          <TournamentInfoHeader division="male" />
          <TournamentInfoHeader division="female" />
        </div>
      )}
    </div>
  );
}

/* ═══ Content renderer — shared logic for both views ═══ */
function ViewContent({
  mode,
  division,
}: {
  mode: 'results' | 'bracket';
  division: string;
}) {
  const divisionProp = division === 'female' ? 'female' as const : 'male' as const;
  const showBoth = division === 'semua';
  const ContentComponent = mode === 'results' ? ResultsContent : BracketContent;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
      <div className="mt-4 pb-6 space-y-4">
        {showBoth ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ContentComponent divisionProp="male" />
            <ContentComponent divisionProp="female" />
          </div>
        ) : (
          <ContentComponent divisionProp={divisionProp} />
        )}
      </div>
    </div>
  );
}

/* ═══ HASIL PAGE — Shows match results only (no tabs) ═══ */
export function HasilPage() {
  const { division, setDivision } = useAppStore();
  const isMobile = useIsMobile();

  /* On mobile: default to 'male' if division is 'semua' — no "Semua" tab on mobile */
  const effectiveDivision = isMobile && division === 'semua' ? 'male' : division;

  return (
    <div className="min-h-screen bg-background">
      <ViewHeader
        icon={Swords}
        title="Hasil"
        subtitle="Hasil pertandingan tarkam"
        division={effectiveDivision}
        setDivision={setDivision}
        hideSemua={isMobile}
        showTournamentInfo
      />
      <ViewContent mode="results" division={effectiveDivision} />
    </div>
  );
}

/* ═══ BRACKET PAGE — Shows bracket tree only (no tabs) ═══ */
export function BracketPage() {
  const { division, setDivision } = useAppStore();
  const isMobile = useIsMobile();

  /* On mobile: default to 'male' if division is 'semua' — no "Semua" tab on mobile bracket */
  const effectiveDivision = isMobile && division === 'semua' ? 'male' : division;

  /* Allow body overflow for bracket zoom/pan — prevents clipping */
  useEffect(() => {
    document.body.classList.add('bracket-overflow-active');
    return () => document.body.classList.remove('bracket-overflow-active');
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <ViewHeader
        icon={Trophy}
        title="Bracket"
        subtitle="Struktur bracket tarkam"
        division={effectiveDivision}
        setDivision={setDivision}
        hideSemua={isMobile}
        showTournamentInfo
      />
      <ViewContent mode="bracket" division={effectiveDivision} />
    </div>
  );
}
