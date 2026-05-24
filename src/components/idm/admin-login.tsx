'use client';

import { useState } from 'react';
import { Shield, Eye, EyeOff, Loader2, Lock, User, KeyRound, ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/lib/store';

type LoginMode = 'login' | 'change-password';

export function AdminLogin() {
  const { setAdminAuth, adminAuth } = useAppStore();
  const [mode, setMode] = useState<LoginMode>('login');

  // Login state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Change password state
  const [cpUsername, setCpUsername] = useState('');
  const [cpCurrentPassword, setCpCurrentPassword] = useState('');
  const [cpNewPassword, setCpNewPassword] = useState('');
  const [cpConfirmPassword, setCpConfirmPassword] = useState('');
  const [cpShowCurrent, setCpShowCurrent] = useState(false);
  const [cpShowNew, setCpShowNew] = useState(false);
  const [cpLoading, setCpLoading] = useState(false);
  const [cpError, setCpError] = useState('');
  const [cpSuccess, setCpSuccess] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login gagal');
        return;
      }

      setAdminAuth({
        isAuthenticated: true,
        admin: data.admin,
      });
    } catch {
      setError('Terjadi kesalahan koneksi');
    } finally {
      setLoading(false);
    }
  };

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

    setCpLoading(true);

    try {
      // First, login to get a session
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: cpUsername, password: cpCurrentPassword }),
      });

      if (!loginRes.ok) {
        setCpError('Username atau password lama tidak sesuai');
        return;
      }

      // Then change the password using the session
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

      // Clear form
      setCpCurrentPassword('');
      setCpNewPassword('');
      setCpConfirmPassword('');

      // Switch back to login after 2 seconds
      setTimeout(() => {
        setMode('login');
        setCpSuccess('');
      }, 2000);
    } catch {
      setCpError('Terjadi kesalahan koneksi');
    } finally {
      setCpLoading(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-sm">
        <Card className="border border-border bg-card/80 shadow-sm overflow-hidden">
          {/* Top accent bar */}
          <div className="h-1 w-full bg-gradient-to-r from-idm-gold via-idm-gold-light to-idm-gold" />

          <CardContent className="p-6">
            {mode === 'login' ? (
              <div key="login">
                {/* Header */}
                <div className="text-center mb-6">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-lg bg-gradient-to-br from-idm-gold/20 to-idm-gold/5 border border-idm-gold/30 flex items-center justify-center">
                    <Shield className="w-7 h-7 text-idm-gold" />
                  </div>
                  <h2 className="text-lg font-bold text-gradient-fury">Admin Login</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Login untuk mengakses panel admin
                  </p>
                </div>

                {/* Login Form */}
                <form onSubmit={handleLogin} className="space-y-4">
                  {/* Username */}
                  <div className="space-y-1.5">
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Username"
                        className="pl-10 h-11 bg-muted/30 border-border focus:border-idm-gold/50 focus:ring-idm-gold/20"
                        disabled={loading}
                        autoComplete="username"
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        className="pl-10 pr-10 h-11 bg-muted/30 border-border focus:border-idm-gold/50 focus:ring-idm-gold/20"
                        disabled={loading}
                        autoComplete="current-password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Error message */}
                  {error && (
                    <div className="text-xs text-red-500 bg-red-500/10 border border-border rounded-lg p-3">
                      {error}
                    </div>
                  )}

                  {/* Submit button */}
                  <Button
                    type="submit"
                    disabled={loading || !username || !password}
                    className="w-full h-11 bg-gradient-to-r from-idm-gold to-idm-gold-light hover:from-idm-gold-light hover:to-idm-gold text-black font-semibold shadow-sm transition-colors"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Shield className="w-4 h-4 mr-2" />
                    )}
                    {loading ? 'Memverifikasi...' : 'Login'}
                  </Button>
                </form>

                {/* Change Password Link */}
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => { setMode('change-password'); setError(''); }}
                    className="text-xs text-muted-foreground hover:text-idm-gold transition-colors inline-flex items-center gap-1.5"
                  >
                    <KeyRound className="w-3 h-3" />
                    Ganti Password
                  </button>
                </div>
              </div>
            ) : (
              <div key="change-password">
                {/* Header */}
                <div className="text-center mb-6">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-lg bg-gradient-to-br from-idm-gold/20 to-idm-gold/5 border border-idm-gold/30 flex items-center justify-center">
                    <KeyRound className="w-7 h-7 text-idm-gold" />
                  </div>
                  <h2 className="text-lg font-bold text-gradient-fury">Ganti Password</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ubah password akun admin Anda
                  </p>
                </div>

                {/* Change Password Form */}
                <form onSubmit={handleChangePassword} className="space-y-3">
                  {/* Username */}
                  <div className="space-y-1">
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={cpUsername}
                        onChange={(e) => setCpUsername(e.target.value)}
                        placeholder="Username"
                        className="pl-10 h-10 bg-muted/30 border-border focus:border-idm-gold/50 focus:ring-idm-gold/20"
                        disabled={cpLoading}
                        autoComplete="username"
                        required
                      />
                    </div>
                  </div>

                  {/* Current Password */}
                  <div className="space-y-1">
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type={cpShowCurrent ? 'text' : 'password'}
                        value={cpCurrentPassword}
                        onChange={(e) => setCpCurrentPassword(e.target.value)}
                        placeholder="Password lama"
                        className="pl-10 pr-10 h-10 bg-muted/30 border-border focus:border-idm-gold/50 focus:ring-idm-gold/20"
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

                  {/* New Password */}
                  <div className="space-y-1">
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type={cpShowNew ? 'text' : 'password'}
                        value={cpNewPassword}
                        onChange={(e) => setCpNewPassword(e.target.value)}
                        placeholder="Password baru (min. 6 karakter)"
                        className="pl-10 pr-10 h-10 bg-muted/30 border-border focus:border-idm-gold/50 focus:ring-idm-gold/20"
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

                  {/* Confirm New Password */}
                  <div className="space-y-1">
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="password"
                        value={cpConfirmPassword}
                        onChange={(e) => setCpConfirmPassword(e.target.value)}
                        placeholder="Konfirmasi password baru"
                        className="pl-10 h-10 bg-muted/30 border-border focus:border-idm-gold/50 focus:ring-idm-gold/20"
                        disabled={cpLoading}
                        autoComplete="new-password"
                        required
                      />
                    </div>
                  </div>

                  {/* Error/Success messages */}
                  {cpError && (
                    <div className="text-xs text-red-500 bg-red-500/10 border border-border rounded-lg p-3">
                      {cpError}
                    </div>
                  )}

                  {cpSuccess && (
                    <div className="text-xs text-green-500 bg-green-500/10 border border-border rounded-lg p-3">
                      {cpSuccess}
                    </div>
                  )}

                  {/* Submit button */}
                  <Button
                    type="submit"
                    disabled={cpLoading || !cpUsername || !cpCurrentPassword || !cpNewPassword || !cpConfirmPassword}
                    className="w-full h-11 bg-gradient-to-r from-idm-gold to-idm-gold-light hover:from-idm-gold-light hover:to-idm-gold text-black font-semibold shadow-sm transition-colors"
                  >
                    {cpLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <KeyRound className="w-4 h-4 mr-2" />
                    )}
                    {cpLoading ? 'Mengubah...' : 'Ubah Password'}
                  </Button>
                </form>

                {/* Back to Login */}
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setCpError(''); setCpSuccess(''); }}
                    className="text-xs text-muted-foreground hover:text-idm-gold transition-colors inline-flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    Kembali ke Login
                  </button>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-5 pt-4 border-t border-border text-center">
              <p className="text-sm text-muted-foreground">
                Area khusus admin • Akses terbatas
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
