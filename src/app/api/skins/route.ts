import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/skins
 * List all available skins (public, no auth needed)
 * Returns all active skins ordered by priority desc
 */
export async function GET() {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  try {
    const skins = await db.skin.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });

    return NextResponse.json({
      count: skins.length,
      skins: skins.map(skin => ({
        id: skin.id,
        type: skin.type,
        displayName: skin.displayName,
        description: skin.description,
        icon: skin.icon,
        colorClass: JSON.parse(skin.colorClass),
        priority: skin.priority,
        duration: skin.duration,
        isActive: skin.isActive,
      })),
    }, { headers });
  } catch (error) {
    console.error('List skins error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch skins' },
      { headers,  status: 500 }
    );
  }
}
