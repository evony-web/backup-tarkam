'use client';

import React, { useState, useCallback } from 'react';
import { Award } from 'lucide-react';
import { SectionHeader } from './shared';
import { CommunityLeaderboard, PeringkatHeader } from '../community-dashboard/community-leaderboard';
import type { StatsData, TopPlayer } from '@/types/stats';

type DivisionFilter = 'all' | 'male' | 'female';

interface PeringkatSectionProps {
  maleData: StatsData | undefined;
  femaleData: StatsData | undefined;
  isDataLoading: boolean;
  setSelectedPlayer: (player: StatsData['topPlayers'][0] & { division?: string } | null) => void;
  setSelectedClub: (club: StatsData['clubs'][0] & { division?: string } | null) => void;
  hideHeader?: boolean;
  maxPlayers?: number;
  maxClubs?: number;
  showAll?: boolean;
  onViewAll?: () => void;
}

export function PeringkatSection({
  maleData,
  femaleData,
  isDataLoading,
  setSelectedPlayer,
  setSelectedClub,
  hideHeader = false,
  maxPlayers = 10,
  maxClubs = 6,
  showAll = false,
  onViewAll,
}: PeringkatSectionProps) {
  const [leaderboardSort, setLeaderboardSort] = useState<'players' | 'clubs'>('players');
  const [divisionFilter, setDivisionFilter] = useState<DivisionFilter>('all');

  const handlePlayerClick = useCallback((player: TopPlayer & { division?: string }, division: 'male' | 'female') => {
    setSelectedPlayer({ ...player, division });
  }, [setSelectedPlayer]);

  const handleClubClick = useCallback((club: StatsData['clubs'][0]) => {
    setSelectedClub(club);
  }, [setSelectedClub]);

  if (isDataLoading) {
    return (
      <section id="peringkat" className="landing-section relative py-6 sm:py-12 px-4 overflow-hidden bg-deep border-y border-border/30 dark:border-0">
        <div className="relative z-10 max-w-7xl mx-auto">
          {!hideHeader && <SectionHeader icon={Award} label="Peringkat" title="Peringkat Tarkam" subtitle="Klasemen pemain dan klub terbaik" />}
          <div className="grid grid-cols-1 gap-4">
            {['Player', 'Club'].map(i => (
              <div key={i} className="h-64 rounded-2xl border border-border/30 bg-card/40 animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="peringkat" className="landing-section relative py-6 sm:py-12 px-4 overflow-hidden bg-deep border-y border-border/30 dark:border-0 shadow-[0_2px_16px_rgba(0,0,0,0.04)] dark:shadow-none backdrop-blur-sm" style={{ contain: 'layout style' }}>
      {/* Background — subtle pattern */}
      <div className="absolute inset-0 opacity-[0.018] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(239,249,35,0.5) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 20%, rgba(239,249,35,0.07) 0%, transparent 50%), radial-gradient(ellipse at 20% 60%, rgba(46,159,255,0.04) 0%, transparent 40%), radial-gradient(ellipse at 80% 60%, rgba(255,45,120,0.04) 0%, transparent 40%)' }} />
      {/* Top edge glow — enhanced premium */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-idm-gold-warm/30 to-transparent" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-idm-gold-warm/[3] to-transparent pointer-events-none" aria-hidden="true" />
      {/* Bottom edge glow — enhanced */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-idm-gold-warm/15 to-transparent" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-idm-gold-warm/[2] to-transparent pointer-events-none" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto">
        {!hideHeader && (
          <div className="stagger-item">
            <SectionHeader icon={Award} label="Peringkat" title="Peringkat Tarkam" subtitle="Klasemen pemain dan klub terbaik di arena Tarkam IDM" />
          </div>
        )}

        {/* Filter Header — Peringkat toggle + Division filter */}
        <div className="stagger-item-fast mb-6" style={{ animationDelay: '30ms' }}>
          <PeringkatHeader
            leaderboardSort={leaderboardSort}
            onLeaderboardSortChange={setLeaderboardSort}
            divisionFilter={divisionFilter}
            onDivisionFilterChange={setDivisionFilter}
            maleData={maleData}
            femaleData={femaleData}
          />
        </div>

        {/* Leaderboard Content */}
        <div className="stagger-item-fast" style={{ animationDelay: '60ms' }}>
          <CommunityLeaderboard
            maleData={maleData}
            femaleData={femaleData}
            onPlayerClick={handlePlayerClick}
            onClubClick={handleClubClick}
            leaderboardSort={leaderboardSort}
            onLeaderboardSortChange={setLeaderboardSort}
            divisionFilter={divisionFilter}
            onDivisionFilterChange={setDivisionFilter}
            maxPlayers={maxPlayers}
            maxClubs={maxClubs}
            showAll={showAll}
            onViewAll={onViewAll}
          />
        </div>
      </div>
    </section>
  );
}
