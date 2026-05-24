'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  Settings, Database, RefreshCw, Trash2, Download,
  Shield, Clock, AlertTriangle, Loader2, ChevronDown, ChevronUp, Filter, HardDrive
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useState } from 'react';
import { toast } from 'sonner';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { useAppStore } from '@/lib/store';

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

// Action icon/color map
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

export function AdminSettingsPanel() {
  const dt = useDivisionTheme();
  const qc = useQueryClient();
  const { adminAuth, refreshPlayerSession } = useAppStore();
  const isSuperAdmin = adminAuth.admin?.role === 'super_admin';
  const [isExporting, setIsExporting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [logFilter, setLogFilter] = useState<string>('all');
  const [showAllLogs, setShowAllLogs] = useState(false);

  // ─── Fetch real audit logs from API ───
  const { data: auditData, isLoading: isLoadingLogs } = useQuery({
    queryKey: ['admin-audit-logs', logFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '100' });
      if (logFilter !== 'all') params.set('entity', logFilter);
      const res = await fetch(`/api/admin/audit-logs?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      return res.json() as Promise<{ logs: AuditLogEntry[]; total: number }>;
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  const auditLogs = auditData?.logs || [];
  const displayLogs = showAllLogs ? auditLogs : auditLogs.slice(0, 10);

  // ─── Fetch persisted settings for toggles ───
  const { data: adminSettings } = useQuery({
    queryKey: ['admin-settings-toggles'],
    queryFn: async () => {
      const res = await fetch('/api/cms/settings', { credentials: 'include' });
      const d = await res.json();
      return (d?.map || {}) as Record<string, string>;
    },
  });

  const autoRefresh = adminSettings?.admin_auto_refresh !== 'false'; // default true
  const donationNotif = adminSettings?.admin_donation_notif !== 'false'; // default true
  const soundEffects = adminSettings?.admin_sound_effects === 'true'; // default false

  // Save a toggle setting
  const saveToggle = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const res = await fetch('/api/cms/settings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value, type: 'text' }),
      });
      if (!res.ok) throw new Error('Failed to save setting');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-settings-toggles'] });
    },
    onError: () => toast.error('Gagal menyimpan setting'),
  });

  // Reset points & tournament data
  const resetTournamentData = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/reset', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to reset');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries();
      // ★ Immediately update client-side player data so hero banner shows 0 pts
      const current = useAppStore.getState().playerAuth;
      if (current.isAuthenticated && current.account) {
        useAppStore.setState({
          playerAuth: {
            ...current,
            account: {
              ...current.account,
              donorBadgeCount: 0,
              skins: [],
              player: {
                ...current.account.player,
                points: 0,
                totalWins: 0,
                totalMvp: 0,
                matches: 0,
                streak: 0,
              },
            },
          },
        });
      }
      // Then refresh from server for authoritative data
      refreshPlayerSession();
      toast.success('Poin & data turnamen berhasil di-reset!');
    },
    onError: (e: Error) => toast.error(e.message || 'Gagal melakukan reset'),
  });

  // Export data
  const exportData = async (type: 'players' | 'tournaments' | 'matches' | 'all') => {
    setIsExporting(true);
    try {
      let data: Record<string, unknown> = {};

      if (type === 'players' || type === 'all') {
        const res = await fetch('/api/players?limit=1000', { credentials: 'include' });
        data.players = await res.json();
      }
      if (type === 'tournaments' || type === 'all') {
        const res = await fetch('/api/tournaments', { credentials: 'include' });
        data.tournaments = await res.json();
      }
      if (type === 'matches' || type === 'all') {
        const res = await fetch('/api/league-matches', { credentials: 'include' });
        data.leagueMatches = await res.json();
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `idm-league-export-${type}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Data ${type} berhasil di-export!`);
    } catch {
      toast.error('Gagal export data');
    } finally {
      setIsExporting(false);
    }
  };

  // Export to CSV
  const exportToCSV = async (type: 'players' | 'donations') => {
    setIsExporting(true);
    try {
      let data: Array<Record<string, unknown>> = [];
      let dataKeys: string[] = [];
      let displayHeaders: string[] = [];
      let filename = '';

      if (type === 'players') {
        const res = await fetch('/api/players?limit=1000', { credentials: 'include' });
        const json = await res.json();
        data = json;
        dataKeys = ['name', 'gamertag', 'division', 'tier', 'points', 'totalWins', 'totalMvp', 'city', 'phone'];
        displayHeaders = ['name', 'nickname', 'division', 'tier', 'points', 'totalWins', 'totalMvp', 'city', 'phone'];
        filename = 'players';
      } else if (type === 'donations') {
        const res = await fetch('/api/donations', { credentials: 'include' });
        const json = await res.json();
        data = json.donations || json;
        dataKeys = ['donorName', 'amount', 'message', 'type', 'createdAt'];
        displayHeaders = ['donorName', 'amount', 'message', 'type', 'createdAt'];
        filename = 'donations';
      }

      const csvRows = [
        displayHeaders.join(','),
        ...data.map(row => dataKeys.map(h => {
          const val = row[h];
          if (typeof val === 'string' && val.includes(',')) {
            return `"${val}"`;
          }
          return val ?? '';
        }).join(','))
      ];

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `idm-league-${filename}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`CSV ${filename} berhasil di-download!`);
    } catch {
      toast.error('Gagal export CSV');
    } finally {
      setIsExporting(false);
    }
  };

  // ★ Export Full Backup — Super Admin only
  const exportFullBackup = async () => {
    setIsBackingUp(true);
    try {
      const res = await fetch('/api/backup', { credentials: 'include' });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Backup failed');
      }

      // Download the JSON file
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Extract filename from Content-Disposition header, or use default
      const contentDisposition = res.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="?(.+?)"?$/);
      const filename = filenameMatch?.[1] || `tarkam-idm-backup-${new Date().toISOString().split('T')[0]}.json`;

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Backup berhasil di-export! 🎉');
    } catch (e: any) {
      toast.error(e.message || 'Gagal mengekspor backup');
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Admin Info */}
      <div className="stagger-item-subtle stagger-d0">
        <Card className={dt.casinoCard}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className={`w-4 h-4 ${dt.text}`} />
              Admin Info
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{adminAuth.admin?.username}</p>
                <p className="text-xs text-muted-foreground">
                  Role: <Badge className="text-xs border-0 bg-idm-gold/10 text-idm-gold">{adminAuth.admin?.role}</Badge>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Session Active</p>
                <div className="flex items-center justify-end gap-1 text-green-500 text-xs">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  Online
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Settings — Persisted via CMS Settings API */}
      <div className="stagger-item-subtle stagger-d1">
        <Card className={dt.casinoCard}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className={`w-4 h-4 ${dt.text}`} />
              Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Auto-refresh Dashboard</p>
                <p className="text-xs text-muted-foreground">Refresh data setiap 30 detik</p>
              </div>
              <Switch
                checked={autoRefresh}
                onCheckedChange={(checked) => saveToggle.mutate({ key: 'admin_auto_refresh', value: String(checked) })}
                disabled={saveToggle.isPending}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Notifikasi Donasi</p>
                <p className="text-xs text-muted-foreground">Tampilkan popup saat ada donasi baru</p>
              </div>
              <Switch
                checked={donationNotif}
                onCheckedChange={(checked) => saveToggle.mutate({ key: 'admin_donation_notif', value: String(checked) })}
                disabled={saveToggle.isPending}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Sound Effects</p>
                <p className="text-xs text-muted-foreground">Efek suara untuk event</p>
              </div>
              <Switch
                checked={soundEffects}
                onCheckedChange={(checked) => saveToggle.mutate({ key: 'admin_sound_effects', value: String(checked) })}
                disabled={saveToggle.isPending}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Log — Real data from /api/admin/audit-logs */}
      <div className="stagger-item-subtle stagger-d2">
        <Card className={dt.casinoCard}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className={`w-4 h-4 ${dt.text}`} />
                Log Aktivitas Admin
                {auditData?.total ? (
                  <Badge className="text-xs border-0 bg-idm-gold-warm/10 text-idm-gold-warm">{auditData.total}</Badge>
                ) : null}
              </CardTitle>
              {/* Filter by entity */}
              <Select value={logFilter} onValueChange={setLogFilter}>
                <SelectTrigger className="w-28 h-8 text-sm">
                  <Filter className="w-3 h-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="player">Player</SelectItem>
                  <SelectItem value="tournament">Turnamen</SelectItem>
                  <SelectItem value="season">Season</SelectItem>
                  <SelectItem value="donation">Donasi</SelectItem>
                  <SelectItem value="match">Match</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="auth">Auth</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingLogs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                Belum ada activity log
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                {displayLogs.map((log) => {
                  const style = ACTION_STYLES[log.action] || { bg: 'bg-muted', text: 'text-muted-foreground', icon: '•' };
                  const entityLabel = ENTITY_LABELS[log.entity] || log.entity;
                  return (
                    <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 ${style.bg} ${style.text}`}>
                        {style.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-medium capitalize">
                            {log.action} {entityLabel}
                          </p>
                          {log.adminName && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-idm-gold-warm/10 text-idm-gold-warm">oleh {log.adminName}</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate mt-0.5">{log.details || '—'}</p>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">
                          {new Date(log.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} · {new Date(log.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {/* Show more/less toggle */}
                {auditLogs.length > 10 && (
                  <button
                    onClick={() => setShowAllLogs(!showAllLogs)}
                    className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showAllLogs ? (
                      <><ChevronUp className="w-3 h-3" />Tampilkan Lebih Sedikit</>
                    ) : (
                      <><ChevronDown className="w-3 h-3" />Lihat Semua ({auditLogs.length})</>
                    )}
                  </button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Data Management — Moved to bottom */}
      <div className="stagger-item-subtle stagger-d3">
        <Card className={dt.casinoCard}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className={`w-4 h-4 ${dt.text}`} />
              Data Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Export Options */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Export Data</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Button variant="outline" size="sm" className="text-xs" onClick={() => exportData('players')} disabled={isExporting}>
                  <Download className="w-3 h-3 mr-1" />Players
                </Button>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => exportData('tournaments')} disabled={isExporting}>
                  <Download className="w-3 h-3 mr-1" />Tournaments
                </Button>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => exportData('all')} disabled={isExporting}>
                  <Download className="w-3 h-3 mr-1" />All Data
                </Button>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => exportToCSV('players')} disabled={isExporting}>
                  <Download className="w-3 h-3 mr-1" />CSV
                </Button>
              </div>
            </div>

            {/* Export Full Backup — Super Admin only */}
            {isSuperAdmin && (
              <div className="pt-3 border-t border-border">
                <Label className="text-xs text-idm-gold-warm mb-2 block flex items-center gap-1">
                  <HardDrive className="w-3 h-3" /> Full Backup
                </Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Export seluruh data (players, clubs, matches, donations, seasons, tournaments, dll.) sebagai file JSON. Hanya Super Admin.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs text-idm-gold-warm border-idm-gold-warm/30 hover:bg-idm-gold-warm/10"
                  onClick={exportFullBackup}
                  disabled={isBackingUp}
                >
                  {isBackingUp ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <HardDrive className="w-3 h-3 mr-1" />
                  )}
                  {isBackingUp ? 'Mengekspor...' : 'Export Backup'}
                </Button>
              </div>
            )}

            {/* Danger Zone — Super Admin only */}
            {isSuperAdmin && (
            <div className="pt-3 border-t border-border">
              <Label className="text-xs text-red-500 mb-2 block flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Danger Zone
              </Label>
              <p className="text-sm text-muted-foreground mb-2">
                Reset semua poin pemain ke 0, hapus data turnamen, match, skin & badge. Data pemain, club, admin, dan CMS tetap aman. Poin dari season completed juga di-nol-kan.
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs text-orange-500 border-orange-500/30 hover:bg-orange-500/10">
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Reset Poin & Turnamen
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset Poin & Turnamen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Semua poin pemain akan direset ke 0 (termasuk poin dari season completed), streak & wins dihapus, seluruh data turnamen/match/donasi akan dihapus, dan skin/badge akan di-reset. Data pemain, club, admin, dan CMS tetap tersimpan. Tindakan ini tidak dapat dibatalkan.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-orange-500 hover:bg-orange-600"
                      onClick={() => resetTournamentData.mutate()}
                    >
                      {resetTournamentData.isPending ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3 mr-1" />
                      )}
                      Reset
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
