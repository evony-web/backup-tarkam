import { db } from '@/lib/db';
import { getPlayerAchievements } from '@/lib/achievements';
import { NextResponse } from 'next/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  const { id } = await params;

  try {
    // Check if player exists
    const player = await db.player.findUnique({
      where: { id },
      select: { id: true, gamertag: true, points: true },
    });

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { headers,  status: 404 });
    }

    // Get player achievements
    const achievements = await getPlayerAchievements(id);

    // Get all available achievements for progress tracking
    const allAchievements = await db.achievement.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        displayName: true,
        description: true,
        category: true,
        icon: true,
        tier: true,
        criteria: true,
      },
    });

    // Calculate progress for each achievement
    const earnedIds = new Set(achievements.map(a => a.achievement.id));
    const availableAchievements = allAchievements.map(a => ({
      ...a,
      criteria: JSON.parse(a.criteria),
      earned: earnedIds.has(a.id),
    }));

    // Group by category
    const byCategory = {
      tournament: availableAchievements.filter(a => a.category === 'tournament'),
      mvp: availableAchievements.filter(a => a.category === 'mvp'),
      points: availableAchievements.filter(a => a.category === 'points'),
      club: availableAchievements.filter(a => a.category === 'club'),
    };

    return NextResponse.json({
      player: {
        id: player.id,
        gamertag: player.gamertag,
        points: player.points,
      },
      achievements,
      availableAchievements,
      byCategory,
      stats: {
        total: allAchievements.length,
        earned: achievements.length,
        remaining: allAchievements.length - achievements.length,
      },
    }, { headers });
  } catch (e: unknown) {
    const error = e as Error;
    console.error('Get player achievements error:', error);
    return NextResponse.json({ error: error.message }, { headers,  status: 500 });
  }
}
