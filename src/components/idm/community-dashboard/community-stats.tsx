'use client';

import { Users, Building2, Trophy } from 'lucide-react';
import { useCommunityTheme } from '@/hooks/use-community-theme';
import type { StatsData } from '@/types/stats';

/* ═══════════════════════════════════════════════════════
   COMMUNITY STATS — 3 compact stat cards
   Dark canvas, gold/division jewelry accents
   ═══════════════════════════════════════════════════════ */
interface CommunityStatsProps {
  maleData?: StatsData;
  femaleData?: StatsData;
}

export function CommunityStats({ maleData, femaleData }: CommunityStatsProps) {
  const dt = useCommunityTheme();

  const totalPlayers = (maleData?.totalPlayers || 0) + (femaleData?.totalPlayers || 0);
  const totalClubs = (maleData?.clubs?.length || 0) + (femaleData?.clubs?.length || 0);
  const totalMatches = (maleData?.recentMatches?.length || 0) + (femaleData?.recentMatches?.length || 0);
  const completedMatches = 0;

  const stats = [
    {
      icon: Users,
      label: 'Pemain',
      value: totalPlayers,
      sub: `${maleData?.totalPlayers || 0}♂ ${femaleData?.totalPlayers || 0}♀`,
      gradient: 'from-idm-gold-warm to-amber-500',
      iconBg: 'bg-idm-gold-warm/10',
      iconColor: 'text-idm-gold-warm',
    },
    {
      icon: Building2,
      label: 'Klub',
      value: totalClubs,
      sub: 'Terdaftar',
      gradient: 'from-emerald-500 to-green-400',
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-500',
    },
    {
      icon: Trophy,
      label: 'Pertandingan',
      value: totalMatches,
      sub: `${completedMatches} selesai`,
      gradient: 'from-cyan-500 to-blue-400',
      iconBg: 'bg-cyan-500/10',
      iconColor: 'text-cyan-500',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className="animate-fade-enter-sm"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className={`relative overflow-hidden ${dt.casinoCard} rounded-2xl border ${dt.borderSubtle} p-3 sm:p-4 group community-stat-card stat-card-shimmer transition-all duration-300 hover:border-idm-gold-warm/30 hover:shadow-[0_0_12px_rgba(239,249,35,0.15)]`}>
            {/* Gold top accent line — appears on hover */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-idm-gold-warm/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className={`w-7 h-7 rounded-lg ${stat.iconBg} flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-300`}>
              <stat.icon className={`w-3.5 h-3.5 ${stat.iconColor}`} />
            </div>
            <p className={`text-lg sm:text-xl font-black bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent leading-tight counter-pop`}>
              {stat.value.toLocaleString('id-ID')}
            </p>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
              {stat.label}
            </p>
            <p className="text-[8px] sm:text-[9px] text-muted-foreground/50 mt-0.5 truncate">
              {stat.sub}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
