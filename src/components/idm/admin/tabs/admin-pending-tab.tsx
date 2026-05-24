'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Clock, UserCheck, XCircle, UserPlus, MapPin, Phone,
  Shield, Loader2, CheckCircle2, AlertTriangle, Inbox,
  MessageCircle, Globe, ChevronDown, ChevronUp, Users,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useDivisionTheme } from '@/hooks/use-division-theme';

// ─── Types ────────────────────────────────────────────────────
interface PendingPlayer {
  id: string;
  name: string;
  gamertag: string;
  division: string;
  tier: string;
  city: string;
  phone: string | null;
  waNumber: string | null;
  joki: string | null;
  avatar: string | null;
  registrationStatus: string;
  isActive: boolean;
  createdAt: string;
  account: { id: string; username: string } | null;
  clubMembers: Array<{
    profile: { id: string; name: string; logo: string | null };
  }>;
}

interface WaRegistration {
  id: string;
  waNumber: string;
  gamertag: string;
  name: string;
  division: string;
  city: string;
  clubName: string | null;
  verificationCode: string;
  status: string;
  approvedBy: string | null;
  assignedTier: string | null;
  playerId: string | null;
  tournamentId: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  tournament?: {
    id: string;
    name: string;
    weekNumber: number;
    division: string;
    status: string;
  } | null;
}

/** Unified pending registration item */
interface UnifiedPendingItem {
  id: string;
  source: 'web' | 'wa';
  name: string;
  gamertag: string;
  division: string; // normalised: 'male' | 'female'
  city: string;
  phone: string | null;
  waNumber: string | null;
  clubName: string | null;
  hasAccount: boolean;
  createdAt: string;
  // WA-specific expandable fields
  verificationCode?: string;
  tournament?: { id: string; name: string; weekNumber: number; division: string; status: string } | null;
  expiresAt?: string;
  playerId?: string | null;
  approvedBy?: string | null;
  assignedTier?: string | null;
  // Raw refs for mutations
  rawWa?: WaRegistration;
  rawPlayer?: PendingPlayer;
}

interface AdminPendingTabProps {
  division: string;
}

// ─── Tier style mapping ───────────────────────────────────────
const TIER_CONFIG: Record<string, { label: string; emoji: string; bg: string; text: string }> = {
  S: { label: 'S Tier', emoji: '💎', bg: 'bg-red-500/15', text: 'text-red-400' },
  A: { label: 'A Tier', emoji: '🥈', bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
  B: { label: 'B Tier', emoji: '🥉', bg: 'bg-blue-500/15', text: 'text-blue-400' },
};

// ─── Helpers ──────────────────────────────────────────────────
/** Convert WA division code to normalised form */
function normaliseDivision(div: string): string {
  if (div === 'M') return 'male';
  if (div === 'F') return 'female';
  return div;
}

/** Format date for display */
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Skeleton Loader ──────────────────────────────────────────
function PendingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="p-4 rounded-2xl bg-card border border-border/50 animate-pulse"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-4 w-28 bg-muted/40 rounded" />
                <div className="h-4 w-16 bg-muted/30 rounded" />
                <div className="h-4 w-12 bg-muted/25 rounded" />
              </div>
              <div className="flex items-center gap-3">
                <div className="h-3 w-20 bg-muted/30 rounded" />
                <div className="h-3 w-24 bg-muted/25 rounded" />
                <div className="h-3 w-16 bg-muted/25 rounded" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-7 w-16 bg-muted/30 rounded" />
              <div className="h-7 w-7 bg-muted/30 rounded" />
              <div className="h-7 w-7 bg-muted/30 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────
export function AdminPendingTab({ division }: AdminPendingTabProps) {
  const dt = useDivisionTheme();
  const qc = useQueryClient();

  // Division sub-filter (defaults to parent division, allows switching)
  const [subDivision, setSubDivision] = useState(division);

  // Source filter
  const [sourceFilter, setSourceFilter] = useState<'all' | 'web' | 'wa'>('all');

  // Reject dialog state
  const [rejectDialog, setRejectDialog] = useState<{
    open: boolean;
    item: UnifiedPendingItem | null;
    reason: string;
  }>({ open: false, item: null, reason: '' });

  // Per-item tier selection
  const [itemTiers, setItemTiers] = useState<Record<string, string>>({});

  // Expanded card (for WA details)
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Fetch web pending players ────────────────────────────────
  const {
    data: webData,
    isLoading: webLoading,
    isError: webError,
    refetch: webRefetch,
  } = useQuery({
    queryKey: ['admin-pending-players', subDivision],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/players/approve?status=pending&division=${subDivision}`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error('Gagal mengambil data pemain pending');
      return res.json();
    },
    refetchInterval: 30000,
  });

  // ── Fetch WA pending registrations ──────────────────────────
  const {
    data: waData,
    isLoading: waLoading,
    isError: waError,
    refetch: waRefetch,
  } = useQuery({
    queryKey: ['wa-registrations', subDivision],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('status', 'pending');
      params.set('limit', '100');
      const res = await fetch(`/api/wa-registrations?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal mengambil data pendaftaran WA');
      const data = await res.json();
      const allRegs = (data.data || []) as WaRegistration[];
      // Client-side filter by division (handles both M/F and male/female)
      if (subDivision === 'male') return allRegs.filter((r) => r.division === 'M' || r.division === 'male');
      if (subDivision === 'female') return allRegs.filter((r) => r.division === 'F' || r.division === 'female');
      return allRegs;
    },
    refetchInterval: 30000,
  });

  const webPlayers: PendingPlayer[] = webData?.data || [];
  const waRegistrations: WaRegistration[] = waData || [];

  // ── Merge into unified list ─────────────────────────────────
  const unifiedItems = useMemo<UnifiedPendingItem[]>(() => {
    const webItems: UnifiedPendingItem[] = webPlayers.map((p) => ({
      id: `web-${p.id}`,
      source: 'web' as const,
      name: p.name,
      gamertag: p.gamertag,
      division: p.division,
      city: p.city,
      phone: p.phone,
      waNumber: p.waNumber,
      clubName: p.clubMembers?.[0]?.profile?.name ?? null,
      hasAccount: !!p.account,
      createdAt: p.createdAt,
      rawPlayer: p,
    }));

    const waItems: UnifiedPendingItem[] = waRegistrations.map((r) => ({
      id: `wa-${r.id}`,
      source: 'wa' as const,
      name: r.name,
      gamertag: r.gamertag,
      division: normaliseDivision(r.division),
      city: r.city,
      phone: null,
      waNumber: r.waNumber,
      clubName: r.clubName,
      hasAccount: !!r.playerId,
      createdAt: r.createdAt,
      verificationCode: r.verificationCode,
      tournament: r.tournament ?? undefined,
      expiresAt: r.expiresAt,
      playerId: r.playerId,
      approvedBy: r.approvedBy,
      assignedTier: r.assignedTier,
      rawWa: r,
    }));

    // Sort by creation time (newest first)
    return [...webItems, ...waItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [webPlayers, waRegistrations]);

  // ── Apply source filter ─────────────────────────────────────
  const filteredItems = useMemo(() => {
    if (sourceFilter === 'all') return unifiedItems;
    return unifiedItems.filter((item) => item.source === sourceFilter);
  }, [unifiedItems, sourceFilter]);

  const totalCount = unifiedItems.length;
  const webCount = unifiedItems.filter((i) => i.source === 'web').length;
  const waCount = unifiedItems.filter((i) => i.source === 'wa').length;

  // ── Invalidate all relevant query keys ──────────────────────
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['admin-pending-players'] });
    qc.invalidateQueries({ queryKey: ['wa-registrations'] });
    qc.invalidateQueries({ queryKey: ['admin-players'] });
    qc.invalidateQueries({ queryKey: ['stats'] });
    qc.invalidateQueries({ queryKey: ['wa-registrations-pending'] });
  };

  // ── Web approve mutation ─────────────────────────────────────
  const webApproveMutation = useMutation({
    mutationFn: async ({ playerId, tier }: { playerId: string; tier: string }) => {
      const res = await fetch('/api/admin/players/approve', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, action: 'approve', tier }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Gagal menyetujui pendaftaran');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      invalidateAll();
      toast.success(`Player berhasil disetujui sebagai Tier ${variables.tier}! ✅`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Web reject mutation ──────────────────────────────────────
  const webRejectMutation = useMutation({
    mutationFn: async ({ playerId, reason }: { playerId: string; reason: string }) => {
      const res = await fetch('/api/admin/players/approve', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, action: 'reject', reason }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Gagal menolak pendaftaran');
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      closeRejectDialog();
      toast.success('Pendaftaran berhasil ditolak.');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── WA approve mutation ──────────────────────────────────────
  const waApproveMutation = useMutation({
    mutationFn: async ({ id, assignedTier }: { id: string; assignedTier?: string }) => {
      const res = await fetch(`/api/wa-registrations/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved', assignedTier }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Gagal menyetujui pendaftaran WA');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      invalidateAll();
      toast.success(`Pendaftaran WA disetujui sebagai Tier ${variables.assignedTier || 'B'}! ✅`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── WA reject mutation ───────────────────────────────────────
  const waRejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await fetch(`/api/wa-registrations/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', reason }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Gagal menolak pendaftaran WA');
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      closeRejectDialog();
      toast.success('Pendaftaran WA berhasil ditolak.');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Bulk approve mutation ────────────────────────────────────
  const bulkApproveMutation = useMutation({
    mutationFn: async () => {
      const promises: Promise<unknown>[] = [];

      for (const item of unifiedItems) {
        const tier = itemTiers[item.id] || 'B';
        if (item.source === 'web' && item.rawPlayer) {
          promises.push(
            fetch('/api/admin/players/approve', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ playerId: item.rawPlayer.id, action: 'approve', tier }),
            }).then((r) => {
              if (!r.ok) throw new Error('Gagal approve web player');
              return r.json();
            }),
          );
        } else if (item.source === 'wa' && item.rawWa) {
          promises.push(
            fetch(`/api/wa-registrations/${item.rawWa.id}`, {
              method: 'PUT',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'approved', assignedTier: tier }),
            }).then((r) => {
              if (!r.ok) throw new Error('Gagal approve WA registration');
              return r.json();
            }),
          );
        }
      }

      await Promise.all(promises);
    },
    onSuccess: () => {
      invalidateAll();
      toast.success(`Semua pendaftaran pending (${totalCount}) berhasil disetujui! ✅`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Action helpers ───────────────────────────────────────────
  const getItemTier = (itemId: string) => itemTiers[itemId] || 'B';

  const handleApprove = (item: UnifiedPendingItem) => {
    const tier = getItemTier(item.id);
    if (item.source === 'web' && item.rawPlayer) {
      webApproveMutation.mutate({ playerId: item.rawPlayer.id, tier });
    } else if (item.source === 'wa' && item.rawWa) {
      waApproveMutation.mutate({ id: item.rawWa.id, assignedTier: tier });
    }
  };

  const isApproving = (item: UnifiedPendingItem) => {
    if (item.source === 'web' && item.rawPlayer) {
      return webApproveMutation.isPending && webApproveMutation.variables?.playerId === item.rawPlayer.id;
    }
    if (item.source === 'wa' && item.rawWa) {
      return waApproveMutation.isPending && waApproveMutation.variables?.id === item.rawWa.id;
    }
    return false;
  };

  const openRejectDialog = (item: UnifiedPendingItem) => {
    setRejectDialog({ open: true, item, reason: '' });
  };

  const closeRejectDialog = () => {
    setRejectDialog({ open: false, item: null, reason: '' });
  };

  const handleRejectConfirm = () => {
    if (!rejectDialog.item) return;
    if (!rejectDialog.reason.trim()) {
      toast.error('Alasan penolakan wajib diisi');
      return;
    }
    const { item, reason } = rejectDialog;
    if (item.source === 'web' && item.rawPlayer) {
      webRejectMutation.mutate({ playerId: item.rawPlayer.id, reason: reason.trim() });
    } else if (item.source === 'wa' && item.rawWa) {
      waRejectMutation.mutate({ id: item.rawWa.id, reason: reason.trim() });
    }
  };

  const isRejecting = () => {
    return webRejectMutation.isPending || waRejectMutation.isPending;
  };

  const isLoading = webLoading && waLoading;
  const isError = webError && waError;

  return (
    <div className="space-y-4">
      {/* ── Header bar ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Left: Title + count */}
        <div className="flex items-center gap-2">
          <UserPlus className={`w-4 h-4 ${dt.neonText}`} />
          <h3 className="text-sm font-semibold">Pending Registrations</h3>
          {totalCount > 0 && (
            <Badge className="text-[9px] border-0 bg-yellow-500/15 text-yellow-500 px-1.5 py-0">
              {totalCount} menunggu
            </Badge>
          )}
        </div>

        {/* Right: Division + Source toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Division sub-filter */}
          <div className="flex items-center bg-muted/60 rounded-lg p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => setSubDivision('male')}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all duration-200 cursor-pointer ${
                subDivision === 'male'
                  ? 'bg-cyan-500/20 text-cyan-400 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground/70'
              }`}
            >
              🕺 Cowo
            </button>
            <button
              type="button"
              onClick={() => setSubDivision('female')}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all duration-200 cursor-pointer ${
                subDivision === 'female'
                  ? 'bg-purple-500/20 text-purple-400 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground/70'
              }`}
            >
              💃 Cewe
            </button>
          </div>

          {/* Source filter */}
          <div className="flex items-center bg-muted/60 rounded-lg p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => setSourceFilter('all')}
              className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-all duration-200 cursor-pointer ${
                sourceFilter === 'all'
                  ? 'bg-yellow-500/20 text-yellow-400 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground/70'
              }`}
            >
              All ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setSourceFilter('web')}
              className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-all duration-200 cursor-pointer flex items-center gap-1 ${
                sourceFilter === 'web'
                  ? 'bg-blue-500/20 text-blue-400 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground/70'
              }`}
            >
              <Globe className="w-3 h-3" />
              Web ({webCount})
            </button>
            <button
              type="button"
              onClick={() => setSourceFilter('wa')}
              className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-all duration-200 cursor-pointer flex items-center gap-1 ${
                sourceFilter === 'wa'
                  ? 'bg-green-500/20 text-green-400 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground/70'
              }`}
            >
              <MessageCircle className="w-3 h-3" />
              WA ({waCount})
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      {isLoading ? (
        <PendingSkeleton />
      ) : isError ? (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-8 h-8 mx-auto text-red-500/60 mb-2" />
            <p className="text-xs text-red-400">Gagal memuat data pending</p>
            <div className="flex items-center justify-center gap-2 mt-3">
              {webError && (
                <Button size="sm" variant="ghost" className="text-[10px]" onClick={() => webRefetch()}>
                  Refresh Web
                </Button>
              )}
              {waError && (
                <Button size="sm" variant="ghost" className="text-[10px]" onClick={() => waRefetch()}>
                  Refresh WA
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : filteredItems.length === 0 ? (
        <Card className="border border-border/50">
          <CardContent className="p-8 text-center">
            <Inbox className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground font-medium">
              Tidak ada pendaftaran yang menunggu persetujuan
            </p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              Pemain yang mendaftar melalui website atau WhatsApp akan muncul di sini
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-yellow-500/15 bg-yellow-500/[0.03]">
          <CardContent className="p-4">
            {/* Section header */}
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold flex items-center gap-2 text-yellow-500">
                <Clock className="w-4 h-4" />
                Menunggu Persetujuan ({filteredItems.length})
              </h4>
              <div className="flex items-center gap-2">
                {/* Bulk Approve */}
                {filteredItems.length > 1 && (
                  <Button
                    size="sm"
                    className="text-[9px] h-7 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => bulkApproveMutation.mutate()}
                    disabled={bulkApproveMutation.isPending}
                  >
                    {bulkApproveMutation.isPending ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                    )}
                    Approve Semua ({filteredItems.length})
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-[9px] text-muted-foreground h-7"
                  onClick={() => { webRefetch(); waRefetch(); }}
                >
                  <Loader2 className="w-3 h-3 mr-1" />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Unified pending list */}
            <div className="space-y-2 max-h-[560px] overflow-y-auto custom-scrollbar pr-1">
              {filteredItems.map((item) => (
                <UnifiedPendingCard
                  key={item.id}
                  item={item}
                  selectedTier={getItemTier(item.id)}
                  onTierChange={(tier) =>
                    setItemTiers((prev) => ({ ...prev, [item.id]: tier }))
                  }
                  onApprove={() => handleApprove(item)}
                  onReject={() => openRejectDialog(item)}
                  isApproving={isApproving(item)}
                  expanded={expandedId === item.id}
                  onToggleExpand={() =>
                    setExpandedId(expandedId === item.id ? null : item.id)
                  }
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Reject Dialog (shared for both sources) ──────────────── */}
      <Dialog
        open={rejectDialog.open}
        onOpenChange={(open) => {
          if (!open) closeRejectDialog();
          else setRejectDialog((prev) => ({ ...prev, open }));
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              Tolak Pendaftaran
            </DialogTitle>
            <DialogDescription>
              {rejectDialog.item && (
                <>
                  Tolak pendaftaran &quot;{rejectDialog.item.name}&quot;
                  {rejectDialog.item.source === 'wa' ? ' (WhatsApp)' : ' (Website)'}.
                  Pendaftaran akan ditandai sebagai rejected.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {/* Source indicator */}
            {rejectDialog.item && (
              <div className="flex items-center gap-2">
                <Badge
                  className={`text-[9px] border-0 ${
                    rejectDialog.item.source === 'web'
                      ? 'bg-blue-500/15 text-blue-400'
                      : 'bg-green-500/15 text-green-400'
                  }`}
                >
                  {rejectDialog.item.source === 'web' ? '🔵 Website' : '🟢 WhatsApp'}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {rejectDialog.item.gamertag}
                </span>
              </div>
            )}
            <div>
              <Label className="text-xs text-muted-foreground">
                Alasan Penolakan <span className="text-red-400">*</span>
              </Label>
              <Textarea
                placeholder="Masukkan alasan penolakan..."
                value={rejectDialog.reason}
                onChange={(e) =>
                  setRejectDialog((prev) => ({
                    ...prev,
                    reason: e.target.value,
                  }))
                }
                className="mt-1.5 min-h-[80px] resize-none"
              />
              <p className="text-[9px] text-muted-foreground/60 mt-1">
                Alasan ini akan dicatat di log audit untuk referensi
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              size="sm"
              variant="ghost"
              onClick={closeRejectDialog}
              disabled={isRejecting()}
            >
              Batal
            </Button>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleRejectConfirm}
              disabled={isRejecting() || !rejectDialog.reason.trim()}
            >
              {isRejecting() ? (
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              ) : (
                <XCircle className="w-3.5 h-3.5 mr-1" />
              )}
              Tolak Pendaftaran
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Unified Pending Card ─────────────────────────────────────
function UnifiedPendingCard({
  item,
  selectedTier,
  onTierChange,
  onApprove,
  onReject,
  isApproving,
  expanded,
  onToggleExpand,
}: {
  item: UnifiedPendingItem;
  selectedTier: string;
  onTierChange: (tier: string) => void;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const isWa = item.source === 'wa';
  const tierCfg = TIER_CONFIG[selectedTier] || TIER_CONFIG.B;

  return (
    <div className="rounded-2xl bg-card border border-yellow-500/10 transition-colors hover:border-yellow-500/20">
      {/* ── Main row ─────────────────────────────────────────── */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-3">
          {/* Left: Player info */}
          <div className="flex-1 min-w-0">
            {/* Name & badges */}
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {/* Source badge */}
              <Badge
                className={`text-[9px] border-0 ${
                  isWa
                    ? 'bg-green-500/15 text-green-400'
                    : 'bg-blue-500/15 text-blue-400'
                }`}
              >
                {isWa ? '🟢 WA' : '🔵 Web'}
              </Badge>

              <p className="text-sm font-semibold truncate">{item.name}</p>

              {/* Division badge */}
              <Badge
                className={`text-[9px] border-0 ${
                  item.division === 'male'
                    ? 'bg-cyan-500/10 text-cyan-400'
                    : 'bg-purple-500/10 text-purple-400'
                }`}
              >
                {item.division === 'male' ? '🕺 Cowo' : '💃 Cewe'}
              </Badge>

              {/* Account status badge */}
              {item.hasAccount && (
                <Badge className="text-[8px] border-0 bg-green-500/10 text-green-400">
                  ✅ Ada Akun
                </Badge>
              )}
            </div>

            {/* Nickname */}
            <div className="text-[11px] text-muted-foreground mb-1.5">
              Nickname:{' '}
              <span className="font-medium text-foreground">{item.gamertag}</span>
            </div>

            {/* Details row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
              {item.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {item.city}
                </span>
              )}
              {(item.phone || item.waNumber) && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {item.phone || item.waNumber}
                </span>
              )}
              {item.clubName && (
                <span className="flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  {item.clubName}
                </span>
              )}
            </div>

            {/* Registration date & account status */}
            <div className="flex items-center gap-3 mt-1.5 text-[9px] text-muted-foreground/60">
              <span className="flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                Daftar: {formatDate(item.createdAt)}
              </span>
              {!item.hasAccount && (
                <span className="text-muted-foreground/40">
                  ⚠️ Belum punya akun
                </span>
              )}
            </div>
          </div>

          {/* Right: Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Tier selector */}
            <Select value={selectedTier} onValueChange={onTierChange}>
              <SelectTrigger className="w-[70px] h-7 text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="S">
                  <span className="flex items-center gap-1">💎 S</span>
                </SelectItem>
                <SelectItem value="A">
                  <span className="flex items-center gap-1">🥈 A</span>
                </SelectItem>
                <SelectItem value="B">
                  <span className="flex items-center gap-1">🥉 B</span>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Approve button */}
            <Button
              size="sm"
              className="h-7 w-7 p-0 bg-green-600 hover:bg-green-700 text-white"
              onClick={onApprove}
              disabled={isApproving}
              title={`Setujui sebagai Tier ${selectedTier}`}
            >
              {isApproving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UserCheck className="w-3.5 h-3.5" />
              )}
            </Button>

            {/* Reject button */}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-red-500 hover:text-red-400 hover:bg-red-500/10"
              onClick={onReject}
              disabled={isApproving}
              title="Tolak pendaftaran"
            >
              <XCircle className="w-3.5 h-3.5" />
            </Button>

            {/* Expand toggle (WA items) */}
            {isWa && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground hover:bg-muted/30"
                onClick={onToggleExpand}
                title="Detail WA"
              >
                {expanded ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Expandable WA details ────────────────────────────── */}
      {isWa && expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border/20">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]">
            {/* WA Number */}
            {item.waNumber && (
              <div className="flex items-center gap-1.5">
                <MessageCircle className="w-3 h-3 text-green-400" />
                <span className="text-muted-foreground">WA:</span>
                <span className="font-mono">{item.waNumber}</span>
              </div>
            )}
            {/* City */}
            {item.city && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">Kota:</span>
                <span>{item.city}</span>
              </div>
            )}
            {/* Club */}
            <div className="flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Club:</span>
              <span>{item.clubName || '-'}</span>
            </div>
            {/* Player link */}
            <div className="flex items-center gap-1.5">
              <UserPlus className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Player:</span>
              <span>{item.playerId ? '✅ Linked' : '❌ Not linked'}</span>
            </div>
            {/* Verification code */}
            {item.verificationCode && (
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Kode:</span>
                <span className="font-mono text-yellow-500">{item.verificationCode}</span>
              </div>
            )}
            {/* Tournament */}
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Tournament:</span>
              <span>{item.tournament?.name || '-'}</span>
            </div>
          </div>
          {/* Expiry & approved-by */}
          <div className="flex items-center gap-2 text-[9px] text-muted-foreground/60 pt-2 mt-2 border-t border-border/10">
            {item.expiresAt && (
              <>
                <span>Exp: {new Date(item.expiresAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</span>
                <span>•</span>
              </>
            )}
            {item.approvedBy && (
              <>
                <span>Approved by: {item.approvedBy}</span>
                <span>•</span>
              </>
            )}
            {item.assignedTier && (
              <span>Tier: {item.assignedTier}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
