'use client';

import React from 'react';
import { AvatarMedia } from '@/components/ui/avatar-media';
import Image from 'next/image';
import { Shield, Flame } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { useBackgroundImages } from '@/hooks/use-background-images';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAppStore } from '@/lib/store';
import { getAvatarUrl, clubToString, toStrictDivision } from '@/lib/utils';
import type { StatsData } from '@/types/stats';

/* ─── CasinoHeaderCard — kept but used only for hero area ─── */
export const CasinoHeaderCard = React.memo(function CasinoHeaderCard({ icon: Icon, title, badge, children, className = '' }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const dt = useDivisionTheme();
  const { bgMale, bgFemale } = useBackgroundImages();
  return (
    <Card className={`${dt.casinoCard} ${dt.casinoGlow} casino-shimmer overflow-hidden group ${className}`}>
      <div className={dt.casinoBar} />
      <div className="relative img-zoom h-28 sm:h-32">
        <Image src={dt.division === 'male' ? bgMale : bgFemale} alt="" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover card-cover object-[center_20%]" aria-hidden="true" loading="lazy" />
        <div className="casino-img-overlay" />
        <div className={`absolute top-2 left-2 ${dt.cornerAccent}`} />
        <div className={`absolute top-2 right-2 rotate-90 ${dt.cornerAccent}`} />
        {badge && <Badge className={`absolute top-3 right-3 ${dt.casinoBadge}`}>{badge}</Badge>}
        <div className="absolute bottom-3 left-4 flex items-center gap-3 z-10">
          <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br from-idm-gold-warm to-idm-amber flex items-center justify-center shadow-lg`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <h3 className={`text-sm font-bold ${dt.neonText}`}>{title}</h3>
        </div>
      </div>
      <CardContent className="p-4 relative z-10">{children}</CardContent>
    </Card>
  );
})

/* ─── Toornament-style Section Card — clean header with thin bottom border ─── */
export const SectionCard = React.memo(function SectionCard({ title, icon: Icon, badge, children, className = '' }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const dt = useDivisionTheme();
  return (
    <Card className={`${dt.casinoCard} overflow-hidden ${className}`}>
      <div className={dt.casinoBar} />
      <CardContent className="p-0 relative z-10">
        {/* Toornament-style section header — full width, bordered bottom */}
        <div className={`flex items-center gap-2.5 px-4 py-3 border-b ${dt.borderSubtle}`}>
          <div className={`w-5 h-5 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
            <Icon className={`w-3 h-3 ${dt.neonText}`} />
          </div>
          <h3 className="text-xs font-semibold uppercase tracking-wider">{title}</h3>
          {badge && <Badge className={`${dt.casinoBadge} ml-auto text-[9px]`}>{badge}</Badge>}
        </div>
        <div className="p-4">
          {children}
        </div>
      </CardContent>
    </Card>
  );
})

/* ─── Toornament-style Match Row — clean, compact ─── */
export const MatchRow = React.memo(function MatchRow({ club1, club2, score1, score2, week, status, mvp, isLive }: {
  club1: string; club2: string; score1: number; score2: number;
  week?: number; status?: string; mvp?: string; isLive?: boolean;
}) {
  const dt = useDivisionTheme();
  const isUpcoming = status === 'upcoming';
  const isLiveMatch = status === 'live';
  const isCompleted = status === 'completed';
  const winner1 = isCompleted && score1 > score2;
  const winner2 = isCompleted && score2 > score1;

  // For upcoming matches, show dash instead of 0
  const displayScore1 = isUpcoming ? '-' : score1;
  const displayScore2 = isUpcoming ? '-' : score2;

  return (
    <div className={`group flex items-stretch rounded-lg overflow-hidden ${dt.bgSubtle} ${dt.borderSubtle} border transition-all ${dt.hoverBorder} hover:shadow-sm`}>
      {/* Week/Round indicator — toornament style left bar */}
      {week && (
        <div className={`w-10 shrink-0 flex items-center justify-center ${dt.bg} border-r ${dt.borderSubtle}`}>
          <span className={`text-[9px] font-bold ${dt.neonText}`}>W{week}</span>
        </div>
      )}
      {/* Main match content */}
      <div className="flex-1 min-w-0">
        {/* Team 1 */}
        <div className={`flex items-center px-3 py-1.5 border-b ${dt.borderSubtle} ${isUpcoming || isLiveMatch ? '' : winner1 ? '' : 'opacity-60'}`}>
          <span className={`text-xs font-semibold truncate flex-1 ${winner1 ? dt.neonText : 'text-muted-foreground'}`}>
            {winner1 && <span className="mr-1">▸</span>}
            {club1}
          </span>
          <span className={`text-sm font-bold tabular-nums w-6 text-right ${winner1 ? dt.neonText : 'text-foreground'}`}>{displayScore1}</span>
        </div>
        {/* Team 2 */}
        <div className={`flex items-center px-3 py-1.5 ${isUpcoming || isLiveMatch ? '' : winner2 ? '' : 'opacity-60'}`}>
          <span className={`text-xs font-semibold truncate flex-1 ${winner2 ? dt.neonText : 'text-muted-foreground'}`}>
            {winner2 && <span className="mr-1">▸</span>}
            {club2}
          </span>
          <span className={`text-sm font-bold tabular-nums w-6 text-right ${winner2 ? dt.neonText : 'text-foreground'}`}>{displayScore2}</span>
        </div>
      </div>
      {/* Status / MVP indicator */}
      <div className="w-16 shrink-0 flex flex-col items-center justify-center border-l border-transparent">
        {isLive ? (
          <div className="flex flex-col items-center gap-0.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <Badge className="bg-red-500/15 text-red-500 text-[8px] font-black border-0 px-1.5 py-0">LIVE</Badge>
          </div>
        ) : isCompleted ? (
          <Badge className="bg-green-500/10 text-green-500 text-[8px] border-0">FT</Badge>
        ) : (
          <Badge className={`${dt.casinoBadge} text-[8px]`}>VS</Badge>
        )}
        {mvp && <span className="text-[8px] text-yellow-500 mt-0.5">MVP</span>}
      </div>
    </div>
  );
})

/* ─── Toornament-style Bracket Match ─── */
export const BracketMatch = React.memo(function BracketMatch({ team1, team2, score1, score2, status, round, matchIdx, isLast }: {
  team1: string; team2: string; score1: number | null; score2: number | null;
  status: string; round: number; matchIdx: number; isLast: boolean;
}) {
  const dt = useDivisionTheme();
  const hasScore = score1 !== null && score2 !== null;
  const winner1 = hasScore && score1! > score2!;
  const winner2 = hasScore && score2! > score1!;
  const isLive = status === 'live';

  return (
    <div className="relative" style={{ marginBottom: isLast ? 0 : 'var(--bracket-gap, 24px)' }}>
      {/* Connector lines for rounds > 0 */}
      {round > 0 && (
        <div className="absolute -left-5 top-1/2 w-5 flex items-center">
          <div className={`w-full h-px ${dt.borderSubtle}`} />
        </div>
      )}
      <div className={`rounded-lg overflow-hidden border ${dt.borderSubtle} ${isLive ? `border-red-500/30 ${dt.neonPulse}` : ''} transition-all ${dt.hoverBorder} hover:shadow-sm`} style={{ background: 'var(--card-bg, rgba(20,17,10,0.6))' }}>
        {/* Team 1 row */}
        <div className={`flex items-center px-2.5 py-1.5 border-b ${dt.borderSubtle} ${winner1 ? dt.bgSubtle : ''}`}>
          <span className={`text-[11px] font-semibold truncate flex-1 ${winner1 ? dt.neonText : 'text-foreground/80'}`}>
            {team1 || 'TBD'}
          </span>
          <span className={`text-xs font-bold tabular-nums w-5 text-right ${winner1 ? dt.neonText : 'text-muted-foreground'}`}>
            {hasScore ? score1 : '-'}
          </span>
        </div>
        {/* Team 2 row */}
        <div className={`flex items-center px-2.5 py-1.5 ${winner2 ? dt.bgSubtle : ''}`}>
          <span className={`text-[11px] font-semibold truncate flex-1 ${winner2 ? dt.neonText : 'text-foreground/80'}`}>
            {team2 || 'TBD'}
          </span>
          <span className={`text-xs font-bold tabular-nums w-5 text-right ${winner2 ? dt.neonText : 'text-muted-foreground'}`}>
            {hasScore ? score2 : '-'}
          </span>
        </div>
      </div>
    </div>
  );
})

/* ─── Toornament-style Participant Row ─── */
export const ParticipantRow = React.memo(function ParticipantRow({ player, rank, onClick }: {
  player: StatsData['topPlayers'][0];
  rank: number;
  onClick: () => void;
}) {
  const dt = useDivisionTheme();
  const division = useAppStore(s => s.division);
  const avatarSrc = getAvatarUrl(player.gamertag, toStrictDivision(division), player.avatar);

  // CSS-only hover — no Framer Motion for better performance
  return (
    <div
      className={`interactive-scale flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors border border-transparent ${dt.hoverBorder} ${dt.hoverBgSubtle}`}
      onClick={onClick}
    >
      {/* Rank */}
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
        rank === 1 ? 'bg-yellow-500/20 text-yellow-500' :
        rank === 2 ? 'bg-gray-400/20 text-muted-foreground' :
        rank === 3 ? 'bg-amber-600/20 text-amber-600' :
        `${dt.bgSubtle} text-muted-foreground`
      }`}>
        {rank}
      </span>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full overflow-hidden ${rank <= 3
        ? 'ring-2 ring-yellow-500/30'
        : ''
      } shrink-0 shadow-sm`}>
        <AvatarMedia src={avatarSrc} alt={player.gamertag} width={32} height={32} className="w-full h-full" />
      </div>
      {/* Name & Club */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate">{player.gamertag}</p>
        {clubToString(player.club as any) && (
          <p className="text-[9px] text-muted-foreground truncate flex items-center gap-0.5">
            <Shield className="w-2.5 h-2.5" />
            {clubToString(player.club as any)}
          </p>
        )}
      </div>
      {/* Points */}
      <div className="w-14 text-right shrink-0">
        <p className={`text-xs font-bold ${rank <= 3 ? dt.neonText : ''}`}>{player.points}</p>
        <p className="text-[8px] text-muted-foreground">pts</p>
      </div>
      {/* Quick stats */}
      <div className="hidden sm:flex items-center gap-2 shrink-0 text-[9px] text-muted-foreground">
        <span className="text-green-500 font-medium">{player.totalWins}W</span>
        <span className="text-red-500 font-medium">{player.matches - player.totalWins}L</span>
        {player.streak > 1 && <span className="text-orange-400 flex items-center gap-0.5"><Flame className="w-3 h-3" />{player.streak}</span>}
      </div>
    </div>
  );
})
