'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { broadcastInvalidation } from '@/lib/cross-tab-sync';
/* framer-motion removed — CSS animations */
import Image from 'next/image';
import {
  Calendar, Crown, Trophy, Plus, Loader2, Check, X, Edit3,
  Shield, Play, Flag, ChevronDown, ChevronUp, Star, Trash2, User, Lock,
  Heart, Gem
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ClubLogoImage } from '@/components/idm/club-logo-image';
import { getAvatarUrl } from '@/lib/utils';
/* container/item removed — CSS stagger */
import type { DivisionTheme } from '@/hooks/use-division-theme';

interface AdminSeasonPanelProps {
  division: string;
  dt: DivisionTheme;
  setConfirmDialog: (d: { open: boolean; title: string; description: string; onConfirm: () => void }) => void;
  mode?: 'liga' | 'tarkam'; // 'liga' = league seasons, 'tarkam' = tournament seasons
}

interface SeasonClubData {
  id: string;
  profileId: string;
  name?: string; // deprecated — use profile.name
  logo?: string | null; // deprecated — use profile.logo
  division: string;
  wins: number;
  losses: number;
  points: number;
  gameDiff: number;
  profile?: { id: string; name: string; logo: string | null };
  _count?: { homeMatches?: number; awayMatches?: number; members?: number };
}

interface SeasonData {
  id: string;
  name: string;
  number: number;
  division: string;
  status: string;
  startDate: string;
  endDate: string | null;
  championClubId: string | null;
  championClub?: { id: string; name: string; logo: string | null } | null;
  championSquad?: Array<{ id: string; gamertag: string; division: string; role: string }> | null;
  championPlayerId?: string | null;
  championPlayer?: { id: string; gamertag: string; division: string; avatar: string | null; points: number } | null;
  sultanPlayerId?: string | null;
  sultanPlayer?: { id: string; gamertag: string; division: string; avatar: string | null; points: number; tier: string; totalWins: number; totalMvp: number; streak: number; maxStreak: number; matches: number } | null;
  players?: Array<{ id: string; gamertag: string; division: string; avatar: string | null; points: number; tournamentCount: number }>;
  availableProfiles?: Array<{ id: string; name: string; logo: string | null; memberCount: number }>;
  _count: { tournaments: number; clubs: number };
  clubs?: SeasonClubData[];
}

export function AdminSeasonPanel({ division, dt, setConfirmDialog, mode = 'liga' }: AdminSeasonPanelProps) {
  const qc = useQueryClient();

  const authFetch = async (url: string, options: RequestInit = {}) => {
    return fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  };

  // State
  const [expandedSeason, setExpandedSeason] = useState<string | null>(null);
  const isTarkam = mode === 'tarkam';
  const defaultDivision = isTarkam ? division : 'liga';

  const [newSeasonForm, setNewSeasonForm] = useState({
    name: '',
    number: '',
    division: defaultDivision,
    startDate: '',
    endDate: '',
  });

  // Sync division with store division when in tarkam mode
  useEffect(() => {
    if (isTarkam) {
      setTimeout(() => setNewSeasonForm(p => ({ ...p, division })), 0);
    }
  }, [division, isTarkam]);
  const [editingChampion, setEditingChampion] = useState<string | null>(null);
  const [selectedChampion, setSelectedChampion] = useState<string>('');
  const [selectedChampionPlayer, setSelectedChampionPlayer] = useState<string>('');
  const [championPlayerSearch, setChampionPlayerSearch] = useState<string>('');
  const [championSearchMode, setChampionSearchMode] = useState<'season' | 'all'>('season');
  const [editingStatus, setEditingStatus] = useState<string | null>(null);
  const [editingSultan, setEditingSultan] = useState<string | null>(null);
  const [selectedSultan, setSelectedSultan] = useState<string>('');
  const [sultanSearch, setSultanSearch] = useState<string>('');
  const [sultanSearchMode, setSultanSearchMode] = useState<'season' | 'all'>('season');
  const [editingSquad, setEditingSquad] = useState(false);
  const [squadSelection, setSquadSelection] = useState<Array<{id: string; gamertag: string; division: string; role: string}>>([]);
  const [confirmLocal, setConfirmLocal] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  // Fetch ALL seasons, then filter by mode
  const { data: rawAllSeasons, isLoading } = useQuery<SeasonData[]>({
    queryKey: ['admin-seasons'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/seasons', { credentials: 'include' });
        if (!res.ok) return [];
        const data = await res.json();
        // API returns { seasons: [...] }, extract the array
        return Array.isArray(data) ? data : Array.isArray(data?.seasons) ? data.seasons : [];
      } catch {
        return [];
      }
    },
  });

  // Ensure allSeasons is always an array (defensive against React Query edge cases)
  const allSeasons: SeasonData[] = Array.isArray(rawAllSeasons) ? rawAllSeasons : [];

  // Filter seasons based on mode
  const seasons = isTarkam
    ? allSeasons.filter(s => s.division === 'male' || s.division === 'female')
    : allSeasons.filter(s => s.division === 'liga');

  // Fetch expanded season detail with clubs
  const { data: seasonDetail, isLoading: detailLoading } = useQuery<SeasonData>({
    queryKey: ['admin-season-detail', expandedSeason],
    queryFn: async () => {
      if (!expandedSeason) return null;
      const res = await fetch(`/api/seasons/${expandedSeason}`, { credentials: 'include' });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        let errorMsg = `HTTP ${res.status}`;
        try { const d = JSON.parse(text); errorMsg = d.error || errorMsg; } catch { if (text) errorMsg = text; }
        throw new Error(errorMsg);
      }
      const data = await res.json();
      // API returns { season: {...}, standings: [...], clubs: [...] }
      // Merge into a flat SeasonData object
      if (data?.season) {
        return {
          ...data.season,
          clubs: data.clubs || [],
          players: data.standings || [],
          _count: { tournaments: data.season.tournamentCount || 0, clubs: (data.clubs || []).length },
        };
      }
      return data;
    },
    enabled: !!expandedSeason,
  });

  // Create season mutation
  const createSeason = useMutation({
    mutationFn: async (data: typeof newSeasonForm) => {
      const res = await authFetch('/api/seasons', {
        method: 'POST',
        body: JSON.stringify({
          name: data.name,
          number: parseInt(data.number),
          division: data.division,
          startDate: data.startDate || undefined,
          endDate: data.endDate || undefined,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-seasons'] });
      qc.invalidateQueries({ queryKey: ['stats', division] });
      qc.invalidateQueries({ queryKey: ['league'] });
      broadcastInvalidation('league', 'stats');
      toast.success('Season berhasil dibuat!');
      setNewSeasonForm({ name: '', number: '', division: defaultDivision, startDate: '', endDate: '' });
    },
    onError: (e: Error) => { toast.error(e.message); },
  });

  // Update season mutation
  const updateSeason = useMutation({
    mutationFn: async ({ seasonId, data }: { seasonId: string; data: Record<string, unknown> }) => {
      const res = await authFetch(`/api/seasons/${seasonId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['admin-seasons'] });
      qc.invalidateQueries({ queryKey: ['admin-season-detail', variables.seasonId] });
      qc.invalidateQueries({ queryKey: ['stats', division] });
      qc.invalidateQueries({ queryKey: ['league'] });
      broadcastInvalidation('league', 'stats');
      toast.success('Season berhasil diperbarui!');
      setEditingChampion(null);
      setSelectedChampionPlayer('');
      setChampionPlayerSearch('');
      setChampionSearchMode('season');
      setEditingStatus(null);
      setEditingSquad(false);
      setEditingSultan(null);
      setSelectedSultan('');
      setSultanSearch('');
      setSultanSearchMode('season');
    },
    onError: (e: Error) => { toast.error(e.message); },
  });

  // Delete season mutation
  const deleteSeason = useMutation({
    mutationFn: async (seasonId: string) => {
      const res = await authFetch(`/api/seasons/${seasonId}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-seasons'] });
      qc.invalidateQueries({ queryKey: ['stats', division] });
      qc.invalidateQueries({ queryKey: ['league'] });
      broadcastInvalidation('league', 'stats');
      setExpandedSeason(null);
      toast.success('Season berhasil dihapus!');
    },
    onError: (e: Error) => { toast.error(e.message); },
  });

  // Close season mutation (Tutup Season)
  const closeSeason = useMutation({
    mutationFn: async (seasonId: string) => {
      const res = await authFetch(`/api/seasons/${seasonId}/close`, { method: 'POST' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['admin-seasons'] });
      qc.invalidateQueries({ queryKey: ['admin-season-detail', expandedSeason] });
      qc.invalidateQueries({ queryKey: ['stats', division] });
      qc.invalidateQueries({ queryKey: ['league'] });
      broadcastInvalidation('league', 'stats');
      toast.success(data.message || 'Season berhasil ditutup!');
    },
    onError: (e: Error) => { toast.error(e.message); },
  });

  // Search all players (for Sultan/Champion selection when season has no participants)
  const { data: searchedPlayers } = useQuery<Array<{
    id: string; gamertag: string; division: string; avatar: string | null;
    tier: string; points: number; totalWins: number; totalMvp: number;
    club: { id: string; name: string; logo: string | null } | null; rank: number;
  }>>({
    queryKey: ['player-search', sultanSearch || championPlayerSearch, division],
    queryFn: async () => {
      const q = sultanSearch || championPlayerSearch;
      if (!q?.trim()) return [];
      const res = await fetch(`/api/players/search?q=${encodeURIComponent(q)}&division=${division}`, { credentials: 'include' });
      if (!res.ok) return [];
      const data = await res.json();
      return data.players || [];
    },
    enabled: (editingSultan !== null && sultanSearchMode === 'all' && sultanSearch.trim().length > 0)
           || (editingChampion !== null && isTarkam && championSearchMode === 'all' && championPlayerSearch.trim().length > 0),
    staleTime: 30000,
  });

  // Helper to get club display name
  const getClubName = (club: SeasonClubData) => club.profile?.name || club.name || 'Unknown';
  const getClubLogo = (club: SeasonClubData) => club.profile?.logo || club.logo || null;

  // Helper to set champion (liga)
  // championClubId must be a ClubProfile ID (not Club season entry ID)
  const handleSetChampion = (seasonId: string, profileId: string) => {
    const club = seasonDetail?.clubs?.find(c => c.profileId === profileId || c.profile?.id === profileId);
    setConfirmLocal({
      open: true,
      title: 'Set Champion Season?',
      description: `Set "${getClubName(club!)}" sebagai champion season ini? Status season akan otomatis diubah menjadi "completed".`,
      onConfirm: () => {
        updateSeason.mutate({
          seasonId,
          data: { championClubId: profileId, status: 'completed' },
        });
      },
    });
  };

  // Helper to set tarkam champion player
  const handleSetTarkamChampion = (seasonId: string, playerId: string) => {
    const player = seasonDetail?.players?.find(p => p.id === playerId);
    setConfirmLocal({
      open: true,
      title: 'Set Champion Season?',
      description: `Set "${player?.gamertag}" sebagai champion season ini? Status season akan otomatis diubah menjadi "completed".`,
      onConfirm: () => {
        updateSeason.mutate({
          seasonId,
          data: { championPlayerId: playerId, status: 'completed' },
        });
      },
    });
  };

  // Helper to remove champion (liga)
  const handleRemoveChampion = (seasonId: string) => {
    setConfirmLocal({
      open: true,
      title: 'Hapus Champion?',
      description: 'Hapus champion dari season ini? Status season akan diubah kembali ke "active".',
      onConfirm: () => {
        updateSeason.mutate({
          seasonId,
          data: { championClubId: null, status: 'active' },
        });
      },
    });
  };

  // Helper to remove tarkam champion
  const handleRemoveTarkamChampion = (seasonId: string) => {
    setConfirmLocal({
      open: true,
      title: 'Hapus Champion?',
      description: 'Hapus champion dari season ini? Status season akan diubah kembali ke "active".',
      onConfirm: () => {
        updateSeason.mutate({
          seasonId,
          data: { championPlayerId: null, status: 'active' },
        });
      },
    });
  };

  // Helper to change status
  const handleStatusChange = (seasonId: string, newStatus: string) => {
    const statusLabels: Record<string, string> = {
      active: 'Aktif',
      completed: 'Selesai',
      upcoming: 'Akan Datang',
    };
    setConfirmLocal({
      open: true,
      title: `Ubah Status Season?`,
      description: `Ubah status season menjadi "${statusLabels[newStatus] || newStatus}"?`,
      onConfirm: () => {
        updateSeason.mutate({ seasonId, data: { status: newStatus } });
      },
    });
  };

  const statusColors: Record<string, string> = {
    active: 'bg-green-500/10 text-green-500',
    completed: 'bg-blue-500/10 text-blue-500',
    upcoming: 'bg-yellow-500/10 text-yellow-500',
  };

  const statusLabels: Record<string, string> = {
    active: 'Aktif',
    completed: 'Selesai',
    upcoming: 'Akan Datang',
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className={`w-6 h-6 animate-spin ${dt.neonText}`} />
        <span className="ml-2 text-sm text-muted-foreground">Memuat season...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ===== CREATE SEASON ===== */}
      <Card className={dt.casinoCard}>
        <div className={dt.casinoBar} />
        <CardContent className="p-4 relative z-10">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Plus className={`w-4 h-4 ${dt.neonText}`} /> {isTarkam ? 'Buat Season Tarkam Baru' : 'Buat Season Liga Baru'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <div>
              <Label className="text-sm text-muted-foreground">Nama Season</Label>
              <Input
                placeholder={isTarkam ? 'contoh: Season 2 Tarkam Cowo' : 'contoh: Liga IDM Season 3'}
                value={newSeasonForm.name}
                onChange={(e) => setNewSeasonForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Nomor Season</Label>
              <Input
                placeholder="contoh: 3"
                type="number"
                value={newSeasonForm.number}
                onChange={(e) => setNewSeasonForm(p => ({ ...p, number: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Divisi</Label>
              {isTarkam ? (
                <div className="flex items-center h-9">
                  <select
                    value={newSeasonForm.division}
                    onChange={(e) => setNewSeasonForm(p => ({ ...p, division: e.target.value }))}
                    className="w-full h-full px-3 rounded-md border border-border/30 bg-muted/10 text-xs"
                  >
                    <option value="male">Cowo</option>
                    <option value="female">Cewe</option>
                  </select>
                </div>
              ) : (
                <div className="flex items-center h-9 px-3 rounded-md border border-border/30 bg-muted/10 text-xs text-muted-foreground">
                  Liga IDM (Terbuka untuk semua divisi)
                </div>
              )}
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Tanggal Mulai</Label>
              <Input
                type="date"
                value={newSeasonForm.startDate}
                onChange={(e) => setNewSeasonForm(p => ({ ...p, startDate: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Tanggal Selesai (opsional)</Label>
              <Input
                type="date"
                value={newSeasonForm.endDate}
                onChange={(e) => setNewSeasonForm(p => ({ ...p, endDate: e.target.value }))}
              />
            </div>
            <div className="flex items-end">
              <Button
                size="sm"
                className="w-full"
                disabled={!newSeasonForm.name.trim() || !newSeasonForm.number || createSeason.isPending}
                onClick={() => createSeason.mutate(newSeasonForm)}
              >
                {createSeason.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
                Buat Season
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== SEASONS LIST ===== */}
      {!seasons || seasons.length === 0 ? (
        <div className="text-center py-10">
          <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Belum ada season {isTarkam ? 'Tarkam' : 'Liga IDM'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {seasons.map((season, idx) => {
            const isExpanded = expandedSeason === season.id;
            const isChampionEditing = editingChampion === season.id;
            const isStatusEditing = editingStatus === season.id;
            const championClub = isExpanded ? (seasonDetail?.championClub || season.championClub) : season.championClub;

            return (
              <div key={season.id} className="stagger-item-subtle" style={{ animationDelay: `${idx * 30}ms` }}>
                <Card className={`${dt.casinoCard} ${dt.casinoGlow}`}>
                  <div className={dt.casinoBar} />
                  <CardContent className="p-0 relative z-10">
                    {/* Season Header Row */}
                    <div
                      className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/10 transition-colors"
                      onClick={() => {
                        setExpandedSeason(isExpanded ? null : season.id);
                        setEditingChampion(null);
                        setEditingStatus(null);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                          season.status === 'completed' ? 'bg-blue-500/15 text-blue-500' :
                          season.status === 'active' ? 'bg-green-500/15 text-green-500' :
                          'bg-yellow-500/15 text-yellow-500'
                        }`}>
                          {season.status === 'completed' ? <Flag className="w-4 h-4" /> :
                           season.status === 'active' ? <Play className="w-4 h-4" /> :
                           <Calendar className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold">{season.name}</p>
                            <Badge className={`text-xs border-0 ${statusColors[season.status] || 'bg-muted text-muted-foreground'}`}>
                              {statusLabels[season.status] || season.status}
                            </Badge>
                            {season.number && (
                              <Badge className={`${dt.casinoBadge} text-xs`}>
                                S{season.number}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                            <span>{new Date(season.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            {season.endDate && (
                              <>
                                <span>→</span>
                                <span>{new Date(season.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!isTarkam && (
                          <Badge className={dt.casinoBadge}>
                            <Shield className="w-3 h-3 mr-1" />
                            {season._count?.clubs || 0} Club
                          </Badge>
                        )}
                        <Badge className={dt.casinoBadge}>
                          <Trophy className="w-3 h-3 mr-1" />
                          {season._count?.tournaments || 0} Tourney
                        </Badge>

                        {/* Delete button — only for seasons without matches */}
                        <Button size="sm" variant="ghost"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDialog({
                              open: true,
                              title: 'Hapus Season?',
                              description: `Season "${season.name}" dan semua data terkait (club, donasi, tournament) akan dihapus. Tindakan ini tidak dapat dibatalkan.`,
                              onConfirm: () => deleteSeason.mutate(season.id),
                            });
                          }}>
                          <Trash2 className="w-3 h-3" />
                        </Button>

                        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>

                    {/* ===== EXPANDED: CHAMPION & STATUS ===== */}
                    {isExpanded && (
                      <div className="border-t border-border/20 px-3 py-3 space-y-3">
                        {detailLoading ? (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className={`w-4 h-4 animate-spin ${dt.neonText}`} />
                            <span className="ml-2 text-xs text-muted-foreground">Memuat detail...</span>
                          </div>
                        ) : (
                          <>
                            {/* ── Champion Management ── */}
                            <div className="p-3 rounded-lg bg-muted/30 border border-border/20">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                                  <Crown className="w-3.5 h-3.5 text-yellow-500" /> {isTarkam ? 'Champion Season (Individu)' : 'Champion Season'}
                                </p>
                                {!isChampionEditing && (
                                  <Button size="sm" variant="outline" className="text-sm h-8"
                                    onClick={() => {
                                      setEditingChampion(season.id);
                                      if (isTarkam) {
                                        setSelectedChampionPlayer(seasonDetail?.championPlayerId || '');
                                      } else {
                                        setSelectedChampion(seasonDetail?.championClubId || '');
                                      }
                                    }}>
                                    <Edit3 className="w-3 h-3 mr-1" />
                                    {isTarkam ? (seasonDetail?.championPlayerId ? 'Ubah' : 'Set Champion') : (seasonDetail?.championClubId ? 'Ubah' : 'Set Champion')}
                                  </Button>
                                )}
                              </div>

                              {/* === LIGA MODE: Club champion === */}
                              {!isTarkam && (
                                <>
                                  {/* Current champion display */}
                                  {championClub && !isChampionEditing && (
                                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
                                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border-2 border-yellow-500/30">
                                        {championClub.logo ? (
                                          <ClubLogoImage
                                            clubName={championClub.name}
                                            dbLogo={championClub.logo}
                                            alt={championClub.name}
                                            width={40}
                                            height={40}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center bg-yellow-500/10">
                                            <Crown className="w-4 h-4 text-yellow-500" />
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <p className="text-sm font-bold text-yellow-500">{championClub.name}</p>
                                          <Badge className="bg-yellow-500/10 text-yellow-500 text-xs border-0">
                                            <Crown className="w-3 h-3 mr-0.5" /> CHAMPION
                                          </Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground">Juara Season {seasonDetail?.number}</p>
                                      </div>
                                      <Button
                                        size="sm" variant="ghost"
                                        className="h-8 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                        onClick={() => handleRemoveChampion(season.id)}
                                      >
                                        <X className="w-3 h-3 mr-1" /> Hapus
                                      </Button>
                                    </div>
                                  )}

                                  {/* No champion yet */}
                                  {!championClub && !isChampionEditing && (
                                    <div className="p-3 rounded-lg bg-muted/30 border border-dashed border-border/40 text-center">
                                      <Crown className="w-5 h-5 text-muted-foreground/40 mx-auto mb-1" />
                                      <p className="text-sm text-muted-foreground">Belum ada champion untuk season ini</p>
                                    </div>
                                  )}

                                  {/* Champion editing mode - Liga */}
                                  {isChampionEditing && (
                                    <div className="space-y-2">
                                      {/* Show clubs in season if available */}
                                      {seasonDetail?.clubs && seasonDetail.clubs.length > 0 && (
                                        <>
                                          <p className="text-sm text-muted-foreground">Pilih club champion untuk Season {seasonDetail?.number}:</p>
                                          <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                                            {seasonDetail.clubs.map((club) => {
                                              const clubName = getClubName(club);
                                              const clubLogo = getClubLogo(club);
                                              const championRef = club.profileId || club.profile?.id || club.id;
                                              return (
                                                <div
                                                  key={club.id}
                                                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                                    selectedChampion === championRef
                                                      ? 'border-yellow-500/30 bg-yellow-500/5'
                                                      : 'border-border/20 bg-card/30 hover:bg-muted/20'
                                                  }`}
                                                  onClick={() => setSelectedChampion(championRef)}
                                                >
                                                  <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
                                                    {clubLogo ? (
                                                      <ClubLogoImage
                                                        clubName={clubName}
                                                        dbLogo={clubLogo}
                                                        alt={clubName}
                                                        width={32}
                                                        height={32}
                                                        className="w-full h-full object-cover"
                                                      />
                                                    ) : (
                                                      <div className={`w-full h-full flex items-center justify-center ${dt.iconBg}`}>
                                                        <Shield className={`w-3.5 h-3.5 ${dt.neonText}`} />
                                                      </div>
                                                    )}
                                                  </div>
                                                  <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium truncate">{clubName}</p>
                                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                      <span className="text-green-500">{club.wins}W</span>
                                                      <span>-</span>
                                                      <span className="text-red-500">{club.losses}L</span>
                                                      <span>•</span>
                                                      <span>{club.points}pts</span>
                                                      <span>•</span>
                                                      <span>GD {club.gameDiff > 0 ? '+' : ''}{club.gameDiff}</span>
                                                    </div>
                                                  </div>
                                                  {selectedChampion === championRef && (
                                                    <div className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center shrink-0">
                                                      <Check className="w-3 h-3 text-black" />
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </>
                                      )}

                                      {/* Show ALL ClubProfiles when season has no clubs yet */}
                                      {(!seasonDetail?.clubs || seasonDetail.clubs.length === 0) && (
                                        <>
                                          <div className="flex items-center gap-1.5 mb-1">
                                            <p className="text-sm text-amber-400/80">Season ini belum ada club — pilih dari semua club yang tersedia:</p>
                                          </div>
                                          <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                                            {seasonDetail?.availableProfiles?.map((profile) => (
                                              <div
                                                key={profile.id}
                                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                                  selectedChampion === profile.id
                                                    ? 'border-yellow-500/30 bg-yellow-500/5'
                                                    : 'border-border/20 bg-card/30 hover:bg-muted/20'
                                                }`}
                                                onClick={() => setSelectedChampion(profile.id)}
                                              >
                                                <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
                                                  {profile.logo ? (
                                                    <ClubLogoImage
                                                      clubName={profile.name}
                                                      dbLogo={profile.logo}
                                                      alt={profile.name}
                                                      width={32}
                                                      height={32}
                                                      className="w-full h-full object-cover"
                                                    />
                                                  ) : (
                                                    <div className={`w-full h-full flex items-center justify-center ${dt.iconBg}`}>
                                                      <Shield className={`w-3.5 h-3.5 ${dt.neonText}`} />
                                                    </div>
                                                  )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <p className="text-xs font-medium truncate">{profile.name}</p>
                                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <span>{profile.memberCount} anggota</span>
                                                  </div>
                                                </div>
                                                {selectedChampion === profile.id && (
                                                  <div className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center shrink-0">
                                                    <Check className="w-3 h-3 text-black" />
                                                  </div>
                                                )}
                                              </div>
                                            ))}
                                            {(!seasonDetail?.availableProfiles || seasonDetail.availableProfiles.length === 0) && (
                                              <div className="text-center py-4">
                                                <Shield className="w-5 h-5 text-muted-foreground/40 mx-auto mb-1" />
                                                <p className="text-sm text-muted-foreground">
                                                  Belum ada club yang terdaftar di platform
                                                </p>
                                                <p className="text-xs text-muted-foreground/60 mt-0.5">
                                                  Tambahkan club di menu Peserta → Club
                                                </p>
                                              </div>
                                            )}
                                          </div>
                                        </>
                                      )}

                                      <div className="flex items-center gap-2">
                                        <Button
                                          size="sm"
                                          className="text-sm"
                                          disabled={!selectedChampion || updateSeason.isPending}
                                          onClick={() => handleSetChampion(season.id, selectedChampion)}
                                        >
                                          {updateSeason.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Crown className="w-3 h-3 mr-1" />}
                                          Set Champion
                                        </Button>
                                        <Button
                                          size="sm" variant="ghost"
                                          className="text-sm"
                                          onClick={() => setEditingChampion(null)}
                                        >
                                          Batal
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}

                              {/* === TARKAM MODE: Player champion === */}
                              {isTarkam && (
                                <>
                                  {/* Current champion player display */}
                                  {seasonDetail?.championPlayer && !isChampionEditing && (
                                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
                                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border-2 border-yellow-500/30">
                                        <Image
                                          src={getAvatarUrl(seasonDetail.championPlayer.gamertag, seasonDetail.championPlayer.division as 'male' | 'female', seasonDetail.championPlayer.avatar)}
                                          alt={seasonDetail.championPlayer.gamertag}
                                          width={40}
                                          height={40}
                                          loading="lazy"
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <p className="text-sm font-bold text-yellow-500">{seasonDetail.championPlayer.gamertag}</p>
                                          <Badge className="bg-yellow-500/10 text-yellow-500 text-xs border-0">
                                            <Crown className="w-3 h-3 mr-0.5" /> CHAMPION
                                          </Badge>
                                          <Badge className="text-xs border-0 bg-muted/50 text-muted-foreground capitalize">
                                            {seasonDetail.championPlayer.division}
                                          </Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground">Juara Season {seasonDetail?.number} • {seasonDetail.championPlayer.points}pts</p>
                                      </div>
                                      <Button
                                        size="sm" variant="ghost"
                                        className="h-8 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                        onClick={() => handleRemoveTarkamChampion(season.id)}
                                      >
                                        <X className="w-3 h-3 mr-1" /> Hapus
                                      </Button>
                                    </div>
                                  )}

                                  {/* No champion yet - Tarkam */}
                                  {!seasonDetail?.championPlayer && !isChampionEditing && (
                                    <div className="p-3 rounded-lg bg-muted/30 border border-dashed border-border/40 text-center">
                                      <Crown className="w-5 h-5 text-muted-foreground/40 mx-auto mb-1" />
                                      <p className="text-sm text-muted-foreground">Belum ada champion untuk season ini</p>
                                    </div>
                                  )}

                                  {/* Champion editing mode - Tarkam */}
                                  {isChampionEditing && (
                                    <div className="space-y-2">
                                      <p className="text-sm text-muted-foreground">Pilih pemain champion untuk Season {seasonDetail?.number}:</p>
                                      <Input
                                        placeholder="Cari gamertag..."
                                        value={championPlayerSearch}
                                        onChange={(e) => {
                                          setChampionPlayerSearch(e.target.value);
                                          // Auto-switch to 'all' mode when typing if season has no players
                                          if (e.target.value.trim() && (!seasonDetail?.players || seasonDetail.players.length === 0)) {
                                            setChampionSearchMode('all');
                                          }
                                        }}
                                        className="text-xs h-8"
                                      />
                                      <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                                        {/* Mode: Season players */}
                                        {championSearchMode === 'season' && seasonDetail?.players && seasonDetail.players.length > 0 && (
                                          <>
                                            {seasonDetail.players
                                              .filter(p => !championPlayerSearch.trim() || p.gamertag.toLowerCase().includes(championPlayerSearch.toLowerCase()))
                                              .map((player) => (
                                              <div
                                                key={player.id}
                                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                                  selectedChampionPlayer === player.id
                                                    ? 'border-yellow-500/30 bg-yellow-500/5'
                                                    : 'border-border/20 bg-card/30 hover:bg-muted/20'
                                                }`}
                                                onClick={() => setSelectedChampionPlayer(player.id)}
                                              >
                                                <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
                                                  <Image
                                                    src={getAvatarUrl(player.gamertag, player.division as 'male' | 'female', player.avatar)}
                                                    alt={player.gamertag}
                                                    width={32}
                                                    height={32}
                                                    loading="lazy"
                                                    className="w-full h-full object-cover"
                                                  />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <p className="text-xs font-medium truncate">{player.gamertag}</p>
                                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <Badge className="text-xs border-0 bg-muted/50 text-muted-foreground capitalize px-1 py-0">
                                                      {player.division}
                                                    </Badge>
                                                    <span>•</span>
                                                    <span>{player.points}pts</span>
                                                    <span>•</span>
                                                    <span>{player.tournamentCount} tourney</span>
                                                  </div>
                                                </div>
                                                {selectedChampionPlayer === player.id && (
                                                  <div className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center shrink-0">
                                                    <Check className="w-3 h-3 text-black" />
                                                  </div>
                                                )}
                                              </div>
                                            ))}
                                            {championPlayerSearch.trim() && seasonDetail.players.filter(p => p.gamertag.toLowerCase().includes(championPlayerSearch.toLowerCase())).length === 0 && (
                                              <div className="text-center py-3">
                                                <p className="text-sm text-muted-foreground">Pemain tidak ditemukan di season ini</p>
                                                <Button
                                                  size="sm" variant="link"
                                                  className="text-yellow-500 text-xs h-auto p-0 mt-1"
                                                  onClick={() => setChampionSearchMode('all')}
                                                >
                                                  Cari dari semua pemain →
                                                </Button>
                                              </div>
                                            )}
                                          </>
                                        )}

                                        {/* Mode: Search all players */}
                                        {championSearchMode === 'all' && (
                                          <>
                                            {searchedPlayers && searchedPlayers.length > 0 ? (
                                              searchedPlayers.map((player) => (
                                                <div
                                                  key={player.id}
                                                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                                    selectedChampionPlayer === player.id
                                                      ? 'border-yellow-500/30 bg-yellow-500/5'
                                                      : 'border-border/20 bg-card/30 hover:bg-muted/20'
                                                  }`}
                                                  onClick={() => setSelectedChampionPlayer(player.id)}
                                                >
                                                  <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
                                                    <Image
                                                      src={getAvatarUrl(player.gamertag, player.division as 'male' | 'female', player.avatar)}
                                                      alt={player.gamertag}
                                                      width={32}
                                                      height={32}
                                                      loading="lazy"
                                                      className="w-full h-full object-cover"
                                                    />
                                                  </div>
                                                  <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium truncate">{player.gamertag}</p>
                                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                      <Badge className="text-xs border-0 bg-muted/50 text-muted-foreground capitalize px-1 py-0">
                                                        {player.division}
                                                      </Badge>
                                                      <span>•</span>
                                                      <span>{player.points}pts</span>
                                                      <span>•</span>
                                                      <span>#{player.rank}</span>
                                                      {player.club && (
                                                        <>
                                                          <span>•</span>
                                                          <span className="truncate max-w-[80px]">{player.club.name}</span>
                                                        </>
                                                      )}
                                                    </div>
                                                  </div>
                                                  {selectedChampionPlayer === player.id && (
                                                    <div className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center shrink-0">
                                                      <Check className="w-3 h-3 text-black" />
                                                    </div>
                                                  )}
                                                </div>
                                              ))
                                            ) : (
                                              <div className="text-center py-4">
                                                {championPlayerSearch.trim() ? (
                                                  <>
                                                    <User className="w-5 h-5 text-muted-foreground/40 mx-auto mb-1" />
                                                    <p className="text-sm text-muted-foreground">Pemain tidak ditemukan</p>
                                                    <p className="text-xs text-muted-foreground/60 mt-0.5">Coba nama lain atau periksa divisi</p>
                                                  </>
                                                ) : (
                                                  <>
                                                    <User className="w-5 h-5 text-muted-foreground/40 mx-auto mb-1" />
                                                    <p className="text-sm text-muted-foreground">Ketik gamertag untuk mencari pemain</p>
                                                    <p className="text-xs text-muted-foreground/60 mt-0.5">Mencari dari semua pemain divisi {division === 'male' ? 'Cowo' : 'Cewe'}</p>
                                                  </>
                                                )}
                                              </div>
                                            )}
                                          </>
                                        )}

                                        {/* No season players and not yet in search-all mode */}
                                        {championSearchMode === 'season' && (!seasonDetail?.players || seasonDetail.players.length === 0) && (
                                          <div className="text-center py-4">
                                            <User className="w-5 h-5 text-muted-foreground/40 mx-auto mb-1" />
                                            <p className="text-sm text-muted-foreground">Belum ada pemain yang berpartisipasi di season ini</p>
                                            <Button
                                              size="sm" variant="link"
                                              className="text-yellow-500 text-xs h-auto p-0 mt-1"
                                              onClick={() => setChampionSearchMode('all')}
                                            >
                                              Cari dari semua pemain →
                                            </Button>
                                          </div>
                                        )}
                                      </div>

                                      {/* Mode toggle */}
                                      <div className="flex items-center gap-2">
                                        {championSearchMode === 'all' && seasonDetail?.players && seasonDetail.players.length > 0 && (
                                          <Button
                                            size="sm" variant="ghost"
                                            className="text-xs h-7 text-muted-foreground"
                                            onClick={() => {
                                              setChampionSearchMode('season');
                                              setSelectedChampionPlayer('');
                                            }}
                                          >
                                            ← Kembali ke pemain season
                                          </Button>
                                        )}
                                        {championSearchMode === 'all' && (
                                          <Badge className="text-[9px] border-0 bg-yellow-500/10 text-yellow-500">
                                            <User className="w-2.5 h-2.5 mr-0.5" /> Semua Pemain {division === 'male' ? 'Cowo' : 'Cewe'}
                                          </Badge>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <Button
                                          size="sm"
                                          className="text-sm"
                                          disabled={!selectedChampionPlayer || updateSeason.isPending}
                                          onClick={() => handleSetTarkamChampion(season.id, selectedChampionPlayer)}
                                        >
                                          {updateSeason.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Crown className="w-3 h-3 mr-1" />}
                                          Set Champion
                                        </Button>
                                        <Button
                                          size="sm" variant="ghost"
                                          className="text-sm"
                                          onClick={() => {
                                            setEditingChampion(null);
                                            setChampionSearchMode('season');
                                          }}
                                        >
                                          Batal
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>



                            {/* ── Sultan of Season Management (Tarkam only) ── */}
                            {isTarkam && (
                              <div className="p-3 rounded-lg bg-muted/30 border border-border/20">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                                    <Heart className="w-3.5 h-3.5 text-rose-500" /> Sultan of Season
                                  </p>
                                  {!editingSultan && (
                                    <Button size="sm" variant="outline" className="text-sm h-8"
                                      onClick={() => {
                                        setEditingSultan(season.id);
                                        setSelectedSultan(seasonDetail?.sultanPlayerId || '');
                                        setSultanSearch('');
                                      }}>
                                      <Edit3 className="w-3 h-3 mr-1" />
                                      {seasonDetail?.sultanPlayerId ? 'Ubah' : 'Set Sultan'}
                                    </Button>
                                  )}
                                </div>

                                {/* Current sultan player display */}
                                {seasonDetail?.sultanPlayer && !editingSultan && (
                                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-rose-500/5 border border-rose-500/10">
                                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border-2 border-rose-500/30">
                                      <Image
                                        src={getAvatarUrl(seasonDetail.sultanPlayer.gamertag, seasonDetail.sultanPlayer.division as 'male' | 'female', seasonDetail.sultanPlayer.avatar)}
                                        alt={seasonDetail.sultanPlayer.gamertag}
                                        width={40}
                                        height={40}
                                        loading="lazy"
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-bold text-rose-500">{seasonDetail.sultanPlayer.gamertag}</p>
                                        <Badge className="bg-rose-500/10 text-rose-500 text-xs border-0">
                                          <Heart className="w-3 h-3 mr-0.5" /> SULTAN
                                        </Badge>
                                        <Badge className="text-xs border-0 bg-muted/50 text-muted-foreground capitalize">
                                          {seasonDetail.sultanPlayer.division}
                                        </Badge>
                                      </div>
                                      <p className="text-sm text-muted-foreground">Top Penyawer Season {seasonDetail?.number} • {seasonDetail.sultanPlayer.points}pts</p>
                                    </div>
                                    <Button
                                      size="sm" variant="ghost"
                                      className="h-8 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                      onClick={() => {
                                        setConfirmLocal({
                                          open: true,
                                          title: 'Hapus Sultan of Season?',
                                          description: 'Hapus Sultan of Season dari season ini?',
                                          onConfirm: () => {
                                            updateSeason.mutate({
                                              seasonId: season.id,
                                              data: { sultanPlayerId: null },
                                            });
                                          },
                                        });
                                      }}
                                    >
                                      <X className="w-3 h-3 mr-1" /> Hapus
                                    </Button>
                                  </div>
                                )}

                                {/* No sultan yet */}
                                {!seasonDetail?.sultanPlayer && !editingSultan && (
                                  <div className="p-3 rounded-lg bg-muted/30 border border-dashed border-border/40 text-center">
                                    <Heart className="w-5 h-5 text-muted-foreground/40 mx-auto mb-1" />
                                    <p className="text-sm text-muted-foreground">Belum ada Sultan of Season untuk season ini</p>
                                    <p className="text-xs text-muted-foreground/60 mt-0.5">Klik "Set Sultan" untuk menentukan top penyawer</p>
                                  </div>
                                )}

                                {/* Sultan editing mode */}
                                {editingSultan && (
                                  <div className="space-y-2">
                                    <p className="text-sm text-muted-foreground">Pilih pemain Sultan of Season untuk Season {seasonDetail?.number}:</p>
                                    <Input
                                      placeholder="Cari gamertag..."
                                      value={sultanSearch}
                                      onChange={(e) => {
                                        setSultanSearch(e.target.value);
                                        // Auto-switch to 'all' mode when typing if season has no players
                                        if (e.target.value.trim() && (!seasonDetail?.players || seasonDetail.players.length === 0)) {
                                          setSultanSearchMode('all');
                                        }
                                      }}
                                      className="text-xs h-8"
                                    />
                                    <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                                      {/* Mode: Season players (default when season has participants) */}
                                      {sultanSearchMode === 'season' && seasonDetail?.players && seasonDetail.players.length > 0 && (
                                        <>
                                          {seasonDetail.players
                                            .filter(p => !sultanSearch.trim() || p.gamertag.toLowerCase().includes(sultanSearch.toLowerCase()))
                                            .map((player) => (
                                            <div
                                              key={player.id}
                                              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                                selectedSultan === player.id
                                                  ? 'border-rose-500/30 bg-rose-500/5'
                                                  : 'border-border/20 bg-card/30 hover:bg-muted/20'
                                              }`}
                                              onClick={() => setSelectedSultan(player.id)}
                                            >
                                              <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
                                                <Image
                                                  src={getAvatarUrl(player.gamertag, player.division as 'male' | 'female', player.avatar)}
                                                  alt={player.gamertag}
                                                  width={32}
                                                  height={32}
                                                  loading="lazy"
                                                  className="w-full h-full object-cover"
                                                />
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium truncate">{player.gamertag}</p>
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                  <Badge className="text-xs border-0 bg-muted/50 text-muted-foreground capitalize px-1 py-0">
                                                    {player.division}
                                                  </Badge>
                                                  <span>•</span>
                                                  <span>{player.points}pts</span>
                                                  <span>•</span>
                                                  <span>{player.tournamentCount} tourney</span>
                                                </div>
                                              </div>
                                              {selectedSultan === player.id && (
                                                <div className="w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center shrink-0">
                                                  <Check className="w-3 h-3 text-white" />
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                          {sultanSearch.trim() && seasonDetail.players.filter(p => p.gamertag.toLowerCase().includes(sultanSearch.toLowerCase())).length === 0 && (
                                            <div className="text-center py-3">
                                              <p className="text-sm text-muted-foreground">Pemain tidak ditemukan di season ini</p>
                                              <Button
                                                size="sm" variant="link"
                                                className="text-rose-500 text-xs h-auto p-0 mt-1"
                                                onClick={() => setSultanSearchMode('all')}
                                              >
                                                Cari dari semua pemain →
                                              </Button>
                                            </div>
                                          )}
                                        </>
                                      )}

                                      {/* Mode: Search all players (when season has no participants or user switched) */}
                                      {sultanSearchMode === 'all' && (
                                        <>
                                          {searchedPlayers && searchedPlayers.length > 0 ? (
                                            searchedPlayers.map((player) => (
                                              <div
                                                key={player.id}
                                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                                  selectedSultan === player.id
                                                    ? 'border-rose-500/30 bg-rose-500/5'
                                                    : 'border-border/20 bg-card/30 hover:bg-muted/20'
                                                }`}
                                                onClick={() => setSelectedSultan(player.id)}
                                              >
                                                <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
                                                  <Image
                                                    src={getAvatarUrl(player.gamertag, player.division as 'male' | 'female', player.avatar)}
                                                    alt={player.gamertag}
                                                    width={32}
                                                    height={32}
                                                    loading="lazy"
                                                    className="w-full h-full object-cover"
                                                  />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <p className="text-xs font-medium truncate">{player.gamertag}</p>
                                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <Badge className="text-xs border-0 bg-muted/50 text-muted-foreground capitalize px-1 py-0">
                                                      {player.division}
                                                    </Badge>
                                                    <span>•</span>
                                                    <span>{player.points}pts</span>
                                                    <span>•</span>
                                                    <span>#{player.rank}</span>
                                                    {player.club && (
                                                      <>
                                                        <span>•</span>
                                                        <span className="truncate max-w-[80px]">{player.club.name}</span>
                                                      </>
                                                    )}
                                                  </div>
                                                </div>
                                                {selectedSultan === player.id && (
                                                  <div className="w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center shrink-0">
                                                    <Check className="w-3 h-3 text-white" />
                                                  </div>
                                                )}
                                              </div>
                                            ))
                                          ) : (
                                            <div className="text-center py-4">
                                              {sultanSearch.trim() ? (
                                                <>
                                                  <User className="w-5 h-5 text-muted-foreground/40 mx-auto mb-1" />
                                                  <p className="text-sm text-muted-foreground">Pemain tidak ditemukan</p>
                                                  <p className="text-xs text-muted-foreground/60 mt-0.5">Coba nama lain atau periksa divisi</p>
                                                </>
                                              ) : (
                                                <>
                                                  <User className="w-5 h-5 text-muted-foreground/40 mx-auto mb-1" />
                                                  <p className="text-sm text-muted-foreground">Ketik gamertag untuk mencari pemain</p>
                                                  <p className="text-xs text-muted-foreground/60 mt-0.5">Mencari dari semua pemain divisi {division === 'male' ? 'Cowo' : 'Cewe'}</p>
                                                </>
                                              )}
                                            </div>
                                          )}
                                        </>
                                      )}

                                      {/* No season players and not yet in search-all mode */}
                                      {sultanSearchMode === 'season' && (!seasonDetail?.players || seasonDetail.players.length === 0) && (
                                        <div className="text-center py-4">
                                          <User className="w-5 h-5 text-muted-foreground/40 mx-auto mb-1" />
                                          <p className="text-sm text-muted-foreground">Belum ada pemain yang berpartisipasi di season ini</p>
                                          <Button
                                            size="sm" variant="link"
                                            className="text-rose-500 text-xs h-auto p-0 mt-1"
                                            onClick={() => setSultanSearchMode('all')}
                                          >
                                            Cari dari semua pemain →
                                          </Button>
                                        </div>
                                      )}
                                    </div>

                                    {/* Mode toggle */}
                                    <div className="flex items-center gap-2">
                                      {sultanSearchMode === 'all' && seasonDetail?.players && seasonDetail.players.length > 0 && (
                                        <Button
                                          size="sm" variant="ghost"
                                          className="text-xs h-7 text-muted-foreground"
                                          onClick={() => {
                                            setSultanSearchMode('season');
                                            setSelectedSultan('');
                                          }}
                                        >
                                          ← Kembali ke pemain season
                                        </Button>
                                      )}
                                      {sultanSearchMode === 'all' && (
                                        <Badge className="text-[9px] border-0 bg-rose-500/10 text-rose-500">
                                          <User className="w-2.5 h-2.5 mr-0.5" /> Semua Pemain {division === 'male' ? 'Cowo' : 'Cewe'}
                                        </Badge>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <Button
                                        size="sm"
                                        className="text-sm bg-rose-600 hover:bg-rose-700 text-white"
                                        disabled={!selectedSultan || updateSeason.isPending}
                                        onClick={() => {
                                          setConfirmLocal({
                                            open: true,
                                            title: 'Set Sultan of Season?',
                                            description: `Set pemain ini sebagai Sultan of Season ${seasonDetail?.number}?`,
                                            onConfirm: () => {
                                              updateSeason.mutate({
                                                seasonId: season.id,
                                                data: { sultanPlayerId: selectedSultan },
                                              });
                                            },
                                          });
                                        }}
                                      >
                                        {updateSeason.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Heart className="w-3 h-3 mr-1" />}
                                        Set Sultan
                                      </Button>
                                      <Button
                                        size="sm" variant="ghost"
                                        className="text-sm"
                                        onClick={() => {
                                          setEditingSultan(null);
                                          setSelectedSultan('');
                                          setSultanSearch('');
                                          setSultanSearchMode('season');
                                        }}
                                      >
                                        Batal
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}



                            {/* ── Champion Squad Management ── */}
                            {!isTarkam && seasonDetail?.championClubId && (
                              <div className="p-3 rounded-lg bg-muted/30 border border-border/20">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                                    <Star className="w-3.5 h-3.5 text-yellow-500" /> Skuad Champion (5 Perwakilan)
                                  </p>
                                  <Button size="sm" variant="outline" className="text-sm h-8"
                                    onClick={() => {
                                      if (editingSquad) {
                                        setEditingSquad(false);
                                      } else {
                                        // Load existing squad or start fresh
                                        const existingSquad = seasonDetail?.championSquad;
                                        if (existingSquad && Array.isArray(existingSquad) && existingSquad.length > 0) {
                                          setSquadSelection(existingSquad);
                                        } else {
                                          setSquadSelection([]);
                                        }
                                        setEditingSquad(true);
                                      }
                                    }}>
                                    <Edit3 className="w-3 h-3 mr-1" />
                                    {editingSquad ? 'Tutup' : 'Set Skuad'}
                                  </Button>
                                </div>

                                {/* Current squad display */}
                                {!editingSquad && (() => {
                                  const currentSquad = seasonDetail?.championSquad;
                                  if (currentSquad && Array.isArray(currentSquad) && currentSquad.length > 0) {
                                    return (
                                      <div className="flex flex-wrap gap-2">
                                        {currentSquad.map((member, idx) => (
                                          <div key={member.id || idx} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
                                            <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0">
                                              <Image
                                                src={getAvatarUrl(member.gamertag, member.division as 'male' | 'female', undefined)}
                                                alt={member.gamertag}
                                                width={28}
                                                height={28}
                                                loading="lazy"
                                                className="w-full h-full object-cover"
                                              />
                                            </div>
                                            <div>
                                              <p className="text-xs font-medium">{member.gamertag}</p>
                                              <p className="text-xs text-muted-foreground capitalize">{member.division} {member.role === 'captain' ? '• Captain' : ''}</p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  }
                                  return (
                                    <div className="p-3 rounded-lg bg-muted/30 border border-dashed border-border/40 text-center">
                                      <Star className="w-5 h-5 text-muted-foreground/40 mx-auto mb-1" />
                                      <p className="text-sm text-muted-foreground">Belum ada skuad champion dipilih</p>
                                      <p className="text-xs text-muted-foreground/60">Klik "Set Skuad" untuk memilih 5 perwakilan</p>
                                    </div>
                                  );
                                })()}

                                {/* Squad editing mode */}
                                {editingSquad && (
                                  <div className="space-y-3">
                                    <p className="text-sm text-muted-foreground">Pilih tepat 5 anggota dari club champion sebagai perwakilan squad (termasuk anggota divisi lain dengan nama club yang sama):</p>

                                    {/* Selected squad preview */}
                                    {squadSelection.length > 0 && (
                                      <div className="flex flex-wrap gap-1.5">
                                        {squadSelection.map((member, idx) => (
                                          <div key={member.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-yellow-500/10 border border-border">
                                            <span className="text-xs font-bold text-yellow-500">#{idx + 1}</span>
                                            <span className="text-xs font-medium">{member.gamertag}</span>
                                            <button
                                              className="w-4 h-4 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/40"
                                              onClick={() => setSquadSelection(prev => prev.filter(m => m.id !== member.id))}
                                            >
                                              <X className="w-2.5 h-2.5" />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* Player selection from champion club */}
                                    <ChampionSquadSelector
                                      seasonId={seasonDetail?.id || ''}
                                      championClubId={seasonDetail?.championClubId || ''}
                                      selectedIds={squadSelection.map(m => m.id)}
                                      onToggle={(player) => {
                                        setSquadSelection(prev => {
                                          const exists = prev.find(m => m.id === player.id);
                                          if (exists) return prev.filter(m => m.id !== player.id);
                                          if (prev.length >= 5) {
                                            toast.error('Maksimal 5 perwakilan squad');
                                            return prev;
                                          }
                                          return [...prev, { id: player.id, gamertag: player.gamertag, division: player.division, role: prev.length === 0 ? 'captain' : 'member', avatar: player.avatar || null }];
                                        });
                                      }}
                                    />

                                    <div className="flex items-center gap-2">
                                      <Button
                                        size="sm"
                                        className="text-sm"
                                        disabled={squadSelection.length !== 5 || updateSeason.isPending}
                                        onClick={() => {
                                          // Ensure first member is captain
                                          const squad = squadSelection.map((m, idx) => ({
                                            ...m,
                                            role: idx === 0 ? 'captain' : 'member',
                                          }));
                                          updateSeason.mutate({
                                            seasonId: season.id,
                                            data: { championSquad: squad },
                                          });
                                        }}
                                      >
                                        {updateSeason.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Star className="w-3 h-3 mr-1" />}
                                        Simpan Skuad ({squadSelection.length}/5)
                                      </Button>
                                      {squadSelection.length === 5 && squadSelection.some(m => m.division !== squadSelection[0]?.division) && (
                                        <span className="text-xs text-idm-gold-warm">Cross-division</span>
                                      )}
                                      {squadSelection.length < 5 && squadSelection.length > 0 && (
                                        <span className="text-xs text-yellow-500">Pilih {5 - squadSelection.length} lagi</span>
                                      )}
                                      <Button
                                        size="sm" variant="ghost"
                                        className="text-sm"
                                        onClick={() => setEditingSquad(false)}
                                      >
                                        Batal
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* ── Status Management ── */}
                            <div className="p-3 rounded-lg bg-muted/30 border border-border/20">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                                  <Flag className="w-3.5 h-3.5" /> Status Season
                                </p>
                                {!isStatusEditing && (
                                  <Button size="sm" variant="outline" className="text-sm h-8"
                                    onClick={() => setEditingStatus(season.id)}>
                                    <Edit3 className="w-3 h-3 mr-1" /> Ubah
                                  </Button>
                                )}
                              </div>

                              {!isStatusEditing ? (
                                <div className="flex items-center gap-2">
                                  <Badge className={`text-xs border-0 ${statusColors[seasonDetail?.status || season.status]}`}>
                                    {seasonDetail?.status === 'active' && <Play className="w-3 h-3 mr-1" />}
                                    {seasonDetail?.status === 'completed' && <Flag className="w-3 h-3 mr-1" />}
                                    {seasonDetail?.status === 'upcoming' && <Calendar className="w-3 h-3 mr-1" />}
                                    {statusLabels[seasonDetail?.status || season.status] || season.status}
                                  </Badge>
                                  {(isTarkam ? seasonDetail?.championPlayerId : seasonDetail?.championClubId) && (
                                    <span className="text-sm text-muted-foreground">
                                      (Champion sudah ditentukan)
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  {(['active', 'upcoming', 'completed'] as const).map((s) => (
                                    <Button
                                      key={s}
                                      size="sm"
                                      variant={seasonDetail?.status === s ? 'default' : 'outline'}
                                      className={`text-sm h-8 ${
                                        seasonDetail?.status === s ? statusColors[s] : ''
                                      }`}
                                      onClick={() => handleStatusChange(season.id, s)}
                                    >
                                      {s === 'active' && <Play className="w-3 h-3 mr-1" />}
                                      {s === 'upcoming' && <Calendar className="w-3 h-3 mr-1" />}
                                      {s === 'completed' && <Flag className="w-3 h-3 mr-1" />}
                                      {statusLabels[s]}
                                    </Button>
                                  ))}
                                  <Button
                                    size="sm" variant="ghost"
                                    className="text-sm h-8"
                                    onClick={() => setEditingStatus(null)}
                                  >
                                    Batal
                                  </Button>
                                </div>
                              )}
                            </div>

                            {/* ── Tutup Season Button ── */}
                            {(seasonDetail?.status || season.status) === 'active' && (
                              <div className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/15">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-xs font-semibold text-orange-400 flex items-center gap-1.5">
                                      <Lock className="w-3.5 h-3.5" /> Tutup Season
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-0.5">
                                      Tutup season ini, tentukan champion otomatis berdasarkan per-season points. Season baru harus dibuat manual.
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    className="text-sm bg-orange-500 hover:bg-orange-600 text-white shrink-0"
                                    disabled={closeSeason.isPending}
                                    onClick={() => {
                                      setConfirmLocal({
                                        open: true,
                                        title: 'Tutup Season?',
                                        description: `Season "${season.name}" akan ditutup dan status berubah menjadi "Selesai". Champion akan ditentukan otomatis dari per-season points. Tindakan ini tidak dapat dibatalkan.`,
                                        onConfirm: () => {
                                          closeSeason.mutate(season.id);
                                        },
                                      });
                                    }}
                                  >
                                    {closeSeason.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Lock className="w-3 h-3 mr-1" />}
                                    Tutup Season
                                  </Button>
                                </div>
                              </div>
                            )}

                            {/* ── Season Stats Summary ── */}
                            <div className="grid grid-cols-3 gap-2">
                              {isTarkam ? (
                                <div className="p-2.5 rounded-lg bg-muted/30 border border-border/20 text-center">
                                  <Star className={`w-4 h-4 ${dt.neonText} mx-auto mb-1`} />
                                  <p className="text-sm font-bold">{seasonDetail?.players?.length || 0}</p>
                                  <p className="text-xs text-muted-foreground">Pemain</p>
                                </div>
                              ) : (
                                <div className="p-2.5 rounded-lg bg-muted/30 border border-border/20 text-center">
                                  <Shield className={`w-4 h-4 ${dt.neonText} mx-auto mb-1`} />
                                  <p className="text-sm font-bold">{seasonDetail?._count?.clubs || season._count?.clubs || 0}</p>
                                  <p className="text-xs text-muted-foreground">Club</p>
                                </div>
                              )}
                              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/20 text-center">
                                <Trophy className={`w-4 h-4 ${dt.neonText} mx-auto mb-1`} />
                                <p className="text-sm font-bold">{seasonDetail?._count?.tournaments || season._count?.tournaments || 0}</p>
                                <p className="text-xs text-muted-foreground">Tournament</p>
                              </div>
                              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/20 text-center">
                                <Star className={`w-4 h-4 ${dt.neonText} mx-auto mb-1`} />
                                <p className="text-sm font-bold">{isTarkam ? (seasonDetail?.players?.reduce((sum, p) => sum + p.points, 0) || 0) : (seasonDetail?.clubs?.reduce((sum, c) => sum + c.points, 0) || 0)}</p>
                                <p className="text-xs text-muted-foreground">Total Poin</p>
                              </div>
                            </div>

                            {/* ── Clubs in Season (Liga only) ── */}
                            {!isTarkam && (
                              <div className="p-3 rounded-lg bg-muted/30 border border-border/20">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-sm font-semibold uppercase tracking-wider flex items-center gap-1.5">
                                    <Shield className="w-3.5 h-3.5 text-blue-400" /> Club di Season Ini ({seasonDetail?.clubs?.length || 0})
                                  </p>
                                  <AddClubToSeasonButton seasonId={season.id} seasonDivision={season.division} dt={dt} qc={qc} />
                                </div>
                                {seasonDetail?.clubs && seasonDetail.clubs.length > 0 ? (
                                  <div className="space-y-1 max-h-52 overflow-y-auto custom-scrollbar">
                                    {seasonDetail.clubs
                                      .sort((a, b) => b.points - a.points)
                                      .map((club, idx) => {
                                        const clubName = getClubName(club);
                                        const clubLogo = getClubLogo(club);
                                        const isChampion = (club.profileId || club.profile?.id) === seasonDetail.championClubId;
                                        return (
                                          <div
                                            key={club.id}
                                            className={`flex items-center gap-2 p-3 rounded-lg border text-xs transition-colors ${
                                              isChampion
                                                ? 'border-yellow-500/20 bg-yellow-500/5'
                                                : 'border-border/20 bg-card/30 hover:bg-muted/20'
                                            }`}
                                          >
                                            <span className={`w-5 text-center font-bold text-xs ${
                                              idx === 0 ? 'text-yellow-500' :
                                              idx === 1 ? 'text-muted-foreground' :
                                              idx === 2 ? 'text-amber-600' :
                                              'text-muted-foreground'
                                            }`}>#{idx + 1}</span>
                                            <div className="w-6 h-6 rounded overflow-hidden shrink-0">
                                              {clubLogo ? (
                                                <ClubLogoImage clubName={clubName} dbLogo={clubLogo} alt={clubName} width={24} height={24} className="w-full h-full object-cover" />
                                              ) : (
                                                <div className={`w-full h-full flex items-center justify-center ${dt.iconBg}`}>
                                                  <Shield className={`w-2.5 h-2.5 ${dt.neonText}`} />
                                                </div>
                                              )}
                                            </div>
                                            <span className={`font-medium truncate ${isChampion ? 'text-yellow-500' : ''}`}>
                                              {clubName}
                                            </span>
                                            {isChampion && (
                                              <Crown className="w-3 h-3 text-yellow-500 shrink-0" />
                                            )}
                                            <span className="ml-auto text-xs text-muted-foreground shrink-0">
                                              {club.points}pts • {club.wins}W/{club.losses}L
                                            </span>
                                          </div>
                                        );
                                      })}
                                  </div>
                                ) : (
                                  <div className="text-center py-3">
                                    <Shield className="w-5 h-5 text-muted-foreground/40 mx-auto mb-1" />
                                    <p className="text-sm text-muted-foreground">
                                      Belum ada club di season ini
                                    </p>
                                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                                      Gunakan tombol + untuk menambahkan club
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* ── Players Quick List (Tarkam only) ── */}
                            {isTarkam && seasonDetail?.players && seasonDetail.players.length > 0 && (
                              <div>
                                <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                  <Star className="w-3 h-3" /> Pemain di Season Ini
                                </p>
                                <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                                  {seasonDetail.players.map((player, idx) => (
                                    <div
                                      key={player.id}
                                      className={`flex items-center gap-2 p-3 rounded-lg border text-xs ${
                                        player.id === seasonDetail.championPlayerId
                                          ? 'border-yellow-500/20 bg-yellow-500/5'
                                          : 'border-border/20 bg-card/30'
                                      }`}
                                    >
                                      <span className={`w-5 text-center font-bold text-xs ${
                                        idx === 0 ? 'text-yellow-500' :
                                        idx === 1 ? 'text-muted-foreground' :
                                        idx === 2 ? 'text-amber-600' :
                                        'text-muted-foreground'
                                      }`}>#{idx + 1}</span>
                                      <div className="w-6 h-6 rounded overflow-hidden shrink-0">
                                        <Image
                                          src={getAvatarUrl(player.gamertag, player.division as 'male' | 'female', player.avatar)}
                                          alt={player.gamertag}
                                          width={24}
                                          height={24}
                                          loading="lazy"
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                      <span className={`font-medium truncate ${player.id === seasonDetail.championPlayerId ? 'text-yellow-500' : ''}`}>
                                        {player.gamertag}
                                      </span>
                                      {player.id === seasonDetail.championPlayerId && (
                                        <Crown className="w-3 h-3 text-yellow-500 shrink-0" />
                                      )}
                                      <span className="ml-auto text-xs text-muted-foreground">
                                        {player.points}pts • {player.tournamentCount} tourney
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* Local Confirm Dialog */}
      <AlertDialog open={confirmLocal.open} onOpenChange={(open) => setConfirmLocal(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmLocal.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmLocal.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLocal.onConfirm}>Lanjutkan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Add Club To Season Button — opens a dropdown of available ClubProfiles not yet in this season
function AddClubToSeasonButton({ seasonId, seasonDivision, dt, qc }: {
  seasonId: string;
  seasonDivision: string;
  dt: DivisionTheme;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const authFetch = async (url: string, options: RequestInit = {}) => {
    return fetch(url, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...options.headers } });
  };

  // Fetch all ClubProfiles
  const { data: profiles } = useQuery<Array<{ id: string; name: string; logo: string | null; memberCount: number }>>({
    queryKey: ['club-profiles-all'],
    queryFn: async () => {
      const res = await fetch('/api/clubs?unified=true', { credentials: 'include' });
      if (!res.ok) return [];
      const data = await res.json();
      return data.map((c: { id: string; name: string; logo: string | null; memberCount?: number; seasonRecords?: Array<{ seasonId: string }> }) => ({
        id: c.id,
        name: c.name,
        logo: c.logo,
        memberCount: c.memberCount || 0,
        seasonIds: c.seasonRecords?.map((r: { seasonId: string }) => r.seasonId) || [],
      }));
    },
    enabled: open,
  });

  // Fetch current season clubs to filter out already-added ones
  const { data: seasonDetail } = useQuery<SeasonData>({
    queryKey: ['admin-season-detail', seasonId],
    queryFn: async () => {
      const res = await fetch(`/api/seasons/${seasonId}`, { credentials: 'include' });
      const data = await res.json();
      // API returns { season: {...}, standings: [...], clubs: [...] }
      if (data?.season) {
        return { ...data.season, clubs: data.clubs || [], players: data.standings || [], _count: { tournaments: data.season.tournamentCount || 0, clubs: (data.clubs || []).length } };
      }
      return data;
    },
    enabled: open,
  });

  const existingProfileIds = new Set((seasonDetail?.clubs || []).map(c => c.profileId || c.profile?.id));
  const available = (profiles || []).filter(p => !existingProfileIds.has(p.id));
  const filtered = available.filter(p => !search.trim() || p.name.toLowerCase().includes(search.toLowerCase()));

  const handleAdd = async (profileId: string) => {
    setAdding(profileId);
    try {
      const res = await authFetch('/api/clubs', {
        method: 'POST',
        body: JSON.stringify({ name: (available.find(p => p.id === profileId))?.name, seasonId }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      qc.invalidateQueries({ queryKey: ['admin-season-detail', seasonId] });
      qc.invalidateQueries({ queryKey: ['admin-seasons'] });
      toast.success('Club berhasil ditambahkan ke season!');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Gagal menambahkan club');
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="relative">
      <Button size="sm" variant="outline" className="text-sm h-8 w-8 p-0" onClick={() => setOpen(!open)}>
        <Plus className="w-3 h-3" />
      </Button>
      {open && (
        <div className="absolute right-0 top-8 z-50 w-56 bg-card border border-border/30 rounded-lg shadow p-2 space-y-1.5">
          <Input
            placeholder="Cari club..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm h-8"
          />
          <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-0.5">
            {filtered.map((profile) => (
              <div
                key={profile.id}
                className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/20 cursor-pointer transition-colors"
                onClick={() => handleAdd(profile.id)}
              >
                {profile.logo ? (
                  <ClubLogoImage clubName={profile.name} dbLogo={profile.logo} alt={profile.name} width={16} height={16} className="w-4 h-4 rounded-sm object-cover shrink-0" />
                ) : (
                  <Shield className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="text-sm truncate flex-1">{profile.name}</span>
                {adding === profile.id ? (
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground shrink-0" />
                ) : (
                  <Plus className="w-3 h-3 text-muted-foreground shrink-0" />
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                {available.length === 0 ? 'Semua club sudah ada di season' : 'Club tidak ditemukan'}
              </p>
            )}
          </div>
          <Button size="sm" variant="ghost" className="text-xs h-8 w-full" onClick={() => { setOpen(false); setSearch(''); }}>Tutup</Button>
        </div>
      )}
    </div>
  );
}

// Champion Squad Selector — fetches and displays club members for selection
function ChampionSquadSelector({
  seasonId,
  championClubId,
  selectedIds,
  onToggle,
}: {
  seasonId: string;
  championClubId: string;
  selectedIds: string[];
  onToggle: (player: { id: string; gamertag: string; division: string; avatar?: string | null }) => void;
}) {
  const [search, setSearch] = useState('');

  // Fetch members from champion club AND same-named clubs across both divisions
  // This allows selecting members from the same club name regardless of division
  // e.g., if MAXIMOUS (male) is champion, MAXIMOUS (female) members are also available
  const { data: clubData, isLoading } = useQuery({
    queryKey: ['champion-club-members', championClubId],
    queryFn: async () => {
      const res = await fetch(`/api/clubs/champion-members?clubId=${championClubId}`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!championClubId,
  });

  const allPlayers = clubData?.members || [];

  if (isLoading) {
    return <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;
  }

  if (allPlayers.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-2">Tidak ada anggota club champion ditemukan</p>;
  }

  const filtered = search.trim()
    ? allPlayers.filter((p: { gamertag: string }) => p.gamertag.toLowerCase().includes(search.toLowerCase()))
    : allPlayers;

  const maleCount = allPlayers.filter((p: { division: string }) => p.division === 'male').length;
  const femaleCount = allPlayers.filter((p: { division: string }) => p.division === 'female').length;

  return (
    <div className="space-y-2">
      <Input
        placeholder="Cari anggota club (gamertag)..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="text-xs h-8"
      />
      <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
        {filtered.map((player: { id: string; gamertag: string; division: string; avatar?: string | null; clubDivision: string; role: string }) => {
          const isSelected = selectedIds.includes(player.id);
          return (
            <div
              key={player.id}
              className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                isSelected
                  ? 'border-yellow-500/30 bg-yellow-500/5'
                  : 'border-border/20 bg-card/30 hover:bg-muted/20'
              }`}
              onClick={() => onToggle({ id: player.id, gamertag: player.gamertag, division: player.division, avatar: player.avatar })}
            >
              <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0">
                <Image
                  src={getAvatarUrl(player.gamertag, player.division as 'male' | 'female', player.avatar)}
                  alt={player.gamertag}
                  width={28}
                  height={28}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{player.gamertag}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="capitalize">{player.division}</span>
                  {player.clubDivision !== player.division && (
                    <span className="text-idm-gold-warm ml-1">• dari club {player.clubDivision}</span>
                  )}
                  {player.role === 'captain' && <span className="ml-1 text-yellow-500">• Captain</span>}
                </p>
              </div>
              {isSelected && (
                <div className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-black" />
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">Anggota tidak ditemukan</p>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center">
        {allPlayers.length} anggota club {clubData?.clubName || 'champion'} • {maleCount} male, {femaleCount} female • bebas pilih dari divisi mana saja
      </p>
    </div>
  );
}
