'use client';

import { Shield, Flame, Search, List, Grid3X3, Trophy, Zap, Target, Users, ChevronDown, ChevronUp, Crown, Star, Music } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { useAppStore } from '@/lib/store';
import { clubToString } from '@/lib/utils';
import { useState, useMemo } from 'react';

/* ─── Player interface ─── */
interface Player {
  id: string;
  name: string;
  gamertag: string;
  tier: string;
  points: number;
  totalWins: number;
  streak: number;
  maxStreak: number;
  totalMvp: number;
  matches: number;
  club?: string | { id: string; name: string; logo?: string | null };
  division?: string;
}

interface ParticipantGridProps {
  players: Player[];
  onPlayerClick: (player: Player) => void;
}

/* ─── Dance Tournament Poster-style Participant Card ─── */
function ParticipantCard({ player, rank, onClick }: {
  player: Player;
  rank: number;
  onClick: () => void;
}) {
  const dt = useDivisionTheme();
  const division = useAppStore(s => s.division);
  const isTop3 = rank <= 3;
  const isChampion = rank === 1;
  const winRate = player.matches > 0 ? Math.round((player.totalWins / player.matches) * 100) : 0;

  return (
    <div
      onClick={onClick}
      className={`hover-scale-md relative rounded-2xl cursor-pointer overflow-hidden transition-all duration-300 ${
        dt.casinoCard
      } ${isChampion ? dt.neonPulse : ''} ${isTop3 ? dt.casinoGlow : ''} casino-shimmer`}
    >
      {/* Neon accent bar */}
      <div className={dt.casinoBar} />

      {/* Corner accents for top players */}
      {isTop3 && (
        <>
          <div className={`absolute top-0 left-0 ${dt.cornerAccent}`} />
          <div className={`absolute top-0 right-0 rotate-90 ${dt.cornerAccent}`} />
        </>
      )}

      {/* Rank number — large background number like esports poster */}
      <div className="absolute top-1 right-1 z-0 select-none">
        <span className={`text-4xl font-black leading-none ${
          isChampion ? 'text-yellow-500/10' :
          rank === 2 ? 'text-gray-400/10' :
          rank === 3 ? 'text-amber-600/10' :
          'text-muted-foreground/5'
        }`}>
          {rank}
        </span>
      </div>

      {/* Rank badge overlay — top-left */}
      <div className={`absolute top-2 left-2 z-20 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black ${
        rank === 1 ? 'bg-yellow-500/90 text-white shadow-lg shadow-yellow-500/20' :
        rank === 2 ? 'bg-gray-400/90 text-white' :
        rank === 3 ? 'bg-amber-600/90 text-white' :
        `${dt.bgSubtle} ${dt.text}`
      }`}>
        {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
      </div>

      <div className="relative z-10 p-3 pt-8">
        {/* Large Avatar with esports frame */}
        <div className="relative w-18 h-18 mx-auto mb-3" style={{ width: '72px', height: '72px' }}>
          {/* Outer glow ring for top players */}
          {isTop3 && (
            <div className={`absolute -inset-1 rounded-full border-2 ${
              isChampion ? 'border-yellow-500/40 animate-pulse' :
              `border-current opacity-30`
            }`} style={{ borderColor: isChampion ? undefined : 'var(--idm-male, var(--idm-female))' }} />
          )}
          {/* Avatar circle */}
          <div className={`w-full h-full rounded-full flex items-center justify-center text-xl font-black relative z-10 shadow-lg border-2 ${
            isChampion ? 'bg-gradient-to-br from-yellow-500 to-amber-600 text-white border-yellow-400/50' :
            isTop3 ? `bg-gradient-to-br ${division === 'male' ? 'from-idm-male to-idm-male-light' : 'from-idm-female to-idm-female-light'} text-white border-current/20` :
            `${dt.iconBg} ${dt.text} border-transparent`
          }`}>
            {player.gamertag.slice(0, 2).toUpperCase()}
          </div>

        </div>

        {/* Player Nickname — bold esports style */}
        <div className="text-center">
          <p className={`text-sm font-black truncate leading-tight ${
            isChampion ? dt.neonGradient :
            isTop3 ? dt.neonText :
            'text-foreground'
          }`}>
            {player.gamertag}
          </p>

          {/* Club name with Shield icon */}
          {clubToString(player.club as any) && (
            <div className="flex items-center justify-center gap-1 mt-1">
              <Shield className={`w-3 h-3 ${dt.text}`} />
              <span className={`text-[10px] ${dt.text} font-medium truncate`}>{clubToString(player.club as any)}</span>
            </div>
          )}
        </div>

        {/* Stats row — esports HUD style */}
        <div className={`grid grid-cols-3 gap-1 mt-3 pt-2.5 border-t ${dt.borderSubtle}`}>
          <div className="text-center">
            <p className={`text-xs font-black ${rank <= 3 ? dt.neonText : ''}`}>{player.points}</p>
            <p className="text-[7px] text-muted-foreground uppercase tracking-widest font-semibold">PTS</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-black text-green-500">{player.totalWins}<span className="text-muted-foreground font-medium">/{player.matches}</span></p>
            <p className="text-[7px] text-muted-foreground uppercase tracking-widest font-semibold">W/M</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-0.5">
              {player.streak > 1 && <Flame className="w-2.5 h-2.5 text-orange-400" />}
              <span className="text-xs font-black">{player.streak > 1 ? player.streak : player.totalMvp}</span>
            </div>
            <p className="text-[7px] text-muted-foreground uppercase tracking-widest font-semibold">
              {player.streak > 1 ? 'STREAK' : 'MVP'}
            </p>
          </div>
        </div>

        {/* Win rate bar — esports HUD */}
        <div className="mt-2">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[7px] text-muted-foreground uppercase tracking-widest font-semibold">Win Rate</span>
            <span className={`text-[10px] font-black ${winRate >= 60 ? 'text-green-500' : winRate >= 40 ? 'text-yellow-500' : 'text-red-500'}`}>{winRate}%</span>
          </div>
          <div className={`h-1.5 rounded-full ${dt.bgSubtle} overflow-hidden`}>
            <div
              className={`h-full rounded-full transition-[width] duration-500 ease-out ${
                winRate >= 60 ? `bg-gradient-to-r ${division === 'male' ? 'from-idm-male to-idm-male-light' : 'from-idm-female to-idm-female-light'}` :
                winRate >= 40 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${winRate}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Dance Tournament Roster-style Participant Row ─── */
function ParticipantTableRow({ player, rank, onClick }: {
  player: Player;
  rank: number;
  onClick: () => void;
}) {
  const dt = useDivisionTheme();
  const division = useAppStore(s => s.division);
  const isTop3 = rank <= 3;
  const isChampion = rank === 1;
  const winRate = player.matches > 0 ? Math.round((player.totalWins / player.matches) * 100) : 0;

  return (
    <div
      onClick={onClick}
      className={`hover-scale-sm flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all duration-200 border-b ${
        dt.borderSubtle
      } ${isChampion ? `${dt.bgSubtle} border-l-2 border-l-yellow-500` : isTop3 ? `${dt.bgSubtle} border-l-2 border-l-current` : `${dt.hoverBgSubtle}`}`}
      style={!isChampion && isTop3 ? { borderLeftColor: 'var(--idm-male, var(--idm-female))' } as React.CSSProperties : undefined}
    >
      {/* Rank — esports poster style large number */}
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
        rank === 1 ? 'bg-yellow-500/20 text-yellow-500' :
        rank === 2 ? 'bg-gray-400/15 text-muted-foreground' :
        rank === 3 ? 'bg-amber-600/15 text-amber-600' :
        `${dt.bgSubtle} text-muted-foreground`
      }`}>
        {rank}
      </div>

      {/* Avatar + Info */}
      <div className={`w-9 h-9 rounded-lg ${isTop3
        ? 'bg-gradient-to-br ' + (division === 'male' ? 'from-idm-male to-idm-male-light' : 'from-idm-female to-idm-female-light') + ' text-white'
        : dt.iconBg + ' ' + dt.text
      } flex items-center justify-center text-[10px] font-bold shrink-0 shadow-sm`}>
        {player.gamertag.slice(0, 2).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={`text-xs font-bold truncate ${isTop3 ? dt.neonText : ''}`}>{player.gamertag}</p>
          {isChampion && <Crown className="w-3 h-3 text-yellow-500 shrink-0" />}
          {player.streak > 2 && <Flame className="w-3 h-3 text-orange-400 shrink-0" />}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {clubToString(player.club as any) && (
            <span className="text-[9px] text-muted-foreground truncate flex items-center gap-0.5">
              <Shield className="w-2.5 h-2.5" />
              {clubToString(player.club as any)}
            </span>
          )}
        </div>
      </div>

      {/* Win Rate mini bar */}
      <div className="hidden sm:flex items-center gap-1.5 shrink-0">
        <div className={`w-14 h-1.5 rounded-full ${dt.bgSubtle} overflow-hidden`}>
          <div
            className={`h-full rounded-full transition-[width] duration-500 ease-out ${winRate >= 60 ? `bg-gradient-to-r ${division === 'male' ? 'from-idm-male to-idm-male-light' : 'from-idm-female to-idm-female-light'}` : winRate >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${winRate}%` }}
          />
        </div>
        <span className={`text-[9px] font-bold w-7 text-right ${winRate >= 60 ? dt.neonText : 'text-muted-foreground'}`}>{winRate}%</span>
      </div>

      {/* Quick stats pills */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-center">
          <p className={`text-[10px] font-black ${isTop3 ? dt.neonText : ''}`}>{player.points}</p>
          <p className="text-[7px] text-muted-foreground">PTS</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-black text-green-500">{player.totalWins}</p>
          <p className="text-[7px] text-muted-foreground">W</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-black text-yellow-500">{player.totalMvp}</p>
          <p className="text-[7px] text-muted-foreground">MVP</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Main ParticipantGrid Component ─── */
export function ParticipantGrid({ players, onPlayerClick }: ParticipantGridProps) {
  const dt = useDivisionTheme();
  const division = useAppStore(s => s.division);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [sortBy, setSortBy] = useState<'points' | 'wins' | 'winrate' | 'mvp'>('points');
  const [showAll, setShowAll] = useState(false);

  /* Filtered and sorted players */
  const filteredPlayers = useMemo(() => {
    if (!players) return [];
    let result = searchQuery
      ? players.filter(p =>
          p.gamertag.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (clubToString(p.club as any) && clubToString(p.club as any).toLowerCase().includes(searchQuery.toLowerCase()))
        )
      : players;

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'wins': return b.totalWins - a.totalWins;
        case 'winrate': return (b.totalWins / (b.matches || 1)) - (a.totalWins / (a.matches || 1));
        case 'mvp': return b.totalMvp - a.totalMvp;
        default: return b.points - a.points;
      }
    });

    return result;
  }, [players, searchQuery, sortBy]);

  const displayedPlayers = showAll ? filteredPlayers : filteredPlayers.slice(0, 12);

  return (
    <Card className={`${dt.casinoCard} overflow-hidden`}>
      <div className={dt.casinoBar} />

      {/* Header — Dance tournament roster banner style */}
      <div className={`relative px-4 py-3 border-b ${dt.borderSubtle}`}>
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${division === 'male' ? 'from-idm-male to-idm-male-light' : 'from-idm-female to-idm-female-light'} flex items-center justify-center shrink-0 shadow-md`}>
            <Users className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider">Daftar Peserta</h3>
            <p className="text-[9px] text-muted-foreground">{division === 'male' ? '🕺 Divisi Cowo' : '💃 Divisi Cewe'}</p>
          </div>
          <Badge className={`${dt.casinoBadge} ml-auto text-[9px]`}>{filteredPlayers.length} Players</Badge>
        </div>
      </div>

      {/* Search bar + View toggle + Sort */}
      <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${dt.borderSubtle}`}>
        <div className={`flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg ${dt.bgSubtle} ${dt.borderSubtle} border`}>
          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Cari player atau club..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-muted-foreground hover:text-foreground">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
        {/* Sort toggle */}
        <div className={`hidden sm:flex items-center gap-1 p-0.5 rounded-lg ${dt.bgSubtle} ${dt.borderSubtle} border`}>
          {[
            { value: 'points' as const, label: 'PTS' },
            { value: 'wins' as const, label: 'W' },
            { value: 'winrate' as const, label: 'WR' },
            { value: 'mvp' as const, label: 'MVP' },
          ].map(s => (
            <button
              key={s.value}
              onClick={() => setSortBy(s.value)}
              className={`px-2 py-1 rounded-md text-[9px] font-bold transition-all ${
                sortBy === s.value ? `${dt.bg} ${dt.text} shadow-sm` : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {/* View toggle */}
        <div className={`flex items-center rounded-lg ${dt.bgSubtle} ${dt.borderSubtle} border p-0.5`}>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? `${dt.bg} shadow-sm` : 'text-muted-foreground hover:text-foreground'}`}
            title="Tampilan daftar"
          >
            <List className={`w-3.5 h-3.5 ${viewMode === 'list' ? dt.text : ''}`} />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? `${dt.bg} shadow-sm` : 'text-muted-foreground hover:text-foreground'}`}
            title="Tampilan grid"
          >
            <Grid3X3 className={`w-3.5 h-3.5 ${viewMode === 'grid' ? dt.text : ''}`} />
          </button>
        </div>
      </div>

      {/* List View — Dance Tournament Roster Style */}
      {viewMode === 'list' && (
        <div className="max-h-[520px] overflow-y-auto custom-scrollbar">
          {displayedPlayers.length > 0 ? (
            displayedPlayers.map((p, idx) => (
              <ParticipantTableRow
                key={p.id}
                player={p}
                rank={idx + 1}
                onClick={() => onPlayerClick(p)}
              />
            ))
          ) : (
            <div className="py-8 text-center">
              <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Tidak ada player ditemukan</p>
            </div>
          )}
        </div>
      )}

      {/* Grid View — Dance Tournament Poster/Roster Card Style */}
      {viewMode === 'grid' && (
        <div className="p-3 max-h-[600px] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {displayedPlayers.map((p, idx) => (
              <ParticipantCard
                key={p.id}
                player={p}
                rank={idx + 1}
                onClick={() => onPlayerClick(p)}
              />
            ))}
          </div>
          {filteredPlayers.length === 0 && (
            <div className="py-8 text-center">
              <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Tidak ada player ditemukan</p>
            </div>
          )}
        </div>
      )}

      {/* Show More/Less */}
      {filteredPlayers.length > 12 && (
        <div className={`flex items-center justify-center py-2.5 border-t ${dt.borderSubtle}`}>
          <button
            onClick={() => setShowAll(!showAll)}
            className={`flex items-center gap-1 text-[10px] font-medium ${dt.text} hover:underline`}
          >
            {showAll ? <><ChevronUp className="w-3 h-3" /> Sembunyikan</> : <><ChevronDown className="w-3 h-3" /> Tampilkan Semua ({filteredPlayers.length})</>}
          </button>
        </div>
      )}
    </Card>
  );
}
