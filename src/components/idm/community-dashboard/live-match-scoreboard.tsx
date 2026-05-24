'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Radio, Swords, Trophy, Clock, Zap, Users, ChevronRight } from 'lucide-react';
import { getDivisionTheme } from '@/hooks/use-division-theme';
import { useCommunityTheme } from '@/hooks/use-community-theme';
import { useAppStore } from '@/lib/store';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect, useMemo } from 'react';

/* ═══════════════════════════════════════════════════════
   LIVE MATCH SCOREBOARD
   Shows currently live or most recent matches with real-time updates
   Auto-refreshes every 30 seconds
   ═══════════════════════════════════════════════════════ */

interface LiveMatch {
  id: string;
  tournamentId: string;
  tournamentName: string;
  weekNumber: number;
  division: string;
  round: number;
  matchNumber: number;
  bracket: string;
  groupLabel?: string;
  format: string;
  team1: { id: string; name: string; power: number; isWinner: boolean; rank: number | null };
  team2: { id: string; name: string; power: number; isWinner: boolean; rank: number | null };
  score1: number | null;
  score2: number | null;
  status: string;
  mvpPlayer?: { id: string; name: string; gamertag: string; avatar: string; tier: string } | null;
  scheduledAt: string | null;
  completedAt: string | null;
}

interface LiveMatchScoreboardProps {
  maleData?: any;
  femaleData?: any;
}

function LiveIndicator() {
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

function MatchStatusBadge({ status }: { status: string }) {
  if (status === 'live') {
    return (
      <Badge variant="outline" className="bg-red-500/10 border-red-500/30 text-red-500 text-[9px] px-1.5 py-0 h-5 font-bold">
        <Radio className="w-2.5 h-2.5 mr-0.5" /> LIVE
      </Badge>
    );
  }
  if (status === 'completed') {
    return (
      <Badge variant="outline" className="bg-green-500/10 border-green-500/30 text-green-500 text-[9px] px-1.5 py-0 h-5 font-bold">
        FT
      </Badge>
    );
  }
  if (status === 'pending' || status === 'ready') {
    return (
      <Badge variant="outline" className="bg-yellow-500/10 border-yellow-500/30 text-yellow-500 text-[9px] px-1.5 py-0 h-5 font-bold">
        <Clock className="w-2.5 h-2.5 mr-0.5" /> UPCOMING
      </Badge>
    );
  }
  return null;
}

function TeamDisplay({ 
  team, 
  score, 
  isWinner, 
  division 
}: { 
  team: { name: string; power: number; isWinner: boolean; rank: number | null };
  score: number | null;
  isWinner: boolean;
  division: string;
}) {
  const dt = getDivisionTheme(division === 'female' ? 'female' : 'male');
  
  return (
    <div className={`flex items-center gap-2 flex-1 min-w-0 ${isWinner ? 'opacity-100' : 'opacity-75'}`}>
      <div className={`flex items-center gap-1.5 min-w-0 flex-1 ${isWinner ? 'font-bold' : 'font-medium'}`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-black shrink-0 ${
          isWinner 
            ? `${dt.bg} text-white shadow-sm` 
            : 'bg-muted text-muted-foreground'
        }`}>
          {team.rank || '#'}
        </div>
        <span className={`truncate text-sm ${isWinner ? 'text-foreground' : 'text-muted-foreground'}`}>
          {team.name}
        </span>
      </div>
      <div className={`text-lg font-black tabular-nums shrink-0 ${
        score !== null && score > (isWinner ? -1 : 0)
          ? isWinner ? 'text-green-400' : 'text-red-400/70'
          : 'text-muted-foreground/50'
      }`}>
        {score !== null ? score : '-'}
      </div>
    </div>
  );
}

function MatchCard({ match, division }: { match: LiveMatch; division: string }) {
  const dt = getDivisionTheme(division === 'female' ? 'female' : 'male');
  const isLive = match.status === 'live';
  const isCompleted = match.status === 'completed';
  const team1Won = isCompleted && match.score1 !== null && match.score2 !== null && match.score1 > match.score2;
  const team2Won = isCompleted && match.score1 !== null && match.score2 !== null && match.score2 > match.score1;

  return (
    <Card className={`group relative overflow-hidden transition-all duration-300 hover:shadow-lg ${
      isLive 
        ? 'border-red-500/30 shadow-red-500/5 shadow-md' 
        : 'border-border/50 hover:border-border'
    }`}>
      {/* Live match glow effect */}
      {isLive && (
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-transparent to-red-500/5 pointer-events-none" />
      )}
      
      <CardContent className="p-3 space-y-2">
        {/* Match header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <MatchStatusBadge status={match.status} />
            <span className="text-[10px] text-muted-foreground font-medium truncate">
              {match.bracket === 'grand_final' ? '🏆 Grand Final' :
               match.bracket === 'upper' ? `Upper Bracket R${match.round}` :
               match.bracket === 'lower' ? `Lower Bracket R${match.round}` :
               match.bracket === 'group' ? `Group ${match.groupLabel || '?'}` :
               `R${match.round}`}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground/60 font-medium shrink-0">
            {match.format}
          </span>
        </div>

        {/* Teams & Scores */}
        <div className="space-y-1">
          <TeamDisplay 
            team={match.team1} 
            score={match.score1} 
            isWinner={team1Won}
            division={division}
          />
          <div className="flex items-center justify-center">
            <span className="text-[9px] font-bold text-muted-foreground/40 tracking-widest">VS</span>
          </div>
          <TeamDisplay 
            team={match.team2} 
            score={match.score2} 
            isWinner={team2Won}
            division={division}
          />
        </div>

        {/* MVP badge */}
        {match.mvpPlayer && isCompleted && (
          <div className="flex items-center gap-1.5 pt-1 border-t border-border/30">
            <Trophy className="w-3 h-3 text-idm-gold-warm shrink-0" />
            <span className="text-[10px] text-idm-gold-warm font-bold">MVP:</span>
            <span className="text-[10px] text-muted-foreground font-medium truncate">
              {match.mvpPlayer.gamertag}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <Card key={i} className="border-border/30">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-12 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-6 w-6" />
              </div>
              <div className="flex items-center justify-center">
                <Skeleton className="h-3 w-6" />
              </div>
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function LiveMatchScoreboard({ maleData, femaleData }: LiveMatchScoreboardProps) {
  const ct = useCommunityTheme();
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // Fetch live/recent matches for both divisions
  const { data: maleStats, isLoading: maleLoading } = useQuery({
    queryKey: ['stats', 'male'],
    queryFn: () => fetch('/api/stats?division=male').then(r => r.json()),
    refetchInterval: autoRefresh ? 30000 : false,
    staleTime: 10000,
  });
  
  const { data: femaleStats, isLoading: femaleLoading } = useQuery({
    queryKey: ['stats', 'female'],
    queryFn: () => fetch('/api/stats?division=female').then(r => r.json()),
    refetchInterval: autoRefresh ? 30000 : false,
    staleTime: 10000,
  });

  const isLoading = maleLoading || femaleLoading;

  // Extract matches from stats data
  const allMatches: LiveMatch[] = useMemo(() => {
    const matches: LiveMatch[] = [];
    
    for (const stats of [maleStats, femaleStats]) {
      if (!stats?.activeTournament?.matches) continue;
      const division = stats.activeTournament.division;
      const tournamentName = stats.activeTournament.name;
      const weekNumber = stats.activeTournament.weekNumber;
      
      for (const m of stats.activeTournament.matches) {
        matches.push({
          id: m.id,
          tournamentId: stats.activeTournament.id,
          tournamentName,
          weekNumber,
          division,
          round: m.round,
          matchNumber: m.matchNumber,
          bracket: m.bracket,
          groupLabel: m.groupLabel,
          format: m.format,
          team1: m.team1 ? { id: m.team1.id, name: m.team1.name, power: m.team1.power, isWinner: m.team1.isWinner, rank: m.team1.rank } : { id: '', name: 'TBD', power: 0, isWinner: false, rank: null },
          team2: m.team2 ? { id: m.team2.id, name: m.team2.name, power: m.team2.power, isWinner: m.team2.isWinner, rank: m.team2.rank } : { id: '', name: 'TBD', power: 0, isWinner: false, rank: null },
          score1: m.score1,
          score2: m.score2,
          status: m.status === 'live' ? 'live' : m.status === 'completed' ? 'completed' : m.status,
          mvpPlayer: m.mvpPlayer ? { id: m.mvpPlayer.id, name: m.mvpPlayer.name, gamertag: m.mvpPlayer.gamertag, avatar: m.mvpPlayer.avatar, tier: m.mvpPlayer.tier } : null,
          scheduledAt: m.scheduledAt,
          completedAt: m.completedAt,
        });
      }
    }
    
    // Sort: live first, then by most recent
    return matches.sort((a, b) => {
      if (a.status === 'live' && b.status !== 'live') return -1;
      if (a.status !== 'live' && b.status === 'live') return 1;
      // Then by completedAt or scheduledAt (most recent first)
      const aTime = a.completedAt || a.scheduledAt || '';
      const bTime = b.completedAt || b.scheduledAt || '';
      return bTime.localeCompare(aTime);
    });
  }, [maleStats, femaleStats]);

  const liveCount = allMatches.filter(m => m.status === 'live').length;
  const completedMatches = allMatches.filter(m => m.status === 'completed').slice(0, 6);
  const displayMatches = [
    ...allMatches.filter(m => m.status === 'live'),
    ...completedMatches,
  ].slice(0, 8);

  const hasTournament = allMatches.length > 0;

  return (
    <Card className={`${ct.casinoCard} overflow-hidden`}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {liveCount > 0 ? (
              <LiveIndicator />
            ) : (
              <div className="flex items-center gap-1.5">
                <Swords className="w-4 h-4 text-idm-gold-warm" />
                <span className="text-xs font-bold text-foreground">Hasil Pertandingan</span>
              </div>
            )}
            <span className="text-[10px] text-muted-foreground font-medium">
              {displayMatches.length} match{displayMatches.length !== 1 ? 'es' : ''}
            </span>
          </div>
          
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`text-[9px] font-bold px-2 py-0.5 rounded-full transition-all ${
              autoRefresh 
                ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                : 'bg-muted text-muted-foreground border border-border'
            }`}
          >
            {autoRefresh ? '🔄 AUTO' : '⏸️ PAUSED'}
          </button>
        </div>

        {/* Matches List */}
        {isLoading ? (
          <LoadingSkeleton />
        ) : !hasTournament ? (
          <div className="text-center py-8 space-y-2">
            <Swords className="w-8 h-8 text-muted-foreground/30 mx-auto" />
            <p className="text-xs text-muted-foreground font-medium">Belum ada turnamen aktif</p>
            <p className="text-[10px] text-muted-foreground/60">Match akan muncul saat turnamen dimulai</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
            {displayMatches.map(match => (
              <MatchCard key={match.id} match={match} division={match.division} />
            ))}
          </div>
        )}

        {/* Footer stats */}
        {hasTournament && (
          <div className="flex items-center justify-between pt-2 border-t border-border/30">
            <div className="flex items-center gap-3">
              {liveCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-red-500 font-bold">
                  <Radio className="w-3 h-3" /> {liveCount} Live
                </span>
              )}
              <span className="text-[10px] text-muted-foreground font-medium">
                {completedMatches.length} Selesai
              </span>
            </div>
            <span className="text-[9px] text-muted-foreground/50">
              {autoRefresh ? 'Update 30s' : 'Manual'}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
