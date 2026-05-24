// @ts-nocheck
'use client';

import { cn, parseWitaDate, formatWIBTime } from '@/lib/utils';
import Image from 'next/image';
import { MatchStatus, BracketType } from '@prisma/client';
import { Trophy, Users, Clock, ChevronRight, Crown } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  logo?: string | null;
  tag?: string | null;
  color?: string | null;
}

interface Match {
  id: string;
  round: number;
  matchNumber: number;
  status: MatchStatus;
  homeScore: number;
  awayScore: number;
  scheduledAt?: Date | null;
  homeTeam?: Team | null;
  awayTeam?: Team | null;
  winner?: Team | null;
  bracketRound?: string | null;
}

interface BracketProps {
  matches: Match[];
  bracketType: BracketType;
  totalRounds: number;
  onMatchClick?: (match: Match) => void;
}

export function TournamentBracket({ matches, bracketType, totalRounds, onMatchClick }: BracketProps) {
  // Group matches by round
  const matchesByRound: Record<number, Match[]> = {};
  matches.forEach((match) => {
    if (!matchesByRound[match.round]) {
      matchesByRound[match.round] = [];
    }
    matchesByRound[match.round].push(match);
  });

  const getRoundName = (round: number): string => {
    const remaining = totalRounds - round + 1;
    switch (remaining) {
      case 1:
        return 'Grand Final';
      case 2:
        return 'Semi Final';
      case 3:
        return 'Quarter Final';
      default:
        return `Round ${round}`;
    }
  };

  const getBracketLabel = (bracketRound?: string | null): string => {
    switch (bracketRound) {
      case 'UPPER':
        return 'Upper Bracket';
      case 'LOWER':
        return 'Lower Bracket';
      case 'GRAND_FINAL':
        return 'Grand Final';
      default:
        return '';
    }
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-max p-6">
        {/* Bracket Type Header */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <Trophy className="w-6 h-6 text-cyan-400" />
          <h2 className="text-xl font-bold text-foreground">
            {bracketType.replace(/_/g, ' ')}
            {bracketType === BracketType.DOUBLE_ELIMINATION && matches[0]?.bracketRound && (
              <span className="text-cyan-400 ml-2">
                - {getBracketLabel(matches[0].bracketRound)}
              </span>
            )}
          </h2>
        </div>

        {/* Bracket Grid */}
        <div className="flex gap-8 items-start">
          {Array.from({ length: totalRounds }, (_, i) => i + 1).map((round) => (
            <div key={round} className="flex flex-col gap-4">
              {/* Round Header */}
              <div className="text-center mb-4">
                <span className="px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-border text-cyan-400 text-sm font-semibold">
                  {getRoundName(round)}
                </span>
              </div>

              {/* Matches in this round */}
              <div
                className="flex flex-col gap-4"
                style={{
                  marginTop: `${Math.pow(2, round - 1) * 40}px`,
                  gap: `${Math.pow(2, round) * 40}px`
                }}
              >
                {matchesByRound[round]?.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    onClick={() => onMatchClick?.(match)}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Winner Display */}
          <div className="flex flex-col items-center justify-center min-w-[200px]">
            <div className="text-center mb-4">
              <span className="px-4 py-2 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 text-yellow-400 text-sm font-semibold flex items-center gap-2">
                <Crown className="w-4 h-4" />
                Champion
              </span>
            </div>
            <div className="w-48 h-24 rounded-2xl bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-2 border-border flex items-center justify-center">
              {matches.find(m => m.round === totalRounds && m.status === MatchStatus.COMPLETED)?.winner ? (
                <div className="text-center">
                  <Crown className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                  <span className="text-foreground font-bold">
                    {matches.find(m => m.round === totalRounds && m.status === MatchStatus.COMPLETED)?.winner?.name}
                  </span>
                </div>
              ) : (
                <span className="text-muted-foreground text-sm">TBD</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MatchCardProps {
  match: Match;
  onClick?: () => void;
}

function MatchCard({ match, onClick }: MatchCardProps) {
  const isLive = match.status === MatchStatus.LIVE;
  const isCompleted = match.status === MatchStatus.COMPLETED;
  const isBye = match.status === MatchStatus.BYE;

  const homeWinner = isCompleted && match.winner?.id === match.homeTeam?.id;
  const awayWinner = isCompleted && match.winner?.id === match.awayTeam?.id;

  return (
    <div
      onClick={onClick}
      className={cn(
        "w-48 rounded-2xl border overflow-hidden transition-all duration-300 cursor-pointer",
        isLive && "border-green-500 shadow-lg shadow-green-500/20 animate-pulse",
        isCompleted && "border-border",
        !isLive && !isCompleted && "border-border hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10",
        isBye && "opacity-50"
      )}
    >
      {/* Match Header */}
      <div className={cn(
        "px-3 py-1.5 text-xs font-medium flex items-center justify-between",
        isLive && "bg-green-500/20 text-green-400",
        isCompleted && "bg-muted text-muted-foreground",
        !isLive && !isCompleted && "bg-muted/50 text-muted-foreground"
      )}>
        <span>Match {match.matchNumber}</span>
        {isLive && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            LIVE
          </span>
        )}
        {match.scheduledAt && !isLive && !isCompleted && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {parseWitaDate(match.scheduledAt) ? formatWIBTime(parseWitaDate(match.scheduledAt)!) : ''}
          </span>
        )}
      </div>

      {/* Teams */}
      <div className="bg-card">
        {/* Home Team */}
        <div
          className={cn(
            "flex items-center justify-between p-3 border-b border-border",
            homeWinner && "bg-cyan-500/10"
          )}
        >
          <div className="flex items-center gap-2">
            {match.homeTeam?.logo ? (
              <Image src={match.homeTeam.logo} alt="" width={24} height={24} className="w-6 h-6 rounded" unoptimized />
            ) : (
              <div
                className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: match.homeTeam?.color || '#374151' }}
              >
                {match.homeTeam?.tag || match.homeTeam?.name?.charAt(0) || '?'}
              </div>
            )}
            <span className={cn(
              "text-sm font-medium truncate max-w-[80px]",
              homeWinner ? "text-cyan-400" : "text-foreground"
            )}>
              {match.homeTeam?.name || 'TBD'}
            </span>
            {homeWinner && <ChevronRight className="w-4 h-4 text-cyan-400" />}
          </div>
          <span className={cn(
            "text-sm font-bold",
            homeWinner ? "text-cyan-400" : "text-muted-foreground"
          )}>
            {match.homeScore || 0}
          </span>
        </div>

        {/* Away Team */}
        <div
          className={cn(
            "flex items-center justify-between p-3",
            awayWinner && "bg-cyan-500/10"
          )}
        >
          <div className="flex items-center gap-2">
            {match.awayTeam?.logo ? (
              <Image src={match.awayTeam.logo} alt="" width={24} height={24} className="w-6 h-6 rounded" unoptimized />
            ) : (
              <div
                className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: match.awayTeam?.color || '#374151' }}
              >
                {match.awayTeam?.tag || match.awayTeam?.name?.charAt(0) || '?'}
              </div>
            )}
            <span className={cn(
              "text-sm font-medium truncate max-w-[80px]",
              awayWinner ? "text-cyan-400" : "text-foreground"
            )}>
              {match.awayTeam?.name || 'TBD'}
            </span>
            {awayWinner && <ChevronRight className="w-4 h-4 text-cyan-400" />}
          </div>
          <span className={cn(
            "text-sm font-bold",
            awayWinner ? "text-cyan-400" : "text-muted-foreground"
          )}>
            {match.awayScore || 0}
          </span>
        </div>
      </div>
    </div>
  );
}

// Group Stage Table Component
interface GroupMember {
  team: { id: string; name: string; logo?: string | null };
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
}

interface GroupStageTableProps {
  groupName: string;
  members: GroupMember[];
}

export function GroupStageTable({ groupName, members }: GroupStageTableProps) {
  return (
    <div className="rounded-2xl border border-border overflow-hidden">
      <div className="px-4 py-3 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border-b border-border">
        <h3 className="text-foreground font-semibold">{groupName}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-muted-foreground">
              <th className="px-4 py-2 text-left">#</th>
              <th className="px-4 py-2 text-left">Team</th>
              <th className="px-4 py-2 text-center">P</th>
              <th className="px-4 py-2 text-center">W</th>
              <th className="px-4 py-2 text-center">D</th>
              <th className="px-4 py-2 text-center">L</th>
              <th className="px-4 py-2 text-center">GF</th>
              <th className="px-4 py-2 text-center">GA</th>
              <th className="px-4 py-2 text-center">GD</th>
              <th className="px-4 py-2 text-center">Pts</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member, index) => (
              <tr
                key={member.team.id}
                className={cn(
                  "border-t border-border",
                  index < 2 && "bg-cyan-500/5"
                )}
              >
                <td className="px-4 py-3 text-muted-foreground">{index + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {member.team.logo ? (
                      <Image src={member.team.logo} alt="" width={20} height={20} className="w-5 h-5 rounded" unoptimized />
                    ) : (
                      <div className="w-5 h-5 rounded bg-muted" />
                    )}
                    <span className="text-foreground font-medium">{member.team.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center text-muted-foreground">{member.played}</td>
                <td className="px-4 py-3 text-center text-green-400">{member.won}</td>
                <td className="px-4 py-3 text-center text-yellow-400">{member.drawn}</td>
                <td className="px-4 py-3 text-center text-red-400">{member.lost}</td>
                <td className="px-4 py-3 text-center text-muted-foreground">{member.goalsFor}</td>
                <td className="px-4 py-3 text-center text-muted-foreground">{member.goalsAgainst}</td>
                <td className="px-4 py-3 text-center text-muted-foreground">
                  {member.goalsFor - member.goalsAgainst}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="px-2 py-1 rounded bg-cyan-500/20 text-cyan-400 font-bold">
                    {member.points}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
