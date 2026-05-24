'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageCircle, Clock, CheckCircle2, XCircle, Phone, MapPin,
  Loader2, Trash2, Filter, UserPlus, Shield, ChevronDown, ChevronUp,
  Users,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useDivisionTheme } from '@/hooks/use-division-theme';

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

interface AdminWaRegistrationsTabProps {
  division: string;
}

const STATUS_CONFIG: Record<string, { emoji: string; color: string; bg: string; label: string }> = {
  pending: { emoji: '⏳', color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'Menunggu' },
  approved: { emoji: '✅', color: 'text-green-500', bg: 'bg-green-500/10', label: 'Disetujui' },
  rejected: { emoji: '❌', color: 'text-red-500', bg: 'bg-red-500/10', label: 'Ditolak' },
  expired: { emoji: '⌛', color: 'text-muted-foreground', bg: 'bg-muted/30', label: 'Kedaluwarsa' },
  registered: { emoji: '📝', color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Terdaftar' },
};

export function AdminWaRegistrationsTab({ division }: AdminWaRegistrationsTabProps) {
  const dt = useDivisionTheme();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch WA registrations
  const { data: registrationsData, isLoading } = useQuery({
    queryKey: ['wa-registrations', division, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      // WA Registration uses "M"/"F" for division, not "male"/"female"
      // But we query both formats since some records may use either
      params.set('limit', '100');
      const res = await fetch(`/api/wa-registrations?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      // Client-side filter by division (handles both M/F and male/female formats)
      const allRegs = data.data as WaRegistration[];
      if (division === 'male') return allRegs.filter((r) => r.division === 'M' || r.division === 'male');
      if (division === 'female') return allRegs.filter((r) => r.division === 'F' || r.division === 'female');
      return allRegs;
    },
  });

  // Fetch pending count for badge
  const { data: pendingCount } = useQuery({
    queryKey: ['wa-registrations-pending', division],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('status', 'pending');
      params.set('limit', '1');
      const res = await fetch(`/api/wa-registrations?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) return 0;
      const data = await res.json();
      return data.total || 0;
    },
  });

  // Approve registration
  const approveRegistration = useMutation({
    mutationFn: async ({ id, assignedTier }: { id: string; assignedTier?: string }) => {
      const res = await fetch(`/api/wa-registrations/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved', assignedTier }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to approve');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa-registrations'] });
      qc.invalidateQueries({ queryKey: ['wa-registrations-pending'] });
      toast.success('Pendaftaran WA disetujui! ✅');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Reject registration
  const rejectRegistration = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/wa-registrations/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to reject');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa-registrations'] });
      qc.invalidateQueries({ queryKey: ['wa-registrations-pending'] });
      toast.success('Pendaftaran WA ditolak.');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Delete registration
  const deleteRegistration = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/wa-registrations/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to delete');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa-registrations'] });
      qc.invalidateQueries({ queryKey: ['wa-registrations-pending'] });
      toast.success('Pendaftaran dihapus.');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Bulk approve all pending
  const bulkApprove = useMutation({
    mutationFn: async () => {
      const pending = (registrationsData || []).filter(r => r.status === 'pending');
      if (pending.length === 0) return;
      const res = await fetch(`/api/wa-registrations`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: pending.map(r => r.id),
          status: 'approved',
          approvedBy: 'admin',
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to bulk approve');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa-registrations'] });
      qc.invalidateQueries({ queryKey: ['wa-registrations-pending'] });
      toast.success('Semua pendaftaran pending disetujui! ✅');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const registrations = registrationsData || [];
  const pendingRegs = registrations.filter(r => r.status === 'pending');
  const otherRegs = registrations.filter(r => r.status !== 'pending');

  return (
    <div className="space-y-4">
      {/* Header with filter */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <MessageCircle className={`w-4 h-4 ${dt.neonText}`} />
          <h3 className="text-sm font-semibold">Pendaftaran WhatsApp</h3>
          {pendingCount > 0 && (
            <Badge className="text-[8px] border-0 bg-yellow-500/15 text-yellow-500 px-1.5 py-0">
              {pendingCount} pending
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] h-8 text-[10px]">
              <Filter className="w-3 h-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="pending">⏳ Pending</SelectItem>
              <SelectItem value="approved">✅ Disetujui</SelectItem>
              <SelectItem value="rejected">❌ Ditolak</SelectItem>
              <SelectItem value="expired">⌛ Kedaluwarsa</SelectItem>
            </SelectContent>
          </Select>
          {pendingRegs.length > 1 && (
            <Button
              size="sm"
              className="h-8 text-[10px] bg-green-600 hover:bg-green-700 text-white"
              onClick={() => bulkApprove.mutate()}
              disabled={bulkApprove.isPending}
            >
              {bulkApprove.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
              Approve Semua ({pendingRegs.length})
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : registrations.length === 0 ? (
        <Card className="border border-border/50">
          <CardContent className="p-8 text-center">
            <MessageCircle className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-xs text-muted-foreground">Belum ada pendaftaran WhatsApp</p>
            <p className="text-[10px] text-muted-foreground/70 mt-1">
              Pemain bisa mendaftar melalui bot WA: &quot;p daftar &lt;nickname&gt; &lt;M/F&gt;&quot;
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Pending Registrations — Priority Queue */}
          {pendingRegs.length > 0 && (
            <Card className="border-yellow-500/20 bg-yellow-500/5">
              <CardContent className="p-4">
                <h4 className="text-xs font-semibold mb-3 flex items-center gap-2 text-yellow-500">
                  <Clock className="w-4 h-4" /> Menunggu Persetujuan ({pendingRegs.length})
                </h4>
                <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                  {pendingRegs.map(reg => (
                    <WaRegCard
                      key={reg.id}
                      reg={reg}
                      expanded={expandedId === reg.id}
                      onToggle={() => setExpandedId(expandedId === reg.id ? null : reg.id)}
                      onApprove={(tier) => approveRegistration.mutate({ id: reg.id, assignedTier: tier })}
                      onReject={() => rejectRegistration.mutate(reg.id)}
                      onDelete={() => deleteRegistration.mutate(reg.id)}
                      isApproving={approveRegistration.isPending}
                      isRejecting={rejectRegistration.isPending}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Other Registrations */}
          {otherRegs.length > 0 && (
            <Card className="border border-border/50">
              <CardContent className="p-4">
                <h4 className="text-xs font-semibold mb-3 flex items-center gap-2 text-muted-foreground">
                  <Users className="w-4 h-4" /> Semua Pendaftaran ({otherRegs.length})
                </h4>
                <div className="space-y-1.5 max-h-96 overflow-y-auto custom-scrollbar">
                  {otherRegs.map(reg => (
                    <WaRegCard
                      key={reg.id}
                      reg={reg}
                      expanded={expandedId === reg.id}
                      onToggle={() => setExpandedId(expandedId === reg.id ? null : reg.id)}
                      onApprove={(tier) => approveRegistration.mutate({ id: reg.id, assignedTier: tier })}
                      onReject={() => rejectRegistration.mutate(reg.id)}
                      onDelete={() => deleteRegistration.mutate(reg.id)}
                      isApproving={approveRegistration.isPending}
                      isRejecting={rejectRegistration.isPending}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ─── Individual Registration Card ──────────────────────────────
function WaRegCard({
  reg,
  expanded,
  onToggle,
  onApprove,
  onReject,
  onDelete,
  isApproving,
  isRejecting,
}: {
  reg: WaRegistration;
  expanded: boolean;
  onToggle: () => void;
  onApprove: (tier?: string) => void;
  onReject: () => void;
  onDelete: () => void;
  isApproving: boolean;
  isRejecting: boolean;
}) {
  const [selectedTier, setSelectedTier] = useState(reg.assignedTier || 'B');
  const statusCfg = STATUS_CONFIG[reg.status] || STATUS_CONFIG.pending;
  const isPending = reg.status === 'pending';
  const divLabel = reg.division === 'M' ? '♂ Cowo' : reg.division === 'F' ? '♀ Cewe' : reg.division;

  return (
    <div className={`rounded-lg border ${
      isPending ? 'bg-card border-yellow-500/15' :
      reg.status === 'approved' ? 'bg-card border-green-500/10' :
      reg.status === 'rejected' ? 'bg-card border-red-500/10 opacity-60' :
      'bg-card border-border/30'
    }`}>
      {/* Main row */}
      <div className="flex items-center justify-between p-2.5 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${statusCfg.bg} ${statusCfg.color}`}>
            {statusCfg.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold truncate">{reg.gamertag}</span>
              <Badge className={`text-[8px] border-0 px-1.5 py-0 ${reg.division === 'M' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-purple-500/10 text-purple-400'}`}>
                {divLabel}
              </Badge>
              <Badge className={`text-[8px] border-0 px-1.5 py-0 ${statusCfg.bg} ${statusCfg.color}`}>
                {statusCfg.label}
              </Badge>
              {reg.assignedTier && (
                <Badge className={`text-[8px] border-0 px-1.5 py-0 ${
                  reg.assignedTier === 'S' ? 'bg-red-500/15 text-red-400' :
                  reg.assignedTier === 'A' ? 'bg-yellow-500/15 text-yellow-400' :
                  'bg-blue-500/15 text-blue-400'
                }`}>
                  Tier {reg.assignedTier}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-muted-foreground">{reg.name}</span>
              {reg.tournament && (
                <span className="text-[10px] text-muted-foreground/70">• {reg.tournament.name}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isPending && (
            <>
              <Select value={selectedTier} onValueChange={setSelectedTier}>
                <SelectTrigger className="w-[65px] h-7 text-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="S">💎 S</SelectItem>
                  <SelectItem value="A">🥈 A</SelectItem>
                  <SelectItem value="B">🥉 B</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" className="h-7 text-[10px] bg-green-600 hover:bg-green-700 text-white px-2"
                onClick={() => onApprove(selectedTier)}
                disabled={isApproving}>
                {isApproving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-[10px] text-red-500 hover:bg-red-500/10 px-2"
                onClick={onReject}
                disabled={isRejecting}>
                <XCircle className="w-3 h-3" />
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:bg-muted/30"
            onClick={onToggle}>
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border/20 space-y-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]">
            <div className="flex items-center gap-1.5">
              <Phone className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">WA:</span>
              <span className="font-mono">{reg.waNumber}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Kota:</span>
              <span>{reg.city || '-'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Club:</span>
              <span>{reg.clubName || '-'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <UserPlus className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Player:</span>
              <span>{reg.playerId ? '✅ Linked' : '❌ Not linked'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Kode:</span>
              <span className="font-mono text-idm-gold-warm">{reg.verificationCode}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Tournament:</span>
              <span>{reg.tournament?.name || '-'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[9px] text-muted-foreground/60 pt-1">
            <span>Daftar: {new Date(reg.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            <span>•</span>
            <span>Exp: {new Date(reg.expiresAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</span>
            {reg.approvedBy && (
              <>
                <span>•</span>
                <span>Approved by: {reg.approvedBy}</span>
              </>
            )}
          </div>
          {!isPending && (
            <Button size="sm" variant="ghost" className="h-6 text-[9px] text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2 mt-1"
              onClick={onDelete}>
              <Trash2 className="w-2.5 h-2.5 mr-1" /> Hapus
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
