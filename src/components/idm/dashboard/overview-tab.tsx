'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';

import {
  Radio, Music, Swords,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SectionCard, MatchRow } from './shared';
import { AnimatedEmptyState } from '../ui/animated-empty-state';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { SeasonTimeline } from './season-timeline';
import type { StatsData } from '@/types/stats';

/* Lazy-load PlayerComparison — defers ~80KB recharts bundle until comparison modal is opened */
const PlayerComparison = dynamic(() => import('../player-comparison').then(m => ({ default: m.PlayerComparison })), {
  ssr: false,
  loading: () => <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Loading comparison...</div>,
});

interface OverviewTabProps {
  data: StatsData;
  division: 'male' | 'female';
  setSelectedPlayer: (player: any) => void;
  setSelectedClub: (club: any) => void;
}

export function OverviewTab({ data, division, setSelectedPlayer, setSelectedClub }: OverviewTabProps) {
  const dt = useDivisionTheme();

  const t = data.activeTournament;
  const [compareOpen, setCompareOpen] = useState(false);

  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-6" style={{ contain: 'layout style' }}>

      {/* ★ Compare Players Button */}
      <div className="stagger-item-subtle">
        <button
          onClick={() => setCompareOpen(true)}
          className={`w-full flex items-center gap-3 p-4 sm:p-5 rounded-2xl ${dt.casinoCard} border ${dt.border} transition-all hover:bg-muted/20 hover:border-idm-gold/20 cursor-pointer group`}
        >
          <div className={`w-9 h-9 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center shrink-0`}>
            <Swords className={`w-4 h-4 text-idm-gold-warm`} />
          </div>
          <div className="flex-1 text-left">
            <p className="text-xs font-semibold">Bandingkan Pemain</p>
            <p className="text-[10px] text-muted-foreground">Bandingkan statistik dua pemain secara head-to-head</p>
          </div>
          <Badge className={`${dt.casinoBadge} text-[9px]`}>VS</Badge>
        </button>
      </div>

      {/* Recent Results */}
      {data.recentMatches?.length > 0 ? (
        <div className="stagger-item-subtle stagger-d1">
          <SectionCard title="Hasil Terbaru" icon={Radio} badge="LIVE">
            <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
              {data.recentMatches.slice(0, 6).map(m => (
                <MatchRow
                  key={m.id}
                  club1={m.club1.name}
                  club2={m.club2.name}
                  score1={m.score1}
                  score2={m.score2}
                  week={m.week}
                  status="completed"
                />
              ))}
            </div>
          </SectionCard>
        </div>
      ) : (
        <div className="stagger-item-subtle stagger-d1">
          <SectionCard title="Hasil Terbaru" icon={Radio} badge="LIVE">
            <AnimatedEmptyState
              icon={Music}
              message="Belum ada hasil match"
              hint="Match yang sudah selesai akan muncul di sini"
              pattern
              cta={<span className={`empty-cta-hint text-[10px] ${dt.text} mt-1 inline-block`}>🎬 Daftar sekarang untuk mulai bertanding!</span>}
            />
          </SectionCard>
        </div>
      )}

      {/* Season Timeline */}
      <div className="stagger-item-subtle stagger-d3">
        <SeasonTimeline data={data} />
      </div>

      {/* Player Comparison Modal */}
      <PlayerComparison open={compareOpen} onClose={() => setCompareOpen(false)} />
    </div>
  );
}
