'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import Image from 'next/image';
import { Trophy, Calendar, Users, Swords, ChevronRight, X, Crown, ArrowRight } from 'lucide-react';
import { AvatarMedia } from '@/components/ui/avatar-media';
import { getAvatarUrl } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { SectionHeader } from './shared';
import type { StatsData, SeasonInfo } from '@/types/stats';

/* ═══════════════════════════════════════════════════════════════
   SEASON HISTORY / ARCHIVE SECTION
   Shows past seasons with their champions, top players, and stats
   Timeline-style layout with expandable season details
   ═══════════════════════════════════════════════════════════════ */

interface SeasonHistoryProps {
  maleData: StatsData | undefined;
  femaleData: StatsData | undefined;
}

/* ─── Season data from /api/seasons ─── */
interface SeasonApiResponse {
  id: string;
  name: string;
  number: number;
  division: string;
  status: string;
  startDate: string;
  endDate: string | null;
  _count: { tournaments: number; clubs: number };
}

/* ─── Season detail uses StatsData directly from /api/stats?seasonId=... ─── */

/* ─── Time ago helper ─── */
function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'Berlangsung';
  if (diffDays === 0) return 'Hari ini';
  if (diffDays < 30) return `${diffDays} hari lalu`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} bulan lalu`;
  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} tahun lalu`;
}

function formatDateRange(start: string, end: string | null): string {
  const s = new Date(start);
  const startStr = s.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
  if (!end) return `${startStr} — Berlangsung`;
  const e = new Date(end);
  const endStr = e.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
  return `${startStr} — ${endStr}`;
}

/* ─── Skeleton ─── */
function SeasonSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="animate-pulse rounded-2xl border border-idm-gold-warm/10 bg-idm-gold-warm/[0.03] p-4 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-idm-gold-warm/10 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded bg-idm-gold-warm/10" />
              <div className="h-3 w-48 rounded bg-idm-gold-warm/5" />
            </div>
            <div className="h-8 w-20 rounded-lg bg-idm-gold-warm/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Season Detail Modal ─── */
function SeasonDetailModal({
  season,
  division,
  onClose,
}: {
  season: SeasonApiResponse;
  division: 'male' | 'female';
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery<StatsData>({
    queryKey: ['stats', division, season.id],
    queryFn: async () => {
      const res = await fetch(`/api/stats?division=${division}&seasonId=${season.id}`);
      if (!res.ok) throw new Error('Failed to fetch season detail');
      return res.json();
    },
    staleTime: 300000,
  });

  const champion = data?.allSeasons?.find(s => s.id === season.id)?.championPlayer;
  const topPlayers = data?.topPlayers?.slice(0, 5) || [];
  const totalPlayers = data?.totalPlayers || 0;
  const totalMatches = (data?.recentMatches?.length || 0);
  const divisionColor = division === 'male' ? 'idm-male' : 'idm-female';
  const divisionLabel = division === 'male' ? 'Cowo' : 'Cewe';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Detail ${season.name}`}
    >
      <div
        className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl border border-idm-gold-warm/15 bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-idm-gold-warm/10 bg-background/98 backdrop-blur-xl">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-${divisionColor}/10`}>
              <Trophy className={`w-5 h-5 text-${divisionColor}`} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-gradient-fury truncate">{season.name}</h3>
              <p className="text-[10px] text-muted-foreground">{divisionLabel} • {formatDateRange(season.startDate, season.endDate)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="p-1.5 rounded-lg hover:bg-idm-gold-warm/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse h-12 rounded-lg bg-idm-gold-warm/5" />
              ))}
            </div>
          ) : (
            <>
              {/* Champion */}
              {champion && (
                <div className="p-3 rounded-xl border border-idm-gold-warm/15 bg-idm-gold-warm/[0.04]">
                  <div className="flex items-center gap-2 mb-2">
                    <Crown className="w-4 h-4 text-idm-gold-warm" />
                    <span className="text-xs font-bold text-idm-gold-warm uppercase tracking-wider">Juara Season</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-idm-gold-warm/30 shrink-0">
                      <AvatarMedia
                        src={getAvatarUrl(champion.gamertag, division, champion.avatar)}
                        alt={champion.gamertag}
                        fill
                        sizes="40px"
                        className="object-cover object-top"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{champion.gamertag}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {champion.points} pts • {champion.totalWins} menang • {champion.matches} match
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2.5 rounded-lg border border-idm-gold-warm/10 bg-idm-gold-warm/[0.03]">
                  <p className="text-lg font-black text-idm-gold-warm">{totalPlayers}</p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Pemain</p>
                </div>
                <div className="text-center p-2.5 rounded-lg border border-idm-gold-warm/10 bg-idm-gold-warm/[0.03]">
                  <p className="text-lg font-black text-idm-gold-warm">{season._count?.tournaments || 0}</p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Turnamen</p>
                </div>
                <div className="text-center p-2.5 rounded-lg border border-idm-gold-warm/10 bg-idm-gold-warm/[0.03]">
                  <p className="text-lg font-black text-idm-gold-warm">{totalMatches}</p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Match</p>
                </div>
              </div>

              {/* Top Players */}
              {topPlayers.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Top Pemain</p>
                  <div className="space-y-1.5">
                    {topPlayers.map((player, idx) => (
                      <div key={player.id} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-idm-gold-warm/[0.03] transition-colors">
                        <span className="text-[10px] font-black text-idm-gold-warm/60 w-4 text-center shrink-0">{idx + 1}</span>
                        <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 ring-1 ring-idm-gold-warm/20">
                          <AvatarMedia
                            src={getAvatarUrl(player.gamertag, division, player.avatar)}
                            alt={player.gamertag}
                            fill
                            sizes="28px"
                            className="object-cover object-top"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{player.gamertag}</p>
                        </div>
                        <span className="text-[10px] font-bold text-idm-gold-warm/70 tabular-nums">{player.points}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN SEASON HISTORY SECTION
   ═══════════════════════════════════════════════════════════════ */
export function SeasonHistorySection({ maleData, femaleData }: SeasonHistoryProps) {
  const [selectedSeason, setSelectedSeason] = useState<SeasonApiResponse | null>(null);
  const [selectedDivision, setSelectedDivision] = useState<'male' | 'female'>('male');

  /* Fetch all seasons */
  const { data: seasonsData, isLoading } = useQuery<{ male: SeasonApiResponse[]; female: SeasonApiResponse[] }>({
    queryKey: ['seasons-all'],
    queryFn: async () => {
      const [maleRes, femaleRes] = await Promise.all([
        fetch('/api/seasons?division=male'),
        fetch('/api/seasons?division=female'),
      ]);
      const male = maleRes.ok ? await maleRes.json() : [];
      const female = femaleRes.ok ? await femaleRes.json() : [];
      return { male, female };
    },
    staleTime: 300000,
    refetchInterval: 600000,
    refetchIntervalInBackground: false,
  });

  /* Also extract from maleData/femaleData for champion info */
  const maleSeasons = maleData?.allSeasons || [];
  const femaleSeasons = femaleData?.allSeasons || [];

  /* Merge API seasons with stats data for richer display */
  const apiSeasons = seasonsData || { male: [], female: [] };
  const activeTab = selectedDivision;
  const currentApiSeasons = activeTab === 'male' ? apiSeasons.male : apiSeasons.female;
  const currentStatsSeasons = activeTab === 'male' ? maleSeasons : femaleSeasons;

  /* Enrich API seasons with champion data from stats */
  const enrichedSeasons = currentApiSeasons.map((s: SeasonApiResponse) => {
    const statsSeason = currentStatsSeasons.find((ss: SeasonInfo) => ss.id === s.id);
    return {
      ...s,
      championPlayer: statsSeason?.championPlayer || null,
      totalPlayers: statsSeason ? undefined : undefined,
    };
  });

  /* Filter to show completed + active seasons */
  const displaySeasons = enrichedSeasons.filter(
    (s: SeasonApiResponse & { championPlayer: SeasonInfo['championPlayer'] }) =>
      s.status === 'completed' || s.status === 'active'
  );

  return (
    <section className="relative py-8 sm:py-12" aria-label="Riwayat Season">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        {/* Section Header */}
        <SectionHeader
          icon={Calendar}
          label="Riwayat"
          title="Arsip Season"
          subtitle="Perjalanan kompetisi dari season ke season"
        />

        {/* Division Toggle */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <button
            onClick={() => setSelectedDivision('male')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border ${
              activeTab === 'male'
                ? 'border-idm-male/30 bg-idm-male/10 text-idm-male'
                : 'border-idm-gold-warm/10 bg-transparent text-muted-foreground hover:border-idm-male/20 hover:text-idm-male/70'
            }`}
          >
            <Swords className="w-3.5 h-3.5" /> Cowo
          </button>
          <button
            onClick={() => setSelectedDivision('female')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border ${
              activeTab === 'female'
                ? 'border-idm-female/30 bg-idm-female/10 text-idm-female'
                : 'border-idm-gold-warm/10 bg-transparent text-muted-foreground hover:border-idm-female/20 hover:text-idm-female/70'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Cewe
          </button>
        </div>

        {/* Season Cards — Timeline style */}
        {isLoading ? (
          <SeasonSkeleton />
        ) : displaySeasons.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-10 h-10 text-idm-gold-warm/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Belum ada riwayat season</p>
          </div>
        ) : (
          <div className="relative space-y-3 max-w-2xl mx-auto">
            {/* Timeline line */}
            <div className="absolute left-5 sm:left-6 top-0 bottom-0 w-px bg-gradient-to-b from-idm-gold-warm/20 via-idm-gold-warm/10 to-transparent" aria-hidden="true" />

            {displaySeasons.map((season: SeasonApiResponse & { championPlayer: SeasonInfo['championPlayer'] }, idx: number) => {
              const isActive = season.status === 'active';
              const divisionColor = activeTab === 'male' ? 'idm-male' : 'idm-female';
              const champion = season.championPlayer;
              const isLast = idx === displaySeasons.length - 1;

              return (
                <div key={season.id} className="relative flex gap-3 sm:gap-4 group">
                  {/* Timeline dot */}
                  <div className="relative z-10 shrink-0 mt-4">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center border transition-all duration-300 group-hover:scale-105 ${
                      isActive
                        ? `border-${divisionColor}/30 bg-${divisionColor}/10 shadow-[0_0_12px_rgba(239,249,35,0.15)]`
                        : 'border-idm-gold-warm/15 bg-idm-gold-warm/[0.05]'
                    }`}>
                      {isActive ? (
                        <Trophy className={`w-4 h-4 sm:w-5 sm:h-5 text-${divisionColor}`} />
                      ) : (
                        <span className="text-xs font-black text-idm-gold-warm/60">S{season.number}</span>
                      )}
                    </div>
                  </div>

                  {/* Card */}
                  <button
                    onClick={() => {
                      setSelectedSeason(season);
                      setSelectedDivision(activeTab);
                    }}
                    className="flex-1 text-left p-3 sm:p-4 rounded-xl border border-idm-gold-warm/10 bg-idm-gold-warm/[0.03] hover:border-idm-gold-warm/20 hover:bg-idm-gold-warm/[0.06] hover:scale-[1.01] active:scale-[0.995] backdrop-blur-sm transition-all duration-300 cursor-pointer group-hover:shadow-[0_0_20px_rgba(239,249,35,0.05)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-extrabold text-foreground truncate">{season.name}</h3>
                          {isActive && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-${divisionColor}/10 text-${divisionColor} border border-${divisionColor}/20`}>
                              Aktif
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mb-2">
                          {formatDateRange(season.startDate, season.endDate)}
                        </p>

                        {/* Stats row */}
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Trophy className="w-3 h-3 text-idm-gold-warm/40" />
                            {season._count?.tournaments || 0} turnamen
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3 text-idm-gold-warm/40" />
                            {season._count?.clubs || 0} club
                          </span>
                        </div>
                      </div>

                      {/* Champion avatar or chevron */}
                      <div className="shrink-0">
                        {champion ? (
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden ring-2 ring-idm-gold-warm/25">
                              <AvatarMedia
                                src={getAvatarUrl(champion.gamertag, activeTab, champion.avatar)}
                                alt={champion.gamertag}
                                fill
                                sizes="40px"
                                className="object-cover object-top"
                              />
                            </div>
                            <span className="text-[8px] font-bold text-idm-gold-warm/60 truncate max-w-[60px]">{champion.gamertag}</span>
                          </div>
                        ) : (
                          <ChevronRight className="w-4 h-4 text-idm-gold-warm/30 group-hover:text-idm-gold-warm/60 transition-colors mt-2" />
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Lihat Semua Season button */}
        {displaySeasons.length > 0 && (
          <div className="flex justify-center mt-6">
            <button
              onClick={() => {
                // Navigate to peringkat view
                useAppStore.getState().setCurrentView('peringkat');
                window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
              }}
              className="btn-press group flex items-center gap-2 px-5 py-2 rounded-full border border-idm-gold-warm/20 bg-idm-gold-warm/[0.05] hover:bg-idm-gold-warm/10 hover:border-idm-gold-warm/30 transition-all cursor-pointer text-xs font-bold text-idm-gold-warm uppercase tracking-wider"
            >
              Lihat Semua Season
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        )}
      </div>

      {/* Season Detail Modal */}
      {selectedSeason && (
        <SeasonDetailModal
          season={selectedSeason}
          division={selectedDivision}
          onClose={() => setSelectedSeason(null)}
        />
      )}
    </section>
  );
}
