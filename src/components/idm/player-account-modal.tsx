'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Eye, EyeOff, Loader2, Lock, User, Gamepad2,
  ArrowLeft, UserPlus, LogIn, Sparkles, Shield,
  KeyRound, MapPin, Phone, Users, Info,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/lib/store';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { toast } from 'sonner';

type ModalMode = 'choose' | 'login' | 'register' | 'change-password';

interface ClubOption {
  id: string;
  name: string;
  logo?: string | null;
}

interface PlayerAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlayerAccountModal({ open, onOpenChange }: PlayerAccountModalProps) {
  const { setPlayerAuth, division: storeDivision } = useAppStore();
  const dt = useDivisionTheme();

  const [mode, setMode] = useState<ModalMode>('choose');

  // Login state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Register state
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regCity, setRegCity] = useState('');
  const [regDivision, setRegDivision] = useState<'male' | 'female'>(storeDivision === 'female' ? 'female' : 'male');
  const [regClubId, setRegClubId] = useState<string>('');
  const [regJoki, setRegJoki] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');

  // Change password state
  const [cpCurrentPassword, setCpCurrentPassword] = useState('');
  const [cpNewPassword, setCpNewPassword] = useState('');
  const [cpConfirmPassword, setCpConfirmPassword] = useState('');
  const [cpShowCurrent, setCpShowCurrent] = useState(false);
  const [cpShowNew, setCpShowNew] = useState(false);
  const [cpLoading, setCpLoading] = useState(false);
  const [cpError, setCpError] = useState('');
  const [cpSuccess, setCpSuccess] = useState('');

  // Clubs
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [clubsLoading, setClubsLoading] = useState(false);

  const resetForm = useCallback(() => {
    setLoginUsername('');
    setLoginPassword('');
    setShowLoginPassword(false);
    setLoginError('');
    setRegName('');
    setRegPhone('');
    setRegCity('');
    setRegDivision(storeDivision === 'female' ? 'female' : 'male');
    setRegClubId('');
    setRegJoki('');
    setRegPassword('');
    setRegConfirmPassword('');
    setRegError('');
    setClubs([]);
    setClubsLoading(false);
    setCpCurrentPassword('');
    setCpNewPassword('');
    setCpConfirmPassword('');
    setCpShowCurrent(false);
    setCpShowNew(false);
    setCpError('');
    setCpSuccess('');
  }, [storeDivision]);

  const handleModeChange = (newMode: ModalMode) => {
    resetForm();
    setMode(newMode);
  };

  // Fetch clubs when entering register mode
  useEffect(() => {
    if (mode === 'register' && open) {
      const fetchClubs = async () => {
        setClubsLoading(true);
        try {
          const res = await fetch(`/api/clubs?unified=true`);
          const data = await res.json();
          // The unified endpoint returns ClubProfile[] with {id, name, logo, ...}
          const clubOptions: ClubOption[] = (Array.isArray(data) ? data : []).map((c: { id: string; name: string; logo?: string | null }) => ({
            id: c.id,
            name: c.name,
            logo: c.logo,
          }));
          setClubs(clubOptions);
        } catch {
          setClubs([]);
        } finally {
          setClubsLoading(false);
        }
      };
      fetchClubs();
    }
  }, [mode, open]);

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
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
      resetForm();
    } catch {
      setLoginError('Terjadi kesalahan koneksi');
    } finally {
      setLoginLoading(false);
    }
  };

  // Register handler
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

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
          clubProfileId: regClubId || null,
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

      // The API auto-logs in by setting the session cookie
      // Update the store with the account data from registration response
      if (data.account) {
        setPlayerAuth({
          isAuthenticated: true,
          account: data.account,
        });

        if (data.isPendingApproval) {
          toast.success('Pendaftaran berhasil! Akun kamu sedang menunggu persetujuan admin. Setelah disetujui, kamu akan muncul di leaderboard. ⏳');
        } else {
          toast.success(`Akun dibuat! Selamat datang, ${data.account.player.gamertag}! 🎉`);
        }
      } else {
        toast.success('Pendaftaran berhasil! Silakan login.');
        handleModeChange('login');
      }

      onOpenChange(false);
      resetForm();
    } catch {
      setRegError('Terjadi kesalahan koneksi');
    } finally {
      setRegLoading(false);
    }
  };

  // Change password handler
  const handleChangePassword = async (e: React.FormEvent) => {
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

    if (cpCurrentPassword === cpNewPassword) {
      setCpError('Password baru harus berbeda dari password lama');
      return;
    }

    setCpLoading(true);

    try {
      // First login to establish session
      const loginRes = await fetch('/api/account/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: cpCurrentPassword }),
      });

      if (!loginRes.ok) {
        setCpError('Nickname atau password lama tidak sesuai');
        return;
      }

      // Now change password with the session
      const changeRes = await fetch('/api/account/change-password', {
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
        handleModeChange('login');
        setCpSuccess('');
      }, 2500);
    } catch {
      setCpError('Terjadi kesalahan koneksi');
    } finally {
      setCpLoading(false);
    }
  };

  const effectiveDivision = storeDivision === 'female' ? 'female' : 'male';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="modal-container modal-container-md modal-enter-slide sm:max-w-md p-0 gap-0 overflow-hidden bg-background border-border/50">
        <DialogTitle className="sr-only">Akun Pemain Tarkam IDM</DialogTitle>
        {/* Top accent bar */}
        <div className={`h-1 w-full bg-gradient-to-r ${effectiveDivision === 'male' ? 'from-idm-male to-idm-male-light' : 'from-idm-female to-idm-female-light'}`} />

        <div className="modal-body p-4 sm:p-6">
          {mode === 'choose' && (
            <div key="choose">
              {/* Header */}
              <div className="modal-header text-center mb-6">
                <div className={`w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br ${effectiveDivision === 'male' ? 'from-idm-male/20 to-idm-male/5 border-idm-male/30' : 'from-idm-female/20 to-idm-female/5 border-idm-female/30'} border flex items-center justify-center`}>
                  <Gamepad2 className={`w-7 h-7 ${dt.text}`} />
                </div>
                <h2 className="modal-header-title text-lg font-bold">Akun Pemain</h2>
                <p className="modal-header-subtitle text-xs text-muted-foreground mt-1">
                  Login untuk melihat statistik & prestasi kamu
                </p>
              </div>

              {/* Choice buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => handleModeChange('login')}
                  className={`w-full flex items-center gap-3 p-4 rounded-2xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors text-left group cursor-pointer`}
                >
                  <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${effectiveDivision === 'male' ? 'from-idm-male to-idm-male-light' : 'from-idm-female to-idm-female-light'} flex items-center justify-center shrink-0`}>
                    <LogIn className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Login</p>
                    <p className="text-[10px] text-muted-foreground">Sudah punya akun? Login di sini</p>
                  </div>
                </button>

                <button
                  onClick={() => handleModeChange('register')}
                  className={`w-full flex items-center gap-3 p-4 rounded-2xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors text-left group cursor-pointer`}
                >
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-idm-gold-warm to-[#e8d5a3] flex items-center justify-center shrink-0">
                    <UserPlus className="w-5 h-5 text-black" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Daftar</p>
                    <p className="text-[10px] text-muted-foreground">Pemain baru? Daftar di sini</p>
                  </div>
                </button>
              </div>

              {/* Info */}
              <div className="mt-5 p-4 sm:p-5 rounded-lg bg-muted/20 border border-border/30">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-idm-gold shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">
                      Akun pemain terhubung ke data turnamen Tarkam IDM.
                      Dapatkan skin eksklusif untuk pemenang juara & MVP! 🏆
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {mode === 'login' && (
            <div key="login">
              {/* Header */}
              <div className="modal-header text-center mb-5">
                <div className={`w-12 h-12 mx-auto mb-2 rounded-2xl bg-gradient-to-br ${effectiveDivision === 'male' ? 'from-idm-male/20 to-idm-male/5 border-idm-male/30' : 'from-idm-female/20 to-idm-female/5 border-idm-female/30'} border flex items-center justify-center`}>
                  <LogIn className={`w-6 h-6 ${dt.text}`} />
                </div>
                <h2 className="modal-header-title text-base font-bold">Login Akun</h2>
                <p className="modal-header-subtitle text-[10px] text-muted-foreground mt-0.5">
                  Gunakan gamertag dan password kamu
                </p>
              </div>

              {/* Login Form */}
              <form onSubmit={handleLogin} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Gamertag</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder="Gamertag kamu"
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

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => handleModeChange('register')}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Belum punya akun? <span className={`font-semibold ${dt.text}`}>Daftar di sini</span>
                </button>
              </div>

              <div className="mt-2 text-center">
                <button
                  type="button"
                  onClick={() => { setMode('change-password'); setCpError(''); setCpSuccess(''); }}
                  className="text-[10px] text-muted-foreground hover:text-idm-gold transition-colors inline-flex items-center gap-1.5"
                >
                  <KeyRound className="w-3 h-3" />
                  Ganti Password
                </button>
              </div>

              <div className="mt-2 text-center">
                <button
                  type="button"
                  onClick={() => handleModeChange('choose')}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" /> Kembali
                </button>
              </div>
            </div>
          )}

          {mode === 'register' && (
            <div key="register">
              {/* Header */}
              <div className="modal-header text-center mb-4">
                <div className="w-12 h-12 mx-auto mb-2 rounded-2xl bg-gradient-to-br from-idm-gold/20 to-idm-gold/5 border border-idm-gold/30 flex items-center justify-center">
                  <UserPlus className="w-6 h-6 text-idm-gold" />
                </div>
                <h2 className="modal-header-title text-base font-bold">Daftar</h2>
                <p className="modal-header-subtitle text-[10px] text-muted-foreground mt-0.5">
                  Isi data diri untuk mendaftar sebagai pemain turnamen
                </p>
              </div>

              {/* Division Badge */}
              <div className="flex justify-center mb-4">
                <Badge className={`${regDivision === 'male' ? 'bg-idm-male/15 text-idm-male border-idm-male/25' : 'bg-idm-female/15 text-idm-female border-idm-female/25'} text-[10px] border gap-1`}>
                  {regDivision === 'male' ? '🕺 Divisi Cowo' : '💃 Divisi Cewe'}
                </Badge>
              </div>

              {/* Registration Form */}
              <form onSubmit={handleRegister} className="modal-scroll space-y-3 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
                {/* Nama/Gamertag */}
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Nama / Gamertag</label>
                  <div className="relative">
                    <Gamepad2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={regName}
                      onChange={(e) => { setRegName(e.target.value); setRegError(''); }}
                      placeholder="Nama gamertag kamu"
                      className="pl-10 h-10 bg-muted/30 border-border/50 focus:border-idm-gold/50"
                      disabled={regLoading}
                      required
                    />
                  </div>
                </div>

                {/* No. WhatsApp */}
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">No. WhatsApp</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="tel"
                      value={regPhone}
                      onChange={(e) => { setRegPhone(e.target.value); setRegError(''); }}
                      placeholder="08xxxxxxxxxx"
                      className="pl-10 h-10 bg-muted/30 border-border/50 focus:border-idm-gold/50"
                      disabled={regLoading}
                      autoComplete="tel"
                      required
                    />
                  </div>
                </div>

                {/* Kota */}
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Kota</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={regCity}
                      onChange={(e) => setRegCity(e.target.value)}
                      placeholder="Kota kamu"
                      className="pl-10 h-10 bg-muted/30 border-border/50 focus:border-idm-gold/50"
                      disabled={regLoading}
                      required
                    />
                  </div>
                </div>

                {/* Divisi */}
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Divisi</label>
                  <Select
                    value={regDivision}
                    onValueChange={(val: 'male' | 'female') => setRegDivision(val)}
                    disabled={regLoading}
                  >
                    <SelectTrigger className="w-full h-10 bg-muted/30 border-border/50 focus:border-idm-gold/50">
                      <SelectValue placeholder="Pilih divisi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">🕺 Cowo</SelectItem>
                      <SelectItem value="female">💃 Cewe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Club */}
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Club <span className="normal-case">(opsional)</span>
                  </label>
                  <Select
                    value={regClubId}
                    onValueChange={setRegClubId}
                    disabled={regLoading || clubsLoading}
                  >
                    <SelectTrigger className="w-full h-10 bg-muted/30 border-border/50 focus:border-idm-gold/50">
                      <SelectValue placeholder={clubsLoading ? 'Memuat club...' : 'Pilih club'} />
                    </SelectTrigger>
                    <SelectContent>
                      {clubs.map((club) => (
                        <SelectItem key={club.id} value={club.id}>
                          <div className="flex items-center gap-2">
                            {club.logo && (
                              <img src={club.logo} alt="" className="w-4 h-4 rounded object-cover" />
                            )}
                            <span>{club.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                      {clubs.length === 0 && !clubsLoading && (
                        <SelectItem value="__none" disabled>
                          Belum ada club tersedia
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {clubsLoading && (
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Memuat daftar club...
                    </div>
                  )}
                </div>

                {/* Joki */}
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Joki <span className="normal-case">(opsional)</span>
                  </label>
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
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Password</label>
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
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Konfirmasi Password</label>
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

                {/* Error */}
                {regError && (
                  <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {regError}
                  </div>
                )}

                {/* Info box */}
                <div className="p-3 sm:p-4 rounded-lg bg-muted/20 border border-border/30 flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-idm-gold shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Setelah mendaftar, akun kamu perlu disetujui admin sebelum muncul di leaderboard.
                  </p>
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={regLoading || !regName.trim() || !regPhone.trim() || !regCity.trim() || !regPassword || !regConfirmPassword}
                  className="w-full h-10 bg-gradient-to-r from-idm-gold to-idm-gold-light text-black font-semibold"
                >
                  {regLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Shield className="w-4 h-4 mr-2" />
                  )}
                  {regLoading ? 'Mendaftar...' : 'Daftar'}
                </Button>
              </form>

              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={() => handleModeChange('choose')}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" /> Kembali
                </button>
              </div>
            </div>
          )}

          {mode === 'change-password' && (
            <div key="change-password">
              {/* Header */}
              <div className="modal-header text-center mb-5">
                <div className={`w-12 h-12 mx-auto mb-2 rounded-2xl bg-gradient-to-br ${effectiveDivision === 'male' ? 'from-idm-male/20 to-idm-male/5 border-idm-male/30' : 'from-idm-female/20 to-idm-female/5 border-idm-female/30'} border flex items-center justify-center`}>
                  <KeyRound className={`w-6 h-6 ${dt.text}`} />
                </div>
                <h2 className="modal-header-title text-base font-bold">Ganti Password</h2>
                <p className="modal-header-subtitle text-[10px] text-muted-foreground mt-0.5">Ubah password akun pemain kamu</p>
              </div>

              {/* Change Password Form */}
              <form onSubmit={handleChangePassword} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Password Lama</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type={cpShowCurrent ? 'text' : 'password'}
                      value={cpCurrentPassword}
                      onChange={(e) => setCpCurrentPassword(e.target.value)}
                      placeholder="Password lama"
                      className="pl-10 pr-10 h-10 bg-muted/30 border-border/50 focus:border-idm-male/50"
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
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Password Baru</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type={cpShowNew ? 'text' : 'password'}
                      value={cpNewPassword}
                      onChange={(e) => setCpNewPassword(e.target.value)}
                      placeholder="Password baru (min. 6 karakter)"
                      className="pl-10 pr-10 h-10 bg-muted/30 border-border/50 focus:border-idm-male/50"
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
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Konfirmasi Password Baru</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="password"
                      value={cpConfirmPassword}
                      onChange={(e) => setCpConfirmPassword(e.target.value)}
                      placeholder="Konfirmasi password baru"
                      className="pl-10 h-10 bg-muted/30 border-border/50 focus:border-idm-male/50"
                      disabled={cpLoading}
                      autoComplete="new-password"
                      required
                    />
                  </div>
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

                {/* Info box about default password */}
                <div className="p-3 sm:p-4 rounded-lg bg-idm-gold/5 border border-idm-gold/20 flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-idm-gold shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Jika kamu mendaftar via WhatsApp, password default adalah <strong className="text-idm-gold">6 digit terakhir nomor WA</strong> yang digunakan saat mendaftar.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={cpLoading || !cpCurrentPassword || !cpNewPassword || !cpConfirmPassword}
                  className={`w-full h-10 bg-gradient-to-r ${effectiveDivision === 'male' ? 'from-idm-male to-idm-male-light' : 'from-idm-female to-idm-female-light'} text-white font-semibold`}
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
                  onClick={() => { setMode('login'); setCpError(''); setCpSuccess(''); }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" /> Kembali ke Login
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
