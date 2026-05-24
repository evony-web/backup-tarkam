'use client';

import { Crown, Music, Radio, Clock, Flame, Zap, ChevronRight, Trophy, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { useAppStore } from '@/lib/store';
import { useState } from 'react';

/* ─── Match data interface ─── */
interface DanceMatchCardProps {
  team1: { id: string; name: string } | null;
  team2: { id: string; name: string } | null;
  score1: number | null;
  score2: number | null;
  status: string;
  week?: number;
  mvpPlayer?: { id: string; name: string; gamertag: string } | null;
  onClick?: () => void;
}

/* ─── Status config ─── */
function getStatusConfig(status: string): { label: string; cls: string; pulse?: boolean } {
  switch (status) {
    case 'live':
    case 'main_event':
      return { label: 'LIVE', cls: 'bg-red-500/15 text-red-500 border-red-500/30', pulse: true };
    case 'completed':
    case 'scoring':
      return { label: 'FT', cls: 'bg-green-500/15 text-green-500 border-green-500/30' };
    case 'upcoming':
    case 'registration':
    case 'setup':
      return { label: 'AKAN DATANG', cls: 'bg-muted text-muted-foreground' };
    default:
      return { label: 'VS', cls: '' };
  }
}

/* ─── Team Logo Component ─── */
function TeamLogo({ name, isWinner, size = 'md' }: { name: string; isWinner: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const dt = useDivisionTheme();
  const division = useAppStore(s => s.division);
  const sizeClasses = size === 'lg' ? 'w-12 h-12 text-base' : size === 'md' ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-[10px]';
  return (
    <div className={`${sizeClasses} rounded-lg flex items-center justify-center font-bold shrink-0 transition-all duration-300 ${
      isWinner
        ? `bg-gradient-to-br ${division === 'male' ? 'from-idm-male to-idm-male-light' : 'from-idm-female to-idm-female-light'} text-white shadow-lg`
        : `${dt.iconBg} ${dt.text}`
    }`}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

/* ─── Tournament Match Card — Dance Competition Banner Style ─── */
export function DanceMatchCard({
  team1, team2, score1, score2, status, week, mvpPlayer, onClick
}: DanceMatchCardProps) {
  const dt = useDivisionTheme();
  const division = useAppStore(s => s.division);
  const [expanded, setExpanded] = useState(false);
  const hasScore = score1 !== null && score2 !== null;
  const winner1 = hasScore && score1! > score2!;
  const winner2 = hasScore && score2! > score1!;
  const isDraw = hasScore && score1 === score2;
  const isLive = status === 'live' || status === 'main_event';
  const isCompleted = status === 'completed' || status === 'scoring';
  const isUpcoming = !isLive && !isCompleted;
  // Dim losing team only for completed matches with a clear winner
  const dimTeam1 = isCompleted && !isDraw && !winner1;
  const dimTeam2 = isCompleted && !isDraw && !winner2;
  const statusConfig = getStatusConfig(status);

  const handleClick = () => {
    setExpanded(!expanded);
    onClick?.();
  };

  return (
    <div
      onClick={handleClick}
      className={`perspective-card hover-scale-md relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 ${
        dt.casinoCard
      } ${isLive ? dt.neonPulse : ''} ${dt.casinoGlow} casino-shimmer`}
    >
      {/* Neon accent bar */}
      <div className={dt.casinoBar} />

      {/* Corner accents */}
      <div className={`absolute top-0 left-0 ${dt.cornerAccent}`} />
      <div className={`absolute top-0 right-0 rotate-90 ${dt.cornerAccent}`} />

      <div className="relative z-10">
        {/* ═══ Header: Week + Status ═══ */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          {week && (
            <Badge className={`${dt.casinoBadge} text-[9px]`}>
              <Clock className="w-2.5 h-2.5 mr-1" />
              Week {week}
            </Badge>
          )}
          <div className="ml-auto">
            <Badge className={`${statusConfig.cls} text-[9px] font-black border ${statusConfig.pulse ? 'live-dot' : ''}`}>
              {statusConfig.pulse && <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 inline-block" />}
              {statusConfig.label}
            </Badge>
          </div>
        </div>

        {/* ═══ Match Layout — Dance Competition Banner Style ═══ */}
        <div className="px-4 pb-3 pt-2">
          <div className="flex items-center gap-3">
            {/* Team 1 — Left Side */}
            <div className={`flex-1 min-w-0 transition-all duration-300 ${dimTeam1 ? 'opacity-70' : ''}`}>
              <div className="flex items-center gap-2.5">
                <TeamLogo name={team1?.name || 'TBD'} isWinner={winner1} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-bold truncate ${winner1 ? dt.neonText : 'text-foreground/80'}`}>
                    {team1?.name || 'TBD'}
                  </p>
                  {winner1 && (
                    <p className={`text-[9px] ${dt.text} font-semibold flex items-center gap-0.5 mt-0.5`}>
                      <Zap className="w-2.5 h-2.5" /> PEMENANG
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ═══ Score Center — Dance Scoreboard Style ═══ */}
            <div className="flex flex-col items-center shrink-0 px-2">
              {/* Score display */}
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-black tabular-nums w-8 text-right ${
                  winner1 ? dt.neonGradient : 'text-foreground/30'
                }`}>
                  {hasScore ? score1 : '-'}
                </span>
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isLive ? 'bg-red-500/10' : isCompleted ? `${dt.bgSubtle}` : `${dt.iconBg}`
                  }`}>
                    {isLive ? (
                      <Radio className="w-4 h-4 text-red-500 live-dot" />
                    ) : isCompleted ? (
                      <Music className={`w-3.5 h-3.5 ${dt.neonText}`} />
                    ) : (
                      <Music className={`w-3.5 h-3.5 ${dt.text}`} />
                    )}
                  </div>
                </div>
                <span className={`text-2xl font-black tabular-nums w-8 text-left ${
                  winner2 ? dt.neonGradient : 'text-foreground/30'
                }`}>
                  {hasScore ? score2 : '-'}
                </span>
              </div>
              {/* BO format label */}
              {isCompleted && (
                <span className="text-[8px] text-muted-foreground font-semibold mt-0.5 uppercase">Final</span>
              )}
              {isLive && (
                <span className="text-[8px] text-red-500 font-bold mt-0.5 uppercase animate-pulse">Berlangsung</span>
              )}
              {isUpcoming && (
                <span className="text-[8px] text-muted-foreground font-semibold mt-0.5 uppercase">vs</span>
              )}
            </div>

            {/* Team 2 — Right Side */}
            <div className={`flex-1 min-w-0 text-right transition-all duration-300 ${dimTeam2 ? 'opacity-70' : ''}`}>
              <div className="flex items-center gap-2.5 justify-end">
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-bold truncate ${winner2 ? dt.neonText : 'text-foreground/80'}`}>
                    {team2?.name || 'TBD'}
                  </p>
                  {winner2 && (
                    <p className={`text-[9px] ${dt.text} font-semibold flex items-center gap-0.5 mt-0.5 justify-end`}>
                      PEMENANG <Zap className="w-2.5 h-2.5" />
                    </p>
                  )}
                </div>
                <TeamLogo name={team2?.name || 'TBD'} isWinner={winner2} size="lg" />
              </div>
            </div>
          </div>

          {/* ═══ Score Bar — Visual representation ═══ */}
          {hasScore && (score1! + score2!) > 0 && (
            <div className="mt-3">
              <div className={`h-1.5 rounded-full ${dt.bgSubtle} overflow-hidden flex`}>
                <div
                  className={`h-full rounded-l-full transition-[width] duration-500 ease-out ${winner1
                    ? `bg-gradient-to-r ${division === 'male' ? 'from-idm-male to-idm-male-light' : 'from-idm-female to-idm-female-light'}`
                    : 'bg-muted-foreground/20'
                  }`}
                  style={{ width: `${(score1! / (score1! + score2!)) * 100}%` }}
                />
                <div
                  className={`h-full rounded-r-full transition-[width] duration-500 ease-out ${winner2
                    ? `bg-gradient-to-r ${division === 'male' ? 'from-idm-male-light to-idm-male' : 'from-idm-female-light to-idm-female'}`
                    : 'bg-muted-foreground/20'
                  }`}
                  style={{ width: `${(score2! / (score1! + score2!)) * 100}%`, opacity: 0.5 }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ═══ MVP Indicator ═══ */}
        {mvpPlayer && (
          <div
            className={`stagger-item-subtle flex items-center justify-center gap-1.5 mx-4 mb-3 p-3 rounded-lg ${dt.bgSubtle} ${dt.borderSubtle} border`}
          >
            <Crown className="w-3.5 h-3.5 text-yellow-500" />
            <span className={`text-[10px] font-semibold ${dt.neonText}`}>MVP: {mvpPlayer.gamertag}</span>
          </div>
        )}

        {/* ═══ Expanded Details ═══ */}
        {expanded && (
          <div className="mx-4 mb-3">
            <div className={`p-3 sm:p-4 rounded-lg ${dt.bgSubtle} ${dt.borderSubtle} border space-y-2`}>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">Status</span>
                <span className={`font-semibold ${isLive ? 'text-red-500' : 'text-foreground'}`}>
                  {statusConfig.label}
                </span>
              </div>
              {hasScore && (
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Skor Akhir</span>
                  <span className={`font-semibold ${dt.neonText}`}>
                    {team1?.name || 'TBD'} {score1} - {score2} {team2?.name || 'TBD'}
                  </span>
                </div>
              )}
              {week && (
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Week</span>
                  <span className="font-semibold">{week}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Expand indicator */}
        <div className="flex items-center justify-center pb-2">
          <ChevronRight className={`w-3 h-3 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </div>
    </div>
  );
}
