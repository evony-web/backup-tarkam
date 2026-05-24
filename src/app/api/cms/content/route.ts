import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// Force dynamic — prevent Next.js/Vercel from caching CMS content
export const dynamic = 'force-dynamic';

// GET all CMS content for public rendering (no auth required)
export async function GET() {
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

  return NextResponse.json(
    { settings: settingsMap, sections: sectionsMap },
    { headers: {
      // ★ CMS data cached for 300s at CDN, stale-while-revalidate for 10min
      // CMS content rarely changes — aggressive caching dramatically reduces DB queries.
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      'Surrogate-Key': 'cms-content',
      'Vary': 'Accept-Encoding',
    } }
  );
}
