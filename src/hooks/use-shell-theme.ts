'use client';

import { useAppStore } from '@/lib/store';
import { useDivisionTheme, type DivisionTheme } from './use-division-theme';
import { useCommunityTheme } from './use-community-theme';

/**
 * Shell theme — returns Community theme (gold/amber) when:
 * 1. currentView is 'community'
 * 2. division is 'semua' (All — use neutral base identity color, not division color)
 *
 * Otherwise returns the division theme (male=cyan, female=purple).
 * Used by app-shell for sidebar, header, mobile nav, and background mesh.
 */
export function useShellTheme(): DivisionTheme {
  const currentView = useAppStore((s) => s.currentView);
  const division = useAppStore((s) => s.division);
  const dt = useDivisionTheme();
  const ct = useCommunityTheme();

  // Community dashboard always gold
  if (currentView === 'community') return ct;
  // "Semua" (All) = neutral base identity → gold, not a specific division color
  if (division === 'semua') return ct;
  return dt;
}
