'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Trophy, Calendar, ChevronDown, Crown,
  CheckCircle2, Circle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */
interface SeasonInfo {
  id: string;
  name: string;
  number: number;
  division: 'male' | 'female';
  status: 'active' | 'completed' | 'upcoming';
  startDate?: string;
  endDate?: string;
  championPlayer?: { id?: string; gamertag: string; avatar?: string | null } | null;
  championClub?: { id?: string; name: string; logo?: string | null } | null;
  championPlayerPoints?: number | null;
  _count?: { tournaments: number };
}

export interface SelectedSeason {
  id: string;
  number: number;
  division: 'male' | 'female';
  status: 'active' | 'completed' | 'upcoming';
  name: string;
  championPlayer?: { id?: string; gamertag: string; avatar?: string | null } | null;
  championClub?: { id?: string; name: string; logo?: string | null } | null;
  championPlayerPoints?: number | null;
  startDate?: string;
  endDate?: string;
}

/* ═══════════════════════════════════════════
   Season Selector Component
   ═══════════════════════════════════════════ */
interface SeasonSelectorProps {
  selectedSeason: SelectedSeason | null; // null = active season
  onSeasonChange: (season: SelectedSeason | null) => void;
  selectedDivision: 'all' | 'male' | 'female';
}

export const SeasonSelector = React.memo(function SeasonSelector({
  selectedSeason,
  onSeasonChange,
  selectedDivision,
}: SeasonSelectorProps) {
  const [open, setOpen] = useState(false);

  // Fetch all seasons — API returns flat array
  const { data: seasonsData, isLoading } = useQuery<SeasonInfo[]>({
    queryKey: ['seasons'],
    queryFn: async () => {
      const res = await fetch('/api/seasons');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const seasons = Array.isArray(seasonsData) ? seasonsData : [];

  // Group seasons by number for display
  const seasonGroups = (() => {
    const map: Record<number, SeasonInfo[]> = {};
    for (const s of seasons) {
      if (!map[s.number]) map[s.number] = [];
      map[s.number].push(s);
    }
    // Sort by season number descending
    return Object.entries(map)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([num, items]) => ({ number: Number(num), seasons: items }));
  })();

  // Get the effective division to filter season options
  const effectiveDivision = selectedDivision === 'female' ? 'female' : 'male';

  // Find the active season for the current division
  const activeSeason = seasons.find(
    (s) => s.status === 'active' && s.division === effectiveDivision
  );

  // Currently displayed label — responsive: short on mobile, full on desktop
  const seasonNum = selectedSeason?.number || activeSeason?.number || 2;
  const currentLabelShort = `S${seasonNum}`;
  const currentLabelFull = `Season ${seasonNum}`;

  const isViewingPast = selectedSeason && selectedSeason.status === 'completed';

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
              isViewingPast
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/25 hover:bg-amber-500/20'
                : 'bg-idm-gold-warm/10 text-idm-gold-warm border-idm-gold-warm/25 hover:bg-idm-gold-warm/20'
            }`}
          >
            {isViewingPast ? (
              <Trophy className="w-3.5 h-3.5" />
            ) : (
              <Calendar className="w-3.5 h-3.5" />
            )}
            <span className="sm:hidden">{currentLabelShort}</span>
            <span className="hidden sm:inline">{currentLabelFull}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-72 p-2 bg-background/95 backdrop-blur-xl border border-border/50 shadow-xl rounded-2xl"
        >
          <div className="space-y-1">
            {/* Active Season Option */}
            {activeSeason && (
              <button
                onClick={() => {
                  onSeasonChange(null);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all ${
                  !selectedSeason
                    ? 'bg-idm-gold-warm/15 text-idm-gold-warm'
                    : 'hover:bg-muted/50 text-foreground'
                }`}
              >
                <div className="w-5 h-5 rounded flex items-center justify-center shrink-0">
                  {!selectedSeason ? (
                    <CheckCircle2 className="w-4 h-4 text-idm-gold-warm" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold">Season {activeSeason.number}</span>
                    <Badge className="bg-green-500/15 text-green-400 border-0 text-[8px] px-1.5 py-0">
                      Active
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {activeSeason.division === 'male' ? '🕺' : '💃'} {activeSeason.division.charAt(0).toUpperCase() + activeSeason.division.slice(1)} Division
                  </p>
                </div>
              </button>
            )}

            {/* Divider between active and past */}
            {activeSeason && seasonGroups.some((g) =>
              g.seasons.some((s) => s.status === 'completed')
            ) && (
              <div className="h-px bg-border/20 my-1" />
            )}

            {/* Past Seasons */}
            {seasonGroups.map((group) => {
              const completedSeasons = group.seasons.filter(
                (s) => s.status === 'completed' && s.division === effectiveDivision
              );
              if (completedSeasons.length === 0) return null;

              return completedSeasons.map((season) => {
                const isSelected = selectedSeason?.id === season.id;
                return (
                  <button
                    key={season.id}
                    onClick={() => {
                      onSeasonChange({
                        id: season.id,
                        number: season.number,
                        division: season.division,
                        status: season.status,
                        name: season.name,
                        championPlayer: season.championPlayer,
                        championClub: season.championClub,
                        championPlayerPoints: season.championPlayerPoints,
                        startDate: season.startDate,
                        endDate: season.endDate,
                      });
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all ${
                      isSelected
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'hover:bg-muted/50 text-foreground'
                    }`}
                  >
                    <div className="w-5 h-5 rounded flex items-center justify-center shrink-0">
                      {isSelected ? (
                        <CheckCircle2 className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground/40" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold">Season {season.number}</span>
                        <Badge className="bg-amber-500/15 text-amber-400 border-0 text-[8px] px-1.5 py-0">
                          Completed
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {season.division === 'male' ? '🕺' : '💃'} {season.division.charAt(0).toUpperCase() + season.division.slice(1)} Division
                        {season.championPlayer && (
                          <span className="ml-1">— 🏆 {season.championPlayer.gamertag}</span>
                        )}
                      </p>
                      {season.startDate && season.endDate && (
                        <p className="text-[9px] text-muted-foreground/60">
                          {new Date(season.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - {new Date(season.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                    {season.championPlayer && !isSelected && (
                      <Crown className="w-3.5 h-3.5 text-amber-500/50 shrink-0" />
                    )}
                  </button>
                );
              });
            })}

            {/* Other division's completed seasons (shown when "all" is selected) */}
            {selectedDivision === 'all' &&
              seasonGroups.map((group) => {
                const otherDivSeasons = group.seasons.filter(
                  (s) => s.status === 'completed' && s.division !== effectiveDivision
                );
                return otherDivSeasons.map((season) => {
                  const isSelected = selectedSeason?.id === season.id;
                  return (
                    <button
                      key={season.id}
                      onClick={() => {
                        onSeasonChange({
                          id: season.id,
                          number: season.number,
                          division: season.division,
                          status: season.status,
                          name: season.name,
                          championPlayer: season.championPlayer,
                          championClub: season.championClub,
                          championPlayerPoints: season.championPlayerPoints,
                          startDate: season.startDate,
                          endDate: season.endDate,
                        });
                        setOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all ${
                        isSelected
                          ? 'bg-amber-500/15 text-amber-400'
                          : 'hover:bg-muted/50 text-foreground'
                      }`}
                    >
                      <div className="w-5 h-5 rounded flex items-center justify-center shrink-0">
                        {isSelected ? (
                          <CheckCircle2 className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Circle className="w-4 h-4 text-muted-foreground/40" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold">Season {season.number}</span>
                          <Badge className="bg-amber-500/15 text-amber-400 border-0 text-[8px] px-1.5 py-0">
                            Completed
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {season.division === 'male' ? '🕺' : '💃'} {season.division.charAt(0).toUpperCase() + season.division.slice(1)} Division
                          {season.championPlayer && (
                            <span className="ml-1">— 🏆 {season.championPlayer.gamertag}</span>
                          )}
                        </p>
                      </div>
                    </button>
                  );
                });
              })}
          </div>

          {isLoading && (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Memuat season...
            </div>
          )}

          {seasons.length === 0 && !isLoading && (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Belum ada data season
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
});
