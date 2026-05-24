'use client';


import Image from 'next/image';
import { Users, Shield, Trophy, Crown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { useBackgroundImages } from '@/hooks/use-background-images';

interface NoSeasonStateProps {
  division: 'male' | 'female';
}

export function NoSeasonState({ division }: NoSeasonStateProps) {
  const dt = useDivisionTheme();
  const { bgMale, bgFemale } = useBackgroundImages();

  return (
    <div className="stagger-item-subtle">
      <div className={`relative rounded-2xl overflow-hidden ${dt.casinoCard} min-h-[420px]`}>
        <div className={dt.casinoBar} />
        {/* Background image */}
        <div className="absolute inset-0">
          <Image
            src={division === 'male' ? bgMale : bgFemale}
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-[center_20%]"
            aria-hidden="true"
            loading="lazy"
          />
        </div>
        <div className="casino-img-overlay" />
        {/* Decorative glow orb */}
        <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full blur-3xl ${dt.bg} opacity-20`} />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center py-16 px-6 min-h-[420px]">
          {/* Animated icon cluster — CSS-only */}
          <div className="stagger-item stagger-d0 relative mb-8">
            <div className={`w-24 h-24 rounded-3xl bg-gradient-to-br from-idm-gold-warm/30 to-idm-amber/20 ${dt.border} flex items-center justify-center`}>
              <Trophy className={`w-10 h-10 ${dt.neonText}`} />
            </div>
            {/* Floating accent icons — CSS animation */}
            <div className={`animate-float absolute -top-2 -right-2 w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500/30 to-amber-500/20 border border-yellow-500/20 flex items-center justify-center`}>
              <Crown className="w-4 h-4 text-yellow-400" />
            </div>
            <div className={`animate-float absolute -bottom-2 -left-2 w-8 h-8 rounded-lg bg-gradient-to-br from-green-500/30 to-emerald-500/20 border border-green-500/20 flex items-center justify-center`} style={{ animationDelay: '1s' }}>
              <Shield className="w-4 h-4 text-green-400" />
            </div>
          </div>

          {/* Division badge */}
          <Badge className={`${dt.casinoBadge} px-3 py-1 mb-4 stagger-item stagger-d1`}>
            {division === 'male' ? '🕺 Tarkam Cowo' : '💃 Tarkam Cewe'}
          </Badge>

          {/* Main heading */}
          <h2 className={`stagger-item stagger-d2 text-2xl lg:text-3xl font-black ${dt.neonGradient} mb-3`}>
            Season Belum Dimulai
          </h2>

          {/* Description */}
          <p className="stagger-item stagger-d3 text-sm text-muted-foreground max-w-md mb-8 leading-relaxed">
            Belum ada season aktif untuk tarkam {division === 'male' ? 'Cowo' : 'Cewe'} saat ini.
            Season baru akan dimulai oleh admin, dan kamu bisa mendaftar sebagai peserta begitu pendaftaran dibuka.
          </p>

          {/* Info cards — what to expect */}
          <div className="stagger-item stagger-d4 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg">
            {[
              { icon: Users, label: 'Daftar Peserta', desc: 'Bergabung saat pendaftaran dibuka' },
              { icon: Shield, label: 'Tim & Klub', desc: 'Masuk ke tim dan bermain bersama' },
              { icon: Trophy, label: 'Kompetisi', desc: 'Berlaga setiap pekan untuk menang' },
            ].map((step, i) => (
              <div key={i} className={`p-3 sm:p-4 rounded-2xl ${dt.bgSubtle} ${dt.border} text-center`}>
                <step.icon className={`w-5 h-5 mx-auto mb-1.5 ${dt.neonText}`} />
                <p className="text-xs font-semibold">{step.label}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
