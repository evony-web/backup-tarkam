// ═══════════════════════════════════════════════════════════
// CMS DATA FETCHER — Shared between SSR and CSR
// ═══════════════════════════════════════════════════════════
// This module provides CMS data fetching that works both
// server-side (in page.tsx) and client-side (in React Query).
// Using the same logic ensures consistency.

import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';

export interface CmsContent {
  settings: Record<string, string>;
  sections: Record<string, any>;
}

/**
 * Fetch CMS content directly from database.
 * Used server-side in page.tsx for SSR, and can be used
 * client-side as well.
 */
async function fetchCmsContentInner(): Promise<CmsContent> {
  try {
    const [settings, sections] = await Promise.all([
      db.cmsSetting.findMany({ orderBy: { key: 'asc' } }),
      db.cmsSection.findMany({
        where: { isActive: true },
        orderBy: { order: 'asc' },
        include: {
          cards: {
            where: { isActive: true },
            orderBy: { order: 'asc' },
          },
        },
      }),
    ]);

    // Convert settings to key-value map
    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }

    // Convert sections to slug-keyed map
    const sectionsMap: Record<string, typeof sections[0]> = {};
    for (const s of sections) {
      sectionsMap[s.slug] = s;
    }

    return { settings: settingsMap, sections: sectionsMap };
  } catch (error) {
    console.error('[CMS] Failed to fetch CMS content:', error);
    return { settings: {}, sections: {} };
  }
}

// ★ TTFB OPTIMIZATION: Cache CMS content for 10 minutes.
// CMS data rarely changes — admin updates use revalidateTag for instant purge.
const fetchCmsContentCached = unstable_cache(
  fetchCmsContentInner,
  ['cms-content'],
  { revalidate: 600, tags: ['cms-content'] }
);

export async function fetchCmsContent(): Promise<CmsContent> {
  return fetchCmsContentCached();
}
