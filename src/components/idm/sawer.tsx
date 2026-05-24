'use client';

import { Heart, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SAWER_TIERS } from '@/lib/skin-utils';

// Reversed so Bronze appears first, Diamond last (ascending order)
const displayTiers = [...SAWER_TIERS].reverse();

const tierDescriptions: Record<string, { skin: string; gradient: string }> = {
  sawer_bronze: {
    skin: 'Frame borderan perunggu yang hangat & elegan',
    gradient: 'from-amber-700 to-amber-500',
  },
  sawer_silver: {
    skin: 'Kilau perak yang memukau dengan efek shimmer',
    gradient: 'from-gray-400 to-gray-200',
  },
  sawer_gold: {
    skin: 'Aura emas berkilau dengan glow yang memikat',
    gradient: 'from-yellow-500 to-amber-400',
  },
  sawer_diamond: {
    skin: 'Efek diamond penuh dengan glow cyan yang megah',
    gradient: 'from-cyan-400 to-cyan-200',
  },
};

function formatRupiah(amount: number): string {
  return `Rp ${(amount / 1000).toFixed(0)}K`;
}

export function Sawer() {
  return (
    <section className="relative py-20 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="bg-gradient-to-b from-stone-50 via-white to-stone-50 dark:from-background dark:via-background dark:to-background" />

      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <Heart className="w-12 h-12 mx-auto mb-4 text-pink-500 fill-pink-500" />
          <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-2">
            SAWER & <span className="text-pink-500">DONASI</span>
          </h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Dukung turnamen esports favoritmu dan bantu komunitas gaming Indonesia berkembang!
          </p>
        </div>

        {/* Sawer Tiers */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {displayTiers.map((tier) => {
            const desc = tierDescriptions[tier.type];
            return (
              <Card
                key={tier.type}
                className="relative overflow-hidden bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-800 hover:border-pink-500/50 transition-all group"
              >
                <CardHeader className="text-center">
                  <div className={`w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br ${desc?.gradient ?? 'from-gray-500 to-gray-400'} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                    <span className="text-3xl">{tier.icon}</span>
                  </div>
                  <CardTitle className="text-xl text-gray-900 dark:text-white">
                    {tier.label} Sawer
                  </CardTitle>
                  <p className="text-2xl font-bold text-pink-500">≥ {formatRupiah(tier.minAmount)}</p>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-gray-600 dark:text-gray-400 mb-3">{desc?.skin}</p>
                  <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 dark:text-gray-500 mb-4">
                    <Info className="w-3.5 h-3.5" />
                    <span>Skin 1 minggu · Badge permanen</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Info Banner */}
        <Card className="bg-gradient-to-r from-pink-500/10 to-purple-500/10 border-pink-500/30">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-center">
              <Heart className="w-8 h-8 text-pink-500 fill-pink-500 shrink-0" />
              <div>
                <p className="text-gray-900 dark:text-white font-semibold mb-1">
                  Semua tier sawer mendapat skin profil selama 1 minggu
                </p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Badge sawer bersifat permanen — semakin tinggi tier, semakin megah skin yang kamu dapatkan!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
