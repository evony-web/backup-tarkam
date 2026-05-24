'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  Users, Shield, Calendar, Zap, Gamepad2, Gift, Award,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PlayerProfile } from '../player-profile';
import { DonationModal } from '../donation-modal';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { useBackgroundImages } from '@/hooks/use-background-images';
import { useAppStore } from '@/lib/store';
import { useQuery } from '@tanstack/react-query';
import { getAvatarUrl, clubToString, toStrictDivision } from '@/lib/utils';
import type { StatsData } from '@/types/stats';

interface NoTournamentStateProps {
  data: StatsData;
  setSelectedPlayer: (player: any) => void;
}

export function NoTournamentState({ data, setSelectedPlayer }: NoTournamentStateProps) {
  const { division } = useAppStore();
  const dt = useDivisionTheme();
  const { bgMale, bgFemale } = useBackgroundImages();

  // Local state for selected player within this component
  const [localSelectedPlayer, setLocalSelectedPlayer] = useState<StatsData['topPlayers'][0] | null>(null);
  const [donationOpen, setDonationOpen] = useState(false);

  // CMS settings for donation modal
  const { data: cms } = useQuery<Record<string, string>>({
    queryKey: ['cms-content'],
    queryFn: async () => {
      const res = await fetch('/api/cms/content');
      if (!res.ok) return { settings: {}, sections: {} };
      return res.json();
    },
    select: (data) => data.settings || {},
  });

  const handlePlayerClick = (p: StatsData['topPlayers'][0]) => {
    setSelectedPlayer(p);
    setLocalSelectedPlayer(p);
  };

  return (
    <div className="stagger-item space-y-5">
      {/* Season Banner — shows that season IS active */}
      <div className={`relative rounded-2xl overflow-hidden ${dt.casinoCard} min-h-[220px]`}>
        <div className={dt.casinoBar} />
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
        <div className={`absolute top-1/3 right-1/4 w-64 h-64 rounded-full blur-3xl ${dt.bg} opacity-20`} />
        <div className={`absolute top-3 left-3 ${dt.cornerAccent}`} />
        <div className={`absolute top-3 right-3 rotate-90 ${dt.cornerAccent}`} />
        <div className="absolute bottom-4 left-5 right-5 z-10">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={`${dt.casinoBadge} px-2 py-0.5`}>
              Season {data.season?.number || 1}
            </Badge>
            <Badge className={`${dt.divisionBadge} px-2 py-0.5`}>
              {division === 'male' ? 'Cowo' : 'Cewe'}
            </Badge>
            <Badge className="bg-green-500/15 text-green-400 border border-green-500/20 text-[9px]">AKTIF</Badge>
          </div>
          <h2 className={`text-2xl lg:text-3xl font-black ${dt.neonGradient}`}>{data.season?.name || `Season ${data.season?.number || 1}`}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Tarkam {division === 'male' ? 'Cowo' : 'Cewe'} sedang berlangsung</p>
        </div>
      </div>

      {/* Waiting State Card */}
      <div className={`rounded-2xl ${dt.casinoCard} overflow-hidden`}>
        <div className={dt.casinoBar} />
        <div className="p-6 sm:p-8">
          <div className="flex flex-col items-center text-center">
            {/* Animated waiting illustration — CSS-only */}
            <div className="stagger-item stagger-d0 relative mb-6">
              <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br from-idm-gold-warm/20 to-idm-amber/10 ${dt.border} flex items-center justify-center`}>
                <Calendar className={`w-8 h-8 ${dt.neonText}`} />
              </div>
              {/* Pulsing dot — CSS live-dot */}
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full live-dot bg-idm-gold-warm" />
            </div>

            <h3 className={`stagger-item stagger-d1 text-xl font-bold ${dt.neonGradient} mb-2`}>Turnamen Belum Dimulai</h3>
            <p className="stagger-item stagger-d2 text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
              Season sudah aktif, tapi turnamen belum dibuat oleh admin.
              Nantikan info selanjutnya — pendaftaran dan jadwal pertandingan akan segera diumumkan.
            </p>

            {/* What's happening now */}
            <div className="stagger-item stagger-d3 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md">
              {/* Players count */}
              <div className={`p-4 rounded-2xl ${dt.bgSubtle} ${dt.border} text-left`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-lg ${dt.iconBg} flex items-center justify-center`}>
                    <Users className={`w-3.5 h-3.5 ${dt.neonText}`} />
                  </div>
                  <span className="text-xs font-semibold">Peserta Terdaftar</span>
                </div>
                <p className={`text-2xl font-bold ${dt.neonGradient}`}>{data.totalPlayers || 0}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">player sudah terdaftar di season ini</p>
              </div>

              {/* Clubs count */}
              <div className={`p-4 rounded-2xl ${dt.bgSubtle} ${dt.border} text-left`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-lg ${dt.iconBg} flex items-center justify-center`}>
                    <Shield className={`w-3.5 h-3.5 ${dt.neonText}`} />
                  </div>
                  <span className="text-xs font-semibold">Klub Terbentuk</span>
                </div>
                <p className={`text-2xl font-bold ${dt.neonGradient}`}>{data.clubs?.length || 0}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">klub siap bertanding</p>
              </div>
            </div>

            {/* Season progress preview */}
            <div className={`stagger-item stagger-d4 w-full max-w-md mt-4 p-4 rounded-2xl ${dt.bgSubtle} ${dt.border}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold">Progress Season</span>
                <span className={`text-xs font-bold ${dt.neonText}`}>{data.seasonProgress?.percentage || 0}%</span>
              </div>
              <Progress value={data.seasonProgress?.percentage || 0} className="h-2" />
              <div className="flex items-center justify-between mt-2 text-[9px] text-muted-foreground">
                <span>0/{data.seasonProgress?.totalWeeks || 10} minggu selesai</span>
                <span>Season {data.season?.number || 1}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick links — what you can do while waiting */}
      <div className={`rounded-2xl ${dt.casinoCard} overflow-hidden`}>
        <div className={dt.casinoBar} />
        <div className={`flex items-center gap-2.5 px-4 py-3 border-b ${dt.borderSubtle}`}>
          <div className={`w-5 h-5 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
            <Zap className={`w-3 h-3 ${dt.neonText}`} />
          </div>
          <h3 className="text-xs font-semibold uppercase tracking-wider">Yang Bisa Kamu Lakukan</h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                icon: Gamepad2,
                title: 'Daftar Sebagai Peserta',
                desc: 'Daftarkan dirimu untuk bergabung di season ini. Admin akan menyetujui dan menempatkanmu di tim.',
                action: 'Daftar Sekarang',
                onClick: () => {},
              },
              {
                icon: Users,
                title: 'Lihat Peserta Lain',
                desc: 'Cek siapa saja yang sudah mendaftar. Kamu bisa melihat profil dan tier masing-masing peserta.',
                action: 'Lihat Peserta',
                onClick: () => {},
              },
              {
                icon: Gift,
                title: 'Donasi & Sawer',
                desc: 'Bantu tambah prize pool season ini dengan menyawer. Semua saweran akan masuk ke hadiah turnamen.',
                action: 'Sawer Sekarang',
                onClick: () => setDonationOpen(true),
              },
            ].map((item, i) => (
              <div
                key={i}
                className={`stagger-item p-4 rounded-2xl ${dt.bgSubtle} ${dt.border} ${dt.hoverBorder} transition-colors cursor-pointer group`}
                style={{ animationDelay: `${i * 80}ms` }}
                onClick={item.onClick}
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-idm-gold-warm/20 to-idm-amber/10 border border-idm-gold-warm/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <item.icon className={`w-4 h-4 ${dt.neonText}`} />
                </div>
                <p className="text-xs font-bold mb-1">{item.title}</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed mb-2">{item.desc}</p>
                <span className={`text-[10px] font-semibold ${dt.neonText} group-hover:underline`}>{item.action} →</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Registered players preview (if any) */}
      {data.topPlayers && data.topPlayers.length > 0 && (
        <div className={`rounded-2xl ${dt.casinoCard} overflow-hidden`}>
          <div className={dt.casinoBar} />
          <div className={`flex items-center gap-2.5 px-4 py-3 border-b ${dt.borderSubtle}`}>
            <div className={`w-5 h-5 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
              <Award className={`w-3 h-3 ${dt.neonText}`} />
            </div>
            <h3 className="text-xs font-semibold uppercase tracking-wider">Peserta Terdaftar</h3>
            <Badge className={`${dt.casinoBadge} ml-auto text-[9px]`}>{data.topPlayers.length}</Badge>
          </div>
          <div className="p-4">
            <div className="space-y-2">
              {data.topPlayers.slice(0, 8).map((p, idx) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${dt.hoverBorder} ${dt.hoverBgSubtle}`}
                  onClick={() => handlePlayerClick(p)}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                    idx === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                    idx === 1 ? 'bg-gray-400/20 text-muted-foreground' :
                    idx === 2 ? 'bg-amber-600/20 text-amber-600' :
                    `${dt.bgSubtle} text-muted-foreground`
                  }`}>
                    {idx + 1}
                  </span>
                  <div className={`w-7 h-7 rounded-full overflow-hidden shrink-0`}>
                    <Image
                      src={getAvatarUrl(p.gamertag, toStrictDivision(division), p.avatar)}
                      alt={p.gamertag}
                      width={28}
                      height={28}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{p.gamertag}</p>
                    {clubToString(p.club as any) && (
                      <p className="text-[9px] text-muted-foreground truncate flex items-center gap-0.5">
                        <Shield className="w-2.5 h-2.5" />
                        {clubToString(p.club as any)}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{p.points} pts</span>
                </div>
              ))}
            </div>
            {data.topPlayers.length > 8 && (
              <p className={`text-[10px] text-center mt-3 ${dt.neonText}`}>+{data.topPlayers.length - 8} peserta lainnya</p>
            )}
          </div>
        </div>
      )}

      {/* Player Profile Dialog */}
      {localSelectedPlayer && (
        <PlayerProfile
          player={{ ...localSelectedPlayer, name: localSelectedPlayer.gamertag, maxStreak: 0, matches: 0, division: localSelectedPlayer.division || division }}
          onClose={() => setLocalSelectedPlayer(null)}
          skinMap={data?.skinMap}
        />
      )}

      {/* Donation Modal — Sawer Prize Pool */}
      <DonationModal
        open={donationOpen}
        onOpenChange={setDonationOpen}
        defaultType="weekly"
        cmsSettings={cms || {}}
      />
    </div>
  );
}
