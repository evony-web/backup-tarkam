'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Shield, Eye, EyeOff, Lock, User, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAdminAuth } = useAppStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      if (data.success && data.user) {
        setAdminAuth({ isAuthenticated: true, admin: data.user });
      } else {
        setError('Unexpected response');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-idm-gold/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-idm-amber/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-idm-gold/[0.02] rounded-full blur-3xl" />
      </div>

      <div
        className="relative z-10 w-full max-w-md animate-fade-enter"
      >
        <Card className="card-premium overflow-visible">
          <CardContent className="p-8">
            {/* Logo & Header */}
            <div
              className="text-center mb-8 animate-fade-enter-sm"
              style={{ animationDelay: '0.1s' }}
            >
              <div className="mx-auto w-16 h-16 rounded-2xl overflow-hidden glow-pulse mb-4">
                <Image src="/logo1.webp" alt="IDM League" width={64} height={64} className="w-full h-full object-cover" priority />
              </div>
              <h1 className="text-2xl font-bold text-gradient-fury mb-1">IDM League</h1>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Shield className="w-4 h-4 text-idm-gold" />
                <span>Admin Panel</span>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Username Field */}
              <div
                className="animate-fade-enter-sm"
                style={{ animationDelay: '0.2s' }}
              >
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10 h-11 bg-muted/50 border-border/50 focus:border-idm-gold/50 focus:ring-idm-gold/20"
                    autoComplete="username"
                    disabled={loading}
                    required
                  />
                </div>
              </div>
              <div
                className="animate-fade-enter-sm"
                style={{ animationDelay: '0.3s' }}
              >
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-11 bg-muted/50 border-border/50 focus:border-idm-gold/50 focus:ring-idm-gold/20"
                    autoComplete="current-password"
                    disabled={loading}
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
              {error && (
                <div
                  className="flex items-center gap-2 p-4 sm:p-5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm animate-fade-enter-sm"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Button */}
              <div
                className="animate-fade-enter-sm"
                style={{ animationDelay: '0.4s' }}
              >
                <Button
                  type="submit"
                  disabled={loading || !username || !password}
                  className="w-full h-11 text-sm font-semibold bg-gradient-to-r from-idm-gold to-idm-amber hover:from-idm-amber hover:to-idm-gold text-white shadow-lg hover:shadow-xl transition-all duration-300 gold-glow disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Signing in...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Sign In
                    </span>
                  )}
                </Button>
              </div>
            </form>

            {/* Footer */}
            <div
              className="mt-6 text-center animate-fade-enter-sm"
              style={{ animationDelay: '0.6s' }}
            >
              <div className="section-divider !my-4" />
              <p className="text-[10px] text-muted-foreground">
                IDM League Admin • Fan Made Edition © 2025
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
