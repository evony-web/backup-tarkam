'use client';

import { useQuery } from '@tanstack/react-query';
import { Heart, Gift, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { formatCurrency } from '@/lib/utils';
import { getSawerTier } from '@/lib/skin-utils';
import React, { useMemo } from 'react';

/* ─── Types ─── */
interface TopDonor {
  donorName: string;
  totalAmount: number;
  donationCount: number;
  latestType: string;
  latestDate: string | null;
}

/** Enriched donor with per-division breakdown */
interface DivisionDonor {
  donorName: string;
  totalAmount: number;
  donationCount: number;
  latestType: string;
  latestDate: string | null;
  maleAmount: number;
  femaleAmount: number;
  divisions: ('male' | 'female')[];
}

interface TopDonorsData {
  donors: TopDonor[];
  summary: {
    totalAmount: number;
    totalDonors: number;
    totalDonations: number;
  };
}

interface TopDonorsWidgetProps {
  onDonate: () => void;
  /** If provided, uses weeklyTopDonors from stats (per active tournament) instead of all-time API */
  statsData?: import('@/types/stats').StatsData;
  /** Second division stats data — donors from both divisions will be merged */
  statsData2?: import('@/types/stats').StatsData;
}

/* ─── Helpers ─── */

/** Format Indonesian Rupiah — compact for widget display */
function formatRupiah(amount: number): string {
  return formatCurrency(amount);
}

/** Compact Rupiah — e.g. "10K", "150K", "1.5jt" */
function formatRupiahShort(amount: number): string {
  if (amount === 0) return 'Rp0';
  if (amount >= 1_000_000) return `Rp${(amount / 1_000_000).toFixed(1).replace('.0', '')}jt`;
  if (amount >= 100_000) return `Rp${(amount / 1000).toFixed(0)}K`;
  if (amount >= 10_000) return `Rp${(amount / 1000).toFixed(0)}K`;
  return `Rp${amount.toLocaleString('id-ID')}`;
}

/** Relative time in Indonesian */
function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Baru saja';
  if (diffMinutes < 60) return `${diffMinutes} menit lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  if (diffDays < 30) return `${diffDays} hari lalu`;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

/** Rank badge component — numbered with gold/silver/bronze colors */
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-sm">
        <span className="text-[10px] font-black text-yellow-900">1</span>
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center shadow-sm">
        <span className="text-[10px] font-black text-gray-700">2</span>
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center shadow-sm">
        <span className="text-[10px] font-black text-amber-200">3</span>
      </div>
    );
  }
  return (
    <div className="w-6 h-6 rounded-full bg-muted/50 flex items-center justify-center text-[10px] font-bold text-muted-foreground">
      {rank}
    </div>
  );
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

/* ─── Sub-components ─── */

function LoadingSkeleton() {
  return (
    <Card className="overflow-hidden relative glassmorphism-donor-card h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-5 w-20 rounded" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-3 w-16 rounded" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 p-3 rounded-lg">
              <Skeleton className="w-6 h-6 rounded-full shrink-0" />
              <Skeleton className="h-3 w-20 rounded flex-1" />
              <Skeleton className="h-3 w-16 rounded" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyDonorsState({ onDonate }: { onDonate: () => void }) {
  const dt = useDivisionTheme();

  return (
    <Card className="overflow-hidden relative glassmorphism-donor-card h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <Heart className="w-4 h-4 text-idm-gold-warm" />
          Top Saweran
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center justify-center py-6 text-center donor-empty-state">
          <div className="relative inline-flex items-center justify-center mb-3">
            <div className="empty-glow-ring absolute inset-0 rounded-full bg-idm-gold-warm/10" />
            <div className="empty-icon-float relative z-10">
              <Heart className="w-8 h-8 text-idm-gold-warm/40" />
            </div>
          </div>
          <p className="text-xs font-semibold text-muted-foreground/70 mb-1">
            Belum ada penyawer
          </p>
          <p className="text-[10px] text-muted-foreground/50 mb-3">
            Jadilah yang pertama menyawer prize pool!
          </p>
          <Button
            size="sm"
            onClick={onDonate}
            className={`h-7 text-[10px] font-bold bg-gradient-to-r from-idm-gold-warm to-[#e8d5a3] text-black hover:opacity-90 transition-opacity ${dt.neonPulse}`}
          >
            <Gift className="w-3 h-3 mr-1" />
            Sawer Sekarang
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Main Component ─── */

export const TopDonorsWidget = React.memo(function TopDonorsWidget({ onDonate, statsData, statsData2 }: TopDonorsWidgetProps) {
  const dt = useDivisionTheme();

  // Fallback: all-time API data (only used if no statsData provided)
  const { data, isLoading } = useQuery<TopDonorsData>({
    queryKey: ['top-donors'],
    queryFn: async () => {
      const res = await fetch('/api/donations/top-donors');
      if (!res.ok) throw new Error('Failed to fetch top donors');
      return res.json();
    },
    staleTime: 30000,
    enabled: !statsData?.topDonors?.length && !statsData2?.topDonors?.length,
  });

  // Memoize entire donor pipeline — SEASON-ACCUMULATED for overall leaderboard
  const { allDonors, maleDonors, femaleDonors, totalMale, totalFemale, totalAmount } = useMemo(() => {
    const donorMap = new Map<string, { donorName: string; totalAmount: number; donationCount: number; maleAmount: number; femaleAmount: number }>();

    const mergeDonors = (donors: import('@/types/stats').TopDonor[], division: 'male' | 'female') => {
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
          });
        } else {
          donorMap.set(key, {
            donorName: d.donorName,
            totalAmount: d.totalAmount,
            donationCount: d.donationCount,
            maleAmount: division === 'male' ? d.totalAmount : 0,
            femaleAmount: division === 'female' ? d.totalAmount : 0,
          });
        }
      }
    };

    // Use season-accumulated topDonors for the overall leaderboard
    if (statsData?.topDonors?.length) mergeDonors(statsData.topDonors, (statsData.activeTournament?.division || 'male') as 'male' | 'female');
    if (statsData2?.topDonors?.length) mergeDonors(statsData2.topDonors, (statsData2.activeTournament?.division || 'female') as 'male' | 'female');

    let allDonors: DivisionDonor[];

    if (donorMap.size > 0) {
      allDonors = Array.from(donorMap.values())
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .map(d => ({
          donorName: d.donorName,
          totalAmount: d.totalAmount,
          donationCount: d.donationCount,
          latestType: 'season',
          latestDate: null as string | null,
          maleAmount: d.maleAmount,
          femaleAmount: d.femaleAmount,
          divisions: [
            ...(d.maleAmount > 0 ? ['male' as const] : []),
            ...(d.femaleAmount > 0 ? ['female' as const] : []),
          ],
        }));
    } else {
      allDonors = (data?.donors ?? []).map(d => ({
        ...d,
        maleAmount: d.totalAmount,
        femaleAmount: 0,
        divisions: ['male' as const],
      }));
    }

    // Split donors per division
    const maleDonors = allDonors.filter(d => d.maleAmount > 0).sort((a, b) => b.maleAmount - a.maleAmount);
    const femaleDonors = allDonors.filter(d => d.femaleAmount > 0).sort((a, b) => b.femaleAmount - a.femaleAmount);

    // Calculate totals per division
    const totalMale = maleDonors.reduce((s, d) => s + d.maleAmount, 0);
    const totalFemale = femaleDonors.reduce((s, d) => s + d.femaleAmount, 0);
    const totalAmount = totalMale + totalFemale;

    return { allDonors, maleDonors, femaleDonors, totalMale, totalFemale, totalAmount };
  }, [statsData, statsData2, data]);

  // Memoize week label — always "Season" for leaderboard
  const weekLabel = useMemo(() => 'Season', []);

  // Early returns — AFTER all hooks (rules of hooks)
  if (isLoading && !statsData?.topDonors?.length && !statsData2?.topDonors?.length) return <LoadingSkeleton />;
  if (allDonors.length === 0) return <EmptyDonorsState onDonate={onDonate} />;

  return (
    <Card className="overflow-hidden relative glassmorphism-donor-card h-full flex flex-col">
      {/* Gold accent top bar */}
      <div className="h-0.5 bg-gradient-to-r from-transparent via-idm-gold-warm to-transparent opacity-60" />

      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
          <Heart className="w-4 h-4 text-idm-gold-warm" />
          <span>Top Saweran</span>
          {weekLabel && <Badge className="text-[8px] px-1.5 py-0 h-4 bg-idm-gold-warm/15 text-idm-gold-warm border-0 font-semibold">{weekLabel}</Badge>}
          {totalAmount > 0 && (
            <span className="text-sm font-black tabular-nums tracking-tight ml-1" style={{
              background: 'linear-gradient(135deg, #FAF0DC 0%, #EFF923 30%, #F9CB25 60%, #D69E2E 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              {formatRupiah(totalAmount)}
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Two-column layout: Male left, Female right */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* ♂ Male Division */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border bg-idm-male/10 text-idm-male-light border-idm-male/30">
                ♂ Cowo
              </span>
              <span className="text-[9px] text-muted-foreground/80">{maleDonors.length} sawer</span>
            </div>
            <div className="max-h-64 overflow-y-auto overflow-x-hidden custom-scrollbar space-y-1 pr-1">
              {maleDonors.length > 0 ? maleDonors.map((donor, i) => (
                <div
                  key={`male-${donor.donorName}`}
                  className={`donor-row-enter p-2 rounded-lg hover:bg-idm-male/5 transition-colors group`}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="flex items-center gap-1.5">
                    <RankBadge rank={i + 1} />
                    <span className={`text-[13px] font-semibold truncate flex-1 ${
                      i === 0 ? 'text-idm-gold-warm' : 'text-muted-foreground'
                    }`}>
                      {i === 0 && <span className="mr-0.5">👑</span>}
                      <span className={i === 0 ? 'donor-name-pulse-gold' : ''}>{donor.donorName || 'Anonymous'}</span>
                    </span>
                    <span className={`text-[11px] font-bold shrink-0 ${i === 0 ? 'donor-name-pulse-gold text-idm-gold-warm' : 'text-idm-gold-warm'}`}>
                      {formatRupiahShort(donor.maleAmount)}
                    </span>
                  </div>
                </div>
              )) : (
                <div className="py-4 text-center opacity-40">
                  <p className="text-[11px] text-muted-foreground">Belum ada saweran</p>
                </div>
              )}
            </div>
            {totalMale > 0 && (
              <div className="flex items-center justify-end pt-1 border-t border-idm-male/10">
                <span className="text-xs font-bold text-idm-male-light/90">
                  {formatRupiahShort(totalMale)}
                </span>
              </div>
            )}
          </div>

          {/* ♀ Female Division */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border bg-idm-female/10 text-idm-female-light border-idm-female/30">
                ♀ Cewe
              </span>
              <span className="text-[9px] text-muted-foreground/80">{femaleDonors.length} sawer</span>
            </div>
            <div className="max-h-64 overflow-y-auto overflow-x-hidden custom-scrollbar space-y-1 pr-1">
              {femaleDonors.length > 0 ? femaleDonors.map((donor, i) => (
                <div
                  key={`female-${donor.donorName}`}
                  className={`donor-row-enter p-2 rounded-lg hover:bg-idm-female/5 transition-colors group`}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="flex items-center gap-1.5">
                    <RankBadge rank={i + 1} />
                    <span className={`text-[13px] font-semibold truncate flex-1 ${
                      i === 0 ? 'text-idm-gold-warm' : 'text-muted-foreground'
                    }`}>
                      {i === 0 && <span className="mr-0.5">👑</span>}
                      <span className={i === 0 ? 'donor-name-pulse-gold' : ''}>{donor.donorName || 'Anonymous'}</span>
                    </span>
                    <span className={`text-[11px] font-bold shrink-0 ${i === 0 ? 'donor-name-pulse-gold text-idm-gold-warm' : 'text-idm-gold-warm'}`}>
                      {formatRupiahShort(donor.femaleAmount)}
                    </span>
                  </div>
                </div>
              )) : (
                <div className="py-4 text-center opacity-40">
                  <p className="text-[11px] text-muted-foreground">Belum ada saweran</p>
                </div>
              )}
            </div>
            {totalFemale > 0 && (
              <div className="flex items-center justify-end pt-1 border-t border-idm-female/10">
                <span className="text-xs font-bold text-idm-female-light/90">
                  {formatRupiahShort(totalFemale)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* CTA button — compact & centered */}
        <div className="mt-3 flex justify-center">
          <Button
            size="sm"
            onClick={onDonate}
            className={`h-7 text-[10px] font-bold bg-gradient-to-r from-idm-gold-warm to-[#e8d5a3] text-black hover:opacity-90 transition-opacity cursor-pointer ${dt.neonPulse}`}
          >
            <Gift className="w-3 h-3 mr-1" />
            Sawer Sekarang
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});
