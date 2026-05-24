'use client';

import { useRef, useEffect, useState, useMemo, useCallback, Fragment } from 'react';
import { Badge } from '@/components/ui/badge';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { Crown, Music, Trophy, ZoomIn, ZoomOut, Maximize2, ChevronDown, ChevronUp, Swords, Play, Check, Undo2 } from 'lucide-react';

/* ─── Match interface ─── */
interface Match {
  id: string;
  score1: number | null;
  score2: number | null;
  status: string;
  team1: { id: string; name: string; power?: number } | null;
  team2: { id: string; name: string; power?: number } | null;
  mvpPlayer: { id: string; name: string; gamertag: string } | null;
  round?: number;
  matchNumber?: number;
  bracket?: string;
  groupLabel?: string;
  // Admin-specific fields (from tournament API)
  winnerId?: string | null;
  format?: string;
  team1Players?: string; // comma-separated gamertags for tooltip
  team2Players?: string;
}

/** Parse groupLabel (e.g., "U1-2", "U2-1", "SF1", "Final") to get bracket position.
 *  Position is 1-indexed within the round, used for determining feeder relationships. */
function getBracketPosition(groupLabel: string | undefined): number {
  if (!groupLabel) return 0;
  // Format: "U{round}-{position}" e.g., "U1-2" → position 2
  const match = groupLabel.match(/-(\d+)$/);
  if (match) return parseInt(match[1]);
  // Named labels: map to standard positions
  const namedPositions: Record<string, number> = {
    'QF1': 1, 'QF2': 2, 'QF3': 3, 'QF4': 4,
    'SF1': 1, 'SF2': 2,
    'Final': 1, '3rd': 2,
  };
  return namedPositions[groupLabel] || 0;
}

/** Parse groupLabel (e.g., "U1-2", "L2-1") to get bracket round number.
 *  Returns 0 if groupLabel doesn't match the expected format. */
function getBracketRound(groupLabel: string | undefined): number {
  if (!groupLabel) return 0;
  const match = groupLabel.match(/^[UL](\d+)-/);
  if (match) return parseInt(match[1]);
  return 0;
}

/** Check if a match has a decided winner (scores exist and are different). */
function matchHasWinner(m: Match): boolean {
  return !!(m.score1 !== null && m.score2 !== null && m.score1 !== m.score2);
}

/** Check if a match is a BYE placeholder (synthetic match for missing bracket positions). */
function isByePlaceholder(m: Match): boolean {
  return m.status === 'bye' && m.id.startsWith('bye-');
}

/** Fill missing R1 positions with BYE placeholder matches for proper bracket spacing.
 *  When teams get byes (e.g., 6 teams in an 8-slot bracket), no match is created for
 *  those positions. This function adds compact BYE placeholders so the bracket renders
 *  with correct vertical spacing and connector alignment. */
function fillByePlaceholders(
  rounds: { round: number; label: string; matches: Match[] }[],
  bracketPrefix: string = 'U'
): { round: number; label: string; matches: Match[] }[] {
  if (rounds.length === 0) return rounds;

  const totalRounds = rounds.length;
  const maxR1Positions = Math.pow(2, totalRounds - 1);
  const r1Matches = rounds[0].matches;

  const existingPositions = new Set(
    r1Matches.map(m => getBracketPosition(m.groupLabel)).filter(p => p > 0)
  );

  // No gaps or no positioned matches — nothing to fill
  if (existingPositions.size === 0 || existingPositions.size >= maxR1Positions) return rounds;

  const filledMatches = [...r1Matches];
  for (let pos = 1; pos <= maxR1Positions; pos++) {
    if (!existingPositions.has(pos)) {
      filledMatches.push({
        id: `bye-${bracketPrefix.toLowerCase()}1-${pos}`,
        score1: null,
        score2: null,
        status: 'bye',
        team1: null,
        team2: null,
        mvpPlayer: null,
        round: rounds[0].round,
        matchNumber: -pos,
        bracket: bracketPrefix === 'U' ? 'upper' : 'lower',
        groupLabel: `${bracketPrefix}1-${pos}`,
      });
    }
  }

  filledMatches.sort((a, b) => getBracketPosition(a.groupLabel) - getBracketPosition(b.groupLabel));

  const result = [...rounds];
  result[0] = { ...result[0], matches: filledMatches };
  return result;
}

interface AdminBracketProps {
  tournamentId: string;
  tournamentStatus: string;
  getTeamName: (id: string | null) => string;
  scoreInputs: Record<string, { s1: string; s2: string }>;
  setScoreInputs: React.Dispatch<React.SetStateAction<Record<string, { s1: string; s2: string }>>>;
  scoreMutation: { isPending: boolean; mutate: (data: any) => void };
  startMatchMutation: { isPending: boolean; mutate: (data: any) => void };
  undoScoreMutation: { isPending: boolean; mutate: (data: any) => void };
  setConfirmDialog: React.Dispatch<React.SetStateAction<any>>;
}

interface BracketViewProps {
  matches: Match[];
  bracketType: 'single_elimination' | 'group_stage' | 'round_robin' | 'swiss' | 'upper_semi';
  mode?: 'public' | 'admin';
  adminProps?: AdminBracketProps;
}

/* ─── Round labels ─── */
function getRoundLabel(roundIdx: number, totalRounds: number): string {
  if (totalRounds <= 2) {
    return roundIdx === 0 ? 'Semi Final' : 'Final';
  }
  const fromEnd = totalRounds - 1 - roundIdx;
  if (fromEnd === 0) return 'Grand Final';
  if (fromEnd === 1) return 'Semi Final';
  if (fromEnd === 2) return 'Quarter Final';
  return `Ronde ${roundIdx + 1}`;
}

/* ─── Single bracket match card — MPL Premium Style ─── */
interface BracketMatchCardProps {
  match: Match;
  isGrandFinal?: boolean;
  matchLabel?: string;
  mode?: 'public' | 'admin';
  adminProps?: AdminBracketProps;
  onExpand?: (match: Match) => void;
}

function BracketMatchCard({ match, isGrandFinal, matchLabel, mode = 'public', adminProps, onExpand }: BracketMatchCardProps) {
  const dt = useDivisionTheme();
  const isAdmin = mode === 'admin' && !!adminProps;
  const [expanded, setExpanded] = useState(false);

  // BYE placeholder — compact card for missing bracket positions (no match was played)
  if (isByePlaceholder(match)) {
    return (
      <div
        className="bracket-match-card rounded-lg overflow-hidden border border-dashed border-muted-foreground/20 opacity-30"
        style={{ background: 'var(--card-bg, rgba(20,17,10,0.3))', minWidth: '180px' }}
      >
        <div className="flex items-center justify-between px-2 py-0.5 border-b border-dashed border-muted-foreground/15 bg-muted/20">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/50">BYE</span>
          <span className="text-xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400/50 rounded px-1 py-0.5">WALKOVER</span>
        </div>
        <div className="flex items-center px-2 py-1.5 gap-1.5 opacity-50">
          <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-black bg-muted/30 text-muted-foreground/40">-</div>
          <span className="text-xs font-semibold text-muted-foreground/40 flex-1">BYE</span>
          <span className="text-sm font-black text-muted-foreground/30 min-w-[20px] text-center">-</span>
        </div>
        <div className="flex items-center px-2 py-1.5 gap-1.5 opacity-50 border-t border-dashed border-muted-foreground/15">
          <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-black bg-muted/30 text-muted-foreground/40">-</div>
          <span className="text-xs font-semibold text-muted-foreground/40 flex-1">-</span>
          <span className="text-sm font-black text-muted-foreground/30 min-w-[20px] text-center">-</span>
        </div>
      </div>
    );
  }

  const hasScore = match.score1 !== null && match.score2 !== null;
  const winner1 = hasScore && match.score1! > match.score2!;
  const winner2 = hasScore && match.score2! > match.score1!;
  const isLive = match.status === 'live' || match.status === 'main_event';
  const isCompleted = match.status === 'completed' || match.status === 'scoring';
  const isReady = match.status === 'ready';
  const isPending = match.status === 'pending';
  const isByeMatch = (!match.team1 || !match.team2) && (match.team1 || match.team2) && !isCompleted;
  const bothTeamsExist = !!(match.team1 && match.team2);
  const tournamentInMainEvent = isAdmin && adminProps!.tournamentStatus === 'main_event';

  // Check if both scores are entered for submit button visibility
  const bothScoresEntered = isAdmin && isLive && tournamentInMainEvent &&
    scoreInputVal(match.id, 's1') !== '' && scoreInputVal(match.id, 's2') !== '';

  // Helper to get score input value
  function scoreInputVal(matchId: string, key: 's1' | 's2'): string {
    if (!adminProps) return '';
    return adminProps.scoreInputs[matchId]?.[key] ?? '';
  }

  // Handle submit score
  const handleSubmitScore = () => {
    if (!adminProps) return;
    const s1 = parseInt(scoreInputVal(match.id, 's1'));
    const s2 = parseInt(scoreInputVal(match.id, 's2'));
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) return;
    adminProps.setConfirmDialog({
      open: true,
      title: 'Konfirmasi Skor?',
      description: `${adminProps.getTeamName(match.team1?.id ?? null)} ${s1} - ${s2} ${adminProps.getTeamName(match.team2?.id ?? null)}`,
      onConfirm: () => adminProps!.scoreMutation.mutate({ tournamentId: adminProps!.tournamentId, matchId: match.id, score1: s1, score2: s2 }),
    });
  };

  // Handle undo
  const handleUndo = () => {
    if (!adminProps) return;
    adminProps.setConfirmDialog({
      open: true,
      title: 'Undo Skor?',
      description: `Batalkan skor ${adminProps.getTeamName(match.team1?.id ?? null)} ${match.score1} - ${match.score2} ${adminProps.getTeamName(match.team2?.id ?? null)}? Stats pemain akan dikembalikan.`,
      onConfirm: () => adminProps!.undoScoreMutation.mutate({ tournamentId: adminProps!.tournamentId, matchId: match.id }),
    });
  };

  // Division accent colors for winner highlight
  const divisionAccentFrom = dt.division === 'male' ? 'from-idm-male/25' : 'from-idm-female/25';
  const divisionAccentTo = dt.division === 'male' ? 'to-idm-male-light/10' : 'to-idm-female-light/10';
  const divisionAccentBar = dt.division === 'male' ? 'bg-idm-male' : 'bg-idm-female';
  const divisionAccentText = dt.division === 'male' ? 'text-idm-male' : 'text-idm-female';

  // Helper to get team display name
  const getTeamLabel = (team: { id: string; name: string } | null) => {
    if (team) return team.name;
    return 'TBD';
  };

  // Helper to get team score display
  const getTeamScore = (team: { id: string; name: string } | null, score: number | null) => {
    if (!team) {
      if (match.status === 'pending' || match.status === 'ready') return '-';
      return hasScore ? score : '-';
    }
    if (hasScore) return score;
    return '-';
  };

  return (
    <div
      className={`bracket-match-card rounded-xl overflow-hidden ${
        isLive ? `border-2 border-red-500/60 ${dt.neonPulse}` :
        isCompleted ? `border ${dt.border}` :
        `border ${dt.borderSubtle}`
      } transition-all hover:shadow-lg relative ${
        isGrandFinal ? 'shadow-[0_0_24px_rgba(239,249,35,0.15)] border-idm-gold-warm/40' : ''
      }`}
      style={{ 
        background: isGrandFinal ? 'rgba(239,249,35,0.04)' : 'var(--card-bg, rgba(20,17,10,0.6))',
        minWidth: isGrandFinal ? '200px' : '180px'
      }}
    >
      {/* Match label bar — MPL style round indicator */}
      {(matchLabel || isLive || isByeMatch || isAdmin) && (
        <div className={`flex items-center justify-between px-2.5 py-1 border-b ${dt.borderSubtle} ${
          isGrandFinal ? 'bg-idm-gold-warm/10' : 'bg-muted/30'
        }`}>
          <div className="flex items-center gap-1.5">
            {matchLabel && (
              <span className={`text-[10px] font-bold uppercase tracking-wider ${
                isGrandFinal ? 'text-idm-gold-warm' : 'text-muted-foreground/70'
              }`}>{matchLabel}</span>
            )}
            {/* Admin: Start button for ready/pending matches */}
            {isAdmin && (isReady || isPending) && bothTeamsExist && tournamentInMainEvent && (
              <button 
                onClick={() => adminProps!.startMatchMutation.mutate({ tournamentId: adminProps!.tournamentId, matchId: match.id })}
                disabled={adminProps!.startMatchMutation.isPending}
                className="compact-pill flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-green-500/15 text-green-400 hover:bg-green-500/25 border border-green-500/25 transition-colors disabled:opacity-50"
              >
                <Play className="w-2.5 h-2.5" /> Start
              </button>
            )}
            {isLive && (
              <div className="flex items-center gap-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                </span>
                <span className="text-[9px] font-black uppercase tracking-widest text-red-500">LIVE</span>
              </div>
            )}
            {isAdmin && isCompleted && tournamentInMainEvent && (
              <span className="text-[9px] font-bold text-green-400">✅</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {isByeMatch && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/25 rounded">WALKOVER</span>
            )}
            {isAdmin && match.format && (
              <span className="text-[9px] font-bold text-muted-foreground/60">{match.format}</span>
            )}
          </div>
        </div>
      )}

      {/* Team 1 row */}
      <div className={`relative flex items-center border-b ${dt.borderSubtle} ${
        !match.team1 ? 'opacity-40' : ''
      }`}>
        {/* Left accent bar — winner highlight (4px for MPL prominence) */}
        {winner1 && (
          <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${divisionAccentBar}`} />
        )}
        {/* Winner gradient background */}
        {winner1 && (
          <div className={`absolute inset-0 bg-gradient-to-r ${divisionAccentFrom} ${divisionAccentTo} pointer-events-none`} />
        )}
        <div className="relative flex items-center px-2.5 py-2 w-full gap-2">
          {/* Team abbreviation avatar — bigger for MPL */}
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
            winner1 ? `bg-gradient-to-br ${dt.division === 'male' ? 'from-idm-male to-idm-male-light' : 'from-idm-female to-idm-female-light'} text-white shadow-sm` :
            `${dt.iconBg} ${dt.text}`
          }`}>
            {getTeamLabel(match.team1).slice(0, 2).toUpperCase()}
          </div>
          {/* Team name + power rating + admin player gamertags */}
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className={`text-sm font-semibold truncate ${
                winner1 ? divisionAccentText :
                !match.team1 ? 'text-muted-foreground italic' :
                'text-foreground/80'
              }`}>
                {getTeamLabel(match.team1)}
              </span>
              {/* Power rating indicator */}
              {match.team1 && (match.team1.power ?? 0) > 0 && (
                <span className="text-[9px] font-bold text-idm-gold-warm/60 shrink-0">⚡{match.team1.power}</span>
              )}
            </div>
            {isAdmin && match.team1Players && (
              <span className="text-[9px] text-muted-foreground/50 truncate">{match.team1Players}</span>
            )}
          </div>
          {/* Score: admin mode shows input when live, otherwise score pill */}
          {isAdmin && isLive && tournamentInMainEvent ? (
            <input 
              type="number" 
              min={0}
              value={scoreInputVal(match.id, 's1')}
              onChange={e => adminProps!.setScoreInputs(prev => ({...prev, [match.id]: {...prev[match.id] ?? {s1:'', s2:''}, s1: e.target.value}}))}
              className="w-10 h-7 text-center text-sm font-black bg-background/50 border border-border/40 rounded-md focus:border-idm-gold-warm/50 focus:outline-none tabular-nums"
              placeholder="0"
            />
          ) : (
            <span className={`text-lg font-black tabular-nums min-w-[28px] text-center px-1.5 py-0.5 rounded ${
              winner1 
                ? `${dt.division === 'male' ? 'bg-idm-male/15 text-idm-male' : 'bg-idm-female/15 text-idm-female'}` 
                : 'text-muted-foreground'
            }`}>
              {getTeamScore(match.team1, match.score1)}
            </span>
          )}
        </div>
      </div>

      {/* Team 2 row */}
      <div className={`relative flex items-center ${
        !match.team2 ? 'opacity-40' : ''
      }`}>
        {/* Left accent bar — winner highlight */}
        {winner2 && (
          <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-b-xl ${divisionAccentBar}`} />
        )}
        {/* Winner gradient background */}
        {winner2 && (
          <div className={`absolute inset-0 bg-gradient-to-r ${divisionAccentFrom} ${divisionAccentTo} pointer-events-none`} />
        )}
        <div className="relative flex items-center px-2.5 py-2 w-full gap-2">
          {/* Team abbreviation avatar */}
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
            winner2 ? `bg-gradient-to-br ${dt.division === 'male' ? 'from-idm-male to-idm-male-light' : 'from-idm-female to-idm-female-light'} text-white shadow-sm` :
            `${dt.iconBg} ${dt.text}`
          }`}>
            {getTeamLabel(match.team2).slice(0, 2).toUpperCase()}
          </div>
          {/* Team name + power rating + admin player gamertags */}
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className={`text-sm font-semibold truncate ${
                winner2 ? divisionAccentText :
                !match.team2 ? 'text-muted-foreground italic' :
                'text-foreground/80'
              }`}>
                {getTeamLabel(match.team2)}
              </span>
              {/* Power rating indicator */}
              {match.team2 && (match.team2.power ?? 0) > 0 && (
                <span className="text-[9px] font-bold text-idm-gold-warm/60 shrink-0">⚡{match.team2.power}</span>
              )}
            </div>
            {isAdmin && match.team2Players && (
              <span className="text-[9px] text-muted-foreground/50 truncate">{match.team2Players}</span>
            )}
          </div>
          {/* Score: admin mode shows input when live, otherwise score pill */}
          {isAdmin && isLive && tournamentInMainEvent ? (
            <input 
              type="number" 
              min={0}
              value={scoreInputVal(match.id, 's2')}
              onChange={e => adminProps!.setScoreInputs(prev => ({...prev, [match.id]: {...prev[match.id] ?? {s1:'', s2:''}, s2: e.target.value}}))}
              className="w-10 h-7 text-center text-sm font-black bg-background/50 border border-border/40 rounded-md focus:border-idm-gold-warm/50 focus:outline-none tabular-nums"
              placeholder="0"
            />
          ) : (
            <span className={`text-lg font-black tabular-nums min-w-[28px] text-center px-1.5 py-0.5 rounded ${
              winner2 
                ? `${dt.division === 'male' ? 'bg-idm-male/15 text-idm-male' : 'bg-idm-female/15 text-idm-female'}` 
                : 'text-muted-foreground'
            }`}>
              {getTeamScore(match.team2, match.score2)}
            </span>
          )}
        </div>
      </div>

      {/* MVP indicator */}
      {match.mvpPlayer && (
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 border-t ${dt.borderSubtle} bg-yellow-500/[0.04]`}>
          <Crown className="w-3 h-3 text-yellow-500 shrink-0" />
          <span className="text-[11px] text-yellow-500/80 font-semibold truncate">MVP: {match.mvpPlayer.gamertag}</span>
        </div>
      )}

      {/* Match status indicator — click to expand */}
      {!isAdmin && bothTeamsExist && (isLive || isCompleted) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 px-2.5 py-1 border-t border-border/10 hover:bg-muted/10 transition-colors cursor-pointer"
        >
          {isLive && !expanded && (
            <span className="flex items-center gap-1 text-[9px] text-red-500 font-bold">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
              </span>
              LIVE — tap for details
            </span>
          )}
          {isCompleted && !expanded && (
            <span className="flex items-center gap-1 text-[9px] text-green-500 font-bold">
              ✓ COMPLETED — tap for details
            </span>
          )}
          {expanded && (
            <span className="text-[9px] text-muted-foreground">▲ close</span>
          )}
        </button>
      )}

      {/* Expanded match detail (public mode) */}
      {!isAdmin && expanded && bothTeamsExist && (
        <div className="px-2.5 py-2 border-t border-border/10 space-y-1.5 bg-muted/5">
          {/* Format */}
          {match.format && (
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground/50">Format</span>
              <span className="font-semibold">{match.format}</span>
            </div>
          )}
          {/* Bracket/Round */}
          {match.bracket && (
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground/50">Bracket</span>
              <span className="font-semibold capitalize">{match.bracket.replace('_', ' ')}</span>
            </div>
          )}
          {/* Power comparison */}
          {match.team1 && match.team2 && ((match.team1.power ?? 0) > 0 || (match.team2.power ?? 0) > 0) && (
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground/50">Power</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{match.team1.power}</span>
                <div className="w-20 h-1.5 rounded-full bg-muted/30 overflow-hidden flex">
                  <div
                    className="h-full bg-idm-male/40 rounded-l-full"
                    style={{ width: `${(match.team1.power! / (match.team1.power! + match.team2.power!)) * 100}%` }}
                  />
                  <div
                    className="h-full bg-idm-female/40 rounded-r-full"
                    style={{ width: `${(match.team2.power! / (match.team1.power! + match.team2.power!)) * 100}%` }}
                  />
                </div>
                <span className="font-semibold">{match.team2.power}</span>
              </div>
            </div>
          )}
          {/* MVP */}
          {match.mvpPlayer && (
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground/50">MVP</span>
              <span className="font-semibold text-yellow-500">⭐ {match.mvpPlayer.gamertag}</span>
            </div>
          )}
        </div>
      )}

      {/* Submit button row (when admin, live, both scores entered) */}
      {isAdmin && isLive && tournamentInMainEvent && bothScoresEntered && (
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 border-t ${dt.borderSubtle}`}>
          <button 
            onClick={handleSubmitScore}
            disabled={adminProps!.scoreMutation.isPending}
            className="compact-pill flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-idm-gold-warm/20 text-idm-gold-warm hover:bg-idm-gold-warm/30 border border-idm-gold-warm/30 transition-colors disabled:opacity-50"
          >
            <Check className="w-3 h-3" /> Submit
          </button>
        </div>
      )}

      {/* Undo button for completed matches */}
      {isAdmin && isCompleted && tournamentInMainEvent && bothTeamsExist && (
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 border-t ${dt.borderSubtle}`}>
          <button
            onClick={handleUndo}
            disabled={adminProps!.undoScoreMutation.isPending}
            className="compact-pill flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-orange-400 hover:bg-orange-400/10 border border-orange-400/25 transition-colors disabled:opacity-50"
          >
            <Undo2 className="w-3 h-3" /> Undo
          </button>
        </div>
      )}

      {/* Grand Final champion crown — more prominent */}
      {isGrandFinal && isCompleted && (winner1 || winner2) && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-idm-gold-warm/25 border-2 border-idm-gold-warm/50 shadow-[0_0_16px_rgba(239,249,35,0.4)]">
            <Crown className="w-4 h-4 text-idm-gold-warm" />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── SVG Connector Lines Component — MPL Premium Style ─── */
interface ConnectorPath {
  key: string;
  d: string;
  color: string;
  isWinner?: boolean;
}

function BracketConnectors({ paths }: { paths: ConnectorPath[] }) {
  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%', overflow: 'visible' }}
    >
      {paths.map((p) => {
        const isDot = p.key.endsWith('-dot');

        if (isDot) {
          const dotMatch = p.d.match(/M ([\d.]+) ([\d.]+) h ([\d.]+)/);
          if (dotMatch) {
            const cx = parseFloat(dotMatch[1]) + parseFloat(dotMatch[3]) / 2;
            const cy = parseFloat(dotMatch[2]);
            return (
              <g key={p.key}>
                {/* Dot outer glow — MPL prominent */}
                <circle cx={cx} cy={cy} r="8" fill={p.color} opacity="0.12" />
                {/* Dot inner glow */}
                <circle cx={cx} cy={cy} r="5" fill={p.color} opacity={p.isWinner ? "0.6" : "0.3"} />
                {/* Dot bright center */}
                {p.isWinner && <circle cx={cx} cy={cy} r="2.5" fill={p.color} opacity="0.9" />}
              </g>
            );
          }
        }

        return (
          <g key={p.key}>
            {/* Glow layer — wide, faded for MPL neon */}
            <path
              d={p.d}
              stroke={p.color}
              strokeWidth="8"
              fill="none"
              opacity="0.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Main line — solid for mobile readability */}
            <path
              d={p.d}
              stroke={p.color}
              strokeWidth="2.5"
              fill="none"
              opacity={p.isWinner ? "0.6" : "0.25"}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Winner path bright center — thin bright line */}
            {p.isWinner && (
              <path
                d={p.d}
                stroke={p.color}
                strokeWidth="1"
                fill="none"
                opacity="0.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Zoomable Container — Touch pinch-zoom + drag-pan for mobile ─── */
function ZoomableContainer({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Use refs for transform state to avoid re-renders during active gestures
  const scaleRef = useRef(1);
  const translateRef = useRef({ x: 0, y: 0 });
  const [displayState, setDisplayState] = useState({ scale: 1, tx: 0, ty: 0, isAnimating: false });
  const [isInteracting, setIsInteracting] = useState(false);
  const [isMouseDragging, setIsMouseDragging] = useState(false);

  const isDragging = useRef(false);
  const lastTouchDist = useRef(0);
  const lastTouchCenter = useRef({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const mouseDragStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const rafId = useRef<number>(0);

  // Double-tap detection
  const lastTapTime = useRef(0);
  const lastTapPos = useRef({ x: 0, y: 0 });

  const MIN_SCALE = 0.5;
  const MAX_SCALE = 3;

  /* Flush transform from refs to the DOM via rAF */
  const flushTransform = useCallback((animate = false) => {
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      setDisplayState({
        scale: scaleRef.current,
        tx: translateRef.current.x,
        ty: translateRef.current.y,
        isAnimating: animate,
      });
    });
  }, []);

  const handleZoom = useCallback((newScale: number) => {
    scaleRef.current = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
    flushTransform(true);
  }, [flushTransform]);

  const resetZoom = useCallback(() => {
    scaleRef.current = 1;
    translateRef.current = { x: 0, y: 0 };
    flushTransform(true);
    setIsInteracting(false);
  }, [flushTransform]);

  /* Double-tap to reset zoom */
  const handleDoubleTap = useCallback((x: number, y: number) => {
    const now = Date.now();
    const dt = now - lastTapTime.current;
    const dx = x - lastTapPos.current.x;
    const dy = y - lastTapPos.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dt < 300 && dist < 30) {
      // Double-tap detected — reset zoom
      resetZoom();
      lastTapTime.current = 0;
    } else {
      lastTapTime.current = now;
      lastTapPos.current = { x, y };
    }
  }, [resetZoom]);

  /* Touch: pinch-to-zoom + drag-to-pan */
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch start
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDist.current = Math.sqrt(dx * dx + dy * dy);
      lastTouchCenter.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
      isDragging.current = false;
      setIsInteracting(true);
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      // Check for double-tap
      handleDoubleTap(touch.clientX, touch.clientY);

      if (scaleRef.current > 1) {
        // Pan start (only when zoomed in)
        isDragging.current = true;
        dragStart.current = {
          x: touch.clientX,
          y: touch.clientY,
          tx: translateRef.current.x,
          ty: translateRef.current.y,
        };
      }
    }
  }, [handleDoubleTap]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (lastTouchDist.current > 0) {
        const delta = dist / lastTouchDist.current;
        scaleRef.current = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scaleRef.current * delta));
      }
      lastTouchDist.current = dist;

      // Pan while pinching
      const center = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
      translateRef.current = {
        x: translateRef.current.x + (center.x - lastTouchCenter.current.x),
        y: translateRef.current.y + (center.y - lastTouchCenter.current.y),
      };
      lastTouchCenter.current = center;
      flushTransform(false);
    } else if (e.touches.length === 1 && isDragging.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - dragStart.current.x;
      const dy = e.touches[0].clientY - dragStart.current.y;
      translateRef.current = {
        x: dragStart.current.tx + dx,
        y: dragStart.current.ty + dy,
      };
      flushTransform(false);
    }
  }, [flushTransform]);

  const handleTouchEnd = useCallback(() => {
    lastTouchDist.current = 0;
    isDragging.current = false;
    if (scaleRef.current <= 1) {
      setIsInteracting(false);
    }
  }, []);

  /* Mouse drag-to-pan for desktop (when zoomed in) */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scaleRef.current > 1 && e.button === 0) {
      e.preventDefault();
      mouseDragStart.current = {
        x: e.clientX,
        y: e.clientY,
        tx: translateRef.current.x,
        ty: translateRef.current.y,
      };
      setIsInteracting(true);
      setIsMouseDragging(true);
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (mouseDragStart.current) {
      const dx = e.clientX - mouseDragStart.current.x;
      const dy = e.clientY - mouseDragStart.current.y;
      translateRef.current = {
        x: mouseDragStart.current.tx + dx,
        y: mouseDragStart.current.ty + dy,
      };
      flushTransform(false);
    }
  }, [flushTransform]);

  const handleMouseUp = useCallback(() => {
    mouseDragStart.current = null;
    setIsMouseDragging(false);
    if (scaleRef.current <= 1) {
      setIsInteracting(false);
    }
  }, []);

  /* Wheel zoom for desktop trackpad */
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      scaleRef.current = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scaleRef.current * delta));
      flushTransform(true);
    }
  }, [flushTransform]);

  // Cleanup rAF on unmount
  useEffect(() => {
    return () => cancelAnimationFrame(rafId.current);
  }, []);

  const cursorStyle = displayState.scale > 1
    ? (isMouseDragging ? 'grabbing' : 'grab')
    : 'default';

  return (
    <div className="relative">
      {/* Zoom controls — mobile only, positioned top area */}
      <div className="lg:hidden flex items-center gap-1.5 mb-2 px-1">
        <button
          onClick={() => handleZoom(displayState.scale - 0.25)}
          className="compact-pill flex items-center justify-center w-9 h-9 rounded-lg bg-background/90 hover:bg-muted border border-border/60 shadow-sm transition-colors active:scale-95"
          aria-label="Zoom out"
        >
          <ZoomOut className="w-4 h-4 text-foreground" />
        </button>
        <div className="px-2.5 py-1 rounded-md bg-background/90 border border-border/60 text-xs font-semibold tabular-nums min-w-[3.2rem] text-center shadow-sm">
          {Math.round(displayState.scale * 100)}%
        </div>
        <button
          onClick={() => handleZoom(displayState.scale + 0.25)}
          className="compact-pill flex items-center justify-center w-9 h-9 rounded-lg bg-background/90 hover:bg-muted border border-border/60 shadow-sm transition-colors active:scale-95"
          aria-label="Zoom in"
        >
          <ZoomIn className="w-4 h-4 text-foreground" />
        </button>
        <button
          onClick={resetZoom}
          className="compact-pill flex items-center justify-center w-9 h-9 rounded-lg bg-background/90 hover:bg-muted border border-border/60 shadow-sm transition-colors active:scale-95"
          aria-label="Reset zoom"
        >
          <Maximize2 className="w-3.5 h-3.5 text-foreground" />
        </button>
        <span className="text-[10px] text-muted-foreground ml-2">Pinch to zoom • Drag to pan</span>
      </div>

      {/* Desktop zoom hint — shown when zoomed in */}
      {displayState.scale > 1 && (
        <div className="hidden lg:flex items-center gap-1.5 mb-2 px-1">
          <div className="px-2.5 py-1 rounded-md bg-background/90 border border-border/60 text-xs font-semibold tabular-nums min-w-[3.2rem] text-center shadow-sm">
            {Math.round(displayState.scale * 100)}%
          </div>
          <button
            onClick={resetZoom}
            className="flex items-center justify-center h-7 px-2 rounded-md bg-background/90 hover:bg-muted border border-border/60 text-xs font-medium shadow-sm transition-colors"
            aria-label="Reset zoom"
          >
            <Maximize2 className="w-3 h-3 text-foreground mr-1" />
            Reset
          </button>
          <span className="text-[10px] text-muted-foreground ml-1">Ctrl+Scroll to zoom • Drag to pan</span>
        </div>
      )}

      {/* Scrollable/pannable container
          - At scale=1: overflow-x-auto allows native horizontal scroll (bracket wider than screen)
          - At scale>1 or interacting: overflow-hidden + touch-none for custom zoom/pan
          - custom-scrollbar: thin gold scrollbar on desktop, hidden on mobile (touch scroll) */}
      <div
        ref={containerRef}
        className={`rounded-lg relative select-none ${
          displayState.scale > 1 || isInteracting
            ? 'overflow-hidden touch-none'
            : 'overflow-x-auto overflow-y-hidden custom-scrollbar'
        }`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: cursorStyle }}
      >
        <div
          ref={contentRef}
          className="origin-top-left"
          style={{
            transform: `translate(${displayState.tx}px, ${displayState.ty}px) scale(${displayState.scale})`,
            transformOrigin: '0 0',
            willChange: isInteracting ? 'transform' : 'auto',
            transition: displayState.isAnimating && !isInteracting ? 'transform 200ms ease-out' : 'none',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─── Group Stage Playoff Bracket — Double Elimination with SVG Connectors ─── */
function GroupStagePlayoffBracket({ playoffMatches, mode, adminProps }: { playoffMatches: Match[]; mode?: 'public' | 'admin'; adminProps?: AdminBracketProps }) {
  const dt = useDivisionTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [connectors, setConnectors] = useState<ConnectorPath[]>([]);

  // Separate matches by bracket type
  const upperMatches = useMemo(() => playoffMatches.filter(m => m.bracket === 'upper'), [playoffMatches]);
  const lowerMatches = useMemo(() => playoffMatches.filter(m => m.bracket === 'lower'), [playoffMatches]);
  const gfMatches = useMemo(() => playoffMatches.filter(m => m.bracket === 'grand_final'), [playoffMatches]);

  // Group UB matches by round, sorted ascending
  const upperRounds = useMemo(() => {
    const grouped = new Map<number, Match[]>();
    upperMatches.forEach(m => {
      const round = m.round ?? 1;
      if (!grouped.has(round)) grouped.set(round, []);
      grouped.get(round)!.push(m);
    });
    const rounds = Array.from(grouped.entries())
      .sort(([a], [b]) => a - b)
      .map(([round, roundMatches]) => ({
        round,
        label: getUpperSemiRoundLabel(round, 'upper', playoffMatches),
        matches: [...roundMatches].sort((a, b) => {
          const posA = getBracketPosition(a.groupLabel);
          const posB = getBracketPosition(b.groupLabel);
          if (posA && posB) return posA - posB;
          return (a.matchNumber ?? 0) - (b.matchNumber ?? 0);
        }),
      }));
    return fillByePlaceholders(rounds, 'U');
  }, [upperMatches, playoffMatches]);

  // Group LB matches by round, sorted ascending
  const lowerRounds = useMemo(() => {
    const grouped = new Map<number, Match[]>();
    lowerMatches.forEach(m => {
      const round = m.round ?? 1;
      if (!grouped.has(round)) grouped.set(round, []);
      grouped.get(round)!.push(m);
    });
    const rounds = Array.from(grouped.entries())
      .sort(([a], [b]) => a - b)
      .map(([round, roundMatches]) => ({
        round,
        label: getUpperSemiRoundLabel(round, 'lower', playoffMatches),
        matches: [...roundMatches].sort((a, b) => {
          const posA = getBracketPosition(a.groupLabel);
          const posB = getBracketPosition(b.groupLabel);
          if (posA && posB) return posA - posB;
          return (a.matchNumber ?? 0) - (b.matchNumber ?? 0);
        }),
      }));
    return fillByePlaceholders(rounds, 'L');
  }, [lowerMatches, playoffMatches]);

  const hasUpper = upperRounds.length > 0;
  const hasLower = lowerRounds.length > 0;
  const hasGF = gfMatches.length > 0;

  // Division accent colors
  const divisionColor = dt.color;
  const lowerColor = '#f97316'; // Orange for lower bracket
  const gfColor = 'rgba(239,249,35,0.7)'; // Gold for grand final

  /* ─── Unified connector calculation for UB + LB + GF ─── */
  const calculateConnectors = useCallback(() => {
    if (!containerRef.current) {
      setConnectors([]);
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const newConnectors: ConnectorPath[] = [];

    // Helper to get card position
    const getCardPos = (key: string) => {
      const el = cardRefs.current.get(key);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        x: rect.left - containerRect.left,
        right: rect.right - containerRect.left,
        y: rect.top + rect.height / 2 - containerRect.top,
        width: rect.width,
        height: rect.height,
      };
    };

    // ── Within-bracket connectors (same algorithm as UpperSemiView) ──
    const calculateBracketConnectors = (
      rounds: { round: number; label: string; matches: Match[] }[],
      prefix: string,
      strokeColor: string,
    ) => {
      if (rounds.length < 2) return;

      // Build position lookup for each round
      const positionLookupByRound: Map<number, Map<number, Match>> = new Map();
      for (let r = 0; r < rounds.length; r++) {
        const lookup = new Map<number, Match>();
        for (const m of rounds[r].matches) {
          const pos = getBracketPosition(m.groupLabel);
          if (pos > 0) lookup.set(pos, m);
        }
        positionLookupByRound.set(r, lookup);
      }

      for (let r = 0; r < rounds.length - 1; r++) {
        const sourceRound = rounds[r];
        const targetRoundIdx = r + 1;
        const targetPositionLookup = positionLookupByRound.get(targetRoundIdx) || new Map();

        const targetGroups = new Map<string, { sources: Match[]; target: Match }>();
        const hasPositions = sourceRound.matches.some(m => getBracketPosition(m.groupLabel) > 0);

        if (hasPositions) {
          for (const sourceMatch of sourceRound.matches) {
            const sourcePos = getBracketPosition(sourceMatch.groupLabel);
            if (sourcePos <= 0) continue;
            if (isByePlaceholder(sourceMatch)) continue;
            const targetPos = Math.ceil(sourcePos / 2);
            const targetMatch = targetPositionLookup.get(targetPos);
            if (!targetMatch) continue;

            const targetKey = targetMatch.id;
            if (!targetGroups.has(targetKey)) {
              targetGroups.set(targetKey, { sources: [], target: targetMatch });
            }
            targetGroups.get(targetKey)!.sources.push(sourceMatch);
          }
        } else {
          const targetRound = rounds[targetRoundIdx];
          for (let ni = 0; ni < targetRound.matches.length; ni++) {
            const targetMatch = targetRound.matches[ni];
            const source1 = sourceRound.matches[ni * 2] || null;
            const source2 = sourceRound.matches[ni * 2 + 1] || null;
            const sources = [source1, source2].filter(Boolean).filter(s => !isByePlaceholder(s)) as Match[];
            if (sources.length === 0) continue;
            targetGroups.set(targetMatch.id, { sources, target: targetMatch });
          }
        }

        for (const [targetKey, group] of targetGroups) {
          const { sources, target: targetMatch } = group;
          if (!targetMatch || sources.length === 0) continue;

          const targetPos = getCardPos(`${prefix}-round-${targetRoundIdx}-match-${targetMatch.id}`);
          if (!targetPos) continue;

          const sourcePoints = sources.map(s => {
            const p = getCardPos(`${prefix}-round-${r}-match-${s.id}`);
            if (!p) return null;
            return { ...p, match: s };
          }).filter(Boolean) as { x: number; right: number; y: number; width: number; height: number; match: Match }[];

          if (sourcePoints.length === 0) continue;

          const maxSourceX = Math.max(...sourcePoints.map(p => p.right));
          const targetX = targetPos.x;
          const midX = (maxSourceX + targetX) / 2;
          const targetY = targetPos.y;

          if (sourcePoints.length === 1) {
            const p = sourcePoints[0];
            newConnectors.push({
              key: `${prefix}-conn-${r}-${targetKey}-arm1`,
              d: `M ${p.right} ${p.y} H ${midX} V ${targetY}`,
              color: strokeColor,
              isWinner: matchHasWinner(p.match),
            });
          } else {
            for (let i = 0; i < sourcePoints.length; i++) {
              const p = sourcePoints[i];
              newConnectors.push({
                key: `${prefix}-conn-${r}-${targetKey}-arm${i}`,
                d: `M ${p.right} ${p.y} H ${midX}`,
                color: strokeColor,
                isWinner: matchHasWinner(p.match),
              });
            }
            const topY = Math.min(...sourcePoints.map(p => p.y));
            const bottomY = Math.max(...sourcePoints.map(p => p.y));
            newConnectors.push({
              key: `${prefix}-conn-${r}-${targetKey}-rail`,
              d: `M ${midX} ${topY} V ${bottomY}`,
              color: strokeColor,
              isWinner: sourcePoints.some(p => matchHasWinner(p.match)),
            });
          }

          newConnectors.push({
            key: `${prefix}-conn-${r}-${targetKey}-bridge`,
            d: `M ${midX} ${targetY} H ${targetX}`,
            color: strokeColor,
            isWinner: sourcePoints.some(p => matchHasWinner(p.match)),
          });
          newConnectors.push({
            key: `${prefix}-conn-${r}-${targetKey}-dot`,
            d: `M ${midX - 3} ${targetY} h 6`,
            color: strokeColor,
            isWinner: true,
          });
        }
      }
    };

    // Calculate UB connectors
    if (hasUpper) calculateBracketConnectors(upperRounds, 'ub', divisionColor);

    // Calculate LB connectors
    if (hasLower) calculateBracketConnectors(lowerRounds, 'lb', lowerColor);

    // ── Cross-bracket connectors: UB Final → GF ──
    if (hasUpper && hasGF && upperRounds.length > 0) {
      const ubFinalRound = upperRounds[upperRounds.length - 1];
      const ubFinalMatch = ubFinalRound.matches.find(m => !isByePlaceholder(m));
      if (ubFinalMatch) {
        const sourcePos = getCardPos(`ub-round-${upperRounds.length - 1}-match-${ubFinalMatch.id}`);
        const gfMatch = gfMatches[0];
        const targetPos = getCardPos(`gf-match-${gfMatch.id}`);

        if (sourcePos && targetPos) {
          const midX = (sourcePos.right + targetPos.x) / 2;
          newConnectors.push({
            key: 'ub-gf-conn',
            d: `M ${sourcePos.right} ${sourcePos.y} H ${midX} V ${targetPos.y} H ${targetPos.x}`,
            color: gfColor,
            isWinner: matchHasWinner(ubFinalMatch),
          });
          newConnectors.push({
            key: 'ub-gf-dot',
            d: `M ${midX - 3} ${targetPos.y} h 6`,
            color: gfColor,
            isWinner: true,
          });
        }
      }
    }

    // ── Cross-bracket connectors: LB Final → GF ──
    if (hasLower && hasGF && lowerRounds.length > 0) {
      const lbFinalRound = lowerRounds[lowerRounds.length - 1];
      const lbFinalMatch = lbFinalRound.matches.find(m => !isByePlaceholder(m));
      if (lbFinalMatch) {
        const sourcePos = getCardPos(`lb-round-${lowerRounds.length - 1}-match-${lbFinalMatch.id}`);
        const gfMatch = gfMatches[0];
        const targetPos = getCardPos(`gf-match-${gfMatch.id}`);

        if (sourcePos && targetPos) {
          const midX = (sourcePos.right + targetPos.x) / 2;
          newConnectors.push({
            key: 'lb-gf-conn',
            d: `M ${sourcePos.right} ${sourcePos.y} H ${midX} V ${targetPos.y} H ${targetPos.x}`,
            color: gfColor,
            isWinner: matchHasWinner(lbFinalMatch),
          });
          newConnectors.push({
            key: 'lb-gf-dot',
            d: `M ${midX - 3} ${sourcePos.y} h 6`,
            color: gfColor,
            isWinner: true,
          });
        }
      }
    }

    setConnectors(newConnectors);
  }, [upperRounds, lowerRounds, gfMatches, divisionColor, hasUpper, hasLower, hasGF]);

  /* ─── Card alignment for UB and LB ─── */
  const alignBracketCards = useCallback(() => {
    if (!containerRef.current) return;

    const alignBracket = (
      rounds: { round: number; label: string; matches: Match[] }[],
      prefix: string,
    ) => {
      if (rounds.length < 2) return;

      const r0HasPositions = rounds[0].matches.some(m => getBracketPosition(m.groupLabel) > 0);
      if (!r0HasPositions) {
        for (let r = 1; r < rounds.length; r++) {
          const gapMultiplier = Math.pow(2, r);
          const roundCols = containerRef.current!.querySelectorAll(`[data-round="${prefix}-${r}"]`);
          roundCols.forEach((col) => {
            const cards = col.children;
            for (let i = 0; i < cards.length; i++) {
              const card = cards[i] as HTMLElement;
              if (i === 0) {
                card.style.marginTop = `${(gapMultiplier - 1) * 20}px`;
              } else {
                card.style.marginTop = `${gapMultiplier * 24 + 16}px`;
              }
            }
          });
        }
        return;
      }

      for (let r = 1; r < rounds.length; r++) {
        const currentRound = rounds[r];
        const prevRound = rounds[r - 1];

        const prevPosMap = new Map<number, HTMLDivElement>();
        for (const pm of prevRound.matches) {
          const pos = getBracketPosition(pm.groupLabel);
          const el = cardRefs.current.get(`${prefix}-round-${r - 1}-match-${pm.id}`);
          if (pos > 0 && el) prevPosMap.set(pos, el);
        }

        for (const m of currentRound.matches) {
          const bracketPos = getBracketPosition(m.groupLabel);
          const el = cardRefs.current.get(`${prefix}-round-${r}-match-${m.id}`);
          if (!el || bracketPos <= 0) continue;

          const feederPos1 = bracketPos * 2 - 1;
          const feederPos2 = bracketPos * 2;
          const feederEl1 = prevPosMap.get(feederPos1);
          const feederEl2 = prevPosMap.get(feederPos2);
          const currentMarginTop = parseFloat(el.style.marginTop) || 0;

          if (feederEl1 && feederEl2) {
            const f1Rect = feederEl1.getBoundingClientRect();
            const f2Rect = feederEl2.getBoundingClientRect();
            const cardRect = el.getBoundingClientRect();
            const cRect = containerRef.current!.getBoundingClientRect();
            const targetCenterY = (f1Rect.top + f1Rect.height / 2 - cRect.top + f2Rect.top + f2Rect.height / 2 - cRect.top) / 2;
            const currentCenterY = cardRect.top + cardRect.height / 2 - cRect.top;
            el.style.marginTop = `${targetCenterY - (currentCenterY - currentMarginTop)}px`;
          } else if (feederEl1 || feederEl2) {
            const feederEl = feederEl1 || feederEl2!;
            const fRect = feederEl.getBoundingClientRect();
            const cardRect = el.getBoundingClientRect();
            const cRect = containerRef.current!.getBoundingClientRect();
            const fCenterY = fRect.top + fRect.height / 2 - cRect.top;
            const currentCenterY = cardRect.top + cardRect.height / 2 - cRect.top;
            el.style.marginTop = `${fCenterY - (currentCenterY - currentMarginTop)}px`;
          }
        }
      }
    };

    if (hasUpper) alignBracket(upperRounds, 'ub');
    if (hasLower) alignBracket(lowerRounds, 'lb');
  }, [upperRounds, lowerRounds, hasUpper, hasLower]);

  // Timing effects for alignment and connector calculation
  useEffect(() => {
    const timers = [100, 300, 600, 1200].map(delay => setTimeout(alignBracketCards, delay));
    return () => timers.forEach(clearTimeout);
  }, [alignBracketCards]);

  useEffect(() => {
    const attempts = [80, 150, 350, 700, 1300];
    const timers = attempts.map(delay => setTimeout(calculateConnectors, delay));
    const handleResize = () => { alignBracketCards(); setTimeout(calculateConnectors, 50); };
    const scrollContainer = containerRef.current?.parentElement;
    const handleScroll = () => calculateConnectors();
    window.addEventListener('resize', handleResize);
    scrollContainer?.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('resize', handleResize);
      scrollContainer?.removeEventListener('scroll', handleScroll);
    };
  }, [calculateConnectors, alignBracketCards]);

  const setCardRef = useCallback((key: string, el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(key, el);
    else cardRefs.current.delete(key);
  }, []);

  // Get display label for a match
  const getMatchDisplayLabel = (groupLabel: string | undefined, match?: Match): string => {
    if (!groupLabel) return '';
    // Show "Waiting" indicator for L1 matches where rank 3 is pre-seeded
    if (match && groupLabel.match(/^L1-\d+$/) && match.team1 && !match.team2) {
      return `LB R1 (Waiting)`;
    }
    const upperMatch = groupLabel.match(/^U(\d+)-(\d+)$/);
    if (upperMatch) {
      const pos = parseInt(upperMatch[2]);
      if (upperRounds.length <= 2) return `USF ${pos}`;
      const round = parseInt(upperMatch[1]);
      if (round === 1) return `UQF ${pos}`;
      if (round === upperRounds.length) return `UF`;
      return `USF ${pos}`;
    }
    const lowerMatch = groupLabel.match(/^L(\d+)-(\d+)$/);
    if (lowerMatch) return `L${lowerMatch[1]}-${lowerMatch[2]}`;
    if (groupLabel === 'GF') return 'Grand Final';
    return groupLabel;
  };

  // ── Empty state ──
  if (!hasUpper && !hasLower && !hasGF) {
    return null;
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-border/60">
      {/* Section Header */}
      <div className={`flex items-center gap-2.5 px-4 py-2.5 border-b ${dt.borderSubtle} ${dt.bg}`}>
        <Swords className={`w-4 h-4 ${dt.neonText}`} />
        <h3 className={`text-sm font-bold uppercase tracking-wider ${dt.text}`}>Double Elimination Playoff</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {playoffMatches.length} pertandingan
        </span>
      </div>
      <div className="p-2">
        <ZoomableContainer>
          <div className="min-w-max pb-2 -mx-1">
            <div className="relative px-2" ref={containerRef}>
              {/* SVG connector overlay — covers entire unified bracket */}
              {connectors.length > 0 && <BracketConnectors paths={connectors} />}

              <div className="flex">
                {/* ── Left side: UB + LB stacked vertically ── */}
                <div className="flex flex-col gap-6">
                  {/* ── UPPER BRACKET ── */}
                  {hasUpper && (
                    <div>
                      <div className="text-center mb-3">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${dt.bg} ${dt.text} text-xs font-bold uppercase tracking-wider border ${dt.borderSubtle}`}>
                          <Swords className="w-3 h-3 opacity-60" />
                          Upper Bracket
                        </div>
                      </div>
                      <div className="flex gap-12">
                        {upperRounds.map((round, roundIdx) => (
                          <div key={`ub-${round.round}`} className="flex flex-col" style={{ minWidth: '200px' }}>
                            <div className="text-center mb-4">
                              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${dt.bg} ${dt.text} text-xs font-bold uppercase tracking-wider border ${dt.borderSubtle}`}>
                                <Swords className="w-3 h-3 opacity-60" />
                                {round.label}
                              </div>
                            </div>
                            <div
                              className="flex-1 flex flex-col"
                              data-round={`ub-${roundIdx}`}
                              style={{ gap: roundIdx === 0 ? '20px' : '0px' }}
                            >
                              {round.matches.map((m, mi) => (
                                <div
                                  key={m.id}
                                  ref={(el) => setCardRef(`ub-round-${roundIdx}-match-${m.id}`, el)}
                                >
                                  <BracketMatchCard
                                    match={m}
                                    matchLabel={getMatchDisplayLabel(m.groupLabel, m)}
                                    mode={mode}
                                    adminProps={adminProps}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Drop indicator: UB → LB (Rank 3 waiting) ── */}
                  {hasUpper && hasLower && (
                    <div className="flex flex-col items-center gap-1 py-1">
                      <div className="flex items-center justify-center gap-3">
                        <div className="flex-1 flex items-center justify-end">
                          <span className="text-[10px] font-bold text-red-400/80 uppercase tracking-wider">Yang kalah</span>
                          <div className="h-px w-8 bg-red-400/25" />
                        </div>
                        <svg width="24" height="28" viewBox="0 0 24 28" fill="none" className="opacity-70">
                          <path d="M12 2 L12 18" stroke="#f87171" strokeWidth="2" strokeLinecap="round" />
                          <path d="M6 14 L12 22 L18 14" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                          <path d="M12 2 L12 18" stroke="#f87171" strokeWidth="6" strokeLinecap="round" opacity="0.15" />
                        </svg>
                        <div className="flex-1 flex items-center">
                          <div className="h-px w-8 bg-red-400/25" />
                          <span className="text-[10px] font-bold text-red-400/80 uppercase tracking-wider">melawan Peringkat 3 di LB</span>
                        </div>
                      </div>
                      <span className="text-[9px] text-orange-400/60 font-medium">Peringkat 3 grup sudah menunggu di Lower Bracket</span>
                    </div>
                  )}

                  {/* ── LOWER BRACKET ── */}
                  {hasLower && (
                    <div>
                      <div className="text-center mb-3">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/5 text-orange-400 text-xs font-bold uppercase tracking-wider border border-orange-500/20">
                          <Swords className="w-3 h-3 opacity-60" />
                          Lower Bracket
                        </div>
                      </div>
                      <div className="flex gap-12">
                        {lowerRounds.map((round, roundIdx) => (
                          <div key={`lb-${round.round}`} className="flex flex-col" style={{ minWidth: '200px' }}>
                            <div className="text-center mb-4">
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500/5 text-orange-400 text-[10px] font-bold uppercase tracking-wider border border-orange-500/20">
                                <Swords className="w-3 h-3 opacity-60" />
                                {round.label}
                              </div>
                            </div>
                            <div
                              className="flex-1 flex flex-col"
                              data-round={`lb-${roundIdx}`}
                              style={{ gap: roundIdx === 0 ? '20px' : '0px' }}
                            >
                              {round.matches.map((m, mi) => (
                                <div
                                  key={m.id}
                                  ref={(el) => setCardRef(`lb-round-${roundIdx}-match-${m.id}`, el)}
                                >
                                  <BracketMatchCard
                                    match={m}
                                    matchLabel={getMatchDisplayLabel(m.groupLabel, m)}
                                    mode={mode}
                                    adminProps={adminProps}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Right side: Grand Final ── */}
                {hasGF && (
                  <div className="flex flex-col justify-center ml-12" style={{ minWidth: '220px' }}>
                    <div className="text-center mb-4">
                      <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-idm-gold-warm/20 via-idm-gold-warm/10 to-idm-gold-warm/20 text-idm-gold-warm text-sm font-black uppercase tracking-wider border border-idm-gold-warm/40 shadow-[0_0_24px_rgba(239,249,35,0.2)]">
                        <Trophy className="w-4 h-4" />
                        Grand Final
                      </div>
                    </div>
                    {gfMatches.map((m) => (
                      <div
                        key={m.id}
                        ref={(el) => setCardRef(`gf-match-${m.id}`, el)}
                      >
                        <BracketMatchCard match={m} isGrandFinal matchLabel="Grand Final" mode={mode} adminProps={adminProps} />
                      </div>
                    ))}
                    <div className="text-center mt-3">
                      <span className="text-[10px] text-idm-gold-warm/60 font-semibold">UB Winner vs LB Winner</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ZoomableContainer>
      </div>
    </div>
  );
}

/* ─── Group Stage Table ─── */
function GroupStageView({ matches, roundsData, mode, adminProps }: { matches: Match[]; roundsData: { round: number; label: string; matches: Match[] }[]; mode?: 'public' | 'admin'; adminProps?: AdminBracketProps }) {
  const dt = useDivisionTheme();
  const isAdmin = mode === 'admin' && !!adminProps;
  const tournamentInMainEvent = isAdmin && adminProps!.tournamentStatus === 'main_event';

  // Separate group matches from playoff matches
  const groupMatches = useMemo(() => matches.filter(m => (m as Match & { bracket?: string }).bracket === 'group'), [matches]);
  const playoffMatches = useMemo(() => matches.filter(m => (m as Match & { bracket?: string }).bracket !== 'group'), [matches]);

  // Group group-matches by groupLabel
  const groupsByLabel = useMemo(() => {
    const groups: Record<string, Match[]> = {};
    groupMatches.forEach(m => {
      const label = (m as Match & { groupLabel?: string }).groupLabel || 'A';
      if (!groups[label]) groups[label] = [];
      groups[label].push(m);
    });
    return groups;
  }, [groupMatches]);

  // Build standings per group
  const standingsByGroup = useMemo(() => {
    const result: Record<string, { name: string; wins: number; draws: number; losses: number; points: number; gamesWon: number; gamesLost: number }[]> = {};
    for (const [label, gMatches] of Object.entries(groupsByLabel)) {
      const teams = new Map<string, { name: string; wins: number; draws: number; losses: number; points: number; gamesWon: number; gamesLost: number }>();
      gMatches.forEach(m => {
        const hasScore = m.score1 !== null && m.score2 !== null;
        if (!teams.has((m.team1?.name || 'TBD'))) teams.set((m.team1?.name || 'TBD'), { name: (m.team1?.name || 'TBD'), wins: 0, draws: 0, losses: 0, points: 0, gamesWon: 0, gamesLost: 0 });
        if (!teams.has((m.team2?.name || 'TBD'))) teams.set((m.team2?.name || 'TBD'), { name: (m.team2?.name || 'TBD'), wins: 0, draws: 0, losses: 0, points: 0, gamesWon: 0, gamesLost: 0 });
        if (hasScore) {
          const t1 = teams.get((m.team1?.name || 'TBD'))!;
          const t2 = teams.get((m.team2?.name || 'TBD'))!;
          t1.gamesWon += m.score1!; t1.gamesLost += m.score2!;
          t2.gamesWon += m.score2!; t2.gamesLost += m.score1!;
          if (m.score1! > m.score2!) { t1.wins++; t1.points += 3; t2.losses++; }
          else if (m.score2! > m.score1!) { t2.wins++; t2.points += 3; t1.losses++; }
          else { t1.draws++; t2.draws++; t1.points++; t2.points++; }
        }
      });
      result[label] = Array.from(teams.values()).sort((a, b) => b.points - a.points || b.wins - a.wins);
    }
    return result;
  }, [groupsByLabel]);

  return (
    <div className="space-y-5">
      {/* Group Standings Tables */}
      {Object.entries(standingsByGroup).map(([label, teamStats]) => (
        <div key={label} className={`rounded-2xl overflow-hidden border ${dt.border}`}>
          <div className={`flex items-center gap-2.5 px-4 py-2.5 border-b ${dt.borderSubtle}`}>
            <Trophy className={`w-4 h-4 ${dt.neonText}`} />
            <h3 className="text-sm font-bold uppercase tracking-wider">Grup {label}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b ${dt.borderSubtle} bg-muted/20`}>
                  <th className="w-8 text-center py-2 font-semibold">#</th>
                  <th className="text-left py-2 px-3 font-semibold">Tim</th>
                  <th className="w-10 text-center py-2 font-semibold">W</th>
                  <th className="w-10 text-center py-2 font-semibold">D</th>
                  <th className="w-10 text-center py-2 font-semibold">L</th>
                  <th className="w-14 text-center py-2 font-semibold">GW</th>
                  <th className="w-14 text-center py-2 font-semibold">GL</th>
                  <th className="w-12 text-center py-2 font-semibold">Pts</th>
                </tr>
              </thead>
              <tbody>
                {teamStats.map((t, i) => (
                  <tr key={t.name} className={`border-b ${dt.borderSubtle} ${i < 2 ? dt.bgSubtle : i === 2 ? 'bg-orange-500/5' : ''} ${dt.hoverBgSubtle} transition-colors`}>
                    <td className="text-center py-2">
                      <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-bold ${
                        i === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                        i === 1 ? 'bg-green-500/20 text-green-500' :
                        i === 2 ? 'bg-orange-500/20 text-orange-500' :
                        'text-muted-foreground'
                      }`}>{i + 1}</span>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold ${
                          i < 2 ? `bg-gradient-to-br ${dt.division === 'male' ? 'from-idm-male to-idm-male-light' : 'from-idm-female to-idm-female-light'} text-white` :
                          i === 2 ? 'bg-orange-500/20 text-orange-500' :
                          `${dt.iconBg} ${dt.text}`
                        }`}>{t.name.slice(0, 2).toUpperCase()}</div>
                        <span className={`font-semibold truncate ${i < 2 ? dt.neonText : i === 2 ? 'text-orange-400' : ''}`}>{t.name}</span>
                        {i === 2 && <span className="text-[8px] font-bold uppercase tracking-wider text-orange-400/70 ml-1">→ LB</span>}
                      </div>
                    </td>
                    <td className="text-center font-semibold text-green-500">{t.wins}</td>
                    <td className="text-center font-semibold text-yellow-500">{t.draws}</td>
                    <td className="text-center font-semibold text-red-500">{t.losses}</td>
                    <td className="text-center text-muted-foreground">{t.gamesWon}</td>
                    <td className="text-center text-muted-foreground">{t.gamesLost}</td>
                    <td className="text-center font-bold">{t.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Group Stage Match Schedule */}
      {Object.entries(groupsByLabel).map(([label, gMatches]) => (
        <div key={`matches-${label}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`px-3 py-1.5 rounded-lg ${dt.bg} ${dt.text} text-xs font-bold uppercase tracking-wider`}>
              Grup {label}
            </div>
            <div className={`flex-1 h-px ${dt.borderSubtle}`} />
            <span className="text-xs text-muted-foreground">{gMatches.length} pertandingan</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {gMatches.map((m) => {
              const hasScore = m.score1 !== null && m.score2 !== null;
              const winner1 = hasScore && m.score1! > m.score2!;
              const winner2 = hasScore && m.score2! > m.score1!;
              const isDraw = hasScore && m.score1 === m.score2;
              const isLive = m.status === 'live' || m.status === 'main_event';
              const isCompleted = m.status === 'completed' || m.status === 'scoring';
              const isReady = m.status === 'ready';
              const isPending = m.status === 'pending';
              const bothTeamsExist = !!(m.team1 && m.team2);
              const bothScoresEntered = isAdmin && isLive && tournamentInMainEvent &&
                (adminProps!.scoreInputs[m.id]?.s1 ?? '') !== '' && (adminProps!.scoreInputs[m.id]?.s2 ?? '') !== '';

              const handleSubmitScore = () => {
                if (!adminProps) return;
                const s1 = parseInt(adminProps.scoreInputs[m.id]?.s1 ?? '');
                const s2 = parseInt(adminProps.scoreInputs[m.id]?.s2 ?? '');
                if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) return;
                adminProps.setConfirmDialog({
                  open: true,
                  title: 'Konfirmasi Skor?',
                  description: `${adminProps.getTeamName(m.team1?.id ?? null)} ${s1} - ${s2} ${adminProps.getTeamName(m.team2?.id ?? null)}`,
                  onConfirm: () => adminProps!.scoreMutation.mutate({ tournamentId: adminProps!.tournamentId, matchId: m.id, score1: s1, score2: s2 }),
                });
              };

              const handleUndo = () => {
                if (!adminProps) return;
                adminProps.setConfirmDialog({
                  open: true,
                  title: 'Undo Skor?',
                  description: `Batalkan skor ${adminProps.getTeamName(m.team1?.id ?? null)} ${m.score1} - ${m.score2} ${adminProps.getTeamName(m.team2?.id ?? null)}? Stats pemain akan dikembalikan.`,
                  onConfirm: () => adminProps!.undoScoreMutation.mutate({ tournamentId: adminProps!.tournamentId, matchId: m.id }),
                });
              };

              return (
                <div
                  key={m.id}
                  className={`hover-scale-sm rounded-lg overflow-hidden border ${isLive ? `border-red-500/30 ${dt.neonPulse}` : dt.borderSubtle} transition-all ${dt.hoverBorder} relative`}
                  style={{ background: 'var(--card-bg, rgba(20,17,10,0.6))' }}
                >
                  {/* Admin header bar */}
                  {isAdmin && (isLive || (isReady || isPending) || isCompleted) && (
                    <div className={`flex items-center justify-between px-2.5 py-1 border-b ${dt.borderSubtle} bg-muted/30`}>
                      <div className="flex items-center gap-1.5">
                        {(isReady || isPending) && bothTeamsExist && tournamentInMainEvent && (
                          <button
                            onClick={() => adminProps!.startMatchMutation.mutate({ tournamentId: adminProps!.tournamentId, matchId: m.id })}
                            disabled={adminProps!.startMatchMutation.isPending}
                            className="compact-pill flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-green-500/15 text-green-400 hover:bg-green-500/25 border border-green-500/25 transition-colors disabled:opacity-50"
                          >
                            <Play className="w-2.5 h-2.5" /> Start
                          </button>
                        )}
                        {isLive && (
                          <div className="flex items-center gap-1">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-widest text-red-500">LIVE</span>
                          </div>
                        )}
                        {isCompleted && tournamentInMainEvent && (
                          <span className="text-[9px] font-bold text-green-400">✅</span>
                        )}
                      </div>
                      {isAdmin && m.format && (
                        <span className="text-[9px] font-bold text-muted-foreground/60">{m.format}</span>
                      )}
                    </div>
                  )}
                  {(!m.team1 || !m.team2) && (m.team1 || m.team2) && m.status !== 'completed' && (
                    <div className="absolute top-0.5 right-1 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded z-10">
                      WALKOVER
                    </div>
                  )}
                  <div className={`flex items-center px-3 py-2 border-b ${dt.borderSubtle} ${winner1 ? dt.bgSubtle : ''} ${!m.team1 ? 'opacity-50' : ''}`}>
                    <span className={`text-xs font-semibold truncate flex-1 ${winner1 ? dt.neonText : !m.team1 ? 'text-muted-foreground italic' : 'text-foreground/80'}`}>
                      {m.team1?.name || 'TBD'}
                    </span>
                    {isAdmin && isLive && tournamentInMainEvent ? (
                      <input
                        type="number" min={0}
                        value={adminProps!.scoreInputs[m.id]?.s1 ?? ''}
                        onChange={e => adminProps!.setScoreInputs(prev => ({...prev, [m.id]: {...prev[m.id] ?? {s1:'', s2:''}, s1: e.target.value}}))}
                        className="w-10 h-7 text-center text-sm font-black bg-background/50 border border-border/40 rounded-md focus:border-idm-gold-warm/50 focus:outline-none tabular-nums"
                        placeholder="0"
                      />
                    ) : (
                      <span className={`text-sm font-bold tabular-nums w-6 text-right ${winner1 ? dt.neonText : isDraw ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                        {m.team1 ? (hasScore ? m.score1 : '-') : (m.status === 'pending' || m.status === 'ready' ? '' : (hasScore ? m.score1 : '-'))}
                      </span>
                    )}
                  </div>
                  <div className={`flex items-center px-3 py-2 ${winner2 ? dt.bgSubtle : ''} ${!m.team2 ? 'opacity-50' : ''}`}>
                    <span className={`text-xs font-semibold truncate flex-1 ${winner2 ? dt.neonText : !m.team2 ? 'text-muted-foreground italic' : 'text-foreground/80'}`}>
                      {m.team2?.name || 'TBD'}
                    </span>
                    {isAdmin && isLive && tournamentInMainEvent ? (
                      <input
                        type="number" min={0}
                        value={adminProps!.scoreInputs[m.id]?.s2 ?? ''}
                        onChange={e => adminProps!.setScoreInputs(prev => ({...prev, [m.id]: {...prev[m.id] ?? {s1:'', s2:''}, s2: e.target.value}}))}
                        className="w-10 h-7 text-center text-sm font-black bg-background/50 border border-border/40 rounded-md focus:border-idm-gold-warm/50 focus:outline-none tabular-nums"
                        placeholder="0"
                      />
                    ) : (
                      <span className={`text-sm font-bold tabular-nums w-6 text-right ${winner2 ? dt.neonText : isDraw ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                        {m.team2 ? (hasScore ? m.score2 : '-') : (m.status === 'pending' || m.status === 'ready' ? '' : (hasScore ? m.score2 : '-'))}
                      </span>
                    )}
                  </div>
                  {/* Admin: Submit button */}
                  {isAdmin && isLive && tournamentInMainEvent && bothScoresEntered && (
                    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 border-t ${dt.borderSubtle}`}>
                      <button
                        onClick={handleSubmitScore}
                        disabled={adminProps!.scoreMutation.isPending}
                        className="compact-pill flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-idm-gold-warm/20 text-idm-gold-warm hover:bg-idm-gold-warm/30 border border-idm-gold-warm/30 transition-colors disabled:opacity-50"
                      >
                        <Check className="w-3 h-3" /> Submit
                      </button>
                    </div>
                  )}
                  {/* Admin: Undo button for completed matches */}
                  {isAdmin && isCompleted && tournamentInMainEvent && bothTeamsExist && (
                    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 border-t ${dt.borderSubtle}`}>
                      <button
                        onClick={handleUndo}
                        disabled={adminProps!.undoScoreMutation.isPending}
                        className="compact-pill flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-orange-400 hover:bg-orange-400/10 border border-orange-400/25 transition-colors disabled:opacity-50"
                      >
                        <Undo2 className="w-3 h-3" /> Undo
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Playoff Matches — Double Elimination Bracket */}
      {playoffMatches.length > 0 && (() => {
        // Detect bracket style: new double-elim (U1-1, L1-1, GF) vs old single-elim (SF1, SF2, Final, 3rd)
        const isNewStyle = playoffMatches.some(m =>
          m.groupLabel?.match(/^[UG][FLF]/) || m.groupLabel?.match(/^[UL]\d+-\d+$/) || m.groupLabel === 'GF'
        );

        // ── NEW STYLE: Use GroupStagePlayoffBracket with SVG connectors ──
        if (isNewStyle) {
          return (
            <GroupStagePlayoffBracket
              playoffMatches={playoffMatches}
              mode={mode}
              adminProps={adminProps}
            />
          );
        }

        // ── OLD STYLE: backward compat for SF1/SF2/Final/3rd ──
        const sf1 = playoffMatches.find(m => m.groupLabel === 'SF1');
        const sf2 = playoffMatches.find(m => m.groupLabel === 'SF2');
        const grandFinal = playoffMatches.find(m => m.groupLabel === 'Final');
        const thirdPlace = playoffMatches.find(m => m.groupLabel === '3rd');
        const semiFinals = [sf1, sf2].filter(Boolean) as Match[];
        const finals = [grandFinal, thirdPlace].filter(Boolean) as Match[];

        const renderPlayoffCard = (m: Match, labelOverride?: string) => {
          const label = labelOverride || m.groupLabel || '';
          const matchLabel = label === 'SF1' ? 'Semi Final 1' : label === 'SF2' ? 'Semi Final 2' : label === 'Final' ? 'Grand Final' : label === '3rd' ? '3rd Place' : label;
          const isGrandFinal = label === 'Final';

          if (isAdmin) {
            return (
              <BracketMatchCard
                key={m.id}
                match={m}
                matchLabel={matchLabel}
                isGrandFinal={isGrandFinal}
                mode="admin"
                adminProps={adminProps}
              />
            );
          }

          const hasScore = m.score1 !== null && m.score2 !== null;
          const winner1 = hasScore && m.score1! > m.score2!;
          const winner2 = hasScore && m.score2! > m.score1!;
          const isLive = m.status === 'live' || m.status === 'main_event';
          const is3rd = label === '3rd';
          const isByeMatch = (!m.team1 || !m.team2) && (m.team1 || m.team2) && m.status !== 'completed';

          return (
            <div
              key={m.id}
              className={`hover-scale-sm rounded-lg overflow-hidden border transition-all relative ${
                isLive ? `border-red-500/30 ${dt.neonPulse}` :
                isGrandFinal ? 'border-idm-gold-warm/40 shadow-[0_0_12px_rgba(239,249,35,0.15)]' :
                is3rd ? 'border-orange-500/20' :
                'border-idm-gold-warm/20'
              }`}
              style={{ background: 'var(--card-bg, rgba(20,17,10,0.6))' }}
            >
              <div className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center justify-between ${
                isGrandFinal ? 'bg-idm-gold-warm/10 text-idm-gold-warm' :
                is3rd ? 'bg-orange-500/5 text-orange-400' :
                `${dt.neonText} bg-idm-gold-warm/5`
              }`}>
                <span className="flex items-center gap-1.5">
                  {isGrandFinal && <span>🏆</span>}
                  {is3rd && <span>🥉</span>}
                  {matchLabel}
                </span>
                {isByeMatch && (
                  <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded">WALKOVER</span>
                )}
              </div>
              <div className={`flex items-center px-3 py-2 border-b ${dt.borderSubtle} ${winner1 ? dt.bgSubtle : ''} ${!m.team1 ? 'opacity-50' : ''}`}>
                <span className={`text-xs font-semibold truncate flex-1 ${winner1 ? dt.neonText : !m.team1 ? 'text-muted-foreground italic' : 'text-foreground/80'}`}>
                  {m.team1?.name || 'TBD'}
                </span>
                <span className={`text-sm font-bold tabular-nums w-6 text-right ${winner1 ? dt.neonText : 'text-muted-foreground'}`}>
                  {m.team1 ? (hasScore ? m.score1 : '-') : (m.status === 'pending' || m.status === 'ready' ? '' : (hasScore ? m.score1 : '-'))}
                </span>
              </div>
              <div className={`flex items-center px-3 py-2 ${winner2 ? dt.bgSubtle : ''} ${!m.team2 ? 'opacity-50' : ''}`}>
                <span className={`text-xs font-semibold truncate flex-1 ${winner2 ? dt.neonText : !m.team2 ? 'text-muted-foreground italic' : 'text-foreground/80'}`}>
                  {m.team2?.name || 'TBD'}
                </span>
                <span className={`text-sm font-bold tabular-nums w-6 text-right ${winner2 ? dt.neonText : 'text-muted-foreground'}`}>
                  {m.team2 ? (hasScore ? m.score2 : '-') : (m.status === 'pending' || m.status === 'ready' ? '' : (hasScore ? m.score2 : '-'))}
                </span>
              </div>
            </div>
          );
        };

        return (
          <div className="space-y-4">
            {semiFinals.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`px-3 py-1.5 rounded-lg bg-idm-gold-warm/10 text-idm-gold-warm text-xs font-bold uppercase tracking-wider`}>
                    ⚔️ Semi Final
                  </div>
                  <div className={`flex-1 h-px ${dt.borderSubtle}`} />
                  <span className="text-[10px] text-muted-foreground">Pemenang lolos Grand Final</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {sf1 && renderPlayoffCard(sf1, 'SF1')}
                  {sf2 && renderPlayoffCard(sf2, 'SF2')}
                </div>
              </div>
            )}
            {semiFinals.length > 0 && finals.length > 0 && (
              <div className="flex items-center justify-center gap-2 py-1">
                <div className="flex-1 flex items-center justify-end">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-idm-gold-warm uppercase tracking-wider">🏆 Pemenang</span>
                    <div className="h-px w-8 bg-idm-gold-warm/30" />
                  </div>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <div className="w-px h-3 bg-idm-gold-warm/20" />
                  <div className="w-3 h-3 rounded-full border border-idm-gold-warm/30 bg-idm-gold-warm/5 flex items-center justify-center">
                    <Crown className="w-2 h-2 text-idm-gold-warm" />
                  </div>
                  <div className="w-px h-3 bg-orange-500/20" />
                </div>
                <div className="flex-1 flex items-center">
                  <div className="flex items-center gap-1">
                    <div className="h-px w-8 bg-orange-500/20" />
                    <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">Kalah → 🥉</span>
                  </div>
                </div>
              </div>
            )}
            {finals.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="px-3 py-1.5 rounded-lg bg-idm-gold-warm/15 text-idm-gold-warm text-xs font-bold uppercase tracking-wider border border-idm-gold-warm/20">
                    🏆 Grand Final
                  </div>
                  <div className={`flex-1 h-px ${dt.borderSubtle}`} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {grandFinal && renderPlayoffCard(grandFinal, 'Final')}
                  {thirdPlace && renderPlayoffCard(thirdPlace, '3rd')}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

/* ─── Swiss Stage View — Premium MPL-style standings + round-by-round matches ─── */
function SwissView({ matches, roundsData, mode, adminProps }: { matches: Match[]; roundsData: { round: number; label: string; matches: Match[] }[]; mode?: 'public' | 'admin'; adminProps?: AdminBracketProps }) {
  const dt = useDivisionTheme();
  const isAdmin = mode === 'admin' && !!adminProps;
  const tournamentInMainEvent = isAdmin && adminProps!.tournamentStatus === 'main_event';

  // Separate Swiss bracket matches from playoff matches
  const swissMatches = useMemo(() => matches.filter(m => m.bracket === 'swiss'), [matches]);
  const playoffMatches = useMemo(() => matches.filter(m => m.bracket !== 'swiss'), [matches]);

  // ── Build Swiss Standings from ALL Swiss bracket matches ──
  interface SwissTeamStats {
    name: string;
    id: string;
    wins: number;
    draws: number;
    losses: number;
    points: number;
    buchholz: number;
    gamesWon: number;
    gamesLost: number;
    opponentIds: Set<string>; // track opponent team IDs for rematch avoidance
    hadBye: boolean;
  }

  const standings = useMemo(() => {
    const teams = new Map<string, SwissTeamStats>();

    // Initialize all teams first
    swissMatches.forEach(m => {
      if (m.team1) {
        const key = m.team1.id;
        if (!teams.has(key)) teams.set(key, { name: m.team1.name, id: m.team1.id, wins: 0, draws: 0, losses: 0, points: 0, buchholz: 0, gamesWon: 0, gamesLost: 0, opponentIds: new Set(), hadBye: false });
      }
      if (m.team2) {
        const key = m.team2.id;
        if (!teams.has(key)) teams.set(key, { name: m.team2.name, id: m.team2.id, wins: 0, draws: 0, losses: 0, points: 0, buchholz: 0, gamesWon: 0, gamesLost: 0, opponentIds: new Set(), hadBye: false });
      }
    });

    // Process scored/bye matches
    swissMatches.forEach(m => {
      const hasScore = m.score1 !== null && m.score2 !== null;
      if (!m.team1) return;

      // Track opponent for rematch avoidance (even if not scored yet)
      if (m.team1 && m.team2) {
        const t1 = teams.get(m.team1.id);
        const t2 = teams.get(m.team2.id);
        if (t1) t1.opponentIds.add(m.team2.id);
        if (t2) t2.opponentIds.add(m.team1.id);
      }

      // BYE match (team2 is null — status can be 'bye' or 'completed' for auto-wins)
      if (!m.team2) {
        const t1 = teams.get(m.team1.id);
        if (t1) { t1.hadBye = true; /* No points, no win — team did not play */ }
        return;
      }

      if (!hasScore || !m.team2) return;
      const t1 = teams.get(m.team1.id)!;
      const t2 = teams.get(m.team2.id)!;

      // Games won/lost
      t1.gamesWon += m.score1!; t1.gamesLost += m.score2!;
      t2.gamesWon += m.score2!; t2.gamesLost += m.score1!;

      // Win/Draw/Loss + Points
      if (m.score1! > m.score2!) {
        t1.wins++; t1.points += 3; t2.losses++;
      } else if (m.score2! > m.score1!) {
        t2.wins++; t2.points += 3; t1.losses++;
      } else {
        t1.draws++; t2.draws++; t1.points++; t2.points++;
      }
    });

    // Calculate Buchholz (sum of all opponents' points)
    teams.forEach(team => {
      let buchholz = 0;
      team.opponentIds.forEach(oppId => {
        const opp = teams.get(oppId);
        if (opp) buchholz += opp.points;
      });
      team.buchholz = buchholz;
    });

    // Sort: Points DESC → Buchholz DESC → Games Won DESC
    return Array.from(teams.values()).sort((a, b) =>
      b.points - a.points ||
      b.buchholz - a.buchholz ||
      b.gamesWon - a.gamesWon
    );
  }, [swissMatches]);

  // ── Swiss Pairing Algorithm (matches backend generateNextSwissRound) ──
  // Returns pairings and the BYE team ID (if any)
  function projectSwissPairings(
    currentStandings: SwissTeamStats[],
    existingMatchups: Map<string, Set<string>>,
    teamsWithBye: Set<string>,
  ): { paired: [string, string][]; byeTeamId: string | null } {
    const paired: [string, string][] = [];
    const pairedTeams = new Set<string>();

    // ── STEP 1: Determine BYE team FIRST (before pairing) ──
    // For odd team count, give BYE to lowest-ranked team that hasn't had a BYE yet
    let byeTeamId: string | null = null;
    if (currentStandings.length % 2 !== 0) {
      // Search from bottom of standings for a team without previous BYE
      for (let i = currentStandings.length - 1; i >= 0; i--) {
        if (!teamsWithBye.has(currentStandings[i].id)) {
          byeTeamId = currentStandings[i].id;
          pairedTeams.add(byeTeamId); // Remove from pairing pool
          break;
        }
      }
      // If all teams already had a BYE, give to lowest-ranked
      if (!byeTeamId) {
        byeTeamId = currentStandings[currentStandings.length - 1].id;
        pairedTeams.add(byeTeamId);
      }
    }

    // ── STEP 2: Pair remaining teams by Swiss rules ──
    const eligibleTeams = currentStandings.filter(s => !pairedTeams.has(s.id));

    // Group eligible teams by points (descending)
    const pointsGroups = new Map<number, SwissTeamStats[]>();
    for (const s of eligibleTeams) {
      const group = pointsGroups.get(s.points) || [];
      group.push(s);
      pointsGroups.set(s.points, group);
    }

    const sortedPointValues = Array.from(pointsGroups.keys()).sort((a, b) => b - a);

    // Pair within each points group first
    for (const pts of sortedPointValues) {
      const group = (pointsGroups.get(pts) || []).filter(s => !pairedTeams.has(s.id));
      const pairedInGroup = new Set<string>();

      for (let i = 0; i < group.length; i++) {
        if (pairedInGroup.has(group[i].id)) continue;
        for (let j = i + 1; j < group.length; j++) {
          if (pairedInGroup.has(group[j].id)) continue;
          const hasPlayed = existingMatchups.get(group[i].id)?.has(group[j].id) || false;
          if (!hasPlayed) {
            paired.push([group[i].id, group[j].id]);
            pairedInGroup.add(group[i].id);
            pairedInGroup.add(group[j].id);
            pairedTeams.add(group[i].id);
            pairedTeams.add(group[j].id);
            break;
          }
        }
      }
    }

    // Handle unpaired teams (cross-group)
    const unpaired = eligibleTeams.filter(s => !pairedTeams.has(s.id));
    const crossPaired = new Set<string>();
    const stillUnpaired: SwissTeamStats[] = [];

    for (let i = 0; i < unpaired.length; i++) {
      if (crossPaired.has(unpaired[i].id)) continue;
      let found = false;
      for (let j = i + 1; j < unpaired.length; j++) {
        if (crossPaired.has(unpaired[j].id)) continue;
        const hasPlayed = existingMatchups.get(unpaired[i].id)?.has(unpaired[j].id) || false;
        if (!hasPlayed) {
          paired.push([unpaired[i].id, unpaired[j].id]);
          crossPaired.add(unpaired[i].id);
          crossPaired.add(unpaired[j].id);
          pairedTeams.add(unpaired[i].id);
          pairedTeams.add(unpaired[j].id);
          found = true;
          break;
        }
      }
      if (!found) stillUnpaired.push(unpaired[i]);
    }

    // Rematch as last resort
    const rematchPaired = new Set<string>();
    for (let i = 0; i < stillUnpaired.length; i++) {
      if (rematchPaired.has(stillUnpaired[i].id)) continue;
      for (let j = i + 1; j < stillUnpaired.length; j++) {
        if (rematchPaired.has(stillUnpaired[j].id)) continue;
        paired.push([stillUnpaired[i].id, stillUnpaired[j].id]);
        rematchPaired.add(stillUnpaired[i].id);
        rematchPaired.add(stillUnpaired[j].id);
        pairedTeams.add(stillUnpaired[i].id);
        pairedTeams.add(stillUnpaired[j].id);
        break;
      }
    }

    return { paired, byeTeamId };
  }

  // ── Project ALL future Swiss rounds ──
  const projectedRounds = useMemo(() => {
    const grouped = new Map<number, Match[]>();
    swissMatches.forEach(m => {
      const round = m.round ?? 1;
      if (!grouped.has(round)) grouped.set(round, []);
      grouped.get(round)!.push(m);
    });

    // Find existing rounds
    const existingRounds = Array.from(grouped.keys()).sort((a, b) => a - b);
    if (existingRounds.length === 0) return [];

    // Calculate total rounds
    const uniqueTeamIds = new Set<string>();
    swissMatches.forEach(m => {
      if (m.team1?.id) uniqueTeamIds.add(m.team1.id);
      if (m.team2?.id) uniqueTeamIds.add(m.team2.id);
    });
    const teamCount = uniqueTeamIds.size;
    const totalSwissRounds = teamCount >= 2 ? Math.ceil(Math.log2(teamCount)) + 2 : 1;

    // Check if current round is fully scored
    const maxExistingRound = Math.max(...existingRounds);
    const currentRoundMatches = grouped.get(maxExistingRound) || [];
    const currentRoundComplete = currentRoundMatches.length > 0 &&
      currentRoundMatches.every(m => m.status === 'completed' || m.status === 'bye');

    // Build matchup history from existing matches
    const matchupHistory = new Map<string, Set<string>>();
    const teamsWithByeSet = new Set<string>();
    swissMatches.forEach(m => {
      if (m.team1?.id && m.team2?.id) {
        if (!matchupHistory.has(m.team1.id)) matchupHistory.set(m.team1.id, new Set());
        if (!matchupHistory.has(m.team2.id)) matchupHistory.set(m.team2.id, new Set());
        matchupHistory.get(m.team1.id)!.add(m.team2.id);
        matchupHistory.get(m.team2.id)!.add(m.team1.id);
      }
      // BYE: team2 is null (status can be 'bye' or 'completed')
      if (!m.team2 && m.team1?.id) {
        teamsWithByeSet.add(m.team1.id);
      }
    });

    // If current round not complete, we can only project the next round
    // If complete, we can project all remaining rounds iteratively
    const projections: { round: number; pairings: { team1: SwissTeamStats; team2: SwissTeamStats | null; isBye: boolean }[] }[] = [];

    // Build team lookup
    const teamMap = new Map<string, SwissTeamStats>();
    standings.forEach(s => teamMap.set(s.id, s));

    // Simulate forward from the round after the last existing one
    let simStandings = standings.map(s => ({ ...s, opponentIds: new Set(s.opponentIds) }));
    let simMatchups = new Map(matchupHistory);
    let simByeTeams = new Set(teamsWithByeSet);

    const startRound = currentRoundComplete ? maxExistingRound + 1 : maxExistingRound + 1;

    for (let r = startRound; r <= totalSwissRounds; r++) {
      const { paired, byeTeamId } = projectSwissPairings(simStandings, simMatchups, simByeTeams);

      const roundPairings: { team1: SwissTeamStats; team2: SwissTeamStats | null; isBye: boolean }[] = [];

      for (const [id1, id2] of paired) {
        const t1 = teamMap.get(id1);
        const t2 = teamMap.get(id2);
        if (t1 && t2) {
          roundPairings.push({ team1: t1, team2: t2, isBye: false });
        }
      }

      // Add BYE team (already determined by projectSwissPairings)
      if (byeTeamId) {
        const byeTeam = teamMap.get(byeTeamId);
        if (byeTeam) {
          roundPairings.push({ team1: byeTeam, team2: null, isBye: true });
        }
      }

      projections.push({ round: r, pairings: roundPairings });

      // For subsequent round projection, simulate results:
      // Assume higher-ranked (more points) team wins each match
      // Update simStandings and simMatchups for next iteration
      const nextStandings = simStandings.map(s => ({ ...s, opponentIds: new Set(s.opponentIds) }));

      for (const p of roundPairings) {
        if (p.isBye) {
          // BYE: No points, no win — team did not play, only gets rest round
          const byeStat = nextStandings.find(s => s.id === p.team1.id);
          if (byeStat) { byeStat.hadBye = true; /* No points, no win */ }
          simByeTeams.add(p.team1.id); // Track BYE for rotation
          if (!simMatchups.has(p.team1.id)) simMatchups.set(p.team1.id, new Set());
          continue;
        }
        if (!p.team2) continue;

        // Add matchup history
        if (!simMatchups.has(p.team1.id)) simMatchups.set(p.team1.id, new Set());
        if (!simMatchups.has(p.team2.id)) simMatchups.set(p.team2.id, new Set());
        simMatchups.get(p.team1.id)!.add(p.team2.id);
        simMatchups.get(p.team2.id)!.add(p.team1.id);

        const s1 = nextStandings.find(s => s.id === p.team1.id);
        const s2 = nextStandings.find(s => s.id === p.team2!.id);
        if (s1 && s2) {
          // Higher points wins; if equal, team1 wins (arbitrary)
          if (s1.points >= s2.points) {
            s1.wins++; s1.points += 3; s2.losses++;
          } else {
            s2.wins++; s2.points += 3; s1.losses++;
          }
        }
      }

      // Recalculate Buchholz and re-sort
      nextStandings.forEach(team => {
        let buchholz = 0;
        team.opponentIds.forEach(oppId => {
          const opp = nextStandings.find(s => s.id === oppId);
          if (opp) buchholz += opp.points;
        });
        team.buchholz = buchholz;
      });
      nextStandings.sort((a, b) => b.points - a.points || b.buchholz - a.buchholz || b.gamesWon - a.gamesWon);
      simStandings = nextStandings;
    }

    return projections;
  }, [swissMatches, standings]);

  // Group Swiss matches by round — include placeholder rounds for unplayed future rounds
  const swissRounds = useMemo(() => {
    const grouped = new Map<number, Match[]>();
    swissMatches.forEach(m => {
      const round = m.round ?? 1;
      if (!grouped.has(round)) grouped.set(round, []);
      grouped.get(round)!.push(m);
    });

    // Calculate total expected Swiss rounds from unique team count
    const uniqueTeamIds = new Set<string>();
    swissMatches.forEach(m => {
      if (m.team1?.id) uniqueTeamIds.add(m.team1.id);
      if (m.team2?.id) uniqueTeamIds.add(m.team2.id);
    });
    const teamCount = uniqueTeamIds.size;
    const totalSwissRounds = teamCount >= 2 ? Math.ceil(Math.log2(teamCount)) + 2 : 1;

    // Build round entries — include placeholder rounds for rounds without matches yet
    const result: { round: number; label: string; matches: Match[]; isPlaceholder: boolean }[] = [];
    for (let r = 1; r <= totalSwissRounds; r++) {
      const roundMatches = (grouped.get(r) || []).sort((a, b) => (a.matchNumber ?? 0) - (b.matchNumber ?? 0));
      result.push({
        round: r,
        label: `🇨🇭 Swiss Round ${r}`,
        matches: roundMatches,
        isPlaceholder: !grouped.has(r),
      });
    }

    return result;
  }, [swissMatches]);

  // Track which Swiss round sections are expanded (default: all expanded including projected)
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(new Set(
    swissRounds.map(r => r.round)
  ));

  // Toggle round expansion
  const toggleRound = (round: number) => {
    setExpandedRounds(prev => {
      const next = new Set(prev);
      if (next.has(round)) next.delete(round);
      else next.add(round);
      return next;
    });
  };

  return (
    <div className="space-y-5">
      {/* ── Swiss Standings Table (MAIN visual element) ── */}
      <div className={`rounded-2xl overflow-hidden border ${dt.border}`}>
        {/* Header */}
        <div className={`flex items-center gap-2.5 px-4 py-2.5 border-b ${dt.borderSubtle}`}>
          <Trophy className={`w-4 h-4 ${dt.neonText}`} />
          <h3 className="text-sm font-bold uppercase tracking-wider">🇨🇭 Swiss Standings</h3>
          <span className="text-[10px] text-muted-foreground ml-auto">Top 4 qualify for playoff</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b ${dt.borderSubtle} bg-muted/20`}>
                <th className="w-8 text-center py-2 font-semibold">#</th>
                <th className="text-left py-2 px-3 font-semibold">Tim</th>
                <th className="w-10 text-center py-2 font-semibold">W</th>
                <th className="w-10 text-center py-2 font-semibold">D</th>
                <th className="w-10 text-center py-2 font-semibold">L</th>
                <th className="w-12 text-center py-2 font-semibold">Pts</th>
                <th className="w-14 text-center py-2 font-semibold hidden sm:table-cell">BH</th>
                <th className="w-14 text-center py-2 font-semibold hidden md:table-cell">GW</th>
                <th className="w-14 text-center py-2 font-semibold hidden md:table-cell">GL</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((t, i) => (
                <tr
                  key={t.name}
                  className={`border-b ${dt.borderSubtle} ${dt.hoverBgSubtle} transition-colors relative ${
                    i < 4 ? dt.bgSubtle : ''
                  } ${i === 4 ? 'border-t-2 border-t-idm-gold-warm/30' : ''}`}
                >
                  {/* Rank */}
                  <td className="text-center py-2">
                    <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-bold ${
                      i === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                      i === 1 ? 'bg-green-500/20 text-green-500' :
                      i === 2 ? 'bg-emerald-500/15 text-emerald-500' :
                      i === 3 ? `bg-idm-gold-warm/10 text-idm-gold-warm` :
                      'text-muted-foreground'
                    }`}>
                      {i + 1}
                    </span>
                  </td>
                  {/* Team name with optional trophy badge for qualifying teams */}
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold ${
                        i < 4 ? `bg-gradient-to-br ${dt.division === 'male' ? 'from-idm-male to-idm-male-light' : 'from-idm-female to-idm-female-light'} text-white` :
                        `${dt.iconBg} ${dt.text}`
                      }`}>{t.name.slice(0, 2).toUpperCase()}</div>
                      <span className={`font-semibold truncate ${i < 4 ? dt.neonText : ''}`}>{t.name}</span>
                      {i < 4 && <span className="text-xs" title="Qualified for playoff">🏆</span>}
                    </div>
                  </td>
                  {/* W / D / L */}
                  <td className="text-center font-semibold text-green-500">{t.wins}</td>
                  <td className="text-center font-semibold text-yellow-500">{t.draws}</td>
                  <td className="text-center font-semibold text-red-500">{t.losses}</td>
                  {/* Points */}
                  <td className="text-center font-bold">{t.points}</td>
                  {/* Buchholz (hidden on small screens) */}
                  <td className="text-center text-muted-foreground hidden sm:table-cell">{t.buchholz}</td>
                  {/* GW / GL (hidden on smaller screens) */}
                  <td className="text-center text-muted-foreground hidden md:table-cell">{t.gamesWon}</td>
                  <td className="text-center text-muted-foreground hidden md:table-cell">{t.gamesLost}</td>
                </tr>
              ))}
              {/* Cut-line indicator if more than 4 teams */}
              {standings.length > 4 && (
                <tr>
                  <td colSpan={9} className="py-0">
                    <div className="relative h-4 flex items-center">
                      <div className="absolute inset-x-3 border-t-2 border-dashed border-idm-gold-warm/25" />
                      <span className="mx-auto px-2 text-[10px] font-bold text-idm-gold-warm/60 uppercase tracking-wider bg-background relative z-10">
                        ── Cut Line ──
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Legend */}
        <div className={`flex items-center gap-4 px-4 py-1.5 border-t ${dt.borderSubtle} text-[10px] text-muted-foreground`}>
          <span><span className="text-xs">🏆</span> = Qualified</span>
          <span><strong className="text-idm-gold-warm">BH</strong> = Buchholz</span>
          <span><strong>GW</strong> = Games Won</span>
          <span><strong>GL</strong> = Games Lost</span>
        </div>
      </div>

      {/* ── Round-by-Round Swiss Match Cards ── */}
      {swissRounds.map(({ round, label, matches: roundMatches, isPlaceholder }) => {
        const isExpanded = expandedRounds.has(round);
        const projected = projectedRounds.find(pr => pr.round === round);

        return (
          <div key={round}>
            {/* Round header — collapsible */}
            <button
              onClick={() => toggleRound(round)}
              className={`w-full flex items-center gap-2 mb-2 group`}
            >
              <div className={`px-3 py-1.5 rounded-lg ${isPlaceholder ? 'bg-muted/30 text-muted-foreground' : `${dt.bg} ${dt.text}`} text-xs font-bold uppercase tracking-wider flex items-center gap-1.5`}>
                {label}
                {isPlaceholder ? (
                  <span className="text-muted-foreground/60">proyeksi</span>
                ) : (
                  <span className="text-muted-foreground">{roundMatches.length} match</span>
                )}
              </div>
              <div className={`flex-1 h-px ${dt.borderSubtle}`} />
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              )}
            </button>

            {/* Projected round — show pairings based on current standings */}
            {isPlaceholder && isExpanded && projected && projected.pairings.length > 0 && (
              <div className="space-y-2">
                {/* Projection disclaimer */}
                <div className="flex items-center gap-1.5 px-1 mb-1">
                  <span className="text-[9px] font-semibold text-amber-500/80 uppercase tracking-wider">⚠ Proyeksi — bisa berubah sesuai hasil ronde sebelumnya</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {projected.pairings.map((p, pi) => {
                    if (p.isBye) {
                      return (
                        <div
                          key={`bye-${pi}`}
                          className="rounded-lg overflow-hidden border border-dashed border-muted-foreground/15 bg-muted/5"
                        >
                          <div className="flex items-center px-3 py-2 border-b border-dashed border-muted-foreground/10">
                            <span className="text-xs font-semibold text-foreground/70 truncate flex-1">{p.team1.name}</span>
                            <span className="text-sm font-bold tabular-nums text-muted-foreground">-</span>
                          </div>
                          <div className="flex items-center px-3 py-2">
                            <span className="text-xs font-semibold text-muted-foreground italic truncate flex-1">BYE</span>
                            <span className="text-sm font-bold tabular-nums text-muted-foreground">-</span>
                          </div>
                          <div className="px-2.5 py-1 border-t border-dashed border-muted-foreground/10">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-500/60">WALKOVER</span>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={`proj-${pi}`}
                        className="rounded-lg overflow-hidden border border-dashed border-muted-foreground/15 bg-muted/5"
                      >
                        <div className="flex items-center px-3 py-2 border-b border-dashed border-muted-foreground/10">
                          <div className="w-5 h-5 rounded bg-muted/30 flex items-center justify-center text-[9px] font-bold text-muted-foreground mr-2">{p.team1.name.slice(0, 2).toUpperCase()}</div>
                          <span className="text-xs font-semibold text-foreground/70 truncate flex-1">{p.team1.name}</span>
                          <span className="text-sm font-bold tabular-nums text-muted-foreground">-</span>
                        </div>
                        <div className="flex items-center px-3 py-2">
                          <div className="w-5 h-5 rounded bg-muted/30 flex items-center justify-center text-[9px] font-bold text-muted-foreground mr-2">{p.team2!.name.slice(0, 2).toUpperCase()}</div>
                          <span className="text-xs font-semibold text-foreground/70 truncate flex-1">{p.team2!.name}</span>
                          <span className="text-sm font-bold tabular-nums text-muted-foreground">-</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Placeholder with no projection data (fallback) */}
            {isPlaceholder && isExpanded && (!projected || projected.pairings.length === 0) && (
              <div className="rounded-xl border border-dashed border-muted-foreground/20 bg-muted/5 px-4 py-6 text-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-muted/20 flex items-center justify-center">
                    <Swords className="w-5 h-5 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-semibold text-muted-foreground/60">
                    Menunggu Ronde {round - 1} Selesai
                  </p>
                  <p className="text-xs text-muted-foreground/40">
                    Pertandingan akan dibuat otomatis setelah ronde sebelumnya selesai
                  </p>
                </div>
              </div>
            )}

            {/* Match cards grid — only for non-placeholder rounds */}
            {!isPlaceholder && isExpanded && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {roundMatches.map((m) => {
                  const hasScore = m.score1 !== null && m.score2 !== null;
                  const isByeMatch = !m.team2; // BYE = no opponent
                  const winner1 = hasScore && !isByeMatch && m.score1! > m.score2!;
                  const winner2 = hasScore && !isByeMatch && m.score2! > m.score1!;
                  const isDraw = hasScore && !isByeMatch && m.score1 === m.score2;
                  const isLive = m.status === 'live' || m.status === 'main_event';
                  const isCompleted = m.status === 'completed' || m.status === 'scoring';
                  const isReady = m.status === 'ready';
                  const isPending = m.status === 'pending';
                  const bothTeamsExist = !!(m.team1 && m.team2);
                  const bothScoresEntered = isAdmin && isLive && tournamentInMainEvent &&
                    (adminProps!.scoreInputs[m.id]?.s1 ?? '') !== '' && (adminProps!.scoreInputs[m.id]?.s2 ?? '') !== '';

                  const handleSubmitScore = () => {
                    if (!adminProps) return;
                    const s1 = parseInt(adminProps.scoreInputs[m.id]?.s1 ?? '');
                    const s2 = parseInt(adminProps.scoreInputs[m.id]?.s2 ?? '');
                    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) return;
                    adminProps.setConfirmDialog({
                      open: true,
                      title: 'Konfirmasi Skor?',
                      description: `${adminProps.getTeamName(m.team1?.id ?? null)} ${s1} - ${s2} ${adminProps.getTeamName(m.team2?.id ?? null)}`,
                      onConfirm: () => adminProps!.scoreMutation.mutate({ tournamentId: adminProps!.tournamentId, matchId: m.id, score1: s1, score2: s2 }),
                    });
                  };

                  const handleUndo = () => {
                    if (!adminProps) return;
                    adminProps.setConfirmDialog({
                      open: true,
                      title: 'Undo Skor?',
                      description: `Batalkan skor ${adminProps.getTeamName(m.team1?.id ?? null)} ${m.score1} - ${m.score2} ${adminProps.getTeamName(m.team2?.id ?? null)}? Stats pemain akan dikembalikan.`,
                      onConfirm: () => adminProps!.undoScoreMutation.mutate({ tournamentId: adminProps!.tournamentId, matchId: m.id }),
                    });
                  };

                  return (
                    <div
                      key={m.id}
                      className={`hover-scale-sm rounded-lg overflow-hidden border ${
                        isLive ? `border-red-500/30 ${dt.neonPulse}` : dt.borderSubtle
                      } transition-all ${dt.hoverBorder} relative`}
                      style={{ background: 'var(--card-bg, rgba(20,17,10,0.6))' }}
                    >
                      {/* Admin header bar */}
                      {isAdmin && (isLive || (isReady || isPending) || isCompleted) && (
                        <div className={`flex items-center justify-between px-2.5 py-1 border-b ${dt.borderSubtle} bg-muted/30`}>
                          <div className="flex items-center gap-1.5">
                            {(isReady || isPending) && bothTeamsExist && tournamentInMainEvent && (
                              <button
                                onClick={() => adminProps!.startMatchMutation.mutate({ tournamentId: adminProps!.tournamentId, matchId: m.id })}
                                disabled={adminProps!.startMatchMutation.isPending}
                                className="compact-pill flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-green-500/15 text-green-400 hover:bg-green-500/25 border border-green-500/25 transition-colors disabled:opacity-50"
                              >
                                <Play className="w-2.5 h-2.5" /> Start
                              </button>
                            )}
                            {isLive && (
                              <div className="flex items-center gap-1">
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                                </span>
                                <span className="text-[9px] font-black uppercase tracking-widest text-red-500">LIVE</span>
                              </div>
                            )}
                            {isCompleted && tournamentInMainEvent && (
                              <span className="text-[9px] font-bold text-green-400">✅</span>
                            )}
                          </div>
                          {isAdmin && m.format && (
                            <span className="text-[9px] font-bold text-muted-foreground/60">{m.format}</span>
                          )}
                        </div>
                      )}
                      {/* Team 1 row */}
                      <div className={`flex items-center px-3 py-2 border-b ${dt.borderSubtle} ${winner1 ? dt.bgSubtle : ''} ${!m.team1 ? 'opacity-50' : ''}`}>
                        <span className={`text-xs font-semibold truncate flex-1 ${winner1 ? dt.neonText : !m.team1 ? 'text-muted-foreground italic' : 'text-foreground/80'}`}>
                          {m.team1?.name || 'TBD'}
                        </span>
                        {/* Score badge: W/L/BYE for completed, score otherwise (public only) */}
                        {!isAdmin && hasScore && m.team1 && (
                          isByeMatch ? (
                            <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/15 text-amber-500">
                              BYE
                            </span>
                          ) : (
                            <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              winner1 ? 'bg-green-500/15 text-green-500' :
                              isDraw ? 'bg-yellow-500/15 text-yellow-500' :
                              'bg-red-500/15 text-red-500'
                            }`}>
                              {winner1 ? 'W' : isDraw ? 'D' : 'L'}
                            </span>
                          )
                        )}
                        {isAdmin && isLive && tournamentInMainEvent ? (
                          <input
                            type="number" min={0}
                            value={adminProps!.scoreInputs[m.id]?.s1 ?? ''}
                            onChange={e => adminProps!.setScoreInputs(prev => ({...prev, [m.id]: {...prev[m.id] ?? {s1:'', s2:''}, s1: e.target.value}}))}
                            className="w-10 h-7 text-center text-sm font-black bg-background/50 border border-border/40 rounded-md focus:border-idm-gold-warm/50 focus:outline-none tabular-nums"
                            placeholder="0"
                          />
                        ) : (
                          <span className={`text-sm font-bold tabular-nums w-6 text-right ${winner1 ? dt.neonText : isDraw ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                            {m.team1 ? (hasScore ? m.score1 : '-') : '-'}
                          </span>
                        )}
                      </div>
                      {/* Team 2 row */}
                      <div className={`flex items-center px-3 py-2 ${winner2 ? dt.bgSubtle : ''} ${!m.team2 ? 'opacity-50' : ''}`}>
                        <span className={`text-xs font-semibold truncate flex-1 ${winner2 ? dt.neonText : !m.team2 ? 'text-muted-foreground italic' : 'text-foreground/80'}`}>
                          {m.team2?.name || (isByeMatch ? 'BYE' : 'TBD')}
                        </span>
                        {/* Score badge: W/L for completed, score otherwise (public only) */}
                        {!isAdmin && hasScore && m.team2 && (
                          <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            winner2 ? 'bg-green-500/15 text-green-500' :
                            isDraw ? 'bg-yellow-500/15 text-yellow-500' :
                            'bg-red-500/15 text-red-500'
                          }`}>
                            {winner2 ? 'W' : isDraw ? 'D' : 'L'}
                          </span>
                        )}
                        {isAdmin && isLive && tournamentInMainEvent ? (
                          <input
                            type="number" min={0}
                            value={adminProps!.scoreInputs[m.id]?.s2 ?? ''}
                            onChange={e => adminProps!.setScoreInputs(prev => ({...prev, [m.id]: {...prev[m.id] ?? {s1:'', s2:''}, s2: e.target.value}}))}
                            className="w-10 h-7 text-center text-sm font-black bg-background/50 border border-border/40 rounded-md focus:border-idm-gold-warm/50 focus:outline-none tabular-nums"
                            placeholder="0"
                          />
                        ) : (
                          <span className={`text-sm font-bold tabular-nums w-6 text-right ${winner2 ? dt.neonText : isDraw ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                            {m.team2 ? (hasScore ? m.score2 : '-') : '-'}
                          </span>
                        )}
                      </div>
                      {/* Admin: Submit button */}
                      {isAdmin && isLive && tournamentInMainEvent && bothScoresEntered && (
                        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 border-t ${dt.borderSubtle}`}>
                          <button
                            onClick={handleSubmitScore}
                            disabled={adminProps!.scoreMutation.isPending}
                            className="compact-pill flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-idm-gold-warm/20 text-idm-gold-warm hover:bg-idm-gold-warm/30 border border-idm-gold-warm/30 transition-colors disabled:opacity-50"
                          >
                            <Check className="w-3 h-3" /> Submit
                          </button>
                        </div>
                      )}
                      {/* Admin: Undo button for completed matches */}
                      {isAdmin && isCompleted && tournamentInMainEvent && bothTeamsExist && (
                        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 border-t ${dt.borderSubtle}`}>
                          <button
                            onClick={handleUndo}
                            disabled={adminProps!.undoScoreMutation.isPending}
                            className="compact-pill flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-orange-400 hover:bg-orange-400/10 border border-orange-400/25 transition-colors disabled:opacity-50"
                          >
                            <Undo2 className="w-3 h-3" /> Undo
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Playoff Section — Bracket-style visual ── */}
      {playoffMatches.length > 0 && (() => {
        // Categorize playoff matches by groupLabel
        const sf1 = playoffMatches.find(m => m.groupLabel === 'SF1');
        const sf2 = playoffMatches.find(m => m.groupLabel === 'SF2');
        const grandFinal = playoffMatches.find(m => m.groupLabel === 'Final');
        const thirdPlace = playoffMatches.find(m => m.groupLabel === '3rd');
        const semiFinals = [sf1, sf2].filter(Boolean) as Match[];
        const finals = [grandFinal, thirdPlace].filter(Boolean) as Match[];
        // Other playoff matches not matching known labels
        const otherPlayoff = playoffMatches.filter(m => !['SF1', 'SF2', 'Final', '3rd'].includes(m.groupLabel || ''));

        // Helper to render a playoff match card
        const renderPlayoffCard = (m: Match, labelOverride?: string) => {
          const label = labelOverride || m.groupLabel || (m.bracket === 'lower' ? '3rd Place' : `R${m.round}`);
          const matchLabel = label === 'SF1' ? 'Semi Final 1' : label === 'SF2' ? 'Semi Final 2' : label === 'Final' ? 'Grand Final' : label === '3rd' ? '3rd Place' : label;
          const isGrandFinal = label === 'Final';

          if (isAdmin) {
            return (
              <BracketMatchCard
                key={m.id}
                match={m}
                matchLabel={matchLabel}
                isGrandFinal={isGrandFinal}
                mode="admin"
                adminProps={adminProps}
              />
            );
          }

          const hasScore = m.score1 !== null && m.score2 !== null;
          const winner1 = hasScore && m.score1! > m.score2!;
          const winner2 = hasScore && m.score2! > m.score1!;
          const isLive = m.status === 'live' || m.status === 'main_event';
          const is3rd = label === '3rd';
          const isByeMatch = (!m.team1 || !m.team2) && (m.team1 || m.team2) && m.status !== 'completed';

          return (
            <div
              key={m.id}
              className={`hover-scale-sm rounded-lg overflow-hidden border transition-all relative ${
                isLive ? `border-red-500/30 ${dt.neonPulse}` :
                isGrandFinal ? 'border-idm-gold-warm/40 shadow-[0_0_12px_rgba(239,249,35,0.15)]' :
                is3rd ? 'border-orange-500/20' :
                'border-idm-gold-warm/20'
              }`}
              style={{ background: 'var(--card-bg, rgba(20,17,10,0.6))' }}
            >
              <div className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center justify-between ${
                isGrandFinal ? 'bg-idm-gold-warm/10 text-idm-gold-warm' :
                is3rd ? 'bg-orange-500/5 text-orange-400' :
                `${dt.neonText} bg-idm-gold-warm/5`
              }`}>
                <span className="flex items-center gap-1.5">
                  {isGrandFinal && <span>🏆</span>}
                  {is3rd && <span>🥉</span>}
                  {matchLabel}
                </span>
                {isByeMatch && (
                  <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded">WALKOVER</span>
                )}
              </div>
              <div className={`flex items-center px-3 py-2 border-b ${dt.borderSubtle} ${winner1 ? dt.bgSubtle : ''} ${!m.team1 ? 'opacity-50' : ''}`}>
                <span className={`text-xs font-semibold truncate flex-1 ${winner1 ? dt.neonText : !m.team1 ? 'text-muted-foreground italic' : 'text-foreground/80'}`}>
                  {m.team1?.name || 'TBD'}
                </span>
                <span className={`text-sm font-bold tabular-nums w-6 text-right ${winner1 ? dt.neonText : 'text-muted-foreground'}`}>
                  {m.team1 ? (hasScore ? m.score1 : '-') : (m.status === 'pending' || m.status === 'ready' ? '' : (hasScore ? m.score1 : '-'))}
                </span>
              </div>
              <div className={`flex items-center px-3 py-2 ${winner2 ? dt.bgSubtle : ''} ${!m.team2 ? 'opacity-50' : ''}`}>
                <span className={`text-xs font-semibold truncate flex-1 ${winner2 ? dt.neonText : !m.team2 ? 'text-muted-foreground italic' : 'text-foreground/80'}`}>
                  {m.team2?.name || 'TBD'}
                </span>
                <span className={`text-sm font-bold tabular-nums w-6 text-right ${winner2 ? dt.neonText : 'text-muted-foreground'}`}>
                  {m.team2 ? (hasScore ? m.score2 : '-') : (m.status === 'pending' || m.status === 'ready' ? '' : (hasScore ? m.score2 : '-'))}
                </span>
              </div>
            </div>
          );
        };

        return (
          <div className="space-y-4">
            {/* ── Semi Final Section ── */}
            {semiFinals.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`px-3 py-1.5 rounded-lg bg-idm-gold-warm/10 text-idm-gold-warm text-xs font-bold uppercase tracking-wider`}>
                    ⚔️ Semi Final
                  </div>
                  <div className={`flex-1 h-px ${dt.borderSubtle}`} />
                  <span className="text-[10px] text-muted-foreground">Pemenang lolos Grand Final</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {semiFinals.map(m => <Fragment key={m.id}>{renderPlayoffCard(m)}</Fragment>)}
                </div>
              </div>
            )}

            {/* ── Connection visual: SF → Finals ── */}
            {semiFinals.length > 0 && finals.length > 0 && (
              <div className="flex items-center justify-center gap-2 py-1">
                {/* Winner path */}
                <div className="flex-1 flex items-center justify-end">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-idm-gold-warm uppercase tracking-wider">🏆 Pemenang</span>
                    <div className="h-px w-8 bg-idm-gold-warm/30" />
                  </div>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <div className="w-px h-3 bg-idm-gold-warm/20" />
                  <div className="w-3 h-3 rounded-full border border-idm-gold-warm/30 bg-idm-gold-warm/5 flex items-center justify-center">
                    <Crown className="w-2 h-2 text-idm-gold-warm" />
                  </div>
                  <div className="w-px h-3 bg-orange-500/20" />
                </div>
                {/* Loser path */}
                <div className="flex-1 flex items-center">
                  <div className="flex items-center gap-1">
                    <div className="h-px w-8 bg-orange-500/20" />
                    <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">Kalah → 🥉</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Grand Final + 3rd Place Section ── */}
            {finals.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="px-3 py-1.5 rounded-lg bg-idm-gold-warm/15 text-idm-gold-warm text-xs font-bold uppercase tracking-wider border border-idm-gold-warm/20">
                    🏆 Grand Final
                  </div>
                  <div className={`flex-1 h-px ${dt.borderSubtle}`} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Grand Final card (left/prominent) */}
                  {grandFinal && renderPlayoffCard(grandFinal, 'Final')}
                  {/* 3rd Place card (right) */}
                  {thirdPlace && renderPlayoffCard(thirdPlace, '3rd')}
                </div>
              </div>
            )}

            {/* ── Other playoff matches fallback ── */}
            {otherPlayoff.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`px-3 py-1.5 rounded-lg bg-idm-gold-warm/10 text-idm-gold-warm text-xs font-bold uppercase tracking-wider`}>
                    🏆 Playoff
                  </div>
                  <div className={`flex-1 h-px ${dt.borderSubtle}`} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {otherPlayoff.sort((a, b) => (a.round ?? 0) - (b.round ?? 0)).map(m => <Fragment key={m.id}>{renderPlayoffCard(m)}</Fragment>)}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

/* ─── Upper Semi (Double Elimination) View — MPL Premium with SVG Connectors ─── */

function getUpperSemiRoundLabel(round: number, bracket: string, allMatches: Match[]): string {
  const bracketMatches = allMatches.filter(m => m.bracket === bracket);
  const rounds = [...new Set(bracketMatches.map(m => m.round ?? 1))].sort((a, b) => a - b);
  const maxRound = Math.max(...rounds);
  const matchCountInRound = bracketMatches.filter(m => (m.round ?? 1) === round).length;

  if (bracket === 'upper') {
    if (round === maxRound) return 'Upper Final';
    if (round === maxRound - 1 && matchCountInRound === 2) return 'Upper Semi';
    if (rounds.length <= 2 && round === rounds[0]) return 'Upper Semi';
    return `Ronde ${round}`;
  }
  if (bracket === 'lower') {
    if (round === maxRound) return 'Lower Final';
    const secondToLast = rounds[rounds.length - 2];
    if (round === secondToLast && rounds.length > 2) return 'Lower Semi';
    return `Lower R${round}`;
  }
  if (bracket === 'grand_final') return 'Grand Final';
  return `Ronde ${round}`;
}

/* ─── Reusable Bracket Column View — horizontal layout with SVG connectors ─── */
interface BracketColumnViewProps {
  roundsData: { round: number; label: string; matches: Match[] }[];
  strokeColor: string;
  sectionTitle: string;
  titleIcon: React.ReactNode;
  borderColor: string;
  headerBg: string;
  headerText: string;
  matchLabelPrefix: string;
  mode?: 'public' | 'admin';
  adminProps?: AdminBracketProps;
}

function BracketColumnView({
  roundsData,
  strokeColor,
  sectionTitle,
  titleIcon,
  borderColor,
  headerBg,
  headerText,
  matchLabelPrefix,
  mode,
  adminProps,
}: BracketColumnViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [connectors, setConnectors] = useState<ConnectorPath[]>([]);

  /* SOURCE→TARGET connector calculation — same algorithm as main bracket */
  const calculateConnectors = useCallback(() => {
    if (!containerRef.current || roundsData.length < 2) {
      setConnectors([]);
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const newConnectors: ConnectorPath[] = [];

    // Build position lookup for each round
    const positionLookupByRound: Map<number, Map<number, Match>> = new Map();
    for (let r = 0; r < roundsData.length; r++) {
      const lookup = new Map<number, Match>();
      for (const m of roundsData[r].matches) {
        const pos = getBracketPosition(m.groupLabel);
        if (pos > 0) lookup.set(pos, m);
      }
      positionLookupByRound.set(r, lookup);
    }

    for (let r = 0; r < roundsData.length - 1; r++) {
      const sourceRound = roundsData[r];
      const targetRoundIdx = r + 1;
      const targetPositionLookup = positionLookupByRound.get(targetRoundIdx) || new Map();

      // Group source matches by their target match ID
      const targetGroups = new Map<string, { sources: Match[]; target: Match }>();
      const hasPositions = sourceRound.matches.some(m => getBracketPosition(m.groupLabel) > 0);

      if (hasPositions) {
        for (const sourceMatch of sourceRound.matches) {
          const sourcePos = getBracketPosition(sourceMatch.groupLabel);
          if (sourcePos <= 0) continue;
          const targetPos = Math.ceil(sourcePos / 2);
          const targetMatch = targetPositionLookup.get(targetPos);
          if (!targetMatch) continue;

          const targetKey = targetMatch.id;
          if (!targetGroups.has(targetKey)) {
            targetGroups.set(targetKey, { sources: [], target: targetMatch });
          }
          targetGroups.get(targetKey)!.sources.push(sourceMatch);
        }
      } else {
        const targetRound = roundsData[targetRoundIdx];
        for (let ni = 0; ni < targetRound.matches.length; ni++) {
          const targetMatch = targetRound.matches[ni];
          const source1 = sourceRound.matches[ni * 2] || null;
          const source2 = sourceRound.matches[ni * 2 + 1] || null;
          const sources = [source1, source2].filter(Boolean) as Match[];
          if (sources.length === 0) continue;
          targetGroups.set(targetMatch.id, { sources, target: targetMatch });
        }
      }

      // Draw connectors for each target group
      for (const [targetKey, group] of targetGroups) {
        const { sources, target: targetMatch } = group;
        if (!targetMatch || sources.length === 0) continue;

        const targetCardEl = cardRefs.current.get(`round-${targetRoundIdx}-match-${targetMatch.id}`);
        if (!targetCardEl) continue;

        const targetRect = targetCardEl.getBoundingClientRect();
        const targetY = targetRect.top + targetRect.height / 2 - containerRect.top;
        const targetX = targetRect.left - containerRect.left;

        const sourcePoints = sources.map(s => {
          const el = cardRefs.current.get(`round-${r}-match-${s.id}`);
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          return { x: rect.right - containerRect.left, y: rect.top + rect.height / 2 - containerRect.top, match: s };
        }).filter(Boolean) as { x: number; y: number; match: Match }[];

        if (sourcePoints.length === 0) continue;

        const maxSourceX = Math.max(...sourcePoints.map(p => p.x));
        const midX = (maxSourceX + targetX) / 2;

        if (sourcePoints.length === 1) {
          const p = sourcePoints[0];
          newConnectors.push({ key: `conn-${r}-${targetKey}-arm1`, d: `M ${p.x} ${p.y} H ${midX} V ${targetY}`, color: strokeColor, isWinner: matchHasWinner(p.match) });
        } else {
          for (let i = 0; i < sourcePoints.length; i++) {
            const p = sourcePoints[i];
            newConnectors.push({ key: `conn-${r}-${targetKey}-arm${i}`, d: `M ${p.x} ${p.y} H ${midX}`, color: strokeColor, isWinner: matchHasWinner(p.match) });
          }
          const topY = Math.min(...sourcePoints.map(p => p.y));
          const bottomY = Math.max(...sourcePoints.map(p => p.y));
          newConnectors.push({ key: `conn-${r}-${targetKey}-rail`, d: `M ${midX} ${topY} V ${bottomY}`, color: strokeColor, isWinner: sourcePoints.some(p => matchHasWinner(p.match)) });
        }

        newConnectors.push({ key: `conn-${r}-${targetKey}-bridge`, d: `M ${midX} ${targetY} H ${targetX}`, color: strokeColor, isWinner: sourcePoints.some(p => matchHasWinner(p.match)) });
        newConnectors.push({ key: `conn-${r}-${targetKey}-dot`, d: `M ${midX - 3} ${targetY} h 6`, color: strokeColor, isWinner: true });
      }
    }

    setConnectors(newConnectors);
  }, [roundsData, strokeColor]);

  /* Card alignment — position R2+ cards at vertical midpoint of feeders */
  const alignBracketCards = useCallback(() => {
    if (!containerRef.current || roundsData.length < 2) return;

    const r0HasPositions = roundsData[0].matches.some(m => getBracketPosition(m.groupLabel) > 0);
    if (!r0HasPositions) {
      for (let r = 1; r < roundsData.length; r++) {
        const gapMultiplier = Math.pow(2, r);
        const roundCols = containerRef.current.querySelectorAll(`[data-round="${r}"]`);
        roundCols.forEach((col) => {
          const cards = col.children;
          for (let i = 0; i < cards.length; i++) {
            const card = cards[i] as HTMLElement;
            card.style.marginTop = i === 0 ? `${(gapMultiplier - 1) * 20}px` : `${gapMultiplier * 24 + 16}px`;
          }
        });
      }
      return;
    }

    const cardElMap = new Map<string, HTMLDivElement>();
    for (const [key, el] of cardRefs.current.entries()) {
      cardElMap.set(key, el);
    }

    for (let r = 1; r < roundsData.length; r++) {
      const currentRound = roundsData[r];
      const prevRound = roundsData[r - 1];
      const prevPosMap = new Map<number, HTMLDivElement>();
      for (const pm of prevRound.matches) {
        const pos = getBracketPosition(pm.groupLabel);
        const el = cardElMap.get(`round-${r - 1}-match-${pm.id}`);
        if (pos > 0 && el) prevPosMap.set(pos, el);
      }

      for (const m of currentRound.matches) {
        const bracketPos = getBracketPosition(m.groupLabel);
        const el = cardElMap.get(`round-${r}-match-${m.id}`);
        if (!el || bracketPos <= 0) continue;

        const feederPos1 = bracketPos * 2 - 1;
        const feederPos2 = bracketPos * 2;
        const feederEl1 = prevPosMap.get(feederPos1);
        const feederEl2 = prevPosMap.get(feederPos2);
        const currentMarginTop = parseFloat(el.style.marginTop) || 0;

        if (feederEl1 && feederEl2) {
          const f1Rect = feederEl1.getBoundingClientRect();
          const f2Rect = feederEl2.getBoundingClientRect();
          const cardRect = el.getBoundingClientRect();
          const cRect = containerRef.current.getBoundingClientRect();
          const targetCenterY = (f1Rect.top + f1Rect.height / 2 - cRect.top + f2Rect.top + f2Rect.height / 2 - cRect.top) / 2;
          const currentCenterY = cardRect.top + cardRect.height / 2 - cRect.top;
          el.style.marginTop = `${targetCenterY - (currentCenterY - currentMarginTop)}px`;
        } else if (feederEl1 || feederEl2) {
          const feederEl = feederEl1 || feederEl2!;
          const fRect = feederEl.getBoundingClientRect();
          const cardRect = el.getBoundingClientRect();
          const cRect = containerRef.current.getBoundingClientRect();
          const fCenterY = fRect.top + fRect.height / 2 - cRect.top;
          const currentCenterY = cardRect.top + cardRect.height / 2 - cRect.top;
          el.style.marginTop = `${fCenterY - (currentCenterY - currentMarginTop)}px`;
        }
      }
    }
  }, [roundsData]);

  // Timing effects for alignment and connector calculation
  useEffect(() => {
    const timers = [100, 300, 600, 1200].map(delay => setTimeout(alignBracketCards, delay));
    return () => timers.forEach(clearTimeout);
  }, [alignBracketCards]);

  useEffect(() => {
    const attempts = [80, 150, 350, 700, 1300];
    const timers = attempts.map(delay => setTimeout(calculateConnectors, delay));
    const handleResize = () => { alignBracketCards(); setTimeout(calculateConnectors, 50); };
    const scrollContainer = containerRef.current?.parentElement;
    const handleScroll = () => calculateConnectors();
    window.addEventListener('resize', handleResize);
    scrollContainer?.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('resize', handleResize);
      scrollContainer?.removeEventListener('scroll', handleScroll);
    };
  }, [calculateConnectors, alignBracketCards]);

  const setCardRef = useCallback((key: string, el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(key, el);
    else cardRefs.current.delete(key);
  }, []);

  const isFinalRound = (roundIdx: number) => roundIdx === roundsData.length - 1;

  return (
    <div className={`rounded-2xl overflow-hidden border ${borderColor}`}>
      {/* Section Header */}
      <div className={`flex items-center gap-2.5 px-4 py-2.5 border-b ${borderColor} ${headerBg}`}>
        {titleIcon}
        <h3 className={`text-sm font-bold uppercase tracking-wider ${headerText}`}>{sectionTitle}</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {roundsData.reduce((sum, r) => sum + r.matches.length, 0)} pertandingan
        </span>
      </div>
      <div className="p-2">
        <ZoomableContainer>
          <div className="min-w-max pb-2 -mx-1">
            <div className="relative px-2" ref={containerRef}>
              {connectors.length > 0 && <BracketConnectors paths={connectors} />}
              <div className="flex gap-12">
                {roundsData.map((round, roundIdx) => {
                  const isGF = isFinalRound(roundIdx);
                  return (
                    <div key={round.round} className="flex flex-col" style={{ minWidth: isGF ? '220px' : '200px' }}>
                      <div className="text-center mb-4">
                        <div className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl ${headerBg} ${headerText} text-sm font-bold uppercase tracking-wider border ${borderColor}`}>
                          <Swords className="w-3.5 h-3.5 opacity-60" />
                          {round.label}
                        </div>
                      </div>
                      <div
                        className="flex-1 flex flex-col"
                        data-round={roundIdx}
                        style={{ gap: roundIdx === 0 ? '20px' : '0px' }}
                      >
                        {round.matches.map((m, mi) => (
                          <div
                            key={m.id}
                            ref={(el) => setCardRef(`round-${roundIdx}-match-${m.id}`, el)}
                          >
                            <BracketMatchCard
                              match={m}
                              isGrandFinal={isGF}
                              matchLabel={`${matchLabelPrefix}${mi + 1}`}
                              mode={mode}
                              adminProps={adminProps}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </ZoomableContainer>
      </div>
    </div>
  );
}

function UpperSemiView({ matches, mode, adminProps }: { matches: Match[]; mode?: 'public' | 'admin'; adminProps?: AdminBracketProps }) {
  const dt = useDivisionTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [connectors, setConnectors] = useState<ConnectorPath[]>([]);

  // Separate matches by bracket type
  const upperMatches = useMemo(() => matches.filter(m => m.bracket === 'upper'), [matches]);
  const lowerMatches = useMemo(() => matches.filter(m => m.bracket === 'lower'), [matches]);
  const gfMatches = useMemo(() => matches.filter(m => m.bracket === 'grand_final'), [matches]);

  // Group UB matches by round with BYE placeholder filling, sort ascending
  const upperRounds = useMemo(() => {
    const grouped = new Map<number, Match[]>();
    upperMatches.forEach(m => {
      const round = m.round ?? 1;
      if (!grouped.has(round)) grouped.set(round, []);
      grouped.get(round)!.push(m);
    });
    const rounds = Array.from(grouped.entries())
      .sort(([a], [b]) => a - b)
      .map(([round, roundMatches]) => ({
        round,
        label: getUpperSemiRoundLabel(round, 'upper', matches),
        matches: [...roundMatches].sort((a, b) => {
          const posA = getBracketPosition(a.groupLabel);
          const posB = getBracketPosition(b.groupLabel);
          if (posA && posB) return posA - posB;
          return (a.matchNumber ?? 0) - (b.matchNumber ?? 0);
        }),
      }));
    return fillByePlaceholders(rounds, 'U');
  }, [upperMatches, matches]);

  // Group LB matches by round with BYE placeholder filling, sort ascending
  const lowerRounds = useMemo(() => {
    const grouped = new Map<number, Match[]>();
    lowerMatches.forEach(m => {
      const round = m.round ?? 1;
      if (!grouped.has(round)) grouped.set(round, []);
      grouped.get(round)!.push(m);
    });
    const rounds = Array.from(grouped.entries())
      .sort(([a], [b]) => a - b)
      .map(([round, roundMatches]) => ({
        round,
        label: getUpperSemiRoundLabel(round, 'lower', matches),
        matches: [...roundMatches].sort((a, b) => {
          const posA = getBracketPosition(a.groupLabel);
          const posB = getBracketPosition(b.groupLabel);
          if (posA && posB) return posA - posB;
          return (a.matchNumber ?? 0) - (b.matchNumber ?? 0);
        }),
      }));
    return fillByePlaceholders(rounds, 'L');
  }, [lowerMatches, matches]);

  const hasUpper = upperRounds.length > 0;
  const hasLower = lowerRounds.length > 0;
  const hasGF = gfMatches.length > 0;

  // Division accent colors
  const divisionColor = dt.color;
  const lowerColor = '#f97316'; // Orange for lower bracket
  const gfColor = 'rgba(239,249,35,0.7)'; // Gold for grand final

  /* ─── Unified connector calculation for UB + LB + GF ─── */
  const calculateConnectors = useCallback(() => {
    if (!containerRef.current) {
      setConnectors([]);
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const newConnectors: ConnectorPath[] = [];

    // Helper to get card position
    const getCardPos = (key: string) => {
      const el = cardRefs.current.get(key);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        x: rect.left - containerRect.left,
        right: rect.right - containerRect.left,
        y: rect.top + rect.height / 2 - containerRect.top,
        width: rect.width,
        height: rect.height,
      };
    };

    // ── Within-bracket connectors (same algorithm as single elimination) ──
    const calculateBracketConnectors = (
      rounds: { round: number; label: string; matches: Match[] }[],
      prefix: string,
      strokeColor: string,
    ) => {
      if (rounds.length < 2) return;

      // Build position lookup for each round
      const positionLookupByRound: Map<number, Map<number, Match>> = new Map();
      for (let r = 0; r < rounds.length; r++) {
        const lookup = new Map<number, Match>();
        for (const m of rounds[r].matches) {
          const pos = getBracketPosition(m.groupLabel);
          if (pos > 0) lookup.set(pos, m);
        }
        positionLookupByRound.set(r, lookup);
      }

      for (let r = 0; r < rounds.length - 1; r++) {
        const sourceRound = rounds[r];
        const targetRoundIdx = r + 1;
        const targetPositionLookup = positionLookupByRound.get(targetRoundIdx) || new Map();

        const targetGroups = new Map<string, { sources: Match[]; target: Match }>();
        const hasPositions = sourceRound.matches.some(m => getBracketPosition(m.groupLabel) > 0);

        if (hasPositions) {
          for (const sourceMatch of sourceRound.matches) {
            const sourcePos = getBracketPosition(sourceMatch.groupLabel);
            if (sourcePos <= 0) continue;
            if (isByePlaceholder(sourceMatch)) continue;
            const targetPos = Math.ceil(sourcePos / 2);
            const targetMatch = targetPositionLookup.get(targetPos);
            if (!targetMatch) continue;

            const targetKey = targetMatch.id;
            if (!targetGroups.has(targetKey)) {
              targetGroups.set(targetKey, { sources: [], target: targetMatch });
            }
            targetGroups.get(targetKey)!.sources.push(sourceMatch);
          }
        } else {
          const targetRound = rounds[targetRoundIdx];
          for (let ni = 0; ni < targetRound.matches.length; ni++) {
            const targetMatch = targetRound.matches[ni];
            const source1 = sourceRound.matches[ni * 2] || null;
            const source2 = sourceRound.matches[ni * 2 + 1] || null;
            const sources = [source1, source2].filter(Boolean).filter(s => !isByePlaceholder(s)) as Match[];
            if (sources.length === 0) continue;
            targetGroups.set(targetMatch.id, { sources, target: targetMatch });
          }
        }

        for (const [targetKey, group] of targetGroups) {
          const { sources, target: targetMatch } = group;
          if (!targetMatch || sources.length === 0) continue;

          const targetPos = getCardPos(`${prefix}-round-${targetRoundIdx}-match-${targetMatch.id}`);
          if (!targetPos) continue;

          const sourcePoints = sources.map(s => {
            const p = getCardPos(`${prefix}-round-${r}-match-${s.id}`);
            if (!p) return null;
            return { ...p, match: s };
          }).filter(Boolean) as { x: number; right: number; y: number; width: number; height: number; match: Match }[];

          if (sourcePoints.length === 0) continue;

          const maxSourceX = Math.max(...sourcePoints.map(p => p.right));
          const targetX = targetPos.x;
          const midX = (maxSourceX + targetX) / 2;
          const targetY = targetPos.y;

          if (sourcePoints.length === 1) {
            const p = sourcePoints[0];
            newConnectors.push({
              key: `${prefix}-conn-${r}-${targetKey}-arm1`,
              d: `M ${p.right} ${p.y} H ${midX} V ${targetY}`,
              color: strokeColor,
              isWinner: matchHasWinner(p.match),
            });
          } else {
            for (let i = 0; i < sourcePoints.length; i++) {
              const p = sourcePoints[i];
              newConnectors.push({
                key: `${prefix}-conn-${r}-${targetKey}-arm${i}`,
                d: `M ${p.right} ${p.y} H ${midX}`,
                color: strokeColor,
                isWinner: matchHasWinner(p.match),
              });
            }
            const topY = Math.min(...sourcePoints.map(p => p.y));
            const bottomY = Math.max(...sourcePoints.map(p => p.y));
            newConnectors.push({
              key: `${prefix}-conn-${r}-${targetKey}-rail`,
              d: `M ${midX} ${topY} V ${bottomY}`,
              color: strokeColor,
              isWinner: sourcePoints.some(p => matchHasWinner(p.match)),
            });
          }

          newConnectors.push({
            key: `${prefix}-conn-${r}-${targetKey}-bridge`,
            d: `M ${midX} ${targetY} H ${targetX}`,
            color: strokeColor,
            isWinner: sourcePoints.some(p => matchHasWinner(p.match)),
          });
          newConnectors.push({
            key: `${prefix}-conn-${r}-${targetKey}-dot`,
            d: `M ${midX - 3} ${targetY} h 6`,
            color: strokeColor,
            isWinner: true,
          });
        }
      }
    };

    // Calculate UB connectors
    if (hasUpper) calculateBracketConnectors(upperRounds, 'ub', divisionColor);

    // Calculate LB connectors
    if (hasLower) calculateBracketConnectors(lowerRounds, 'lb', lowerColor);

    // ── Cross-bracket connectors: UB Final → GF ──
    if (hasUpper && hasGF && upperRounds.length > 0) {
      const ubFinalRound = upperRounds[upperRounds.length - 1];
      const ubFinalMatch = ubFinalRound.matches.find(m => !isByePlaceholder(m));
      if (ubFinalMatch) {
        const sourcePos = getCardPos(`ub-round-${upperRounds.length - 1}-match-${ubFinalMatch.id}`);
        const gfMatch = gfMatches[0];
        const targetPos = getCardPos(`gf-match-${gfMatch.id}`);

        if (sourcePos && targetPos) {
          const midX = (sourcePos.right + targetPos.x) / 2;
          newConnectors.push({
            key: 'ub-gf-conn',
            d: `M ${sourcePos.right} ${sourcePos.y} H ${midX} V ${targetPos.y} H ${targetPos.x}`,
            color: gfColor,
            isWinner: matchHasWinner(ubFinalMatch),
          });
          newConnectors.push({
            key: 'ub-gf-dot',
            d: `M ${midX - 3} ${targetPos.y} h 6`,
            color: gfColor,
            isWinner: true,
          });
        }
      }
    }

    // ── Cross-bracket connectors: LB Final → GF ──
    if (hasLower && hasGF && lowerRounds.length > 0) {
      const lbFinalRound = lowerRounds[lowerRounds.length - 1];
      const lbFinalMatch = lbFinalRound.matches.find(m => !isByePlaceholder(m));
      if (lbFinalMatch) {
        const sourcePos = getCardPos(`lb-round-${lowerRounds.length - 1}-match-${lbFinalMatch.id}`);
        const gfMatch = gfMatches[0];
        const targetPos = getCardPos(`gf-match-${gfMatch.id}`);

        if (sourcePos && targetPos) {
          const midX = (sourcePos.right + targetPos.x) / 2;
          newConnectors.push({
            key: 'lb-gf-conn',
            d: `M ${sourcePos.right} ${sourcePos.y} H ${midX} V ${targetPos.y} H ${targetPos.x}`,
            color: gfColor,
            isWinner: matchHasWinner(lbFinalMatch),
          });
          newConnectors.push({
            key: 'lb-gf-dot',
            d: `M ${midX - 3} ${sourcePos.y} h 6`,
            color: gfColor,
            isWinner: true,
          });
        }
      }
    }

    setConnectors(newConnectors);
  }, [upperRounds, lowerRounds, gfMatches, divisionColor, hasUpper, hasLower, hasGF]);

  /* ─── Card alignment for UB and LB ─── */
  const alignBracketCards = useCallback(() => {
    if (!containerRef.current) return;

    const alignBracket = (
      rounds: { round: number; label: string; matches: Match[] }[],
      prefix: string,
    ) => {
      if (rounds.length < 2) return;

      const r0HasPositions = rounds[0].matches.some(m => getBracketPosition(m.groupLabel) > 0);
      if (!r0HasPositions) {
        for (let r = 1; r < rounds.length; r++) {
          const gapMultiplier = Math.pow(2, r);
          const roundCols = containerRef.current!.querySelectorAll(`[data-round="${prefix}-${r}"]`);
          roundCols.forEach((col) => {
            const cards = col.children;
            for (let i = 0; i < cards.length; i++) {
              const card = cards[i] as HTMLElement;
              if (i === 0) {
                card.style.marginTop = `${(gapMultiplier - 1) * 20}px`;
              } else {
                card.style.marginTop = `${gapMultiplier * 24 + 16}px`;
              }
            }
          });
        }
        return;
      }

      for (let r = 1; r < rounds.length; r++) {
        const currentRound = rounds[r];
        const prevRound = rounds[r - 1];

        const prevPosMap = new Map<number, HTMLDivElement>();
        for (const pm of prevRound.matches) {
          const pos = getBracketPosition(pm.groupLabel);
          const el = cardRefs.current.get(`${prefix}-round-${r - 1}-match-${pm.id}`);
          if (pos > 0 && el) prevPosMap.set(pos, el);
        }

        for (const m of currentRound.matches) {
          const bracketPos = getBracketPosition(m.groupLabel);
          const el = cardRefs.current.get(`${prefix}-round-${r}-match-${m.id}`);
          if (!el || bracketPos <= 0) continue;

          const feederPos1 = bracketPos * 2 - 1;
          const feederPos2 = bracketPos * 2;
          const feederEl1 = prevPosMap.get(feederPos1);
          const feederEl2 = prevPosMap.get(feederPos2);
          const currentMarginTop = parseFloat(el.style.marginTop) || 0;

          if (feederEl1 && feederEl2) {
            const f1Rect = feederEl1.getBoundingClientRect();
            const f2Rect = feederEl2.getBoundingClientRect();
            const cardRect = el.getBoundingClientRect();
            const cRect = containerRef.current!.getBoundingClientRect();
            const targetCenterY = (f1Rect.top + f1Rect.height / 2 - cRect.top + f2Rect.top + f2Rect.height / 2 - cRect.top) / 2;
            const currentCenterY = cardRect.top + cardRect.height / 2 - cRect.top;
            el.style.marginTop = `${targetCenterY - (currentCenterY - currentMarginTop)}px`;
          } else if (feederEl1 || feederEl2) {
            const feederEl = feederEl1 || feederEl2!;
            const fRect = feederEl.getBoundingClientRect();
            const cardRect = el.getBoundingClientRect();
            const cRect = containerRef.current!.getBoundingClientRect();
            const fCenterY = fRect.top + fRect.height / 2 - cRect.top;
            const currentCenterY = cardRect.top + cardRect.height / 2 - cRect.top;
            el.style.marginTop = `${fCenterY - (currentCenterY - currentMarginTop)}px`;
          }
        }
      }
    };

    if (hasUpper) alignBracket(upperRounds, 'ub');
    if (hasLower) alignBracket(lowerRounds, 'lb');
  }, [upperRounds, lowerRounds, hasUpper, hasLower]);

  // Timing effects for alignment and connector calculation
  useEffect(() => {
    const timers = [100, 300, 600, 1200].map(delay => setTimeout(alignBracketCards, delay));
    return () => timers.forEach(clearTimeout);
  }, [alignBracketCards]);

  useEffect(() => {
    const attempts = [80, 150, 350, 700, 1300];
    const timers = attempts.map(delay => setTimeout(calculateConnectors, delay));
    const handleResize = () => { alignBracketCards(); setTimeout(calculateConnectors, 50); };
    const scrollContainer = containerRef.current?.parentElement;
    const handleScroll = () => calculateConnectors();
    window.addEventListener('resize', handleResize);
    scrollContainer?.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('resize', handleResize);
      scrollContainer?.removeEventListener('scroll', handleScroll);
    };
  }, [calculateConnectors, alignBracketCards]);

  const setCardRef = useCallback((key: string, el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(key, el);
    else cardRefs.current.delete(key);
  }, []);

  // ── Empty state ──
  if (!hasUpper && !hasLower && !hasGF) {
    return (
      <div className="p-8 text-center">
        <Swords className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-muted-foreground mb-0.5">Belum Ada Bracket</h3>
        <p className="text-xs text-muted-foreground/60">Bracket akan muncul setelah pertandingan dimulai</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-border/60">
      {/* Unified Section Header */}
      <div className={`flex items-center gap-2.5 px-4 py-2.5 border-b ${dt.borderSubtle} ${dt.bg}`}>
        <Swords className={`w-4 h-4 ${dt.neonText}`} />
        <h3 className={`text-sm font-bold uppercase tracking-wider ${dt.text}`}>Double Elimination</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {matches.length} pertandingan
        </span>
      </div>
      <div className="p-2">
        <ZoomableContainer>
          <div className="min-w-max pb-2 -mx-1">
            <div className="relative px-2" ref={containerRef}>
              {/* SVG connector overlay — covers entire unified bracket */}
              {connectors.length > 0 && <BracketConnectors paths={connectors} />}

              <div className="flex">
                {/* ── Left side: UB + LB stacked vertically ── */}
                <div className="flex flex-col gap-6">
                  {/* ── UPPER BRACKET ── */}
                  {hasUpper && (
                    <div>
                      <div className="text-center mb-3">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${dt.bg} ${dt.text} text-xs font-bold uppercase tracking-wider border ${dt.borderSubtle}`}>
                          <Swords className="w-3 h-3 opacity-60" />
                          Upper Bracket
                        </div>
                      </div>
                      <div className="flex gap-12">
                        {upperRounds.map((round, roundIdx) => (
                          <div key={`ub-${round.round}`} className="flex flex-col" style={{ minWidth: '200px' }}>
                            <div className="text-center mb-4">
                              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${dt.bg} ${dt.text} text-xs font-bold uppercase tracking-wider border ${dt.borderSubtle}`}>
                                <Swords className="w-3 h-3 opacity-60" />
                                {round.label}
                              </div>
                            </div>
                            <div
                              className="flex-1 flex flex-col"
                              data-round={`ub-${roundIdx}`}
                              style={{ gap: roundIdx === 0 ? '20px' : '0px' }}
                            >
                              {round.matches.map((m, mi) => (
                                <div
                                  key={m.id}
                                  ref={(el) => setCardRef(`ub-round-${roundIdx}-match-${m.id}`, el)}
                                >
                                  <BracketMatchCard
                                    match={m}
                                    matchLabel={`U${mi + 1}`}
                                    mode={mode}
                                    adminProps={adminProps}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Drop indicator: UB → LB ── */}
                  {hasUpper && hasLower && (
                    <div className="flex items-center justify-center gap-3 py-1">
                      <div className="flex-1 flex items-center justify-end">
                        <span className="text-[10px] font-bold text-red-400/80 uppercase tracking-wider">Yang kalah</span>
                        <div className="h-px w-8 bg-red-400/25" />
                      </div>
                      <svg width="24" height="28" viewBox="0 0 24 28" fill="none" className="opacity-70">
                        <path d="M12 2 L12 18" stroke="#f87171" strokeWidth="2" strokeLinecap="round" />
                        <path d="M6 14 L12 22 L18 14" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        <path d="M12 2 L12 18" stroke="#f87171" strokeWidth="6" strokeLinecap="round" opacity="0.15" />
                      </svg>
                      <div className="flex-1 flex items-center">
                        <div className="h-px w-8 bg-red-400/25" />
                        <span className="text-[10px] font-bold text-red-400/80 uppercase tracking-wider">turun ke Lower Bracket</span>
                      </div>
                    </div>
                  )}

                  {/* ── LOWER BRACKET ── */}
                  {hasLower && (
                    <div>
                      <div className="text-center mb-3">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/5 text-orange-400 text-xs font-bold uppercase tracking-wider border border-orange-500/20">
                          <Swords className="w-3 h-3 opacity-60" />
                          Lower Bracket
                        </div>
                      </div>
                      <div className="flex gap-12">
                        {lowerRounds.map((round, roundIdx) => (
                          <div key={`lb-${round.round}`} className="flex flex-col" style={{ minWidth: '200px' }}>
                            <div className="text-center mb-4">
                              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/5 text-orange-400 text-xs font-bold uppercase tracking-wider border border-orange-500/20">
                                <Swords className="w-3 h-3 opacity-60" />
                                {round.label}
                              </div>
                            </div>
                            <div
                              className="flex-1 flex flex-col"
                              data-round={`lb-${roundIdx}`}
                              style={{ gap: roundIdx === 0 ? '20px' : '0px' }}
                            >
                              {round.matches.map((m, mi) => (
                                <div
                                  key={m.id}
                                  ref={(el) => setCardRef(`lb-round-${roundIdx}-match-${m.id}`, el)}
                                >
                                  <BracketMatchCard
                                    match={m}
                                    matchLabel={`L${mi + 1}`}
                                    mode={mode}
                                    adminProps={adminProps}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Right side: Grand Final ── */}
                {hasGF && (
                  <div className="flex flex-col justify-center ml-12" style={{ minWidth: '220px' }}>
                    <div className="text-center mb-4">
                      <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-idm-gold-warm/20 via-idm-gold-warm/10 to-idm-gold-warm/20 text-idm-gold-warm text-sm font-black uppercase tracking-wider border border-idm-gold-warm/40 shadow-[0_0_24px_rgba(239,249,35,0.2)]">
                        <Trophy className="w-4 h-4" />
                        Grand Final
                      </div>
                    </div>
                    {gfMatches.map((m) => (
                      <div
                        key={m.id}
                        ref={(el) => setCardRef(`gf-match-${m.id}`, el)}
                      >
                        <BracketMatchCard match={m} isGrandFinal matchLabel="Grand Final" mode={mode} adminProps={adminProps} />
                      </div>
                    ))}
                    <div className="text-center mt-3">
                      <span className="text-[10px] text-idm-gold-warm/60 font-semibold">UB Winner vs LB Winner</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ZoomableContainer>
      </div>
    </div>
  );
}

/* ─── Main BracketView Component ─── */
export function BracketView({ matches, bracketType, mode = 'public', adminProps }: BracketViewProps) {
  const dt = useDivisionTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [connectors, setConnectors] = useState<ConnectorPath[]>([]);
  const [activeType, setActiveType] = useState(bracketType);

  /* Group matches by round — for single elimination, only use upper bracket matches */
  const roundsData = useMemo(() => {
    if (!matches || matches.length === 0) return [];

    // For single_elimination: only include matches from the 'upper' bracket
    // (exclude 'lower', 'grand_final' etc. which belong to double elimination)
    const filteredMatches = bracketType === 'single_elimination'
      ? matches.filter(m => m.bracket === 'upper' || !m.bracket)
      : matches;

    if (filteredMatches.length === 0) return [];

    const grouped = filteredMatches.reduce<Record<number, Match[]>>((acc, m) => {
      const round = m.round ?? 1;
      if (!acc[round]) acc[round] = [];
      acc[round].push(m);
      return acc;
    }, {});

    // If all matches are in a single round, auto-split into bracket rounds
    if (Object.keys(grouped).length === 1 && bracketType !== 'group_stage' && bracketType !== 'round_robin' && bracketType !== 'swiss') {
      const allMatches = Object.values(grouped)[0];
      const totalMatches = allMatches.length;

      const rounds: { round: number; label: string; matches: Match[] }[] = [];
      let remaining = [...allMatches];
      let roundNum = 1;
      let matchesInRound = Math.pow(2, Math.floor(Math.log2(totalMatches)));

      if (matchesInRound < totalMatches) {
        matchesInRound = totalMatches - matchesInRound / 2;
      }

      while (remaining.length > 0) {
        const roundMatches = remaining.splice(0, Math.max(1, matchesInRound));
        rounds.push({
          round: roundNum,
          label: getRoundLabel(roundNum - 1, Math.ceil(Math.log2(totalMatches + 1))),
          matches: roundMatches.map((m) => ({ ...m, round: roundNum })),
        });
        matchesInRound = Math.max(1, Math.floor(matchesInRound / 2));
        roundNum++;
      }

      return rounds;
    }

    const sortedRounds = Object.entries(grouped)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([, roundMatches], idx) => ({
        round: idx + 1,
        label: getRoundLabel(idx, Object.keys(grouped).length),
        matches: [...roundMatches].sort((a, b) => {
          // Sort by groupLabel position for proper bracket ordering
          const posA = getBracketPosition(a.groupLabel);
          const posB = getBracketPosition(b.groupLabel);
          if (posA && posB) return posA - posB;
          return (a.matchNumber ?? 0) - (b.matchNumber ?? 0);
        }),
      }));

    // Fill missing R1 positions with BYE placeholders for single elimination
    // This ensures proper vertical spacing and connector alignment when teams get byes
    if (bracketType === 'single_elimination') {
      return fillByePlaceholders(sortedRounds);
    }
    return sortedRounds;
  }, [matches, bracketType]);

  /* Calculate SVG connector paths after layout — SOURCE→TARGET approach
     Bracket connector pattern:
     [Source 1] ──────┐
                        ├────── [Target Match]
     [Source 2] ──────┘
     Segments: 1) Horizontal arms  2) Vertical rail  3) Horizontal bridge  4) Junction dot

     NEW APPROACH: Iterate from SOURCE matches (round R) to find their TARGET match (round R+1).
     For each match M in round R with position P:
       - Target position in round R+1 = ceil(P / 2)
     This guarantees every connector starts from an EXISTING match, avoiding the old bug
     where BYE positions (no match) caused wrong index-based fallback pairing.
  */
  const calculateConnectors = useCallback(() => {
    if (!containerRef.current || roundsData.length < 2) {
      setConnectors([]);
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const newConnectors: ConnectorPath[] = [];
    const strokeColor = dt.color;

    // Build position lookup for each round: position → match
    const positionLookupByRound: Map<number, Map<number, Match>> = new Map();
    for (let r = 0; r < roundsData.length; r++) {
      const lookup = new Map<number, Match>();
      for (const m of roundsData[r].matches) {
        const pos = getBracketPosition(m.groupLabel);
        if (pos > 0) lookup.set(pos, m);
      }
      positionLookupByRound.set(r, lookup);
    }

    for (let r = 0; r < roundsData.length - 1; r++) {
      const sourceRound = roundsData[r];
      const targetRoundIdx = r + 1;
      const targetPositionLookup = positionLookupByRound.get(targetRoundIdx) || new Map();

      // Group source matches by their target match ID
      const targetGroups = new Map<string, { sources: Match[]; target: Match }>();

      const hasPositions = sourceRound.matches.some(m => getBracketPosition(m.groupLabel) > 0);

      if (hasPositions) {
        // SOURCE→TARGET: For each source match, compute its target position
        for (const sourceMatch of sourceRound.matches) {
          const sourcePos = getBracketPosition(sourceMatch.groupLabel);
          if (sourcePos <= 0) continue; // Skip matches without position
          if (isByePlaceholder(sourceMatch)) continue; // Skip BYE placeholder connectors

          // Target position = ceil(sourcePos / 2)
          // Example: sourcePos=1→target=1, sourcePos=2→target=1, sourcePos=3→target=2
          const targetPos = Math.ceil(sourcePos / 2);
          const targetMatch = targetPositionLookup.get(targetPos);
          if (!targetMatch) continue;

          const targetKey = targetMatch.id;
          if (!targetGroups.has(targetKey)) {
            targetGroups.set(targetKey, { sources: [], target: targetMatch });
          }
          targetGroups.get(targetKey)!.sources.push(sourceMatch);
        }
      } else {
        // Fallback: simple index-based pairing for rounds without groupLabel positions
        const targetRound = roundsData[targetRoundIdx];
        for (let ni = 0; ni < targetRound.matches.length; ni++) {
          const targetMatch = targetRound.matches[ni];
          const source1 = sourceRound.matches[ni * 2] || null;
          const source2 = sourceRound.matches[ni * 2 + 1] || null;
          const sources = [source1, source2].filter(Boolean) as Match[];
          if (sources.length === 0) continue;
          targetGroups.set(targetMatch.id, { sources, target: targetMatch });
        }
      }

      // Draw connectors for each target group
      for (const [targetKey, group] of targetGroups) {
        const { sources, target: targetMatch } = group;
        if (!targetMatch || sources.length === 0) continue;

        const targetCardEl = cardRefs.current.get(`round-${targetRoundIdx}-match-${targetMatch.id}`);
        if (!targetCardEl) continue;

        const targetRect = targetCardEl.getBoundingClientRect();
        const targetY = targetRect.top + targetRect.height / 2 - containerRect.top;
        const targetX = targetRect.left - containerRect.left;

        // Get source card positions
        const sourcePoints = sources.map(s => {
          const el = cardRefs.current.get(`round-${r}-match-${s.id}`);
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          return {
            x: rect.right - containerRect.left,
            y: rect.top + rect.height / 2 - containerRect.top,
            match: s,
          };
        }).filter(Boolean) as { x: number; y: number; match: Match }[];

        if (sourcePoints.length === 0) continue;

        // Midpoint X between sources and target (vertical rail position)
        const maxSourceX = Math.max(...sourcePoints.map(p => p.x));
        const midX = (maxSourceX + targetX) / 2;

        if (sourcePoints.length === 1) {
          // Single source — L-shaped connector
          const p = sourcePoints[0];
          newConnectors.push({
            key: `conn-${r}-${targetKey}-arm1`,
            d: `M ${p.x} ${p.y} H ${midX} V ${targetY}`,
            color: strokeColor,
            isWinner: matchHasWinner(p.match),
          });
        } else {
          // Multiple sources — bracket connector with arms + rail
          // Horizontal arms
          for (let i = 0; i < sourcePoints.length; i++) {
            const p = sourcePoints[i];
            newConnectors.push({
              key: `conn-${r}-${targetKey}-arm${i}`,
              d: `M ${p.x} ${p.y} H ${midX}`,
              color: strokeColor,
              isWinner: matchHasWinner(p.match),
            });
          }

          // Vertical rail
          const topY = Math.min(...sourcePoints.map(p => p.y));
          const bottomY = Math.max(...sourcePoints.map(p => p.y));
          newConnectors.push({
            key: `conn-${r}-${targetKey}-rail`,
            d: `M ${midX} ${topY} V ${bottomY}`,
            color: strokeColor,
            isWinner: sourcePoints.some(p => matchHasWinner(p.match)),
          });
        }

        // Bridge from midpoint at targetY to target
        newConnectors.push({
          key: `conn-${r}-${targetKey}-bridge`,
          d: `M ${midX} ${targetY} H ${targetX}`,
          color: strokeColor,
          isWinner: sourcePoints.some(p => matchHasWinner(p.match)),
        });

        // Junction dot at merge point
        newConnectors.push({
          key: `conn-${r}-${targetKey}-dot`,
          d: `M ${midX - 3} ${targetY} h 6`,
          color: strokeColor,
          isWinner: true,
        });
      }
    }

    setConnectors(newConnectors);
  }, [roundsData, dt.color]);

  useEffect(() => {
    // Multiple attempts to recalculate after layout settles
    // Alignment runs at 100, 300, 600, 1200ms — connectors must run AFTER alignment
    const attempts = [80, 150, 350, 700, 1300];
    const timers = attempts.map(delay => setTimeout(calculateConnectors, delay));
    const handleResize = () => { alignBracketCards(); setTimeout(calculateConnectors, 50); };

    // Also recalculate when the scrollable container is scrolled
    // (cards shift position relative to viewport, need to update SVG)
    const scrollContainer = containerRef.current?.parentElement;
    const handleScroll = () => calculateConnectors();

    window.addEventListener('resize', handleResize);
    scrollContainer?.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('resize', handleResize);
      scrollContainer?.removeEventListener('scroll', handleScroll);
    };
  }, [calculateConnectors]);

  /* Set card ref helper */
  const setCardRef = useCallback((key: string, el: HTMLDivElement | null) => {
    if (el) {
      cardRefs.current.set(key, el);
    } else {
      cardRefs.current.delete(key);
    }
  }, []);

  /* ─── Bracket card alignment — position R2+ cards at vertical midpoint of feeders ─── */
  // This must be declared BEFORE any early returns (React hooks rule)
  const alignBracketCards = useCallback(() => {
    if (!containerRef.current || roundsData.length < 2) return;

    // Only align if we have groupLabel positions
    const r0HasPositions = roundsData[0].matches.some(m => getBracketPosition(m.groupLabel) > 0);
    if (!r0HasPositions) {
      // Fallback: use exponential gap for rounds without positions
      for (let r = 1; r < roundsData.length; r++) {
        const gapMultiplier = Math.pow(2, r);
        const roundCols = containerRef.current.querySelectorAll(`[data-round="${r}"]`);
        roundCols.forEach((col) => {
          const cards = col.children;
          for (let i = 0; i < cards.length; i++) {
            const card = cards[i] as HTMLElement;
            if (i === 0) {
              card.style.marginTop = `${(gapMultiplier - 1) * 20}px`;
            } else {
              card.style.marginTop = `${gapMultiplier * 24 + 16}px`;
            }
          }
        });
      }
      return;
    }

    // Build a map of card elements by round + match ID
    const cardElMap = new Map<string, HTMLDivElement>();
    for (const [key, el] of cardRefs.current.entries()) {
      cardElMap.set(key, el);
    }

    // For each round starting from R2, position cards at midpoint of their feeders
    for (let r = 1; r < roundsData.length; r++) {
      const currentRound = roundsData[r];
      const prevRound = roundsData[r - 1];

      // Build position lookup for previous round
      const prevPosMap = new Map<number, HTMLDivElement>();
      for (const pm of prevRound.matches) {
        const pos = getBracketPosition(pm.groupLabel);
        const el = cardElMap.get(`round-${r - 1}-match-${pm.id}`);
        if (pos > 0 && el) prevPosMap.set(pos, el);
      }

      for (let mi = 0; mi < currentRound.matches.length; mi++) {
        const m = currentRound.matches[mi];
        const bracketPos = getBracketPosition(m.groupLabel);
        const el = cardElMap.get(`round-${r}-match-${m.id}`);
        if (!el || bracketPos <= 0) continue;

        // Find feeder elements
        const feederPos1 = bracketPos * 2 - 1;
        const feederPos2 = bracketPos * 2;
        const feederEl1 = prevPosMap.get(feederPos1);
        const feederEl2 = prevPosMap.get(feederPos2);

        // Calculate offset accounting for previously applied marginTop.
        // This prevents the oscillation bug where successive alignment runs
        // alternate between correct and zero margins because getBoundingClientRect()
        // includes the current margin but offset = target - current doesn't account for it.
        // Fix: naturalCenterY = currentCenterY - currentMarginTop
        //      offset = targetCenterY - naturalCenterY
        const currentMarginTop = parseFloat(el.style.marginTop) || 0;

        if (feederEl1 && feederEl2) {
          // Both feeders exist — position this card at their vertical midpoint
          const f1Rect = feederEl1.getBoundingClientRect();
          const f2Rect = feederEl2.getBoundingClientRect();
          const cardRect = el.getBoundingClientRect();
          const containerRect = containerRef.current.getBoundingClientRect();

          const f1CenterY = f1Rect.top + f1Rect.height / 2 - containerRect.top;
          const f2CenterY = f2Rect.top + f2Rect.height / 2 - containerRect.top;
          const targetCenterY = (f1CenterY + f2CenterY) / 2;
          const currentCenterY = cardRect.top + cardRect.height / 2 - containerRect.top;

          // Offset relative to natural position (without margin)
          const naturalCenterY = currentCenterY - currentMarginTop;
          const offset = targetCenterY - naturalCenterY;
          el.style.marginTop = `${offset}px`;
        } else if (feederEl1 || feederEl2) {
          // Single feeder (BYE) — align with that feeder
          const feederEl = feederEl1 || feederEl2!;
          const fRect = feederEl.getBoundingClientRect();
          const cardRect = el.getBoundingClientRect();
          const containerRect = containerRef.current.getBoundingClientRect();

          const fCenterY = fRect.top + fRect.height / 2 - containerRect.top;
          const currentCenterY = cardRect.top + cardRect.height / 2 - containerRect.top;

          // Offset relative to natural position (without margin)
          const naturalCenterY = currentCenterY - currentMarginTop;
          const offset = fCenterY - naturalCenterY;
          el.style.marginTop = `${offset}px`;
        }
      }
    }
  }, [roundsData]);

  // Run alignment after layout
  useEffect(() => {
    const timers = [100, 300, 600, 1200].map(delay => setTimeout(alignBracketCards, delay));
    return () => timers.forEach(clearTimeout);
  }, [alignBracketCards]);

  /* ─── Render: Upper Semi (Double Elimination) ─── */
  if (bracketType === 'upper_semi') {
    return <UpperSemiView matches={matches} mode={mode} adminProps={adminProps} />;
  }

  /* ─── Render: Group Stage ─── */
  if (bracketType === 'group_stage') {
    return (
      <div>
        <GroupStageView matches={matches} roundsData={roundsData} mode={mode} adminProps={adminProps} />
      </div>
    );
  }

  /* ─── Render: Round Robin ─── */
  if (bracketType === 'round_robin') {
    return (
      <div className="space-y-5">
        <GroupStageView matches={matches} roundsData={roundsData} mode={mode} adminProps={adminProps} />
      </div>
    );
  }

  /* ─── Render: Swiss ─── */
  if (bracketType === 'swiss') {
    return (
      <div>
        <SwissView matches={matches} roundsData={roundsData} mode={mode} adminProps={adminProps} />
      </div>
    );
  }

  /* ─── Bracket content (shared for single/double elimination) ─── */
  const isFinalRound = (roundIdx: number) => roundIdx === roundsData.length - 1;

  const bracketContent = (
    <div className="min-w-max pb-2 -mx-1">
      <div className="relative min-w-max px-2" ref={containerRef}>
        {/* SVG connector overlay */}
        {connectors.length > 0 && <BracketConnectors paths={connectors} />}

        {/* Bracket columns — MPL horizontal layout */}
        <div className="flex gap-12">
          {roundsData.map((round, roundIdx) => {
            const isGF = isFinalRound(roundIdx);
            return (
              <div key={round.round} className="flex flex-col" style={{ minWidth: isGF ? '220px' : '200px' }}>
                {/* Round label — MPL premium header */}
                <div className={`text-center mb-4 ${isGF ? 'mt-2' : ''}`}>
                  {isGF ? (
                    <div className="inline-flex flex-col items-center gap-1">
                      {/* Grand Final special header with gold glow */}
                      <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-idm-gold-warm/20 via-idm-gold-warm/10 to-idm-gold-warm/20 text-idm-gold-warm text-sm font-black uppercase tracking-wider border border-idm-gold-warm/40 shadow-[0_0_24px_rgba(239,249,35,0.2)]">
                        <Trophy className="w-4 h-4" />
                        {round.label}
                      </div>
                    </div>
                  ) : (
                    /* Regular round header — MPL gradient pill */
                    <div className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl ${dt.bg} ${dt.text} text-sm font-bold uppercase tracking-wider border ${dt.borderSubtle}`}>
                      <Swords className="w-3.5 h-3.5 opacity-60" />
                      {round.label}
                    </div>
                  )}
                </div>
                {/* Match cards container */}
                <div
                  className="flex-1 flex flex-col"
                  data-round={roundIdx}
                  style={{ gap: roundIdx === 0 ? '20px' : '0px' }}
                >
                  {round.matches.map((m, mi) => (
                    <div
                      key={m.id}
                      ref={(el) => setCardRef(`round-${roundIdx}-match-${m.id}`, el)}
                    >
                      <BracketMatchCard 
                        match={m} 
                        isGrandFinal={isGF}
                        matchLabel={roundIdx === roundsData.length - 1 && isGF ? 'Grand Final' : `M${mi + 1}`}
                        mode={mode}
                        adminProps={adminProps}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  /* ─── Render: Single/Double Elimination Bracket with Zoom ─── */
  return (
    <div>
      <ZoomableContainer>
        {bracketContent}
      </ZoomableContainer>

      {/* Double Elimination: Elimination Bracket — removed, DE not supported */}
    </div>
  );
}
