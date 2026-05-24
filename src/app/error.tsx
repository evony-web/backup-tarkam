'use client';

import { useEffect } from 'react';

/**
 * Global Error Boundary — catches unhandled runtime errors
 * and displays a branded recovery page instead of a white screen.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html lang="id">
      <body className="bg-background text-foreground min-h-screen flex items-center justify-center overflow-hidden">
        <div className="max-w-md mx-auto px-6 text-center space-y-6">
          {/* Logo */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 flex items-center justify-center">
              <span className="text-2xl">⚔️</span>
            </div>
          </div>

          {/* Error Message */}
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-amber-400">
              Terjadi Kesalahan
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Aplikasi mengalami error yang tidak terduga. Tim kami sudah menerima notifikasi tentang masalah ini.
            </p>
            {error?.message && (
              <p className="text-xs text-muted-foreground/60 font-mono bg-muted/50 rounded-lg px-3 py-2 mt-3 break-all">
                {error.message}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={reset}
              className="w-full px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold text-sm hover:from-amber-400 hover:to-amber-500 transition-all cursor-pointer"
            >
              Coba Lagi
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="w-full px-6 py-2.5 rounded-xl border border-border text-muted-foreground text-sm hover:bg-muted transition-colors cursor-pointer"
            >
              Kembali ke Beranda
            </button>
          </div>

          {/* Footer */}
          <p className="text-[10px] text-muted-foreground/40">
            TARKAM IDM — Fan Made Edition
          </p>
        </div>
      </body>
    </html>
  );
}
