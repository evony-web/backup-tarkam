'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { AnimatedSection, SectionHeader } from './shared';
import { Trophy, Swords, Users, Crown, TrendingUp, Star, Zap, Flame, Target, Medal } from 'lucide-react';
import { useState } from 'react';

/* ═══════════════════════════════════════════════════════
   WEEKLY STATS OVERVIEW
   Key metrics displayed in a compelling grid
   ═══════════════════════════════════════════════════════ */

interface StatCardProps {
  icon: typeof Trophy;
  label: string;
  value: string | number;
  sublabel?: string;
  accentColor?: string;
  trend?: 'up' | 'down' | 'neutral';
}

function StatCard({ icon: Icon, label, value, sublabel, accentColor = 'text-idm-gold-warm', trend }: StatCardProps) {
  return (
    <Card className="group relative overflow-hidden border-border/30 hover:border-border/60 transition-all duration-300 hover:shadow-md">
      <div className="absolute inset-0 bg-gradient-to-br from-idm-gold-warm/[0.02] to-transparent pointer-events-none" />
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between mb-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-idm-gold-warm/10 border border-idm-gold-warm/15`}>
            <Icon className={`w-4 h-4 ${accentColor}`} />
          </div>
          {trend === 'up' && (
            <TrendingUp className="w-3.5 h-3.5 text-green-400" />
          )}
        </div>
        <div className="space-y-0.5">
          <div className="text-lg sm:text-xl font-black text-foreground tabular-nums">{value}</div>
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</div>
          {sublabel && (
            <div className="text-[10px] text-muted-foreground/60 font-medium">{sublabel}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DivisionToggle({ division, setDivision }: { division: 'male' | 'female'; setDivision: (d: 'male' | 'female') => void }) {
  return (
    <div className="flex items-center gap-1 p-0.5 rounded-lg bg-idm-gold-warm/5 border border-idm-gold-warm/10">
      <button
        onClick={() => setDivision('male')}
        className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
          division === 'male'
            ? 'bg-idm-male/15 text-idm-male shadow-sm border border-idm-male/25'
            : 'text-muted-foreground/70 hover:text-foreground border border-transparent'
        }`}
      >
        ♂ Cowo
      </button>
      <button
        onClick={() => setDivision('female')}
        className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
          division === 'female'
            ? 'bg-idm-female/15 text-idm-female shadow-sm border border-idm-female/25'
            : 'text-muted-foreground/70 hover:text-foreground border border-transparent'
        }`}
      >
        ♀ Cewe
      </button>
    </div>
  );
}

export function WeeklyStatsOverview() {
  const [division, setDivision] = useState<'male' | 'female'>('male');
  
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats', division],
    queryFn: () => fetch(`/api/stats?division=${division}`).then(r => r.json()),
    staleTime: 30000,
  });
  
  if (isLoading || !stats?.hasData) return null;
  
  const tournament = stats.activeTournament;
  const season = stats.seasonForClubs;
  const topPlayers = stats.topPlayers || [];
  const recentMatches = stats.recentMatches || [];
  
  // Calculate stats
  const totalPlayers = topPlayers.length;
  const activeTournamentName = tournament?.name || 'Tidak Ada';
  const tournamentStatus = tournament?.status;
  const completedMatches = recentMatches.filter((m: any) => m.status === 'completed').length;
  const liveMatches = recentMatches.filter((m: any) => m.status === 'live').length;
  const topPlayer = topPlayers[0];
  const mvpPlayer = topPlayers.find((p: any) => p.totalMvp > 0);
  const totalPoints = topPlayers.reduce((sum: number, p: any) => sum + (p.points || 0), 0);
  
  return (
    <AnimatedSection>
      <section className="py-8 sm:py-12">
        <div className="flex items-center justify-between gap-4 mb-6">
          <SectionHeader
            label="Statistik"
            title="Ringkasan Mingguan"
            subtitle={`Data ${division === 'male' ? 'Cowo' : 'Cewe'}`}
            icon={TrendingUp}
          />
          <DivisionToggle division={division} setDivision={setDivision} />
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <StatCard
            icon={Users}
            label="Pemain Aktif"
            value={totalPlayers}
            sublabel={division === 'male' ? 'Divisi Cowo' : 'Divisi Cewe'}
            accentColor="text-idm-male"
          />
          <StatCard
            icon={Swords}
            label="Match Selesai"
            value={completedMatches}
            sublabel={liveMatches > 0 ? `${liveMatches} sedang berlangsung` : 'Semua selesai'}
            accentColor="text-green-400"
            trend={completedMatches > 0 ? 'up' : 'neutral'}
          />
          <StatCard
            icon={Crown}
            label="Top Player"
            value={topPlayer?.gamertag || '-'}
            sublabel={topPlayer ? `${topPlayer.points} pts` : undefined}
            accentColor="text-idm-gold-warm"
          />
          <StatCard
            icon={Trophy}
            label="Total Poin"
            value={totalPoints.toLocaleString()}
            sublabel={`Rata-rata ${totalPlayers > 0 ? Math.round(totalPoints / totalPlayers) : 0} pts/pemain`}
            accentColor="text-idm-gold-warm"
          />
          <StatCard
            icon={Star}
            label="MVP"
            value={mvpPlayer?.gamertag || '-'}
            sublabel={mvpPlayer ? `${mvpPlayer.totalMvp}× MVP` : undefined}
            accentColor="text-yellow-400"
          />
          <StatCard
            icon={Flame}
            label="Win Streak"
            value={topPlayer?.streak || 0}
            sublabel={topPlayer?.streak > 0 ? `Max: ${topPlayer.maxStreak}` : undefined}
            accentColor="text-orange-400"
          />
          <StatCard
            icon={Target}
            label="Season"
            value={season?.name || '-'}
            sublabel={season?.status === 'active' ? 'Sedang berlangsung' : season?.status}
            accentColor="text-idm-male"
          />
          <StatCard
            icon={Medal}
            label="Turnamen"
            value={tournament?.weekNumber || '-'}
            sublabel={tournamentStatus === 'completed' ? 'Selesai' : tournamentStatus === 'main_event' ? 'Berlangsung' : 'Pending'}
            accentColor="text-idm-female"
          />
        </div>
      </section>
    </AnimatedSection>
  );
}
