'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X, Loader2, Shield } from 'lucide-react';
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { ClubLogoImage } from './club-logo-image';
import { getAvatarUrl, clubToString } from '@/lib/utils';
import { AvatarMedia } from '@/components/ui/avatar-media';
import { useAppStore } from '@/lib/store';

interface PlayerSearchProps {
  division: 'male' | 'female';
  onSelectPlayer: (player: SearchResultPlayer) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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

export function PlayerSearch({ division, onSelectPlayer, open = false, onOpenChange }: PlayerSearchProps) {
  const dt = useDivisionTheme();
  const appDivision = useAppStore(s => s.division);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      // Reset state on close
      setQuery('');
      setResults([]);
      setSearched(false);
    }
  }, [open]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(false);
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
      setSearched(true);
    }
  }, [division]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(val);
    }, 300);
  };

  const handleSelect = (player: SearchResultPlayer) => {
    onSelectPlayer(player);
    onOpenChange?.(false);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    }
    onOpenChange?.(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-md p-0 gap-0 overflow-hidden bg-background border-border"
        showCloseButton={true}
      >
        <DialogTitle className="sr-only">Cari Pemain</DialogTitle>
        <DialogDescription className="sr-only">Cari pemain berdasarkan nama atau nickname</DialogDescription>

        {/* Search header */}
        <div className={`px-4 pt-4 pb-3 border-b ${dt.borderSubtle}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-7 h-7 rounded-lg ${dt.iconBg} flex items-center justify-center shrink-0`}>
              <Search className={`w-3.5 h-3.5 ${dt.neonText}`} />
            </div>
            <h2 className="text-sm font-bold">Cari Pemain</h2>
          </div>
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              placeholder="Ketik nama kamu..."
              className={`w-full h-10 pl-9 pr-9 rounded-lg text-sm bg-muted/50 border ${dt.border} focus:outline-none focus:ring-2 focus:ring-idm-gold/30 placeholder:text-muted-foreground/60`}
            />
            {query && (
              <button
                onClick={() => { setQuery(''); setResults([]); setSearched(false); inputRef.current?.focus(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted/80 transition-colors"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Results area */}
        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
          {/* Empty state — not yet searched */}
          {!searched && !loading && query.length === 0 && (
            <div className="py-12 px-4 text-center">
              <Search className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Ketik nama untuk mulai mencari</p>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="py-12 px-4 text-center">
              <Loader2 className={`w-6 h-6 mx-auto mb-2 animate-spin ${dt.text}`} />
              <p className="text-xs text-muted-foreground">Mencari...</p>
            </div>
          )}

          {/* No results */}
          {searched && !loading && results.length === 0 && (
            <div className="py-12 px-4 text-center">
              <Search className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Tidak ditemukan</p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">Coba nama lain atau periksa ejaan</p>
            </div>
          )}

          {/* Results list */}
          {results.length > 0 && (
            <div className="py-2">
              {results.map((player) => {
                const avatarSrc = getAvatarUrl(player.gamertag, division, player.avatar);
                return (
                  <button
                    key={player.id}
                    onClick={() => handleSelect(player)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50 ${dt.hoverBgSubtle}`}
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 shadow-sm">
                      <AvatarMedia
                        src={avatarSrc}
                        alt={player.gamertag}
                        width={40}
                        height={40}
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
                        {clubToString(player.club) ? (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 truncate">
                            <Shield className="w-2.5 h-2.5 shrink-0" />
                            {clubToString(player.club)}
                          </span>
                        ) : null}
                        {player.rank > 0 && (
                          <span className={`text-[10px] ${player.rank <= 3 ? dt.neonText : 'text-muted-foreground'}`}>
                            · #{player.rank}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                        <span className="font-medium">{player.points} pts</span>
                        {player.totalWins > 0 && <span className="text-green-500">{player.totalWins}W</span>}
                        {player.totalMvp > 0 && <span className="text-yellow-500">{player.totalMvp} MVP</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
