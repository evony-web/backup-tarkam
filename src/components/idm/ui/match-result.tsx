'use client';

import { Trophy, Star, Clock } from 'lucide-react';
import { parseWitaDate, formatWIBTime } from '@/lib/utils';
import { useState, useEffect } from 'react';

interface MatchResultCardProps {
  team1: {
    name: string;
    logo?: string | null;
    score: number;
    isWinner: boolean;
  };
  team2: {
    name: string;
    logo?: string | null;
    score: number;
    isWinner: boolean;
  };
  mvp?: {
    gamertag: string;
    avatar?: string | null;
  } | null;
  format?: 'BO1' | 'BO3' | 'BO5';
  scheduledAt?: string | null;
  location?: string | null;
  status: 'pending' | 'live' | 'completed';
  className?: string;
  showAnimation?: boolean;
}

export function MatchResultCard({
  team1,
  team2,
  mvp,
  format = 'BO1',
  scheduledAt,
  status,
  className = '',
  showAnimation = true,
}: MatchResultCardProps) {
  const [showScore, setShowScore] = useState(false);

  useEffect(() => {
    if (status === 'completed' && showAnimation) {
      const timer = setTimeout(() => setShowScore(true), 500);
      return () => clearTimeout(timer);
    }
  }, [status, showAnimation]);

  return (
    <div
      className={`animate-fade-enter match-result-card ${status === 'completed' ? (team1.isWinner ? 'winner' : 'loser') : ''} rounded-2xl p-4 bg-card border ${className}`}
    >
      {/* Match Info Bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold">
            {format}
          </span>
          {status === 'live' && (
            <span
              className="flex items-center gap-1 text-red-400 animate-pulse"
            >
              <span className="w-2 h-2 rounded-full bg-red-500" />
              LIVE
            </span>
          )}
          {status === 'completed' && (
            <span className="text-green-400">Selesai</span>
          )}
        </div>
        {scheduledAt && (
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{parseWitaDate(scheduledAt) ? formatWIBTime(parseWitaDate(scheduledAt)!) : ''}</span>
          </div>
        )}
      </div>

      {/* Teams & Score */}
      <div className="flex items-center justify-between gap-4">
        {/* Team 1 */}
        <div className="flex-1 text-center">
          <div
            className={`text-lg font-bold truncate ${team1.isWinner ? 'text-idm-gold-warm' : 'text-foreground'} ${team1.isWinner && showScore ? 'animate-pulse-scale' : ''}`}
          >
            {team1.name}
          </div>
          {team1.isWinner && status === 'completed' && (
            <div
              className="animate-fade-enter-sm flex items-center justify-center gap-1 mt-1"
              style={{ animationDelay: '0.8s' }}
            >
              <Trophy className="w-3 h-3 text-idm-gold-warm" />
              <span className="text-[10px] text-idm-gold-warm">WINNER</span>
            </div>
          )}
        </div>

        {/* Score */}
        <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-background">
          <span
            className={`animate-fade-enter-sm text-2xl font-black ${team1.isWinner ? 'text-idm-gold-warm' : 'text-foreground'}`}
            style={showAnimation ? { animationDelay: '0.3s' } : undefined}
          >
            {team1.score}
          </span>
          <span className="text-muted-foreground">-</span>
          <span
            className={`animate-fade-enter-sm text-2xl font-black ${team2.isWinner ? 'text-idm-gold-warm' : 'text-foreground'}`}
            style={showAnimation ? { animationDelay: '0.4s' } : undefined}
          >
            {team2.score}
          </span>
        </div>

        {/* Team 2 */}
        <div className="flex-1 text-center">
          <div
            className={`text-lg font-bold truncate ${team2.isWinner ? 'text-idm-gold-warm' : 'text-foreground'} ${team2.isWinner && showScore ? 'animate-pulse-scale' : ''}`}
          >
            {team2.name}
          </div>
          {team2.isWinner && status === 'completed' && (
            <div
              className="animate-fade-enter-sm flex items-center justify-center gap-1 mt-1"
              style={{ animationDelay: '0.8s' }}
            >
              <Trophy className="w-3 h-3 text-idm-gold-warm" />
              <span className="text-[10px] text-idm-gold-warm">WINNER</span>
            </div>
          )}
        </div>
      </div>

      {/* MVP */}
      {mvp && status === 'completed' && showScore && (
          <div
            className="animate-fade-enter mt-4 pt-3 border-t border-border"
            style={{ animationDelay: '1s' }}
          >
            <div className="flex items-center justify-center gap-2">
              <div className="animate-pulse">
                <Star className="w-4 h-4 text-idm-gold-warm fill-idm-gold-warm" />
              </div>
              <span className="text-xs text-muted-foreground">MVP:</span>
              <span className="text-sm font-bold text-idm-gold-warm">{mvp.gamertag}</span>
            </div>
          </div>
      )}
    </div>
  );
}

// Match Result Timeline (for tournament history)
interface MatchResultTimelineProps {
  matches: Array<{
    id: string;
    round: number;
    team1: { name: string; score: number; isWinner: boolean };
    team2: { name: string; score: number; isWinner: boolean };
    status: string;
  }>;
  currentRound?: number;
  className?: string;
}

export function MatchResultTimeline({ matches, currentRound, className = '' }: MatchResultTimelineProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {matches.map((match, index) => (
        <div
          key={match.id}
          className="animate-fade-enter relative pl-6"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          {/* Timeline connector */}
          {index < matches.length - 1 && (
            <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-border" />
          )}
          {/* Timeline dot */}
          <div
            className={`absolute left-0 top-1.5 w-6 h-6 rounded-full flex items-center justify-center ${
              match.status === 'completed'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {match.status === 'completed' ? (
              <Trophy className="w-3 h-3" />
            ) : (
              <Clock className="w-3 h-3" />
            )}
          </div>

          <MatchResultCard
            team1={match.team1}
            team2={match.team2}
            status={match.status as 'pending' | 'live' | 'completed'}
            showAnimation={false}
            className="!p-4 sm:!p-5"
          />
        </div>
      ))}
    </div>
  );
}
