'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Swords, Trophy, Flame, Crown, TrendingUp, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { useAppStore } from '@/lib/store';
import { getAvatarUrl, toStrictDivision } from '@/lib/utils';
import { AvatarMedia } from '@/components/ui/avatar-media';

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

interface DivisionRivalryProps {
  setSelectedPlayer: (player: any) => void;
}

/* Stat comparison bar */
function StatBar({ label, value1, value2, max }: { label: string; value1: number; value2: number; max: number }) {
  const dt = useDivisionTheme();
  const pct1 = max > 0 ? (value1 / max) * 100 : 0;
  const pct2 = max > 0 ? (value2 / max) * 100 : 0;
  const winner1 = value1 > value2;
  const winner2 = value2 > value1;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold ${winner1 ? dt.neonText : 'text-muted-foreground'}`}>{value1}</span>
        <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">{label}</span>
        <span className={`text-xs font-bold ${winner2 ? dt.neonText : 'text-muted-foreground'}`}>{value2}</span>
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

export function DivisionRivalry({ setSelectedPlayer }: DivisionRivalryProps) {
  const dt = useDivisionTheme();
  const division = useAppStore(s => s.division);

  const { data, isLoading } = useQuery<{ male: RivalryData | null; female: RivalryData | null }>({
    queryKey: ['division-rivalry'],
    queryFn: async () => {
      const res = await fetch('/api/division-rivalry');
      return res.json();
    },
    staleTime: 30000,
  });

  const rivalry = division === 'male' ? data?.male : data?.female;

  if (isLoading) {
    return (
      <Card className={`${dt.casinoCard} overflow-hidden rivalry-card`}>
        <div className={dt.casinoBar} />
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-4 w-24 bg-muted/20 rounded animate-pulse" />
            <div className="h-5 w-10 bg-muted/20 rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 bg-muted/15 rounded-full animate-pulse" />
            <div className="h-6 w-8 bg-muted/20 rounded animate-pulse" />
            <div className="h-16 w-16 bg-muted/15 rounded-full animate-pulse" />
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

  if (!rivalry) {
    return (
      <Card className={`${dt.casinoCard} overflow-hidden`}>
        <div className={dt.casinoBar} />
        <div className="p-4 text-center">
          <Swords className={`w-8 h-8 mx-auto mb-2 opacity-30 ${dt.text}`} />
          <p className="text-xs text-muted-foreground">Belum cukup data rivalitas</p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">Minimal 2 pemain diperlukan</p>
        </div>
      </Card>
    );
  }

  const { player1, player2, pointDiff } = rivalry;
  const accentColor = division === 'male' ? '#57B5FF' : '#FF5C9A';

  const maxPoints = Math.max(player1.points, player2.points, 1);
  const maxWins = Math.max(player1.totalWins, player2.totalWins, 1);
  const maxMvp = Math.max(player1.totalMvp, player2.totalMvp, 1);
  const maxStreak = Math.max(player1.streak, player2.streak, 1);

  return (
    <Card className={`${dt.casinoCard} overflow-hidden rivalry-card`}>
      <div className={dt.casinoBar} />
      {/* Header */}
      <div className={`flex items-center gap-2.5 px-4 py-3 border-b ${dt.borderSubtle}`}>
        <div className={`w-5 h-5 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
          <Swords className={`w-3 h-3 ${dt.neonText}`} />
        </div>
        <h3 className="text-xs font-semibold uppercase tracking-wider">Rivalitas Puncak</h3>
        <Badge className={`${dt.casinoBadge} ml-auto text-[9px]`}>
          <Zap className="w-2.5 h-2.5 mr-0.5" />
          {pointDiff} PTS
        </Badge>
      </div>

      {/* Rivalry Display */}
      <div className="p-4 space-y-4">
        {/* Player Avatars with VS */}
        <div className="flex items-center justify-center gap-4">
          {/* Player 1 */}
          <button
            onClick={() => setSelectedPlayer(player1)}
            className="flex flex-col items-center gap-1.5 group/p1 cursor-pointer"
          >
            <div className="relative">
              <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 transition-all duration-300 group-hover/p1:scale-105 ${
                pointDiff > 0 ? 'border-idm-gold-warm/40' : 'border-border'
              }`}>
                <AvatarMedia
                  src={getAvatarUrl(player1.gamertag, toStrictDivision(division), player1.avatar)}
                  alt={player1.gamertag}
                  width={80}
                  height={80}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </div>
              {pointDiff > 0 && (
                <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-idm-gold-warm flex items-center justify-center shadow-md">
                  <Crown className="w-3 h-3 text-background" />
                </div>
              )}
            </div>
            <p className="text-xs font-bold text-white group-hover/p1:text-idm-gold-warm transition-colors truncate max-w-[80px]">
              {player1.gamertag}
            </p>
            {player1.club && (
              <p className="text-[9px] text-muted-foreground truncate max-w-[80px]">{player1.club.name}</p>
            )}
          </button>

          {/* VS Badge */}
          <div className="flex flex-col items-center gap-1">
            <div className="vs-badge-glow w-10 h-10 rounded-full bg-gradient-to-br from-idm-gold-warm/20 to-idm-gold-warm/5 border border-idm-gold-warm/30 flex items-center justify-center">
              <span className="text-xs font-black text-idm-gold-warm">VS</span>
            </div>
            <span className="text-[9px] text-muted-foreground/50 font-semibold">#1 vs #2</span>
          </div>

          {/* Player 2 */}
          <button
            onClick={() => setSelectedPlayer(player2)}
            className="flex flex-col items-center gap-1.5 group/p2 cursor-pointer"
          >
            <div className="relative">
              <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 transition-all duration-300 group-hover/p2:scale-105 ${
                pointDiff <= 0 ? 'border-idm-gold-warm/40' : 'border-border'
              }`}>
                <AvatarMedia
                  src={getAvatarUrl(player2.gamertag, toStrictDivision(division), player2.avatar)}
                  alt={player2.gamertag}
                  width={80}
                  height={80}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </div>
              {pointDiff <= 0 && (
                <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-idm-gold-warm flex items-center justify-center shadow-md">
                  <Crown className="w-3 h-3 text-background" />
                </div>
              )}
            </div>
            <p className="text-xs font-bold text-white group-hover/p2:text-idm-gold-warm transition-colors truncate max-w-[80px]">
              {player2.gamertag}
            </p>
            {player2.club && (
              <p className="text-[9px] text-muted-foreground truncate max-w-[80px]">{player2.club.name}</p>
            )}
          </button>
        </div>

        {/* Stat Comparison Bars */}
        <div className="space-y-2.5">
          <StatBar label="Points" value1={player1.points} value2={player2.points} max={maxPoints} />
          <StatBar label="Wins" value1={player1.totalWins} value2={player2.totalWins} max={maxWins} />
          <StatBar label="MVP" value1={player1.totalMvp} value2={player2.totalMvp} max={maxMvp} />
          <StatBar label="Streak" value1={player1.streak} value2={player2.streak} max={maxStreak} />
        </div>

        {/* Point Gap Indicator */}
        <div className={`flex items-center justify-center gap-2 p-3 sm:p-4 rounded-lg ${dt.bgSubtle} ${dt.borderSubtle}`}>
          <TrendingUp className="w-3 h-3 text-idm-gold-warm" />
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
            <Badge className="bg-orange-500/10 text-orange-400 text-[8px] border-orange-500/20 px-1.5 py-0">
              <Flame className="w-2 h-2 mr-0.5" />{player1.streak}
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}
