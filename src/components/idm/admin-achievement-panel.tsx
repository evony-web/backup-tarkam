'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AvatarMedia } from '@/components/ui/avatar-media';

import {
  Award, Plus, Pencil, Trash2, Users, Loader2, X, Star, Zap, Search, XCircle
} from 'lucide-react';
import Image from 'next/image';
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

interface Achievement {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  icon: string;
  tier: string;
  criteria: string;
  rewardPoints: number;
  isActive: boolean;
  _count?: {
    playerAchievements: number;
  };
}

interface PlayerWithAchievements {
  id: string;
  gamertag: string;
  name: string;
  avatar: string | null;
  division: string;
  _count?: {
    achievements: number;
  };
}

const categoryIcons: Record<string, typeof Award> = {
  tournament: Award,
  mvp: Star,
  points: Zap,
  club: Users,
};

const tierColors: Record<string, string> = {
  bronze: 'bg-amber-700 text-white',
  silver: 'bg-slate-400 text-white',
  gold: 'bg-amber-500 text-white',
  platinum: 'bg-gradient-to-r from-slate-300 to-cyan-200 text-slate-800',
  diamond: 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white',
};

export function AdminAchievementPanel() {
  const dt = useDivisionTheme();
  const qc = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [playerSearch, setPlayerSearch] = useState('');
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    description: '',
    category: 'tournament',
    icon: '🏆',
    tier: 'bronze',
    criteria: '',
    rewardPoints: 0,
  });

  // Fetch achievements
  const { data: achievements, isLoading } = useQuery({
    queryKey: ['admin-achievements'],
    queryFn: async () => {
      const res = await fetch('/api/achievements', { credentials: 'include' });
      return res.json();
    },
  });

  // Fetch players for assignment
  const { data: players } = useQuery({
    queryKey: ['admin-players-all'],
    queryFn: async () => {
      const res = await fetch('/api/players?limit=100', { credentials: 'include' });
      return res.json();
    },
  });

  // Fetch players who already have the selected achievement (for revoke section)
  const { data: existingHolders } = useQuery({
    queryKey: ['achievement-holders', selectedAchievement?.id],
    queryFn: async () => {
      if (!selectedAchievement) return { playerAchievements: [] };
      const res = await fetch(`/api/players/achievements?achievementId=${selectedAchievement.id}`, { credentials: 'include' });
      return res.json();
    },
    enabled: !!selectedAchievement,
  });

  // Create/Update achievement
  const saveAchievement = useMutation({
    mutationFn: async (data: Partial<Achievement> & { id?: string }) => {
      // PUT handler is at /api/achievements (reads id from body), NOT /api/achievements/[id]
      const url = '/api/achievements';
      const method = data.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Gagal menyimpan achievement'); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-achievements'] });
      toast.success('Achievement berhasil disimpan!');
      setFormOpen(false);
      setSelectedAchievement(null);
      setFormData({ name: '', displayName: '', description: '', category: 'tournament', icon: '🏆', tier: 'bronze', criteria: '', rewardPoints: 0 });
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Gagal menyimpan achievement');
    },
  });

  // Delete achievement
  const deleteAchievement = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/achievements?id=${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-achievements'] });
      toast.success('Achievement berhasil dihapus!');
    },
  });

  // Toggle active status
  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/achievements/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-achievements'] });
      toast.success('Status achievement diperbarui!');
    },
  });

  // Assign achievement to player
  const assignAchievement = useMutation({
    mutationFn: async ({ playerId, achievementId }: { playerId: string; achievementId: string }) => {
      const res = await fetch('/api/players/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ playerId, achievementId }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-achievements'] });
      qc.invalidateQueries({ queryKey: ['admin-players-all'] });
      toast.success('Achievement berhasil diberikan!');
    },
  });

  // Revoke achievement from player
  const revokeAchievement = useMutation({
    mutationFn: async ({ playerId, achievementId }: { playerId: string; achievementId: string }) => {
      const res = await fetch(`/api/players/achievements?playerId=${playerId}&achievementId=${achievementId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-achievements'] });
      qc.invalidateQueries({ queryKey: ['admin-players-all'] });
      toast.success('Achievement berhasil dicabut!');
    },
  });

  // Filter achievements
  const filteredAchievements = (achievements?.achievements || [])
    .filter((a: Achievement) => {
      const matchesSearch = a.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || a.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });

  // Group by category
  const groupedAchievements = filteredAchievements.reduce((acc: Record<string, Achievement[]>, achievement: Achievement) => {
    const cat = achievement.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(achievement);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1">
          <Input
            placeholder="Cari achievement..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-xs"
          />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="tournament">Tournament</SelectItem>
              <SelectItem value="mvp">MVP</SelectItem>
              <SelectItem value="points">Points</SelectItem>
              <SelectItem value="club">Club</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAssignOpen(true)}>
            <Users className="w-4 h-4 mr-1" /> Assign
          </Button>
          <Button onClick={() => {
            setSelectedAchievement(null);
            setFormData({ name: '', displayName: '', description: '', category: 'tournament', icon: '🏆', tier: 'bronze', criteria: '', rewardPoints: 0 });
            setFormOpen(true);
          }}>
            <Plus className="w-4 h-4 mr-1" /> Tambah
          </Button>
        </div>
      </div>

      {/* Achievements List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedAchievements).map(([category, catAchievements], i) => {
            const CatIcon = categoryIcons[category] || Award;
            return (
              <div key={category} style={{ animationDelay: `${i * 30}ms` }}>
                <Card className={dt.casinoCard}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 capitalize">
                      <CatIcon className={`w-4 h-4 ${dt.text}`} />
                      {category} Achievements
                      <Badge className="text-xs border-0 bg-muted">{(catAchievements as Achievement[]).length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(catAchievements as Achievement[]).map((achievement: Achievement) => (
                        <div
                          key={achievement.id}
                          className={`p-3 rounded-lg border ${achievement.isActive ? 'bg-card border-border' : 'bg-muted/30 border-border opacity-60'}`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Icon */}
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${tierColors[achievement.tier] || 'bg-muted'}`}>
                              {achievement.icon}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <p className="text-sm font-medium truncate">{achievement.displayName}</p>
                                {!achievement.isActive && (
                                  <Badge className="text-xs border-0 bg-red-500/10 text-red-500">Inactive</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-1">{achievement.description}</p>
                              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                <Badge className={`text-xs border-0 ${tierColors[achievement.tier] || ''}`}>
                                  {achievement.tier}
                                </Badge>
                                {achievement.rewardPoints > 0 && (
                                  <span className="text-green-500">+{achievement.rewardPoints} pts</span>
                                )}
                                <span>•</span>
                                <span>{achievement._count?.playerAchievements || 0} earned</span>
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-border">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-sm"
                              onClick={() => toggleActive.mutate({ id: achievement.id, isActive: !achievement.isActive })}
                            >
                              {achievement.isActive ? 'Deactivate' : 'Activate'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 touch-icon"
                              onClick={() => {
                                setSelectedAchievement(achievement);
                                setFormData({
                                  name: achievement.name,
                                  displayName: achievement.displayName,
                                  description: achievement.description,
                                  category: achievement.category,
                                  icon: achievement.icon,
                                  tier: achievement.tier,
                                  criteria: achievement.criteria,
                                  rewardPoints: achievement.rewardPoints,
                                });
                                setFormOpen(true);
                              }}
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 touch-icon text-red-500 hover:text-red-400 hover:bg-red-500/10"
                              onClick={() => setConfirmDialog({
                                open: true,
                                title: 'Hapus Achievement?',
                                description: `Hapus "${achievement.displayName}". Tindakan ini tidak dapat dibatalkan.`,
                                onConfirm: () => deleteAchievement.mutate(achievement.id),
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
            );
          })}

          {filteredAchievements.length === 0 && (
            <Card className={dt.casinoCard}>
              <CardContent className="py-8 text-center">
                <Award className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Belum ada achievement ditemukan</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Achievement Form Dialog - Full Implementation */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedAchievement ? 'Edit Achievement' : 'Tambah Achievement'}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-1">
                <Label className="text-xs text-muted-foreground">Nama Internal</Label>
                <Input
                  placeholder="weekly_champion"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div className="col-span-1">
                <Label className="text-xs text-muted-foreground">Display Name</Label>
                <Input
                  placeholder="Weekly Champion"
                  value={formData.displayName}
                  onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Deskripsi</Label>
              <Textarea
                placeholder="Deskripsi achievement..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="mt-1"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Kategori</Label>
                <Select value={formData.category} onValueChange={(val) => setFormData(prev => ({ ...prev, category: val }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tournament">Tournament</SelectItem>
                    <SelectItem value="mvp">MVP</SelectItem>
                    <SelectItem value="points">Points</SelectItem>
                    <SelectItem value="club">Club</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Tier</Label>
                <Select value={formData.tier} onValueChange={(val) => setFormData(prev => ({ ...prev, tier: val }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bronze">Bronze</SelectItem>
                    <SelectItem value="silver">Silver</SelectItem>
                    <SelectItem value="gold">Gold</SelectItem>
                    <SelectItem value="platinum">Platinum</SelectItem>
                    <SelectItem value="diamond">Diamond</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Icon (Emoji)</Label>
                <Input
                  placeholder="🏆"
                  value={formData.icon}
                  onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Reward Points</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.rewardPoints}
                  onChange={(e) => setFormData(prev => ({ ...prev, rewardPoints: parseInt(e.target.value) || 0 }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Criteria (JSON)</Label>
                <Input
                  placeholder='{"type":"wins","count":1}'
                  value={formData.criteria}
                  onChange={(e) => setFormData(prev => ({ ...prev, criteria: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
            {/* Preview */}
            <div className="p-3 rounded-lg border border-border bg-muted/20">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${tierColors[formData.tier] || 'bg-muted'}`}>
                  {formData.icon || '🏆'}
                </div>
                <div>
                  <p className="text-sm font-medium">{formData.displayName || 'Nama Achievement'}</p>
                  <p className="text-sm text-muted-foreground">{formData.description || 'Deskripsi...'}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-sm">
                    <Badge className={`text-xs border-0 ${tierColors[formData.tier] || ''}`}>{formData.tier}</Badge>
                    {formData.rewardPoints > 0 && <span className="text-green-500">+{formData.rewardPoints} pts</span>}
                    <Badge className="text-xs border-0 bg-muted capitalize">{formData.category}</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button
              onClick={() => {
                const payload: Record<string, unknown> = { ...formData };
                if (selectedAchievement) payload.id = selectedAchievement.id;
                saveAchievement.mutate(payload as Partial<Achievement> & { id?: string });
              }}
              disabled={!formData.name || !formData.displayName || saveAchievement.isPending}
            >
              {saveAchievement.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {selectedAchievement ? 'Simpan' : 'Buat Achievement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Achievement Dialog */}
      <Dialog open={assignOpen} onOpenChange={(open) => { setAssignOpen(open); if (!open) { setPlayerSearch(''); setSelectedAchievement(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Achievement ke Player</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Achievement selector */}
            <div>
              <Label className="text-xs text-muted-foreground">Pilih Achievement</Label>
              <Select onValueChange={(val) => setSelectedAchievement(
                achievements?.achievements?.find((a: Achievement) => a.id === val)
              )}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pilih achievement..." />
                </SelectTrigger>
                <SelectContent>
                  {(achievements?.achievements || []).map((a: Achievement) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="flex items-center gap-2">
                        <span>{a.icon}</span>
                        <span>{a.displayName}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Players who already have this achievement (revoke section) */}
            {selectedAchievement && (existingHolders?.playerAchievements || []).length > 0 && (
              <div className="p-3 rounded-lg border border-border bg-red-500/5">
                <Label className="text-xs text-red-500 font-medium">
                  Sudah Punya ({(existingHolders?.playerAchievements || []).length} player)
                </Label>
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {(existingHolders?.playerAchievements || []).map((pa: { id: string; playerId: string; player?: { gamertag: string; name: string; avatar: string | null } }) => (
                    <div
                      key={pa.id}
                      className="flex items-center justify-between p-1.5 rounded-md bg-red-500/5"
                    >
                      <span className="text-xs truncate">{pa.player?.gamertag || pa.playerId}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-sm text-red-500 hover:text-red-400 hover:bg-red-500/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          revokeAchievement.mutate({
                            playerId: pa.playerId,
                            achievementId: selectedAchievement.id,
                          });
                        }}
                        disabled={revokeAchievement.isPending}
                      >
                        <Trash2 className="w-3 h-3 mr-1" /> Cabut
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Players list with search */}
            <div>
              <Label className="text-xs text-muted-foreground">Pilih Player</Label>
              <div className="relative mt-1 mb-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Cari nickname atau nama..."
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
                {playerSearch && (
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setPlayerSearch('')}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {(players || [])
                  .filter((p: PlayerWithAchievements) => {
                    if (!playerSearch) return true;
                    const q = playerSearch.toLowerCase();
                    return (
                      p.gamertag.toLowerCase().includes(q) ||
                      p.name.toLowerCase().includes(q)
                    );
                  })
                  .map((p: PlayerWithAchievements) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer"
                    onClick={() => {
                      if (selectedAchievement) {
                        assignAchievement.mutate({
                          playerId: p.id,
                          achievementId: selectedAchievement.id,
                        });
                      } else {
                        toast.error('Pilih achievement terlebih dahulu');
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-muted overflow-hidden">
                        {p.avatar ? (
                          <AvatarMedia src={p.avatar} alt={p.gamertag} width={32} height={32} className="w-full h-full" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs">👤</div>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium">{p.gamertag}</p>
                        <p className="text-sm text-muted-foreground">{p.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="text-xs border-0 bg-muted">
                        {p._count?.achievements || 0} 🏆
                      </Badge>
                      <Button size="sm" variant="ghost" className="h-8 text-sm">
                        Assign
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Tutup</Button>
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
