'use client';

import React from 'react';
import {
  Flag, Calendar, Trophy, Star, Clock, Users, Shield, Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import type { StatsData } from '@/types/stats';

interface SeasonTimelineProps {
  data: StatsData;
}

interface Milestone {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  position: number; // 0-100
  completed: boolean;
  current: boolean;
  detail?: string;
}

export function SeasonTimeline({ data }: SeasonTimelineProps) {
  const dt = useDivisionTheme();
  const sp = data.seasonProgress;
  const percentage = sp?.percentage || 0;
  const completedWeeks = sp?.completedWeeks || 0;
  const totalWeeks = sp?.totalWeeks || 10;
  const currentWeek = data.activeTournament?.weekNumber || 1;

  // Build milestones based on season data
  const milestones: Milestone[] = [
    {
      id: 'start',
      label: 'Mulai',
      icon: Flag,
      position: 0,
      completed: true,
      current: false,
      detail: data.season?.name || 'Current Season',
    },
    {
      id: 'registration',
      label: 'Registrasi',
      icon: Users,
      position: Math.min(10, 100),
      completed: completedWeeks >= 1 || data.totalPlayers > 0,
      current: data.activeTournament?.status === 'registration',
      detail: `${data.totalPlayers} Pemain`,
    },
    {
      id: 'week1',
      label: 'Week 1',
      icon: Calendar,
      position: Math.min((1 / totalWeeks) * 100, 100),
      completed: completedWeeks >= 1,
      current: currentWeek === 1 && data.activeTournament?.status !== 'registration',
      detail: completedWeeks >= 1 ? 'Selesai' : 'Segera',
    },
    {
      id: 'midseason',
      label: 'Mid-Season',
      icon: Star,
      position: Math.min(50, 100),
      completed: percentage >= 50,
      current: percentage >= 40 && percentage < 60,
      detail: `${Math.round(totalWeeks / 2)} Weeks`,
    },
    {
      id: 'playoff',
      label: 'Playoff',
      icon: Shield,
      position: Math.min(80, 100),
      completed: percentage >= 80,
      current: percentage >= 70 && percentage < 85,
      detail: 'Eliminasi',
    },
    {
      id: 'finale',
      label: 'Finale',
      icon: Trophy,
      position: 100,
      completed: percentage >= 100,
      current: percentage >= 90 && percentage < 100,
      detail: 'Grand Final',
    },
  ];

  return (
    <div className={`${dt.casinoCard} overflow-hidden rounded-2xl`}>
      <div className={dt.casinoBar} />
      <div className="relative z-10">
        {/* Header */}
        <div className={`flex items-center gap-2.5 px-3 lg:px-4 py-3 border-b ${dt.borderSubtle}`}>
          <div className={`w-5 h-5 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
            <Zap className={`w-3 h-3 ${dt.neonText}`} />
          </div>
          <h3 className="text-xs font-semibold uppercase tracking-wider">Timeline Season</h3>
          <Badge className={`${dt.casinoBadge} ml-auto text-[9px]`}>{percentage}%</Badge>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between text-[10px] mb-1.5">
              <span className="text-muted-foreground">{data.season?.name || 'Current Season'}</span>
              <span className={`font-semibold ${dt.neonText}`}>{completedWeeks}/{totalWeeks} Weeks</span>
            </div>
            <Progress value={percentage} className="h-2" />
          </div>

          {/* Timeline — Desktop horizontal */}
          <div className="hidden sm:block">
            <div className="relative py-4">
              {/* Timeline track */}
              <div className={`absolute top-1/2 left-0 right-0 h-1 rounded-full ${dt.bgSubtle} -translate-y-1/2`}>
                <div
                  className="h-full rounded-full bg-gradient-to-r from-idm-gold-warm to-idm-amber timeline-progress-fill"
                  style={{ width: `${Math.max(percentage, 2)}%` }}
                />
              </div>

              {/* Milestones */}
              <div className="relative flex justify-between">
                {milestones.map((ms) => {
                  const isCompleted = ms.completed;
                  const isCurrent = ms.current;
                  return (
                    <div key={ms.id} className="flex flex-col items-center" style={{ width: `${100 / milestones.length}%` }}>
                      {/* Dot */}
                      <div className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                        isCurrent
                          ? `border-current ${dt.text} timeline-milestone-pulse`
                          : isCompleted
                            ? `border-current ${dt.text} bg-background`
                            : `border-border/30 bg-background`
                      }`}>
                        <ms.icon className={`w-3 h-3 ${isCompleted || isCurrent ? dt.neonText : 'text-muted-foreground/40'}`} />
                      </div>
                      {/* Label */}
                      <p className={`text-[9px] font-semibold mt-2 text-center ${
                        isCurrent ? dt.neonText : isCompleted ? 'text-foreground' : 'text-muted-foreground/50'
                      }`}>
                        {ms.label}
                      </p>
                      {ms.detail && (
                        <p className={`text-[8px] text-center mt-0.5 ${isCurrent ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                          {ms.detail}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Timeline — Mobile vertical */}
          <div className="sm:hidden space-y-0">
            {milestones.map((ms, idx) => {
              const isCompleted = ms.completed;
              const isCurrent = ms.current;
              const isLast = idx === milestones.length - 1;
              return (
                <div key={ms.id} className="flex gap-3">
                  {/* Vertical line + dot */}
                  <div className="flex flex-col items-center">
                    <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center border-2 shrink-0 ${
                      isCurrent
                        ? `border-current ${dt.text} timeline-milestone-pulse`
                        : isCompleted
                          ? `border-current ${dt.text} bg-background`
                          : 'border-border/30 bg-background'
                    }`}>
                      <ms.icon className={`w-2.5 h-2.5 ${isCompleted || isCurrent ? dt.neonText : 'text-muted-foreground/40'}`} />
                    </div>
                    {!isLast && (
                      <div className={`w-0.5 flex-1 min-h-[24px] ${isCompleted ? dt.bg : dt.bgSubtle}`} />
                    )}
                  </div>
                  {/* Content */}
                  <div className={`pb-3 ${isLast ? '' : ''}`}>
                    <p className={`text-[10px] font-semibold ${isCurrent ? dt.neonText : isCompleted ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                      {ms.label}
                    </p>
                    {ms.detail && (
                      <p className={`text-[9px] ${isCurrent ? 'text-foreground/70' : 'text-muted-foreground/40'}`}>
                        {ms.detail}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick stats row */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className={`p-3 sm:p-4 rounded-lg ${dt.bgSubtle} ${dt.borderSubtle} border text-center`}>
              <p className={`text-sm font-bold ${dt.neonText}`}>{data.totalPlayers}</p>
              <p className="text-[9px] text-muted-foreground">Players</p>
            </div>
            <div className={`p-3 sm:p-4 rounded-lg ${dt.bgSubtle} ${dt.borderSubtle} border text-center`}>
              <p className={`text-sm font-bold ${dt.neonText}`}>{data.clubs?.length || 0}</p>
              <p className="text-[9px] text-muted-foreground">Clubs</p>
            </div>
            <div className={`p-3 sm:p-4 rounded-lg ${dt.bgSubtle} ${dt.borderSubtle} border text-center`}>
              <p className={`text-sm font-bold ${dt.neonText}`}>{completedWeeks}</p>
              <p className="text-[9px] text-muted-foreground">Weeks Done</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
