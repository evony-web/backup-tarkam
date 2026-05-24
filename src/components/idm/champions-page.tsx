'use client';

import { Trophy } from 'lucide-react';

export function ChampionsPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center py-20">
        <Trophy className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-sm text-muted-foreground/60">Konten season telah dipindahkan ke menu Juara</p>
      </div>
    </div>
  );
}
