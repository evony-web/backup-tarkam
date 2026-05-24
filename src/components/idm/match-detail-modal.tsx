'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Star, Shield, Home, Building2, Crown, ArrowLeft } from 'lucide-react';
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { ClubLogoImage } from './club-logo-image';
import { getAvatarUrl, toStrictDivision } from '@/lib/utils';
import { AvatarMedia } from '@/components/ui/avatar-media';

interface MatchDetailModalProps {
  matchId: string | null;
  onClose: () => void;
  preview?: {
    club1Name: string;
    club2Name: string;
    score1: number | null;
    score2: number | null;
    week: number;
    status: string;
    format: string;
  };
}

interface ClubRosterMember {
  id: string;
  gamertag: string;
  avatar?: string | null;
  tier: string;
  role?: string;
  points: number;
  totalWins: number;
  totalMvp: number;
}

interface MatchDetail {
  id: string;
  week: number;
  score1: number | null;
  score2: number | null;
  status: string;
  format: string;
  mvpPlayer: { id: string; gamertag: string; avatar?: string | null; tier: string } | null;
  club1: {
    id: string;
    name: string;
    logo?: string | null;
    members: ClubRosterMember[];
  };
  club2: {
    id: string;
    name: string;
    logo?: string | null;
    members: ClubRosterMember[];
  };
}

export function MatchDetailModal({ matchId, onClose, preview }: MatchDetailModalProps) {
  const dt = useDivisionTheme();
  const [detail, setDetail] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!matchId) {
      setTimeout(() => setDetail(null), 0);
      return;
    }
    let cancelled = false;
    setTimeout(() => setLoading(true), 0);
    fetch(`/api/league-matches/${matchId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!cancelled && data) setDetail(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [matchId]);

  const isOpen = matchId !== null;
  const data = detail;
  // Use preview data while API loads
  const week = data?.week ?? preview?.week ?? 0;
  const status = data?.status ?? preview?.status ?? 'upcoming';
  const format = data?.format ?? preview?.format ?? 'BO3';
  const score1 = data?.score1 ?? preview?.score1 ?? null;
  const score2 = data?.score2 ?? preview?.score2 ?? null;
  const club1 = data?.club1;
  const club2 = data?.club2;
  const club1Name = club1?.name ?? preview?.club1Name ?? 'Club 1';
  const club2Name = club2?.name ?? preview?.club2Name ?? 'Club 2';
  const mvpPlayer = data?.mvpPlayer ?? null;

  const isCompleted = status === 'completed';
  const isLive = status === 'live';
  const isUpcoming = status === 'upcoming';
  const winner1 = isCompleted && score1 !== null && score2 !== null && score1 > score2;
  const winner2 = isCompleted && score1 !== null && score2 !== null && score2 > score1;

  const statusLabel = isCompleted ? 'Selesai' : isLive ? 'Live' : 'Akan Datang';
  const statusColor = isCompleted
    ? 'bg-green-500/10 text-green-500'
    : isLive
      ? 'bg-red-500/10 text-red-500'
      : `${dt.casinoBadge}`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className={`modal-container modal-container-lg modal-enter-slide p-0 gap-0 overflow-hidden ${dt.division === 'male' ? 'modal-container-male' : dt.division === 'female' ? 'modal-container-female' : ''}`}
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Detail Match</DialogTitle>
        <DialogDescription className="sr-only">Detail pertandingan antar club</DialogDescription>

        {/* Header: Back + Week, Format, Status */}
        <div className={`modal-header ${dt.division === 'male' ? 'modal-header-male' : dt.division === 'female' ? 'modal-header-female' : ''}`}>
          <div className="flex items-center gap-2 mb-2">
            <button onClick={onClose} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-idm-gold-warm transition-colors" aria-label="Kembali">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="font-medium">Kembali</span>
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`${dt.bg} ${dt.text} text-[10px] font-bold`}>Week {week}</Badge>
            <Badge variant="outline" className="text-[10px] font-medium">{format}</Badge>
            <Badge className={`${statusColor} text-[10px] font-bold border-0`}>
              {isLive && (
                <span className="relative flex h-1.5 w-1.5 mr-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                </span>
              )}
              {statusLabel}
            </Badge>
          </div>
        </div>

        {/* Score header */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center justify-center gap-3">
            {/* Club 1 */}
            <div className="flex-1 text-center">
              <div className="w-10 h-10 rounded-2xl overflow-hidden mx-auto mb-1.5 shadow-sm">
                {club1?.logo ? (
                  <ClubLogoImage clubName={club1Name} dbLogo={club1.logo} alt={club1Name} width={40} height={40} className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full ${dt.iconBg} flex items-center justify-center`}>
                    <Shield className={`w-4 h-4 ${dt.text}`} />
                  </div>
                )}
              </div>
              <p className={`text-xs font-bold truncate ${winner1 ? dt.neonText : ''}`}>{club1Name}</p>
              <p className="text-[9px] text-muted-foreground flex items-center justify-center gap-0.5 mt-0.5">
                <Home className="w-2.5 h-2.5" /> Home
              </p>
            </div>
            {/* Score */}
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-2xl font-black tabular-nums ${winner1 ? dt.neonText : ''}`}>
                {isUpcoming ? '-' : (score1 ?? '-')}
              </span>
              <span className="text-sm text-muted-foreground font-medium">:</span>
              <span className={`text-2xl font-black tabular-nums ${winner2 ? dt.neonText : ''}`}>
                {isUpcoming ? '-' : (score2 ?? '-')}
              </span>
            </div>
            {/* Club 2 */}
            <div className="flex-1 text-center">
              <div className="w-10 h-10 rounded-2xl overflow-hidden mx-auto mb-1.5 shadow-sm">
                {club2?.logo ? (
                  <ClubLogoImage clubName={club2Name} dbLogo={club2.logo} alt={club2Name} width={40} height={40} className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full ${dt.iconBg} flex items-center justify-center`}>
                    <Shield className={`w-4 h-4 ${dt.text}`} />
                  </div>
                )}
              </div>
              <p className={`text-xs font-bold truncate ${winner2 ? dt.neonText : ''}`}>{club2Name}</p>
              <p className="text-[9px] text-muted-foreground flex items-center justify-center gap-0.5 mt-0.5">
                <Building2 className="w-2.5 h-2.5" /> Away
              </p>
            </div>
          </div>
        </div>

        {/* Loading indicator */}
        {loading && !data && (
          <div className="py-8 text-center">
            <Loader2 className={`w-5 h-5 mx-auto animate-spin ${dt.text}`} />
            <p className="text-[10px] text-muted-foreground mt-2">Memuat detail...</p>
          </div>
        )}

        {/* MVP Section */}
        {mvpPlayer && (
          <div className="mx-5 mt-3 p-3 sm:p-4 rounded-lg bg-yellow-500/5 border border-yellow-500/10 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-yellow-500/15 flex items-center justify-center shrink-0">
              <Star className="w-3.5 h-3.5 text-yellow-500" />
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-6 h-6 rounded-full overflow-hidden shrink-0">
                <AvatarMedia
                  src={getAvatarUrl(mvpPlayer.gamertag, toStrictDivision(dt.division), mvpPlayer.avatar)}
                  alt={mvpPlayer.gamertag}
                  width={24}
                  height={24}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <span className="text-xs font-bold text-yellow-500 truncate">{mvpPlayer.gamertag}</span>
            </div>
            <Badge className="bg-yellow-500/10 text-yellow-500 text-[8px] border-0 font-bold">MVP</Badge>
          </div>
        )}

        {/* Rosters */}
        {data && (
          <div className="modal-body-compact modal-scroll space-y-4">
            {/* Club 1 Roster */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded overflow-hidden shrink-0">
                  {club1?.logo ? (
                    <ClubLogoImage clubName={club1Name} dbLogo={club1.logo} alt={club1Name} width={20} height={20} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full ${dt.iconBg} flex items-center justify-center`}>
                      <Shield className={`w-2.5 h-2.5 ${dt.text}`} />
                    </div>
                  )}
                </div>
                <span className={`text-xs font-bold ${winner1 ? dt.neonText : ''}`}>{club1Name}</span>
                <span className="text-[9px] text-muted-foreground">— Pemain:</span>
                {winner1 && (
                  <Badge className="bg-green-500/10 text-green-500 text-[8px] border-0 ml-auto">Menang</Badge>
                )}
                {winner2 && (
                  <Badge className="bg-red-500/10 text-red-500 text-[8px] border-0 ml-auto">Kalah</Badge>
                )}
              </div>
              <div className="space-y-1.5">
                {(club1?.members ?? []).map((m) => (
                  <div key={m.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md bg-muted/30">
                    <div className="w-7 h-7 rounded-full overflow-hidden shrink-0">
                      <AvatarMedia
                        src={getAvatarUrl(m.gamertag, toStrictDivision(dt.division), m.avatar)}
                        alt={m.gamertag}
                        width={28}
                        height={28}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <span className="text-xs font-medium flex-1 truncate">{m.gamertag}</span>
                    {m.role === 'captain' && (
                      <Badge className="bg-yellow-500/10 text-yellow-500 text-[8px] border-0 px-1 py-0">
                        <Crown className="w-2.5 h-2.5 mr-0.5" />CPT
                      </Badge>
                    )}
                  </div>
                ))}
                {(!club1?.members || club1.members.length === 0) && (
                  <p className="text-[10px] text-muted-foreground px-2">Belum ada pemain</p>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className={`h-px ${dt.borderSubtle}`} />

            {/* Club 2 Roster */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded overflow-hidden shrink-0">
                  {club2?.logo ? (
                    <ClubLogoImage clubName={club2Name} dbLogo={club2.logo} alt={club2Name} width={20} height={20} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full ${dt.iconBg} flex items-center justify-center`}>
                      <Shield className={`w-2.5 h-2.5 ${dt.text}`} />
                    </div>
                  )}
                </div>
                <span className={`text-xs font-bold ${winner2 ? dt.neonText : ''}`}>{club2Name}</span>
                <span className="text-[9px] text-muted-foreground">— Pemain:</span>
                {winner2 && (
                  <Badge className="bg-green-500/10 text-green-500 text-[8px] border-0 ml-auto">Menang</Badge>
                )}
                {winner1 && (
                  <Badge className="bg-red-500/10 text-red-500 text-[8px] border-0 ml-auto">Kalah</Badge>
                )}
              </div>
              <div className="space-y-1.5">
                {(club2?.members ?? []).map((m) => (
                  <div key={m.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md bg-muted/30">
                    <div className="w-7 h-7 rounded-full overflow-hidden shrink-0">
                      <AvatarMedia
                        src={getAvatarUrl(m.gamertag, toStrictDivision(dt.division), m.avatar)}
                        alt={m.gamertag}
                        width={28}
                        height={28}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <span className="text-xs font-medium flex-1 truncate">{m.gamertag}</span>
                    {m.role === 'captain' && (
                      <Badge className="bg-yellow-500/10 text-yellow-500 text-[8px] border-0 px-1 py-0">
                        <Crown className="w-2.5 h-2.5 mr-0.5" />CPT
                      </Badge>
                    )}
                  </div>
                ))}
                {(!club2?.members || club2.members.length === 0) && (
                  <p className="text-[10px] text-muted-foreground px-2">Belum ada pemain</p>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
