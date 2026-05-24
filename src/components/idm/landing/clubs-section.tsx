'use client';

import { useQuery } from '@tanstack/react-query';
import { Users, Shield, Music, ChevronUp, ChevronDown, Crown, Trophy, CheckCircle2, Swords, Star, History } from 'lucide-react';
import { SectionHeader } from './shared';
import { CardSkeleton } from '../ui/skeleton';

import { ClubLogoImage } from '@/components/idm/club-logo-image';
import type { StatsData, ClubData } from '@/types/stats';

interface LeaderboardClub {
  id: string;
  name: string;
  logo: string | null;
  bannerImage: string | null;
  points: number;
  malePoints: number;
  femalePoints: number;
  wins: number;
  losses: number;
  gameDiff: number;
  memberCount: number;
  maleMemberCount: number;
  femaleMemberCount: number;
  rank: number;
}

interface ClubsSectionProps {
  maleData: StatsData | undefined;
  femaleData: StatsData | undefined;
  isDataLoading: boolean;
  cmsSections: Record<string, any>;
  setSelectedClub: (club: StatsData['clubs'][0] & { division?: string; members?: any[] } | null) => void;
  showAllClubs: boolean;
  setShowAllClubs: (show: boolean) => void;
  selectedSeasonId: string | null;
  setSelectedSeasonId: (id: string | null) => void;
  isHistorical: boolean;
  hideHeader?: boolean;
}

export function ClubsSection({ maleData, femaleData, isDataLoading, cmsSections, setSelectedClub, showAllClubs, setShowAllClubs, selectedSeasonId, setSelectedSeasonId, isHistorical, hideHeader = false }: ClubsSectionProps) {
  // ── Fetch unified club leaderboard from /api/clubs/leaderboard?type=tarkam ──
  const { data: leaderboardData, isLoading: isLeaderboardLoading } = useQuery<{ clubs: LeaderboardClub[]; type: string }>({
    queryKey: ['club-leaderboard', 'tarkam'],
    queryFn: async () => {
      const res = await fetch('/api/clubs/leaderboard?type=tarkam');
      if (!res.ok) return { clubs: [], type: 'tarkam' };
      return res.json();
    },
    staleTime: 120000,
    refetchInterval: 300000,
    refetchIntervalInBackground: false,
    gcTime: 300000,
  });

  const leaderboardClubs = leaderboardData?.clubs || [];
  const isLoading = isDataLoading || isLeaderboardLoading;

  // Get Tarkam season champions from allSeasons data (not from Liga)
  const seasonChampions = [
    ...(maleData?.allSeasons || []),
    ...(femaleData?.allSeasons || []),
  ]
    .filter(s => s.status === 'completed' && s.championClub)
    .map(s => ({ ...s.championClub!, seasonNumber: s.number, division: s.name.toLowerCase().includes('female') ? 'female' as const : 'male' as const }))
    // Deduplicate by composite key (same club can champion both divisions)
    .filter((ch, idx, arr) => arr.findIndex(c => `${c.id}-${c.division}-S${c.seasonNumber}` === `${ch.id}-${ch.division}-S${ch.seasonNumber}`) === idx);

  // ── Season Selector Data ──
  // Merge unique seasons from both divisions (deduplicate by season number)
  const allSeasons = maleData?.allSeasons || femaleData?.allSeasons || [];
  const uniqueSeasonNumbers = [...new Set(allSeasons.map(s => s.number))];
  const seasonsForSelector = uniqueSeasonNumbers.map(num => {
    const maleSeason = allSeasons.find(s => s.number === num);
    return maleSeason!;
  }).sort((a, b) => b.number - a.number); // S2 first, S1 second

  // ── Rank badge helper ──
  const getRankBadge = (rank: number) => {
    if (rank === 1) return { icon: '🥇', color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20' };
    if (rank === 2) return { icon: '🥈', color: 'text-gray-300', bg: 'bg-gray-300/10 border-gray-300/20' };
    if (rank === 3) return { icon: '🥉', color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20' };
    return null;
  };

  return (<>
      {/* ========== CLUB — Premium Card Layout ========== */}
      <section id="clubs" className="landing-section clubs-section-deep relative py-6 sm:py-12 px-4 overflow-hidden bg-deep">
        {/* ── Background layers (lightweight CSS-only) ── */}
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle, color-mix(in srgb, var(--idm-gold-warm) 50%, transparent) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        {/* Soft ambient radial glows */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 15%, color-mix(in srgb, var(--idm-gold-warm) 7%, transparent) 0%, transparent 45%), radial-gradient(ellipse at 10% 60%, color-mix(in srgb, var(--idm-male) 4%, transparent) 0%, transparent 40%), radial-gradient(ellipse at 90% 60%, color-mix(in srgb, var(--idm-female) 4%, transparent) 0%, transparent 40%)' }} />
        {/* Top edge glow */}
        <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent 5%, color-mix(in srgb, var(--idm-gold-warm) 30%, transparent) 30%, color-mix(in srgb, var(--idm-gold-warm) 50%, transparent) 50%, color-mix(in srgb, var(--idm-gold-warm) 30%, transparent) 70%, transparent 95%)' }} aria-hidden="true" />
        {/* Bottom edge line */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-idm-gold-warm/12 to-transparent" aria-hidden="true" />

        <div className="relative z-10 max-w-7xl mx-auto">
          {!hideHeader && (
            <div className="stagger-item">
              <SectionHeader icon={Swords} label={cmsSections.clubs?.subtitle || "Club Peserta"} title={cmsSections.clubs?.title || "Club"} subtitle={cmsSections.clubs?.description || "Club-club terbaik yang bertarung di arena Tarkam IDM"} />
            </div>
          )}

            {/* ═══ Season Selector ═══ */}
            {seasonsForSelector.length > 1 && (
              <div className="stagger-item-fast mb-6 flex flex-col items-center gap-3" style={{ animationDelay: '30ms' }}>
                {/* Season Pills */}
                <div className="flex items-center gap-2">
                  {seasonsForSelector.map(season => {
                    const isActive = season.status === 'active';
                    const isCompleted = season.status === 'completed';
                    const isSelected = selectedSeasonId === null
                      ? isActive
                      : selectedSeasonId === season.id;

                    return (
                      <button
                        key={season.id}
                        onClick={() => {
                          if (isSelected && isActive) return;
                          setSelectedSeasonId(isActive ? null : season.id);
                        }}
                        className={`compact-pill
                          inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold
                          transition-all duration-200 cursor-pointer border
                          ${isSelected
                            ? 'bg-idm-gold-warm/15 border-idm-gold-warm/40 text-idm-gold-warm shadow-[0_0_12px_color-mix(in_srgb,var(--color-idm-gold-warm)_15%,transparent)]'
                            : 'bg-transparent border-idm-gold-warm/10 text-muted-foreground/70 hover:border-idm-gold-warm/25 hover:text-idm-gold-warm/60'
                          }
                        `}
                        aria-label={`Select ${season.name}`}
                        aria-pressed={isSelected}
                      >
                        <span className="font-black">S{season.number}</span>
                        {isActive && (
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                          </span>
                        )}
                        {isCompleted && (
                          <CheckCircle2 className="w-3 h-3 text-idm-gold-warm/60" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Historical Data Badge */}
                {isHistorical && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-idm-gold-warm/20 bg-idm-gold-warm/5">
                    <History className="w-3 h-3 text-idm-gold-warm/70" />
                    <span className="text-[10px] font-bold text-idm-gold-warm/70 uppercase tracking-wider">
                      Data Historis — Season {seasonsForSelector.find(s => s.id === selectedSeasonId)?.number || '?'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ═══ Tarkam Season Champion callout ═══ */}
            {seasonChampions.length > 0 && (
              <div className="stagger-item-fast mb-8" style={{ animationDelay: '60ms' }}>
                <div className="flex items-center justify-center">
                  <div className="relative inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-idm-gold-warm/15 bg-idm-gold-warm/5">
                    {/* Subtle inner glow */}
                    <div className="absolute inset-0 rounded-full pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 50%, color-mix(in srgb, var(--idm-gold-warm) 6%, transparent), transparent 70%)' }} />
                    <Crown className="w-3.5 h-3.5 text-idm-gold-warm relative" />
                    {(() => {
                      // Group champions by club id — merge male+female if same club won both
                      type Champ = typeof seasonChampions[number];
                      const grouped: Champ[][] = [];
                      for (const ch of seasonChampions) {
                        const existing = grouped.find(g => g[0].id === ch.id && g[0].seasonNumber === ch.seasonNumber);
                        if (existing) existing.push(ch);
                        else grouped.push([ch]);
                      }
                      return grouped.map((group, i) => {
                        const ch = group[0];
                        const divisions = group.map(g => g.division);
                        const label = divisions.length === 2
                          ? `♂♀ S${ch.seasonNumber} Champion`
                          : `${divisions[0] === 'female' ? '♀' : '♂'} S${ch.seasonNumber} Champion`;
                        return (
                          <span key={`${ch.id}-${group.map(g => g.division).join('-')}-S${ch.seasonNumber}`} className="flex items-center gap-2 relative">
                            {i > 0 && <span className="text-[10px] text-muted-foreground/40">•</span>}
                            <span className="text-[10px] font-bold text-idm-gold-warm/70 uppercase tracking-wider">
                              Tarkam {label}
                            </span>
                            {ch.logo && (
                              <ClubLogoImage clubName={ch.name} dbLogo={ch.logo} alt={ch.name} width={20} height={20} className="w-5 h-5 rounded object-cover" />
                            )}
                            <span className="text-xs font-black text-foreground">{ch.name}</span>
                          </span>
                        );
                      });
                    })()}
                    <span className="text-[10px] text-muted-foreground/40 relative">•</span>
                    <span className="text-[10px] text-muted-foreground/60 relative">{leaderboardClubs.length} club bertanding</span>
                  </div>
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {Array.from({ length: 10 }).map((_, i) => (
                  <CardSkeleton key={i} className="h-56" />
                ))}
              </div>
            ) : (() => {
              // Use unified leaderboard data from /api/clubs/leaderboard?type=tarkam
              // This combines points from both divisions (male + female)
              const sortedClubs = leaderboardClubs;

              return (
                <>
                  {sortedClubs.length === 0 ? (
                    <div className="text-center py-12">
                      <Swords className="w-12 h-12 text-idm-gold-warm/20 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground/50">Belum ada data club tersedia</p>
                    </div>
                  ) : (
                    <>
                      {/* Club Leaderboard Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {(showAllClubs ? sortedClubs : sortedClubs.slice(0, 10)).map((club, idx) => {
                          const isChampion = seasonChampions.some(ch => ch.name === club.name);
                          const maleMembers = club.maleMemberCount || 0;
                          const femaleMembers = club.femaleMemberCount || 0;
                          const hiddenOnMobile = !showAllClubs && idx >= 6;
                          const rankBadge = getRankBadge(club.rank);
                          return (
                            <div
                              key={club.id}
                              className={`stagger-item-fast cursor-pointer group/club ${hiddenOnMobile ? 'hidden sm:block' : ''}`}
                              style={{ animationDelay: `${idx * 30}ms` }}
                              onClick={() => setSelectedClub({
                                id: club.id,
                                name: club.name,
                                logo: club.logo,
                                bannerImage: club.bannerImage,
                                wins: club.wins,
                                losses: club.losses,
                                points: club.points,
                                gameDiff: club.gameDiff,
                                _count: { members: club.memberCount },
                                malePoints: club.malePoints,
                                femalePoints: club.femalePoints,
                                rank: club.rank,
                                maleMemberCount: club.maleMemberCount,
                                femaleMemberCount: club.femaleMemberCount,
                              })}
                            >
                              <div className={`ios-club-card club-card-shimmer relative bg-mid text-center transition-all duration-300 overflow-hidden group-hover/club:shadow-[0_0_20px_color-mix(in_srgb,var(--idm-gold-warm)_10%,transparent)] group-hover/club:scale-[1.02] active:scale-[0.99] ${
                                isChampion ? 'border-idm-gold-warm/30 ios-card-featured' : ''
                              }`}>
                                {/* ── iOS Gold accent line at top ── */}
                                <div className="ios-gold-line" />

                                {/* ── Champion card inner glow ── */}
                                {isChampion && (
                                  <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 30%, color-mix(in srgb, var(--idm-gold-warm) 6%, transparent) 0%, transparent 60%)' }} />
                                )}

                                {/* ── Logo watermark background ── */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-[0.06] group-hover/club:opacity-[0.10] transition-opacity duration-500 pointer-events-none">
                                  <ClubLogoImage clubName={club.name} dbLogo={club.logo} alt="" width={200} height={200} className="w-[80%] h-auto aspect-square object-contain" />
                                </div>

                                {/* ── Rank Badge (Top-right) ── */}
                                {rankBadge && (
                                  <div className="absolute top-2 right-2 z-20">
                                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm border ${rankBadge.bg}`}>
                                      {rankBadge.icon}
                                    </span>
                                  </div>
                                )}

                                {/* ── Card content ── */}
                                <div className="relative z-10 flex flex-col items-center px-4 pt-8 pb-5">
                                  {/* Large centered logo with glow ring */}
                                  <div className="relative mb-4">
                                    {/* Outer glow ring — single layer for performance */}
                                    <div className="absolute -inset-1.5 rounded-3xl transition-all duration-500" style={{
                                      background: isChampion
                                        ? 'linear-gradient(135deg, color-mix(in srgb, var(--idm-gold-warm) 30%, transparent), color-mix(in srgb, var(--idm-gold-warm) 8%, transparent))'
                                        : 'linear-gradient(135deg, color-mix(in srgb, var(--idm-gold-warm) 12%, transparent), color-mix(in srgb, var(--idm-gold-warm) 3%, transparent))',
                                      boxShadow: isChampion
                                        ? '0 0 20px color-mix(in srgb, var(--idm-gold-warm) 20%, transparent)'
                                        : '0 0 10px color-mix(in srgb, var(--idm-gold-warm) 8%, transparent)',
                                    }} />
                                    {/* Logo container */}
                                    <div className="club-logo-container relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl overflow-hidden bg-mid border-2 border-idm-gold-warm/20 flex items-center justify-center group-hover/club:scale-105 group-hover/club:border-idm-gold-warm/40 transition-all duration-500">
                                      <ClubLogoImage clubName={club.name} dbLogo={club.logo} alt={club.name} fill sizes="96px" className="object-cover" />
                                    </div>
                                    {/* Season champion badge */}
                                    {isChampion && (
                                      <div className="absolute -top-2 -right-2 z-20 min-w-[24px] h-[24px] rounded-full flex items-center justify-center border-2 border-mid" style={{
                                        background: 'var(--idm-gold)',
                                        boxShadow: '0 0 12px color-mix(in srgb, var(--idm-gold-warm) 40%, transparent)',
                                      }}>
                                        <Crown className="w-2.5 h-2.5 text-mid" />
                                      </div>
                                    )}
                                  </div>

                                  {/* Club name */}
                                  <p className={`text-sm font-black truncate max-w-full transition-colors duration-200 ios-heading ${
                                    isChampion ? 'text-idm-gold-warm dark:text-[#EFF923]' : 'text-foreground dark:text-white group-hover/club:text-idm-gold-warm'
                                  }`}>{club.name}</p>

                                  {/* Champion label */}
                                  {isChampion && (
                                    <div className="mt-1 flex items-center gap-1">
                                      <Star className="w-2.5 h-2.5 text-idm-gold-warm/60" />
                                      <span className="text-[9px] font-bold text-idm-gold-warm/60 uppercase tracking-wider">Champion S{seasonChampions.find(ch => ch.name === club.name)?.seasonNumber ?? 1}</span>
                                    </div>
                                  )}

                                  {/* Rank badge for non-top-3 */}
                                  {club.rank > 3 && (
                                    <div className="mt-1">
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-idm-gold-warm/10 text-idm-gold-warm border border-idm-gold-warm/15">
                                        #{club.rank}
                                      </span>
                                    </div>
                                  )}

                                  {/* Division badges */}
                                  <div className="flex items-center justify-center gap-1.5 mt-2.5">
                                    {maleMembers > 0 && (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-idm-male/10 text-idm-male-light dark:text-[#57B5FF] border border-idm-male/15">
                                        <Music className="w-2.5 h-2.5" />{maleMembers} Cowo
                                      </span>
                                    )}
                                    {femaleMembers > 0 && (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-idm-female/10 text-idm-female-light dark:text-[#FF5C9A] border border-idm-female/15">
                                        <Shield className="w-2.5 h-2.5" />{femaleMembers} Cewe
                                      </span>
                                    )}
                                  </div>

                                  {/* Member count & Total Tarkam Points */}
                                  <div className="mt-2 flex items-center justify-center gap-3">
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-idm-gold-warm/5 border border-idm-gold-warm/10">
                                      <Users className="w-3 h-3 text-idm-gold-warm/50" />
                                      <span className="text-[10px] text-idm-gold-warm/70 font-semibold">{club.memberCount || 0}</span>
                                    </div>
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-idm-gold-warm/5 border border-idm-gold-warm/10">
                                      <Trophy className="w-3 h-3 text-idm-gold-warm/50" />
                                      <span className="text-[10px] text-idm-gold-warm/70 font-bold">{club.points.toLocaleString('id-ID')} pts</span>
                                    </div>
                                  </div>

                                  {/* ── Per-division points breakdown ── */}
                                  {(club.malePoints > 0 || club.femalePoints > 0) && (
                                    <div className="mt-2 flex items-center justify-center gap-2">
                                      {club.malePoints > 0 && (
                                        <span className="text-[9px] font-bold text-idm-male-light dark:text-[#57B5FF]/70">
                                          ♂ {club.malePoints.toLocaleString('id-ID')}
                                        </span>
                                      )}
                                      {club.malePoints > 0 && club.femalePoints > 0 && (
                                        <span className="text-[9px] text-muted-foreground/30">+</span>
                                      )}
                                      {club.femalePoints > 0 && (
                                        <span className="text-[9px] font-bold text-idm-female-light dark:text-[#FF5C9A]/70">
                                          ♀ {club.femalePoints.toLocaleString('id-ID')}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* ── Bottom accent line (subtle) ── */}
                                <div className="absolute bottom-0 left-[15%] right-[15%] h-px opacity-0 group-hover/club:opacity-100 transition-opacity duration-500" style={{ background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--idm-gold-warm) 20%, transparent), transparent)' }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Show More/Less Button */}
                      {sortedClubs.length > 6 && (
                        <div className="flex justify-center mt-8">
                          <button
                            onClick={() => setShowAllClubs(!showAllClubs)}
                            className="compact-pill relative inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-idm-gold-warm/20 bg-idm-gold-warm/5 text-idm-gold-warm text-xs font-semibold transition-all duration-300 hover:bg-idm-gold-warm/10 hover:border-idm-gold-warm/30 hover:shadow-[0_0_20px_color-mix(in_srgb,var(--color-idm-gold-warm)_10%,transparent)] cursor-pointer"
                          >
                            {showAllClubs ? (
                              <>
                                <ChevronUp className="w-4 h-4" />
                                Tampilkan Lebih Sedikit
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-4 h-4" />
                                Lihat Semua ({sortedClubs.length} Club)
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              );
            })()}
        </div>
      </section>
  </>);
}
