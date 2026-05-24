'use client';

import { Calendar, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCommunityTheme } from '@/hooks/use-community-theme';
import type { StatsData, SeasonProgress } from '@/types/stats';

/* ═══════════════════════════════════════════════════════
   SEASON PROGRESS TRACKER — Visual bar showing season progress
   ═══════════════════════════════════════════════════════ */
interface SeasonProgressProps {
  maleData?: StatsData;
  femaleData?: StatsData;
}

/* ── Single division progress row ── */
function ProgressRow({
  label,
  emoji,
  progress,
  gradientFrom,
  gradientTo,
  delay = 0,
}: {
  label: string;
  emoji: string;
  progress: SeasonProgress;
  gradientFrom: string;
  gradientTo: string;
  delay?: number;
}) {
  const pct = Math.min(Math.max(progress.percentage, 0), 100);

  return (
    <div
      className="space-y-2 animate-fade-enter-sm"
      style={{ animationDelay: `${delay * 1000}ms` }}
    >
      {/* Label row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm" role="img" aria-hidden="true">{emoji}</span>
          <span className="text-xs font-semibold">{label}</span>
        </div>
        <span className="text-[10px] text-muted-foreground font-medium">
          Week {progress.completedWeeks} dari {progress.totalWeeks}
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-3 rounded-full bg-idm-gold-warm/10 overflow-hidden border border-idm-gold-warm/10">
        <div
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${gradientFrom} ${gradientTo}`}
          style={{ width: `${pct}%`, boxShadow: `0 0 12px ${gradientFrom.includes('cyan') ? '#57B5FF55' : gradientFrom.includes('purple') ? '#FF5C9A55' : '#EFF92355'}` }}
        />
        {/* Percentage text on bar */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[8px] font-bold text-white drop-shadow-sm">
            {Math.round(pct)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export function SeasonProgressTracker({ maleData, femaleData }: SeasonProgressProps) {
  const dt = useCommunityTheme();

  const maleProgress = maleData?.seasonProgress;
  const femaleProgress = femaleData?.seasonProgress;
  const hasMale = !!maleProgress;
  const hasFemale = !!femaleProgress;

  // If neither division has progress data, render nothing
  if (!hasMale && !hasFemale) return null;

  // Compute combined community progress
  let combinedProgress: SeasonProgress | null = null;
  if (hasMale && hasFemale) {
    const totalWeeks = maleProgress!.totalWeeks + femaleProgress!.totalWeeks;
    const completedWeeks = maleProgress!.completedWeeks + femaleProgress!.completedWeeks;
    const percentage = totalWeeks > 0 ? (completedWeeks / totalWeeks) * 100 : 0;
    combinedProgress = { totalWeeks, completedWeeks, percentage };
  }

  return (
    <Card className={`${dt.casinoCard} overflow-hidden`}>
      <CardContent className="p-4 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg ${dt.iconBg} flex items-center justify-center`}>
              <Calendar className={`w-3.5 h-3.5 ${dt.text}`} />
            </div>
            <span className={`text-xs font-bold ${dt.neonText}`}>Progress Season</span>
          </div>
          <Badge className={`${dt.badgeBg} text-[8px] border`}>
            <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
            Berjalan
          </Badge>
        </div>

        {/* Male division progress */}
        {hasMale && (
          <ProgressRow
            label="Divisi Cowo"
            emoji="🕺"
            progress={maleProgress!}
            gradientFrom="from-cyan-400"
            gradientTo="to-cyan-600"
            delay={0}
          />
        )}

        {/* Female division progress */}
        {hasFemale && (
          <ProgressRow
            label="Divisi Cewe"
            emoji="💃"
            progress={femaleProgress!}
            gradientFrom="from-purple-400"
            gradientTo="to-purple-600"
            delay={0.1}
          />
        )}

        {/* Combined community progress */}
        {combinedProgress && (
          <div
            className="pt-2 border-t border-border/10 space-y-2 animate-fade-enter"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm" role="img" aria-hidden="true">🏆</span>
                <span className="text-xs font-bold text-idm-gold-warm">Komunitas (Gabungan)</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">
                {combinedProgress.completedWeeks} dari {combinedProgress.totalWeeks} week
              </span>
            </div>

            <div className="relative h-4 rounded-full bg-muted/30 overflow-hidden border border-idm-gold-warm/15">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500"
                style={{ width: `${combinedProgress.percentage}%`, boxShadow: '0 0 16px #EFF92355' }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[9px] font-bold text-white drop-shadow-sm">
                  {Math.round(combinedProgress.percentage)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
