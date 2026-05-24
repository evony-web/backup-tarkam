'use client';

import { useState, useEffect } from 'react';
import {
  Eye, EyeOff, Loader2, Lock, User, Gamepad2,
  ArrowLeft, UserPlus, LogIn, Sparkles, Shield,
  KeyRound, Eye as ViewIcon, MapPin, Phone,
  Users, Info,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppStore } from '@/lib/store';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { SkinBadgesRow, SkinAvatarFrame, SkinName } from './skin-renderer';
import { SkinShowcase } from './skin-showcase';
import { getPrimarySkin } from '@/lib/skin-utils';
import { toast } from 'sonner';
import Image from 'next/image';
import { getAvatarUrl } from '@/lib/utils';

type PlayerModalMode = 'choose' | 'login' | 'register' | 'change-password';
type AdminModalMode = 'login' | 'change-password';
type ModalView = 'peserta' | 'admin';

interface UnifiedLoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which view to show by default */
  defaultTab?: 'peserta' | 'admin';
  /** Callback to open the registration modal (for unified registration flow) */
  onOpenRegistration?: () => void;
}

export function UnifiedLoginModal({ open, onOpenChange, defaultTab = 'peserta', onOpenRegistration }: UnifiedLoginModalProps) {
  const { setPlayerAuth, setAdminAuth, division, adminAuth, playerAuth, clearPlayerAuth, clearAdminAuth, setCurrentView } = useAppStore();
  const dt = useDivisionTheme();

  const [activeView, setActiveView] = useState<ModalView>(defaultTab === 'admin' ? 'admin' : 'peserta');

  // Sync defaultTab when modal opens
  useEffect(() => {
    if (open) {
      setActiveView(defaultTab === 'admin' ? 'admin' : 'peserta');
      setPlayerMode('choose');
      resetPlayerForm();
      resetAdminForm();
    }
  }, [open, defaultTab]);

  // ═══ Player Login State ═══
  const [playerMode, setPlayerMode] = useState<PlayerModalMode>('choose');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // ═══ Player Register State ═══
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regCity, setRegCity] = useState('');
  const [regDivision, setRegDivision] = useState<'male' | 'female'>(division === 'female' ? 'female' : 'male');
  const [regClubId, setRegClubId] = useState('');
  const [regJoki, setRegJoki] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');
  const [clubs, setClubs] = useState<{ id: string; name: string; logo?: string | null }[]>([]);
  const [clubsLoading, setClubsLoading] = useState(false);

  // ═══ Admin Login State ═══
  const [adminMode, setAdminMode] = useState<AdminModalMode>('login');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');

  // Admin change password
  const [cpUsername, setCpUsername] = useState('');
  const [cpCurrentPassword, setCpCurrentPassword] = useState('');
  const [cpNewPassword, setCpNewPassword] = useState('');
  const [cpConfirmPassword, setCpConfirmPassword] = useState('');
  const [cpShowCurrent, setCpShowCurrent] = useState(false);
  const [cpShowNew, setCpShowNew] = useState(false);
  const [cpLoading, setCpLoading] = useState(false);
  const [cpError, setCpError] = useState('');
  const [cpSuccess, setCpSuccess] = useState('');

  // Player change password
  const [pcpUsername, setPcpUsername] = useState('');
  const [pcpCurrentPassword, setPcpCurrentPassword] = useState('');
  const [pcpNewPassword, setPcpNewPassword] = useState('');
  const [pcpConfirmPassword, setPcpConfirmPassword] = useState('');
  const [pcpShowCurrent, setPcpShowCurrent] = useState(false);
  const [pcpShowNew, setPcpShowNew] = useState(false);
  const [pcpLoading, setPcpLoading] = useState(false);
  const [pcpError, setPcpError] = useState('');
  const [pcpSuccess, setPcpSuccess] = useState('');

  // Skin showcase
  const [showSkinShowcase, setShowSkinShowcase] = useState(false);

  const resetPlayerForm = () => {
    setLoginUsername('');
    setLoginPassword('');
    setShowLoginPassword(false);
    setLoginError('');
    setRegName('');
    setRegPhone('');
    setRegCity('');
    setRegDivision(division === 'female' ? 'female' : 'male');
    setRegClubId('');
    setRegJoki('');
    setRegPassword('');
    setRegConfirmPassword('');
    setRegError('');
    setClubs([]);
    setClubsLoading(false);
    // Reset player change password too
    setPcpUsername('');
    setPcpCurrentPassword('');
    setPcpNewPassword('');
    setPcpConfirmPassword('');
    setPcpShowCurrent(false);
    setPcpShowNew(false);
    setPcpError('');
    setPcpSuccess('');
  };

  const resetAdminForm = () => {
    setAdminUsername('');
    setAdminPassword('');
    setShowAdminPassword(false);
    setAdminError('');
    setCpUsername('');
    setCpCurrentPassword('');
    setCpNewPassword('');
    setCpConfirmPassword('');
    setCpShowCurrent(false);
    setCpShowNew(false);
    setCpError('');
    setCpSuccess('');
    setAdminMode('login');
  };

  const handlePlayerModeChange = (newMode: PlayerModalMode) => {
    resetPlayerForm();
    setPlayerMode(newMode);
  };

  // ═══ Player: Fetch clubs for registration ═══
  useEffect(() => {
    if (playerMode === 'register' && open) {
      setClubsLoading(true);
      fetch('/api/clubs?unified=true')
        .then(res => res.json())
        .then(data => {
          setClubs(data.clubs || []);
        })
        .catch(() => {})
        .finally(() => setClubsLoading(false));
    }
  }, [playerMode, open]);

  // ═══ Player: Login handler ═══
  const handlePlayerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    try {
      const res = await fetch('/api/account/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setLoginError(data.error || 'Login gagal');
        return;
      }

      setPlayerAuth({
        isAuthenticated: true,
        account: data.account,
      });

      toast.success(`Selamat datang, ${data.account.player.gamertag}! 🎮`);
      onOpenChange(false);
      resetPlayerForm();
      setPlayerMode('choose');
    } catch {
      setLoginError('Terjadi kesalahan koneksi');
    } finally {
      setLoginLoading(false);
    }
  };

  // ═══ Player: Register handler (full registration) ═══
  const handlePlayerRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

    if (!regName.trim()) {
      setRegError('Nama wajib diisi');
      return;
    }
    if (!regPhone.trim()) {
      setRegError('No. WhatsApp wajib diisi');
      return;
    }
    if (!regCity.trim()) {
      setRegError('Kota wajib diisi');
      return;
    }
    if (regPassword.length < 6) {
      setRegError('Password minimal 6 karakter');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setRegError('Konfirmasi password tidak cocok');
      return;
    }

    setRegLoading(true);

    try {
      const res = await fetch('/api/account/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isFullRegistration: true,
          name: regName.trim(),
          phone: regPhone.trim(),
          city: regCity.trim(),
          division: regDivision,
          clubProfileId: regClubId === '__none__' ? null : regClubId || null,
          joki: regJoki.trim() || null,
          password: regPassword,
          email: null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setRegError(data.error || 'Registrasi gagal');
        return;
      }

      // Auto-login after registration
      const loginRes = await fetch('/api/account/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: data.account.username,
          password: regPassword,
        }),
      });

      const loginData = await loginRes.json();

      if (loginRes.ok && loginData.account) {
        setPlayerAuth({
          isAuthenticated: true,
          account: loginData.account,
        });
        if (data.isPendingApproval) {
          toast.success(`Pendaftaran berhasil! Akun kamu sedang menunggu persetujuan admin. 🎉`);
        } else {
          toast.success(`Akun dibuat! Selamat datang, ${loginData.account.player.gamertag}! 🎉`);
        }
      } else {
        toast.success('Pendaftaran berhasil! Silakan login.');
        handlePlayerModeChange('login');
      }

      onOpenChange(false);
      resetPlayerForm();
      setPlayerMode('choose');
    } catch {
      setRegError('Terjadi kesalahan koneksi');
    } finally {
      setRegLoading(false);
    }
  };

  // ═══ Player: Change Password handler ═══
  const handlePlayerChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPcpError('');
    setPcpSuccess('');

    if (pcpNewPassword !== pcpConfirmPassword) {
      setPcpError('Konfirmasi password tidak cocok');
      return;
    }

    if (pcpNewPassword.length < 6) {
      setPcpError('Password baru minimal 6 karakter');
      return;
    }

    if (pcpCurrentPassword === pcpNewPassword) {
      setPcpError('Password baru harus berbeda dari password lama');
      return;
    }

    setPcpLoading(true);

    try {
      // First login to establish session
      const loginRes = await fetch('/api/account/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: pcpUsername, password: pcpCurrentPassword }),
      });

      if (!loginRes.ok) {
        const loginData = await loginRes.json();
        setPcpError('Nickname atau password lama tidak sesuai');
        return;
      }

      // Now change password with the session
      const changeRes = await fetch('/api/account/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: pcpCurrentPassword,
          newPassword: pcpNewPassword,
        }),
      });

      const changeData = await changeRes.json();

      if (!changeRes.ok) {
        setPcpError(changeData.error || 'Gagal mengubah password');
        return;
      }

      setPcpSuccess('Password berhasil diubah! Silakan login dengan password baru.');
      setPcpCurrentPassword('');
      setPcpNewPassword('');
      setPcpConfirmPassword('');

      setTimeout(() => {
        setPlayerMode('login');
        setPcpSuccess('');
        setPcpUsername('');
      }, 2500);
    } catch {
      setPcpError('Terjadi kesalahan koneksi');
    } finally {
      setPcpLoading(false);
    }
  };

  // ═══ Admin: Login handler ═══
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    setAdminLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUsername, password: adminPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAdminError(data.error || 'Login gagal');
        return;
      }

      setAdminAuth({
        isAuthenticated: true,
        admin: data.admin,
      });

      toast.success('Admin login berhasil! 🔒');
      onOpenChange(false);
      resetAdminForm();
      setCurrentView('admin');
    } catch {
      setAdminError('Terjadi kesalahan koneksi');
    } finally {
      setAdminLoading(false);
    }
  };

  // ═══ Admin: Change Password handler ═══
  const handleAdminChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setCpError('');
    setCpSuccess('');

    if (cpNewPassword !== cpConfirmPassword) {
      setCpError('Konfirmasi password tidak cocok');
      return;
    }

    if (cpNewPassword.length < 6) {
      setCpError('Password baru minimal 6 karakter');
      return;
    }

    setCpLoading(true);

    try {
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cpUsername, password: cpCurrentPassword }),
      });

      if (!loginRes.ok) {
        setCpError('Username atau password lama tidak sesuai');
        return;
      }

      const changeRes = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: cpCurrentPassword,
          newPassword: cpNewPassword,
        }),
      });

      const changeData = await changeRes.json();

      if (!changeRes.ok) {
        setCpError(changeData.error || 'Gagal mengubah password');
        return;
      }

      setCpSuccess('Password berhasil diubah! Silakan login dengan password baru.');
      setCpCurrentPassword('');
      setCpNewPassword('');
      setCpConfirmPassword('');

      setTimeout(() => {
        setAdminMode('login');
        setCpSuccess('');
      }, 2000);
    } catch {
      setCpError('Terjadi kesalahan koneksi');
    } finally {
      setCpLoading(false);
    }
  };

  // ═══ Determine what to show ═══
  const isPlayerLoggedIn = playerAuth.isAuthenticated && playerAuth.account;
  const isAdminLoggedIn = adminAuth.isAuthenticated && adminAuth.admin;

  const effectiveDivision = division === 'female' ? 'female' : 'male';

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`modal-container modal-container-md modal-enter-slide ${activeView === 'admin' ? 'modal-container-gold' : effectiveDivision === 'male' ? 'modal-container-male' : 'modal-container-female'} p-0 gap-0 overflow-hidden`}>
        <DialogTitle className="sr-only">Login Tarkam IDM</DialogTitle>
        <DialogDescription className="sr-only">Login ke akun peserta atau admin Tarkam IDM</DialogDescription>
        {/* Top accent bar */}
        <div className={`h-1 w-full bg-gradient-to-r ${
          activeView === 'admin'
            ? 'from-idm-gold via-idm-gold-light to-idm-gold'
            : effectiveDivision === 'male'
              ? 'from-idm-male to-idm-male-light'
              : 'from-idm-female to-idm-female-light'
        }`} />

        <div className="modal-body pt-3 relative">
          {/* ═══ PESERTA VIEW ═══ */}
          {activeView === 'peserta' && (
            <>
              {isPlayerLoggedIn ? (
                /* ── Player Already Logged In ── */
                <div>
                  <div className={`modal-body-compact rounded-2xl ${effectiveDivision === 'male' ? 'bg-idm-male/5 border border-idm-male/20' : 'bg-idm-female/5 border border-idm-female/20'} mb-4`}>
                    <div className="flex items-center gap-3">
                      <SkinAvatarFrame skin={getPrimarySkin(playerAuth.account!.skins || [])}>
                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-border/20">
                          <Image
                            src={getAvatarUrl(playerAuth.account!.player.gamertag, playerAuth.account!.player.division as 'male' | 'female', playerAuth.account!.player.avatar)}
                            alt={playerAuth.account!.player.gamertag}
                            width={48}
                            height={48}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </SkinAvatarFrame>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <SkinName skin={getPrimarySkin(playerAuth.account!.skins || [])}>
                            <span className="text-sm font-bold truncate">{playerAuth.account!.player.gamertag}</span>
                          </SkinName>
                        </div>
                        {(playerAuth.account!.skins?.length ?? 0) > 0 && (
                          <div className="mt-0.5">
                            <SkinBadgesRow skins={playerAuth.account!.skins || []} />
                          </div>
                        )}
                        <p className="text-[10px] text-muted-foreground">{playerAuth.account!.player.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {playerAuth.account!.player.division === 'male' ? '🕺 Cowo' : '💃 Cewe'} · {playerAuth.account!.player.points} pts
                        </p>
                      </div>
                      <Badge className={`${dt.casinoBadge} text-[9px]`}>✓</Badge>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="text-center p-3 sm:p-4 rounded-lg bg-muted/30 border border-border/30">
                      <p className="text-base font-bold">{playerAuth.account!.player.totalWins}</p>
                      <p className="text-[10px] text-muted-foreground">Menang</p>
                    </div>
                    <div className="text-center p-3 sm:p-4 rounded-lg bg-muted/30 border border-border/30">
                      <p className="text-base font-bold">{playerAuth.account!.player.totalMvp}</p>
                      <p className="text-[10px] text-muted-foreground">MVP</p>
                    </div>
                    <div className="text-center p-3 sm:p-4 rounded-lg bg-muted/30 border border-border/30">
                      <p className="text-base font-bold">{playerAuth.account!.player.matches}</p>
                      <p className="text-[10px] text-muted-foreground">Match</p>
                    </div>
                  </div>

                  {/* Logout */}
                  <Button
                    variant="outline"
                    className="w-full h-10 text-xs border-border/50 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30"
                    onClick={async () => {
                      try { await fetch('/api/account/logout', { method: 'POST' }); } catch {}
                      clearPlayerAuth();
                      toast.success('Berhasil logout');
                    }}
                  >
                    <LogIn className="w-3.5 h-3.5 mr-1.5 rotate-180" />
                    Logout
                  </Button>
                </div>
              ) : playerMode === 'choose' ? (
                /* ── Player: Choose Mode ── */
                <div key="choose">
                  <div className="text-center mb-5">
                    <div className={`w-12 h-12 mx-auto mb-2 rounded-2xl bg-gradient-to-br ${effectiveDivision === 'male' ? 'from-idm-male/20 to-idm-male/5 border-idm-male/30' : 'from-idm-female/20 to-idm-female/5 border-idm-female/30'} border flex items-center justify-center`}>
                      <Gamepad2 className={`w-6 h-6 ${dt.text}`} />
                    </div>
                    <h2 className="text-base font-bold">Akun Pemain</h2>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Login untuk melihat statistik & prestasi kamu
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <button
                      onClick={() => handlePlayerModeChange('login')}
                      className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors text-left cursor-pointer"
                    >
                      <div className={`w-9 h-9 rounded-2xl bg-gradient-to-br ${effectiveDivision === 'male' ? 'from-idm-male to-idm-male-light' : 'from-idm-female to-idm-female-light'} flex items-center justify-center shrink-0`}>
                        <LogIn className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold">Login</p>
                        <p className="text-[10px] text-muted-foreground">Sudah punya akun? Login di sini</p>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        if (onOpenRegistration) {
                          onOpenChange(false);
                          onOpenRegistration();
                        } else {
                          handlePlayerModeChange('register');
                        }
                      }}
                      className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors text-left cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-idm-gold-warm to-[#e8d5a3] flex items-center justify-center shrink-0">
                        <UserPlus className="w-4 h-4 text-black" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold">Daftar & Ikut Turnamen</p>
                        <p className="text-[10px] text-muted-foreground">Satu langkah: akun + pendaftaran turnamen</p>
                      </div>
                    </button>
                  </div>

                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => setShowSkinShowcase(true)}
                      className="w-full p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-idm-gold/5 to-idm-gold/[0.02] border border-idm-gold/20 hover:border-idm-gold/40 transition-all group"
                    >
                      <div className="flex items-start gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-idm-gold shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                        <p className="text-[11px] font-semibold text-idm-gold-warm">
                          Skin Eksklusif Setiap Minggu!
                        </p>
                        <ViewIcon className="w-3.5 h-3.5 text-idm-gold/50 ml-auto shrink-0 mt-0.5 group-hover:text-idm-gold transition-colors" />
                      </div>
                      <div className="space-y-1.5 ml-6">
                        <div className="flex items-center gap-2">
                          <span className="text-sm leading-none">🥇</span>
                          <span className="text-[10px] text-muted-foreground">Juara <strong className="text-yellow-400">1</strong> — <strong className="text-yellow-400">Gold Crown</strong> (1 minggu)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm leading-none">⭐</span>
                          <span className="text-[10px] text-muted-foreground">MVP — <strong className="text-muted-foreground">Platinum Star ✨</strong> (1 minggu)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm leading-none">🥉</span>
                          <span className="text-[10px] text-muted-foreground">Sawer Bronze — <strong className="text-amber-600">≥10K</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm leading-none">🥈</span>
                          <span className="text-[10px] text-muted-foreground">Sawer Silver — <strong className="text-muted-foreground">≥50K</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm leading-none">🥇</span>
                          <span className="text-[10px] text-muted-foreground">Sawer Gold — <strong className="text-yellow-400">≥100K</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm leading-none">💎</span>
                          <span className="text-[10px] text-muted-foreground">Sawer Diamond — <strong className="text-cyan-400">≥200K</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm leading-none">❤️</span>
                          <span className="text-[10px] text-muted-foreground">Donatur — <strong className="text-rose-400">Maroon Heart</strong> (1 minggu, badge ❤️ permanen!)</span>
                        </div>
                      </div>
                      <p className="text-[9px] text-idm-gold/40 ml-6 mt-2 group-hover:text-idm-gold/60 transition-colors">Tap untuk lihat preview visual →</p>
                    </button>
                  </div>
                </div>
              ) : playerMode === 'login' ? (
                /* ── Player: Login Form ── */
                <div key="login">
                  <div className="text-center mb-4">
                    <div className={`w-10 h-10 mx-auto mb-2 rounded-2xl bg-gradient-to-br ${effectiveDivision === 'male' ? 'from-idm-male/20 to-idm-male/5 border-idm-male/30' : 'from-idm-female/20 to-idm-female/5 border-idm-female/30'} border flex items-center justify-center`}>
                      <LogIn className={`w-5 h-5 ${dt.text}`} />
                    </div>
                    <h2 className="text-sm font-bold">Login Akun</h2>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Gunakan nickname dan password kamu</p>
                  </div>

                  <form onSubmit={handlePlayerLogin} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Nickname</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          value={loginUsername}
                          onChange={(e) => setLoginUsername(e.target.value)}
                          placeholder="Nickname kamu"
                          className="pl-10 h-10 bg-muted/30 border-border/50 focus:border-idm-male/50"
                          disabled={loginLoading}
                          autoComplete="username"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type={showLoginPassword ? 'text' : 'password'}
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          placeholder="Password"
                          className="pl-10 pr-10 h-10 bg-muted/30 border-border/50 focus:border-idm-male/50"
                          disabled={loginLoading}
                          autoComplete="current-password"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          tabIndex={-1}
                        >
                          {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {loginError && (
                      <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                        {loginError}
                      </div>
                    )}

                    <Button
                      type="submit"
                      disabled={loginLoading || !loginUsername || !loginPassword}
                      className={`w-full h-10 bg-gradient-to-r ${effectiveDivision === 'male' ? 'from-idm-male to-idm-male-light' : 'from-idm-female to-idm-female-light'} text-white font-semibold`}
                    >
                      {loginLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <LogIn className="w-4 h-4 mr-2" />
                      )}
                      {loginLoading ? 'Memverifikasi...' : 'Login'}
                    </Button>
                  </form>

                  <div className="mt-3 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handlePlayerModeChange('register')}
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Belum punya akun? <span className={`font-semibold ${dt.text}`}>Daftar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePlayerModeChange('choose')}
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                    >
                      <ArrowLeft className="w-3 h-3" /> Kembali
                    </button>
                  </div>

                  <div className="mt-2 text-center">
                    <button
                      type="button"
                      onClick={() => { setPlayerMode('change-password'); setPcpError(''); setPcpSuccess(''); }}
                      className="text-[10px] text-muted-foreground hover:text-idm-gold transition-colors inline-flex items-center gap-1.5"
                    >
                      <KeyRound className="w-3 h-3" />
                      Ganti Password
                    </button>
                  </div>
                </div>
              ) : playerMode === 'register' ? (
                /* ── Player: Full Registration Form ── */
                <div key="register">
                  <div className="text-center mb-3">
                    <div className="w-10 h-10 mx-auto mb-2 rounded-2xl bg-gradient-to-br from-idm-gold/20 to-idm-gold/5 border border-idm-gold/30 flex items-center justify-center">
                      <UserPlus className="w-5 h-5 text-idm-gold" />
                    </div>
                    <h2 className="text-sm font-bold">Daftar Pemain</h2>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Isi data diri untuk mendaftar sebagai pemain turnamen
                    </p>
                    {/* Division indicator */}
                    <div className="flex justify-center mt-1.5">
                      <Badge className={`${regDivision === 'male' ? 'bg-idm-male/10 text-idm-male border-idm-male/20' : 'bg-idm-female/10 text-idm-female border-idm-female/20'} text-[9px] border gap-1`}>
                        {regDivision === 'male' ? '🕺 Cowo' : '💃 Cewe'}
                      </Badge>
                    </div>
                  </div>

                  <form onSubmit={handlePlayerRegister} className="space-y-2.5 modal-scroll pr-1">
                    {/* Nama/Nickname */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Nama / Nickname <span className="text-idm-gold">*</span></label>
                      <div className="relative">
                        <Gamepad2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          value={regName}
                          onChange={(e) => { setRegName(e.target.value); setRegError(''); }}
                          placeholder="Nama kamu (jadi nickname)"
                          className="pl-10 h-10 bg-muted/30 border-border/50 focus:border-idm-gold/50"
                          disabled={regLoading}
                          required
                        />
                      </div>
                    </div>

                    {/* No. WhatsApp */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">No. WhatsApp <span className="text-idm-gold">*</span></label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="tel"
                          value={regPhone}
                          onChange={(e) => { setRegPhone(e.target.value); setRegError(''); }}
                          placeholder="08xxxxxxxxxx"
                          className="pl-10 h-10 bg-muted/30 border-border/50 focus:border-idm-gold/50"
                          disabled={regLoading}
                          required
                        />
                      </div>
                    </div>

                    {/* Kota */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Kota <span className="text-idm-gold">*</span></label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          value={regCity}
                          onChange={(e) => { setRegCity(e.target.value); setRegError(''); }}
                          placeholder="Kota kamu"
                          className="pl-10 h-10 bg-muted/30 border-border/50 focus:border-idm-gold/50"
                          disabled={regLoading}
                          required
                        />
                      </div>
                    </div>

                    {/* Divisi */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Divisi <span className="text-idm-gold">*</span></label>
                      <Select value={regDivision} onValueChange={(v) => setRegDivision(v as 'male' | 'female')} disabled={regLoading}>
                        <SelectTrigger className="h-10 bg-muted/30 border-border/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">🕺 Cowo</SelectItem>
                          <SelectItem value="female">💃 Cewe</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Club (optional) */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Club <span className="normal-case">(opsional)</span></label>
                      <Select value={regClubId} onValueChange={setRegClubId} disabled={regLoading || clubsLoading}>
                        <SelectTrigger className="h-10 bg-muted/30 border-border/50">
                          <SelectValue placeholder={clubsLoading ? "Memuat club..." : "Pilih club"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Tanpa Club</SelectItem>
                          {clubs.filter(c => c.name).map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Joki (optional) */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Joki <span className="normal-case">(opsional — jika memainkan akun orang)</span></label>
                      <div className="relative">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          value={regJoki}
                          onChange={(e) => setRegJoki(e.target.value)}
                          placeholder="Nama joki (jika ada)"
                          className="pl-10 h-10 bg-muted/30 border-border/50 focus:border-idm-gold/50"
                          disabled={regLoading}
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Password <span className="text-idm-gold">*</span></label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="password"
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          placeholder="Min. 6 karakter"
                          className="pl-10 h-10 bg-muted/30 border-border/50 focus:border-idm-gold/50"
                          disabled={regLoading}
                          autoComplete="new-password"
                          required
                          minLength={6}
                        />
                      </div>
                    </div>

                    {/* Konfirmasi Password */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Konfirmasi Password <span className="text-idm-gold">*</span></label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="password"
                          value={regConfirmPassword}
                          onChange={(e) => setRegConfirmPassword(e.target.value)}
                          placeholder="Ulangi password"
                          className="pl-10 h-10 bg-muted/30 border-border/50 focus:border-idm-gold/50"
                          disabled={regLoading}
                          autoComplete="new-password"
                          required
                        />
                      </div>
                    </div>

                    {regError && (
                      <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                        {regError}
                      </div>
                    )}

                    <Button
                      type="submit"
                      disabled={regLoading || !regName || !regPhone || !regCity || !regPassword || !regConfirmPassword}
                      className="w-full h-10 bg-gradient-to-r from-idm-gold to-idm-gold-light text-black font-semibold"
                    >
                      {regLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <UserPlus className="w-4 h-4 mr-2" />
                      )}
                      {regLoading ? 'Mendaftar...' : 'Daftar Pemain'}
                    </Button>

                    {/* Info box */}
                    <div className="p-3 sm:p-4 rounded-lg bg-idm-gold/5 border border-idm-gold/20">
                      <div className="flex items-start gap-1.5">
                        <Info className="w-3.5 h-3.5 text-idm-gold shrink-0 mt-0.5" />
                        <p className="text-[9px] text-muted-foreground">
                          Setelah mendaftar, akun kamu perlu disetujui admin sebelum muncul di leaderboard.
                        </p>
                      </div>
                    </div>
                  </form>

                  <div className="mt-3 text-center">
                    <button
                      type="button"
                      onClick={() => handlePlayerModeChange('choose')}
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                    >
                      <ArrowLeft className="w-3 h-3" /> Kembali
                    </button>
                  </div>
                </div>
              ) : playerMode === 'change-password' ? (
                /* ── Player: Change Password Form ── */
                <div key="player-change-password">
                  <div className="text-center mb-4">
                    <div className={`w-10 h-10 mx-auto mb-2 rounded-2xl bg-gradient-to-br ${effectiveDivision === 'male' ? 'from-idm-male/20 to-idm-male/5 border-idm-male/30' : 'from-idm-female/20 to-idm-female/5 border-idm-female/30'} border flex items-center justify-center`}>
                      <KeyRound className={`w-5 h-5 ${dt.text}`} />
                    </div>
                    <h2 className="text-sm font-bold">Ganti Password</h2>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Ubah password akun pemain kamu</p>
                  </div>

                  <form onSubmit={handlePlayerChangePassword} className="space-y-2.5">
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={pcpUsername}
                        onChange={(e) => setPcpUsername(e.target.value)}
                        placeholder="Nickname"
                        className="pl-10 h-10 bg-muted/30 border-border/50 focus:border-idm-male/50"
                        disabled={pcpLoading}
                        autoComplete="username"
                        required
                      />
                    </div>

                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type={pcpShowCurrent ? 'text' : 'password'}
                        value={pcpCurrentPassword}
                        onChange={(e) => setPcpCurrentPassword(e.target.value)}
                        placeholder="Password lama"
                        className="pl-10 pr-10 h-10 bg-muted/30 border-border/50 focus:border-idm-male/50"
                        disabled={pcpLoading}
                        autoComplete="current-password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setPcpShowCurrent(!pcpShowCurrent)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {pcpShowCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type={pcpShowNew ? 'text' : 'password'}
                        value={pcpNewPassword}
                        onChange={(e) => setPcpNewPassword(e.target.value)}
                        placeholder="Password baru (min. 6 karakter)"
                        className="pl-10 pr-10 h-10 bg-muted/30 border-border/50 focus:border-idm-male/50"
                        disabled={pcpLoading}
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setPcpShowNew(!pcpShowNew)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {pcpShowNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="password"
                        value={pcpConfirmPassword}
                        onChange={(e) => setPcpConfirmPassword(e.target.value)}
                        placeholder="Konfirmasi password baru"
                        className="pl-10 h-10 bg-muted/30 border-border/50 focus:border-idm-male/50"
                        disabled={pcpLoading}
                        autoComplete="new-password"
                        required
                      />
                    </div>

                    {pcpError && (
                      <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                        {pcpError}
                      </div>
                    )}

                    {pcpSuccess && (
                      <div className="text-xs text-green-500 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                        {pcpSuccess}
                      </div>
                    )}

                    {/* Info box about default password */}
                    <div className="p-3 rounded-lg bg-idm-gold/5 border border-idm-gold/20">
                      <div className="flex items-start gap-1.5">
                        <Info className="w-3.5 h-3.5 text-idm-gold shrink-0 mt-0.5" />
                        <p className="text-[9px] text-muted-foreground">
                          Jika kamu mendaftar via WhatsApp, password default adalah <strong className="text-idm-gold">6 digit terakhir nomor WA</strong> yang digunakan saat mendaftar.
                        </p>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={pcpLoading || !pcpUsername || !pcpCurrentPassword || !pcpNewPassword || !pcpConfirmPassword}
                      className={`w-full h-10 bg-gradient-to-r ${effectiveDivision === 'male' ? 'from-idm-male to-idm-male-light' : 'from-idm-female to-idm-female-light'} text-white font-semibold`}
                    >
                      {pcpLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <KeyRound className="w-4 h-4 mr-2" />
                      )}
                      {pcpLoading ? 'Mengubah...' : 'Ubah Password'}
                    </Button>
                  </form>

                  <div className="mt-3 text-center">
                    <button
                      type="button"
                      onClick={() => { setPlayerMode('login'); setPcpError(''); setPcpSuccess(''); }}
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      Kembali ke Login
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}

          {/* ═══ ADMIN VIEW ═══ */}
          {activeView === 'admin' && (
            <>
              {isAdminLoggedIn ? (
                /* ── Admin Already Logged In ── */
                <div>
                  <div className="p-4 rounded-2xl bg-idm-gold/5 border border-idm-gold/20 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-idm-gold/20 to-idm-gold/5 border border-idm-gold/30 flex items-center justify-center shrink-0">
                        <Shield className="w-5 h-5 text-idm-gold" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold">{adminAuth.admin?.username}</p>
                        <p className="text-[10px] text-idm-gold font-semibold uppercase tracking-wider">
                          {adminAuth.admin?.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                        </p>
                      </div>
                      <Badge className="bg-idm-gold/10 text-idm-gold border-idm-gold/20 text-[9px]">🔒</Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Button
                      className="w-full h-9 text-xs bg-gradient-to-r from-idm-gold to-idm-gold-light text-black font-semibold"
                      onClick={() => { onOpenChange(false); setCurrentView('admin'); }}
                    >
                      <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                      Buka Admin Panel
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full h-10 text-xs border-border/50 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30"
                      onClick={async () => {
                        try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
                        clearAdminAuth();
                        toast.success('Berhasil logout admin');
                      }}
                    >
                      <LogIn className="w-3.5 h-3.5 mr-1.5 rotate-180" />
                      Logout Admin
                    </Button>
                  </div>
                </div>
              ) : adminMode === 'login' ? (
                /* ── Admin: Login Form ── */
                <div key="admin-login">
                  <div className="text-center mb-4">
                    <div className="w-10 h-10 mx-auto mb-2 rounded-2xl bg-gradient-to-br from-idm-gold/20 to-idm-gold/5 border border-idm-gold/30 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-idm-gold" />
                    </div>
                    <h2 className="text-sm font-bold text-gradient-fury">Admin Login</h2>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Login untuk mengakses panel admin</p>
                  </div>

                  <form onSubmit={handleAdminLogin} className="space-y-3">
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={adminUsername}
                        onChange={(e) => setAdminUsername(e.target.value)}
                        placeholder="Username"
                        className="pl-10 h-10 bg-muted/30 border-border/50 focus:border-idm-gold/50 focus:ring-idm-gold/20"
                        disabled={adminLoading}
                        autoComplete="username"
                        required
                      />
                    </div>

                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type={showAdminPassword ? 'text' : 'password'}
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="Password"
                        className="pl-10 pr-10 h-10 bg-muted/30 border-border/50 focus:border-idm-gold/50 focus:ring-idm-gold/20"
                        disabled={adminLoading}
                        autoComplete="current-password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPassword(!showAdminPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {adminError && (
                      <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                        {adminError}
                      </div>
                    )}

                    <Button
                      type="submit"
                      disabled={adminLoading || !adminUsername || !adminPassword}
                      className="w-full h-10 bg-gradient-to-r from-idm-gold to-idm-gold-light hover:from-idm-gold-light hover:to-idm-gold text-black font-semibold shadow-sm"
                    >
                      {adminLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Shield className="w-4 h-4 mr-2" />
                      )}
                      {adminLoading ? 'Memverifikasi...' : 'Login'}
                    </Button>
                  </form>

                  <div className="mt-3 text-center">
                    <button
                      type="button"
                      onClick={() => { setAdminMode('change-password'); setAdminError(''); }}
                      className="text-[10px] text-muted-foreground hover:text-idm-gold transition-colors inline-flex items-center gap-1.5"
                    >
                      <KeyRound className="w-3 h-3" />
                      Ganti Password
                    </button>
                  </div>

                  <div className="mt-3 pt-3 border-t border-border/30 text-center">
                    <p className="text-[9px] text-muted-foreground">
                      🔒 Area khusus admin · Akses terbatas
                    </p>
                  </div>
                </div>
              ) : (
                /* ── Admin: Change Password Form ── */
                <div key="admin-change-password">
                  <div className="text-center mb-4">
                    <div className="w-10 h-10 mx-auto mb-2 rounded-2xl bg-gradient-to-br from-idm-gold/20 to-idm-gold/5 border border-idm-gold/30 flex items-center justify-center">
                      <KeyRound className="w-5 h-5 text-idm-gold" />
                    </div>
                    <h2 className="text-sm font-bold text-gradient-fury">Ganti Password</h2>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Ubah password akun admin Anda</p>
                  </div>

                  <form onSubmit={handleAdminChangePassword} className="space-y-2.5">
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={cpUsername}
                        onChange={(e) => setCpUsername(e.target.value)}
                        placeholder="Username"
                        className="pl-10 h-10 bg-muted/30 border-border/50 focus:border-idm-gold/50"
                        disabled={cpLoading}
                        autoComplete="username"
                        required
                      />
                    </div>

                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type={cpShowCurrent ? 'text' : 'password'}
                        value={cpCurrentPassword}
                        onChange={(e) => setCpCurrentPassword(e.target.value)}
                        placeholder="Password lama"
                        className="pl-10 pr-10 h-10 bg-muted/30 border-border/50 focus:border-idm-gold/50"
                        disabled={cpLoading}
                        autoComplete="current-password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setCpShowCurrent(!cpShowCurrent)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {cpShowCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type={cpShowNew ? 'text' : 'password'}
                        value={cpNewPassword}
                        onChange={(e) => setCpNewPassword(e.target.value)}
                        placeholder="Password baru (min. 6 karakter)"
                        className="pl-10 pr-10 h-10 bg-muted/30 border-border/50 focus:border-idm-gold/50"
                        disabled={cpLoading}
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setCpShowNew(!cpShowNew)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {cpShowNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="password"
                        value={cpConfirmPassword}
                        onChange={(e) => setCpConfirmPassword(e.target.value)}
                        placeholder="Konfirmasi password baru"
                        className="pl-10 h-10 bg-muted/30 border-border/50 focus:border-idm-gold/50"
                        disabled={cpLoading}
                        autoComplete="new-password"
                        required
                      />
                    </div>

                    {cpError && (
                      <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                        {cpError}
                      </div>
                    )}

                    {cpSuccess && (
                      <div className="text-xs text-green-500 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                        {cpSuccess}
                      </div>
                    )}

                    <Button
                      type="submit"
                      disabled={cpLoading || !cpUsername || !cpCurrentPassword || !cpNewPassword || !cpConfirmPassword}
                      className="w-full h-10 bg-gradient-to-r from-idm-gold to-idm-gold-light text-black font-semibold"
                    >
                      {cpLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <KeyRound className="w-4 h-4 mr-2" />
                      )}
                      {cpLoading ? 'Mengubah...' : 'Ubah Password'}
                    </Button>
                  </form>

                  <div className="mt-3 text-center">
                    <button
                      type="button"
                      onClick={() => { setAdminMode('login'); setCpError(''); setCpSuccess(''); }}
                      className="text-[10px] text-muted-foreground hover:text-idm-gold transition-colors inline-flex items-center gap-1.5"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      Kembali ke Login
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>

      {/* Skin Showcase Overlay */}
      <SkinShowcase open={showSkinShowcase} onClose={() => setShowSkinShowcase(false)} />
    </>
  );
}
