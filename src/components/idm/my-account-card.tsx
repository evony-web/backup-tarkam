'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  LogOut, Settings, Shield, Trophy, Crown, Flame,
  ChevronRight, Gamepad2, Star, Sparkles, KeyRound,
  Eye, EyeOff, Loader2, Lock, X,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SkinBadgesRow, SkinAvatarFrame, SkinName } from './skin-renderer';
import { getPrimarySkin } from '@/lib/skin-utils';
import { getAvatarUrl, clubToString } from '@/lib/utils';
import { AvatarMedia } from '@/components/ui/avatar-media';
import { toast } from 'sonner';

interface MyAccountCardProps {
  onOpenProfile: () => void;
}

export function MyAccountCard({ onOpenProfile }: MyAccountCardProps) {
  const { playerAuth, clearPlayerAuth, division, setDivision } = useAppStore();
  const dt = useDivisionTheme();

  const [loggingOut, setLoggingOut] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  if (!playerAuth.isAuthenticated || !playerAuth.account) return null;

  const { account } = playerAuth;
  const player = account.player;
  const playerDivision = player.division as 'male' | 'female';
  const avatarSrc = getAvatarUrl(player.gamertag, playerDivision, player.avatar);
  const winRate = player.matches > 0 ? Math.round((player.totalWins / player.matches) * 100) : 0;

  // Skin data
  const skins = account.skins || [];
  const primarySkin = getPrimarySkin(skins);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/account/logout', { method: 'POST' });
      clearPlayerAuth();
      toast.success('Berhasil logout');
    } catch {
      clearPlayerAuth();
    } finally {
      setLoggingOut(false);
    }
  };

  // Switch to player's division when viewing account
  const switchToMyDivision = () => {
    if (player.division !== division) {
      setDivision(player.division as 'male' | 'female');
      toast.success(player.division === 'male' ? '🕺 Cowo' : '💃 Cewe');
    }
  };

  return (
    <>
    <div className={`stagger-item-subtle stagger-d4 rounded-2xl ${primarySkin ? 'border border-border/50' : dt.casinoCard + ' border ' + dt.border} overflow-hidden`} style={primarySkin ? undefined : undefined}>
      {/* Header */}
      <div className={`flex items-center gap-2 px-4 sm:px-5 py-3 ${dt.bgSubtle} border-b ${dt.borderSubtle}`}>
        <Sparkles className={`w-3.5 h-3.5 ${primarySkin ? 'text-idm-gold' : dt.text}`} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Akun Saya</span>
        {skins.length > 0 && (
          <Badge className={`${dt.casinoBadge} text-[8px] ml-auto`}>
            <Star className="w-2.5 h-2.5 mr-0.5" /> {skins.length} Skin
          </Badge>
        )}
      </div>

      {/* Player Info */}
      <div className="p-4 sm:p-6">
        <div className="flex items-start gap-3">
          {/* Avatar with skin frame */}
          <div className="relative shrink-0">
            <SkinAvatarFrame skin={primarySkin}>
              <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-border/30 shadow-lg">
                <AvatarMedia
                  src={avatarSrc}
                  alt={player.gamertag}
                  width={56}
                  height={56}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </div>
            </SkinAvatarFrame>
          </div>

          {/* Name & Stats */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <SkinName skin={primarySkin}>
                <span className="text-sm font-bold truncate">{player.gamertag}</span>
              </SkinName>
            </div>
            {/* Skin badges row */}
            {skins.length > 0 && (
              <div className="mt-0.5">
                <SkinBadgesRow skins={skins} />
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {player.city ? player.city + ' · ' : ''}{playerDivision === 'male' ? '🕺 Cowo' : '💃 Cewe'}
            </p>

            {/* Quick Stats Row */}
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1">
                <Trophy className={`w-3 h-3 ${dt.text}`} />
                <span className="text-[10px] font-bold">{player.points}</span>
                <span className="text-[9px] text-muted-foreground">pts</span>
              </div>
              <div className="flex items-center gap-1">
                <Flame className="w-3 h-3 text-green-500" />
                <span className="text-[10px] font-bold">{player.totalWins}</span>
                <span className="text-[9px] text-muted-foreground">W</span>
              </div>
              {player.totalMvp > 0 && (
                <div className="flex items-center gap-1">
                  <Crown className="w-3 h-3 text-yellow-500" />
                  <span className="text-[10px] font-bold">{player.totalMvp}</span>
                  <span className="text-[9px] text-muted-foreground">MVP</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold">{winRate}%</span>
                <span className="text-[9px] text-muted-foreground">WR</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-[11px] flex-1 bg-muted/30 hover:bg-muted/50"
            onClick={() => { switchToMyDivision(); onOpenProfile(); }}
          >
            <Gamepad2 className="w-3.5 h-3.5 mr-1.5" />
            Profil Saya
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-[11px] bg-muted/30 hover:bg-muted/50"
            onClick={() => setShowChangePassword(true)}
            title="Ganti Password"
          >
            <KeyRound className="w-3.5 h-3.5" />
          </Button>
          {player.division !== division && (
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 text-[11px] ${dt.bgSubtle} hover:bg-muted/50`}
              onClick={switchToMyDivision}
            >
              {playerDivision === 'male' ? '🕺' : '💃'} Divisi Saya
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
            onClick={handleLogout}
            disabled={loggingOut}
            title="Logout"
          >
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>

    {/* Change Password Portal Modal */}
    {showChangePassword && createPortal(
      <ChangePasswordModal
        onClose={() => setShowChangePassword(false)}
        onSuccess={() => {
          setShowChangePassword(false);
          clearPlayerAuth();
          toast.success('Password berhasil diubah! Silakan login kembali.');
        }}
      />,
      document.body
    )}
    </>
  );
}

// ─── Change Password Modal ────────────────────────────

function ChangePasswordModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Semua field wajib diisi');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password baru minimal 6 karakter');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password tidak cocok');
      return;
    }

    if (currentPassword === newPassword) {
      setError('Password baru harus berbeda dari password lama');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/account/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Gagal mengubah password');
        return;
      }

      onSuccess();
    } catch {
      setError('Terjadi kesalahan koneksi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop modal-backdrop-enter z-[9999] p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="modal-container modal-container-md modal-enter-slide">
        {/* Top accent */}
        <div className="h-1 w-full bg-gradient-to-r from-idm-gold to-idm-gold-light" />

        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-idm-gold/10 border border-idm-gold/20 flex items-center justify-center">
              <KeyRound className="w-4 h-4 text-idm-gold" />
            </div>
            <div>
              <h2 className="modal-header-title">Ganti Password</h2>
              <p className="text-[10px] text-muted-foreground">Ubah password akun kamu</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="modal-close"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="modal-body-compact">
          {/* Current Password */}
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Password Lama</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => { setCurrentPassword(e.target.value); setError(''); }}
                placeholder="Masukkan password lama"
                className="pl-10 pr-10 h-10 bg-muted/30 border-border/50 focus:border-idm-gold/50"
                disabled={loading}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Password Baru</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                placeholder="Min. 6 karakter"
                className="pl-10 pr-10 h-10 bg-muted/30 border-border/50 focus:border-idm-gold/50"
                disabled={loading}
                autoComplete="new-password"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Konfirmasi Password Baru</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                placeholder="Ulangi password baru"
                className="pl-10 h-10 bg-muted/30 border-border/50 focus:border-idm-gold/50"
                disabled={loading}
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || !currentPassword || !newPassword || !confirmPassword}
            className="w-full h-10 bg-gradient-to-r from-idm-gold to-idm-gold-light text-black font-semibold"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <KeyRound className="w-4 h-4 mr-2" />
            )}
            {loading ? 'Menyimpan...' : 'Ganti Password'}
          </Button>

          <p className="text-[9px] text-muted-foreground text-center">
            Setelah ganti password, kamu akan otomatis logout dan harus login kembali.
          </p>
        </form>
      </div>
    </div>
  );
}
