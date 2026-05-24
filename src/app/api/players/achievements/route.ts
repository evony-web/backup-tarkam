import { NextRequest, NextResponse } from 'next/server';
import { db, neonDeleteMany, isPostgreSQL } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';

// POST - Assign achievement to player
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  try {
    const body = await request.json();
    const { playerId, achievementId, tournamentId, context } = body;

    if (!playerId || !achievementId) {
      return NextResponse.json({ error: 'Player ID and Achievement ID are required' }, { status: 400 });
    }

    // Check if already has this achievement
    const existing = await db.playerAchievement.findUnique({
      where: {
        playerId_achievementId: {
          playerId,
          achievementId,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'Player already has this achievement' }, { status: 400 });
    }

    // Get achievement to check for reward points
    const achievement = await db.achievement.findUnique({
      where: { id: achievementId },
    });

    // Create achievement record
    const playerAchievement = await db.playerAchievement.create({
      data: {
        playerId,
        achievementId,
        tournamentId,
        context,
      },
    });

    // Award points if achievement has reward points
    if (achievement && achievement.rewardPoints > 0) {
      await db.player.update({
        where: { id: playerId },
        data: {
          points: { increment: achievement.rewardPoints },
        },
      });

      // Look up tournament's seasonId for per-season attribution
      let seasonId: string | null = null;
      if (tournamentId) {
        const tournament = await db.tournament.findUnique({
          where: { id: tournamentId },
          select: { seasonId: true },
        });
        seasonId = tournament?.seasonId || null;
      }

      // Record point transaction
      await db.playerPoint.create({
        data: {
          playerId,
          tournamentId,
          seasonId,
          amount: achievement.rewardPoints,
          reason: 'achievement_reward',
          description: `Earned achievement: ${achievement.displayName}`,
        },
      });
    }

    return NextResponse.json({ success: true, playerAchievement });
  } catch (error) {
    console.error('Error assigning achievement:', error);
    return NextResponse.json({ error: 'Failed to assign achievement' }, { status: 500 });
  }
}

// GET - Get player achievements (by playerId) or achievement holders (by achievementId)
export async function GET(request: NextRequest) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  try {
    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get('playerId');
    const achievementId = searchParams.get('achievementId');

    if (achievementId) {
      // Fetch all player achievements for a specific achievement (for revoke section)
      const playerAchievements = await db.playerAchievement.findMany({
        where: { achievementId },
        include: {
          player: {
            select: {
              gamertag: true,
              name: true,
              avatar: true,
            },
          },
        },
        orderBy: { earnedAt: 'desc' },
      });

      return NextResponse.json({ playerAchievements }, { headers });
    }

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID or Achievement ID is required' }, { headers, status: 400 });
    }

    const achievements = await db.playerAchievement.findMany({
      where: { playerId },
      include: {
        achievement: true,
        tournament: true,
      },
      orderBy: { earnedAt: 'desc' },
    });

    return NextResponse.json({ achievements }, { headers });
  } catch (error) {
    console.error('Error fetching player achievements:', error);
    return NextResponse.json({ error: 'Failed to fetch achievements' }, { headers, status: 500 });
  }
}

// DELETE - Revoke achievement from player
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  try {
    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get('playerId');
    const achievementId = searchParams.get('achievementId');

    if (!playerId || !achievementId) {
      return NextResponse.json({ error: 'Player ID and Achievement ID are required' }, { status: 400 });
    }

    // Find the PlayerAchievement record
    const playerAchievement = await db.playerAchievement.findUnique({
      where: {
        playerId_achievementId: {
          playerId,
          achievementId,
        },
      },
    });

    if (!playerAchievement) {
      return NextResponse.json({ error: 'Player does not have this achievement' }, { status: 404 });
    }

    // Get achievement to check for reward points reversal
    const achievement = await db.achievement.findUnique({
      where: { id: achievementId },
    });

    // Delete the PlayerAchievement record
    await db.playerAchievement.delete({
      where: {
        playerId_achievementId: {
          playerId,
          achievementId,
        },
      },
    });

    // Reverse points if achievement had reward points
    if (achievement && achievement.rewardPoints > 0) {
      // Decrement player points
      await db.player.update({
        where: { id: playerId },
        data: {
          points: { decrement: achievement.rewardPoints },
        },
      });

      // Delete the corresponding PlayerPoint record
      // Neon workaround: deleteMany() doesn't work with PrismaNeonHttp
      if (isPostgreSQL) {
        await neonDeleteMany('PlayerPoint', [
          { column: 'playerId', operator: '=', value: playerId },
          { column: 'reason', operator: '=', value: 'achievement_reward' },
        ]);
      } else {
        await db.playerPoint.deleteMany({
          where: {
            playerId,
            reason: 'achievement_reward',
            description: `Earned achievement: ${achievement.displayName}`,
          },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error revoking achievement:', error);
    return NextResponse.json({ error: 'Failed to revoke achievement' }, { status: 500 });
  }
}
