'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  resolveSkinColors,
  parseBadgeColors,
  buildGradient,
  parseColorStops,
  getDonorBadgeConfig,
  getSawerBadgeConfig,
  getSkinTwinkle,
  isSawerType,
} from '@/lib/skin-utils';
import type { SkinColors } from '@/lib/skin-utils';

// ============================================
// PROP TYPES
// ============================================

interface SkinBadgeProps {
  skin: {
    type: string;
    icon: string;
    displayName: string;
    colorClass: string;
    donorBadgeCount?: number;
  };
  size?: 'sm' | 'md' | 'lg';
}

interface SkinBadgesRowProps {
  skins: Array<{
    type: string;
    icon: string;
    displayName: string;
    colorClass: string;
    priority: number;
    donorBadgeCount?: number;
    sawerBadgeTier?: string;
  }>;
  /** When true, hide sawer and donor badges — used when Sultan of the Week badge is present */
  hideSawerAndDonorBadges?: boolean;
}

interface SkinAvatarFrameProps {
  skin: { type: string; colorClass: string } | null;
  children: React.ReactNode;
}

interface SkinNameProps {
  skin: { type: string; colorClass: string } | null;
  skinColors?: SkinColors | null;
  children: React.ReactNode;
}

interface SkinCardBorderProps {
  skin: { type: string; colorClass: string } | null;
  /** Layer 2 skin: twinkle/sparkle effect (2nd priority) */
  secondarySkin?: { type: string; colorClass: string } | null;
  children: React.ReactNode;
}

// ============================================
// DonorHeartBadge — Permanent heart badge for donors
// 1-4 donations: small heart
// 5+ donations: bigger heart with pulse glow
// ============================================

function DonorHeartBadge({ donorBadgeCount }: { donorBadgeCount: number }) {
  const config = getDonorBadgeConfig(donorBadgeCount);
  if (!config) return null;

  const isBigHeart = config.size === 'lg';

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full',
        isBigHeart
          ? 'w-7 h-7 text-sm donor-heart-pulse'
          : 'w-5 h-5 text-[11px]'
      )}
      style={{
        backgroundColor: 'rgba(244,63,94,0.2)',
        ...(isBigHeart ? {
          boxShadow: '0 0 8px rgba(244,63,94,0.4), 0 0 16px rgba(244,63,94,0.2)',
        } : {}),
      }}
      title={`${donorBadgeCount}x donasi${isBigHeart ? ' ★' : ''}`}
      role="img"
      aria-label={`Heart Badge: ${donorBadgeCount} donations`}
    >
      ❤️
    </span>
  );
}

// ============================================
// SawerTierBadge — Permanent sawer tier badge
// Bronze: small, Silver: small, Gold: medium, Diamond: large with glow
// ============================================

function SawerTierBadge({ tier }: { tier: string }) {
  const config = getSawerBadgeConfig(tier);
  if (!config) return null;

  const isDiamond = tier === 'sawer_diamond' || tier === 'diamond';
  const isGold = tier === 'sawer_gold' || tier === 'gold';
  const isSilver = tier === 'sawer_silver' || tier === 'silver';

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full',
        isDiamond ? 'w-7 h-7 text-sm donor-heart-pulse' : isGold ? 'w-6 h-6 text-xs' : 'w-5 h-5 text-[11px]'
      )}
      style={{
        backgroundColor: isDiamond
          ? 'rgba(87,181,255,0.2)'
          : isGold
            ? 'rgba(250,204,21,0.2)'
            : isSilver
              ? 'rgba(156,163,175,0.2)'
              : 'rgba(180,83,9,0.2)',
        ...(isDiamond ? { boxShadow: '0 0 8px rgba(87,181,255,0.4), 0 0 16px rgba(87,181,255,0.2)' } : {}),
      }}
      title={config.label}
      role="img"
      aria-label={`Sawer Badge: ${config.label}`}
    >
      {config.icon}
    </span>
  );
}

// ============================================
// SkinBadge — Small badge showing skin icon + optional label
// ============================================

export function SkinBadge({ skin, size = 'sm' }: SkinBadgeProps) {
  const colors = resolveSkinColors(skin);

  // sm: just the emoji icon
  if (size === 'sm') {
    return (
      <span
        className="inline-flex items-center justify-center leading-none"
        style={{ fontSize: '14px' }}
        title={skin.displayName}
        role="img"
        aria-label={skin.displayName}
      >
        {skin.icon}
      </span>
    );
  }

  // md: icon + short label (first word)
  if (size === 'md') {
    const badgeColors = colors ? parseBadgeColors(colors.badge) : null;
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold"
        style={{
          backgroundColor: badgeColors?.bg ?? 'rgba(255,255,255,0.1)',
          color: badgeColors?.text ?? 'rgba(255,255,255,0.7)',
        }}
        title={skin.displayName}
      >
        <span style={{ fontSize: '12px' }}>{skin.icon}</span>
        <span className="truncate max-w-[48px]">{skin.displayName.split(' ')[0]}</span>
      </span>
    );
  }

  // lg: icon + full displayName
  const badgeColors = colors ? parseBadgeColors(colors.badge) : null;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-sm font-semibold"
      style={{
        backgroundColor: badgeColors?.bg ?? 'rgba(255,255,255,0.1)',
        color: badgeColors?.text ?? 'rgba(255,255,255,0.7)',
      }}
      title={skin.displayName}
    >
      <span style={{ fontSize: '14px' }}>{skin.icon}</span>
      <span className="truncate">{skin.displayName}</span>
    </span>
  );
}

// ============================================
// SkinBadgesRow — All owned skins as small badges in a row, sorted by priority
// Includes permanent donor heart badge support
// ============================================

export function SkinBadgesRow({ skins, hideSawerAndDonorBadges = false }: SkinBadgesRowProps) {
  const sorted = [...skins].sort((a, b) => b.priority - a.priority);

  if (sorted.length === 0) return null;

  // Extract donorBadgeCount from either the donor skin or donor_badge entry
  let donorBadgeCount = 0;
  for (const skin of sorted) {
    if (skin.type === 'donor' && skin.donorBadgeCount) {
      donorBadgeCount = skin.donorBadgeCount;
    }
    if (skin.type === 'donor_badge' && skin.donorBadgeCount) {
      donorBadgeCount = skin.donorBadgeCount;
    }
  }

  // Extract sawerBadgeTier from sawer_badge virtual entry
  let sawerBadgeTier: string | undefined;
  for (const skin of sorted) {
    if (skin.type === 'sawer_badge' && skin.sawerBadgeTier) {
      sawerBadgeTier = skin.sawerBadgeTier;
    }
  }

  // Filter out donor, donor_badge, sawer_badge, and sawer_* entries (rendered by dedicated DonorHeartBadge/SawerTierBadge)
  let displaySkins = sorted.filter(s =>
    s.type !== 'donor_badge' && s.type !== 'donor' &&
    s.type !== 'sawer_badge' && !isSawerType(s.type)
  );

  return (
    <div className="inline-flex items-center gap-1" role="group" aria-label="Player skins">
      {displaySkins.map((skin) => {
        const colors = resolveSkinColors(skin);
        const badgeColors = colors ? parseBadgeColors(colors.badge) : null;
        return (
          <span
            key={skin.type}
            className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px]"
            style={{
              backgroundColor: badgeColors?.bg ?? 'rgba(255,255,255,0.1)',
            }}
            title={skin.displayName}
          >
            {skin.icon}
          </span>
        );
      })}
      {/* Permanent donor heart badge — hidden when Sultan of the Week badge is present */}
      {donorBadgeCount > 0 && !hideSawerAndDonorBadges && <DonorHeartBadge donorBadgeCount={donorBadgeCount} />}
      {/* Permanent sawer tier badge — hidden when Sultan of the Week badge is present */}
      {sawerBadgeTier && !hideSawerAndDonorBadges && <SawerTierBadge tier={sawerBadgeTier} />}
    </div>
  );
}

// ============================================
// SkinAvatarFrame — Wraps avatar with skin ring + glow
// Includes breathing pulse for lively feel
// ============================================

export function SkinAvatarFrame({ skin, children }: SkinAvatarFrameProps) {
  if (!skin) {
    return <>{children}</>;
  }

  const colors = resolveSkinColors(skin);
  if (!colors) {
    return <>{children}</>;
  }

  return (
    <div className="relative inline-flex items-center justify-center">
      {/* Breathing glow layer behind avatar — tight edge glow */}
      <motion.div
        className="absolute rounded-full"
        style={{
          inset: '-3px',
          boxShadow: `0 0 5px ${colors.glow}, 0 0 10px ${colors.glow}`,
        }}
        animate={{ opacity: [0.4, 1, 0.4], scale: [0.97, 1.04, 0.97] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden="true"
      />
      {/* Avatar with ring */}
      <div
        className="relative rounded-full ring-2"
        style={{
          boxShadow: `0 0 0 2px ${colors.frame}, 0 0 5px ${colors.glow.replace(/[\d.]+\)$/, '0.3)')}`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ============================================
// SkinName — Wraps player name with skin gradient
// ============================================

export function SkinName({ skin, skinColors, children }: SkinNameProps) {
  if (!skin) {
    return <>{children}</>;
  }

  const colors = skinColors || resolveSkinColors(skin);
  if (!colors) {
    return <>{children}</>;
  }

  // Use colored text + text-shadow for neon glow effect
  // NO filter: brightness() — it causes name invisibility in some browsers
  const nameStops = parseColorStops(colors.name);
  const primaryColor = nameStops[1] || nameStops[0] || colors.frame;

  return (
    <motion.span
      className="font-bold inline-block"
      style={{
        color: primaryColor,
        textShadow: `0 0 8px ${colors.glow}, 0 0 20px ${colors.glow}`,
      }}
      animate={{ opacity: [0.85, 1, 0.85] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    >
      {children}
    </motion.span>
  );
}

// ============================================
// SkinCardBorder — Wraps a card with skin border effect
// Includes sweeping light + pulse glow for lively feel
// ============================================

export function SkinCardBorder({ skin, secondarySkin, children }: SkinCardBorderProps) {
  if (!skin) {
    return <>{children}</>;
  }

  const colors = resolveSkinColors(skin);
  if (!colors) {
    return <>{children}</>;
  }

  // Layer 2: twinkle colors (secondary skin)
  const twinkleColors = secondarySkin ? resolveSkinColors(secondarySkin) : null;

  // Resolve sparkle skin for corner twinkle symbols
  const sparkleSkin = secondarySkin || skin;
  const sparkleColors = twinkleColors || colors;

  return (
    <div
      className="relative rounded-2xl overflow-hidden isolate h-full w-full"
      style={{ padding: '3px' }}
    >
      {/* ═══ Layer 1: Border glow with breathing animation — primary skin ═══ */}
      <motion.div
        className="absolute rounded-2xl pointer-events-none"
        style={{
          inset: '-1px',
          border: `2px solid ${colors.frame}`,
          borderRadius: 'inherit',
          boxShadow: `0 0 5px ${colors.glow}, 0 0 10px ${colors.glow}`,
          zIndex: 20,
        }}
        animate={{ opacity: [0.35, 1, 0.35] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden="true"
      />

      {/* ═══ Layer 2: Corner sparkles — secondary skin twinkle ═══ */}
      {secondarySkin && sparkleColors && (
        <>
          {[
            { top: '-6px', left: '-6px' },
            { top: '-6px', right: '-6px' },
            { bottom: '-6px', left: '-6px' },
            { bottom: '-6px', right: '-6px' },
          ].map((pos, i) => (
            <motion.span
              key={`card-sparkle-${i}`}
              className="absolute flex items-center justify-center select-none pointer-events-none"
              style={{
                fontSize: '12px',
                lineHeight: 1,
                ...pos,
                zIndex: 55,
                color: sparkleColors.frame,
                textShadow: `0 0 4px ${sparkleColors.glow}, 0 0 8px ${sparkleColors.glow}`,
              }}
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.6, 1.2, 0.6] }}
              transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.4, ease: 'easeInOut' }}
              aria-hidden="true"
            >{getSkinTwinkle(sparkleSkin.type)}</motion.span>
          ))}
        </>
      )}

      {/* Content — sits above the border */}
      <div className="relative z-10 rounded-[13px] overflow-hidden h-full w-full">
        {children}
      </div>
    </div>
  );
}
