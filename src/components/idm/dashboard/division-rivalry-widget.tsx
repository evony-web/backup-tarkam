'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Swords, Trophy, Flame, Crown, TrendingUp, Zap, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDivisionTheme, getDivisionTheme } from '@/hooks/use-division-theme';
import { useAppStore } from '@/lib/store';
import { getAvatarUrl } from '@/lib/utils';
import { AvatarMedia } from '@/components/ui/avatar-media';

/* ========== Types ========== */
interface RivalPlayer {
  id: string;
  gamertag: string;
  avatar: string | null;
  tier: string;
  points: number;
  totalWins: number;
  totalMvp: number;
  streak: number;
  maxStreak: number;
  matches: number;
  club: { name: string; logo: string | null } | null;
}

interface RivalryData {
  player1: RivalPlayer;
  player2: RivalPlayer;
  totalPlayers: number;
  pointDiff: number;
}

type DivisionFilter = 'all' | 'semua' | 'male' | 'female';

interface DivisionRivalryWidgetProps {
  setSelectedPlayer: (player: any) => void;
  selectedDivision?: DivisionFilter;
}

/* ========== Stat comparison bar ========== */
function StatBar({ label, value1, value2, max }: { label: string; value1: number; value2: number; max: number }) {
  const dt = useDivisionTheme();
  const pct1 = max > 0 ? (value1 / max) * 100 : 0;
  const pct2 = max > 0 ? (value2 / max) * 100 : 0;
  const winner1 = value1 > value2;
  const winner2 = value2 > value1;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold tabular-nums ${winner1 ? dt.neonText : 'text-muted-foreground'}`}>{value1}</span>
        <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">{label}</span>
        <span className={`text-xs font-bold tabular-nums ${winner2 ? dt.neonText : 'text-muted-foreground'}`}>{value2}</span>
      </div>
      <div className="flex items-center gap-1 h-1.5">
        <div className="flex-1 bg-white/5 rounded-full overflow-hidden flex justify-end">
          <div
            className={`h-full rounded-full transition-all duration-700 progress-fill-animate ${winner1 ? 'bg-idm-gold-warm' : 'bg-white/15'}`}
            style={{ width: `${Math.max(pct1, 2)}%` }}
          />
        </div>
        <div className="flex-1 bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 progress-fill-animate ${winner2 ? 'bg-idm-gold-warm' : 'bg-white/15'}`}
            style={{ width: `${Math.max(pct2, 2)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/* ========== Player Card ========== */
function RivalPlayerCard({
  player,
  isLeading,
  division,
  onClick,
}: {
  player: RivalPlayer;
  isLeading: boolean;
  division: 'male' | 'female';
  onClick: () => void;
}) {
  const dt = useDivisionTheme();

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 group cursor-pointer w-full"
    >
      {/* Avatar + Info — horizontal compact layout */}
      <div className="flex items-center gap-2 w-full">
        {/* Avatar with tier border */}
        <div className="relative shrink-0">
          <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-lg overflow-hidden border-2 transition-all duration-300 group-hover:scale-105 ${
            isLeading ? 'border-idm-gold-warm/50 shadow-[0_0_12px_rgba(249,203,37,0.2)] rivalry-leading-glow' : 'border-border'
          }`}>
            <AvatarMedia src={getAvatarUrl(player.gamertag, division, player.avatar)} alt={player.gamertag} width={56} height={56} loading="lazy" className="w-full h-full object-cover" />
          </div>
          {/* Leading crown */}
          {isLeading && (
            <div className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-idm-gold-warm flex items-center justify-center shadow-md z-10">
              <Crown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-background" />
            </div>
          )}
        </div>

        {/* Player info */}
        <div className="min-w-0 flex-1">
          <p className={`text-[11px] sm:text-xs font-bold truncate group-hover:text-idm-gold-warm transition-colors ${
            isLeading ? 'text-white' : 'text-white/80'
          }`}>
            {player.gamertag}
          </p>
          {player.club && (
            <p className="text-[8px] sm:text-[9px] text-muted-foreground truncate">{player.club.name}</p>
          )}
          <div className={`mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full ${dt.bgSubtle} ${dt.borderSubtle} border`}>
            <Trophy className={`w-2.5 h-2.5 ${dt.neonText}`} />
            <span className={`text-[9px] sm:text-[10px] font-bold tabular-nums ${dt.neonText}`}>{player.points}</span>
            <span className="text-[7px] sm:text-[8px] text-muted-foreground">PTS</span>
          </div>
        </div>
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════
   Single Division Rivalry Card — renders one division's rivalry
   ═══════════════════════════════════════════════════════ */
function SingleDivisionRivalryCard({
  division,
  rivalry,
  setSelectedPlayer,
  showDivisionLabel,
}: {
  division: 'male' | 'female';
  rivalry: RivalryData | null | undefined;
  setSelectedPlayer: (player: any) => void;
  showDivisionLabel?: boolean;
}) {
  const dt = getDivisionTheme(division);

  /* ─── Empty state — Enhanced visual ─── */
  if (!rivalry) {
    return (
      <Card className={`${dt.casinoCard} overflow-hidden rivalry-card h-full flex flex-col`}>
        <div className={dt.casinoBar} />

        {/* Header — same structure as populated state */}
        <div className={`flex items-center gap-2.5 px-4 py-3 border-b ${dt.borderSubtle} shrink-0`}>
          <div className={`w-5 h-5 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
            <Swords className={`w-3 h-3 ${dt.neonText}`} />
          </div>
          <h3 className="text-xs font-semibold uppercase tracking-wider">Rivalitas Puncak</h3>
          {showDivisionLabel && (
            <Badge className={`${dt.badgeBg} text-[8px] border ml-1`}>
              {division === 'male' ? '🕺 Cowo' : '💃 Cewe'}
            </Badge>
          )}
          <Badge className={`${dt.casinoBadge} ml-auto text-[9px] opacity-40`}>
            <Zap className="w-2.5 h-2.5 mr-0.5" />
            — PTS
          </Badge>
        </div>

        <div className="p-4 sm:p-6 flex-1 flex flex-col items-center justify-center">
          {/* Silhouette player cards with VS — horizontal on all screens */}
          <div className="flex items-center gap-2 sm:gap-4 mb-3 w-full">
            {/* Player 1 silhouette — compact horizontal */}
            <div className="flex-1 flex items-center gap-2">
              <div className="relative shrink-0">
                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg bg-muted/10 border-2 border-dashed border-border/20 flex items-center justify-center">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground/15" />
                </div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                  <div className="w-8 h-3 rounded-full bg-muted/10 border border-dashed border-border/15 scale-75" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="w-full h-2.5 rounded bg-muted/10 mb-1" />
                <div className="w-10 h-3.5 rounded-full bg-muted/8" />
              </div>
            </div>

            {/* VS Badge placeholder */}
            <div className="flex flex-col items-center gap-0.5 shrink-0">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-muted/8 border border-dashed border-border/15 flex items-center justify-center">
                <span className="text-[11px] sm:text-xs font-black text-muted-foreground/20">VS</span>
              </div>
              <span className="text-[7px] sm:text-[8px] text-muted-foreground/25 font-semibold">#1 vs #2</span>
            </div>

            {/* Player 2 silhouette — compact horizontal */}
            <div className="flex-1 flex items-center gap-2">
              <div className="relative shrink-0">
                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg bg-muted/10 border-2 border-dashed border-border/20 flex items-center justify-center">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground/15" />
                </div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                  <div className="w-8 h-3 rounded-full bg-muted/10 border border-dashed border-border/15 scale-75" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="w-full h-2.5 rounded bg-muted/10 mb-1" />
                <div className="w-10 h-3.5 rounded-full bg-muted/8" />
              </div>
            </div>
          </div>

          {/* Stat bars placeholder */}
          <div className="w-full space-y-2 mb-4">
            {['Points', 'Wins', 'MVP', 'Streak'].map((label) => (
              <div key={label} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="w-6 h-2.5 rounded bg-muted/8" />
                  <span className="text-[8px] text-muted-foreground/20 uppercase tracking-wider">{label}</span>
                  <div className="w-6 h-2.5 rounded bg-muted/8" />
                </div>
                <div className="flex items-center gap-1 h-1.5">
                  <div className="flex-1 bg-white/3 rounded-full overflow-hidden">
                    <div className="h-full w-1/3 bg-muted/8 rounded-full" />
                  </div>
                  <div className="flex-1 bg-white/3 rounded-full overflow-hidden">
                    <div className="h-full w-1/4 bg-muted/8 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Point gap placeholder */}
          <div className={`w-full flex items-center justify-center gap-2 p-3 sm:p-4 rounded-lg ${dt.bgSubtle} ${dt.borderSubtle} border mb-3`}>
            <TrendingUp className="w-3 h-3 text-muted-foreground/20 shrink-0" />
            <span className="text-[10px] text-muted-foreground/30">
              Belum ada data perbandingan
            </span>
          </div>

          {/* Total players placeholder */}
          <div className={`w-full flex items-center justify-between p-3 sm:p-4 rounded-lg ${dt.bgSubtle}`}>
            <div className="flex items-center gap-2">
              <Users className={`w-3.5 h-3.5 ${dt.neonText} opacity-30`} />
              <span className="text-[10px] text-muted-foreground/40">Total Pemain Tarkam</span>
            </div>
            <span className="text-xs font-bold text-muted-foreground/20">—</span>
          </div>

          {/* Explanation */}
          <p className="text-[9px] text-muted-foreground/30 text-center mt-3 max-w-[220px]">
            Rivalitas puncak menampilkan duel antara peringkat #1 dan #2. Minimal 2 pemain diperlukan.
          </p>
        </div>
      </Card>
    );
  }

  /* ─── Populated state ─── */
  const { player1, player2, pointDiff, totalPlayers } = rivalry;
  const maxPoints = Math.max(player1.points, player2.points, 1);
  const maxWins = Math.max(player1.totalWins, player2.totalWins, 1);
  const maxMvp = Math.max(player1.totalMvp, player2.totalMvp, 1);
  const maxStreak = Math.max(player1.streak, player2.streak, 1);

  return (
    <Card className={`${dt.casinoCard} overflow-hidden rivalry-card h-full flex flex-col`}>
      <div className={dt.casinoBar} />

      {/* Header */}
      <div className={`flex items-center gap-2.5 px-4 py-3 border-b ${dt.borderSubtle} shrink-0`}>
        <div className={`w-5 h-5 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
          <Swords className={`w-3 h-3 ${dt.neonText}`} />
        </div>
        <h3 className="text-xs font-semibold uppercase tracking-wider">Rivalitas Puncak</h3>
        {showDivisionLabel && (
          <Badge className={`${dt.badgeBg} text-[8px] border ml-1`}>
            {division === 'male' ? '🕺 Cowo' : '💃 Cewe'}
          </Badge>
        )}
        <Badge className={`${dt.casinoBadge} ml-auto text-[9px]`}>
          <Zap className="w-2.5 h-2.5 mr-0.5" />
          {pointDiff} PTS
        </Badge>
      </div>

      {/* Rivalry Display — horizontal side-by-side on all screens */}
      <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Player 1 */}
          <div className="flex-1 min-w-0">
            <RivalPlayerCard
              player={player1}
              isLeading={pointDiff > 0}
              division={division}
              onClick={() => setSelectedPlayer(player1)}
            />
          </div>

          {/* VS Badge — compact vertical */}
          <div className="flex flex-col items-center gap-0.5 shrink-0 relative">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full rivalry-vs-badge flex items-center justify-center relative">
              <span className="text-[11px] sm:text-xs font-black text-idm-gold-warm relative z-10">VS</span>
            </div>
            <span className="text-[7px] sm:text-[8px] text-muted-foreground/50 font-semibold">#1 vs #2</span>
          </div>

          {/* Player 2 */}
          <div className="flex-1 min-w-0">
            <RivalPlayerCard
              player={player2}
              isLeading={pointDiff < 0}
              division={division}
              onClick={() => setSelectedPlayer(player2)}
            />
          </div>
        </div>

        {/* Stat Comparison Bars */}
        <div className="space-y-2.5">
          <StatBar label="Points" value1={player1.points} value2={player2.points} max={maxPoints} />
          <StatBar label="Wins" value1={player1.totalWins} value2={player2.totalWins} max={maxWins} />
          <StatBar label="MVP" value1={player1.totalMvp} value2={player2.totalMvp} max={maxMvp} />
          <StatBar label="Streak" value1={player1.streak} value2={player2.streak} max={maxStreak} />
        </div>

        {/* Point Gap Indicator */}
        <div className={`flex items-center justify-center gap-2 p-3 sm:p-4 rounded-lg ${dt.bgSubtle} ${dt.borderSubtle} border`}>
          <TrendingUp className="w-3 h-3 text-idm-gold-warm shrink-0" />
          <span className="text-[10px] text-muted-foreground">
            {pointDiff > 0 ? (
              <><span className="text-idm-gold-warm font-bold">{player1.gamertag}</span> unggul <span className="font-bold text-idm-gold-warm">{pointDiff} poin</span></>
            ) : pointDiff < 0 ? (
              <><span className="text-idm-gold-warm font-bold">{player2.gamertag}</span> unggul <span className="font-bold text-idm-gold-warm">{Math.abs(pointDiff)} poin</span></>
            ) : (
              <>Seri! Keduanya <span className="font-bold text-idm-gold-warm">imbang</span></>
            )}
          </span>
          {player1.streak > 1 && (
            <Badge className="bg-orange-500/10 text-orange-400 text-[8px] border-orange-500/20 px-1.5 py-0 shrink-0">
              <Flame className="w-2 h-2 mr-0.5" />{player1.streak}
            </Badge>
          )}
        </div>

        {/* Total Players in Division */}
        <div className={`flex items-center justify-between p-3 sm:p-4 rounded-lg ${dt.bgSubtle}`}>
          <div className="flex items-center gap-2">
            <Users className={`w-3.5 h-3.5 ${dt.neonText}`} />
            <span className="text-[10px] text-muted-foreground">Total Pemain Tarkam</span>
          </div>
          <span className={`text-xs font-bold tabular-nums ${dt.neonGradient}`}>{totalPlayers}</span>
        </div>
      </div>
    </Card>
  );
}


/* ═══════════════════════════════════════════════════════
   Main Widget — renders single or dual rivalry based on selectedDivision
   ═══════════════════════════════════════════════════════ */
export function DivisionRivalryWidget({ setSelectedPlayer, selectedDivision }: DivisionRivalryWidgetProps) {
  const storeDivision = useAppStore(s => s.division);

  // Use prop if provided, otherwise fall back to store
  const effectiveFilter: DivisionFilter = selectedDivision ?? storeDivision ?? 'all';

  const { data, isLoading } = useQuery<{ male: RivalryData | null; female: RivalryData | null }>({
    queryKey: ['division-rivalry'],
    queryFn: async () => {
      const res = await fetch('/api/division-rivalry');
      return res.json();
    },
    staleTime: 30000,
  });

  /* ─── Loading skeleton ─── */
  if (isLoading) {
    const dt = getDivisionTheme(effectiveFilter === 'female' ? 'female' : 'male');
    return (
      <Card className={`${dt.casinoCard} overflow-hidden rivalry-card h-full flex flex-col`}>
        <div className={dt.casinoBar} />
        <div className="p-4 space-y-3 flex-1">
          <div className="flex items-center justify-between">
            <div className="h-4 w-28 bg-muted/20 rounded animate-pulse" />
            <div className="h-5 w-12 bg-muted/20 rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-4 justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="h-16 w-16 bg-muted/15 rounded-2xl animate-pulse" />
              <div className="h-3 w-16 bg-muted/15 rounded animate-pulse" />
            </div>
            <div className="h-10 w-10 bg-muted/15 rounded-full animate-pulse" />
            <div className="flex flex-col items-center gap-2">
              <div className="h-16 w-16 bg-muted/15 rounded-2xl animate-pulse" />
              <div className="h-3 w-16 bg-muted/15 rounded animate-pulse" />
            </div>
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-6 bg-muted/10 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  /* ─── "Semua" — Show both divisions side by side ─── */
  if (effectiveFilter === 'all') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SingleDivisionRivalryCard
          division="male"
          rivalry={data?.male}
          setSelectedPlayer={setSelectedPlayer}
          showDivisionLabel
        />
        <SingleDivisionRivalryCard
          division="female"
          rivalry={data?.female}
          setSelectedPlayer={setSelectedPlayer}
          showDivisionLabel
        />
      </div>
    );
  }

  /* ─── Single division ─── */
  const division: 'male' | 'female' = effectiveFilter === 'female' ? 'female' : 'male';
  const rivalry = division === 'male' ? data?.male : data?.female;

  return (
    <SingleDivisionRivalryCard
      division={division}
      rivalry={rivalry}
      setSelectedPlayer={setSelectedPlayer}
      showDivisionLabel={false}
    />
  );
}
