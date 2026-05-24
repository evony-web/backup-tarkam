'use client';

import React from 'react';
import {
  Users,
  TrendingUp,
  Zap,
  Trophy,
  Shield,
} from 'lucide-react';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { formatCurrencyShort } from '@/lib/utils';
import type { StatsData } from '@/types/stats';

/* ─── Stat Card Item ─── */
interface StatCardConfig {
  icon: React.ComponentType<{ className?: string }>;
  value: string | number;
  label: string;
  badge?: React.ReactNode;
  isPrimary?: boolean;
}

/* ─── Props ─── */
interface QuickStatsBarProps {
  data: StatsData;
  division: 'male' | 'female';
}

/* ─── QuickStatsBar Component ─── */
export const QuickStatsBar = React.memo(function QuickStatsBar({ data, division }: QuickStatsBarProps) {
  const dt = useDivisionTheme();

  const stats: StatCardConfig[] = [
    {
      icon: Users,
      value: data.totalPlayers,
      label: 'Total Players',
      isPrimary: true,
    },
    {
      icon: Shield,
      value: data.clubs?.length || 0,
      label: 'Clubs',
    },
    {
      icon: Trophy,
      value: formatCurrencyShort(data.activeTournamentPrizePool ?? data.totalPrizePool),
      label: 'Prize Pool',
    },
    {
      icon: TrendingUp,
      value: `${data.seasonProgress?.percentage ?? 0}%`,
      label: 'Season Progress',
    },
  ];

  return (
    <div
      className="
        grid grid-cols-2 sm:grid-cols-4 gap-2
        sm:gap-3
        lg:gap-4
      "
      role="list"
      aria-label="Quick stats summary"
      style={{ contain: 'layout style' }}
    >
      {stats.map((stat, idx) => {
        const Icon = stat.icon;

        return (
          <div
            key={stat.label}
            className="group"
            role="listitem"
          >
            <div
              className={`
                relative flex flex-col items-center justify-center
                p-2.5 sm:p-4 lg:p-5
                rounded-2xl
                bg-muted/30 dark:bg-white/[0.05]
                border
                ${dt.border}
                transition-all duration-200
                hover:scale-[1.03] hover:border-opacity-60
                ${stat.isPrimary ? 'border-l-2 border-l-amber-500/60' : ''}
              `}
            >
              {/* Icon */}
              <div
                className={`
                  w-6 h-6 sm:w-10 sm:h-10
                  rounded-lg shrink-0
                  flex items-center justify-center
                  ${dt.iconBg}
                  transition-colors duration-200
                  group-hover:bg-opacity-20
                `}
              >
                <Icon
                  className={`
                    w-3 h-3 sm:w-5 sm:h-5
                    text-idm-gold-warm
                  `}
                />
              </div>

              {/* Value */}
              <p
                className={`
                  text-lg sm:text-base font-bold truncate max-w-full text-center
                  ${dt.neonText}
                  mt-1 sm:mt-2
                `}
              >
                {stat.value}
              </p>

              {/* Label */}
              <p className="text-[9px] sm:text-xs text-muted-foreground mt-0.5 truncate max-w-full text-center">
                {stat.label}
              </p>

              {/* Subtle zap accent on primary card */}
              {stat.isPrimary && (
                <Zap className="absolute top-1.5 right-1.5 w-3 h-3 text-amber-500/30" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});
