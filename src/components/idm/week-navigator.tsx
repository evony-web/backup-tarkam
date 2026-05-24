'use client';

import { useState, useMemo } from 'react';
import { hexToRgba } from '@/lib/utils';

interface WeekItem {
  weekNumber: number;
  label?: string;
  status?: 'completed' | 'live' | 'upcoming';
}

interface Phase {
  key: string;
  label: string;
  emoji: string;
  weekRange: [number, number]; // [start, end] inclusive
}

interface WeekNavigatorProps {
  totalWeeks: number;
  completedWeeks: number[];
  liveWeek?: number;
  selectedWeek: number;
  onWeekChange: (week: number) => void;
  accent?: string;        // hex color e.g. '#2E9FFF'
  accentLight?: string;   // hex color e.g. '#57B5FF'
  phases?: Phase[];
  size?: 'xs' | 'sm' | 'md';
}

function buildPhases(totalWeeks: number): Phase[] {
  if (totalWeeks <= 4) {
    return [{ key: 'all', label: 'Season', emoji: '🏆', weekRange: [1, totalWeeks] }];
  }
  if (totalWeeks <= 6) {
    return [
      { key: 'early', label: 'Early', emoji: '🟢', weekRange: [1, 3] },
      { key: 'late', label: 'Late', emoji: '🔥', weekRange: [4, totalWeeks] },
    ];
  }
  if (totalWeeks <= 10) {
    // 7-10 weeks: 3 phases — Early, Mid, Final
    const midStart = totalWeeks <= 8 ? 4 : 4;
    const midEnd = totalWeeks <= 8 ? totalWeeks - 1 : 7;
    return [
      { key: 'early', label: 'Early', emoji: '🟢', weekRange: [1, midStart - 1] },
      { key: 'mid', label: 'Mid', emoji: '🔥', weekRange: [midStart, midEnd] },
      { key: 'final', label: 'Final', emoji: '🏆', weekRange: [midEnd + 1, totalWeeks] },
    ];
  }
  // 12+ weeks: 4 phases
  const q1 = Math.floor(totalWeeks / 4);
  const q2 = Math.floor(totalWeeks / 2);
  return [
    { key: 'early', label: 'Early', emoji: '🟢', weekRange: [1, q1] },
    { key: 'mid', label: 'Mid', emoji: '⚡', weekRange: [q1 + 1, q2] },
    { key: 'late', label: 'Late', emoji: '🔥', weekRange: [q2 + 1, totalWeeks - 2] },
    { key: 'final', label: 'Final', emoji: '🏆', weekRange: [totalWeeks - 1, totalWeeks] },
  ];
}

export function WeekNavigator({
  totalWeeks,
  completedWeeks,
  liveWeek,
  selectedWeek,
  onWeekChange,
  accent = '#2E9FFF',
  accentLight = '#57B5FF',
  phases: customPhases,
  size = 'md',
}: WeekNavigatorProps) {
  const phases = customPhases || buildPhases(totalWeeks);

  // Determine active phase based on selectedWeek
  const activePhase = useMemo(() => {
    return phases.find(p => selectedWeek >= p.weekRange[0] && selectedWeek <= p.weekRange[1]) || phases[0];
  }, [selectedWeek, phases]);

  const [manualPhase, setManualPhase] = useState<string | null>(null);
  const currentPhase = manualPhase ? phases.find(p => p.key === manualPhase) || activePhase : activePhase;

  // Build week dots for current phase
  const phaseWeeks = useMemo(() => {
    const weeks: WeekItem[] = [];
    for (let w = currentPhase.weekRange[0]; w <= currentPhase.weekRange[1]; w++) {
      if (w > totalWeeks) break;
      weeks.push({
        weekNumber: w,
        status: completedWeeks.includes(w)
          ? 'completed'
          : liveWeek === w
            ? 'live'
            : 'upcoming',
      });
    }
    return weeks;
  }, [currentPhase, totalWeeks, completedWeeks, liveWeek]);

  const isSm = size === 'sm';
  const isXs = size === 'xs';

  return (
    <div className={`space-y-1.5 ${isXs ? 'max-w-full' : ''}`}>
      {/* Phase Tabs — scrollable on xs to prevent overflow */}
      {phases.length > 1 && (
        <div className={`flex items-center gap-1 ${isXs ? 'overflow-x-auto' : ''}`}>
          {phases.map(phase => {
            const isActive = currentPhase.key === phase.key;
            return (
              <button
                key={phase.key}
                onClick={() => setManualPhase(phase.key)}
                className={`compact-dot rounded-md font-semibold transition-all whitespace-nowrap ${
                  isXs ? 'px-1.5 py-0.5 text-[8px] leading-tight' :
                  isSm ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[10px]'
                } ${
                  isActive
                    ? 'text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground bg-transparent'
                }`}
                style={{ minWidth: 'unset', minHeight: 'unset', ...(isActive ? { backgroundColor: hexToRgba(accent, 0x40), color: accentLight } : {}) }}
              >
                <span className="mr-0.5">{phase.emoji}</span>
                {phase.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Week Dots — flex-wrap for small screens */}
      <div className={`flex items-center flex-wrap gap-1`}>
        <span className={`font-semibold mr-0.5 shrink-0 ${isXs ? 'text-[7px]' : isSm ? 'text-[9px]' : 'text-[9px]'}`} style={{ color: accentLight, opacity: 0.5 }}>
          W
        </span>
        {phaseWeeks.map(w => {
          const isSelected = selectedWeek === w.weekNumber;
          const isCompleted = w.status === 'completed';
          const isLive = w.status === 'live';

          return (
            <button
              key={w.weekNumber}
              onClick={() => onWeekChange(w.weekNumber)}
              className={`compact-dot relative flex items-center justify-center transition-all duration-200 rounded-full font-bold shrink-0 ${
                isXs ? 'w-4 h-4 text-[6px]' : isSm ? 'w-5 h-5 text-[7px]' : 'w-7 h-7 text-[9px]'
              } ${
                isSelected
                  ? 'text-white shadow-md'
                  : isLive
                    ? 'text-white'
                    : isCompleted
                      ? 'text-white/70'
                      : 'text-white/30'
              }`}
              style={{
                minWidth: 'unset',
                minHeight: 'unset',
                ...(isSelected
                  ? { backgroundColor: accent, boxShadow: `0 0 8px ${hexToRgba(accent, 0x60)}` }
                  : isLive
                    ? { backgroundColor: '#ef4444', boxShadow: '0 0 6px rgba(239,68,68,0.5)' }
                    : isCompleted
                      ? { backgroundColor: hexToRgba(accent, 0x30) }
                      : { backgroundColor: 'rgba(255,255,255,0.06)' })
              }}
            >
              {w.weekNumber}
              {/* Live pulse */}
              {isLive && !isSelected && (
                <span className={`absolute -top-0.5 -right-0.5 rounded-full bg-red-500 animate-pulse ${isXs ? 'w-1.5 h-1.5' : 'w-2 h-2'}`} />
              )}
              {/* Completed indicator */}
              {isCompleted && !isSelected && !isLive && (
                <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ backgroundColor: accent }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
