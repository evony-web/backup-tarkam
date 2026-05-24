'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Users, Building2, ChevronRight, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCommunityTheme } from '@/hooks/use-community-theme';
import { getDivisionTheme } from '@/hooks/use-division-theme';
import type { TopPlayer } from '@/types/stats';

/* ═══════════════════════════════════════════════════════
   QUICK SEARCH — Search bar for players/clubs from dashboard
   ═══════════════════════════════════════════════════════ */

interface QuickSearchProps {
  onPlayerClick: (player: TopPlayer & { division?: string }, division: 'male' | 'female') => void;
}

/* ── Search result types ── */
interface PlayerResult {
  id: string;
  gamertag: string;
  division: string;
  tier: string;
  points: number;
  avatar?: string | null;
  club: { id: string; name: string; logo?: string | null } | null;
  city?: string;
  rank: number;
}

interface ClubResult {
  id: string;
  name: string;
  logo?: string | null;
  memberCount: number;
  points: number;
}

export function QuickSearch({ onPlayerClick }: QuickSearchProps) {
  const dt = useCommunityTheme();

  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [playerResults, setPlayerResults] = useState<PlayerResult[]>([]);
  const [clubResults, setClubResults] = useState<ClubResult[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasResults = playerResults.length > 0 || clubResults.length > 0;
  const showDropdown = isFocused && (query.trim().length > 0);

  /* ── Click outside to close ── */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /* ── Debounced search ── */
  const performSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setPlayerResults([]);
      setClubResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    try {
      // Search players in both divisions
      const [maleRes, femaleRes, clubRes] = await Promise.all([
        fetch(`/api/players/search?q=${encodeURIComponent(q)}&division=male`),
        fetch(`/api/players/search?q=${encodeURIComponent(q)}&division=female`),
        fetch(`/api/clubs?unified=true`),
      ]);

      const [maleData, femaleData, clubData] = await Promise.all([
        maleRes.ok ? maleRes.json() : { players: [] },
        femaleRes.ok ? femaleRes.json() : { players: [] },
        clubRes.ok ? clubRes.json() : [],
      ]);

      // Combine and deduplicate players, max 5
      const allPlayers: PlayerResult[] = [
        ...(maleData.players || []),
        ...(femaleData.players || []),
      ]
        .filter((p: PlayerResult) =>
          p.gamertag?.toLowerCase().includes(q.toLowerCase()) ||
          p.id?.toLowerCase().includes(q.toLowerCase())
        )
        .sort((a: PlayerResult, b: PlayerResult) => b.points - a.points)
        .slice(0, 5);

      setPlayerResults(allPlayers);

      // Filter clubs by name, max 5
      const filteredClubs: ClubResult[] = (clubData || [])
        .filter((c: ClubResult) => c.name?.toLowerCase().includes(q.toLowerCase()))
        .sort((a: ClubResult, b: ClubResult) => b.points - a.points)
        .slice(0, 5);

      setClubResults(filteredClubs);
    } catch {
      setPlayerResults([]);
      setClubResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  /* ── Input change handler with debounce ── */
  const handleInputChange = (value: string) => {
    setQuery(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!value.trim()) {
      setPlayerResults([]);
      setClubResults([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  /* ── Cleanup debounce on unmount ── */
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  /* ── Player click handler ── */
  const handlePlayerResultClick = (player: PlayerResult) => {
    const division = (player.division || 'male') as 'male' | 'female';
    onPlayerClick(
      {
        id: player.id,
        name: player.gamertag,
        gamertag: player.gamertag,
        avatar: player.avatar,
        tier: player.tier,
        points: player.points,
        totalWins: 0,
        streak: 0,
        maxStreak: 0,
        totalMvp: 0,
        matches: 0,
        club: player.club ? { id: player.club.id, name: player.club.name, logo: player.club.logo } : undefined,
        city: player.city,
        division: player.division,
      },
      division,
    );
    setQuery('');
    setPlayerResults([]);
    setClubResults([]);
    setIsFocused(false);
  };

  /* ── Get avatar initial ── */
  const getInitial = (name: string) => {
    return name?.charAt(0)?.toUpperCase() || '?';
  };

  return (
    <Card className={`${dt.casinoCard} overflow-hidden`}>
      <CardContent className="p-4 sm:p-6">
        {/* Search input */}
        <div ref={containerRef} className="relative">
          <div className={`relative flex items-center gap-2 px-3 py-2.5 rounded-2xl ${dt.casinoBar} border ${isFocused ? dt.border : dt.borderSubtle} transition-all duration-200`}>
            <Search className={`w-4 h-4 shrink-0 ${isFocused ? dt.text : 'text-muted-foreground'}`} />
            <input
              type="text"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => setIsFocused(true)}
              placeholder="Cari pemain atau klub..."
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
              aria-label="Cari pemain atau klub"
            />
            {isSearching && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
            )}
            {query && !isSearching && (
              <button
                onClick={() => { setQuery(''); setPlayerResults([]); setClubResults([]); }}
                className="w-5 h-5 rounded-full bg-muted/30 flex items-center justify-center hover:bg-muted/50 transition-colors"
                aria-label="Hapus pencarian"
              >
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Dropdown results */}
          {showDropdown && (
            <div
              className="absolute top-full left-0 right-0 z-40 mt-1.5 rounded-2xl border border-border/20 bg-background/95 backdrop-blur-xl shadow-xl overflow-hidden animate-fade-enter-sm"
            >
                {!hasResults && !isSearching && (
                  <div className="p-4 text-center">
                    <p className="text-[10px] text-muted-foreground/50">Tidak ada hasil untuk &quot;{query}&quot;</p>
                  </div>
                )}

                {/* Player results */}
                {playerResults.length > 0 && (
                  <div className="p-2">
                    <div className="flex items-center gap-1.5 px-2 py-1 mb-1">
                      <Users className="w-3 h-3 text-muted-foreground/60" />
                      <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Pemain</span>
                    </div>
                    {playerResults.map((player) => {
                      const pDiv = (player.division || 'male') as 'male' | 'female';
                      const pDt = getDivisionTheme(pDiv);

                      return (
                        <button
                          key={player.id}
                          onClick={() => handlePlayerResultClick(player)}
                          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-muted/20 transition-colors text-left group cursor-pointer"
                        >
                          {/* Avatar initial */}
                          <div className={`w-7 h-7 rounded-lg ${pDt.iconBg} flex items-center justify-center shrink-0`}>
                            <span className={`text-[10px] font-bold ${pDt.text}`}>{getInitial(player.gamertag)}</span>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold truncate">{player.gamertag}</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {player.club && (
                                <span className="text-[9px] text-muted-foreground truncate">{player.club.name}</span>
                              )}
                              <Badge className={`${pDt.badgeBg} text-[6px] border py-0 px-0.5`}>
                                {pDiv === 'male' ? '🕺' : '💃'}
                              </Badge>
                            </div>
                          </div>

                          {/* Points */}
                          <div className="text-right shrink-0">
                            <span className="text-[10px] font-bold">{player.points}</span>
                            <p className="text-[7px] text-muted-foreground">pts</p>
                          </div>

                          <ChevronRight className="w-3 h-3 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Divider between sections */}
                {playerResults.length > 0 && clubResults.length > 0 && (
                  <div className="h-px bg-border/10 mx-3" />
                )}

                {/* Club results */}
                {clubResults.length > 0 && (
                  <div className="p-2">
                    <div className="flex items-center gap-1.5 px-2 py-1 mb-1">
                      <Building2 className="w-3 h-3 text-muted-foreground/60" />
                      <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Klub</span>
                    </div>
                    {clubResults.map((club) => (
                      <div
                        key={club.id}
                        className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-muted/20 transition-colors"
                      >
                        {/* Club icon */}
                        <div className="w-7 h-7 rounded-lg bg-idm-gold-warm/10 flex items-center justify-center shrink-0">
                          <Building2 className="w-3.5 h-3.5 text-idm-gold-warm" />
                        </div>

                        {/* Club info */}
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-semibold truncate block">{club.name}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] text-muted-foreground">{club.memberCount} anggota</span>
                          </div>
                        </div>

                        {/* Points */}
                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-bold">{club.points}</span>
                          <p className="text-[7px] text-muted-foreground">pts</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
