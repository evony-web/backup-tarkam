'use client';

import { useAppStore } from '@/lib/store';
import type { Division } from '@/lib/store';
import { getCommunityTheme } from './use-community-theme';

export interface DivisionTheme {
  division: Division;
  text: string;
  textLight: string;
  bg: string;
  bgSubtle: string;
  border: string;
  borderSubtle: string;
  glow: string;
  gradientText: string;
  iconBg: string;
  color: string;
  colorLight: string;
  tabBg: string;
  navActive: string;
  badgeBg: string;
  /* Card frame/border tokens — division neon */
  cardGold: string;
  cardChampion: string;
  glowChampion: string;
  cardGlowHover: string;
  cardPrize: string;
  cardPremium: string;
  /* Division-specific bg/border for inline use */
  prizeBg: string;
  prizeBorder: string;
  prizeText: string;
  /* Casino SpinWin tokens */
  casinoCard: string;
  casinoBar: string;
  casinoGlow: string;
  casinoBadge: string;
  neonText: string;
  neonGradient: string;
  neonPulse: string;
  cornerAccent: string;
  /* Division-tinted background/glass tokens */
  bgMesh: string;
  glassStrong: string;
  /* Hover utility tokens — static CSS classes for Tailwind-safe hover */
  hoverBorder: string;
  hoverBgSubtle: string;
  hoverBg: string;
  /* Division-specific subtle indicators — only used INSIDE cards */
  divisionDot?: string;    // Small dot indicator: e.g. 'bg-idm-male' or 'bg-idm-female'
  divisionBadge?: string;  // Badge style for inside cards: e.g. 'bg-idm-male/15 text-idm-male' or 'bg-idm-female/15 text-idm-female'
  divisionBg?: string;     // Subtle bg for inside cards: e.g. 'bg-idm-male/5' or 'bg-idm-female/5'
}

/* ═══════════════════════════════════════════════════════
   MALE THEME — Gold identity with cyan subtle accents
   Shell/UI = gold; Division color (cyan) only inside cards
   ═══════════════════════════════════════════════════════ */
const maleTheme: DivisionTheme = {
  division: 'male',
  /* Shell/UI — GOLD identity for text/badges, NEUTRAL surfaces with light/dark support */
  text: 'text-idm-gold-warm',
  textLight: 'text-idm-amber',
  bg: 'dark:bg-white/[0.04] bg-muted/30',
  bgSubtle: 'dark:bg-white/[0.02] bg-muted/15',
  border: 'dark:border-white/[0.06] border-border/40',
  borderSubtle: 'dark:border-white/[0.04] border-border/25',
  glow: 'glow-gold',
  gradientText: 'text-gradient-fury',
  iconBg: 'dark:bg-white/[0.06] bg-muted/30',
  color: '#EFF923',
  colorLight: '#F9CB25',
  tabBg: 'bg-idm-gold-warm/15',
  navActive: 'bg-idm-gold-warm/10 text-idm-gold-warm',
  badgeBg: 'bg-idm-gold-warm/15 text-idm-gold-warm border-idm-gold-warm/25',
  /* Card neon tokens — GOLD (community style) */
  cardGold: 'card-gold-community',
  cardChampion: 'card-champion-community',
  glowChampion: 'glow-champion-community',
  cardGlowHover: 'card-glow-hover-community',
  cardPrize: 'card-prize-community',
  cardPremium: 'card-premium card-premium-community',
  /* Inline division colors — GOLD */
  prizeBg: 'bg-idm-gold-warm/5',
  prizeBorder: 'border-idm-gold-warm/15',
  prizeText: 'text-idm-gold-warm',
  /* Casino SpinWin tokens — GOLD */
  casinoCard: 'casino-card casino-card-community',
  casinoBar: 'casino-card-bar-community',
  casinoGlow: 'casino-glow-community',
  casinoBadge: 'casino-badge casino-badge-community',
  neonText: 'neon-text-community',
  neonGradient: 'text-neon-community',
  neonPulse: 'neon-pulse-community',
  cornerAccent: 'casino-corner-accent casino-corner-accent-community',
  /* Division-tinted background/glass tokens — GOLD */
  bgMesh: 'bg-mesh-community',
  glassStrong: 'glass-strong glass-strong-community',
  /* Hover utility tokens — GOLD */
  hoverBorder: 'hover-border-community',
  hoverBgSubtle: 'hover-bg-subtle-community',
  hoverBg: 'hover-bg-community',
  /* Division-specific subtle indicators — CYAN for inside cards only */
  divisionDot: 'bg-idm-male',
  divisionBadge: 'bg-idm-male/15 text-idm-male',
  divisionBg: 'bg-idm-male/5',
};

/* ═══════════════════════════════════════════════════════
   FEMALE THEME — Gold identity with purple subtle accents
   Shell/UI = gold; Division color (purple) only inside cards
   ═══════════════════════════════════════════════════════ */
const femaleTheme: DivisionTheme = {
  division: 'female',
  /* Shell/UI — GOLD identity for text/badges, NEUTRAL surfaces with light/dark support */
  text: 'text-idm-gold-warm',
  textLight: 'text-idm-amber',
  bg: 'dark:bg-white/[0.04] bg-muted/30',
  bgSubtle: 'dark:bg-white/[0.02] bg-muted/15',
  border: 'dark:border-white/[0.06] border-border/40',
  borderSubtle: 'dark:border-white/[0.04] border-border/25',
  glow: 'glow-gold',
  gradientText: 'text-gradient-fury',
  iconBg: 'dark:bg-white/[0.06] bg-muted/30',
  color: '#EFF923',
  colorLight: '#F9CB25',
  tabBg: 'bg-idm-gold-warm/15',
  navActive: 'bg-idm-gold-warm/10 text-idm-gold-warm',
  badgeBg: 'bg-idm-gold-warm/15 text-idm-gold-warm border-idm-gold-warm/25',
  /* Card neon tokens — GOLD (community style) */
  cardGold: 'card-gold-community',
  cardChampion: 'card-champion-community',
  glowChampion: 'glow-champion-community',
  cardGlowHover: 'card-glow-hover-community',
  cardPrize: 'card-prize-community',
  cardPremium: 'card-premium card-premium-community',
  /* Inline division colors — GOLD */
  prizeBg: 'bg-idm-gold-warm/5',
  prizeBorder: 'border-idm-gold-warm/15',
  prizeText: 'text-idm-gold-warm',
  /* Casino SpinWin tokens — GOLD */
  casinoCard: 'casino-card casino-card-community',
  casinoBar: 'casino-card-bar-community',
  casinoGlow: 'casino-glow-community',
  casinoBadge: 'casino-badge casino-badge-community',
  neonText: 'neon-text-community',
  neonGradient: 'text-neon-community',
  neonPulse: 'neon-pulse-community',
  cornerAccent: 'casino-corner-accent casino-corner-accent-community',
  /* Division-tinted background/glass tokens — GOLD */
  bgMesh: 'bg-mesh-community',
  glassStrong: 'glass-strong glass-strong-community',
  /* Hover utility tokens — GOLD */
  hoverBorder: 'hover-border-community',
  hoverBgSubtle: 'hover-bg-subtle-community',
  hoverBg: 'hover-bg-community',
  /* Division-specific subtle indicators — PURPLE for inside cards only */
  divisionDot: 'bg-idm-female',
  divisionBadge: 'bg-idm-female/15 text-idm-female',
  divisionBg: 'bg-idm-female/5',
};

export function getDivisionTheme(division: Division): DivisionTheme {
  if (division === 'semua') return getCommunityTheme(); // neutral gold identity for "All"
  return division === 'male' ? maleTheme : femaleTheme;
}

export function useDivisionTheme(): DivisionTheme {
  const division = useAppStore((s) => s.division);
  return getDivisionTheme(division);
}
