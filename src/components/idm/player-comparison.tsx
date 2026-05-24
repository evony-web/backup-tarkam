'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  X, Search, Loader2, Shield, ChevronRight, Trophy, Crown, Award, Flame, Swords, TrendingUp, Zap,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { useAppStore } from '@/lib/store';
import { getAvatarUrl, clubToString, toStrictDivision } from '@/lib/utils';
import { AvatarMedia } from '@/components/ui/avatar-media';

/* ─── Types ─── */

interface ComparePlayer {
  id: string;
  gamertag: string;
  name: string;
  avatar?: string | null;
  division: string;
  tier: string;
  points: number;
  totalWins: number;
  totalMvp: number;
  streak: number;
  maxStreak: number;
  matches: number;
  rank: number;
  club: { id: string; name: string; logo?: string | null } | null;
  achievements: {
    id: string;
    name: string;
    displayName: string;
    icon: string;
    tier: string;
    category: string;
    earnedAt: string;
  }[];
  tierScore: number;
}

interface SearchResultPlayer {
  id: string;
  gamertag: string;
  division: string;
  tier: string;
  points: number;
  totalWins: number;
  totalMvp: number;
  avatar?: string | null;
  club: { id: string; name: string; logo?: string | null } | null;
  rank: number;
}

interface PlayerComparisonProps {
  open: boolean;
  onClose: () => void;
}

/* ─── Stat Categories for Comparison ─── */

const STAT_CATEGORIES = [
  { key: 'points', label: 'Points', icon: Zap },
  { key: 'totalWins', label: 'Wins', icon: Trophy },
  { key: 'totalMvp', label: 'MVP', icon: Crown },
  { key: 'matches', label: 'Matches', icon: Swords },
  { key: 'streak', label: 'Streak', icon: Flame },
] as const;

/* ─── Player Search Dropdown ─── */

function PlayerSearchDropdown({
  label,
  selectedPlayer,
  onSelect,
  excludeId,
}: {
  label: string;
  selectedPlayer: SearchResultPlayer | null;
  onSelect: (player: SearchResultPlayer) => void;
  excludeId?: string;
}) {
  const dt = useDivisionTheme();
  const division = useAppStore(s => s.division);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/players/search?q=${encodeURIComponent(q.trim())}&division=${division}`);
      if (res.ok) {
        const data = await res.json();
        // Exclude the other player if specified
        const filtered = excludeId
          ? (data.players || []).filter((p: SearchResultPlayer) => p.id !== excludeId)
          : data.players || [];
        setResults(filtered);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [division, excludeId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 250);
  };

  const handleSelect = (player: SearchResultPlayer) => {
    onSelect(player);
    setQuery('');
    setResults([]);
    setFocused(false);
    inputRef.current?.blur();
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (selectedPlayer) {
    const avatarSrc = getAvatarUrl(selectedPlayer.gamertag, toStrictDivision(division), selectedPlayer.avatar);
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`relative rounded-2xl overflow-hidden ${dt.casinoCard} border ${dt.border}`}
      >
        <div className={dt.casinoBar} />
        <div className="p-4 flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 border border-border/20 shadow-lg">
            <AvatarMedia src={avatarSrc} alt={selectedPlayer.gamertag} width={56} height={56} className="w-full h-full object-cover" loading="lazy" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold truncate">{selectedPlayer.gamertag}</span>
            </div>
            {clubToString(selectedPlayer.club) && (
              <div className="flex items-center gap-1 mt-0.5">
                <Shield className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="text-[10px] text-muted-foreground truncate">{clubToString(selectedPlayer.club)}</span>
              </div>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs font-bold ${dt.neonText}`}>{selectedPlayer.points} pts</span>
              <span className="text-[10px] text-green-400">{selectedPlayer.totalWins}W</span>
              {selectedPlayer.totalMvp > 0 && (
                <span className="text-[10px] text-yellow-400">{selectedPlayer.totalMvp} MVP</span>
              )}
            </div>
          </div>
          <button
            onClick={() => onSelect(null as any)}
            className="p-1.5 rounded-lg hover:bg-muted/30 transition-colors shrink-0"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className={`rounded-2xl transition-all ${dt.casinoCard} border ${focused ? `${dt.border} shadow-lg` : 'border-border/50'}`}>
        <div className={dt.casinoBar} />
        <div className="flex items-center gap-2 px-3 py-3">
          <div className={`w-8 h-8 rounded-lg ${dt.iconBg} flex items-center justify-center shrink-0`}>
            <Search className={`w-4 h-4 ${dt.neonText}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">{label}</p>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              onFocus={() => setFocused(true)}
              placeholder="Cari pemain..."
              className="w-full bg-transparent text-sm font-medium placeholder:text-muted-foreground/40 focus:outline-none"
            />
          </div>
          {loading ? (
            <Loader2 className={`w-4 h-4 animate-spin ${dt.neonText} shrink-0`} />
          ) : query ? (
            <button
              onClick={() => { setQuery(''); setResults([]); }}
              className="p-1 rounded-full hover:bg-muted/50 shrink-0"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Dropdown */}
      {focused && query.length > 0 && (
        <div className={`absolute z-50 left-0 right-0 mt-1 rounded-2xl ${dt.casinoCard} border ${dt.border} shadow-xl shadow-black/20 overflow-hidden`}>
          {loading ? (
            <div className="px-4 py-4 text-center">
              <Loader2 className={`w-5 h-5 mx-auto animate-spin ${dt.neonText}`} />
            </div>
          ) : results.length > 0 ? (
            <div className="max-h-56 overflow-y-auto custom-scrollbar py-1">
              {results.map(player => {
                const avatarSrc = getAvatarUrl(player.gamertag, toStrictDivision(division), player.avatar);
                return (
                  <button
                    key={player.id}
                    onClick={() => handleSelect(player)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/30 ${dt.hoverBgSubtle}`}
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-border/20">
                      <AvatarMedia src={avatarSrc} alt={player.gamertag} width={32} height={32} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold truncate">{player.gamertag}</span>

                      </div>
                      {clubToString(player.club) && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Shield className="w-2.5 h-2.5 shrink-0" />{clubToString(player.club)}
                        </span>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xs font-bold ${dt.neonText}`}>{player.points} pts</p>
                      <p className="text-[9px] text-muted-foreground">{player.totalWins}W</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-4 text-center">
              <p className="text-xs text-muted-foreground">Tidak ditemukan</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Comparison Charts ─── */

function ComparisonRadar({ player1, player2, dt }: { player1: ComparePlayer; player2: ComparePlayer; dt: ReturnType<typeof useDivisionTheme> }) {
  // Normalize values for radar chart (0-100 scale)
  const normalize = (value: number, max: number) => max > 0 ? Math.round((value / max) * 100) : 0;

  const maxPoints = Math.max(player1.points, player2.points, 1);
  const maxWins = Math.max(player1.totalWins, player2.totalWins, 1);
  const maxMvp = Math.max(player1.totalMvp, player2.totalMvp, 1);
  const maxMatches = Math.max(player1.matches, player2.matches, 1);
  const maxStreak = Math.max(player1.streak, player2.streak, 1);

  const radarData = [
    { subject: 'Points', p1: normalize(player1.points, maxPoints), p2: normalize(player2.points, maxPoints), fullMark: 100 },
    { subject: 'Wins', p1: normalize(player1.totalWins, maxWins), p2: normalize(player2.totalWins, maxWins), fullMark: 100 },
    { subject: 'MVP', p1: normalize(player1.totalMvp, maxMvp), p2: normalize(player2.totalMvp, maxMvp), fullMark: 100 },
    { subject: 'Matches', p1: normalize(player1.matches, maxMatches), p2: normalize(player2.matches, maxMatches), fullMark: 100 },
    { subject: 'Streak', p1: normalize(player1.streak, maxStreak), p2: normalize(player2.streak, maxStreak), fullMark: 100 },
  ];

  const color1 = dt.division === 'male' ? '#57B5FF' : '#FF5C9A';
  const color2 = '#f59e0b'; // amber for contrast

  return (
    <div className="w-full h-[300px] sm:h-[340px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 600 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={false}
            axisLine={false}
          />
          <Radar
            name={player1.gamertag}
            dataKey="p1"
            stroke={color1}
            fill={color1}
            fillOpacity={0.15}
            strokeWidth={2}
          />
          <Radar
            name={player2.gamertag}
            dataKey="p2"
            stroke={color2}
            fill={color2}
            fillOpacity={0.15}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color1 }} />
          <span className="text-[10px] font-semibold text-muted-foreground truncate max-w-[80px]">{player1.gamertag}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color2 }} />
          <span className="text-[10px] font-semibold text-muted-foreground truncate max-w-[80px]">{player2.gamertag}</span>
        </div>
      </div>
    </div>
  );
}

function ComparisonBarChart({ player1, player2, dt }: { player1: ComparePlayer; player2: ComparePlayer; dt: ReturnType<typeof useDivisionTheme> }) {
  const color1 = dt.division === 'male' ? '#57B5FF' : '#FF5C9A';
  const color2 = '#f59e0b';

  const barData = STAT_CATEGORIES.map(cat => ({
    name: cat.label,
    p1: (player1 as any)[cat.key] as number,
    p2: (player2 as any)[cat.key] as number,
  }));

  const getWinner = (key: string) => {
    const v1 = (player1 as any)[key] as number;
    const v2 = (player2 as any)[key] as number;
    if (v1 > v2) return 'p1';
    if (v2 > v1) return 'p2';
    return 'tie';
  };

  return (
    <div className="w-full h-[240px] sm:h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} axisLine={{ stroke: 'hsl(var(--border))' }} />
          <YAxis type="category" dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 600 }} axisLine={false} width={55} />
          <Tooltip
            content={({ active, payload, label: lbl }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="rounded-lg bg-card border border-border/30 p-2 shadow-xl text-xs">
                    <p className="font-semibold mb-1">{lbl}</p>
                    {payload.map((entry: any, idx: number) => (
                      <p key={idx} style={{ color: entry.color }} className="font-medium">
                        {entry.name}: {entry.value}
                      </p>
                    ))}
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="p1" name={player1.gamertag} radius={[0, 4, 4, 0]} barSize={12}>
            {barData.map((entry, idx) => (
              <Cell
                key={`p1-${idx}`}
                fill={getWinner(STAT_CATEGORIES[idx].key) === 'p1' ? color1 : `${color1}55`}
              />
            ))}
          </Bar>
          <Bar dataKey="p2" name={player2.gamertag} radius={[0, 4, 4, 0]} barSize={12}>
            {barData.map((entry, idx) => (
              <Cell
                key={`p2-${idx}`}
                fill={getWinner(STAT_CATEGORIES[idx].key) === 'p2' ? color2 : `${color2}55`}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─── Stat Comparison Row ─── */

function StatComparisonRow({ label, value1, value2, icon: Icon, dt }: {
  label: string;
  value1: number;
  value2: number;
  icon: React.ComponentType<{ className?: string }>;
  dt: ReturnType<typeof useDivisionTheme>;
}) {
  const winner = value1 > value2 ? 'p1' : value2 > value1 ? 'p2' : 'tie';
  const color1 = dt.division === 'male' ? '#57B5FF' : '#FF5C9A';
  const color2 = '#f59e0b';

  return (
    <div className={`flex items-center gap-2 p-3 sm:p-4 rounded-lg ${dt.bgSubtle} ${dt.borderSubtle} border`}>
      {/* P1 value */}
      <div className="w-16 text-right shrink-0">
        <span
          className="text-sm font-bold"
          style={{ color: winner === 'p1' ? color1 : 'hsl(var(--muted-foreground))' }}
        >
          {value1}
        </span>
      </div>
      {/* Center label */}
      <div className="flex-1 flex flex-col items-center min-w-0">
        <Icon className={`w-3.5 h-3.5 ${dt.neonText} mb-0.5`} />
        <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        {winner !== 'tie' && (
          <span className="text-[8px] font-bold mt-0.5" style={{ color: winner === 'p1' ? color1 : color2 }}>
            ▲
          </span>
        )}
      </div>
      {/* P2 value */}
      <div className="w-16 text-left shrink-0">
        <span
          className="text-sm font-bold"
          style={{ color: winner === 'p2' ? color2 : 'hsl(var(--muted-foreground))' }}
        >
          {value2}
        </span>
      </div>
    </div>
  );
}

/* ─── Verdict ─── */

function ComparisonVerdict({ player1, player2, dt }: { player1: ComparePlayer; player2: ComparePlayer; dt: ReturnType<typeof useDivisionTheme> }) {
  let p1Wins = 0;
  let p2Wins = 0;
  STAT_CATEGORIES.forEach(cat => {
    const v1 = (player1 as any)[cat.key] as number;
    const v2 = (player2 as any)[cat.key] as number;
    if (v1 > v2) p1Wins++;
    else if (v2 > v1) p2Wins++;
  });

  const color1 = dt.division === 'male' ? '#57B5FF' : '#FF5C9A';
  const color2 = '#f59e0b';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      className={`rounded-2xl p-4 ${dt.bgSubtle} ${dt.border} border text-center`}
    >
      <div className="flex items-center justify-center gap-1 mb-2">
        <TrendingUp className={`w-4 h-4 ${dt.neonText}`} />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Verdict</span>
      </div>
      <div className="flex items-center justify-center gap-4">
        {/* P1 wins */}
        <div className="text-center">
          <p className="text-2xl font-black" style={{ color: color1 }}>{p1Wins}</p>
          <p className="text-[9px] text-muted-foreground truncate max-w-[80px]">{player1.gamertag}</p>
        </div>
        {/* VS */}
        <div className="flex flex-col items-center">
          <span className={`text-[10px] font-bold ${dt.neonText}`}>VS</span>
          <span className="text-[8px] text-muted-foreground">
            {5 - p1Wins - p2Wins > 0 ? `${5 - p1Wins - p2Wins} seri` : ''}
          </span>
        </div>
        {/* P2 wins */}
        <div className="text-center">
          <p className="text-2xl font-black" style={{ color: color2 }}>{p2Wins}</p>
          <p className="text-[9px] text-muted-foreground truncate max-w-[80px]">{player2.gamertag}</p>
        </div>
      </div>
      {p1Wins !== p2Wins && (
        <div className="mt-2">
          <Badge className="bg-green-500/15 text-green-400 border-0 text-[10px]">
            🏆 {p1Wins > p2Wins ? player1.gamertag : player2.gamertag} unggul di {Math.max(p1Wins, p2Wins)}/5 kategori
          </Badge>
        </div>
      )}
      {p1Wins === p2Wins && (
        <div className="mt-2">
          <Badge className="bg-yellow-500/15 text-yellow-400 border-0 text-[10px]">
            ⚖️ Seri! Keduanya sama kuat
          </Badge>
        </div>
      )}
    </motion.div>
  );
}

/* ─── Main PlayerComparison Component ─── */

export function PlayerComparison({ open, onClose }: PlayerComparisonProps) {
  const dt = useDivisionTheme();
  const division = useAppStore(s => s.division);
  const [player1Search, setPlayer1Search] = useState<SearchResultPlayer | null>(null);
  const [player2Search, setPlayer2Search] = useState<SearchResultPlayer | null>(null);

  // Fetch comparison data when both players are selected
  const { data: compareData, isLoading: compareLoading } = useQuery({
    queryKey: ['player-compare', player1Search?.id, player2Search?.id],
    queryFn: async () => {
      const res = await fetch(`/api/players/compare?player1=${player1Search!.id}&player2=${player2Search!.id}`);
      if (!res.ok) throw new Error('Failed to compare');
      return res.json();
    },
    enabled: !!player1Search && !!player2Search,
    staleTime: 30000,
  });

  const p1 = compareData?.player1 as ComparePlayer | undefined;
  const p2 = compareData?.player2 as ComparePlayer | undefined;

  // Lock body scroll when modal open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const handleClose = () => {
    setPlayer1Search(null);
    setPlayer2Search(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70"
            onClick={handleClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 60, scale: 0.97 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`relative z-10 w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar rounded-t-2xl sm:rounded-2xl ${dt.casinoCard} border ${dt.border} shadow-2xl`}
          >
            <div className={dt.casinoBar} />

            {/* Header */}
            <div className={`sticky top-0 z-20 flex items-center gap-3 px-4 py-3 border-b ${dt.borderSubtle} bg-background/98`}>
              <div className={`w-8 h-8 rounded-lg ${dt.iconBg} flex items-center justify-center shrink-0`}>
                <Swords className={`w-4 h-4 ${dt.neonText}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold uppercase tracking-wider">Bandingkan Pemain</h3>
                <p className="text-[10px] text-muted-foreground">Pilih dua pemain untuk dibandingkan</p>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg hover:bg-muted/30 transition-colors shrink-0"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Search Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <PlayerSearchDropdown
                  label="Pemain 1"
                  selectedPlayer={player1Search}
                  onSelect={setPlayer1Search}
                  excludeId={player2Search?.id}
                />
                <PlayerSearchDropdown
                  label="Pemain 2"
                  selectedPlayer={player2Search}
                  onSelect={setPlayer2Search}
                  excludeId={player1Search?.id}
                />
              </div>

              {/* Comparison Content */}
              {compareLoading && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className={`w-8 h-8 animate-spin ${dt.neonText} mb-3`} />
                  <p className="text-xs text-muted-foreground">Memuat data perbandingan...</p>
                </div>
              )}

              {p1 && p2 && !compareLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="space-y-4"
                >
                  {/* Side-by-side avatar cards */}
                  <div className="grid grid-cols-2 gap-3">
                    {[p1, p2].map((player, idx) => {
                      const avatarSrc = getAvatarUrl(player.gamertag, player.division as 'male' | 'female', player.avatar);
                      const color = idx === 0
                        ? (dt.division === 'male' ? '#57B5FF' : '#FF5C9A')
                        : '#f59e0b';
                      return (
                        <motion.div
                          key={player.id}
                          initial={{ opacity: 0, x: idx === 0 ? -20 : 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 * idx, duration: 0.35 }}
                          className={`rounded-2xl overflow-hidden ${dt.casinoCard} border border-border/30`}
                        >
                          {/* Avatar header */}
                          <div className="relative h-24 sm:h-28">
                            <AvatarMedia
                              src={avatarSrc}
                              alt={player.gamertag}
                              fill
                              sizes="(max-width: 640px) 50vw, 300px"
                              objectPosition="top"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
                            {/* Player number */}
                            <div
                              className="absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black"
                              style={{ backgroundColor: `${color}25`, color }}
                            >
                              {idx + 1}
                            </div>
                            {/* Rank badge */}
                            {player.rank > 0 && (
                              <Badge className="absolute top-2 right-2 bg-black/60 text-white text-[8px] border-0">
                                #{player.rank}
                              </Badge>
                            )}
                          </div>
                          {/* Player info */}
                          <div className="p-3 -mt-4 relative z-10">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold truncate">{player.gamertag}</span>
      
                            </div>
                            {clubToString(player.club as any) && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <Shield className="w-3 h-3 text-muted-foreground shrink-0" />
                                <span className="text-[10px] text-muted-foreground truncate">{clubToString(player.club as any)}</span>
                              </div>
                            )}
                            {/* Mini stats */}
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/20">
                              <div className="text-center flex-1">
                                <p className="text-xs font-bold" style={{ color }}>{player.points}</p>
                                <p className="text-[8px] text-muted-foreground">PTS</p>
                              </div>
                              <div className="text-center flex-1">
                                <p className="text-xs font-bold text-green-400">{player.totalWins}</p>
                                <p className="text-[8px] text-muted-foreground">WIN</p>
                              </div>
                              <div className="text-center flex-1">
                                <p className="text-xs font-bold text-yellow-400">{player.totalMvp}</p>
                                <p className="text-[8px] text-muted-foreground">MVP</p>
                              </div>
                              <div className="text-center flex-1">
                                <p className="text-xs font-bold text-orange-400">{player.streak}</p>
                                <p className="text-[8px] text-muted-foreground">STR</p>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Verdict */}
                  <ComparisonVerdict player1={p1} player2={p2} dt={dt} />

                  {/* Radar Chart */}
                  <Card className={`${dt.casinoCard} border ${dt.border} overflow-hidden`}>
                    <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${dt.borderSubtle}`}>
                      <Zap className={`w-3.5 h-3.5 ${dt.neonText}`} />
                      <span className="text-[10px] font-semibold uppercase tracking-wider">Radar Perbandingan</span>
                    </div>
                    <div className="p-3">
                      <ComparisonRadar player1={p1} player2={p2} dt={dt} />
                    </div>
                  </Card>

                  {/* Head-to-Head Bar Chart */}
                  <Card className={`${dt.casinoCard} border ${dt.border} overflow-hidden`}>
                    <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${dt.borderSubtle}`}>
                      <Swords className={`w-3.5 h-3.5 ${dt.neonText}`} />
                      <span className="text-[10px] font-semibold uppercase tracking-wider">Stat Head-to-Head</span>
                    </div>
                    <div className="p-3">
                      <ComparisonBarChart player1={p1} player2={p2} dt={dt} />
                    </div>
                  </Card>

                  {/* Detailed Stat Rows */}
                  <Card className={`${dt.casinoCard} border ${dt.border} overflow-hidden`}>
                    <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${dt.borderSubtle}`}>
                      <Trophy className={`w-3.5 h-3.5 ${dt.neonText}`} />
                      <span className="text-[10px] font-semibold uppercase tracking-wider">Detail Perbandingan</span>
                    </div>
                    <div className="p-3 space-y-2">
                      {STAT_CATEGORIES.map(cat => (
                        <StatComparisonRow
                          key={cat.key}
                          label={cat.label}
                          value1={(p1 as any)[cat.key] as number}
                          value2={(p2 as any)[cat.key] as number}
                          icon={cat.icon}
                          dt={dt}
                        />
                      ))}
                      {/* Max Streak extra */}
                      <StatComparisonRow
                        label="Max Streak"
                        value1={p1.maxStreak}
                        value2={p2.maxStreak}
                        icon={Flame}
                        dt={dt}
                      />
                    </div>
                  </Card>

                  {/* Achievements comparison */}
                  <Card className={`${dt.casinoCard} border ${dt.border} overflow-hidden`}>
                    <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${dt.borderSubtle}`}>
                      <Award className={`w-3.5 h-3.5 ${dt.neonText}`} />
                      <span className="text-[10px] font-semibold uppercase tracking-wider">Prestasi</span>
                    </div>
                    <div className="p-3">
                      <div className="grid grid-cols-2 gap-3">
                        {/* P1 achievements */}
                        <div>
                          <p className="text-[9px] font-semibold text-muted-foreground mb-1.5 truncate">{p1.gamertag}</p>
                          {p1.achievements.length > 0 ? (
                            <div className="space-y-1">
                              {p1.achievements.slice(0, 5).map(a => (
                                <div key={a.id} className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${dt.bgSubtle}`}>
                                  <span className="text-xs">{a.icon}</span>
                                  <span className="text-[9px] font-medium truncate">{a.displayName}</span>
                                </div>
                              ))}
                              {p1.achievements.length > 5 && (
                                <p className="text-[8px] text-muted-foreground text-center">+{p1.achievements.length - 5} lagi</p>
                              )}
                            </div>
                          ) : (
                            <p className="text-[9px] text-muted-foreground/50">Belum ada prestasi</p>
                          )}
                        </div>
                        {/* P2 achievements */}
                        <div>
                          <p className="text-[9px] font-semibold text-muted-foreground mb-1.5 truncate">{p2.gamertag}</p>
                          {p2.achievements.length > 0 ? (
                            <div className="space-y-1">
                              {p2.achievements.slice(0, 5).map(a => (
                                <div key={a.id} className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${dt.bgSubtle}`}>
                                  <span className="text-xs">{a.icon}</span>
                                  <span className="text-[9px] font-medium truncate">{a.displayName}</span>
                                </div>
                              ))}
                              {p2.achievements.length > 5 && (
                                <p className="text-[8px] text-muted-foreground text-center">+{p2.achievements.length - 5} lagi</p>
                              )}
                            </div>
                          ) : (
                            <p className="text-[9px] text-muted-foreground/50">Belum ada prestasi</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )}

              {/* Prompt when no players selected */}
              {!p1 && !p2 && !compareLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-8 text-center"
                >
                  <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    className="mb-3"
                  >
                    <Swords className={`w-10 h-10 ${dt.neonText} opacity-30`} />
                  </motion.div>
                  <p className="text-xs text-muted-foreground font-medium">Pilih dua pemain untuk mulai</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">Gunakan kolom pencarian di atas</p>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
