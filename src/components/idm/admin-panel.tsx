'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/lib/store';
import Image from 'next/image';
import {
  Shield, Users, Music, Trophy, Gift, Plus,
  Loader2, MapPin, Phone, Globe,
  LayoutDashboard, Sliders, Flame, Calendar,
  Award, Sparkles, Clock, UserCheck
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { AdminPlayersTab } from './admin/tabs/admin-players-tab';
import { AdminKeuanganTab } from './admin/tabs/admin-keuangan-tab';
import { CmsPanel } from './cms-panel';
import { ErrorBoundary } from './error-boundary';
import { TournamentManager } from './tournament-manager';
import { ClubManagement } from './club-management';
import { CloudinaryPicker } from './cloudinary-picker';
import { AdminOverview } from './admin-overview';
import { AdminSponsorPanel } from './admin-sponsor-panel';
import { AdminAchievementPanel } from './admin-achievement-panel';
import { AdminSkinPanel } from './admin-skin-panel';
import { AdminSettingsPanel } from './admin-settings-panel';
import { AdminDivisionContentTab } from './admin/tabs/admin-division-content-tab';
import { AdminPendingTab } from './admin/tabs/admin-pending-tab';
import { AdminManagement } from './admin-management';
import { AdminSeasonPanel } from './admin-season-panel';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { formatCurrency, getAvatarUrl, formatTarkamSeasonName } from '@/lib/utils';

// Player form type
interface PlayerForm {
  name: string;
  gamertag: string;
  tier: string;
  division: string;
  city: string;
  phone: string;
  joki: string;
  points: string;
  clubId: string;
}

const emptyForm: PlayerForm = {
  name: '',
  gamertag: '',
  tier: 'B',
  division: 'male',
  city: '',
  phone: '',
  joki: '',
  points: '0',
  clubId: '_none',
};

export function AdminPanel() {
  const { division: storeDivision, setDivision } = useAppStore();
  const dt = useDivisionTheme();
  const qc = useQueryClient();

  // Admin panel always requires a specific division — "semua" is for community views only.
  // Auto-default to "male" if entering admin while store still has "semua" from community.
  useEffect(() => {
    if (storeDivision === 'semua') {
      setDivision('male');
    }
  }, [storeDivision, setDivision]);

  // Tab state — must be declared before queries that use `enabled` based on activeTab
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileCategory, setMobileCategory] = useState('dashboard');

  const { data: players, isLoading: isLoadingPlayers } = useQuery({
    queryKey: ['admin-players', storeDivision],
    queryFn: async () => { try { const res = await fetch(`/api/admin/players?division=${storeDivision}&limit=50`, { credentials: 'include' }); if (!res.ok) return { data: [], total: 0 }; return res.json(); } catch { return { data: [], total: 0 }; } },
    enabled: activeTab === 'pemain' || activeTab === 'dashboard',
  });

  // Pagination state for "Load More"
  const [playerOffset, setPlayerOffset] = useState(0);
  const [allPlayerPages, setAllPlayerPages] = useState<any[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastDivision, setLastDivision] = useState(storeDivision);
  const PLAYERS_PAGE_SIZE = 50;

  // When main query data changes (initial load or refetch), reset pagination
  const playersData = players?.data || [];
  const playersTotal = players?.total || 0;
  const hasMorePlayers = playersData.length < playersTotal;

  // Reset accumulated pages when division changes
  if (lastDivision !== storeDivision) {
    setLastDivision(storeDivision);
    setAllPlayerPages([]);
    setPlayerOffset(0);
  }

  const loadMorePlayers = async () => {
    const nextOffset = playerOffset + PLAYERS_PAGE_SIZE;
    setIsLoadingMore(true);
    try {
      const res = await fetch(`/api/admin/players?division=${storeDivision}&limit=${PLAYERS_PAGE_SIZE}&offset=${nextOffset}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAllPlayerPages(prev => [...prev, ...(data.data || [])]);
        setPlayerOffset(nextOffset);
      }
    } catch { /* ignore */ }
    setIsLoadingMore(false);
  };

  const { data: stats } = useQuery({
    queryKey: ['stats', storeDivision],
    queryFn: async () => { const res = await fetch(`/api/stats?division=${storeDivision}`, { credentials: 'include' }); return res.json(); },
  });

  const { data: donations } = useQuery({
    queryKey: ['admin-donations', storeDivision],
    queryFn: async () => { try { const res = await fetch(`/api/donations?status=all&division=${storeDivision}`, { credentials: 'include' }); if (!res.ok) return { donations: [] }; return res.json(); } catch { return { donations: [] }; } },
    enabled: activeTab === 'keuangan' || activeTab === 'dashboard',
  });

  const { data: cmsSettings } = useQuery({
    queryKey: ['admin-cms-settings'],
    queryFn: async () => { try { const res = await fetch('/api/cms/settings', { credentials: 'include' }); if (!res.ok) return {}; const d = await res.json(); return (d?.map || {}) as Record<string, string>; } catch { return {}; } },
    enabled: activeTab === 'pengaturan' || activeTab === 'keuangan',
  });

  // Get clubs for dropdown — use unified mode to show ALL clubs across both divisions
  // Clubs belong to ALL divisions, so the dropdown should show all clubs
  const clubsSeasonId = stats?.seasonForClubs?.id || stats?.season?.id;
  const { data: clubs } = useQuery({
    queryKey: ['admin-clubs', storeDivision, 'unified'],
    queryFn: async () => {
      const res = await fetch(`/api/clubs?unified=true&division=${storeDivision}`, { credentials: 'include' });
      return res.json();
    },
  });

  // ★ Helper: Invalidate all landing page React Query caches so changes appear immediately
  const invalidateLandingCache = () => {
    qc.invalidateQueries({ queryKey: ['stats'] });        // Invalidates ALL stats queries (male, female, all seasons)
    qc.invalidateQueries({ queryKey: ['cms-content'] });   // CMS data (hero text, images, etc.)
  };

  // Helper for authenticated fetch
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

  // Player CRUD mutations
  const createPlayer = useMutation({
    mutationFn: async (data: PlayerForm) => {
      const res = await authFetch('/api/players', {
        method: 'POST',
        body: JSON.stringify({
          name: data.name,
          gamertag: data.gamertag,
          tier: data.tier,
          division: data.division,
          city: data.city || undefined,
          phone: data.phone || undefined,
          joki: data.joki || undefined,
          points: parseInt(data.points) || 0,
          clubId: data.clubId === '_none' ? undefined : data.clubId,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-players', storeDivision] });
      invalidateLandingCache(); // ★ Landing page: update stats/league data
      toast.success('Player berhasil ditambahkan!');
      setPlayerFormOpen(false);
      setFormData(emptyForm);
    },
    onError: (e: Error) => { toast.error(e.message); },
  });

  const updatePlayer = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PlayerForm> }) => {
      const res = await authFetch(`/api/players/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: data.name,
          gamertag: data.gamertag,
          tier: data.tier,
          division: data.division,
          city: data.city,
          phone: data.phone || null,
          joki: data.joki || null,
          points: data.points ? parseInt(data.points) : undefined,
          clubId: data.clubId === '_none' ? null : data.clubId,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-players', storeDivision] });
      invalidateLandingCache(); // ★ Landing page: update stats/league data
      toast.success('Player berhasil diperbarui!');
      setPlayerFormOpen(false);
      setEditingPlayer(null);
      setFormData(emptyForm);
    },
    onError: (e: Error) => { toast.error(e.message); },
  });

  const deletePlayer = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/players?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-players', storeDivision] });
      qc.invalidateQueries({ queryKey: ['admin-pending-registrations'] });
      // Reset pagination to avoid stale "load more" pages
      setAllPlayerPages([]);
      setPlayerOffset(0);
      invalidateLandingCache(); // ★ Landing page: update stats/league data
      toast.success('Player berhasil dihapus!');
    },
    onError: (e: Error) => { toast.error(e.message); },
  });

  const updateTier = useMutation({
    mutationFn: async ({ playerId, tier }: { playerId: string; tier: string }) => {
      const res = await authFetch(`/api/players/${playerId}`, {
        method: 'PUT',
        body: JSON.stringify({ tier }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-players', storeDivision] }); invalidateLandingCache(); toast.success('Tier diperbarui!'); },
  });

  const updateAvatar = useMutation({
    mutationFn: async ({ playerId, avatar }: { playerId: string; avatar: string }) => {
      const res = await authFetch(`/api/players/${playerId}`, {
        method: 'PUT',
        body: JSON.stringify({ avatar }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update avatar');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-players', storeDivision] });
      qc.invalidateQueries({ queryKey: ['player-achievements'] });
      invalidateLandingCache(); // ★ Landing page: update player avatar in stats
      toast.success('Avatar diperbarui!');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleAvatarSelect = (url: string, _publicId?: string) => {
    if (editingPlayerId) {
      updateAvatar.mutate({ playerId: editingPlayerId, avatar: url });
      setEditingPlayerId(null);
    }
  };

  const openAvatarPicker = (playerId: string) => {
    setEditingPlayerId(playerId);
    setCloudinaryOpen(true);
  };

  const addDonation = useMutation({
    mutationFn: async (data: { donorName: string; amount: number; message: string; type: string; tournamentId?: string }) => {
      const res = await authFetch('/api/donations', {
        method: 'POST',
        body: JSON.stringify({ ...data, division: storeDivision, seasonId: stats?.season?.id, tournamentId: stats?.activeTournament?.id, source: 'admin' }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-donations', storeDivision] }); toast.success('Donasi berhasil ditambahkan!'); },
  });

  const approveDonation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'approved' | 'rejected' }) => {
      const res = await authFetch('/api/donations', {
        method: 'PATCH',
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['admin-donations', storeDivision] });
      qc.invalidateQueries({ queryKey: ['stats', storeDivision] });
      qc.invalidateQueries({ queryKey: ['feed'] });
      invalidateLandingCache(); // ★ Landing page: update prize pool
      toast.success(variables.status === 'approved' ? 'Donasi disetujui ✅' : 'Donasi ditolak ❌');
    },
  });

  const deleteDonation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch('/api/donations', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-donations', storeDivision] }); qc.invalidateQueries({ queryKey: ['feed'] }); toast.success('Donasi dihapus'); },
  });

  // Batch save payment settings — single API call instead of 8 sequential calls
  const savePaymentSettingsBatch = useMutation({
    mutationFn: async (items: { key: string; value: string; type?: string }[]) => {
      const res = await authFetch('/api/cms/settings', {
        method: 'POST',
        body: JSON.stringify({ items }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      setPaymentForm(null);
      qc.invalidateQueries({ queryKey: ['admin-cms-settings'] });
      invalidateLandingCache(); // ★ Landing page: update CMS content
      toast.success('Setting pembayaran disimpan!');
    },
  });

  // Pending registrations — only when pemain tab is active
  const { data: pendingRegistrations } = useQuery({
    queryKey: ['admin-pending-registrations', storeDivision],
    queryFn: async () => { try { const res = await fetch(`/api/players?registrationStatus=pending&division=${storeDivision}`, { credentials: 'include' }); if (!res.ok) return []; return res.json(); } catch { return []; } },
    enabled: activeTab === 'pemain',
  });

  // Pending players count — for the Pending tab badge (always fetch)
  const { data: pendingPlayersCountData } = useQuery({
    queryKey: ['admin-pending-players-count', storeDivision],
    queryFn: async () => { try { const res = await fetch(`/api/admin/players/approve?status=pending&division=${storeDivision}`, { credentials: 'include' }); if (!res.ok) return { count: 0 }; return res.json(); } catch { return { count: 0 }; } },
  });
  const pendingPlayersCount = pendingPlayersCountData?.count || 0;

  // Tournament management is handled entirely by TournamentManager component
  // — no duplicate inline approval section needed

  const approveRegistration = useMutation({
    mutationFn: async ({ playerId, tier }: { playerId: string; tier: string }) => {
      const res = await authFetch(`/api/players/${playerId}`, {
        method: 'PUT',
        body: JSON.stringify({ registrationStatus: 'approved', tier }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-pending-registrations'] }); qc.invalidateQueries({ queryKey: ['admin-players', storeDivision] }); invalidateLandingCache(); toast.success('Pendaftaran disetujui!'); },
  });

  const rejectRegistration = useMutation({
    mutationFn: async (playerId: string) => {
      const res = await authFetch(`/api/players/${playerId}`, {
        method: 'PUT',
        body: JSON.stringify({ registrationStatus: 'rejected', isActive: false }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-pending-registrations'] }); qc.invalidateQueries({ queryKey: ['admin-players', storeDivision] }); invalidateLandingCache(); toast.success('Pendaftaran ditolak.'); },
  });

  // Liga scoring mutations removed — Liga feature is deprecated

  // State
  const [newDonation, setNewDonation] = useState({ donorName: '', amount: '', message: '', type: 'weekly' });
  const [paymentFormState, setPaymentForm] = useState<Record<string, string> | null>(null);
  const cmsSettingsBase = cmsSettings || {};
  const paymentForm = paymentFormState ?? cmsSettingsBase;
  // When setting a payment form field, always merge from the latest CMS settings base
  // This ensures fields not yet edited by admin are preserved from server data
  const updatePaymentForm = (updates: Partial<Record<string, string>>) => {
    setPaymentForm(prev => ({ ...cmsSettingsBase, ...prev, ...updates }) as Record<string, string>);
  };

  const categoryTabMap: Record<string, string[]> = {
    dashboard: ['dashboard'],
    peserta: ['pending', 'pemain', 'club', 'turnamen', 'keuangan'],
    season: ['season'],
    konten: ['konten', 'sponsor'],
    penghargaan: ['achievement', 'skin'],
    sistem: ['pengaturan'],
  };

  // Navigate to a subtab — also updates the parent category for correct highlighting
  const navigateToTab = (tabKey: string) => {
    setActiveTab(tabKey);
    // Find which category this tab belongs to
    for (const [cat, tabs] of Object.entries(categoryTabMap)) {
      if (tabs.includes(tabKey)) {
        setMobileCategory(cat);
        break;
      }
    }
  };

  const [searchPlayer, setSearchPlayer] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  // Player form state
  const [playerFormOpen, setPlayerFormOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<{ id: string; data: PlayerForm } | null>(null);
  const [formData, setFormData] = useState<PlayerForm>(emptyForm);

  // Cloudinary picker state
  const [cloudinaryOpen, setCloudinaryOpen] = useState(false);
  const [qrisPickerOpen, setQrisPickerOpen] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);

  // Open form for new player
  const openNewPlayerForm = () => {
    setEditingPlayer(null);
    setFormData({ ...emptyForm, division: storeDivision });
    setPlayerFormOpen(true);
  };

  // Open form for editing
  const openEditPlayerForm = (player: {
    id: string;
    name: string;
    gamertag: string;
    tier: string;
    division: string;
    city: string;
    phone: string | null;
    joki: string | null;
    points: number;
    clubMembers?: Array<{ profile: { id: string; name: string; logo?: string | null } }>;
  }) => {
    setEditingPlayer({
      id: player.id,
      data: {
        name: player.name,
        gamertag: player.gamertag,
        tier: player.tier,
        division: player.division,
        city: player.city || '',
        phone: player.phone || '',
        joki: player.joki || '',
        points: player.points.toString(),
        clubId: player.clubMembers?.[0]?.profile?.id || '_none',
      }
    });
    setFormData({
      name: player.name,
      gamertag: player.gamertag,
      tier: player.tier,
      division: player.division,
      city: player.city || '',
      phone: player.phone || '',
      joki: player.joki || '',
      points: player.points.toString(),
      clubId: player.clubMembers?.[0]?.profile?.id || '_none',
    });
    setPlayerFormOpen(true);
  };

  // Submit form
  const handleSubmit = () => {
    if (!formData.name.trim() || !formData.gamertag.trim()) {
      toast.error('Nama dan nickname wajib diisi');
      return;
    }

    if (editingPlayer) {
      updatePlayer.mutate({ id: editingPlayer.id, data: formData });
    } else {
      createPlayer.mutate(formData);
    }
  };

  const filteredPlayers = [...playersData, ...allPlayerPages].filter((p: { gamertag: string; name: string }) =>
    p.gamertag.toLowerCase().includes(searchPlayer.toLowerCase()) ||
    p.name.toLowerCase().includes(searchPlayer.toLowerCase())
  );

  // paymentForm is derived from cmsSettings (no useEffect needed)

  // Count helpers for tab badges
  const playerCount = filteredPlayers?.length || 0;
  const pendingCount = pendingRegistrations?.length || 0;
  // Note: pendingPlayersCount (from /api/admin/players/approve) is used for the Pending tab badge
  const donationCount = donations?.donations?.filter((d: { status: string }) => d.status === 'pending').length || 0;

  return (
    <div className="space-y-3 w-full admin-panel-glass rounded-lg p-4 sm:p-6 border border-border">
      {/* Header + Season Info */}
      <div className="flex flex-col gap-2 mb-1">
        <div className="flex items-center gap-2">
          <Shield className={`w-5 h-5 ${dt.neonText}`} />
          <h2 className="text-lg font-bold text-gradient-fury">Panel Admin</h2>
          <Badge className="bg-red-500/10 text-red-500 text-sm border-0">ADMIN</Badge>
          {/* Division Switcher — always visible */}
          <div className="flex items-center bg-muted/60 rounded-lg p-0.5 gap-0.5 ml-auto">
            <button
              type="button"
              onClick={() => setDivision('male')}
              className={`px-2.5 py-1 rounded-md text-sm font-bold transition-colors cursor-pointer ${
                storeDivision === 'male'
                  ? 'bg-cyan-500/20 text-cyan-400 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground/70'
              }`}
            >
              🕺 Cowo
            </button>
            <button
              type="button"
              onClick={() => setDivision('female')}
              className={`px-2.5 py-1 rounded-md text-sm font-bold transition-colors cursor-pointer ${
                storeDivision === 'female'
                  ? 'bg-purple-500/20 text-purple-400 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground/70'
              }`}
            >
              💃 Cewe
            </button>
          </div>
        </div>
        {/* Season Info Indicator */}
        {stats?.season && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-idm-gold-warm/[0.06] border border-idm-gold-warm/10">
            <Calendar className="w-3.5 h-3.5 text-idm-gold-warm shrink-0" />
            <span className="text-xs font-medium text-idm-gold-warm truncate">{formatTarkamSeasonName(stats.season.name, stats.season.number)}</span>
            <Badge
              className={
                stats.season.status === 'active'
                  ? 'text-xs border-0 px-1.5 py-0 bg-green-500/15 text-green-400'
                  : stats.season.status === 'completed'
                    ? 'text-xs border-0 px-1.5 py-0 bg-muted text-muted-foreground'
                    : 'text-xs border-0 px-1.5 py-0 bg-idm-gold-warm/15 text-idm-gold-warm'
              }
            >
              {stats.season.status === 'active' ? '● Aktif' : stats.season.status === 'completed' ? 'Selesai' : stats.season.status}
            </Badge>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" aria-label="Admin panel navigation">
        {/* Mobile: Grouped category navigation — 6 categories */}
        <div className="sm:hidden space-y-2">
          <div className="grid grid-cols-3 gap-1">
            {([
              { key: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
              { key: 'peserta', icon: Users, label: 'Tarkam' },
              { key: 'season', icon: Calendar, label: 'Season' },
              { key: 'konten', icon: Globe, label: 'Konten' },
              { key: 'penghargaan', icon: Award, label: 'Achiev' },
              { key: 'sistem', icon: Sliders, label: 'Sistem' },
            ] as const).map(cat => (
              <button
                key={cat.key}
                onClick={() => {
                  setMobileCategory(cat.key);
                  const firstTab = categoryTabMap[cat.key]?.[0];
                  if (firstTab) setActiveTab(firstTab);
                }}
                className={`relative flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-sm font-medium transition-colors min-h-[44px] justify-center admin-nav-btn ${
                  mobileCategory === cat.key
                    ? 'bg-idm-gold-warm/15 text-idm-gold-warm border border-idm-gold-warm/25 shadow-sm'
                    : 'bg-muted/20 text-muted-foreground border border-transparent hover:bg-muted/40 hover:text-foreground/80'
                }`}
              >
                <cat.icon className="w-4 h-4" />
                <span>{cat.label}</span>
                {mobileCategory === cat.key && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-idm-gold-warm" />
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none px-0.5">
            {(categoryTabMap[mobileCategory] || []).map(tabValue => {
              const tabConfig: Record<string, { icon: typeof Users; label: string; count?: number }> = {
                dashboard: { icon: LayoutDashboard, label: 'Dashboard' },
                pending: { icon: Clock, label: 'Pending', count: pendingPlayersCount || undefined },
                pemain: { icon: Users, label: 'Pemain', count: playerCount },
                club: { icon: Shield, label: 'Club' },
                turnamen: { icon: Music, label: 'Turnamen' },
                keuangan: { icon: Gift, label: 'Keuangan', count: donationCount || undefined },
                season: { icon: Calendar, label: 'Season' },
                konten: { icon: Globe, label: 'Halaman' },
                sponsor: { icon: Flame, label: 'Sponsor' },
                achievement: { icon: Trophy, label: 'Achievement' },
                skin: { icon: Sparkles, label: 'Skin' },
                pengaturan: { icon: Sliders, label: 'Pengaturan' },
              };
              const cfg = tabConfig[tabValue];
              if (!cfg) return null;
              const CfgIcon = cfg.icon;
              return (
                <button
                  key={tabValue}
                  onClick={() => setActiveTab(tabValue)}
                  className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors min-h-[36px] ${
                    activeTab === tabValue
                      ? 'bg-background/95 shadow-sm text-foreground border border-border'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                  }`}
                >
                  <CfgIcon className="w-3 h-3" />
                  {cfg.label}
                  {cfg.count !== undefined && cfg.count > 0 && (
                    <Badge className="text-xs border-0 bg-idm-gold-warm/15 text-idm-gold-warm px-1 py-0 min-w-[16px] h-3.5 flex items-center justify-center">{cfg.count}</Badge>
                  )}
                  {tabValue === 'pemain' && pendingCount > 0 && (
                    <Badge className="text-xs border-0 bg-yellow-500/15 text-yellow-500 px-1 py-0 min-w-[16px] h-3.5 flex items-center justify-center">{pendingCount}</Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Desktop: Compact 6-category navigation */}
        <div className="hidden sm:block space-y-2">
          <div className="grid grid-cols-6 gap-1.5">
            {([
              { key: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
              { key: 'peserta', icon: Users, label: 'Tarkam' },
              { key: 'season', icon: Calendar, label: 'Season' },
              { key: 'konten', icon: Globe, label: 'Konten' },
              { key: 'penghargaan', icon: Award, label: 'Achiev' },
              { key: 'sistem', icon: Sliders, label: 'Sistem' },
            ] as const).map(cat => (
              <button
                key={cat.key}
                onClick={() => {
                  setMobileCategory(cat.key);
                  const firstTab = categoryTabMap[cat.key]?.[0];
                  if (firstTab) setActiveTab(firstTab);
                }}
                className={`relative flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-medium transition-colors admin-nav-btn ${
                  mobileCategory === cat.key
                    ? 'bg-idm-gold-warm/15 text-idm-gold-warm border border-idm-gold-warm/25 shadow-sm'
                    : 'bg-muted/20 text-muted-foreground border border-transparent hover:bg-muted/40 hover:text-foreground/80'
                }`}
              >
                <cat.icon className="w-4 h-4" />
                <span>{cat.label}</span>
                {mobileCategory === cat.key && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-idm-gold-warm" />
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none px-0.5">
            {(categoryTabMap[mobileCategory] || []).map(tabValue => {
              const tabConfig: Record<string, { icon: typeof Users; label: string; count?: number }> = {
                dashboard: { icon: LayoutDashboard, label: 'Dashboard' },
                pending: { icon: Clock, label: 'Pending', count: pendingPlayersCount || undefined },
                pemain: { icon: Users, label: 'Pemain', count: playerCount },
                club: { icon: Shield, label: 'Club' },
                turnamen: { icon: Music, label: 'Turnamen' },
                keuangan: { icon: Gift, label: 'Keuangan', count: donationCount || undefined },
                season: { icon: Calendar, label: 'Season' },
                konten: { icon: Globe, label: 'Halaman' },
                sponsor: { icon: Flame, label: 'Sponsor' },
                achievement: { icon: Trophy, label: 'Achievement' },
                skin: { icon: Sparkles, label: 'Skin' },
                pengaturan: { icon: Sliders, label: 'Pengaturan' },
              };
              const cfg = tabConfig[tabValue];
              if (!cfg) return null;
              const CfgIcon = cfg.icon;
              return (
                <button
                  key={tabValue}
                  onClick={() => setActiveTab(tabValue)}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    activeTab === tabValue
                      ? 'bg-background/95 shadow-sm text-foreground border border-border'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                  }`}
                >
                  <CfgIcon className="w-3 h-3" />
                  {cfg.label}
                  {cfg.count !== undefined && cfg.count > 0 && (
                    <Badge className="text-xs border-0 bg-idm-gold-warm/15 text-idm-gold-warm px-1 py-0 min-w-[16px] h-3.5 flex items-center justify-center">{cfg.count}</Badge>
                  )}
                  {tabValue === 'pemain' && pendingCount > 0 && (
                    <Badge className="text-xs border-0 bg-yellow-500/15 text-yellow-500 px-1 py-0 min-w-[16px] h-3.5 flex items-center justify-center ml-0.5">{pendingCount}</Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ====== DASHBOARD TAB ====== */}
        <TabsContent value="dashboard" className="admin-tab-enter">
          <AdminOverview division={storeDivision} onNavigateToTab={navigateToTab} />
        </TabsContent>

        {/* ====== PENDING PLAYERS TAB ====== */}
        <TabsContent value="pending" className="admin-tab-enter">
          <AdminPendingTab division={storeDivision} />
        </TabsContent>

        {/* ====== PEMAIN TAB ====== */}
        <TabsContent value="pemain" className="admin-tab-enter">
          <div className="space-y-4">
            <AdminPlayersTab
              pendingRegistrations={pendingRegistrations || []}
              approveRegistration={approveRegistration}
              rejectRegistration={rejectRegistration}
              filteredPlayers={filteredPlayers}
              searchPlayer={searchPlayer}
              setSearchPlayer={setSearchPlayer}
              openNewPlayerForm={openNewPlayerForm}
              openEditPlayerForm={openEditPlayerForm}
              openAvatarPicker={openAvatarPicker}
              updateTier={updateTier}
              deletePlayer={deletePlayer}
              setConfirmDialog={setConfirmDialog}
              dt={dt}
              totalPlayers={playersTotal}
              hasMorePlayers={hasMorePlayers}
              isLoadingMorePlayers={isLoadingMore}
              onLoadMorePlayers={loadMorePlayers}
            />
          </div>
        </TabsContent>

        {/* ====== TURNAMEN TAB ====== */}
        <TabsContent value="turnamen" className="admin-tab-enter">
          <div className="space-y-4">
            {/* Tournament Manager — full lifecycle: create → register → approve → teams → bracket → score → finalize */}
            <TournamentManager division={storeDivision} dt={dt} stats={stats} setConfirmDialog={setConfirmDialog} />
          </div>
        </TabsContent>

        {/* ====== CLUB TAB ====== */}
        <TabsContent value="club" className="admin-tab-enter">
          <div className="space-y-4">
            <ClubManagement division={storeDivision} dt={dt} seasonId={stats?.seasonForClubs?.id || stats?.season?.id} setConfirmDialog={setConfirmDialog} />
          </div>
        </TabsContent>

        {/* ====== KEUANGAN TAB ====== */}
        <TabsContent value="keuangan" className="admin-tab-enter">
          <AdminKeuanganTab
            donations={donations}
            division={storeDivision}
            addDonation={addDonation}
            approveDonation={approveDonation}
            deleteDonation={deleteDonation}
            newDonation={newDonation}
            setNewDonation={setNewDonation}
            paymentForm={paymentForm}
            updatePaymentForm={updatePaymentForm}
            savePaymentSettingsBatch={savePaymentSettingsBatch}
            setQrisPickerOpen={setQrisPickerOpen}
            setConfirmDialog={setConfirmDialog}
            dt={dt}
          />
        </TabsContent>

        {/* ====== KONTEN / HALAMAN TAB ====== */}
        <TabsContent value="konten" className="admin-tab-enter">
          <div className="space-y-4">
            <ErrorBoundary>
              <CmsPanel />
            </ErrorBoundary>
            <AdminDivisionContentTab />
          </div>
        </TabsContent>

        {/* ====== SPONSOR TAB ====== */}
        <TabsContent value="sponsor" className="admin-tab-enter">
          <div className="space-y-4">
            <AdminSponsorPanel />
          </div>
        </TabsContent>

        {/* ====== SEASON TAB ====== */}
        <TabsContent value="season" className="admin-tab-enter">
          <div className="space-y-4">
            <AdminSeasonPanel division={storeDivision} dt={dt} setConfirmDialog={setConfirmDialog} mode="tarkam" />
          </div>
        </TabsContent>

        {/* ====== ACHIEVEMENT TAB (Penghargaan category) ====== */}
        <TabsContent value="achievement" className="admin-tab-enter">
          <div className="space-y-4">
            <AdminAchievementPanel />
          </div>
        </TabsContent>

        {/* ====== SKIN TAB (Penghargaan category) ====== */}
        <TabsContent value="skin" className="admin-tab-enter">
          <div className="space-y-4">
            <AdminSkinPanel />
          </div>
        </TabsContent>

        {/* ====== PENGATURAN TAB ====== */}
        <TabsContent value="pengaturan" className="admin-tab-enter">
          <div className="space-y-4">
            <AdminSettingsPanel />
            <AdminManagement />
          </div>
        </TabsContent>
      </Tabs>

      {/* Confirm Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDialog.onConfirm}>Lanjutkan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Player Form Dialog */}
      <Dialog open={playerFormOpen} onOpenChange={setPlayerFormOpen}>
        <DialogContent className="sm:max-w-md w-[calc(100%-1rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlayer ? 'Edit Player' : 'Tambah Player Baru'}</DialogTitle>
            <DialogDescription>{editingPlayer ? 'Perbarui informasi player yang sudah terdaftar' : 'Isi form untuk menambahkan player baru ke sistem'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
            <div className="grid grid-cols-2 gap-3">
              {/* Division */}
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Division</Label>
                <div className="flex items-center bg-muted rounded-lg p-1 mt-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, division: 'male', clubId: '' }))}
                    className={`flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-colors duration-150 ${
                      formData.division === 'male'
                        ? 'bg-idm-male text-white'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    🕺 Cowo
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, division: 'female', clubId: '' }))}
                    className={`flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-colors duration-150 ${
                      formData.division === 'female'
                        ? 'bg-idm-female text-white'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    💃 Cewe
                  </button>
                </div>
              </div>

              {/* Name */}
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs text-muted-foreground">Nama <span className="text-red-400">*</span></Label>
                <Input
                  placeholder="Nama lengkap/nickname"
                  value={formData.name}
                  onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                  className="mt-1"
                />
              </div>

              {/* Nickname */}
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs text-muted-foreground">Nickname <span className="text-red-400">*</span></Label>
                <Input
                  placeholder="Username unik"
                  value={formData.gamertag}
                  onChange={(e) => setFormData(p => ({ ...p, gamertag: e.target.value }))}
                  className="mt-1"
                />
              </div>

              {/* Tier */}
              <div>
                <Label className="text-xs text-muted-foreground">Tier</Label>
                <Select value={formData.tier} onValueChange={(v) => setFormData(p => ({ ...p, tier: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="S">S Tier</SelectItem>
                    <SelectItem value="A">A Tier</SelectItem>
                    <SelectItem value="B">B Tier</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Points */}
              <div>
                <Label className="text-xs text-muted-foreground">Points</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.points}
                  onChange={(e) => setFormData(p => ({ ...p, points: e.target.value }))}
                  className="mt-1"
                />
              </div>

              {/* City */}
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs text-muted-foreground">Kota</Label>
                <div className="relative mt-1">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Makassar, Jakarta, etc."
                    value={formData.city}
                    onChange={(e) => setFormData(p => ({ ...p, city: e.target.value }))}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs text-muted-foreground">No. WhatsApp</Label>
                <div className="relative mt-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="08xxxxxxxxxx"
                    value={formData.phone}
                    onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
                    className="pl-9"
                    type="tel"
                  />
                </div>
              </div>

              {/* Joki */}
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs text-muted-foreground">Joki <span className="text-muted-foreground/70">(opsional)</span></Label>
                <Input
                  placeholder="Nama joki jika ada"
                  value={formData.joki}
                  onChange={(e) => setFormData(p => ({ ...p, joki: e.target.value }))}
                  className="mt-1"
                />
              </div>

              {/* Club */}
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs text-muted-foreground">Club</Label>
                <Select value={formData.clubId} onValueChange={(v) => setFormData(p => ({ ...p, clubId: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Pilih club" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Tanpa Club</SelectItem>
                    {clubs?.map((c: { id: string; name: string }) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlayerFormOpen(false)}>Batal</Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.name.trim() || !formData.gamertag.trim() || createPlayer.isPending || updatePlayer.isPending}
            >
              {(createPlayer.isPending || updatePlayer.isPending) ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-1" />
              )}
              {editingPlayer ? 'Simpan' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cloudinary Image Picker — Player Avatars */}
      <CloudinaryPicker
        open={cloudinaryOpen}
        onClose={() => setCloudinaryOpen(false)}
        onSelect={handleAvatarSelect}
        uploadFolder="avatars"
      />

      {/* Cloudinary Image Picker — QRIS QR Code */}
      <CloudinaryPicker
        open={qrisPickerOpen}
        onClose={() => setQrisPickerOpen(false)}
        onSelect={(url) => updatePaymentForm({ donation_qris_image: url })}
        uploadFolder="cms/payment"
      />
    </div>
  );
}
