'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield, Users, Plus, Trash2, Loader2, Crown, UserCog,
  Eye, EyeOff, Save, KeyRound, X, Edit3, AlertTriangle, Lock
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';

interface AdminUser {
  id: string;
  username: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export function AdminManagement() {
  const { adminAuth } = useAppStore();
  const qc = useQueryClient();
  const currentAdmin = adminAuth.admin;
  const isSuperAdmin = currentAdmin?.role === 'super_admin';

  // State
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    admin: AdminUser | null;
  }>({ open: false, admin: null });
  const [resetPasswordDialog, setResetPasswordDialog] = useState<{
    open: boolean;
    admin: AdminUser | null;
  }>({ open: false, admin: null });

  // Add form
  const [addForm, setAddForm] = useState({ username: '', password: '', role: 'admin' });
  const [showAddPassword, setShowAddPassword] = useState(false);

  // Edit form
  const [editForm, setEditForm] = useState<AdminUser | null>(null);

  // Reset password form (for super admin resetting others)
  const [resetForm, setResetForm] = useState({ newPassword: '', confirmPassword: '' });
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Change own password form
  const [changePwForm, setChangePwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showChangePwCurrent, setShowChangePwCurrent] = useState(false);
  const [showChangePwNew, setShowChangePwNew] = useState(false);

  // Fetch admins (super_admin only)
  const { data: adminsData, isLoading } = useQuery({
    queryKey: ['admins'],
    queryFn: async () => {
      const res = await fetch('/api/admins', { credentials: 'include' });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Gagal mengambil data admin');
      }
      return res.json() as Promise<{ admins: AdminUser[] }>;
    },
    enabled: isSuperAdmin,
  });

  const admins = adminsData?.admins || [];

  // Create admin mutation
  const createAdmin = useMutation({
    mutationFn: async (data: { username: string; password: string; role: string }) => {
      const res = await fetch('/api/admins', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admins'] });
      toast.success('Admin berhasil ditambahkan!');
      setAddDialogOpen(false);
      setAddForm({ username: '', password: '', role: 'admin' });
      setShowAddPassword(false);
    },
    onError: (e: Error) => { toast.error(e.message); },
  });

  // Update admin mutation
  const updateAdmin = useMutation({
    mutationFn: async (data: { id: string; username?: string; role?: string }) => {
      const res = await fetch('/api/admins', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admins'] });
      toast.success('Admin berhasil diperbarui!');
      setEditDialogOpen(false);
      setEditForm(null);
    },
    onError: (e: Error) => { toast.error(e.message); },
  });

  // Delete admin mutation
  const deleteAdmin = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch('/api/admins', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admins'] });
      toast.success('Admin berhasil dihapus!');
      setDeleteDialog({ open: false, admin: null });
    },
    onError: (e: Error) => { toast.error(e.message); },
  });

  // Reset password mutation (super_admin resetting other admin's password)
  const resetPassword = useMutation({
    mutationFn: async (data: { adminId: string; newPassword: string }) => {
      const res = await fetch('/api/admins/reset-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admins'] });
      toast.success('Password berhasil direset!');
      setResetPasswordDialog({ open: false, admin: null });
      setResetForm({ newPassword: '', confirmPassword: '' });
    },
    onError: (e: Error) => { toast.error(e.message); },
  });

  // Change own password mutation
  const changeOwnPassword = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Password berhasil diubah!');
      setChangePwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (e: Error) => { toast.error(e.message); },
  });

  const handleChangeOwnPassword = () => {
    if (changePwForm.newPassword !== changePwForm.confirmPassword) {
      toast.error('Konfirmasi password tidak cocok');
      return;
    }
    if (changePwForm.newPassword.length < 6) {
      toast.error('Password baru minimal 6 karakter');
      return;
    }
    changeOwnPassword.mutate({
      currentPassword: changePwForm.currentPassword,
      newPassword: changePwForm.newPassword,
    });
  };

  return (
    <div className="space-y-4">
      {/* ====== CHANGE OWN PASSWORD CARD (visible to ALL admins) ====== */}
      <Card className="border border-border">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-idm-gold-warm" />
            <h3 className="text-sm font-semibold">Ganti Password</h3>
            <Badge className="text-xs border-0 bg-idm-gold-warm/10 text-idm-gold-warm">{currentAdmin?.username}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Password Lama</Label>
              <div className="relative">
                <Input
                  type={showChangePwCurrent ? 'text' : 'password'}
                  value={changePwForm.currentPassword}
                  onChange={(e) => setChangePwForm(p => ({ ...p, currentPassword: e.target.value }))}
                  placeholder="Masukkan password lama"
                  className="h-9 text-xs pr-9"
                  disabled={changeOwnPassword.isPending}
                />
                <button
                  type="button"
                  onClick={() => setShowChangePwCurrent(!showChangePwCurrent)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showChangePwCurrent ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Password Baru</Label>
              <div className="relative">
                <Input
                  type={showChangePwNew ? 'text' : 'password'}
                  value={changePwForm.newPassword}
                  onChange={(e) => setChangePwForm(p => ({ ...p, newPassword: e.target.value }))}
                  placeholder="Min. 6 karakter"
                  className="h-9 text-xs pr-9"
                  disabled={changeOwnPassword.isPending}
                />
                <button
                  type="button"
                  onClick={() => setShowChangePwNew(!showChangePwNew)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showChangePwNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Konfirmasi</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="password"
                  value={changePwForm.confirmPassword}
                  onChange={(e) => setChangePwForm(p => ({ ...p, confirmPassword: e.target.value }))}
                  placeholder="Ulangi password baru"
                  className="h-9 text-xs"
                  disabled={changeOwnPassword.isPending}
                />
                <Button
                  size="sm"
                  className="h-9 bg-idm-gold-warm hover:bg-[#D69E2E] text-black shrink-0"
                  disabled={
                    changeOwnPassword.isPending ||
                    !changePwForm.currentPassword ||
                    !changePwForm.newPassword ||
                    !changePwForm.confirmPassword ||
                    changePwForm.newPassword.length < 6
                  }
                  onClick={handleChangeOwnPassword}
                >
                  {changeOwnPassword.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                </Button>
              </div>
            </div>
          </div>
          {changePwForm.newPassword && changePwForm.confirmPassword && changePwForm.newPassword !== changePwForm.confirmPassword && (
            <p className="text-sm text-red-500">Konfirmasi password tidak cocok</p>
          )}
        </CardContent>
      </Card>

      {/* ====== ADMIN LIST (super_admin only) ====== */}
      {isSuperAdmin ? (
        <>
          <Separator />

          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCog className="w-5 h-5 text-idm-gold-warm" />
              <h3 className="text-sm font-semibold">Daftar Admin</h3>
              <Badge className="bg-idm-gold-warm/10 text-idm-gold-warm text-sm border-0">
                {admins.length} admin
              </Badge>
            </div>
            <Button
              size="sm"
              onClick={() => setAddDialogOpen(true)}
              className="bg-idm-gold-warm hover:bg-[#D69E2E] text-black"
            >
              <Plus className="w-3 h-3 mr-1" /> Tambah Admin
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-idm-gold-warm" />
            </div>
          ) : (
            <div className="space-y-2">
              {admins.map((admin, index) => (
                <div
                  key={admin.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-card border border-border"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      admin.role === 'super_admin'
                        ? 'bg-yellow-500/10 border border-yellow-500/20'
                        : 'bg-idm-gold-warm/10 border border-idm-gold-warm/20'
                    }`}>
                      {admin.role === 'super_admin' ? (
                        <Crown className="w-4 h-4 text-yellow-500" />
                      ) : (
                        <Shield className="w-4 h-4 text-idm-gold-warm" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{admin.username}</p>
                        <Badge className={`text-xs border-0 ${
                          admin.role === 'super_admin'
                            ? 'bg-yellow-500/10 text-yellow-500'
                            : 'bg-idm-gold-warm/10 text-idm-gold-warm'
                        }`}>
                          {admin.role === 'super_admin' ? 'SUPER ADMIN' : 'ADMIN'}
                        </Badge>
                        {admin.id === currentAdmin?.id && (
                          <Badge className="text-xs border-0 bg-green-500/10 text-green-500">ANDA</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Bergabung {new Date(admin.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-blue-500 hover:text-blue-400 hover:bg-blue-500/10"
                      onClick={() => {
                        setEditForm(admin);
                        setEditDialogOpen(true);
                      }}
                      title="Edit admin"
                    >
                      <Edit3 className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-orange-500 hover:text-orange-400 hover:bg-orange-500/10"
                      onClick={() => {
                        setResetPasswordDialog({ open: true, admin });
                        setResetForm({ newPassword: '', confirmPassword: '' });
                      }}
                      title="Reset password"
                    >
                      <KeyRound className="w-3 h-3" />
                    </Button>
                    {admin.id !== currentAdmin?.id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => setDeleteDialog({ open: true, admin })}
                        title="Hapus admin"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {admins.length === 0 && (
                <div className="py-8 text-center border border-dashed border-border rounded-lg">
                  <Users className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Belum ada admin terdaftar</p>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <Card className="border border-border bg-muted/30">
          <CardContent className="p-4 text-center">
            <Lock className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">
              Manajemen admin lain hanya tersedia untuk Super Admin
            </p>
          </CardContent>
        </Card>
      )}

      {/* ====== ADD ADMIN DIALOG ====== */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="w-4 h-4 text-idm-gold-warm" /> Tambah Admin Baru
            </DialogTitle>
            <DialogDescription>
              Buat akun admin baru untuk membantu mengelola aplikasi
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Username</Label>
              <Input
                value={addForm.username}
                onChange={(e) => setAddForm(p => ({ ...p, username: e.target.value }))}
                placeholder="Minimal 3 karakter"
                className="h-10"
                disabled={createAdmin.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Password</Label>
              <div className="relative">
                <Input
                  type={showAddPassword ? 'text' : 'password'}
                  value={addForm.password}
                  onChange={(e) => setAddForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="Minimal 6 karakter"
                  className="h-10 pr-10"
                  disabled={createAdmin.isPending}
                />
                <button
                  type="button"
                  onClick={() => setShowAddPassword(!showAddPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showAddPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Role</Label>
              <Select
                value={addForm.role}
                onValueChange={(value) => setAddForm(p => ({ ...p, role: value }))}
                disabled={createAdmin.isPending}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="w-3 h-3" /> Admin — Kelola data turnamen & liga
                    </div>
                  </SelectItem>
                  <SelectItem value="super_admin">
                    <div className="flex items-center gap-2">
                      <Crown className="w-3 h-3" /> Super Admin — Akses penuh termasuk manajemen admin
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddDialogOpen(false)}
              disabled={createAdmin.isPending}
            >
              Batal
            </Button>
            <Button
              size="sm"
              className="bg-idm-gold-warm hover:bg-[#D69E2E] text-black"
              disabled={createAdmin.isPending || !addForm.username || !addForm.password || addForm.username.length < 3 || addForm.password.length < 6}
              onClick={() => createAdmin.mutate(addForm)}
            >
              {createAdmin.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
              Buat Admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== EDIT ADMIN DIALOG ====== */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-idm-gold-warm" /> Edit Admin
            </DialogTitle>
            <DialogDescription>
              Ubah username atau role admin
            </DialogDescription>
          </DialogHeader>
          {editForm && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Username</Label>
                <Input
                  value={editForm.username}
                  onChange={(e) => setEditForm(p => p ? { ...p, username: e.target.value } : p)}
                  className="h-10"
                  disabled={updateAdmin.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Role</Label>
                <Select
                  value={editForm.role}
                  onValueChange={(value) => setEditForm(p => p ? { ...p, role: value } : p)}
                  disabled={updateAdmin.isPending || editForm.id === currentAdmin?.id}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Shield className="w-3 h-3" /> Admin
                      </div>
                    </SelectItem>
                    <SelectItem value="super_admin">
                      <div className="flex items-center gap-2">
                        <Crown className="w-3 h-3" /> Super Admin
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {editForm.id === currentAdmin?.id && (
                  <p className="text-sm text-muted-foreground">Anda tidak dapat mengubah role akun sendiri</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setEditDialogOpen(false); setEditForm(null); }}
              disabled={updateAdmin.isPending}
            >
              Batal
            </Button>
            <Button
              size="sm"
              className="bg-idm-gold-warm hover:bg-[#D69E2E] text-black"
              disabled={updateAdmin.isPending || !editForm?.username}
              onClick={() => {
                if (editForm) {
                  updateAdmin.mutate({
                    id: editForm.id,
                    username: editForm.username,
                    role: editForm.role,
                  });
                }
              }}
            >
              {updateAdmin.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== RESET PASSWORD DIALOG ====== */}
      <Dialog
        open={resetPasswordDialog.open}
        onOpenChange={(open) => {
          setResetPasswordDialog({ open, admin: resetPasswordDialog.admin });
          if (!open) setResetForm({ newPassword: '', confirmPassword: '' });
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-idm-gold-warm" /> Reset Password
            </DialogTitle>
            <DialogDescription>
              Reset password untuk admin <strong>{resetPasswordDialog.admin?.username}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Password Baru</Label>
              <div className="relative">
                <Input
                  type={showResetPassword ? 'text' : 'password'}
                  value={resetForm.newPassword}
                  onChange={(e) => setResetForm(p => ({ ...p, newPassword: e.target.value }))}
                  placeholder="Minimal 6 karakter"
                  className="h-10 pr-10"
                  disabled={resetPassword.isPending}
                />
                <button
                  type="button"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Konfirmasi Password Baru</Label>
              <Input
                type="password"
                value={resetForm.confirmPassword}
                onChange={(e) => setResetForm(p => ({ ...p, confirmPassword: e.target.value }))}
                placeholder="Ulangi password baru"
                className="h-10"
                disabled={resetPassword.isPending}
              />
            </div>
            {resetForm.newPassword && resetForm.confirmPassword && resetForm.newPassword !== resetForm.confirmPassword && (
              <p className="text-sm text-red-500">Password tidak cocok</p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResetPasswordDialog({ open: false, admin: null })}
              disabled={resetPassword.isPending}
            >
              Batal
            </Button>
            <Button
              size="sm"
              className="bg-idm-gold-warm hover:bg-[#D69E2E] text-black"
              disabled={
                resetPassword.isPending ||
                !resetForm.newPassword ||
                resetForm.newPassword.length < 6 ||
                resetForm.newPassword !== resetForm.confirmPassword
              }
              onClick={() => {
                if (resetPasswordDialog.admin) {
                  resetPassword.mutate({
                    adminId: resetPasswordDialog.admin.id,
                    newPassword: resetForm.newPassword,
                  });
                }
              }}
            >
              {resetPassword.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <KeyRound className="w-3 h-3 mr-1" />}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== DELETE CONFIRM DIALOG ====== */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, admin: open ? deleteDialog.admin : null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Admin?</AlertDialogTitle>
            <AlertDialogDescription>
              Admin <strong>{deleteDialog.admin?.username}</strong> akan dihapus secara permanen.
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (deleteDialog.admin) {
                  deleteAdmin.mutate(deleteDialog.admin.id);
                }
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
