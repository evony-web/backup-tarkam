'use client';

import type { DivisionTheme } from './use-division-theme';

/* ═══════════════════════════════════════════════════════
   COMMUNITY THEME — Gold/Amber identity
   Community Dashboard has its own visual identity,
   independent of Male/Female division colors.
   ═══════════════════════════════════════════════════════ */

const communityTheme: DivisionTheme = {
  division: 'male', // kept for type compat, not used for styling
  /* Dark canvas surfaces + luxury gold jewelry accents
     Gold tints give depth & rich elegance on coal navy canvas */
  text: 'text-idm-gold-warm',
  textLight: 'text-idm-amber',
  bg: 'bg-idm-gold-warm/8',
  bgSubtle: 'bg-idm-gold-warm/5',
  border: 'border-idm-gold-warm/15',
  borderSubtle: 'border-idm-gold-warm/10',
  glow: 'glow-gold',
  gradientText: 'text-gradient-fury',
  iconBg: 'bg-idm-gold-warm/10',
  color: '#EFF923',
  colorLight: '#F9CB25',
  tabBg: 'bg-idm-gold-warm/15',
  navActive: 'bg-idm-gold-warm/10 text-idm-gold-warm',
  badgeBg: 'bg-idm-gold-warm/15 text-idm-gold-warm border-idm-gold-warm/25',
  /* Card neon tokens — gold */
  cardGold: 'card-gold-community',
  cardChampion: 'card-champion-community',
  glowChampion: 'glow-champion-community',
  cardGlowHover: 'card-glow-hover-community',
  cardPrize: 'card-prize-community',
  cardPremium: 'card-premium card-premium-community',
  /* Inline division colors — gold */
  prizeBg: 'bg-idm-gold-warm/5',
  prizeBorder: 'border-idm-gold-warm/15',
  prizeText: 'text-idm-gold-warm',
  /* Casino SpinWin tokens — gold */
  casinoCard: 'casino-card casino-card-community',
  casinoBar: 'casino-card-bar-community',
  casinoGlow: 'casino-glow-community',
  casinoBadge: 'casino-badge casino-badge-community',
  neonText: 'neon-text-community',
  neonGradient: 'text-neon-community',
  neonPulse: 'neon-pulse-community',
  cornerAccent: 'casino-corner-accent casino-corner-accent-community',
  /* Division-tinted background/glass tokens — gold */
  bgMesh: 'bg-mesh-community',
  glassStrong: 'glass-strong glass-strong-community',
  /* Hover utility tokens — gold */
  hoverBorder: 'hover-border-community',
  hoverBgSubtle: 'hover-bg-subtle-community',
  hoverBg: 'hover-bg-community',
  /* Division-specific subtle indicators — gold variants (community default) */
  divisionDot: 'bg-idm-gold-warm',
  divisionBadge: 'bg-idm-gold-warm/15 text-idm-gold-warm',
  divisionBg: 'bg-idm-gold-warm/5',
};

export function useCommunityTheme(): DivisionTheme {
  return communityTheme;
}

export function getCommunityTheme(): DivisionTheme {
  return communityTheme;
}
