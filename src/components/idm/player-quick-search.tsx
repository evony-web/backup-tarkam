'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X, Loader2, Shield, Clock, Sparkles, ArrowRight, ChevronRight } from 'lucide-react';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { getAvatarUrl, clubToString, toStrictDivision } from '@/lib/utils';
import { AvatarMedia } from '@/components/ui/avatar-media';
import { useAppStore } from '@/lib/store';

interface PlayerQuickSearchProps {
  onSelectPlayer: (player: any) => void;
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

export interface RecentlyViewedPlayer {
  id: string;
  gamertag: string;
  tier: string;
  points: number;
  totalWins: number;
  totalMvp: number;
  avatar?: string | null;
  club?: string;
  division?: string;
  viewedAt: number;
}

/** localStorage keys */
const RECENTLY_VIEWED_KEY = 'idm-recently-viewed';
const MAX_RECENT = 3;

// Normalize club to always be a string (name), regardless of input format
function normalizeClub(club: string | { id: string; name: string; logo?: string | null } | null | undefined): string | undefined {
  if (!club) return undefined;
  if (typeof club === 'string') return club || undefined;
  return club.name || undefined;
}

/** Add a player to the recently viewed list (max 3, most recent first) */
export function addRecentlyViewed(player: { id: string; gamertag: string; tier: string; points: number; totalWins: number; totalMvp: number; avatar?: string | null; club?: string | { id: string; name: string; logo?: string | null } | null; division?: string }) {
  try {
    const list = getRecentlyViewed();
    // Remove if already exists (will be re-added at top)
    const filtered = list.filter(p => p.id !== player.id);
    // Add to front
    filtered.unshift({
      id: player.id,
      gamertag: player.gamertag,
      tier: player.tier,
      points: player.points,
      totalWins: player.totalWins,
      totalMvp: player.totalMvp,
      avatar: player.avatar,
      club: normalizeClub(player.club),
      division: player.division,
      viewedAt: Date.now(),
    });
    // Keep only MAX_RECENT
    const trimmed = filtered.slice(0, MAX_RECENT);
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(trimmed));
  } catch { /* ignore */ }
}

/** Get the recently viewed players list */
export function getRecentlyViewed(): RecentlyViewedPlayer[] {
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    // Expire entries older than 7 days & normalize clubs
    const now = Date.now();
    const valid = data.filter((p: RecentlyViewedPlayer) => {
      if (now - p.viewedAt > 7 * 24 * 60 * 60 * 1000) return false;
      // Normalize club
      if (p.club && typeof p.club !== 'string') {
        (p as any).club = normalizeClub(p.club);
      }
      return true;
    });
    // Save cleaned list
    if (valid.length !== data.length) {
      localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(valid));
    }
    return valid;
  } catch {
    localStorage.removeItem(RECENTLY_VIEWED_KEY);
    return [];
  }
}

/** Clear a specific player from recently viewed */
export function removeFromRecentlyViewed(playerId: string) {
  try {
    const list = getRecentlyViewed().filter(p => p.id !== playerId);
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
}

export function PlayerQuickSearch({ onSelectPlayer }: PlayerQuickSearchProps) {
  const dt = useDivisionTheme();
  const division = useAppStore(s => s.division);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Recently viewed players
  const [recentPlayers, setRecentPlayers] = useState<RecentlyViewedPlayer[]>([]);
  useEffect(() => {
    setRecentPlayers(getRecentlyViewed());
  }, []);

  // Handle selecting a player from search results
  const handleSelect = useCallback((player: SearchResultPlayer) => {
    addRecentlyViewed(player);
    setRecentPlayers(getRecentlyViewed());
    onSelectPlayer(player);
    setQuery('');
    setResults([]);
    setFocused(false);
    inputRef.current?.blur();
  }, [onSelectPlayer]);

  // Handle selecting a recently viewed player
  const handleRecentSelect = useCallback((player: RecentlyViewedPlayer) => {
    onSelectPlayer(player);
    // Re-add to front (bumps viewedAt)
    addRecentlyViewed(player);
    setRecentPlayers(getRecentlyViewed());
  }, [onSelectPlayer]);

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
        setResults(data.players || []);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [division]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 250);
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFocused(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const showDropdown = focused && (query.length > 0 || recentPlayers.length > 0);
  const hasResults = results.length > 0;

  return (
    <div ref={containerRef} className="relative">
      {/* Search Input */}
      <div className={`relative rounded-2xl transition-all duration-200 ${dt.casinoCard} border ${focused ? `${dt.border} shadow-lg shadow-idm-gold/5` : 'border-border/50'}`}>
        <div className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3`}>
          {/* Icon */}
          <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg ${dt.iconBg} flex items-center justify-center shrink-0`}>
            <Search className={`w-4 h-4 ${dt.neonText}`} />
          </div>

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => setFocused(true)}
            placeholder="Cari nama pemain di sini..."
            className="flex-1 bg-transparent text-sm sm:text-base font-medium placeholder:text-muted-foreground/50 focus:outline-none min-w-0"
          />

          {/* Loading or Clear */}
          {loading ? (
            <Loader2 className={`w-4 h-4 animate-spin ${dt.neonText} shrink-0`} />
          ) : query ? (
            <button
              onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus(); }}
              className="p-1 rounded-full hover:bg-muted/50 transition-colors shrink-0"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          ) : null}

          {/* "Cari" label */}
          {!query && !focused && (
            <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${dt.bg} text-[10px] font-bold ${dt.text} shrink-0`}>
              <Sparkles className="w-3 h-3" />
              Cari Pemain
            </div>
          )}
        </div>
      </div>

      {/* Dropdown Results */}
      {showDropdown && (
        <div className={`absolute z-50 left-0 right-0 mt-1.5 rounded-2xl ${dt.casinoCard} border ${dt.border} shadow-xl shadow-black/20 overflow-hidden`}>
          {/* Recently viewed section */}
          {recentPlayers.length > 0 && !query && (
            <div>
              <div className={`flex items-center gap-2 px-3 sm:px-4 py-2 ${dt.bgSubtle}`}>
                <Clock className={`w-3.5 h-3.5 ${dt.neonText}`} />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Terakhir Dilihat</span>
              </div>
              <div className="py-1">
                {recentPlayers.map((player) => {
                  const avatarSrc = getAvatarUrl(player.gamertag, toStrictDivision(division), player.avatar);
                  return (
                    <button
                      key={player.id}
                      onClick={() => handleRecentSelect(player)}
                      className={`w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 text-left transition-colors hover:bg-muted/30 ${dt.hoverBgSubtle}`}
                    >
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 shadow-sm border border-border/20">
                        <AvatarMedia
                          src={avatarSrc}
                          alt={player.gamertag}
                          width={36}
                          height={36}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold truncate">{player.gamertag}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {clubToString(player.club) && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 truncate">
                              <Shield className="w-2.5 h-2.5 shrink-0" />
                              {clubToString(player.club)}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Quick stats */}
                      <div className="text-right shrink-0">
                        <p className={`text-xs font-bold ${dt.neonText}`}>{player.points} pts</p>
                        <p className="text-[9px] text-muted-foreground">
                          {player.totalWins}W {player.totalMvp > 0 ? `· ${player.totalMvp} MVP` : ''}
                        </p>
                      </div>
                      <ChevronRight className={`w-3.5 h-3.5 ${dt.neonText} shrink-0 opacity-50`} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Divider */}
          {recentPlayers.length > 0 && !query && (
            <div className={`h-px ${dt.borderSubtle}`} />
          )}

          {/* Prompt when no query and no recent */}
          {!query && recentPlayers.length === 0 && (
            <div className="px-3 sm:px-4 py-4 text-center">
              <Search className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Ketik nama untuk mencari pemain</p>
            </div>
          )}

          {/* Prompt when no query but has recent (small hint) */}
          {!query && recentPlayers.length > 0 && (
            <div className="px-3 sm:px-4 py-2">
              <p className="text-[10px] text-muted-foreground/60 text-center">Ketik nama untuk mencari pemain lain</p>
            </div>
          )}

          {/* Loading */}
          {loading && query && (
            <div className="px-3 sm:px-4 py-4 text-center">
              <Loader2 className={`w-5 h-5 mx-auto animate-spin ${dt.neonText}`} />
              <p className="text-[10px] text-muted-foreground mt-1.5">Mencari...</p>
            </div>
          )}

          {/* No results */}
          {query && !loading && !hasResults && (
            <div className="px-3 sm:px-4 py-4 text-center">
              <p className="text-xs text-muted-foreground">Tidak ditemukan</p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">Coba nama lain atau periksa ejaan</p>
            </div>
          )}

          {/* Search Results */}
          {hasResults && !loading && (
            <div className="max-h-72 overflow-y-auto custom-scrollbar py-1">
              {results.map((player) => {
                const avatarSrc = getAvatarUrl(player.gamertag, toStrictDivision(division), player.avatar);
                return (
                  <button
                    key={player.id}
                    onClick={() => handleSelect(player)}
                    className={`w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 text-left transition-colors hover:bg-muted/30 ${dt.hoverBgSubtle}`}
                  >
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 shadow-sm border border-border/20">
                      <AvatarMedia
                        src={avatarSrc}
                        alt={player.gamertag}
                        width={36}
                        height={36}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate">{player.gamertag}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {clubToString(player.club) && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 truncate">
                            <Shield className="w-2.5 h-2.5 shrink-0" />
                            {clubToString(player.club)}
                          </span>
                        )}
                        {player.rank > 0 && (
                          <span className={`text-[10px] ${player.rank <= 3 ? dt.neonText : 'text-muted-foreground'}`}>
                            · #{player.rank}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Quick stats */}
                    <div className="text-right shrink-0">
                      <p className={`text-xs font-bold ${dt.neonText}`}>{player.points} pts</p>
                      <p className="text-[9px] text-muted-foreground">
                        {player.totalWins}W {player.totalMvp > 0 ? `· ${player.totalMvp} MVP` : ''}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
