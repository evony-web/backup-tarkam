'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, Plus, Pencil, Trash2, ExternalLink, Image as ImageIcon, Star, Loader2, X, Link,
  ChevronDown, ChevronRight, Images, Trophy, Gift, Eye, EyeOff, Unlink
} from 'lucide-react';
import NextImage from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { useState } from 'react';
import { toast } from 'sonner';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { CloudinaryPicker } from './cloudinary-picker';

// ─── Types ───

interface Sponsor {
  id: string;
  name: string;
  logo: string | null;
  website: string | null;
  description: string | null;
  tier: string;
  isActive: boolean;
  createdAt: string;
  _count?: {
    tournamentSponsors: number;
    sponsoredPrizes: number;
    banners: number;
  };
}

interface SponsorBanner {
  id: string;
  sponsorId: string;
  placement: string;
  imageUrl: string;
  linkUrl: string | null;
  width: number | null;
  height: number | null;
  isActive: boolean;
  displayOrder: number;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  sponsor: { id: string; name: string; logo: string | null };
}

interface TournamentSponsorLink {
  id: string;
  tournamentId: string;
  sponsorId: string;
  role: string;
  displayOrder: number;
  createdAt: string;
  sponsor: { id: string; name: string; logo: string | null; tier: string };
}

interface SponsoredPrize {
  id: string;
  tournamentId: string;
  sponsorId: string;
  name: string;
  description: string | null;
  prizeType: string;
  value: number;
  quantity: number;
  position: string | null;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
  sponsor: { id: string; name: string; logo: string | null; tier: string };
  tournament: { id: string; name: string; weekNumber: number; division: string };
}

interface Tournament {
  id: string;
  name: string;
  weekNumber: number;
  division: string;
  status: string;
  seasonId: string;
}

interface SponsorForm {
  name: string;
  logo: string;
  website: string;
  description: string;
  tier: string;
}

interface BannerForm {
  sponsorId: string;
  placement: string;
  imageUrl: string;
  linkUrl: string;
  displayOrder: number;
  startDate: string;
  endDate: string;
}

interface PrizeForm {
  sponsorId: string;
  tournamentId: string;
  name: string;
  description: string;
  prizeType: string;
  value: number;
  quantity: number;
  position: string;
  imageUrl: string;
  isActive: boolean;
}

const emptyForm: SponsorForm = {
  name: '',
  logo: '',
  website: '',
  description: '',
  tier: 'bronze',
};

const emptyBannerForm: BannerForm = {
  sponsorId: '',
  placement: 'landing_page',
  imageUrl: '',
  linkUrl: '',
  displayOrder: 0,
  startDate: '',
  endDate: '',
};

const emptyPrizeForm: PrizeForm = {
  sponsorId: '',
  tournamentId: '',
  name: '',
  description: '',
  prizeType: 'voucher',
  value: 0,
  quantity: 1,
  position: '',
  imageUrl: '',
  isActive: true,
};

const tierColors: Record<string, string> = {
  platinum: 'bg-gradient-to-r from-slate-300 to-slate-100 text-slate-800',
  gold: 'bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-900',
  silver: 'bg-gradient-to-r from-slate-400 to-slate-300 text-slate-800',
  bronze: 'bg-gradient-to-r from-amber-700 to-amber-600 text-white',
};

const tierOrder = { platinum: 0, gold: 1, silver: 2, bronze: 3 };

const placementLabels: Record<string, string> = {
  bracket_top: 'Bracket Top',
  bracket_side: 'Bracket Side',
  stream_overlay: 'Stream Overlay',
  landing_page: 'Landing Page',
  dashboard: 'Dashboard',
};

const roleLabels: Record<string, string> = {
  main_sponsor: 'Main Sponsor',
  presented_by: 'Presented By',
  supporter: 'Supporter',
};

const prizeTypeLabels: Record<string, string> = {
  voucher: 'Voucher',
  cash: 'Cash',
  merchandise: 'Merchandise',
  digital: 'Digital',
  experience: 'Experience',
  other: 'Other',
};

// ─── Collapsible Section Header ───

function SectionHeader({
  icon: Icon,
  title,
  count,
  isOpen,
  onToggle,
  accentColor = 'text-idm-gold-warm',
}: {
  icon: React.ElementType;
  title: string;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  accentColor?: string;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-card border border-border hover:bg-muted/30 transition-colors"
    >
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${accentColor}`} />
        <span className="text-sm font-medium">{title}</span>
        <Badge className="text-xs border-0 bg-muted">{count}</Badge>
      </div>
      {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
    </button>
  );
}

// ─── Main Component ───

export function AdminSponsorPanel() {
  const dt = useDivisionTheme();
  const qc = useQueryClient();

  // ─── Section toggle state ───
  const [bannerOpen, setBannerOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [prizeOpen, setPrizeOpen] = useState(false);

  // ─── Sponsor state (existing) ───
  const [formOpen, setFormOpen] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState<{ id: string; data: SponsorForm } | null>(null);
  const [formData, setFormData] = useState<SponsorForm>(emptyForm);
  const [cloudinaryOpen, setCloudinaryOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');

  // ─── Banner state ───
  const [bannerFormOpen, setBannerFormOpen] = useState(false);
  const [bannerFormData, setBannerFormData] = useState<BannerForm>(emptyBannerForm);
  const [bannerCloudinaryOpen, setBannerCloudinaryOpen] = useState(false);
  const [bannerPlacementFilter, setBannerPlacementFilter] = useState<string>('all');

  // ─── Tournament linking state ───
  const [linkTournamentId, setLinkTournamentId] = useState('');
  const [linkSponsorId, setLinkSponsorId] = useState('');
  const [linkRole, setLinkRole] = useState('supporter');
  const [selectedLinkTournament, setSelectedLinkTournament] = useState<string>('');

  // ─── Prize state ───
  const [prizeFormOpen, setPrizeFormOpen] = useState(false);
  const [prizeFormData, setPrizeFormData] = useState<PrizeForm>(emptyPrizeForm);
  const [prizeCloudinaryOpen, setPrizeCloudinaryOpen] = useState(false);

  // ─── Queries ───

  const { data: sponsors, isLoading } = useQuery({
    queryKey: ['admin-sponsors'],
    queryFn: async () => {
      const res = await fetch('/api/sponsors', { credentials: 'include' });
      return res.json();
    },
  });

  const { data: bannersData, isLoading: bannersLoading } = useQuery({
    queryKey: ['admin-banners', bannerPlacementFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (bannerPlacementFilter !== 'all') params.set('placement', bannerPlacementFilter);
      const res = await fetch(`/api/sponsors/banners?${params.toString()}`, { credentials: 'include' });
      return res.json();
    },
    enabled: bannerOpen,
  });

  const { data: tournamentsData } = useQuery({
    queryKey: ['admin-tournaments-for-sponsors'],
    queryFn: async () => {
      const res = await fetch('/api/tournaments', { credentials: 'include' });
      return res.json();
    },
  });

  const { data: tournamentSponsorsData, isLoading: tournamentSponsorsLoading } = useQuery({
    queryKey: ['admin-tournament-sponsors', selectedLinkTournament],
    queryFn: async () => {
      if (!selectedLinkTournament) return { sponsors: [] };
      const res = await fetch(`/api/tournaments/${selectedLinkTournament}/sponsors`, { credentials: 'include' });
      return res.json();
    },
    enabled: linkOpen && !!selectedLinkTournament,
  });

  const { data: prizesData, isLoading: prizesLoading } = useQuery({
    queryKey: ['admin-prizes'],
    queryFn: async () => {
      const res = await fetch('/api/sponsors/prizes', { credentials: 'include' });
      return res.json();
    },
    enabled: prizeOpen,
  });

  // ─── Sponsor Mutations (existing) ───

  const createSponsor = useMutation({
    mutationFn: async (data: SponsorForm) => {
      const res = await fetch('/api/sponsors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sponsors'] });
      qc.invalidateQueries({ queryKey: ['sponsors-active'] });
      toast.success('Sponsor berhasil ditambahkan!');
      setFormOpen(false);
      setFormData(emptyForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateSponsor = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SponsorForm> }) => {
      const res = await fetch(`/api/sponsors?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sponsors'] });
      qc.invalidateQueries({ queryKey: ['sponsors-active'] });
      toast.success('Sponsor berhasil diperbarui!');
      setFormOpen(false);
      setEditingSponsor(null);
      setFormData(emptyForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteSponsor = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/sponsors?id=${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sponsors'] });
      qc.invalidateQueries({ queryKey: ['sponsors-active'] });
      toast.success('Sponsor berhasil dihapus!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/sponsors?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sponsors'] });
      qc.invalidateQueries({ queryKey: ['sponsors-active'] });
      toast.success('Status sponsor diperbarui!');
    },
  });

  // ─── Banner Mutations ───

  const createBanner = useMutation({
    mutationFn: async (data: BannerForm) => {
      const res = await fetch('/api/sponsors/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-banners'] });
      qc.invalidateQueries({ queryKey: ['sponsor-banners'] });
      toast.success('Banner berhasil ditambahkan!');
      setBannerFormOpen(false);
      setBannerFormData(emptyBannerForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteBanner = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/sponsors/banners?id=${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-banners'] });
      qc.invalidateQueries({ queryKey: ['sponsor-banners'] });
      toast.success('Banner berhasil dihapus!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleBannerActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/sponsors/banners?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-banners'] });
      qc.invalidateQueries({ queryKey: ['sponsor-banners'] });
      toast.success('Status banner diperbarui!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ─── Tournament Linking Mutations ───

  const linkSponsorToTournament = useMutation({
    mutationFn: async ({ tournamentId, sponsorId, role }: { tournamentId: string; sponsorId: string; role: string }) => {
      const res = await fetch(`/api/tournaments/${tournamentId}/sponsors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sponsorId, role }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-tournament-sponsors'] });
      qc.invalidateQueries({ queryKey: ['admin-sponsors'] });
      toast.success('Sponsor berhasil ditautkan ke turnamen!');
      setLinkSponsorId('');
      setLinkRole('supporter');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unlinkSponsorFromTournament = useMutation({
    mutationFn: async ({ tournamentId, sponsorId }: { tournamentId: string; sponsorId: string }) => {
      const res = await fetch(`/api/tournaments/${tournamentId}/sponsors?sponsorId=${sponsorId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-tournament-sponsors'] });
      qc.invalidateQueries({ queryKey: ['admin-sponsors'] });
      toast.success('Sponsor berhasil diputus dari turnamen!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ─── Prize Mutations ───

  const createPrize = useMutation({
    mutationFn: async (data: PrizeForm) => {
      const res = await fetch('/api/sponsors/prizes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-prizes'] });
      toast.success('Prize berhasil ditambahkan!');
      setPrizeFormOpen(false);
      setPrizeFormData(emptyPrizeForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePrize = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/sponsors/prizes?id=${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-prizes'] });
      toast.success('Prize berhasil dihapus!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ─── Sponsor handlers (existing) ───

  const openNewForm = () => {
    setEditingSponsor(null);
    setFormData(emptyForm);
    setFormOpen(true);
  };

  const openEditForm = (sponsor: Sponsor) => {
    setEditingSponsor({
      id: sponsor.id,
      data: {
        name: sponsor.name,
        logo: sponsor.logo || '',
        website: sponsor.website || '',
        description: sponsor.description || '',
        tier: sponsor.tier,
      },
    });
    setFormData({
      name: sponsor.name,
      logo: sponsor.logo || '',
      website: sponsor.website || '',
      description: sponsor.description || '',
      tier: sponsor.tier,
    });
    setFormOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error('Nama sponsor wajib diisi');
      return;
    }

    if (editingSponsor) {
      updateSponsor.mutate({ id: editingSponsor.id, data: formData });
    } else {
      createSponsor.mutate(formData);
    }
  };

  // ─── Banner handlers ───

  const handleBannerSubmit = () => {
    if (!bannerFormData.sponsorId || !bannerFormData.placement || !bannerFormData.imageUrl) {
      toast.error('Sponsor, placement, dan gambar wajib diisi');
      return;
    }
    createBanner.mutate(bannerFormData);
  };

  // ─── Linking handlers ───

  const handleLinkSubmit = () => {
    if (!linkTournamentId || !linkSponsorId) {
      toast.error('Pilih turnamen dan sponsor terlebih dahulu');
      return;
    }
    linkSponsorToTournament.mutate({
      tournamentId: linkTournamentId,
      sponsorId: linkSponsorId,
      role: linkRole,
    });
  };

  // ─── Prize handlers ───

  const handlePrizeSubmit = () => {
    if (!prizeFormData.sponsorId || !prizeFormData.tournamentId || !prizeFormData.name.trim()) {
      toast.error('Sponsor, turnamen, dan nama prize wajib diisi');
      return;
    }
    createPrize.mutate(prizeFormData);
  };

  // ─── Derived data ───

  const sponsorList: Sponsor[] = sponsors?.sponsors || [];
  const bannerList: SponsorBanner[] = bannersData?.banners || [];
  const prizeList: SponsoredPrize[] = prizesData?.prizes || [];
  const tournamentList: Tournament[] = Array.isArray(tournamentsData) ? tournamentsData : (tournamentsData?.tournaments || []);
  const tournamentSponsorList: TournamentSponsorLink[] = tournamentSponsorsData?.sponsors || [];

  // Filter sponsors
  const filteredSponsors = sponsorList
    .filter((s: Sponsor) => {
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTier = tierFilter === 'all' || s.tier === tierFilter;
      return matchesSearch && matchesTier;
    })
    .sort((a: Sponsor, b: Sponsor) => {
      const tierDiff = (tierOrder[a.tier as keyof typeof tierOrder] || 99) - (tierOrder[b.tier as keyof typeof tierOrder] || 99);
      if (tierDiff !== 0) return tierDiff;
      return a.name.localeCompare(b.name);
    });

  // Group by tier
  const groupedSponsors = filteredSponsors.reduce((acc: Record<string, Sponsor[]>, sponsor: Sponsor) => {
    const tier = sponsor.tier;
    if (!acc[tier]) acc[tier] = [];
    acc[tier].push(sponsor);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* ─── Sponsor Header ─── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1">
          <Input
            placeholder="Cari sponsor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-xs"
          />
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Filter tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tiers</SelectItem>
              <SelectItem value="platinum">Platinum</SelectItem>
              <SelectItem value="gold">Gold</SelectItem>
              <SelectItem value="silver">Silver</SelectItem>
              <SelectItem value="bronze">Bronze</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openNewForm}>
          <Plus className="w-4 h-4 mr-1" /> Tambah Sponsor
        </Button>
      </div>

      {/* ─── Sponsors List ─── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedSponsors).map(([tier, tierSponsors], tierIndex) => (
            <div key={tier}>
              <Card className={dt.casinoCard}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Star className={`w-4 h-4 ${tier === 'platinum' ? 'text-muted-foreground' : tier === 'gold' ? 'text-amber-400' : tier === 'silver' ? 'text-muted-foreground' : 'text-amber-700'}`} />
                    {tier.charAt(0).toUpperCase() + tier.slice(1)} Sponsors
                    <Badge className="text-xs border-0 bg-muted">{(tierSponsors as Sponsor[]).length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(tierSponsors as Sponsor[]).map((sponsor: Sponsor) => (
                      <div
                        key={sponsor.id}
                        className={`p-3 rounded-lg border ${sponsor.isActive ? 'bg-card border-border' : 'bg-muted/30 border-border opacity-60'}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                            {sponsor.logo ? (
                              <NextImage src={sponsor.logo} alt={sponsor.name} width={48} height={48} className="w-full h-full object-cover" unoptimized />
                            ) : (
                              <Building2 className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-sm font-medium truncate">{sponsor.name}</p>
                              {!sponsor.isActive && (
                                <Badge className="text-xs border-0 bg-red-500/10 text-red-500">Inactive</Badge>
                              )}
                            </div>
                            {sponsor.website && (
                              <a
                                href={sponsor.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-muted-foreground hover:text-primary flex items-center gap-0.5"
                              >
                                <Link className="w-2.5 h-2.5" />
                                {sponsor.website.replace(/^https?:\/\//, '').split('/')[0]}
                              </a>
                            )}
                            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                              <span>{sponsor._count?.tournamentSponsors || 0} tournaments</span>
                              <span>•</span>
                              <span>{sponsor._count?.sponsoredPrizes || 0} prizes</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-border">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-sm"
                            onClick={() => toggleActive.mutate({ id: sponsor.id, isActive: !sponsor.isActive })}
                          >
                            {sponsor.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => openEditForm(sponsor)}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                            onClick={() => setConfirmDialog({
                              open: true,
                              title: 'Hapus Sponsor?',
                              description: `Hapus "${sponsor.name}". Tindakan ini tidak dapat dibatalkan.`,
                              onConfirm: () => deleteSponsor.mutate(sponsor.id),
                            })}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}

          {filteredSponsors.length === 0 && (
            <Card className={dt.casinoCard}>
              <CardContent className="py-8 text-center">
                <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Belum ada sponsor ditemukan</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={openNewForm}>
                  <Plus className="w-3 h-3 mr-1" /> Tambah Sponsor Pertama
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1: BANNER MANAGEMENT */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}

      <div className="pt-2">
        <SectionHeader
          icon={Images}
          title="Banner Management"
          count={bannerList.length}
          isOpen={bannerOpen}
          onToggle={() => setBannerOpen(!bannerOpen)}
          accentColor="text-amber-400"
        />

        {bannerOpen && (
          <div className="mt-3 space-y-3">
            {/* Banner controls */}
            <div className="flex items-center justify-between gap-2">
              <Select value={bannerPlacementFilter} onValueChange={setBannerPlacementFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter placement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Placements</SelectItem>
                  <SelectItem value="bracket_top">Bracket Top</SelectItem>
                  <SelectItem value="bracket_side">Bracket Side</SelectItem>
                  <SelectItem value="stream_overlay">Stream Overlay</SelectItem>
                  <SelectItem value="landing_page">Landing Page</SelectItem>
                  <SelectItem value="dashboard">Dashboard</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => { setBannerFormData(emptyBannerForm); setBannerFormOpen(true); }}>
                <Plus className="w-3 h-3 mr-1" /> Tambah Banner
              </Button>
            </div>

            {/* Banner list */}
            {bannersLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : bannerList.length === 0 ? (
              <Card className={dt.casinoCard}>
                <CardContent className="py-6 text-center">
                  <Images className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Belum ada banner</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto custom-scrollbar">
                {bannerList.map((banner: SponsorBanner) => (
                  <div key={banner.id} className={`p-3 rounded-lg border ${banner.isActive ? 'bg-card border-border' : 'bg-muted/30 border-border opacity-60'}`}>
                    <div className="flex items-start gap-3">
                      {/* Banner image */}
                      <div className="w-20 h-12 rounded-lg bg-muted overflow-hidden shrink-0">
                        <NextImage src={banner.imageUrl} alt={banner.sponsor.name} width={80} height={48} className="w-full h-full object-cover" unoptimized />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{banner.sponsor.name}</p>
                        <Badge className="text-xs border-0 bg-amber-500/10 text-amber-500 mt-0.5">
                          {placementLabels[banner.placement] || banner.placement}
                        </Badge>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>Order: {banner.displayOrder}</span>
                          {banner.startDate && (
                            <span>• {new Date(banner.startDate).toLocaleDateString()}</span>
                          )}
                        </div>
                        {banner.linkUrl && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{banner.linkUrl}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-border">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs"
                        onClick={() => toggleBannerActive.mutate({ id: banner.id, isActive: !banner.isActive })}
                      >
                        {banner.isActive ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                        {banner.isActive ? 'Hide' : 'Show'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => setConfirmDialog({
                          open: true,
                          title: 'Hapus Banner?',
                          description: 'Banner ini akan dihapus secara permanen.',
                          onConfirm: () => deleteBanner.mutate(banner.id),
                        })}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2: TOURNAMENT SPONSOR LINKING */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}

      <div className="pt-2">
        <SectionHeader
          icon={Trophy}
          title="Tournament Sponsor Linking"
          count={tournamentSponsorList.length}
          isOpen={linkOpen}
          onToggle={() => setLinkOpen(!linkOpen)}
          accentColor="text-emerald-400"
        />

        {linkOpen && (
          <div className="mt-3 space-y-3">
            <Card className={dt.casinoCard}>
              <CardContent className="pt-4 space-y-3">
                <p className="text-xs text-muted-foreground">Tautkan sponsor ke turnamen dengan role tertentu</p>
                {/* Linking form */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Turnamen</Label>
                    <Select value={linkTournamentId} onValueChange={(v) => { setLinkTournamentId(v); setSelectedLinkTournament(v); }}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Pilih turnamen" />
                      </SelectTrigger>
                      <SelectContent>
                        {tournamentList.map((t: Tournament) => (
                          <SelectItem key={t.id} value={t.id}>
                            W{t.weekNumber} - {t.name} ({t.division})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Sponsor</Label>
                    <Select value={linkSponsorId} onValueChange={setLinkSponsorId}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Pilih sponsor" />
                      </SelectTrigger>
                      <SelectContent>
                        {sponsorList.filter((s: Sponsor) => s.isActive).map((s: Sponsor) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} ({s.tier})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Role</Label>
                    <Select value={linkRole} onValueChange={setLinkRole}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="main_sponsor">Main Sponsor</SelectItem>
                        <SelectItem value="presented_by">Presented By</SelectItem>
                        <SelectItem value="supporter">Supporter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={handleLinkSubmit}
                  disabled={!linkTournamentId || !linkSponsorId || linkSponsorToTournament.isPending}
                >
                  {linkSponsorToTournament.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                  <Link className="w-3 h-3 mr-1" /> Tautkan
                </Button>

                {/* Existing links */}
                {selectedLinkTournament && (
                  <div className="mt-4 pt-3 border-t border-border">
                    <p className="text-xs font-medium mb-2">Sponsor di turnamen ini:</p>
                    {tournamentSponsorsLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : tournamentSponsorList.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Belum ada sponsor ditautkan</p>
                    ) : (
                      <div className="space-y-2">
                        {tournamentSponsorList.map((ts: TournamentSponsorLink) => (
                          <div key={ts.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                            <div className="flex items-center gap-2">
                              {ts.sponsor.logo ? (
                                <NextImage src={ts.sponsor.logo} alt={ts.sponsor.name} width={24} height={24} className="w-6 h-6 rounded object-cover" unoptimized />
                              ) : (
                                <Building2 className="w-4 h-4 text-muted-foreground" />
                              )}
                              <span className="text-xs font-medium">{ts.sponsor.name}</span>
                              <Badge className={`text-xs border-0 ${ts.role === 'main_sponsor' ? 'bg-amber-500/10 text-amber-500' : ts.role === 'presented_by' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
                                {roleLabels[ts.role] || ts.role}
                              </Badge>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                              onClick={() => unlinkSponsorFromTournament.mutate({
                                tournamentId: selectedLinkTournament,
                                sponsorId: ts.sponsorId,
                              })}
                            >
                              <Unlink className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 3: SPONSORED PRIZES */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}

      <div className="pt-2">
        <SectionHeader
          icon={Gift}
          title="Sponsored Prizes"
          count={prizeList.length}
          isOpen={prizeOpen}
          onToggle={() => setPrizeOpen(!prizeOpen)}
          accentColor="text-rose-400"
        />

        {prizeOpen && (
          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-end">
              <Button size="sm" onClick={() => { setPrizeFormData(emptyPrizeForm); setPrizeFormOpen(true); }}>
                <Plus className="w-3 h-3 mr-1" /> Tambah Prize
              </Button>
            </div>

            {prizesLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : prizeList.length === 0 ? (
              <Card className={dt.casinoCard}>
                <CardContent className="py-6 text-center">
                  <Gift className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Belum ada sponsored prize</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto custom-scrollbar">
                {prizeList.map((prize: SponsoredPrize) => (
                  <div key={prize.id} className={`p-3 rounded-lg border ${prize.isActive ? 'bg-card border-border' : 'bg-muted/30 border-border opacity-60'}`}>
                    <div className="flex items-start gap-3">
                      {prize.imageUrl ? (
                        <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden shrink-0">
                          <NextImage src={prize.imageUrl} alt={prize.name} width={48} height={48} className="w-full h-full object-cover" unoptimized />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Gift className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{prize.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Badge className="text-xs border-0 bg-rose-500/10 text-rose-500">
                            {prizeTypeLabels[prize.prizeType] || prize.prizeType}
                          </Badge>
                          {prize.value > 0 && (
                            <Badge className="text-xs border-0 bg-emerald-500/10 text-emerald-500">
                              Rp {prize.value.toLocaleString('id-ID')}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          <span>{prize.sponsor.name}</span>
                          <span> • </span>
                          <span>W{prize.tournament.weekNumber} {prize.tournament.division}</span>
                          {prize.quantity > 1 && <span> • Qty: {prize.quantity}</span>}
                          {prize.position && <span> • Pos: {prize.position}</span>}
                        </div>
                        {prize.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{prize.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-border">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => setConfirmDialog({
                          open: true,
                          title: 'Hapus Prize?',
                          description: `Hapus "${prize.name}". Tindakan ini tidak dapat dibatalkan.`,
                          onConfirm: () => deletePrize.mutate(prize.id),
                        })}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* DIALOGS */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}

      {/* Sponsor Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSponsor ? 'Edit Sponsor' : 'Tambah Sponsor Baru'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-xs text-muted-foreground">Logo</Label>
              <div className="flex items-center gap-3 mt-1">
                <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex items-center justify-center">
                  {formData.logo ? (
                    <NextImage src={formData.logo} alt="Logo" width={64} height={64} className="w-full h-full object-cover" unoptimized />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => setCloudinaryOpen(true)}>
                  Pilih Logo
                </Button>
                {formData.logo && (
                  <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setFormData(p => ({ ...p, logo: '' }))}>
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Nama Sponsor <span className="text-red-400">*</span></Label>
              <Input value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="Nama brand/perusahaan" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Website</Label>
              <Input value={formData.website} onChange={(e) => setFormData(p => ({ ...p, website: e.target.value }))} placeholder="https://example.com" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Tier</Label>
              <Select value={formData.tier} onValueChange={(v) => setFormData(p => ({ ...p, tier: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="platinum"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-300" /> Platinum</span></SelectItem>
                  <SelectItem value="gold"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-400" /> Gold</span></SelectItem>
                  <SelectItem value="silver"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-400" /> Silver</span></SelectItem>
                  <SelectItem value="bronze"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-700" /> Bronze</span></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Deskripsi</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} placeholder="Deskripsi singkat tentang sponsor..." className="mt-1 resize-none" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit} disabled={createSponsor.isPending || updateSponsor.isPending || !formData.name.trim()}>
              {(createSponsor.isPending || updateSponsor.isPending) && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              {editingSponsor ? 'Simpan' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Banner Form Dialog */}
      <Dialog open={bannerFormOpen} onOpenChange={setBannerFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah Banner Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Sponsor <span className="text-red-400">*</span></Label>
                <Select value={bannerFormData.sponsorId} onValueChange={(v) => setBannerFormData(p => ({ ...p, sponsorId: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Pilih sponsor" /></SelectTrigger>
                  <SelectContent>
                    {sponsorList.filter((s: Sponsor) => s.isActive).map((s: Sponsor) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Placement <span className="text-red-400">*</span></Label>
                <Select value={bannerFormData.placement} onValueChange={(v) => setBannerFormData(p => ({ ...p, placement: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bracket_top">Bracket Top</SelectItem>
                    <SelectItem value="bracket_side">Bracket Side</SelectItem>
                    <SelectItem value="stream_overlay">Stream Overlay</SelectItem>
                    <SelectItem value="landing_page">Landing Page</SelectItem>
                    <SelectItem value="dashboard">Dashboard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Banner Image */}
            <div>
              <Label className="text-xs text-muted-foreground">Gambar Banner <span className="text-red-400">*</span></Label>
              <div className="flex items-center gap-3 mt-1">
                <div className="w-24 h-14 rounded-lg bg-muted overflow-hidden flex items-center justify-center">
                  {bannerFormData.imageUrl ? (
                    <NextImage src={bannerFormData.imageUrl} alt="Banner" width={96} height={56} className="w-full h-full object-cover" unoptimized />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => setBannerCloudinaryOpen(true)}>Pilih Gambar</Button>
                {bannerFormData.imageUrl && (
                  <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setBannerFormData(p => ({ ...p, imageUrl: '' }))}>
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Link URL (opsional)</Label>
              <Input value={bannerFormData.linkUrl} onChange={(e) => setBannerFormData(p => ({ ...p, linkUrl: e.target.value }))} placeholder="https://example.com/promo" className="mt-1" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Display Order</Label>
                <Input type="number" value={bannerFormData.displayOrder} onChange={(e) => setBannerFormData(p => ({ ...p, displayOrder: parseInt(e.target.value) || 0 }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Start Date</Label>
                <Input type="datetime-local" value={bannerFormData.startDate} onChange={(e) => setBannerFormData(p => ({ ...p, startDate: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">End Date</Label>
                <Input type="datetime-local" value={bannerFormData.endDate} onChange={(e) => setBannerFormData(p => ({ ...p, endDate: e.target.value }))} className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBannerFormOpen(false)}>Batal</Button>
            <Button onClick={handleBannerSubmit} disabled={createBanner.isPending || !bannerFormData.sponsorId || !bannerFormData.placement || !bannerFormData.imageUrl}>
              {createBanner.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              Tambah Banner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Prize Form Dialog */}
      <Dialog open={prizeFormOpen} onOpenChange={setPrizeFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah Sponsored Prize</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Sponsor <span className="text-red-400">*</span></Label>
                <Select value={prizeFormData.sponsorId} onValueChange={(v) => setPrizeFormData(p => ({ ...p, sponsorId: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Pilih sponsor" /></SelectTrigger>
                  <SelectContent>
                    {sponsorList.filter((s: Sponsor) => s.isActive).map((s: Sponsor) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Turnamen <span className="text-red-400">*</span></Label>
                <Select value={prizeFormData.tournamentId} onValueChange={(v) => setPrizeFormData(p => ({ ...p, tournamentId: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Pilih turnamen" /></SelectTrigger>
                  <SelectContent>
                    {tournamentList.map((t: Tournament) => (
                      <SelectItem key={t.id} value={t.id}>W{t.weekNumber} - {t.name} ({t.division})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Nama Prize <span className="text-red-400">*</span></Label>
              <Input value={prizeFormData.name} onChange={(e) => setPrizeFormData(p => ({ ...p, name: e.target.value }))} placeholder="Voucher Google Play Rp 50.000" className="mt-1" />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Deskripsi</Label>
              <Textarea value={prizeFormData.description} onChange={(e) => setPrizeFormData(p => ({ ...p, description: e.target.value }))} placeholder="Deskripsi prize..." className="mt-1 resize-none" rows={2} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Tipe</Label>
                <Select value={prizeFormData.prizeType} onValueChange={(v) => setPrizeFormData(p => ({ ...p, prizeType: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="voucher">Voucher</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="merchandise">Merchandise</SelectItem>
                    <SelectItem value="digital">Digital</SelectItem>
                    <SelectItem value="experience">Experience</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Value (Rp)</Label>
                <Input type="number" value={prizeFormData.value} onChange={(e) => setPrizeFormData(p => ({ ...p, value: parseInt(e.target.value) || 0 }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Qty</Label>
                <Input type="number" value={prizeFormData.quantity} onChange={(e) => setPrizeFormData(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Posisi</Label>
                <Input value={prizeFormData.position} onChange={(e) => setPrizeFormData(p => ({ ...p, position: e.target.value }))} placeholder="1st, 2nd..." className="mt-1" />
              </div>
            </div>

            {/* Prize Image */}
            <div>
              <Label className="text-xs text-muted-foreground">Gambar Prize</Label>
              <div className="flex items-center gap-3 mt-1">
                <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex items-center justify-center">
                  {prizeFormData.imageUrl ? (
                    <NextImage src={prizeFormData.imageUrl} alt="Prize" width={64} height={64} className="w-full h-full object-cover" unoptimized />
                  ) : (
                    <Gift className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => setPrizeCloudinaryOpen(true)}>Pilih Gambar</Button>
                {prizeFormData.imageUrl && (
                  <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setPrizeFormData(p => ({ ...p, imageUrl: '' }))}>
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrizeFormOpen(false)}>Batal</Button>
            <Button onClick={handlePrizeSubmit} disabled={createPrize.isPending || !prizeFormData.sponsorId || !prizeFormData.tournamentId || !prizeFormData.name.trim()}>
              {createPrize.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              Tambah Prize
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cloudinary Pickers */}
      <CloudinaryPicker
        open={cloudinaryOpen}
        onClose={() => setCloudinaryOpen(false)}
        onSelect={(url) => { setFormData(p => ({ ...p, logo: url })); setCloudinaryOpen(false); }}
        uploadFolder="sponsors"
      />
      <CloudinaryPicker
        open={bannerCloudinaryOpen}
        onClose={() => setBannerCloudinaryOpen(false)}
        onSelect={(url) => { setBannerFormData(p => ({ ...p, imageUrl: url })); setBannerCloudinaryOpen(false); }}
        uploadFolder="banners"
      />
      <CloudinaryPicker
        open={prizeCloudinaryOpen}
        onClose={() => setPrizeCloudinaryOpen(false)}
        onSelect={(url) => { setPrizeFormData(p => ({ ...p, imageUrl: url })); setPrizeCloudinaryOpen(false); }}
        uploadFolder="prizes"
      />

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
    </div>
  );
}
