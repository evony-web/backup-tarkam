'use client';

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GitCompareArrows, Trophy, Users, Crown } from 'lucide-react';
import { useCommunityTheme } from '@/hooks/use-community-theme';
import { getAvatarUrl, formatTarkamSeasonName } from '@/lib/utils';
import Image from 'next/image';
import type { StatsData, SeasonInfo } from '@/types/stats';

/* ═══════════════════════════════════════════════════════
   SEASON COMPARISON — Compare stats between seasons (S1 vs S2)
   ═══════════════════════════════════════════════════════ */
interface SeasonComparisonProps {
  maleData?: StatsData;
  femaleData?: StatsData;
}

interface SeasonStats {
  label: string;
  number: number;
  totalPlayers: number;
  matchCount: number;
  topPoints: number;
  championName: string | null;
  championAvatar?: string | null;
  championGamertag?: string;
}

function ComparisonBar({
  leftValue,
  rightValue,
  leftLabel,
  rightLabel,
  icon: Icon,
  colorLeft = 'from-idm-gold-warm to-amber-500',
  colorRight = 'from-idm-gold-warm/60 to-amber-500/60',
}: {
  leftValue: number;
  rightValue: number;
  leftLabel: string;
  rightLabel: string;
  icon: typeof Users;
  colorLeft?: string;
  colorRight?: string;
}) {
  const maxVal = Math.max(leftValue, rightValue, 1);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold">{leftLabel}</span>
            <span className="text-[10px] font-bold text-muted-foreground">{rightLabel}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-2 rounded-full bg-muted/20 overflow-hidden flex justify-end">
              <div
                className={`h-full rounded-full bg-gradient-to-l ${colorLeft}`}
                style={{ width: `${Math.max(8, (leftValue / maxVal) * 100)}%` }}
              />
            </div>
            <div className="w-px h-3 bg-border/30" />
            <div className="flex-1 h-2 rounded-full bg-muted/20 overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${colorRight}`}
                style={{ width: `${Math.max(8, (rightValue / maxVal) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Transform season name: uses shared formatTarkamSeasonName ── */
const formatSeasonName = formatTarkamSeasonName;

export function SeasonComparison({ maleData, femaleData }: SeasonComparisonProps) {
  const dt = useCommunityTheme();

  const { allSeasons, seasonStats } = useMemo(() => {
    // Collect seasons from both divisions
    const seasonMap = new Map<string, SeasonInfo>();

    const addSeasons = (seasons: SeasonInfo[]) => {
      for (const s of seasons) {
        if (!seasonMap.has(s.id)) {
          seasonMap.set(s.id, s);
        }
      }
    };

    if (maleData?.allSeasons) addSeasons(maleData.allSeasons);
    if (femaleData?.allSeasons) addSeasons(femaleData.allSeasons);

    const sorted = Array.from(seasonMap.values()).sort((a, b) => a.number - b.number);

    // Build stats for each season
    const buildStats = (season: SeasonInfo): SeasonStats => {
      // Count players & matches from data for this season
      let totalPlayers = 0;
      let matchCount = 0;
      let topPoints = 0;

      for (const data of [maleData, femaleData]) {
        if (data?.season?.id === season.id) {
          totalPlayers += data.totalPlayers || 0;
          matchCount += data.recentMatches?.length || 0;
          topPoints = Math.max(topPoints, data.topPlayers?.[0]?.points || 0);
        }
      }

      return {
        label: formatSeasonName(season.name),
        number: season.number,
        totalPlayers,
        matchCount,
        topPoints,
        championName: season.championPlayer?.gamertag || null,
        championAvatar: season.championPlayer?.avatar || null,
        championGamertag: season.championPlayer?.gamertag || undefined,
      };
    };

    const stats = sorted.map(buildStats);

    return { allSeasons: sorted, seasonStats: stats };
  }, [maleData, femaleData]);

  // Only 1 season — show teaser
  if (allSeasons.length <= 1) {
    return (
      <div className="animate-fade-enter">
        <Card className={`${dt.casinoCard} overflow-hidden`}>
          <div className={dt.casinoBar} />
          <CardContent className="p-6">
            <div className={`flex items-center gap-2.5 mb-4`}>
              <div className={`w-5 h-5 lg:w-6 lg:h-6 rounded ${dt.iconBg} flex items-center justify-center`}>
                <GitCompareArrows className={`w-3 h-3 lg:w-3.5 lg:h-3.5 ${dt.neonText}`} />
              </div>
              <h3 className="text-xs lg:text-sm font-semibold uppercase tracking-wider">Perbandingan Season</h3>
            </div>

            <div className={`p-5 rounded-2xl ${dt.bgSubtle} border ${dt.borderSubtle} text-center`}>
              <Crown className={`w-8 h-8 mx-auto mb-2 opacity-40 ${dt.text}`} />
              <p className="text-sm font-semibold mb-1">Season ini vs Musim Depan</p>
              <p className="text-xs text-muted-foreground">
                Perbandingan akan tersedia setelah Season 2 dimulai
              </p>
              <Badge className={`mt-3 ${dt.casinoBadge} text-[9px]`}>SEASON {allSeasons[0]?.number || 1} BERJALAN</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 2+ seasons — show comparison
  const s1 = seasonStats[0];
  const s2 = seasonStats[1];

  return (
    <div className="animate-fade-enter">
      <Card className={`${dt.casinoCard} overflow-hidden`}>
        <div className={dt.casinoBar} />

        {/* Header */}
        <div className={`flex items-center gap-2.5 px-3 lg:px-6 py-3 border-b ${dt.borderSubtle}`}>
          <div className={`w-5 h-5 lg:w-6 lg:h-6 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
            <GitCompareArrows className={`w-3 h-3 lg:w-3.5 lg:h-3.5 ${dt.neonText}`} />
          </div>
          <h3 className="text-xs lg:text-sm font-semibold uppercase tracking-wider">Perbandingan Season</h3>
          <Badge className={`ml-auto ${dt.casinoBadge} text-[9px]`}>VS</Badge>
        </div>

        <CardContent className="p-4 sm:p-6">
          {/* Season labels */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Badge className="bg-yellow-500/15 text-yellow-500 border-yellow-500/30 text-[10px] border font-bold">
                S{s1.number}
              </Badge>
              <span className="text-xs font-semibold truncate max-w-[100px]">{s1.label}</span>
            </div>
            <div className="text-[9px] text-muted-foreground font-bold">VS</div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold truncate max-w-[100px]">{s2.label}</span>
              <Badge className="bg-idm-gold-warm/15 text-idm-gold-warm border-idm-gold-warm/30 text-[10px] border font-bold">
                S{s2.number}
              </Badge>
            </div>
          </div>

          {/* Comparison bars */}
          <div className="space-y-4">
            <ComparisonBar
              leftValue={s1.totalPlayers}
              rightValue={s2.totalPlayers}
              leftLabel={`${s1.totalPlayers}`}
              rightLabel={`${s2.totalPlayers}`}
              icon={Users}
            />
            <ComparisonBar
              leftValue={s1.matchCount}
              rightValue={s2.matchCount}
              leftLabel={`${s1.matchCount}`}
              rightLabel={`${s2.matchCount}`}
              icon={Trophy}
              colorLeft="from-cyan-500 to-blue-400"
              colorRight="from-cyan-500/60 to-blue-400/60"
            />
            <ComparisonBar
              leftValue={s1.topPoints}
              rightValue={s2.topPoints}
              leftLabel={`${s1.topPoints}`}
              rightLabel={`${s2.topPoints}`}
              icon={Trophy}
              colorLeft="from-purple-500 to-pink-400"
              colorRight="from-purple-500/60 to-pink-400/60"
            />
          </div>

          {/* Champion comparison */}
          <div className={`mt-4 p-4 sm:p-5 rounded-2xl ${dt.bgSubtle} border ${dt.borderSubtle}`}>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5">
              <Crown className="w-3 h-3" /> Juara Tarkam
            </p>
            <div className="grid grid-cols-2 gap-3">
              {/* S1 Champion */}
              <div className="flex items-center gap-2">
                {s1.championGamertag ? (
                  <>
                    <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 ring-1 ring-yellow-500/20">
                      <Image
                        src={getAvatarUrl(s1.championGamertag, 'male', s1.championAvatar)}
                        alt={s1.championName || ''}
                        width={28}
                        height={28}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="text-[11px] font-semibold truncate">{s1.championName}</span>
                  </>
                ) : (
                  <span className="text-[10px] text-muted-foreground italic">—</span>
                )}
              </div>
              {/* S2 Champion */}
              <div className="flex items-center gap-2 justify-end">
                {s2.championGamertag ? (
                  <>
                    <span className="text-[11px] font-semibold truncate">{s2.championName}</span>
                    <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 ring-1 ring-idm-gold-warm/20">
                      <Image
                        src={getAvatarUrl(s2.championGamertag, 'female', s2.championAvatar)}
                        alt={s2.championName || ''}
                        width={28}
                        height={28}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </>
                ) : (
                  <span className="text-[10px] text-muted-foreground italic">—</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
