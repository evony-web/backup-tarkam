'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { GitBranch, ArrowRight, Trophy, Eye } from 'lucide-react';
import { SectionHeader } from './shared';
import { useAppStore } from '@/lib/store';

/* ═══════════════════════════════════════════════════════════════
   BRACKET PREVIEW SECTION (Compact)
   Shows a compact bracket visualization for the current active
   tournament. Click to expand/navigate to full bracket view.
   Falls back to last completed tournament if no active one.
   ═══════════════════════════════════════════════════════════════ */

interface TeamData {
  id: string;
  name: string;
  isWinner: boolean;
  rank: number | null;
  teamPlayers: { player: { gamertag: string; avatar: string | null; tier: string } }[];
}

interface MatchData {
  id: string;
  round: number;
  matchNumber: number;
  bracket: string;
  format: string;
  team1Id: string | null;
  team2Id: string | null;
  score1: number | null;
  score2: number | null;
  status: string;
  winnerId: string | null;
  team1: TeamData | null;
  team2: TeamData | null;
  winner: { id: string; name: string } | null;
  mvpPlayer: { id: string; gamertag: string } | null;
}

interface TournamentDetailData {
  id: string;
  name: string;
  weekNumber: number;
  division: string;
  status: string;
  format: string;
  prizePool: number;
  teams: TeamData[];
  matches: MatchData[];
  season: { name: string; number: number };
  _count: { teams: number; matches: number; participations: number };
}

interface TournamentListData {
  id: string;
  name: string;
  weekNumber: number;
  division: string;
  status: string;
  seasonId: string;
  _count: { teams: number; matches: number; participations: number };
}

/* ─── Round label mapping ─── */
function getRoundLabel(round: number, totalRounds: number, bracket: string): string {
  if (bracket === 'grand_final') return 'Grand Final';
  if (bracket === 'upper') {
    if (round === totalRounds) return 'Final';
    if (round === totalRounds - 1) return 'Semi Final';
    return `Round ${round}`;
  }
  if (bracket === 'lower') {
    return `Lower R${round}`;
  }
  return `Round ${round}`;
}

/* ─── Compact match card ─── */
function CompactMatchCard({ match, totalRounds }: { match: MatchData; totalRounds: number }) {
  const isCompleted = match.status === 'completed';
  const isLive = match.status === 'live';
  const isPending = match.status === 'pending' || match.status === 'ready';

  const team1Won = match.winnerId === match.team1Id;
  const team2Won = match.winnerId === match.team2Id;

  return (
    <div className={`rounded-lg border p-2 sm:p-2.5 transition-all duration-200 ${
      isLive
        ? 'border-idm-gold-warm/30 bg-idm-gold-warm/[0.04] shadow-[0_0_12px_rgba(239,249,35,0.08)]'
        : isCompleted
        ? 'border-idm-gold-warm/10 bg-idm-gold-warm/[0.02]'
        : 'border-border/30 bg-muted/[0.02]'
    }`}>
      {/* Team 1 */}
      <div className={`flex items-center gap-1.5 text-[10px] sm:text-xs ${team1Won ? 'font-bold' : match.team1 ? '' : 'opacity-40'}`}>
        <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[7px] font-black ${
          team1Won ? 'bg-idm-gold-warm/20 text-idm-gold-warm' : 'bg-muted/30 text-muted-foreground'
        }`}>
          {team1Won ? '✓' : '1'}
        </span>
        <span className={`truncate flex-1 ${team1Won ? 'text-idm-gold-warm' : 'text-foreground/70'}`}>
          {match.team1?.name || 'TBD'}
        </span>
        <span className={`tabular-nums font-bold shrink-0 ${team1Won ? 'text-idm-gold-warm' : 'text-muted-foreground/60'}`}>
          {match.score1 ?? '-'}
        </span>
      </div>

      {/* Divider */}
      <div className="my-0.5 h-px bg-border/20" />

      {/* Team 2 */}
      <div className={`flex items-center gap-1.5 text-[10px] sm:text-xs ${team2Won ? 'font-bold' : match.team2 ? '' : 'opacity-40'}`}>
        <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[7px] font-black ${
          team2Won ? 'bg-idm-gold-warm/20 text-idm-gold-warm' : 'bg-muted/30 text-muted-foreground'
        }`}>
          {team2Won ? '✓' : '2'}
        </span>
        <span className={`truncate flex-1 ${team2Won ? 'text-idm-gold-warm' : 'text-foreground/70'}`}>
          {match.team2?.name || 'TBD'}
        </span>
        <span className={`tabular-nums font-bold shrink-0 ${team2Won ? 'text-idm-gold-warm' : 'text-muted-foreground/60'}`}>
          {match.score2 ?? '-'}
        </span>
      </div>

      {/* Live indicator */}
      {isLive && (
        <div className="mt-1 flex items-center justify-center gap-1">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
          </span>
          <span className="text-[8px] font-bold text-red-400 uppercase tracking-wider">LIVE</span>
        </div>
      )}
    </div>
  );
}

/* ─── Skeleton ─── */
function BracketSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="flex items-center justify-center gap-3 mb-4">
        <div className="h-5 w-24 rounded bg-idm-gold-warm/10" />
        <div className="h-5 w-20 rounded bg-idm-gold-warm/10" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-idm-gold-warm/5" />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export function BracketPreviewSection() {
  const { setCurrentView, setDivision } = useAppStore();
  const [selectedDiv, setSelectedDiv] = useState<'male' | 'female'>('male');

  /* Step 1: Fetch tournament list to find active/completed tournament */
  const { data: tournamentList, isLoading: isListLoading } = useQuery<TournamentListData[]>({
    queryKey: ['tournaments-list-bracket'],
    queryFn: async () => {
      const res = await fetch('/api/tournaments');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60000,
    refetchInterval: 300000,
    refetchIntervalInBackground: false,
  });

  /* Find the best tournament to show: active > last completed */
  const divTournaments = tournamentList?.filter(t => t.division === selectedDiv) || [];
  const activeTournament = divTournaments.find(t =>
    t.status !== 'completed' && t.status !== 'setup'
  );
  const lastCompleted = divTournaments.find(t => t.status === 'completed');
  const displayTournamentList = activeTournament || lastCompleted || null;

  /* Step 2: Fetch full tournament detail with matches */
  const { data: tournament, isLoading: isDetailLoading } = useQuery<TournamentDetailData>({
    queryKey: ['tournament-detail-bracket', displayTournamentList?.id],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${displayTournamentList!.id}`);
      if (!res.ok) throw new Error('Failed to fetch tournament');
      return res.json();
    },
    enabled: !!displayTournamentList?.id,
    staleTime: 60000,
  });

  const isLoading = isListLoading || (displayTournamentList && isDetailLoading);
  const hasMatches = tournament?.matches && tournament.matches.length > 0;
  const divisionColor = selectedDiv === 'male' ? 'idm-male' : 'idm-female';

  /* Group matches by round and bracket */
  const upperMatches = tournament?.matches?.filter(m => m.bracket === 'upper' || m.bracket === 'group') || [];
  const grandFinal = tournament?.matches?.filter(m => m.bracket === 'grand_final') || [];
  const lowerMatches = tournament?.matches?.filter(m => m.bracket === 'lower') || [];

  /* Group upper matches by round */
  const rounds = upperMatches.reduce<Record<number, MatchData[]>>((acc, m) => {
    if (!acc[m.round]) acc[m.round] = [];
    acc[m.round].push(m);
    return acc;
  }, {});
  const sortedRounds = Object.keys(rounds).map(Number).sort((a, b) => a - b);
  const totalRounds = sortedRounds.length > 0 ? sortedRounds[sortedRounds.length - 1] : 0;

  /* Determine max matches per round for compact display */
  const maxShowPerRound = 4;

  const handleViewFullBracket = () => {
    setDivision(selectedDiv);
    setCurrentView('bracket');
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  return (
    <section className="relative py-8 sm:py-12" aria-label="Preview Bracket">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        {/* Section Header */}
        <SectionHeader
          icon={GitBranch}
          label="Bracket"
          title="Preview Bracket"
          subtitle="Ringkasan bracket turnamen terkini"
        />

        {/* Division Toggle */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <button
            onClick={() => setSelectedDiv('male')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border ${
              selectedDiv === 'male'
                ? 'border-idm-male/30 bg-idm-male/10 text-idm-male'
                : 'border-idm-gold-warm/10 bg-transparent text-muted-foreground hover:border-idm-male/20 hover:text-idm-male/70'
            }`}
          >
            ♂ Cowo
          </button>
          <button
            onClick={() => setSelectedDiv('female')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border ${
              selectedDiv === 'female'
                ? 'border-idm-female/30 bg-idm-female/10 text-idm-female'
                : 'border-idm-gold-warm/10 bg-transparent text-muted-foreground hover:border-idm-female/20 hover:text-idm-female/70'
            }`}
          >
            ♀ Cewe
          </button>
        </div>

        {isLoading ? (
          <BracketSkeleton />
        ) : !displayTournamentList || !tournament ? (
          /* Empty state */
          <div className="text-center py-10 sm:py-14">
            <div className="relative inline-block mb-4">
              <div className="absolute inset-0 rounded-full bg-idm-gold-warm/5 blur-xl" aria-hidden="true" />
              <GitBranch className="relative w-12 h-12 sm:w-14 sm:h-14 text-idm-gold-warm/20" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground mb-1">Belum ada bracket tersedia</p>
            <p className="text-xs text-muted-foreground/60">Bracket akan muncul setelah turnamen dimulai</p>
          </div>
        ) : !hasMatches ? (
          /* Tournament exists but no matches yet */
          <div className="text-center py-8">
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-idm-gold-warm/10 bg-idm-gold-warm/[0.03] mb-4">
              <Trophy className="w-4 h-4 text-idm-gold-warm/50" />
              <div className="text-left">
                <p className="text-xs font-bold">{tournament.name}</p>
                <p className="text-[9px] text-muted-foreground">
                  {tournament.season?.name} • {tournament._count?.participations || 0} peserta
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground/60">Bracket belum digenerate</p>
          </div>
        ) : (
          <div className="relative">
            {/* Tournament info bar */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-5">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-${divisionColor}/10 text-${divisionColor} border-${divisionColor}/20`}>
                {selectedDiv === 'male' ? '♂ Cowo' : '♀ Cewe'}
              </span>

              <span className="text-xs sm:text-sm font-bold text-foreground">
                {tournament.name}
              </span>

              <span className="text-[10px] text-muted-foreground/60">
                {tournament.season?.name}
              </span>

              {/* Status */}
              {tournament.status === 'main_event' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border border-idm-gold-warm/20 bg-idm-gold-warm/5 text-idm-gold-warm animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-idm-gold-warm" />
                  LIVE
                </span>
              )}
              {tournament.status === 'completed' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border border-green-500/20 bg-green-500/5 text-green-400">
                  ✓ Selesai
                </span>
              )}

              <span className="text-[10px] text-muted-foreground/50">
                {tournament.matches.length} match
              </span>
            </div>

            {/* Compact bracket grid */}
            <div className="overflow-x-auto -mx-3 px-3 pb-2">
              <div className="flex gap-3 sm:gap-4 min-w-max">
                {/* Upper bracket rounds */}
                {sortedRounds.map(roundNum => {
                  const roundMatches = rounds[roundNum];
                  const shown = roundMatches.slice(0, maxShowPerRound);
                  const remaining = roundMatches.length - shown.length;
                  const roundLabel = getRoundLabel(roundNum, totalRounds, 'upper');

                  return (
                    <div key={`round-${roundNum}`} className="flex flex-col items-center">
                      {/* Round header */}
                      <div className="px-3 py-1.5 rounded-lg border border-idm-gold-warm/10 bg-idm-gold-warm/[0.03] mb-2">
                        <span className="text-[9px] font-bold text-idm-gold-warm/70 uppercase tracking-wider">
                          {roundLabel}
                        </span>
                      </div>

                      {/* Match cards */}
                      <div className="flex flex-col gap-1.5 justify-center flex-1">
                        {shown.map(match => (
                          <CompactMatchCard key={match.id} match={match} totalRounds={totalRounds} />
                        ))}
                        {remaining > 0 && (
                          <div className="text-center text-[9px] text-muted-foreground/40 py-1">
                            +{remaining} match lainnya
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Grand Final */}
                {grandFinal.length > 0 && (
                  <div className="flex flex-col items-center">
                    <div className="px-3 py-1.5 rounded-lg border border-idm-gold-warm/20 bg-idm-gold-warm/[0.06] mb-2">
                      <span className="text-[9px] font-bold text-idm-gold-warm uppercase tracking-wider">
                        🏆 Grand Final
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5 justify-center flex-1">
                      {grandFinal.map(match => (
                        <CompactMatchCard key={match.id} match={match} totalRounds={totalRounds} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Lower bracket (if exists) */}
                {lowerMatches.length > 0 && (() => {
                  const lowerRounds = lowerMatches.reduce<Record<number, MatchData[]>>((acc, m) => {
                    if (!acc[m.round]) acc[m.round] = [];
                    acc[m.round].push(m);
                    return acc;
                  }, {});
                  const sortedLowerRounds = Object.keys(lowerRounds).map(Number).sort((a, b) => a - b);

                  return sortedLowerRounds.map(roundNum => {
                    const roundMatches = lowerRounds[roundNum];
                    const shown = roundMatches.slice(0, maxShowPerRound);
                    const remaining = roundMatches.length - shown.length;

                    return (
                      <div key={`lower-round-${roundNum}`} className="flex flex-col items-center">
                        <div className="px-3 py-1.5 rounded-lg border border-idm-gold-warm/10 bg-idm-gold-warm/[0.03] mb-2">
                          <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider">
                            {getRoundLabel(roundNum, totalRounds, 'lower')}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1.5 justify-center flex-1">
                          {shown.map(match => (
                            <CompactMatchCard key={match.id} match={match} totalRounds={totalRounds} />
                          ))}
                          {remaining > 0 && (
                            <div className="text-center text-[9px] text-muted-foreground/40 py-1">
                              +{remaining} match lainnya
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Winner highlight (if completed) */}
            {tournament.status === 'completed' && tournament.teams && (
              <div className="mt-5 flex justify-center">
                <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-idm-gold-warm/15 bg-idm-gold-warm/[0.04]">
                  <Trophy className="w-4 h-4 text-idm-gold-warm" />
                  <span className="text-xs text-muted-foreground/70">Juara:</span>
                  <span className="text-sm font-bold text-idm-gold-warm">
                    {tournament.teams.find(t => t.isWinner)?.name || tournament.teams.find(t => t.rank === 1)?.name || '—'}
                  </span>
                </div>
              </div>
            )}

            {/* View Full Bracket CTA */}
            <div className="flex justify-center mt-5">
              <button
                onClick={handleViewFullBracket}
                className="btn-press group flex items-center gap-2 px-5 py-2.5 rounded-full border border-idm-gold-warm/20 bg-idm-gold-warm/[0.06] hover:bg-idm-gold-warm/10 hover:border-idm-gold-warm/30 transition-all cursor-pointer text-xs font-bold text-idm-gold-warm uppercase tracking-wider"
              >
                <Eye className="w-3.5 h-3.5" />
                Lihat Bracket Lengkap
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
