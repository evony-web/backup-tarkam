'use client';

import { useQuery } from '@tanstack/react-query';

import {
  Calendar, Shield, Globe, Gift,
  Music,
  AlertTriangle, Clock, UserPlus, CreditCard, Swords, MessageSquare,
  ChevronRight, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useDivisionTheme } from '@/hooks/use-division-theme';

interface AdminOverviewProps {
  division: 'semua' | 'male' | 'female';
  onNavigateToTab?: (tab: string) => void;
}

// Action icon/color map (same as AdminSettingsPanel)
const ACTION_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  create: { bg: 'bg-green-500/10', text: 'text-green-500', icon: '+' },
  update: { bg: 'bg-blue-500/10', text: 'text-blue-500', icon: '✎' },
  delete: { bg: 'bg-red-500/10', text: 'text-red-500', icon: '×' },
  approve: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', icon: '✓' },
  reject: { bg: 'bg-orange-500/10', text: 'text-orange-500', icon: '✗' },
  login: { bg: 'bg-purple-500/10', text: 'text-purple-500', icon: '→' },
  export: { bg: 'bg-cyan-500/10', text: 'text-cyan-500', icon: '↓' },
  reseed: { bg: 'bg-red-500/10', text: 'text-red-500', icon: '↻' },
};

const ENTITY_LABELS: Record<string, string> = {
  player: 'Player',
  tournament: 'Turnamen',
  season: 'Season',
  donation: 'Donasi',
  sponsor: 'Sponsor',
  achievement: 'Achievement',
  skin: 'Skin',
  cms: 'Konten',
  match: 'Match',
  club: 'Club',
  admin: 'Admin',
  auth: 'Auth',
};

interface AuditLogEntry {
  id: string;
  adminId?: string | null;
  adminName?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: string | null;
  metadata?: string | null;
  createdAt: string;
}

export function AdminOverview({ division, onNavigateToTab }: AdminOverviewProps) {
  const dt = useDivisionTheme();

  // Build division filter for API calls
  const divisionParam = division !== 'semua' ? division : '';

  const { data: stats } = useQuery({
    queryKey: ['stats', division],
    queryFn: async () => {
      const res = await fetch(`/api/stats?division=${division}`);
      return res.json();
    },
  });

  // ─── Perlu Perhatian queries ───

  // Pending player registrations
  const { data: pendingPlayersData } = useQuery({
    queryKey: ['admin-pending-registrations', division],
    queryFn: async () => {
      const params = new URLSearchParams({ registrationStatus: 'pending' });
      if (divisionParam) params.set('division', divisionParam);
      const res = await fetch(`/api/players?${params}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Pending donations (requires admin auth)
  const { data: pendingDonationsData } = useQuery({
    queryKey: ['admin-pending-donations', division],
    queryFn: async () => {
      const params = new URLSearchParams({ status: 'pending' });
      if (divisionParam) params.set('division', divisionParam);
      const res = await fetch(`/api/donations?${params}`, { credentials: 'include' });
      if (!res.ok) return { donations: [], total: { amount: 0, count: 0 } };
      return res.json();
    },
  });

  // WA registrations pending
  const { data: pendingWaData } = useQuery({
    queryKey: ['admin-pending-wa-registrations', division],
    queryFn: async () => {
      const params = new URLSearchParams({ status: 'pending' });
      if (divisionParam) params.set('division', divisionParam);
      const res = await fetch(`/api/wa-registrations?${params}`);
      if (!res.ok) return { data: [], pagination: { total: 0 } };
      return res.json();
    },
  });

  // Audit logs (compact — 5 entries)
  const { data: auditData, isLoading: isLoadingLogs } = useQuery({
    queryKey: ['admin-audit-logs-compact'],
    queryFn: async () => {
      const res = await fetch('/api/admin/audit-logs?limit=5', { credentials: 'include' });
      if (!res.ok) return { logs: [], total: 0 };
      return res.json() as Promise<{ logs: AuditLogEntry[]; total: number }>;
    },
    refetchInterval: 30000,
  });

  // ─── Compute values ───

  const pendingRegistrations = Array.isArray(pendingPlayersData) ? pendingPlayersData.length : 0;
  const pendingDonations = (pendingDonationsData as Record<string, unknown>)?.donations
    ? ((pendingDonationsData as Record<string, unknown>).donations as unknown[]).length
    : 0;
  const activeTournaments = stats?.tournaments?.filter(
    (t: { status: string }) => t.status !== 'completed'
  ).length || 0;
  const pendingWaRegistrations = (pendingWaData as Record<string, unknown>)?.pagination
    ? ((pendingWaData as Record<string, { total: number }>).pagination).total
    : 0;

  // Quick action cards — actionable shortcuts for admin
  const quickActions = [
    {
      icon: Music,
      label: 'Buat Turnamen',
      desc: 'KLIK untuk buat & kelola turnamen',
      tabKey: 'turnamen',
      accent: 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20',
    },
    {
      icon: UserPlus,
      label: 'Tambah Pemain',
      desc: 'KLIK untuk daftarkan pemain baru',
      tabKey: 'pemain',
      accent: 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20',
    },
    {
      icon: Shield,
      label: 'Buat Club',
      desc: 'KLIK untuk kelola club & anggota',
      tabKey: 'club',
      accent: 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20',
    },
    {
      icon: Gift,
      label: 'Keuangan',
      desc: 'KLIK untuk donasi & pembayaran',
      tabKey: 'keuangan',
      accent: 'bg-green-500/10 text-green-500 hover:bg-green-500/20',
    },
    {
      icon: Globe,
      label: 'Konten',
      desc: 'KLIK untuk edit halaman & sponsor',
      tabKey: 'konten',
      accent: 'bg-purple-500/10 text-purple-500 hover:bg-purple-500/20',
    },
  ];

  // Needs attention items — with tab key for navigation
  const attentionItems = [
    {
      icon: UserPlus,
      label: 'Registrasi Pemain',
      count: pendingRegistrations,
      tab: 'Pemain',
      tabKey: 'pemain',
    },
    {
      icon: CreditCard,
      label: 'Donasi Perlu Approval',
      count: pendingDonations,
      tab: 'Keuangan',
      tabKey: 'keuangan',
    },
    {
      icon: Swords,
      label: 'Turnamen Aktif',
      count: activeTournaments,
      tab: 'Turnamen',
      tabKey: 'turnamen',
    },
    {
      icon: MessageSquare,
      label: 'WA Registrasi',
      count: pendingWaRegistrations,
      tab: 'Pemain',
      tabKey: 'pemain',
    },
  ];

  const auditLogs = auditData?.logs || [];

  return (
    <div className="space-y-4">
      {/* Quick Action cards */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {quickActions.map((action, i) => {
          const ActionIcon = action.icon;
          return (
            <div key={action.label} className="col-span-1 stagger-item-subtle" style={{ animationDelay: `${(i + 1) * 30}ms` }}>
              <button
                type="button"
                onClick={() => onNavigateToTab?.(action.tabKey)}
                className={`w-full h-full rounded-lg border border-border p-3 flex flex-col items-center justify-center text-center transition-colors cursor-pointer group ${action.accent}`}
              >
                <div className="p-2 rounded-lg bg-muted/30 group-hover:bg-muted/50 transition-colors mb-1.5">
                  <ActionIcon className="w-4 h-4" />
                </div>
                <p className="text-xs font-semibold leading-tight">{action.label}</p>
                <p className="text-sm opacity-75 mt-0.5 leading-tight font-medium">{action.desc}</p>
              </button>
            </div>
          );
        })}
      </div>

      {/* Season Progress — full width compact */}
      <div className="stagger-item-subtle stagger-d0">
        <Card className={dt.casinoCard}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className={`w-4 h-4 ${dt.text}`} />
              Season Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">Week {stats?.seasonProgress?.completedWeeks || 0} of {stats?.seasonProgress?.totalWeeks || 10}</span>
                  <span className="font-medium">{stats?.seasonProgress?.percentage || 0}%</span>
                </div>
                <Progress value={stats?.seasonProgress?.percentage || 0} className="h-2" />
              </div>
              {/* Week indicators */}
              <div className="flex gap-1 shrink-0">
                {Array.from({ length: stats?.seasonProgress?.totalWeeks || 10 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-3 h-1.5 rounded-full ${
                      i < (stats?.seasonProgress?.completedWeeks || 0)
                        ? division === 'male' ? 'bg-idm-male' : division === 'female' ? 'bg-idm-female' : 'bg-primary'
                        : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2 cols: Perlu Perhatian | Log Aktivitas — equal height */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:stretch">
        {/* Perlu Perhatian (Needs Attention) */}
        <div className="stagger-item-subtle stagger-d1 flex flex-col">
          <Card className={`${dt.casinoCard} flex-1 flex flex-col`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className={`w-4 h-4 ${dt.text}`} />
                Perlu Perhatian
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="space-y-2.5 flex-1">
                {attentionItems.map((item) => {
                  const Icon = item.icon;
                  const needsAction = item.count > 0;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => onNavigateToTab?.(item.tabKey)}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 w-full text-left transition-colors hover:bg-muted/50 cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-md ${needsAction ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
                          <Icon className={`w-3.5 h-3.5 ${needsAction ? 'text-red-500' : 'text-green-500'}`} />
                        </div>
                        <div>
                          <p className="text-xs font-medium">{item.label}</p>
                          <p className="text-xs text-muted-foreground group-hover:text-idm-gold-warm transition-colors">
                            {needsAction ? `Lihat di tab ${item.tab} →` : 'Semua baik ✓'}
                          </p>
                        </div>
                      </div>
                      {needsAction ? (
                        <Badge className="text-xs border-0 bg-red-500/10 text-red-500 font-bold">
                          {item.count}
                        </Badge>
                      ) : (
                        <span className="text-green-500 text-sm font-bold">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Log Aktivitas — compact version */}
        <div className="stagger-item-subtle stagger-d1 flex flex-col">
          <Card className={`${dt.casinoCard} flex-1 flex flex-col`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className={`w-4 h-4 ${dt.text}`} />
                Log Aktivitas
                {auditData?.total ? (
                  <Badge className="text-xs border-0 bg-idm-gold-warm/10 text-idm-gold-warm">{auditData.total}</Badge>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              {isLoadingLogs ? (
                <div className="flex items-center justify-center py-6 flex-1">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : auditLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6 flex-1">Belum ada log</p>
              ) : (
                <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar" style={{ maxHeight: '260px' }}>
                  {auditLogs.map((log) => {
                    const style = ACTION_STYLES[log.action] || { bg: 'bg-muted', text: 'text-muted-foreground', icon: '•' };
                    const entityLabel = ENTITY_LABELS[log.entity] || log.entity;
                    return (
                      <div key={log.id} className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/30">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 ${style.bg} ${style.text}`}>
                          {style.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 flex-wrap">
                            <p className="text-xs font-medium capitalize">{log.action} {entityLabel}</p>
                            {log.adminName && (
                              <span className="text-xs px-1 py-0.5 rounded-full bg-idm-gold-warm/10 text-idm-gold-warm">oleh {log.adminName}</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{log.details || '—'}</p>
                          <p className="text-xs text-muted-foreground/60">
                            {new Date(log.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} · {new Date(log.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {/* Link to full logs in Pengaturan tab */}
                  <div className="pt-1 border-t border-border">
                    <button
                      type="button"
                      className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Lihat semua <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
