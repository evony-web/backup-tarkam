'use client';

import { useQuery } from '@tanstack/react-query';

interface BackgroundImages {
  bgMale: string;
  bgFemale: string;
  heroBannerDashboard: string;
}

const DEFAULTS: BackgroundImages = {
  bgMale: '',
  bgFemale: '',
  heroBannerDashboard: '',
};

/**
 * Lightweight hook that fetches background image URLs from CMS settings.
 * Falls back to empty strings if settings haven't been configured yet
 * if settings haven't been configured yet.
 *
 * Uses React Query with 60s staleTime — cached across all components,
 * only one network request per minute max.
 *
 * IMPORTANT: Uses the same queryKey as CMS Panel (['cms-settings']) but with
 * identical queryFn return shape ({ settings, map }) and `select` to extract
 * just the map. This prevents cache collisions where different data shapes
 * would overwrite each other.
 */
export function useBackgroundImages(): BackgroundImages & { isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['cms-settings'],
    queryFn: async () => {
      const res = await fetch('/api/cms/settings');
      if (!res.ok) return { settings: [], map: {} as Record<string, string> };
      const json = await res.json();
      return json as { settings: { id: string; key: string; value: string; type: string }[]; map: Record<string, string> };
    },
    select: (data) => data.map || {},
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });

  const map = data || {};
  return {
    bgMale: map.bg_male || DEFAULTS.bgMale,
    bgFemale: map.bg_female || DEFAULTS.bgFemale,
    heroBannerDashboard: map.hero_banner_dashboard || DEFAULTS.heroBannerDashboard,
    isLoading,
  };
}

/**
 * Get background image for a specific division.
 * Convenience wrapper around useBackgroundImages().
 */
export function useDivisionBackground(division: 'male' | 'female'): string & { isLoading: boolean } {
  const { bgMale, bgFemale, isLoading } = useBackgroundImages();
  const url = division === 'male' ? bgMale : bgFemale;
  return Object.assign(url, { isLoading });
}

/**
 * Server-side helper: get background image URL from a CMS settings map.
 * For use in components that already have cmsSettings loaded.
 */
export function getBackgroundFromSettings(
  settingsMap: Record<string, string>,
  key: 'bg_male' | 'bg_female' | 'hero_banner_dashboard',
): string {
  return settingsMap[key] || DEFAULTS[key === 'bg_male' ? 'bgMale' : key === 'bg_female' ? 'bgFemale' : 'heroBannerDashboard'];
}
