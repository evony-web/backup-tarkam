'use client';

import { AvatarMedia } from '@/components/ui/avatar-media';
import { Crown, Flame } from 'lucide-react';
import { SkinBadgesRow, SkinAvatarFrame, SkinName, SkinCardBorder } from './skin-renderer';
import { getPrimarySkin, sortSkinsByPriority, filterActiveSkins, type PlayerSkinWithDetails } from '@/lib/skin-utils';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { useAppStore } from '@/lib/store';
import { getAvatarUrl, clubToString, toStrictDivision } from '@/lib/utils';

interface PlayerCardProps {
  gamertag: string;
  avatar?: string | null;
  tier?: string; // Tier is hidden from players — only used internally for admin
  points: number;
  totalWins: number;
  totalLosses?: number;
  totalMvp: number;
  streak: number;
  rank?: number;
  isMvp?: boolean;
  club?: string | { id: string; name: string; logo?: string | null } | null;
  /** Skins array — only provided for the logged-in player */
  skins?: PlayerSkinWithDetails[];
  /** Override default aspect ratio (3/4). Use e.g. '1/1' for square, '4/3' for landscape */
  aspectRatio?: string;
  onClick?: () => void;
}

export function PlayerCard({
  gamertag, avatar, tier, points, totalWins, totalLosses, totalMvp, streak, rank, isMvp, club, skins, aspectRatio, onClick
}: PlayerCardProps) {
  const isChampion = rank === 1;
  const isTop3 = rank !== undefined && rank <= 3;
  const dt = useDivisionTheme();
  const division = useAppStore(s => s.division);
  const avatarSrc = getAvatarUrl(gamertag, toStrictDivision(division), avatar);
  const primarySkin = skins && skins.length > 0 ? getPrimarySkin(skins) : null;

  // ═══ LAYERED SKIN SYSTEM for PlayerCard ═══
  // Layer 1 (highest priority) → Frame/border
  // Layer 2 (second priority)  → Corner sparkles/twinkle
  // NOTE: Layer 3 (inner traveling line) REMOVED — disturbs the photo view
  const layerSkins = skins && skins.length > 0
    ? sortSkinsByPriority(filterActiveSkins(skins as PlayerSkinWithDetails[]))
    : [];
  const frameSkin = layerSkins[0] || primarySkin || null;
  const secondarySkin = layerSkins[1] || null;

  const cardContent = (
    <>
      {/* Full avatar card background */}
      <AvatarMedia src={avatarSrc} alt={gamertag} fill sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 250px" className="absolute inset-0 object-cover transition-transform duration-500 hover:scale-105" objectPosition="center 25%" loading="lazy" />

      {/* Dark overlay gradient for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-transparent" />

      {/* Division color tint overlay */}
      <div className="absolute inset-0" style={{
        background: division === 'male'
          ? 'radial-gradient(ellipse at 50% 30%, rgba(87,181,255,0.08) 0%, transparent 60%)'
          : 'radial-gradient(ellipse at 50% 30%, rgba(255,92,154,0.08) 0%, transparent 60%)'
      }} />

      {/* Champion gold accent line */}
      <div className={`absolute top-0 inset-x-0 h-1 ${
        isChampion ? 'bg-gradient-to-r from-transparent via-yellow-500 to-transparent' :
        'bg-gradient-to-r from-transparent via-white/20 to-transparent'
      }`} />

      {/* Rank badge — removed: no longer shown on any screen size */}

      {/* MVP indicator top-left */}
      {isMvp && (
        <div className="absolute top-2 left-2 z-10">
          <div className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <Crown className="w-3.5 h-3.5 text-yellow-400 drop-shadow-[0_0_4px_rgba(234,179,8,0.5)]" />
          </div>
        </div>
      )}

      {/* Skin badges top-right (below rank badge) */}
      {skins && skins.length > 0 && (
        <div className="absolute top-9 right-2 z-10">
          <SkinBadgesRow skins={skins} hideSawerAndDonorBadges={skins.some(s => s.type === 'sultan_weekly')} />
        </div>
      )}

      {/* Champion glow border */}
      {isChampion && !primarySkin && (
        <div
          className="absolute inset-0 rounded-3xl border-2 border-yellow-500/30 animate-pulse"
        />
      )}

      {/* Bottom info overlay — compact single-line name|tier on mobile */}
      <div className="absolute bottom-0 inset-x-0 p-3 sm:p-4 z-10">
        {/* Gamertag + Tier in one line */}
        <div className="flex items-center gap-1.5">
          <SkinName skin={primarySkin}>
            <p className={`font-bold text-xs sm:text-sm truncate text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] ${
              isChampion ? 'text-idm-gold-warm' : ''
            }`}>{gamertag}</p>
          </SkinName>

        </div>

        {/* Club — hidden on mobile to keep overlay minimal */}
        {clubToString(club as any) && <span className="hidden sm:inline text-[9px] text-white/50 truncate mt-0.5">{clubToString(club as any)}</span>}

        {/* Stats row */}
        <div className={`flex items-center gap-2 mt-2 pt-2 border-t border-white/10`}>
          <span className={`text-[10px] font-bold ${dt.text}`}>{points}<span className="text-[8px] opacity-50 ml-0.5">pts</span></span>
          <span className="text-[10px] text-white/20">·</span>
          <span className="text-[10px] font-bold text-green-400">{totalWins}W</span>
          {totalLosses !== undefined && (
            <>
              <span className="text-[10px] text-white/20">·</span>
              <span className="text-[10px] font-bold text-red-400">{totalLosses}L</span>
            </>
          )}
          <span className="text-[10px] text-white/20">·</span>
          <div className="flex items-center gap-0.5">
            {streak > 1 && <Flame className="w-2.5 h-2.5 text-orange-400" />}
            <span className="text-[10px] font-bold">{streak > 1 ? streak : totalMvp}</span>
            <span className="text-[8px] text-white/40 ml-0.5">{streak > 1 ? 'STREAK' : 'MVP'}</span>
          </div>
        </div>
      </div>

      {/* Hover border glow — Apple style subtle */}
      <div className={`absolute inset-0 rounded-2xl border transition-all duration-300 ${
        division === 'male' ? 'border-[#2E9FFF]/0 hover:border-[#2E9FFF]/20' : 'border-[#FF2D78]/0 hover:border-[#FF2D78]/20'
      }`} />
    </>
  );

  return (
    <div
      onClick={onClick}
      className={`perspective-card hover-scale-md relative rounded-2xl cursor-pointer transition-all overflow-hidden cinema-card premium-hover ${
        isChampion ? dt.neonPulse : ''
      }`}
      style={{ aspectRatio: aspectRatio || '3/4' }}
    >
      {frameSkin ? (
        <SkinCardBorder skin={frameSkin} secondarySkin={secondarySkin}>
          {cardContent}
        </SkinCardBorder>
      ) : (
        cardContent
      )}
    </div>
  );
}
