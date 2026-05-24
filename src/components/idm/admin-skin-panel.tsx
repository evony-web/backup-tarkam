'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Crown, Star, Gem, Heart, Loader2, X, Search, Award, Shield, Clock, CheckCircle2, XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { SKIN_TYPES, DEFAULT_SKIN_COLORS, parseBadgeColors } from '@/lib/skin-utils';
import type { SkinColors } from '@/lib/skin-utils';

// ============================================
// TYPES
// ============================================

interface Skin {
  id: string;
  type: string;
  displayName: string;
  description: string;
  icon: string;
  colorClass: SkinColors;
  priority: number;
  duration: string;
  isActive: boolean;
}

interface SkinHolder {
  id: string;
  accountId: string;
  skinType: string;
  displayName: string;
  icon: string;
  colorClass: SkinColors;
  priority: number;
  duration: string;
  reason: string | null;
  expiresAt: string | null;
  isExpired: boolean;
  createdAt: string;
  donorBadgeCount?: number;
  player: {
    id: string;
    gamertag: string;
    name: string;
    division: string;
    avatar: string | null;
  };
}

interface PlayerForSearch {
  id: string;
  gamertag: string;
  name: string;
  division: string;
  account?: { id: string } | null;
}

// ============================================
// SKIN THEME CONFIG
// ============================================

const skinThemeConfig: Record<string, {
  accentBg: string;
  accentText: string;
  accentBorder: string;
  swatchBg: string;
  lucideIcon: typeof Crown;
}> = {
  champion: {
    accentBg: 'bg-yellow-500/10',
    accentText: 'text-yellow-400',
    accentBorder: 'border-yellow-500/25',
    swatchBg: 'bg-yellow-500',
    lucideIcon: Crown,
  },
  mvp: {
    accentBg: 'bg-slate-400/10',
    accentText: 'text-muted-foreground',
    accentBorder: 'border-border/30',
    swatchBg: 'bg-slate-300',
    lucideIcon: Star,
  },
  sawer_bronze: {
    accentBg: 'bg-amber-600/10',
    accentText: 'text-amber-600',
    accentBorder: 'border-amber-600/25',
    swatchBg: 'bg-amber-600',
    lucideIcon: Award,
  },
  sawer_silver: {
    accentBg: 'bg-gray-400/10',
    accentText: 'text-muted-foreground',
    accentBorder: 'border-border/30',
    swatchBg: 'bg-gray-400',
    lucideIcon: Award,
  },
  sawer_gold: {
    accentBg: 'bg-yellow-400/10',
    accentText: 'text-yellow-400',
    accentBorder: 'border-yellow-400/25',
    swatchBg: 'bg-yellow-400',
    lucideIcon: Award,
  },
  sawer_diamond: {
    accentBg: 'bg-idm-male/10',
    accentText: 'text-idm-male',
    accentBorder: 'border-idm-male/25',
    swatchBg: 'bg-idm-male',
    lucideIcon: Gem,
  },
  donor: {
    accentBg: 'bg-rose-500/10',
    accentText: 'text-rose-400',
    accentBorder: 'border-rose-500/25',
    swatchBg: 'bg-rose-500',
    lucideIcon: Heart,
  },
};

// ============================================
// COMPONENT
// ============================================

export function AdminSkinPanel() {
  const dt = useDivisionTheme();
  const qc = useQueryClient();

  // State
  const [awardOpen, setAwardOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  // Award form state
  const [awardForm, setAwardForm] = useState({
    skinType: '',
    accountId: '',
    reason: '',
    expiresAt: '',
  });
  const [playerSearch, setPlayerSearch] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerForSearch | null>(null);

  // ============================================
  // QUERIES
  // ============================================

  const { data: skinsData, isLoading: skinsLoading } = useQuery({
    queryKey: ['admin-skins-catalog'],
    queryFn: async () => {
      const res = await fetch('/api/skins', { credentials: 'include' });
      return res.json();
    },
  });

  const { data: holdersData, isLoading: holdersLoading } = useQuery({
    queryKey: ['admin-skin-holders'],
    queryFn: async () => {
      const res = await fetch('/api/skins/holders', { credentials: 'include' });
      return res.json();
    },
  });

  const { data: players } = useQuery({
    queryKey: ['admin-players-all'],
    queryFn: async () => {
      const res = await fetch('/api/players?limit=100', { credentials: 'include' });
      return res.json();
    },
  });

  // ============================================
  // MUTATIONS
  // ============================================

  const awardSkin = useMutation({
    mutationFn: async (data: { accountId: string; skinType: string; reason?: string; expiresAt?: string }) => {
      const res = await fetch('/api/skins/award', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['admin-skin-holders'] });
      toast.success(data.message || 'Skin berhasil diberikan!');
      setAwardOpen(false);
      resetAwardForm();
    },
    onError: (e: Error) => { toast.error(e.message); },
  });

  const revokeSkin = useMutation({
    mutationFn: async (data: { accountId: string; skinType: string }) => {
      const res = await fetch('/api/skins/revoke', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['admin-skin-holders'] });
      toast.success(data.message || 'Skin berhasil dicabut!');
    },
    onError: (e: Error) => { toast.error(e.message); },
  });

  // ============================================
  // HELPERS
  // ============================================

  const resetAwardForm = () => {
    setAwardForm({ skinType: '', accountId: '', reason: '', expiresAt: '' });
    setPlayerSearch('');
    setSelectedPlayer(null);
  };

  const openAwardDialog = (skinType?: string) => {
    setAwardForm(prev => ({
      ...prev,
      skinType: skinType || '',
      accountId: '',
      reason: '',
      expiresAt: '',
    }));
    setPlayerSearch('');
    setSelectedPlayer(null);

    // Default expiry for weekly skins
    if (skinType) {
      const skinDef = SKIN_TYPES[skinType as keyof typeof SKIN_TYPES];
      if (skinDef?.duration === 'weekly') {
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 7);
        setAwardForm(prev => ({
          ...prev,
          expiresAt: expiry.toISOString().slice(0, 16),
        }));
      }
    }

    setAwardOpen(true);
  };

  const handleSelectPlayer = (player: PlayerForSearch) => {
    if (!player.account?.id) {
      toast.error('Player ini belum memiliki akun');
      return;
    }
    setSelectedPlayer(player);
    setAwardForm(prev => ({ ...prev, accountId: player.account!.id }));
    setPlayerSearch('');
  };

  // Filtered players for search
  const filteredPlayers = useMemo(() => {
    if (!playerSearch.trim() || !players) return [];
    const search = playerSearch.toLowerCase();
    return (players as PlayerForSearch[])
      .filter(p =>
        p.gamertag.toLowerCase().includes(search) ||
        p.name.toLowerCase().includes(search)
      )
      .slice(0, 10);
  }, [playerSearch, players]);

  // Active holders only
  const activeHolders = (holdersData?.holders || []).filter((h: SkinHolder) => !h.isExpired);
  const expiredHolders = (holdersData?.holders || []).filter((h: SkinHolder) => h.isExpired);

  const skins: Skin[] = skinsData?.skins || [];

  return (
    <div className="space-y-4">
      {/* ============================
          SECTION 1: SKIN CATALOG
          ============================ */}
      <Card className={dt.casinoCard}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className={`w-4 h-4 ${dt.text}`} />
            Katalog Skin
            <Badge className="text-xs border-0 bg-muted">{skins.length} skin</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {skinsLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {skins.map((skin) => {
                const theme = skinThemeConfig[skin.type];
                if (!theme) return null;
                const LucideIcon = theme.lucideIcon;
                const colors = skin.colorClass || DEFAULT_SKIN_COLORS[skin.type];
                const badgeColors = colors ? parseBadgeColors(colors.badge) : null;

                return (
                  <div
                    key={skin.id}
                    className={`relative p-3 rounded-lg border ${theme.accentBorder} ${skin.isActive ? 'bg-card' : 'bg-muted/30 opacity-60'}`}
                  >
                    {/* Subtle accent glow */}
                    <div
                      className="absolute inset-0 rounded-lg opacity-[0.04]"
                      style={{
                        background: colors?.glow || 'transparent',
                      }}
                    />

                    <div className="relative flex items-start gap-3">
                      {/* Icon */}
                      <div
                        className="w-11 h-11 rounded-lg flex items-center justify-center text-lg shrink-0"
                        style={{
                          background: badgeColors?.bg || 'hsl(var(--muted) / 0.3)',
                        }}
                      >
                        <span className="text-xl">{skin.icon}</span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className={`text-sm font-semibold ${theme.accentText}`}>
                            {skin.displayName}
                          </p>
                          {!skin.isActive && (
                            <Badge className="text-xs border-0 bg-red-500/10 text-red-500">Inactive</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {skin.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {/* Color swatch */}
                          <div className="flex items-center gap-1">
                            <div
                              className="w-3 h-3 rounded-full border border-border"
                              style={{ background: colors?.frame || '#888' }}
                              title="Frame color"
                            />
                            <span className="text-xs text-muted-foreground">Frame</span>
                          </div>

                          {/* Duration badge */}
                          <Badge className={`text-xs border-0 bg-amber-500/10 text-amber-400`}>
                            <Clock className="w-2.5 h-2.5 mr-0.5" />
                            Weekly
                          </Badge>

                          {/* Donor badge indicator */}
                          {skin.type === 'donor' && (
                            <Badge className="text-xs border-0 bg-rose-500/10 text-rose-400">
                              Badge permanen
                            </Badge>
                          )}

                          {/* Priority */}
                          <Badge className="text-xs border-0 bg-muted text-muted-foreground">
                            P{skin.priority}
                          </Badge>
                        </div>
                      </div>

                      {/* Quick Award button */}
                      <Button
                        size="sm"
                        className={`h-8 text-sm ${theme.accentBg} ${theme.accentText} hover:${theme.accentBg} border-0 px-2.5`}
                        onClick={() => openAwardDialog(skin.type)}
                        disabled={!skin.isActive}
                      >
                        <Award className="w-3 h-3 mr-1" />
                        Award
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============================
          SECTION 2: ACTIVE SKIN HOLDERS
          ============================ */}
      <Card className={dt.casinoCard}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Crown className={`w-4 h-4 ${dt.text}`} />
              Pemegang Skin
              <Badge className="text-xs border-0 bg-muted">
                {activeHolders.length} aktif
              </Badge>
            </CardTitle>
            <Button
              size="sm"
              className="h-8 text-sm"
              onClick={() => openAwardDialog()}
            >
              <Award className="w-3 h-3 mr-1" /> Award Skin
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {holdersLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : activeHolders.length === 0 && expiredHolders.length === 0 ? (
            <div className="text-center py-6">
              <Shield className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Belum ada skin yang diberikan</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Active holders */}
              {activeHolders.length > 0 && (
                <div className="space-y-1.5 max-h-96 overflow-y-auto custom-scrollbar">
                  {activeHolders.map((holder: SkinHolder) => {
                    const theme = skinThemeConfig[holder.skinType];
                    const badgeColors = holder.colorClass
                      ? parseBadgeColors(holder.colorClass.badge)
                      : null;

                    return (
                      <div
                        key={holder.id}
                        className={`flex items-center gap-3 p-3 sm:p-4 rounded-lg bg-card border border-border ${theme?.accentBorder || ''}`}
                      >
                        {/* Player info */}
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                            style={{ background: badgeColors?.bg || 'hsl(var(--muted) / 0.3)' }}
                          >
                            {holder.icon}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-medium truncate">{holder.player.gamertag}</p>
                              <Badge className={`text-xs border-0 ${
                                holder.player.division === 'male'
                                  ? 'bg-idm-male/10 text-idm-male'
                                  : 'bg-idm-female/10 text-idm-female'
                              }`}>
                                {holder.player.division === 'male' ? 'M' : 'F'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span className={theme?.accentText}>{holder.displayName}</span>
                              {holder.donorBadgeCount !== undefined && holder.donorBadgeCount > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="text-rose-400">×{holder.donorBadgeCount}</span>
                                </>
                              )}
                              {holder.reason && (
                                <>
                                  <span>•</span>
                                  <span className="truncate max-w-[120px]">{holder.reason}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expiry info */}
                        <div className="shrink-0 text-right">
                          {holder.expiresAt ? (
                            <div className="flex items-center gap-1 text-xs text-amber-400">
                              <Clock className="w-3 h-3" />
                              {new Date(holder.expiresAt).toLocaleDateString('id-ID', {
                                day: 'numeric', month: 'short'
                              })}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-xs text-amber-400">
                              <Clock className="w-3 h-3" />
                              Weekly
                            </div>
                          )}
                        </div>

                        {/* Revoke button */}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 touch-icon text-red-500 hover:text-red-400 hover:bg-red-500/10 shrink-0"
                          onClick={() => setConfirmDialog({
                            open: true,
                            title: 'Cabut Skin?',
                            description: `Cabut skin "${holder.displayName}" dari ${holder.player.gamertag}. Tindakan ini tidak dapat dibatalkan.`,
                            onConfirm: () => revokeSkin.mutate({
                              accountId: holder.accountId,
                              skinType: holder.skinType,
                            }),
                          })}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Expired holders (collapsed) */}
              {expiredHolders.length > 0 && (
                <details className="group">
                  <summary className="text-sm text-muted-foreground cursor-pointer flex items-center gap-1 hover:text-foreground transition-colors">
                    <XCircle className="w-3 h-3" />
                    {expiredHolders.length} skin sudah expired
                    <span className="group-open:hidden">▸</span>
                    <span className="hidden group-open:inline">▾</span>
                  </summary>
                  <div className="mt-1.5 space-y-1 opacity-50">
                    {expiredHolders.map((holder: SkinHolder) => (
                      <div
                        key={holder.id}
                        className="flex items-center gap-2 p-3 sm:p-4 rounded-lg bg-muted/20 text-sm"
                      >
                        <span>{holder.icon}</span>
                        <span className="font-medium">{holder.player.gamertag}</span>
                        <span className="text-muted-foreground">{holder.displayName}</span>
                        <span className="text-red-400 ml-auto">Expired</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============================
          AWARD SKIN DIALOG
          ============================ */}
      <Dialog open={awardOpen} onOpenChange={(open) => { setAwardOpen(open); if (!open) resetAwardForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-idm-gold-warm" />
              Berikan Skin ke Player
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Skin Type Selector */}
            <div>
              <Label className="text-xs text-muted-foreground">Tipe Skin</Label>
              <Select
                value={awardForm.skinType}
                onValueChange={(val) => {
                  setAwardForm(prev => ({ ...prev, skinType: val }));
                  // Auto-set default expiry for weekly skins
                  const skinDef = SKIN_TYPES[val as keyof typeof SKIN_TYPES];
                  if (skinDef?.duration === 'weekly') {
                    const expiry = new Date();
                    expiry.setDate(expiry.getDate() + 7);
                    setAwardForm(prev => ({ ...prev, expiresAt: expiry.toISOString().slice(0, 16) }));
                  } else {
                    setAwardForm(prev => ({ ...prev, expiresAt: '' }));
                  }
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pilih tipe skin..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SKIN_TYPES).map(([key, def]) => {
                    const theme = skinThemeConfig[key];
                    return (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <span>{def.icon}</span>
                          <span>{def.displayName}</span>
                          <span className="text-sm text-muted-foreground">
                            (Weekly, P{def.priority})
                          </span>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Selected skin preview */}
            {awardForm.skinType && (() => {
              const skinDef = SKIN_TYPES[awardForm.skinType as keyof typeof SKIN_TYPES];
              const theme = skinThemeConfig[awardForm.skinType];
              if (!skinDef || !theme) return null;
              return (
                <div className={`p-3 rounded-lg border ${theme.accentBorder} ${theme.accentBg}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                      style={{ background: 'hsl(var(--muted) / 0.3)' }}
                    >
                      {skinDef.icon}
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${theme.accentText}`}>{skinDef.displayName}</p>
                      <p className="text-sm text-muted-foreground">
                        Priority {skinDef.priority} • Weekly (7 hari)
                      </p>
                      {skinDef.type === 'donor' && (
                        <p className="text-xs text-rose-400 mt-0.5">
                          Badge hati permanen (+1 donasi count)
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Player Search */}
            <div>
              <Label className="text-xs text-muted-foreground">Cari Player (by nickname/nama)</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Ketik nickname atau nama..."
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Search results */}
              {playerSearch.trim() && filteredPlayers.length > 0 && (
                <div className="mt-1.5 space-y-1 max-h-40 overflow-y-auto">
                  {filteredPlayers.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between p-3 sm:p-4 rounded-lg cursor-pointer transition-colors ${
                        selectedPlayer?.id === p.id
                          ? 'bg-idm-gold-warm/15 border border-idm-gold-warm/30'
                          : 'bg-muted/30 hover:bg-muted/50 border border-transparent'
                      }`}
                      onClick={() => handleSelectPlayer(p)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs">
                          {p.division === 'male' ? 'M' : 'F'}
                        </div>
                        <div>
                          <p className="text-xs font-medium">{p.gamertag}</p>
                          <p className="text-sm text-muted-foreground">{p.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {p.account?.id ? (
                          <Badge className="text-xs border-0 bg-emerald-500/10 text-emerald-400">
                            <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> Ada Akun
                          </Badge>
                        ) : (
                          <Badge className="text-xs border-0 bg-red-500/10 text-red-400">
                            <XCircle className="w-2.5 h-2.5 mr-0.5" /> Tanpa Akun
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* No results */}
              {playerSearch.trim() && filteredPlayers.length === 0 && (
                <p className="text-sm text-muted-foreground mt-1.5">Tidak ada player ditemukan</p>
              )}

              {/* Selected player */}
              {selectedPlayer && (
                <div className="mt-2 p-3 sm:p-4 rounded-lg bg-idm-gold-warm/10 border border-idm-gold-warm/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-idm-gold-warm/20 flex items-center justify-center text-sm">
                        {selectedPlayer.division === 'male' ? 'M' : 'F'}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{selectedPlayer.gamertag}</p>
                        <p className="text-sm text-muted-foreground">{selectedPlayer.name}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        setSelectedPlayer(null);
                        setAwardForm(prev => ({ ...prev, accountId: '' }));
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Reason */}
            <div>
              <Label className="text-xs text-muted-foreground">Alasan (opsional)</Label>
              <Input
                placeholder="Contoh: Juara 1 Week 5, MVP Week 3..."
                value={awardForm.reason}
                onChange={(e) => setAwardForm(prev => ({ ...prev, reason: e.target.value }))}
                className="mt-1"
              />
            </div>

            {/* Expiry Date — always shown since all skins are weekly */}
            {awardForm.skinType && (
              <div>
                <Label className="text-xs text-muted-foreground">
                  Tanggal Expired (default: 7 hari)
                  {awardForm.skinType === 'donor' && (
                    <span className="text-rose-400 ml-1">• Badge tetap permanen</span>
                  )}
                </Label>
                <Input
                  type="datetime-local"
                  value={awardForm.expiresAt}
                  onChange={(e) => setAwardForm(prev => ({ ...prev, expiresAt: e.target.value }))}
                  className="mt-1"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setAwardOpen(false); resetAwardForm(); }}>
              Batal
            </Button>
            <Button
              onClick={() => {
                if (!awardForm.accountId) {
                  toast.error('Pilih player terlebih dahulu');
                  return;
                }
                if (!awardForm.skinType) {
                  toast.error('Pilih tipe skin terlebih dahulu');
                  return;
                }
                awardSkin.mutate({
                  accountId: awardForm.accountId,
                  skinType: awardForm.skinType,
                  reason: awardForm.reason || undefined,
                  expiresAt: awardForm.expiresAt || undefined,
                });
              }}
              disabled={!awardForm.accountId || !awardForm.skinType || awardSkin.isPending}
            >
              {awardSkin.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              <Award className="w-4 h-4 mr-1" />
              Berikan Skin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
