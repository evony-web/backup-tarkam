import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/**
 * POST /api/update-champion-rules
 * 
 * One-time update to:
 * 1. Deactivate champion_2 and champion_3 skins in the database
 * 2. Revoke any active champion_2 and champion_3 PlayerSkin records
 * 3. Update "Podium Regular" achievement description to reflect Juara 1 only
 * 
 * Auth: requires SESSION_SECRET as key param
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const secretKey = url.searchParams.get('key') || request.headers.get('x-recalculate-key');
  if (secretKey !== process.env.SESSION_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results: string[] = [];

    // 1. Deactivate champion_2 and champion_3 skins
    const deactivatedSkins: string[] = [];
    for (const skinType of ['champion_2', 'champion_3']) {
      const skin = await db.skin.findUnique({ where: { type: skinType } });
      if (skin && skin.isActive) {
        await db.skin.update({
          where: { type: skinType },
          data: { 
            isActive: false,
            description: `TIDAK AKTIF — Skin ${skinType === 'champion_2' ? 'Juara 2' : 'Juara 3'} tidak lagi diberikan. Hanya Juara 1 mendapat skin.`,
          },
        });
        deactivatedSkins.push(skinType);
      }
    }
    results.push(`Deactivated skins: ${deactivatedSkins.join(', ') || 'none (already inactive)'}`);

    // 2. Revoke any active champion_2 and champion_3 PlayerSkin records
    let revokedCount = 0;
    for (const skinType of ['champion_2', 'champion_3']) {
      const skin = await db.skin.findUnique({ where: { type: skinType } });
      if (skin) {
        const deleted = await db.playerSkin.deleteMany({
          where: { skinId: skin.id },
        });
        revokedCount += deleted.count;
      }
    }
    results.push(`Revoked ${revokedCount} champion_2/3 PlayerSkin records`);

    // 3. Update "Podium Regular" achievement description
    const podiumAchievement = await db.achievement.findUnique({
      where: { name: 'podium_regular' },
    });
    if (podiumAchievement) {
      await db.achievement.update({
        where: { name: 'podium_regular' },
        data: {
          description: 'Menang Juara 1 sebanyak 5 kali',
        },
      });
      results.push('Updated "Podium Regular" description to Juara 1 only');
    } else {
      results.push('"Podium Regular" achievement not found in DB');
    }

    // 4. Also update "Weekly Champion" achievement description
    const weeklyChampion = await db.achievement.findUnique({
      where: { name: 'weekly_champion' },
    });
    if (weeklyChampion) {
      await db.achievement.update({
        where: { name: 'weekly_champion' },
        data: {
          description: 'Menang Juara 1 tournament mingguan',
        },
      });
      results.push('Updated "Weekly Champion" description');
    }

    // 4. Fix isWinner flag on Participation records
    // isWinner should ONLY be true for Juara 1 (tournament champion team)
    // Currently it may be set incorrectly from the old score route
    const completedTournaments = await db.tournament.findMany({
      where: { status: 'completed' },
      select: { id: true },
    });

    let fixedParticipationCount = 0;
    for (const tournament of completedTournaments) {
      // Find the rank 1 team for this tournament
      const rank1Team = await db.team.findFirst({
        where: { tournamentId: tournament.id, rank: 1, isWinner: true },
        include: { teamPlayers: true },
      });

      const juara1PlayerIds = new Set<string>();
      if (rank1Team) {
        for (const tp of rank1Team.teamPlayers) {
          juara1PlayerIds.add(tp.playerId);
        }
      }

      // Get all participations for this tournament with isWinner=true
      const winnerParticipations = await db.participation.findMany({
        where: { tournamentId: tournament.id, isWinner: true },
      });

      for (const part of winnerParticipations) {
        if (!juara1PlayerIds.has(part.playerId)) {
          await db.participation.update({
            where: { id: part.id },
            data: { isWinner: false },
          });
          fixedParticipationCount++;
        }
      }
    }
    results.push(`Fixed isWinner flag on ${fixedParticipationCount} non-Juara-1 participations`);

    return NextResponse.json({
      success: true,
      message: 'Champion rules updated: skins and achievements only for Juara 1',
      results,
    });

  } catch (error) {
    console.error('Update champion rules error:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
