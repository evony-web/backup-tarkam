'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, useCallback, useRef, useEffect } from 'react';
import { Swords, Search, Trophy, Flame, Medal, BarChart3, X } from 'lucide-react';
import { SectionHeader } from './shared';
import { AvatarMedia } from '@/components/ui/avatar-media';
import { getAvatarUrl } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════
   PLAYER COMPARISON TOOL SECTION
   Side-by-side comparison of 2 players with visual bar charts.
   Responsive — stacks vertically on mobile.
   Uses /api/players/search for dropdown search
   and /api/players/compare for full comparison data.
   ═══════════════════════════════════════════════════════════════ */

/* ─── Types ─── */
interface SearchPlayer {
  id: string;
  gamertag: string;
  division: string;
  tier: string;
  points: number;
  totalWins: number;
  totalMvp: number;
  avatar?: string | null;
  club: { id: string; name: string; logo: string | null } | null;
  rank: number;
}

interface ComparePlayer {
  id: string;
  gamertag: string;
  name: string;
  avatar: string | null;
  division: string;
  tier: string;
  points: number;
  totalWins: number;
  totalMvp: number;
  streak: number;
  maxStreak: number;
  matches: number;
  rank: number;
  club: { id: string; name: string; logo: string | null } | null;
  achievements: { id: string; displayName: string; icon: string; tier: string }[];
  tierScore: number;
}

/* ─── StatBar is defined at the bottom of the file (extended version with icon support) ─── */

/* ─── Player search dropdown ─── */
function PlayerSearchDropdown({
  division,
  selectedPlayer,
  onSelect,
  placeholder,
}: {
  division: 'male' | 'female';
  selectedPlayer: SearchPlayer | null;
  onSelect: (player: SearchPlayer) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: searchResults } = useQuery<{ players: SearchPlayer[] }>({
    queryKey: ['player-search', division, query],
    queryFn: async () => {
      if (!query || query.length < 2) return { players: [] };
      const res = await fetch(`/api/players/search?q=${encodeURIComponent(query)}&division=${division}`);
      if (!res.ok) return { players: [] };
      return res.json();
    },
    enabled: query.length >= 2,
    staleTime: 30000,
  });

  /* Close dropdown on outside click */
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const divisionColor = division === 'male' ? 'idm-male' : 'idm-female';

  return (
    <div ref={containerRef} className="relative">
      {selectedPlayer ? (
        /* Selected player chip */
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-idm-gold-warm/15 bg-idm-gold-warm/[0.04]">
          <div className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-idm-gold-warm/20 shrink-0">
            <AvatarMedia
              src={getAvatarUrl(selectedPlayer.gamertag, division, selectedPlayer.avatar)}
              alt={selectedPlayer.gamertag}
              fill
              sizes="32px"
              className="object-cover object-top"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold truncate">{selectedPlayer.gamertag}</p>
            <p className="text-[9px] text-muted-foreground">
              {selectedPlayer.club?.name || '—'} • #{selectedPlayer.rank || '?'}
            </p>
          </div>
          <button
            onClick={() => { onSelect(null as unknown as SearchPlayer); setQuery(''); }}
            className="p-1 rounded-md hover:bg-idm-gold-warm/10 transition-colors cursor-pointer shrink-0"
            aria-label="Hapus pilihan"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      ) : (
        /* Search input */
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
              onFocus={() => setIsOpen(true)}
              placeholder={placeholder}
              className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-xs border bg-background/50 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 transition-colors border-idm-gold-warm/10 focus:border-${divisionColor}/40 focus:ring-${divisionColor}/20`}
            />
          </div>

          {/* Dropdown results */}
          {isOpen && searchResults?.players && searchResults.players.length > 0 && (
            <div className="absolute z-30 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-xl border border-idm-gold-warm/15 bg-background shadow-xl shadow-black/30">
              {searchResults.players.map(player => (
                <button
                  key={player.id}
                  onClick={() => {
                    onSelect(player);
                    setQuery('');
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-idm-gold-warm/5 transition-colors cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-full overflow-hidden ring-1 ring-idm-gold-warm/15 shrink-0">
                    <AvatarMedia
                      src={getAvatarUrl(player.gamertag, division, player.avatar)}
                      alt={player.gamertag}
                      fill
                      sizes="28px"
                      className="object-cover object-top"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{player.gamertag}</p>
                    <p className="text-[9px] text-muted-foreground">
                      {player.tier} • {player.points} pts • {player.club?.name || '—'}
                    </p>
                  </div>
                  <span className="text-[9px] font-bold text-idm-gold-warm/50">#{player.rank}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Player card in comparison ─── */
function ComparePlayerCard({
  player,
  division,
  side,
}: {
  player: ComparePlayer;
  division: string;
  side: 'left' | 'right';
}) {
  const divisionColor = division === 'male' ? 'idm-male' : 'idm-female';
  const winRate = player.matches > 0 ? Math.round((player.totalWins / player.matches) * 100) : 0;
  const totalLosses = player.matches - player.totalWins;

  return (
    <div className="flex flex-col items-center text-center">
      {/* Avatar */}
      <div className="relative mb-2">
        <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden ring-2 ${side === 'left' ? 'ring-idm-gold-warm/30' : 'ring-idm-gold-warm/30'} shadow-[0_0_20px_rgba(239,249,35,0.1)]`}>
          <AvatarMedia
            src={getAvatarUrl(player.gamertag, division as 'male' | 'female', player.avatar)}
            alt={player.gamertag}
            fill
            sizes="80px"
            className="object-cover object-top"
          />
        </div>
        {/* Rank badge */}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-idm-gold-warm/10 border border-idm-gold-warm/20">
          <span className="text-[9px] font-black text-idm-gold-warm">#{player.rank}</span>
        </div>
      </div>

      {/* Name */}
      <h4 className="text-sm font-bold text-foreground truncate max-w-[120px] sm:max-w-[150px]">{player.gamertag}</h4>

      {/* Tier badge */}
      <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border bg-${divisionColor}/10 text-${divisionColor} border-${divisionColor}/20`}>
        Tier {player.tier}
      </span>

      {/* Club */}
      {player.club && (
        <p className="text-[10px] text-muted-foreground/70 mt-1 truncate max-w-[120px]">{player.club.name}</p>
      )}

      {/* Quick stats */}
      <div className="flex items-center justify-center gap-3 mt-3 text-[10px]">
        <div className="text-center">
          <p className="font-black text-idm-gold-warm">{player.points}</p>
          <p className="text-muted-foreground/60">Poin</p>
        </div>
        <div className="w-px h-6 bg-idm-gold-warm/10" />
        <div className="text-center">
          <p className="font-black text-green-400">{player.totalWins}</p>
          <p className="text-muted-foreground/60">Menang</p>
        </div>
        <div className="w-px h-6 bg-idm-gold-warm/10" />
        <div className="text-center">
          <p className="font-black text-red-400/70">{totalLosses}</p>
          <p className="text-muted-foreground/60">Kalah</p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export function PlayerComparisonSection() {
  const [division, setDivision] = useState<'male' | 'female'>('male');
  const [player1, setPlayer1] = useState<SearchPlayer | null>(null);
  const [player2, setPlayer2] = useState<SearchPlayer | null>(null);

  /* Fetch comparison data when both players are selected */
  const { data: compareData, isLoading: isComparing } = useQuery<{
    player1: ComparePlayer;
    player2: ComparePlayer;
  }>({
    queryKey: ['player-compare', player1?.id, player2?.id],
    queryFn: async () => {
      const res = await fetch(`/api/players/compare?player1=${player1!.id}&player2=${player2!.id}`);
      if (!res.ok) throw new Error('Failed to compare');
      return res.json();
    },
    enabled: !!player1 && !!player2 && player1.id !== player2.id,
    staleTime: 60000,
  });

  const divisionColor = division === 'male' ? 'idm-male' : 'idm-female';

  /* Reset players on division change */
  const handleDivisionChange = useCallback((newDiv: 'male' | 'female') => {
    setDivision(newDiv);
    setPlayer1(null);
    setPlayer2(null);
  }, []);

  const p1 = compareData?.player1;
  const p2 = compareData?.player2;

  return (
    <section className="relative py-8 sm:py-12" aria-label="Bandingkan Pemain">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        {/* Section Header */}
        <SectionHeader
          icon={Swords}
          label="Head to Head"
          title="Bandingkan Pemain"
          subtitle="Bandingkan statistik dua pemain secara langsung"
        />

        {/* Division Toggle */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <button
            onClick={() => handleDivisionChange('male')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border ${
              division === 'male'
                ? `border-idm-male/30 bg-idm-male/10 text-idm-male`
                : 'border-idm-gold-warm/10 bg-transparent text-muted-foreground hover:border-idm-male/20 hover:text-idm-male/70'
            }`}
          >
            ♂ Cowo
          </button>
          <button
            onClick={() => handleDivisionChange('female')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border ${
              division === 'female'
                ? `border-idm-female/30 bg-idm-female/10 text-idm-female`
                : 'border-idm-gold-warm/10 bg-transparent text-muted-foreground hover:border-idm-female/20 hover:text-idm-female/70'
            }`}
          >
            ♀ Cewe
          </button>
        </div>

        {/* Player Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 max-w-lg sm:max-w-2xl mx-auto">
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider mb-1.5">Pemain 1</label>
            <PlayerSearchDropdown
              division={division}
              selectedPlayer={player1}
              onSelect={(p: SearchPlayer | null) => setPlayer1(p)}
              placeholder="Cari pemain pertama..."
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider mb-1.5">Pemain 2</label>
            <PlayerSearchDropdown
              division={division}
              selectedPlayer={player2}
              onSelect={(p: SearchPlayer | null) => setPlayer2(p)}
              placeholder="Cari pemain kedua..."
            />
          </div>
        </div>

        {/* Comparison Results */}
        {isComparing ? (
          <div className="flex justify-center py-8">
            <div className="animate-pulse space-y-4 w-full max-w-2xl">
              <div className="flex justify-center gap-8">
                <div className="w-20 h-20 rounded-full bg-idm-gold-warm/10" />
                <div className="w-20 h-20 rounded-full bg-idm-gold-warm/10" />
              </div>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-6 rounded bg-idm-gold-warm/5" />
              ))}
            </div>
          </div>
        ) : p1 && p2 ? (
          <div className="max-w-2xl mx-auto">
            {/* VS Header */}
            <div className="flex items-center justify-center gap-4 sm:gap-8 mb-6">
              <div className="flex-1">
                <ComparePlayerCard player={p1} division={division} side="left" />
              </div>

              <div className="shrink-0 flex flex-col items-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-idm-gold-warm/20 bg-idm-gold-warm/5 flex items-center justify-center">
                  <Swords className="w-5 h-5 sm:w-6 sm:h-6 text-idm-gold-warm" />
                </div>
                <span className="text-[9px] font-black text-idm-gold-warm/50 mt-1">VS</span>
              </div>

              <div className="flex-1">
                <ComparePlayerCard player={p2} division={division} side="right" />
              </div>
            </div>

            {/* Stat comparison bars */}
            <div className="space-y-4 p-4 sm:p-5 rounded-2xl border border-idm-gold-warm/10 bg-idm-gold-warm/[0.02]">
              <StatBar label="Poin" leftValue={p1.points} rightValue={p2.points} icon={Trophy} />
              <StatBar label="Menang" leftValue={p1.totalWins} rightValue={p2.totalWins} />
              <StatBar
                label="Kalah"
                leftValue={p1.matches - p1.totalWins}
                rightValue={p2.matches - p2.totalWins}
              />
              <StatBar label="MVP" leftValue={p1.totalMvp} rightValue={p2.totalMvp} icon={Medal} />
              <StatBar label="Streak" leftValue={p1.streak} rightValue={p2.streak} icon={Flame} />
              <StatBar label="Max Streak" leftValue={p1.maxStreak} rightValue={p2.maxStreak} />
              <StatBar label="Match" leftValue={p1.matches} rightValue={p2.matches} />
              <StatBar
                label="Win Rate"
                leftValue={p1.matches > 0 ? Math.round((p1.totalWins / p1.matches) * 100) : 0}
                rightValue={p2.matches > 0 ? Math.round((p2.totalWins / p2.matches) * 100) : 0}
                format="percent"
              />
            </div>

            {/* Achievements comparison */}
            {(p1.achievements.length > 0 || p2.achievements.length > 0) && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border border-idm-gold-warm/10 bg-idm-gold-warm/[0.02]">
                  <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-2">Achievements</p>
                  <p className="text-lg font-black text-idm-gold-warm">{p1.achievements.length}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {p1.achievements.slice(0, 3).map(a => (
                      <span key={a.id} className="text-[8px] px-1.5 py-0.5 rounded bg-idm-gold-warm/5 text-idm-gold-warm/70 border border-idm-gold-warm/10">
                        {a.displayName}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="p-3 rounded-xl border border-idm-gold-warm/10 bg-idm-gold-warm/[0.02]">
                  <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-2">Achievements</p>
                  <p className="text-lg font-black text-idm-gold-warm">{p2.achievements.length}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {p2.achievements.slice(0, 3).map(a => (
                      <span key={a.id} className="text-[8px] px-1.5 py-0.5 rounded bg-idm-gold-warm/5 text-idm-gold-warm/70 border border-idm-gold-warm/10">
                        {a.displayName}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Empty state — prompt to select players */
          <div className="text-center py-8 sm:py-10">
            <div className="relative inline-block mb-3">
              <div className="absolute inset-0 rounded-full bg-idm-gold-warm/5 blur-xl" aria-hidden="true" />
              <BarChart3 className="relative w-10 h-10 sm:w-12 sm:h-12 text-idm-gold-warm/20" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground mb-1">Pilih dua pemain untuk dibandingkan</p>
            <p className="text-xs text-muted-foreground/60">Cari dan pilih pemain di atas untuk melihat perbandingan statistik</p>
          </div>
        )}
      </div>
    </section>
  );
}

/* ─── Extended StatBar with optional icon ─── */
function StatBar({
  label,
  leftValue,
  rightValue,
  format = 'number',
  icon: Icon,
}: {
  label: string;
  leftValue: number;
  rightValue: number;
  format?: 'number' | 'percent';
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const max = Math.max(leftValue, rightValue, 1);
  const leftPct = (leftValue / max) * 100;
  const rightPct = (rightValue / max) * 100;
  const leftWins = leftValue > rightValue;
  const rightWins = rightValue > leftValue;
  const tied = leftValue === rightValue;

  const formatVal = (v: number) => {
    if (format === 'percent') return `${v}%`;
    return v.toLocaleString('id-ID');
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] sm:text-xs">
        <span className={`font-bold tabular-nums min-w-[40px] text-left ${leftWins ? 'text-idm-gold-warm' : tied ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
          {formatVal(leftValue)}
        </span>
        <span className="flex items-center gap-1 font-medium text-muted-foreground/70 uppercase tracking-wider">
          {Icon && <Icon className="w-3 h-3" />}
          {label}
        </span>
        <span className={`font-bold tabular-nums min-w-[40px] text-right ${rightWins ? 'text-idm-gold-warm' : tied ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
          {formatVal(rightValue)}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <div className="flex-1 h-2 rounded-full bg-muted/30 overflow-hidden flex justify-end">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${leftWins ? 'bg-idm-gold-warm' : tied ? 'bg-idm-gold-warm/40' : 'bg-idm-gold-warm/20'}`}
            style={{ width: `${Math.max(leftPct, 2)}%` }}
          />
        </div>
        <div className="flex-1 h-2 rounded-full bg-muted/30 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${rightWins ? 'bg-idm-gold-warm' : tied ? 'bg-idm-gold-warm/40' : 'bg-idm-gold-warm/20'}`}
            style={{ width: `${Math.max(rightPct, 2)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
