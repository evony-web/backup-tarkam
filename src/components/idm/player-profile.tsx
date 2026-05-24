'use client';

import Image from 'next/image';
import { AvatarMedia } from '@/components/ui/avatar-media';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, X, Trophy, Flame, Crown, Shield, Target,
  TrendingUp, Award, Calendar, Star, BarChart3,
  Activity, MapPin, Users, Swords, ChevronDown, ChevronUp
} from 'lucide-react';
import { SkinBadgesRow, SkinName } from './skin-renderer';
import { getPrimarySkin, resolveSkinColors, getSkinTwinkle, sortSkinsByPriority, filterActiveSkins } from '@/lib/skin-utils';
import type { PlayerSkinInfo } from '@/types/stats';
import type { SkinColors, PlayerSkinWithDetails } from '@/lib/skin-utils';
import { Badge } from '@/components/ui/badge';
import { getDivisionTheme } from '@/hooks/use-division-theme';
import { useBackgroundImages } from '@/hooks/use-background-images';
import { useAppStore } from '@/lib/store';
import { getAvatarUrl, hashString, clubToString, isVideoUrl } from '@/lib/utils';
import { AchievementList } from './achievement-badge';
import { SocialShareButton } from './social-share-button';
import { PlayerSeasonHistory } from './player-season-history';
import { ClubLogoImage } from './club-logo-image';
import { TierProgress } from './ui/tier-progress';

interface PlayerProfileProps {
  player: {
    id: string;
    name: string;
    gamertag: string;
    avatar?: string | null;
    tier: string;
    points: number;
    totalWins: number;
    totalMvp: number;
    streak: number;
    maxStreak: number;
    matches: number;
    club?: string | { id: string; name: string; logo?: string | null } | null;
    division?: string;
    city?: string;
  };
  onClose: () => void;
  rank?: number;
  /** Map of playerId → skins[] from stats API, for showing any player's skins */
  skinMap?: Record<string, PlayerSkinInfo[]>;
  /** When set, this skin type is preferred over the highest-priority skin.
   *  Used when opening profile from a specific context (e.g. MVP card → show MVP skin). */
  preferredSkinType?: string;
}

/* ─── Procedural Player Banner — uses AI-generated division background ─── */
function PlayerBanner({ gamertag, division, rank, city }: {
  gamertag: string; division: string; rank?: number; city?: string
}) {
  const hash = hashString(gamertag);
  const isMale = division === 'male';
  const primaryColor = isMale ? '#57B5FF' : '#FF5C9A';
  const secondaryColor = isMale ? '#2E9FFF' : '#FF2D78';
  const { bgMale, bgFemale } = useBackgroundImages();
  const bgImage = isMale ? bgMale : bgFemale;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Layer 1: AI-generated division background image */}
      {bgImage && <Image src={bgImage} alt="" fill sizes="100vw" className="absolute inset-0 object-cover" aria-hidden="true" loading="lazy" />}

      {/* Layer 2: Dark overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-br from-background/70 via-background/50 to-background/80" />

      {/* Layer 3: Division color tint */}
      <div className="absolute inset-0" style={{
        background: `radial-gradient(ellipse at 70% 30%, ${primaryColor}15 0%, transparent 60%),
                     radial-gradient(ellipse at 20% 80%, ${secondaryColor}10 0%, transparent 50%)`,
      }} />

      {/* Layer 4: SVG procedural overlay for depth */}
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
        {/* Large watermark gamertag */}
        <text x="97%" y="96%" textAnchor="end" dominantBaseline="auto"
          fill={primaryColor} fontSize="80" fontWeight="900" opacity="0.06"
          fontFamily="system-ui" letterSpacing="-2">
          {(city || gamertag).toUpperCase()}
        </text>

        {/* Corner brackets */}
        <line x1="0" y1="0" x2="35%" y2="0" stroke={primaryColor} strokeWidth="2.5" opacity="0.25" />
        <line x1="0" y1="0" x2="0" y2="35%" stroke={primaryColor} strokeWidth="2.5" opacity="0.25" />
        <line x1="100%" y1="100%" x2="65%" y2="100%" stroke={primaryColor} strokeWidth="2.5" opacity="0.25" />
        <line x1="100%" y1="100%" x2="100%" y2="65%" stroke={primaryColor} strokeWidth="2.5" opacity="0.25" />
      </svg>

      {/* Layer 5: Large rank number watermark */}
      <div className="absolute -right-2 -bottom-6 select-none pointer-events-none">
        <span className={`text-[140px] font-black leading-none ${
          isMale ? 'text-idm-male/[0.04]' : 'text-idm-female/[0.04]'
        }`}>
          {rank || '#'}
        </span>
      </div>

      {/* Layer 6: Vignette/depth overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/15 via-transparent to-background/15" />
    </div>
  );
}

/* ─── Stat Block — Dance Tournament HUD style ─── */
function StatBlock({ icon: Icon, label, value, sub, color, highlight, size = 'normal', playerDivision }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  highlight?: boolean;
  size?: 'normal' | 'large';
  playerDivision: 'male' | 'female';
}) {
  const dt = getDivisionTheme(playerDivision);
  return (
    <div className={`relative rounded-2xl p-3 text-center transition-all overflow-hidden ${
      highlight ? `${dt.bgSubtle} border ${dt.border}` : `bg-muted/10 border border-border/10`
    }`}>
      {/* Background decoration for highlighted stat */}
      {highlight && (
        <div className={`absolute inset-0 opacity-5`}>
          <div className={`absolute -right-3 -top-3 w-16 h-16 rounded-full ${playerDivision === 'male' ? 'bg-idm-male' : 'bg-idm-female'}`} />
        </div>
      )}
      <div className="relative z-10">
        <Icon className={`w-4 h-4 ${color} mx-auto mb-1.5`} />
        <p className={`font-black ${size === 'large' ? 'text-xl' : 'text-lg'} ${highlight ? dt.neonGradient : ''}`}>{value}</p>
        <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">{label}</p>
        {sub && <p className="text-[8px] text-muted-foreground/70 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export function PlayerProfile({ player, onClose, rank, skinMap, preferredSkinType }: PlayerProfileProps) {
  const storeDivision = useAppStore(s => s.division);
  const playerAuth = useAppStore(s => s.playerAuth);
  // Use the PLAYER's actual division, NOT the currently selected UI division
  // This prevents showing "Divisi Male" when viewing a female player's profile
  const playerDivision = player.division || storeDivision;
  // CRITICAL: Use the player's division for theming, not the store's current division
  // This ensures male players always show cyan and female players always show purple
  const dt = getDivisionTheme(playerDivision as 'male' | 'female');

  // ═══ Auto-enrich player data from API ═══
  // Many callers pass incomplete data (matches: 0, weekly stats instead of totals, etc.)
  // Always fetch authoritative data from the player API so the modal shows correct
  // winrate/stats regardless of what the caller passes. Uses 60s cache to avoid
  // redundant fetches when the same player is opened repeatedly.
  const { data: enrichedPlayerData } = useQuery({
    queryKey: ['player-detail', player.id],
    queryFn: async () => {
      const res = await fetch(`/api/players/${player.id}`);
      if (!res.ok) return null;
      return res.json();
    },
    // Always fetch — callers may pass wrong data (weekly stats, zeros, missing fields)
    enabled: !!player.id,
    staleTime: 60_000,
    gcTime: 60_000,
  });

  // Merge enriched data: prefer API data when available (authoritative source)
  // Use `??` so that 0 from API is used correctly (0 is not nullish)
  const totalWins = enrichedPlayerData?.totalWins ?? player.totalWins;
  const matches = enrichedPlayerData?.matches ?? player.matches;
  const maxStreak = enrichedPlayerData?.maxStreak ?? player.maxStreak;
  const streak = enrichedPlayerData?.streak ?? player.streak;
  const totalMvp = enrichedPlayerData?.totalMvp ?? player.totalMvp;
  const points = enrichedPlayerData?.points ?? player.points;

  // Skins: use skinMap for ALL players, fall back to logged-in user's skins for self
  const isMe = playerAuth.isAuthenticated && playerAuth.account && playerAuth.account.player.id === player.id;
  const playerSkins = skinMap?.[player.id] || (isMe ? playerAuth.account?.skins || [] : []);

  // ═══ LAYERED SKIN SYSTEM ═══
  // Sort all active skins by priority (highest first) for layered rendering:
  //   Layer 1 (highest priority) → Frame / Border glow + Traveling edge lights
  //   Layer 2 (second priority)  → Corner sparkles / Twinkle symbol
  //   Layer 3 (third priority)   → Inner avatar traveling line
  // If a player has only 1 skin, only the frame layer is active.
  // If 2 skins, frame + twinkle. If 3+, all three layers.

  // When preferredSkinType is set (e.g. from MVP card click), put that skin first
  const activeSkins = filterActiveSkins(playerSkins as PlayerSkinWithDetails[]);
  const sortedSkins = sortSkinsByPriority(activeSkins);

  // If preferredSkinType is set, reorder so it becomes the primary (frame) layer
  const layerSkins = preferredSkinType
    ? (() => {
        const preferred = sortedSkins.find(s => s.type === preferredSkinType);
        if (!preferred) return sortedSkins;
        const rest = sortedSkins.filter(s => s.type !== preferredSkinType);
        return [preferred, ...rest];
      })()
    : sortedSkins;

  const frameSkin = layerSkins[0] || null;       // Layer 1: Frame/border
  const twinkleSkin = layerSkins[1] || null;      // Layer 2: Sparkles/twinkle
  // NOTE: Layer 3 (inner avatar traveling line) REMOVED — it disturbs the photo view
  // The bottom accent divider line below the avatar is kept (uses frameColors)

  const primarySkin = frameSkin; // For backward compat, primarySkin = frameSkin
  const frameColors: SkinColors | null = frameSkin ? resolveSkinColors(frameSkin) : null;
  const twinkleColors: SkinColors | null = twinkleSkin ? resolveSkinColors(twinkleSkin) : null;

  // Legacy alias: skinColors = frameColors (used by most existing code)
  const skinColors = frameColors;

  // winRate/losses computed below after actualMatchStats is available
  const losses = matches - totalWins;
  // Only show rank badges when the player has actual competitive results (points or wins)
  // Without this check, ALL players show "Juara" badges when no matches have been played
  // because the topPlayers array order is arbitrary when all points = 0
  const hasCompetitiveResults = points > 0 || totalWins > 0;
  const effectiveRank = hasCompetitiveResults ? rank : undefined;
  const isChampion = effectiveRank === 1;
  const isTop3 = effectiveRank !== undefined && effectiveRank <= 3;

  // Lock body scroll when modal is open + Close on Escape
  useEffect(() => {
    // Prevent background scrolling when modal is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handler);
    };
  }, [onClose]);

  // Fetch player achievements from API
  const { data: achievementData } = useQuery({
    queryKey: ['player-achievements', player.id],
    queryFn: async () => {
      const res = await fetch(`/api/players/achievements?playerId=${player.id}`);
      return res.json();
    },
    enabled: !!player.id,
  });

  // Fetch player point breakdown from API
  const { data: pointBreakdownData } = useQuery({
    queryKey: ['player-point-breakdown', player.id],
    queryFn: async () => {
      const res = await fetch(`/api/players/${player.id}/point-breakdown`);
      return res.json();
    },
    enabled: !!player.id,
    staleTime: 15000,
  });

  // Fetch player match history
  // Always enabled (even if denormalized matches counter is 0) because
  // after a tournament rollback, counters may be out of sync
  const { data: matchHistoryData } = useQuery({
    queryKey: ['player-matches', player.id],
    queryFn: async () => {
      const res = await fetch(`/api/players/${player.id}/matches`);
      return res.json();
    },
    enabled: !!player.id,
    staleTime: 30000,
  });

  const [showAllMatches, setShowAllMatches] = useState(false);
  const MATCH_LIMIT = 10;

  // ═══ Compute accurate W/L from actual match records ═══
  // The Player record's totalWins/matches are denormalized counters that can drift
  // from reality (e.g. after tournament rollback, matches are deleted but counters
  // may not fully sync). When matchHistoryData is available, count from actual
  // match results for consistency with the "Riwayat Match" section.
  const actualMatchStats = (() => {
    const tMatches = matchHistoryData?.tournamentMatches;
    if (!tMatches?.length) return null;
    let wins = 0;
    let losses = 0;
    for (const m of tMatches) {
      if (m.result === 'win') wins++;
      else if (m.result === 'loss') losses++;
    }
    return { wins, losses, total: wins + losses };
  })();

  // Use actual match counts when available, fall back to player record counters
  const displayWins = actualMatchStats?.wins ?? totalWins;
  const displayLosses = actualMatchStats?.losses ?? losses;
  const displayMatches = actualMatchStats?.total ?? matches;
  const winRate = displayMatches > 0 ? Math.round((displayWins / displayMatches) * 100) : 0;
  const mvpRate = displayMatches > 0 ? Math.round((totalMvp / displayMatches) * 100) : 0;

  const rankLabel = effectiveRank === 1 ? 'JUARA' : effectiveRank === 2 ? 'JUARA 2' : effectiveRank === 3 ? 'PERINGKAT 3' : effectiveRank ? `#${effectiveRank}` : '';

  // No demo data — all data comes from actual organizer-input results only.
  // The game is not integrated with this server, so we cannot show
  // in-game performance metrics or per-match score trends.
  const hasMatchHistory = matches > 0;
  const avatarSrc = getAvatarUrl(player.gamertag, playerDivision as 'male' | 'female', player.avatar);

  // Portal target — render modal directly into document.body to avoid
  // parent overflow/transform breaking position:fixed centering.
  // Without this, the dashboard's <main overflow-y-auto> container
  // causes the modal to appear off-center or disappear on scroll.
  const [portalTarget] = useState<HTMLElement | null>(() =>
    typeof document !== 'undefined' ? document.body : null
  );

  if (!portalTarget) return null;

  const modal = (
    <div
      className="modal-backdrop-heavy modal-backdrop-enter z-[9999] p-3 sm:p-4 overflow-hidden"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Profil ${player.gamertag}`}
    >
      <div
        className={`modal-container modal-container-lg modal-enter-slide ${playerDivision === 'male' ? 'modal-container-male' : 'modal-container-female'}`}
        onClick={(e) => e.stopPropagation()}
        style={{ overflow: 'visible', ...(skinColors ? { padding: '4px' } : {}) }}
      >
          {/* ═══ STICKY CLOSE BUTTON — always visible, outside scroll area ═══ */}
          <button
            onClick={onClose}
            aria-label="Kembali"
            className="modal-close-dark modal-close-lg absolute top-3 right-3 z-[60]"
          >
            <X className="w-4 h-4" />
          </button>
          {/* ═══ TRAVELING EDGE LIGHTS — cahaya mengalir di sisi frame saja ═══ */}
          {skinColors && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden sm:rounded-[20px]" style={{ zIndex: 25 }} aria-hidden="true">
              {/* Top edge light — travels left → right */}
              <motion.div
                className="absolute"
                style={{
                  top: '-1px', left: 0,
                  width: '30%', height: '2px',
                  background: `linear-gradient(90deg, transparent 0%, ${skinColors.glow} 25%, #ffffffd0 50%, ${skinColors.glow} 75%, transparent 100%)`,
                  boxShadow: `0 0 8px ${skinColors.glow}, 0 0 4px ${skinColors.glow}`,
                }}
                animate={{ x: ['-100%', '400%'] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              />
              {/* Right edge light — travels top → bottom */}
              <motion.div
                className="absolute"
                style={{
                  right: '-1px', top: 0,
                  width: '2px', height: '22%',
                  background: `linear-gradient(180deg, transparent 0%, ${skinColors.glow} 25%, #ffffffd0 50%, ${skinColors.glow} 75%, transparent 100%)`,
                  boxShadow: `0 0 8px ${skinColors.glow}, 0 0 4px ${skinColors.glow}`,
                }}
                animate={{ y: ['-100%', '500%'] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'linear', delay: 0.8 }}
              />
              {/* Bottom edge light — travels right → left */}
              <motion.div
                className="absolute"
                style={{
                  bottom: '-1px', right: 0,
                  width: '30%', height: '2px',
                  background: `linear-gradient(90deg, transparent 0%, ${skinColors.glow} 25%, #ffffffd0 50%, ${skinColors.glow} 75%, transparent 100%)`,
                  boxShadow: `0 0 8px ${skinColors.glow}, 0 0 4px ${skinColors.glow}`,
                }}
                animate={{ x: ['100%', '-400%'] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear', delay: 1.5 }}
              />
              {/* Left edge light — travels bottom → top */}
              <motion.div
                className="absolute"
                style={{
                  left: '-1px', bottom: 0,
                  width: '2px', height: '22%',
                  background: `linear-gradient(180deg, transparent 0%, ${skinColors.glow} 25%, #ffffffd0 50%, ${skinColors.glow} 75%, transparent 100%)`,
                  boxShadow: `0 0 8px ${skinColors.glow}, 0 0 4px ${skinColors.glow}`,
                }}
                animate={{ y: ['100%', '-500%'] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'linear', delay: 2.2 }}
              />
              {/* Second pass — offset for richer effect */}
              {/* Top edge — second light, opposite timing */}
              <motion.div
                className="absolute"
                style={{
                  top: '-1px', left: 0,
                  width: '18%', height: '1.5px',
                  background: `linear-gradient(90deg, transparent 0%, ${skinColors.frame}aa 30%, #ffffff80 50%, ${skinColors.frame}aa 70%, transparent 100%)`,
                  boxShadow: `0 0 4px ${skinColors.glow}`,
                }}
                animate={{ x: ['-80%', '520%'] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: 'linear', delay: 2 }}
              />
              {/* Bottom edge — second light */}
              <motion.div
                className="absolute"
                style={{
                  bottom: '-1px', right: 0,
                  width: '18%', height: '1.5px',
                  background: `linear-gradient(90deg, transparent 0%, ${skinColors.frame}aa 30%, #ffffff80 50%, ${skinColors.frame}aa 70%, transparent 100%)`,
                  boxShadow: `0 0 4px ${skinColors.glow}`,
                }}
                animate={{ x: ['80%', '-520%'] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: 'linear', delay: 0.5 }}
              />
            </div>
          )}

          {/* ═══ BORDER GLOW — breathing pulse ═══ */}
          {skinColors && (
            <motion.div
              className="absolute sm:rounded-[20px] pointer-events-none"
              style={{
                inset: '-2px',
                border: `2px solid ${skinColors.frame}`,
                borderRadius: 'inherit',
                zIndex: 20,
                boxShadow: `0 0 5px ${skinColors.glow}, 0 0 10px ${skinColors.glow}`,
              }}
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              aria-hidden="true"
            />
          )}

          {/* ═══ Corner sparkles — Layer 2: uses twinkleSkin (2nd priority) ═══ */}
          {/* If no twinkleSkin, fall back to frameSkin for sparkle colors/symbol */}
          {(twinkleSkin || frameSkin) && (() => {
            const sparkleSkin = twinkleSkin || frameSkin!;
            const sparkleColors = twinkleColors || frameColors!;
            return (
              <>
                {[
                  { top: '-8px', left: '-8px' },
                  { top: '-8px', right: '-8px' },
                  { bottom: '-8px', left: '-8px' },
                  { bottom: '-8px', right: '-8px' },
                ].map((pos, i) => (
                  <motion.span
                    key={`corner${i}`}
                    className="absolute flex items-center justify-center select-none"
                    style={{
                      fontSize: sparkleSkin.type === 'season_champion' || sparkleSkin.type === 'sultan' ? '20px' : sparkleSkin.type.startsWith('sawer_') ? '16px' : '18px',
                      lineHeight: 1,
                      ...pos,
                      zIndex: 55,
                      color: sparkleColors.frame,
                      textShadow: `0 0 6px ${sparkleColors.glow}, 0 0 12px ${sparkleColors.glow}, 0 0 20px ${sparkleColors.glow}`,
                    }}
                    animate={{ opacity: [0.25, 1, 0.25], scale: [0.6, 1.35, 0.6], rotate: sparkleSkin.type === 'season_champion' || sparkleSkin.type === 'sultan' ? [0, 60, 120, 180, 240, 300, 360] : [0, 90, 180, 270, 360] }}
                    transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.4, ease: 'easeInOut' }}
                    aria-hidden="true"
                  >{getSkinTwinkle(sparkleSkin.type)}</motion.span>
                ))}
              </>
            );
          })()}

          {/* Inner scrollable content container — sits above the chase border */}
          <div className="relative z-10 bg-background sm:rounded-[20px] min-h-0 flex-1 overflow-y-auto custom-scrollbar">

          {/* ═══ HERO BANNER — Full Avatar Card Style ═══ */}
            <div className={`relative h-[280px] sm:h-[380px] md:h-[440px] overflow-hidden cinema-hero cinema-flare ${playerDivision === 'male' ? 'cinema-flare-male' : 'cinema-flare-female'} cinema-grade`}>
            {/* Full avatar as background */}
            <AvatarMedia src={avatarSrc} alt={player.gamertag} fill sizes="(max-width: 640px) 100vw, 512px" objectPosition="center 25%" autoPlay loop muted playsInline />

            {/* ═══ Shimmer overlay — theme-colored diagonal sweep ═══ */}
            {/* Only shown when player has a skin (champion, MVP, sultan, etc.) */}
            {skinColors && (
              <motion.div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `linear-gradient(
                    105deg,
                    transparent 25%,
                    ${skinColors.frame}18 40%,
                    ${skinColors.glow.replace(/[\d.]+\)$/, '0.22)')} 50%,
                    ${skinColors.frame}18 60%,
                    transparent 75%
                  )`,
                  zIndex: 3,
                }}
                animate={{ x: ['-120%', '120%'] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 3 }}
                aria-hidden="true"
              />
            )}

            {/* Dark overlay gradient — natural fade from bottom for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-transparent to-transparent" />

            {/* Division color tint overlay — edges/corners only, avoids face center */}
            <div className="absolute inset-0" style={{
              background: skinColors
                ? `radial-gradient(ellipse at 10% 10%, ${skinColors.glow.replace(/[\d.]+\)$/, '0.12)')} 0%, transparent 40%),
                     radial-gradient(ellipse at 90% 10%, ${skinColors.frame}18 0%, transparent 40%),
                     radial-gradient(ellipse at 10% 90%, ${skinColors.frame}12 0%, transparent 35%)`
                : playerDivision === 'male'
                  ? 'radial-gradient(ellipse at 10% 10%, rgba(87,181,255,0.04) 0%, transparent 40%)'
                  : 'radial-gradient(ellipse at 10% 10%, rgba(255,92,154,0.04) 0%, transparent 40%)'
            }} />

            {/* SVG procedural overlay for depth */}
            <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
              <text x="97%" y="96%" textAnchor="end" dominantBaseline="auto"
                fill={skinColors?.frame || (playerDivision === 'male' ? '#57B5FF' : '#FF5C9A')} fontSize="70" fontWeight="900" opacity={skinColors ? '0.14' : '0.05'}
                fontFamily="system-ui" letterSpacing="-2">
                {(player.city || player.gamertag).toUpperCase()}
              </text>
              {/* Corner brackets — use skin frame color if skin active (more visible) */}
              <line x1="0" y1="0" x2="25%" y2="0" stroke={skinColors?.frame || (playerDivision === 'male' ? '#57B5FF' : '#FF5C9A')} strokeWidth={skinColors ? '3' : '2'} opacity={skinColors ? '0.5' : '0.2'} />
              <line x1="0" y1="0" x2="0" y2="25%" stroke={skinColors?.frame || (playerDivision === 'male' ? '#57B5FF' : '#FF5C9A')} strokeWidth={skinColors ? '3' : '2'} opacity={skinColors ? '0.5' : '0.2'} />
              <line x1="100%" y1="100%" x2="75%" y2="100%" stroke={skinColors?.frame || (playerDivision === 'male' ? '#57B5FF' : '#FF5C9A')} strokeWidth={skinColors ? '3' : '2'} opacity={skinColors ? '0.5' : '0.2'} />
              <line x1="100%" y1="100%" x2="100%" y2="75%" stroke={skinColors?.frame || (playerDivision === 'male' ? '#57B5FF' : '#FF5C9A')} strokeWidth={skinColors ? '3' : '2'} opacity={skinColors ? '0.5' : '0.2'} />
            </svg>

            {/* Top accent line — neutral division color (no skin traveling light) */}
            {!skinColors && (
              <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-muted-foreground/30 to-transparent`} />
            )}





            {/* Rank badge — top-left */}
            {isTop3 && (
              <div className="absolute top-3 left-3 z-10">
                <Badge className={`text-[10px] font-black border-0 px-2.5 py-1 ${
                  effectiveRank === 1 ? 'bg-yellow-500/25 text-yellow-400 shadow-lg shadow-yellow-500/10' :
                  effectiveRank === 2 ? 'bg-gray-400/20 text-muted-foreground' :
                  'bg-amber-600/20 text-amber-500'
                }`}>
                  {effectiveRank === 1 ? '👑' : ''} {rankLabel}
                </Badge>
              </div>
            )}

            {/* Division badge — below rank or top-left */}
            <div className="absolute top-3 left-3 z-10" style={{ marginTop: isTop3 ? '28px' : 0 }}>
              <Badge className={`${dt.casinoBadge} text-[9px]`}>
                {playerDivision === 'male' ? '🕺 Divisi Cowo' : '💃 Divisi Cewe'}
              </Badge>
            </div>

            {/* Bottom info overlay — name, club */}
            <div className="absolute bottom-0 inset-x-0 z-10 p-4" style={skinColors ? {
              background: `linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 60%, transparent 100%),
                           linear-gradient(to top, ${skinColors.glow.replace(/[\d.]+\)$/, '0.1)')} 0%, transparent 40%)`,
            } : undefined}>
              <div className="relative z-10">
                <div className="flex items-center gap-2">
                  <SkinName skin={primarySkin} skinColors={skinColors}>
                    <h2 className="text-2xl font-black drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">{player.gamertag}</h2>
                  </SkinName>
                  {playerSkins.length > 0 && <SkinBadgesRow skins={playerSkins} hideSawerAndDonorBadges={playerSkins.some(s => s.type === 'sultan_weekly')} />}
                  <SocialShareButton playerGamertag={player.gamertag} playerId={player.id} />
                </div>
                <p className="text-xs text-white/60 mt-0.5">{player.city ? <><MapPin className="w-3 h-3 inline -mt-0.5 mr-0.5" />{player.city}</> : player.name}</p>
                <div className="flex items-center gap-2 mt-1.5">

                  {streak > 1 && (
                    <Badge className="bg-orange-500/20 text-orange-400 text-[10px] border-0 flex items-center gap-1">
                      <Flame className="w-3 h-3" /> {streak} Streak
                    </Badge>
                  )}

                  {/* Sultan of Season badge — emerald themed */}
                  {playerSkins.some(s => s.type === 'sultan') && (
                    <Badge
                      className="text-[10px] border-0 flex items-center gap-1 font-bold"
                      style={{ backgroundColor: 'rgba(67,160,71,0.2)', color: '#66BB6A' }}
                    >
                      <span>👑</span> Sultan Season {(() => {
                        const sultanSkin = playerSkins.find(s => s.type === 'sultan');
                        const match = sultanSkin?.reason?.match(/Season (\d+)/);
                        return match ? match[1] : '';
                      })()}
                    </Badge>
                  )}

                  {/* Sultan of the Week badge — maroon themed, with sawer count */}
                  {playerSkins.some(s => s.type === 'sultan_weekly') && (() => {
                    const donorCount = playerSkins.find(s => s.type === 'sultan_weekly')?.donorBadgeCount
                      || playerSkins.find(s => s.type === 'donor_badge')?.donorBadgeCount
                      || playerSkins.find(s => s.type === 'donor')?.donorBadgeCount;
                    const sawerCount = donorCount && donorCount > 0 ? `${donorCount}x sawer` : '';
                    return (
                      <Badge
                        className="text-[10px] border-0 flex items-center gap-1 font-bold"
                        style={{ backgroundColor: 'rgba(128,0,32,0.2)', color: '#C4A3A5' }}
                      >
                        <span>❤️</span> Sultan of the Week{ sawerCount ? <span className="ml-1 opacity-70">{sawerCount}</span> : null }
                      </Badge>
                    );
                  })()}
                </div>
                {clubToString(player.club) && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {typeof player.club === 'object' && player.club?.logo ? (
                      <ClubLogoImage clubName={clubToString(player.club)} dbLogo={player.club.logo} alt={clubToString(player.club)} width={18} height={18} className="w-[18px] h-[18px] rounded object-cover" />
                    ) : (
                      <Shield className={`w-3.5 h-3.5 ${dt.text}`} />
                    )}
                    <span className={`text-xs ${dt.text} font-semibold drop-shadow-sm`}>{clubToString(player.club)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ═══ Skin accent divider — dual traveling spotlights ═══ */}
          {/* Uses frameColors (Layer 1) — kept because it's below the avatar, not inside it */}
          {skinColors && (() => {
            const dividerColors = skinColors;
            return (
              <div
                className="h-[3px] mx-4 overflow-hidden relative"
                style={{ background: dividerColors.frame + '18' }}
                aria-hidden="true"
              >
                {/* Forward spotlight */}
                <motion.div
                  className="absolute inset-y-0 left-0"
                  style={{
                    width: '35%',
                    background: `linear-gradient(90deg, transparent 0%, ${dividerColors.glow} 30%, #ffffffc0 50%, ${dividerColors.glow} 70%, transparent 100%)`,
                    boxShadow: `0 0 8px ${dividerColors.glow}`,
                  }}
                  animate={{ x: ['-120%', '320%'] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
                />
                {/* Reverse spotlight — creates crossing effect */}
                <motion.div
                  className="absolute inset-y-0 left-0"
                  style={{
                    width: '25%',
                    background: `linear-gradient(90deg, transparent 0%, ${dividerColors.frame}88 40%, #ffffff60 50%, ${dividerColors.frame}88 60%, transparent 100%)`,
                  }}
                  animate={{ x: ['320%', '-120%'] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'linear', delay: 0.8 }}
                />
              </div>
            );
          })()}

          {/* ═══ CONTENT ═══ */}
          <div className="px-4 pt-4 pb-6">


            {/* ═══ Main Stats Grid — Dance Tournament HUD Style ═══ */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <StatBlock icon={Trophy} label="Poin" value={points} color={dt.text} highlight size="large" playerDivision={playerDivision as 'male' | 'female'} />
              <StatBlock icon={Target} label="Win Rate" value={`${winRate}%`} sub={`${displayWins}W/${displayLosses}L`} color="text-green-500" playerDivision={playerDivision as 'male' | 'female'} />
              <StatBlock icon={Crown} label="MVP" value={totalMvp} sub={`${mvpRate}% rasio`} color="text-yellow-500" playerDivision={playerDivision as 'male' | 'female'} />
              <StatBlock icon={Activity} label="Match" value={displayMatches} color="text-blue-400" playerDivision={playerDivision as 'male' | 'female'} />
            </div>

            {/* ═══ Performance Overview — enhanced card design ═══ */}
            {hasMatchHistory ? (
              <div className={`p-4 rounded-2xl ${dt.bgSubtle} border ${dt.borderSubtle} mb-4`}>
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className={`w-4 h-4 ${dt.text}`} />
                  <span className="text-sm font-semibold">Ringkasan Performa</span>
                  <Badge className={`${dt.casinoBadge} text-[8px] ml-auto`}>{displayMatches} MATCH</Badge>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2.5 sm:p-3 rounded-xl bg-green-500/5 border border-green-500/10">
                    <p className="text-xl font-black text-green-500">{displayWins}</p>
                    <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold">Wins</p>
                  </div>
                  <div className="p-2.5 sm:p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                    <p className="text-xl font-black text-red-500">{displayLosses}</p>
                    <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold">Losses</p>
                  </div>
                  <div className="p-2.5 sm:p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
                    <p className="text-xl font-black text-yellow-500">{totalMvp}</p>
                    <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold">MVP</p>
                  </div>
                  <div className="p-2.5 sm:p-3 rounded-xl bg-idm-gold-warm/5 border border-idm-gold-warm/10">
                    <p className={`text-xl font-black ${dt.neonGradient}`}>{winRate}%</p>
                    <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold">Win Rate</p>
                  </div>
                </div>
                {/* Streak indicators */}
                {(streak > 1 || maxStreak > 1) && (
                  <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-border/20">
                    {streak > 1 && (
                      <div className="flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-orange-500" />
                        <span className="text-xs font-bold text-orange-500">{streak} Streak</span>
                        <span className="text-[9px] text-muted-foreground/50">aktif</span>
                      </div>
                    )}
                    {maxStreak > 1 && (
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-xs font-bold text-amber-500">{maxStreak} Max</span>
                        <span className="text-[9px] text-muted-foreground/50">rekor</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className={`p-4 rounded-2xl ${dt.bgSubtle} border ${dt.borderSubtle} mb-4 text-center`}>
                <BarChart3 className={`w-5 h-5 ${dt.text} mx-auto mb-1.5 opacity-40`} />
                <p className="text-xs text-muted-foreground">Belum ada data match — statistik performa akan muncul setelah match tercatat</p>
              </div>
            )}

            {/* ═══ Tier Progress Visualization ═══ */}
            <div className="mb-4">
              <TierProgress
                currentTier={player.tier as 'S' | 'A' | 'B'}
                points={points}
                division={playerDivision as 'male' | 'female'}
                className=""
              />
            </div>

            {/* ═══ Win Rate Progress Bar ═══ */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground font-medium">Win Rate</span>
                <span className={`font-black ${dt.text}`}>{winRate}%</span>
              </div>
              <div className={`h-2.5 rounded-full ${dt.bgSubtle} overflow-hidden`}>
                <div
                  className={`h-full rounded-full transition-[width] duration-700 ease-out ${
                    winRate >= 60
                      ? `bg-gradient-to-r ${playerDivision === 'male' ? 'from-idm-male to-idm-male-light' : 'from-idm-female to-idm-female-light'}`
                      : winRate >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${winRate}%` }}
                />
              </div>
            </div>

            {/* ═══ Achievements ═══ */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Award className={`w-4 h-4 ${dt.text}`} />
                <h3 className="text-sm font-semibold">Prestasi</h3>
                {achievementData?.stats && (
                  <Badge className={`${dt.casinoBadge} text-[8px] ml-auto`}>
                    {achievementData.stats.earned}/{achievementData.stats.total}
                  </Badge>
                )}
              </div>
              {achievementData?.achievements?.length > 0 ? (
                <AchievementList
                  achievements={achievementData.achievements.map((a: { achievement: { id: string; name: string; displayName: string; description: string; icon: string; tier: string }; earnedAt: Date }) => ({
                    id: a.achievement.id,
                    name: a.achievement.name,
                    displayName: a.achievement.displayName,
                    description: a.achievement.description,
                    category: 'earned',
                    icon: a.achievement.icon,
                    tier: a.achievement.tier,
                    earned: true,
                    earnedAt: a.earnedAt,
                  }))}
                  size="md"
                />
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {/* Fallback badges based on player stats */}
                  {displayWins >= 1 && (
                    <Badge className="bg-green-500/10 text-green-500 text-[10px] border-0">
                      <Star className="w-3 h-3 mr-1" /> Win Pertama
                    </Badge>
                  )}
                  {displayWins >= 5 && (
                    <Badge className="bg-blue-500/10 text-blue-400 text-[10px] border-0">
                      <Trophy className="w-3 h-3 mr-1" /> 5 Win
                    </Badge>
                  )}
                  {totalMvp >= 1 && (
                    <Badge className="bg-yellow-500/10 text-yellow-500 text-[10px] border-0">
                      <Crown className="w-3 h-3 mr-1" /> MVP
                    </Badge>
                  )}
                  {maxStreak >= 3 && (
                    <Badge className="bg-orange-500/10 text-orange-500 text-[10px] border-0">
                      <Flame className="w-3 h-3 mr-1" /> Membara
                    </Badge>
                  )}

                  {isChampion && (
                    <Badge className="bg-yellow-500/10 text-yellow-500 text-[10px] border-0">
                      <Crown className="w-3 h-3 mr-1" /> Juara
                    </Badge>
                  )}
                  {displayMatches >= 5 && (
                    <Badge className="bg-amber-600/10 text-amber-600 text-[10px] border-0">
                      <BarChart3 className="w-3 h-3 mr-1" /> Veteran
                    </Badge>
                  )}
                  {displayWins === 0 && totalMvp === 0 && (
                    <p className="text-xs text-muted-foreground">Belum ada prestasi</p>
                  )}
                </div>
              )}
            </div>

            {/* ═══ Recent Matches — only from organizer-input data ═══ */}
            {hasMatchHistory ? (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <Calendar className={`w-4 h-4 ${dt.text}`} />
                  <h3 className="text-sm font-semibold">Rekor Match</h3>
                  <Badge className={`${dt.casinoBadge} text-[8px] ml-auto`}>{displayMatches} DIMAINKAN</Badge>
                </div>
                <div className={`p-4 sm:p-5 rounded-2xl ${dt.bgSubtle} border ${dt.borderSubtle}`}>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center">
                      <p className="text-2xl font-black text-green-500">{displayWins}</p>
                      <p className="text-[9px] text-muted-foreground uppercase">Wins</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-black text-red-500">{displayLosses}</p>
                      <p className="text-[9px] text-muted-foreground uppercase">Losses</p>
                    </div>
                  </div>
                  {totalMvp > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/30 text-center">
                      <p className="text-xs text-yellow-500 font-semibold">{totalMvp}x Penghargaan MVP</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <Calendar className={`w-4 h-4 ${dt.text}`} />
                  <h3 className="text-sm font-semibold">Rekor Match</h3>
                </div>
                <div className={`p-4 rounded-2xl ${dt.bgSubtle} border ${dt.borderSubtle} text-center`}>
                  <Calendar className={`w-5 h-5 ${dt.text} mx-auto mb-1.5 opacity-40`} />
                  <p className="text-xs text-muted-foreground">Belum ada match tercatat</p>
                </div>
              </div>
            )}

            {/* ═══ Match History (Riwayat Match) — Redesigned ═══ */}
            {hasMatchHistory && matchHistoryData && (() => {
              // Combine & sort all matches by week (newest first), group by week
              const allMatches: Array<{
                id: string;
                week: number;
                weekLabel: string;
                type: 'tournament' | 'league';
                score1: number | null;
                score2: number | null;
                status: string;
                format: string;
                bracket?: string;
                round?: number;
                playerTeamName: string;
                opponentName: string;
                playerScore: number | null;
                opponentScore: number | null;
                isMvp: boolean;
                result: 'win' | 'loss' | 'upcoming' | null;
              }> = [];

              for (const m of (matchHistoryData.tournamentMatches || [])) {
                const isTeam1 = m.playerTeamId === m.team1?.id;
                allMatches.push({
                  id: m.id,
                  week: m.weekNumber,
                  weekLabel: `W${m.weekNumber}`,
                  type: 'tournament',
                  score1: m.score1,
                  score2: m.score2,
                  status: m.status,
                  format: m.format || 'BO1',
                  bracket: m.bracket,
                  round: m.round,
                  playerTeamName: isTeam1 ? m.team1.name : (m.team2?.name || 'TBD'),
                  opponentName: isTeam1 ? (m.team2?.name || 'TBD') : m.team1.name,
                  playerScore: isTeam1 ? m.score1 : m.score2,
                  opponentScore: isTeam1 ? m.score2 : m.score1,
                  isMvp: m.mvpPlayer?.id === player.id,
                  result: m.result,
                });
              }

              // Sort newest week first
              allMatches.sort((a, b) => b.week - a.week);

              // Group by week
              const weekGroups = new Map<number, typeof allMatches>();
              for (const m of allMatches) {
                if (!weekGroups.has(m.week)) weekGroups.set(m.week, []);
                weekGroups.get(m.week)!.push(m);
              }
              const sortedWeeks = Array.from(weekGroups.keys()).sort((a, b) => b - a);

              const totalMatches = allMatches.length;
              const totalWins = allMatches.filter(m => m.result === 'win').length;
              const totalLosses = allMatches.filter(m => m.result === 'loss').length;
              const displayWeeks = showAllMatches ? sortedWeeks : sortedWeeks.slice(0, 3);

              // Bracket label helper
              const getBracketLabel = (bracket?: string, round?: number) => {
                if (bracket === 'grand_final') return 'Grand Final';
                if (bracket === 'lower') return `Lower R${round ?? 1}`;
                if (bracket === 'swiss') return `Swiss R${round ?? 1}`;
                if (bracket === 'group') return `Group R${round ?? 1}`;
                // Upper bracket — show round label
                if (round === 1) return 'Final';
                if (round === 2) return 'Semi Final';
                if (round === 3) return 'Quarter Final';
                return `R${round ?? 1}`;
              };

              return (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2.5">
                    <Swords className={`w-4 h-4 ${dt.text}`} />
                    <h3 className="text-sm font-semibold">Riwayat Match</h3>
                    {/* Win/Loss summary pill */}
                    <div className="ml-auto flex items-center gap-1.5">
                      <Badge className="bg-green-500/10 text-green-500 text-[8px] border-0 px-1.5 py-0">{totalWins}W</Badge>
                      <Badge className="bg-red-500/10 text-red-500 text-[8px] border-0 px-1.5 py-0">{totalLosses}L</Badge>
                      <Badge className={`${dt.casinoBadge} text-[8px] border-0 px-1.5 py-0`}>{totalMatches}</Badge>
                    </div>
                  </div>
                  <div className={`rounded-2xl ${dt.bgSubtle} border ${dt.borderSubtle} overflow-hidden`}>
                    {/* Week groups */}
                    {displayWeeks.map((week) => {
                      const weekMatches = weekGroups.get(week)!;
                      return (
                        <div key={week} className="border-b border-border/10 last:border-b-0">
                          {/* Week header */}
                          <div className={`flex items-center gap-2 px-4 py-2 ${playerDivision === 'male' ? 'bg-idm-male/[0.04]' : 'bg-idm-female/[0.04]'}`}>
                            <span className={`text-[10px] font-black uppercase tracking-wider ${dt.neonText}`}>Week {week}</span>
                            <span className="text-[9px] text-muted-foreground">
                              {weekMatches.filter(m => m.result === 'win').length}W / {weekMatches.filter(m => m.result === 'loss').length}L
                            </span>
                            {/* Juara & MVP badges from prize data */}
                            {(() => {
                              const pw = pointBreakdownData?.prizeByWeek?.find((w: { week: number; juara1: number; juara2: number; juara3: number; mvp: number }) => w.week === week);
                              if (!pw) return null;
                              return (
                                <div className="ml-auto flex items-center gap-1">
                                  {pw.juara1 > 0 && (
                                    <Badge className="bg-yellow-500/15 text-yellow-400 text-[8px] border-0 px-1.5 py-0 flex items-center gap-0.5 font-bold">
                                      <span className="text-[10px]">🥇</span> Juara 1
                                    </Badge>
                                  )}
                                  {pw.juara2 > 0 && (
                                    <Badge className="bg-gray-400/15 text-gray-300 text-[8px] border-0 px-1.5 py-0 flex items-center gap-0.5 font-bold">
                                      <span className="text-[10px]">🥈</span> Juara 2
                                    </Badge>
                                  )}
                                  {pw.juara3 > 0 && (
                                    <Badge className="bg-amber-600/15 text-amber-500 text-[8px] border-0 px-1.5 py-0 flex items-center gap-0.5 font-bold">
                                      <span className="text-[10px]">🥉</span> Juara 3
                                    </Badge>
                                  )}
                                  {pw.mvp > 0 && (
                                    <Badge className="bg-idm-gold-warm/15 text-idm-gold-warm text-[8px] border-0 px-1.5 py-0 flex items-center gap-0.5 font-bold">
                                      <span className="text-[10px]">⭐</span> MVP
                                    </Badge>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                          {/* Match rows */}
                          <div className="divide-y divide-border/5">
                            {weekMatches.map((m) => (
                              <div key={m.id} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/5 transition-colors">
                                {/* Round/bracket label */}
                                <span className="w-[52px] sm:w-[68px] shrink-0">
                                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                                    m.type === 'tournament'
                                      ? m.bracket === 'grand_final'
                                        ? 'bg-idm-gold-warm/15 text-idm-gold-warm'
                                        : m.bracket === 'lower'
                                          ? 'bg-orange-500/10 text-orange-400'
                                          : `${dt.bgSubtle} ${dt.neonText}`
                                      : 'bg-muted/20 text-muted-foreground'
                                  }`}>
                                    {m.type === 'tournament' ? getBracketLabel(m.bracket, m.round) : 'Liga'}
                                  </span>
                                </span>
                                {/* Match content: PlayerTeam Score - Score Opponent */}
                                <div className="flex-1 min-w-0 flex items-center gap-1.5 text-xs">
                                  {/* Player's team */}
                                  <span className={`font-semibold truncate max-w-[40%] ${m.result === 'win' ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    {m.playerTeamName}
                                  </span>
                                  {/* Score box */}
                                  <span className="shrink-0 flex items-center gap-1">
                                    {m.status === 'completed' && m.playerScore !== null && m.opponentScore !== null ? (
                                      <>
                                        <span className={`font-black tabular-nums ${m.result === 'win' ? 'text-green-500' : 'text-muted-foreground'}`}>
                                          {m.playerScore}
                                        </span>
                                        <span className="text-muted-foreground/50 text-[10px]">-</span>
                                        <span className={`font-black tabular-nums ${m.result === 'loss' ? 'text-red-400' : 'text-muted-foreground'}`}>
                                          {m.opponentScore}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="text-muted-foreground/50 text-[10px]">vs</span>
                                    )}
                                  </span>
                                  {/* Opponent team */}
                                  <span className={`truncate max-w-[40%] ${m.result === 'loss' ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    {m.opponentName}
                                  </span>
                                </div>
                                {/* MVP + Result badges */}
                                <div className="shrink-0 flex items-center gap-1">
                                  {m.isMvp && (
                                    <span className="text-idm-gold-warm" title="MVP">⭐</span>
                                  )}
                                  {m.result === 'win' ? (
                                    <Badge className="bg-green-500/10 text-green-500 text-[8px] border-0 px-1.5 py-0">W</Badge>
                                  ) : m.result === 'loss' ? (
                                    <Badge className="bg-red-500/10 text-red-400 text-[8px] border-0 px-1.5 py-0">L</Badge>
                                  ) : (
                                    <Badge className="bg-muted/20 text-muted-foreground text-[8px] border-0 px-1.5 py-0">TBD</Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {/* Empty state */}
                    {totalMatches === 0 && (
                      <div className="p-4 text-center">
                        <Calendar className={`w-5 h-5 ${dt.text} mx-auto mb-1.5 opacity-40`} />
                        <p className="text-xs text-muted-foreground">Belum ada riwayat match</p>
                      </div>
                    )}

                    {/* Show More / Show Less toggle */}
                    {sortedWeeks.length > 3 && (
                      <button
                        onClick={() => setShowAllMatches(!showAllMatches)}
                        className={`flex items-center gap-1 text-[10px] font-semibold ${dt.text} mx-auto py-2.5 hover:opacity-80 transition-opacity`}
                      >
                        {showAllMatches ? (
                          <>Lihat Lebih Sedikit <ChevronUp className="w-3 h-3" /></>
                        ) : (
                          <>Lihat Semua ({sortedWeeks.length - 3} minggu lagi) <ChevronDown className="w-3 h-3" /></>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ═══ Season History ═══ */}
            <PlayerSeasonHistory
              playerId={player.id}
              playerDivision={playerDivision}
              currentPoints={points}
              currentTier={player.tier}
              currentClub={clubToString(player.club) || null}
            />

            {/* ═══ Points Breakdown ═══ */}
            <div className={`p-3.5 rounded-2xl ${dt.bgSubtle} border ${dt.borderSubtle}`}>
              <div className="flex items-center gap-2 mb-2.5">
                <TrendingUp className={`w-4 h-4 ${dt.text}`} />
                <span className="text-xs font-semibold">Rincian Poin</span>
              </div>
              <div className="space-y-2 text-xs">
                {(() => {
                  const bd = pointBreakdownData?.breakdown;
                  const pd = pointBreakdownData?.prizeDetail;
                  const pbw = pointBreakdownData?.prizeByWeek;
                  // Use API data if available, otherwise fall back to calculated values
                  const matchWinPts = bd?.matchWin ?? displayWins * 1;
                  const streakPts = bd?.streakBonus ?? Math.floor(streak / 3) * 2;
                  const prizePts = bd?.prize ?? 0;
                  const otherPts = bd?.other ?? 0;

                  const items: Array<{ label: string; value: string; color: string; detail: string; subItems?: Array<{ label: string; value: string; color: string }>; subTotal?: string }> = [
                    { label: `Match Win (${displayWins} win)`, value: `+${matchWinPts}`, color: dt.text, detail: '+1 pts/win' },
                    { label: `Streak Bonus`, value: `+${streakPts}`, color: 'text-orange-500', detail: `+2 pts/3x berturut² (streak: ${streak})` },
                  ];

                  // Show prize breakdown per week if available
                  if (prizePts > 0 && pbw && pbw.length > 0) {
                    // Group all prize points under one row, with per-week sub-items
                    // Total shown at bottom after sub-items
                    const prizeSubItems = pbw.flatMap(w => {
                      const subs: Array<{ label: string; value: string; color: string }> = [];
                      if (w.juara1 > 0) subs.push({ label: `W${w.week} · Juara 1`, value: `+${w.juara1}`, color: 'text-yellow-400' });
                      if (w.juara2 > 0) subs.push({ label: `W${w.week} · Juara 2`, value: `+${w.juara2}`, color: 'text-gray-300' });
                      if (w.juara3 > 0) subs.push({ label: `W${w.week} · Juara 3`, value: `+${w.juara3}`, color: 'text-amber-500' });
                      if (w.mvp > 0) subs.push({ label: `W${w.week} · MVP`, value: `+${w.mvp}`, color: 'text-yellow-500' });
                      return subs;
                    });
                    items.push({
                      label: 'Prize Hadiah',
                      value: '',  // No value on the main row — total shown after sub-items
                      color: 'text-yellow-400',
                      detail: '',
                      subItems: prizeSubItems,
                      subTotal: `+${prizePts} pts`,
                    });
                  } else if (prizePts > 0 && pd) {
                    // Fallback: no per-week data, show aggregate
                    if (pd.juara1 > 0) items.push({ label: 'Prize Juara 1', value: `+${pd.juara1}`, color: 'text-yellow-400', detail: '' });
                    if (pd.juara2 > 0) items.push({ label: 'Prize Juara 2', value: `+${pd.juara2}`, color: 'text-gray-300', detail: '' });
                    if (pd.juara3 > 0) items.push({ label: 'Prize Juara 3', value: `+${pd.juara3}`, color: 'text-amber-500', detail: '' });
                    if (pd.mvp > 0) items.push({ label: 'Prize MVP', value: `+${pd.mvp}`, color: 'text-yellow-500', detail: '' });
                  } else if (prizePts > 0) {
                    items.push({ label: 'Prize Juara', value: `+${prizePts}`, color: 'text-yellow-400', detail: '' });
                  }

                  // Show other/legacy points if any (from old system)
                  if (otherPts > 0) {
                    items.push({ label: 'Poin Lainnya', value: `+${otherPts}`, color: 'text-muted-foreground', detail: 'dari sistem lama' });
                  }

                  return (
                    <>
                      {items.map((item, i) => (
                        <div key={i}>
                          <div className="flex justify-between items-center">
                            <div className="flex flex-col">
                              <span className="text-muted-foreground">{item.label}</span>
                              {item.detail && <span className="text-[9px] text-muted-foreground/60">{item.detail}</span>}
                            </div>
                            {item.value && <span className={`font-bold ${item.color}`}>{item.value} pts</span>}
                          </div>
                          {/* Per-week sub-items for prize breakdown */}
                          {item.subItems && item.subItems.length > 0 && (
                            <div className="ml-3 mt-0.5 space-y-0.5">
                              {item.subItems.map((sub, si) => (
                                <div key={si} className="flex justify-between items-center">
                                  <span className="text-[11px] text-muted-foreground">{sub.label}</span>
                                  <span className={`text-[11px] font-semibold ${sub.color}`}>{sub.value}</span>
                                </div>
                              ))}
                              {/* Sub-total shown after all sub-items */}
                              {item.subTotal && (
                                <div className="flex justify-between items-center pt-0.5 border-t border-border/30">
                                  <span className="text-[10px] font-semibold text-muted-foreground">Total</span>
                                  <span className="text-[10px] font-bold text-foreground">{item.subTotal}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  );
                })()}
                <div className="h-px bg-border my-1" />
                <div className="flex justify-between font-extrabold text-sm">
                  <span>Total</span>
                  <span className={dt.neonGradient}>{points} pts</span>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ Bottom accent line — traveling spotlight ═══ */}
          {skinColors && (
            <div
              className="h-1 mx-4 mb-4 overflow-hidden rounded-full relative"
              style={{ background: skinColors.frame + '20' }}
              aria-hidden="true"
            >
              <motion.div
                className="absolute inset-y-0 left-0"
                style={{
                  width: '40%',
                  background: `linear-gradient(90deg, transparent 0%, ${skinColors.glow} 35%, #ffffffa0 50%, ${skinColors.glow} 65%, transparent 100%)`,
                }}
                animate={{ x: ['-120%', '320%'] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          )}
          </div>
      </div>
    </div>
  );

  return createPortal(modal, portalTarget);
}
