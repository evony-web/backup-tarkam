'use client';

import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/lib/store';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Crown, Star, Swords, TrendingUp, Users, Zap } from 'lucide-react';
import { clubToString, formatTarkamSeasonName } from '@/lib/utils';
import { ActivityFeed } from '@/components/idm/activity-feed';

export function Dashboard() {
  const { division } = useAppStore();

  const { data, isLoading } = useQuery({
    queryKey: ['stats', division],
    queryFn: async () => { const res = await fetch(`/api/stats?division=${division}`); return res.json(); },
    staleTime: 30000,
  });

  if (isLoading || !data?.hasData) {
    return (
      <div className="space-y-6">
        <div className="h-44 rounded-2xl bg-muted animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="h-64 rounded-2xl bg-muted animate-pulse" />
          <div className="h-64 rounded-2xl bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  const hasActive = !!data.activeTournament;
  const completedWeeks = data.seasonProgress?.completedWeeks || 0;
  const totalWeeks = data.seasonProgress?.totalWeeks || 0;
  const progressPct = totalWeeks > 0 ? Math.round((completedWeeks / totalWeeks) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* ── Hero Banner — Clean & Punchy ── */}
      <div
        className="stagger-item perspective-card relative rounded-2xl overflow-hidden border border-border"
      >
        {/* Animated mesh gradient background — gold variant */}
        <div className="absolute inset-0 bg-mesh-community" />

        {/* Static gradient overlay for depth — gold */}
        <div className="absolute inset-0 bg-gradient-to-br from-idm-gold-warm/8 via-transparent to-idm-gold-warm/3" />

        {/* Shimmer/shine sweep across banner */}
        <div className="hero-shimmer-sweep" />

        <div className="relative z-10 p-5 sm:p-7">
          {/* Top row — badges */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Badge className="bg-idm-gold-warm/10 text-idm-gold-warm border-0 text-xs division-badge-glow-community">
              {division === 'male' ? '🕺' : '💃'} {division.charAt(0).toUpperCase() + division.slice(1)} Tarkam
            </Badge>
            <Badge variant="outline" className="text-[10px]">{formatTarkamSeasonName(data.season.name, data.season.number)}</Badge>
            {hasActive && (
              <Badge className="bg-red-500/10 text-red-400 border-0 text-[10px]">
                <span className="flex h-1.5 w-1.5 mr-1 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" /></span>
                LIVE
              </Badge>
            )}
          </div>

          {/* Tournament name / status */}
          <h1 className="text-2xl sm:text-3xl font-black mb-1">
            {hasActive ? data.activeTournament.name : 'No Active Tournament'}
          </h1>
          <p className="text-sm text-muted-foreground mb-4">
            {hasActive
              ? `Week ${data.activeTournament.weekNumber} · ${data.activeTournament.bpm || 120} BPM · ${data.activeTournament.location || 'Online'}`
              : 'Stay tuned for the next tournament'}
          </p>

          {/* Inline quick stats — compact, no big cards */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {hasActive && (
              <div className="flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-idm-gold-warm" />
                <span className="text-muted-foreground">Prize</span>
                <span className="font-bold text-idm-gold-warm">Rp {data.activeTournament.prizePool.toLocaleString()}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-idm-gold-warm" />
              <span className="text-muted-foreground">Players</span>
              <span className="font-bold text-idm-gold-warm">{data.totalPlayers}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-idm-gold-warm" />
              <span className="text-muted-foreground">Season</span>
              <span className="font-bold text-idm-gold-warm">{completedWeeks}/{totalWeeks} Week</span>
            </div>
            {data.seasonDonationTotal > 0 && (
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-idm-gold-warm" />
                <span className="text-muted-foreground">Donasi</span>
                <span className="font-bold text-idm-gold-warm">Rp {data.seasonDonationTotal.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Season progress bar — visual & clean */}
          {totalWeeks > 0 && (
            <div className="mt-4 max-w-md">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Season Progress</span>
                <span className="text-[10px] font-bold text-idm-gold-warm">{progressPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-out bg-gradient-to-r from-idm-gold-warm to-idm-amber"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Activity Feed ── */}
      <ActivityFeed />

      {/* ── Two Column — Top Players + Weekly Champions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Players */}
        <Card className="perspective-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Crown className="w-4 h-4 text-idm-gold-warm" /> Top Players
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 max-h-96 overflow-y-auto overflow-x-hidden custom-scrollbar pr-1">
            {data.topPlayers.map((player: any, i: number) => (
              <div key={player.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i < 3
                  ? 'bg-idm-gold-warm/20 text-idm-gold-warm'
                  : 'bg-muted text-muted-foreground'
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{player.gamertag}</p>
                  <p className="text-[10px] text-muted-foreground">{clubToString(player.club) || 'No Club'}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-idm-gold-warm">{player.points}</div>
                  <div className="text-[10px] text-muted-foreground">{player.totalWins}W · {player.totalMvp}MVP</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Weekly Champions */}
        <Card className="perspective-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="w-4 h-4 text-idm-gold-warm" /> Weekly Champions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto overflow-x-hidden custom-scrollbar pr-1">
            {data.weeklyChampions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No completed tournaments yet</p>
            ) : (
              data.weeklyChampions.map((champ: any, i: number) => (
                <div key={i} className="p-3 sm:p-4 rounded-lg border border-border hover:bg-muted/20 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold">{champ.tournamentName}</span>
                    <Badge variant="outline" className="text-[10px]">Week {champ.weekNumber}</Badge>
                  </div>
                  {champ.winnerTeam && (
                    <div className="flex items-center gap-2">
                      <Crown className="w-3 h-3 text-idm-gold-warm" />
                      <span className="text-xs text-muted-foreground">{champ.winnerTeam.name}</span>
                    </div>
                  )}
                  {champ.mvp && (
                    <div className="flex items-center gap-2 mt-1">
                      <Star className="w-3 h-3 text-yellow-400" />
                      <span className="text-xs text-muted-foreground">MVP: {champ.mvp.gamertag}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Matches ── */}
      {data.recentMatches.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Swords className="w-4 h-4 text-idm-gold-warm" /> Recent Matches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.recentMatches.map((match: any) => (
                <div key={match.id} className="flex items-center justify-between p-3 sm:p-4 rounded-lg bg-muted/30">
                  <div className="flex-1 text-right"><span className="text-sm font-medium">{match.club1.name}</span></div>
                  <div className="mx-4 flex items-center gap-2">
                    <span className="text-lg font-black text-idm-gold-warm">{match.score1}</span>
                    <span className="text-xs text-muted-foreground">vs</span>
                    <span className="text-lg font-black text-idm-gold-warm">{match.score2}</span>
                  </div>
                  <div className="flex-1 text-left"><span className="text-sm font-medium">{match.club2.name}</span></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
