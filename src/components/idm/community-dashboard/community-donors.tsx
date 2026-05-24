'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, HandCoins, Sparkles } from 'lucide-react';
import { useCommunityTheme } from '@/hooks/use-community-theme';
import { formatCurrencyShort } from '@/lib/utils';
import { getSawerTier } from '@/lib/skin-utils';
import type { StatsData, TopDonor, SultanOfWeekly } from '@/types/stats';

/* ═══════════════════════════════════════════════════════
   COMMUNITY DONORS — Top donor/supporter community leaderboard
   ═══════════════════════════════════════════════════════ */
interface CommunityDonorsProps {
  maleData?: StatsData;
  femaleData?: StatsData;
  onSawer?: () => void;
}

/** Enriched donor with per-division breakdown */
interface DivisionDonor extends TopDonor {
  maleAmount: number;
  femaleAmount: number;
  divisions: ('male' | 'female')[];
  player?: TopDonor['player'];
}

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

function getInitials(name: string): string {
  return name
    .split(/[\s_]+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/** Compact Rupiah — e.g. "10K", "150K", "1.5jt" */
function formatRupiahShort(amount: number): string {
  if (amount === 0) return 'Rp0';
  if (amount >= 1_000_000) return `Rp${(amount / 1_000_000).toFixed(1).replace('.0', '')}jt`;
  if (amount >= 100_000) return `Rp${(amount / 1000).toFixed(0)}K`;
  if (amount >= 10_000) return `Rp${(amount / 1000).toFixed(0)}K`;
  return `Rp${amount.toLocaleString('id-ID')}`;
}

/** Division badge — color-coded male/female */
function DivisionBadge({ division }: { division: 'male' | 'female' }) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0 rounded text-[8px] font-bold uppercase tracking-wider border ${
        division === 'male'
          ? 'bg-idm-male/10 text-idm-male-light border-idm-male/30'
          : 'bg-idm-female/10 text-idm-female-light border-idm-female/30'
      }`}
    >
      {division === 'male' ? '♂ M' : '♀ F'}
    </span>
  );
}

export function CommunityDonors({ maleData, femaleData, onSawer }: CommunityDonorsProps) {
  const dt = useCommunityTheme();
  const [timeRange, setTimeRange] = useState<'season' | 'week'>('season');

  // Pre-compute both datasets
  const { seasonDonors, weekDonors, weekNumber, weekLabel } = useMemo(() => {
    const donorMap = new Map<string, { donorName: string; totalAmount: number; donationCount: number; maleAmount: number; femaleAmount: number; player?: TopDonor['player'] }>();

    const mergeDonors = (donors: TopDonor[], division: 'male' | 'female') => {
      for (const d of donors) {
        const key = d.donorName.toLowerCase().trim();
        const existing = donorMap.get(key);
        if (existing) {
          donorMap.set(key, {
            donorName: d.donorName,
            totalAmount: existing.totalAmount + d.totalAmount,
            donationCount: existing.donationCount + d.donationCount,
            maleAmount: existing.maleAmount + (division === 'male' ? d.totalAmount : 0),
            femaleAmount: existing.femaleAmount + (division === 'female' ? d.totalAmount : 0),
            player: existing.player || d.player,
          });
        } else {
          donorMap.set(key, {
            donorName: d.donorName,
            totalAmount: d.totalAmount,
            donationCount: d.donationCount,
            maleAmount: division === 'male' ? d.totalAmount : 0,
            femaleAmount: division === 'female' ? d.totalAmount : 0,
            player: d.player,
          });
        }
      }
    };

    // Season accumulated
    const seasonMap = new Map(donorMap);
    if (maleData?.topDonors?.length) mergeDonors(maleData.topDonors, 'male');
    if (femaleData?.topDonors?.length) mergeDonors(femaleData.topDonors, 'female');
    const seasonSorted = Array.from(seasonMap.values())
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .map(d => ({
        donorName: d.donorName, totalAmount: d.totalAmount, donationCount: d.donationCount,
        maleAmount: d.maleAmount, femaleAmount: d.femaleAmount,
        divisions: [...(d.maleAmount > 0 ? ['male' as const] : []), ...(d.femaleAmount > 0 ? ['female' as const] : [])],
        player: d.player,
      })).slice(0, 8);

    // Week: from sultanOfWeekly.allDonors
    const allSultans = [...(maleData?.sultanOfWeekly || []), ...(femaleData?.sultanOfWeekly || [])];
    const latestWeekNum = allSultans.length > 0 ? Math.max(...allSultans.map(s => s.weekNumber)) : 0;
    const weekMap = new Map<string, { donorName: string; totalAmount: number; donationCount: number; maleAmount: number; femaleAmount: number; player?: TopDonor['player'] }>();
    const mergeDonorList = (list: SultanOfWeekly['allDonors'], division: 'male' | 'female') => {
      if (!list?.length) return;
      for (const d of list) {
        const key = d.donorName.toLowerCase().trim();
        const existing = weekMap.get(key);
        if (existing) {
          weekMap.set(key, { donorName: d.donorName, totalAmount: existing.totalAmount + d.totalAmount, donationCount: existing.donationCount + d.donationCount, maleAmount: existing.maleAmount + (division === 'male' ? d.totalAmount : 0), femaleAmount: existing.femaleAmount + (division === 'female' ? d.totalAmount : 0), player: existing.player || d.player });
        } else {
          weekMap.set(key, { donorName: d.donorName, totalAmount: d.totalAmount, donationCount: d.donationCount, maleAmount: division === 'male' ? d.totalAmount : 0, femaleAmount: division === 'female' ? d.totalAmount : 0, player: d.player });
        }
      }
    };
    for (const sultan of allSultans) {
      if (sultan.weekNumber === latestWeekNum && sultan.allDonors?.length) {
        mergeDonorList(sultan.allDonors, sultan.tournamentDivision as 'male' | 'female');
      }
    }
    if (weekMap.size === 0) {
      if (maleData?.weeklyTopDonors?.length) mergeDonors(maleData.weeklyTopDonors, 'male');
      if (femaleData?.weeklyTopDonors?.length) mergeDonors(femaleData.weeklyTopDonors, 'female');
    }
    const weekSorted = Array.from(weekMap.values())
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .map(d => ({
        donorName: d.donorName, totalAmount: d.totalAmount, donationCount: d.donationCount,
        maleAmount: d.maleAmount, femaleAmount: d.femaleAmount,
        divisions: [...(d.maleAmount > 0 ? ['male' as const] : []), ...(d.femaleAmount > 0 ? ['female' as const] : [])],
        player: d.player,
      })).slice(0, 8);

    return {
      seasonDonors: seasonSorted,
      weekDonors: weekSorted,
      weekNumber: latestWeekNum || (maleData?.activeTournament?.weekNumber || femaleData?.activeTournament?.weekNumber || 0),
      weekLabel: latestWeekNum > 0 ? `Week ${latestWeekNum}` : 'Season',
    };
  }, [maleData, femaleData]);

  const activeDonors = timeRange === 'season' ? seasonDonors : weekDonors;
  const hasWeekDonors = weekDonors.length > 0;
  const currentLabel = timeRange === 'season' ? 'Season' : `Week ${weekNumber}`;

  const totalDonation = activeDonors.reduce((s, d) => s + d.totalAmount, 0);
  const totalMale = activeDonors.reduce((s, d) => s + d.maleAmount, 0);
  const totalFemale = activeDonors.reduce((s, d) => s + d.femaleAmount, 0);

  const maxAmount = activeDonors[0]?.totalAmount || 1;

  // Empty state
  if (seasonDonors.length === 0 && weekDonors.length === 0) {
    return (
      <Card className={`${dt.casinoCard} overflow-hidden`}>
        <div className={dt.casinoBar} />
        <CardContent className="p-6">
          <div className={`flex flex-col items-center justify-center py-8 ${dt.bgSubtle} rounded-2xl`}>
            <Heart className={`w-10 h-10 mb-3 opacity-30 ${dt.text}`} />
            <p className="text-sm text-muted-foreground font-medium">Belum ada donasi</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Jadilah yang pertama menyawer!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${dt.casinoCard} overflow-hidden`}>
      <div className={dt.casinoBar} />

      {/* Header */}
      <div className={`flex items-center gap-2.5 px-3 lg:px-6 py-3 border-b ${dt.borderSubtle}`}>
        <div className={`w-5 h-5 lg:w-6 lg:h-6 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
          <HandCoins className={`w-3 h-3 lg:w-3.5 lg:h-3.5 ${dt.neonText}`} />
        </div>
        <h3 className="text-xs lg:text-sm font-semibold uppercase tracking-wider">Top Saweran</h3>
        <Badge className={`hidden sm:inline-flex ${dt.casinoBadge} text-[9px]`}>{currentLabel}</Badge>
        {/* Time range toggle */}
        <div className="flex items-center gap-0.5 ml-auto p-0.5 rounded-full bg-idm-gold-warm/[0.06] border border-idm-gold-warm/10">
          <button
            onClick={() => setTimeRange('season')}
            className={`compact-pill px-2 py-1 rounded-full text-[8px] lg:text-[9px] font-bold transition-all cursor-pointer ${
              timeRange === 'season' ? 'bg-idm-gold-warm/15 text-idm-gold-warm' : 'text-muted-foreground/60 hover:text-idm-gold-warm/70'
            }`}
          >🏆 Season</button>
          <button
            onClick={() => setTimeRange('week')}
            disabled={!hasWeekDonors}
            className={`compact-pill px-2 py-1 rounded-full text-[8px] lg:text-[9px] font-bold transition-all cursor-pointer ${
              timeRange === 'week' ? 'bg-idm-gold-warm/15 text-idm-gold-warm' : !hasWeekDonors ? 'text-muted-foreground/30 cursor-not-allowed' : 'text-muted-foreground/60 hover:text-idm-gold-warm/70'
            }`}
          >📅 W{weekNumber || '?'}</button>
        </div>
      </div>

      <CardContent className="p-4 sm:p-6">
        {/* Total donation header with per-division breakdown */}
        <div className={`flex items-center justify-between mb-4 p-4 sm:p-5 rounded-2xl ${dt.bgSubtle} border ${dt.borderSubtle}`}>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Total Saweran {currentLabel} → Prize Pool</p>
            <p className={`text-lg font-black ${dt.neonGradient}`}>
              {formatCurrencyShort(totalDonation || 0)}
            </p>
            {/* Mobile: per-division breakdown under total on left */}
            <div className="flex sm:hidden items-center gap-3 mt-1">
              {totalMale > 0 && (
                <span className="text-[10px] text-idm-male-light/80">
                  ♂ Cowo {formatRupiahShort(totalMale)}
                </span>
              )}
              {totalFemale > 0 && (
                <span className="text-[10px] text-idm-female-light/80">
                  ♀ Cewe {formatRupiahShort(totalFemale)}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end">
            <Sparkles className={`w-5 h-5 ${dt.text} opacity-40`} />
            {/* Desktop: per-division breakdown on the right */}
            <div className="hidden sm:flex items-center gap-2 mt-1">
              {totalMale > 0 && (
                <span className="text-[10px] text-idm-male-light/80">
                  ♂ {formatRupiahShort(totalMale)}
                </span>
              )}
              {totalFemale > 0 && (
                <span className="text-[10px] text-idm-female-light/80">
                  ♀ {formatRupiahShort(totalFemale)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Donor rows — Mobile: no inner scroll. Desktop: max-height with scroll */}
        <div className="space-y-2 sm:max-h-96 sm:overflow-y-auto custom-scrollbar">
          {activeDonors.map((donor, i) => {
            const progress = Math.max(5, (donor.totalAmount / maxAmount) * 100);
            const medal = RANK_MEDALS[i] || null;

            return (
              <div
                key={donor.donorName}
                className="group p-3 sm:p-4 rounded-2xl transition-colors duration-200 animate-fade-enter-sm"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {/* Row 1: Rank + Avatar + Name + Division Badges + Tier + Total */}
                <div className="flex items-center gap-2.5">
                  {/* Rank */}
                  <span className="w-6 text-center text-sm shrink-0">
                    {medal || <span className="text-xs text-muted-foreground font-bold">{i + 1}</span>}
                  </span>

                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-lg overflow-hidden shrink-0 ${!donor.player?.avatar ? dt.iconBg : ''}`} style={donor.player?.avatar ? { border: '1.5px solid rgba(249,203,37,0.3)' } : {}}>
                    {donor.player?.avatar ? (
                      <img
                        src={donor.player.avatar}
                        alt={donor.donorName}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className={`text-[10px] font-bold ${dt.text}`}>{getInitials(donor.donorName)}</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      {/* #1 Crown emoji badge */}
                      {i === 0 && (
                        <span className="text-sm shrink-0" title="Top Saweran">👑</span>
                      )}
                      <span className={`text-sm font-semibold truncate ${
                        i === 0
                          ? 'text-idm-gold-warm donor-name-pulse-gold'
                          : 'donor-name-pulse'
                      }`}>{donor.donorName}</span>
                      {/* Division badges */}
                      {donor.divisions.map(div => (
                        <DivisionBadge key={div} division={div} />
                      ))}
                      {/* Sawer tier */}
                      {(() => {
                        const sawerTier = getSawerTier(donor.totalAmount);
                        if (!sawerTier) return null;
                        const tierColors: Record<string, { bg: string; border: string; text: string }> = {
                          sawer_diamond: { bg: 'rgba(87,181,255,0.15)', border: 'rgba(87,181,255,0.4)', text: 'text-idm-male-light' },
                          sawer_gold: { bg: 'rgba(250,204,21,0.15)', border: 'rgba(250,204,21,0.4)', text: 'text-idm-gold-warm' },
                          sawer_silver: { bg: 'rgba(156,163,175,0.15)', border: 'rgba(156,163,175,0.4)', text: 'text-muted-foreground' },
                          sawer_bronze: { bg: 'rgba(180,83,9,0.15)', border: 'rgba(180,83,9,0.4)', text: 'text-amber-400' },
                        };
                        const tc = tierColors[sawerTier] || tierColors.sawer_bronze;
                        const tierLabel = sawerTier.replace('sawer_', '').charAt(0).toUpperCase() + sawerTier.replace('sawer_', '').slice(1);
                        const tierEmoji = sawerTier === 'sawer_diamond' ? '💎' : sawerTier === 'sawer_gold' ? '🥇' : sawerTier === 'sawer_silver' ? '🥈' : '🥉';
                        return (
                          <span
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold shrink-0 border ${tc.text}`}
                            style={{ backgroundColor: tc.bg, borderColor: tc.border }}
                            title={`Sawer ${tierLabel}`}
                          >
                            {tierEmoji} {tierLabel}
                          </span>
                        );
                      })()}
                      {/* Total amount */}
                      <span className={`text-sm font-bold ${dt.neonGradient} shrink-0 ml-auto`}>
                        {formatCurrencyShort(donor.totalAmount)}
                      </span>
                    </div>
                    {/* Row 2: Per-division breakdown + progress bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        {/* Per-division amounts */}
                        <div className="flex items-center gap-2 mb-1">
                          {donor.maleAmount > 0 && (
                            <span className="text-[10px] text-idm-male-light/60">
                              ♂ {formatRupiahShort(donor.maleAmount)}
                            </span>
                          )}
                          {donor.femaleAmount > 0 && (
                            <span className="text-[10px] text-idm-female-light/60">
                              ♀ {formatRupiahShort(donor.femaleAmount)}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground/80">
                            {donor.donationCount}x sawer
                          </span>
                        </div>
                        {/* Progress bar */}
                        <div className={`h-1.5 rounded-full ${dt.casinoBar} overflow-hidden`}>
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${
                              i === 0
                                ? 'from-yellow-500 to-amber-400'
                                : i === 1
                                ? 'from-gray-300 to-gray-400'
                                : i === 2
                                ? 'from-amber-600 to-amber-500'
                                : 'from-idm-gold-warm/60 to-idm-gold-warm/40'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                      {/* Donation count badge */}
                      <Badge className={`text-[8px] shrink-0 ${dt.badgeBg} border`}>
                        {donor.donationCount}x
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sawer CTA */}
        <div className="mt-4">
          <button
            onClick={onSawer}
            className="w-full py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-idm-gold-warm to-[#e8d5a3] text-black hover:shadow-[0_0_20px_rgba(249,203,37,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer min-h-[36px]"
          >
            💰 Sawer Sekarang
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
