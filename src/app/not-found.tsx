'use client';

import Image from 'next/image';
import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};
function useIsMounted() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

/**
 * Custom 404 page — branded, animated, with quick navigation links.
 */
export default function NotFound() {
  const mounted = useIsMounted();

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center overflow-hidden relative">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-amber-500/3 blur-3xl" />
      </div>

      <div
        className={`relative z-10 max-w-lg mx-auto px-6 text-center space-y-8 transition-all duration-700 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        {/* Logo */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-2xl overflow-hidden ring-2 ring-amber-500/20 shadow-lg shadow-amber-500/10">
            <Image
              src="/logo1.webp"
              alt="TARKAM IDM"
              width={80}
              height={80}
              className="w-full h-full object-cover"
              priority
            />
          </div>
        </div>

        {/* 404 */}
        <div className="space-y-2">
          <h1 className="text-7xl font-black bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
            404
          </h1>
          <h2 className="text-lg font-bold text-muted-foreground">Halaman Tidak Ditemukan</h2>
          <p className="text-sm text-muted-foreground/70 leading-relaxed max-w-sm mx-auto">
            Maaf, halaman yang kamu cari tidak ada atau sudah dipindahkan. Coba kembali ke beranda atau gunakan navigasi di bawah.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="/"
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold text-sm hover:from-amber-400 hover:to-amber-500 transition-all text-center"
          >
            Kembali ke Beranda
          </a>
        </div>

        {/* Quick Links */}
        <div className="pt-4 border-t border-border">
          <p className="text-[10px] text-muted-foreground/50 mb-3 uppercase tracking-wider">Navigasi Cepat</p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              { label: 'Leaderboard', href: '/#kompetisi' },
              { label: 'Champions', href: '/#champions' },
              { label: 'MVP', href: '/#mvp' },
              { label: 'Clubs', href: '/#clubs' },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="px-3 py-1.5 rounded-lg border border-border text-muted-foreground text-xs hover:text-idm-gold hover:border-idm-gold/30 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-[10px] text-muted-foreground/40">
          © 2026 TARKAM IDM — Idol Meta
        </p>
      </div>
    </div>
  );
}
