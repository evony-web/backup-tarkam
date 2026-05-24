import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/api-auth';
import { createAuditLog } from '@/lib/audit';

/**
 * GET /api/backup — Export all critical data as a downloadable JSON file.
 * Protected by requireSuperAdmin.
 * Returns a JSON response with timestamp for audit trail.
 */
export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (admin instanceof NextResponse) return admin;

  try {
    const timestamp = new Date().toISOString();

    // Export all critical data in parallel for performance
    const [
      players,
      clubs,
      clubMembers,
      clubProfiles,
      matches,
      donations,
      seasons,
      tournaments,
      accounts,
      auditLogs,
      pointRecords,
      achievements,
      playerAchievements,
      sponsors,
      participations,
      teams,
      teamPlayers,
      playerSeasonStats,
    ] = await Promise.all([
      db.player.findMany({ orderBy: { createdAt: 'desc' } }),
      db.club.findMany({ orderBy: { points: 'desc' } }),
      db.clubMember.findMany({ where: { leftAt: null }, orderBy: { joinedAt: 'desc' } }),
      db.clubProfile.findMany({ orderBy: { name: 'asc' } }),
      db.match.findMany({ orderBy: { createdAt: 'desc' } }),
      db.donation.findMany({ orderBy: { createdAt: 'desc' } }),
      db.season.findMany({ orderBy: { number: 'desc' } }),
      db.tournament.findMany({ orderBy: { weekNumber: 'desc' } }),
      db.account.findMany({
        select: {
          id: true,
          playerId: true,
          username: true,
          email: true,
          phone: true,
          donorBadgeCount: true,
          sawerBadgeTier: true,
          lastLoginAt: true,
          createdAt: true,
          // Exclude passwordHash for security
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 500 }),
      db.playerPoint.findMany({ orderBy: { createdAt: 'desc' }, take: 1000 }),
      db.achievement.findMany({ orderBy: { category: 'asc' } }),
      db.playerAchievement.findMany({ orderBy: { earnedAt: 'desc' }, take: 500 }),
      db.sponsor.findMany({ orderBy: { tier: 'asc' } }),
      db.participation.findMany({ orderBy: { createdAt: 'desc' }, take: 1000 }),
      db.team.findMany({ orderBy: { power: 'desc' } }),
      db.teamPlayer.findMany(),
      db.playerSeasonStats.findMany({ orderBy: { points: 'desc' } }),
    ]);

    const backupData = {
      _meta: {
        exportedAt: timestamp,
        exportedBy: admin.username,
        version: '1.0',
        description: 'TARKAM IDM Full Backup — all critical data exported',
      },
      players,
      accounts,
      clubs,
      clubMembers,
      clubProfiles,
      matches,
      donations,
      seasons,
      tournaments,
      auditLogs,
      pointRecords,
      achievements,
      playerAchievements,
      sponsors,
      participations,
      teams,
      teamPlayers,
      playerSeasonStats,
    };

    // Audit log: backup export
    await createAuditLog({
      adminId: admin.id,
      adminName: admin.username,
      action: 'export',
      entity: 'backup',
      details: `Full backup exported by ${admin.username}`,
      metadata: {
        timestamp,
        playerCount: players.length,
        clubCount: clubs.length,
        matchCount: matches.length,
        donationCount: donations.length,
        seasonCount: seasons.length,
        tournamentCount: tournaments.length,
      },
    });

    // Return as downloadable JSON with timestamp filename
    const filename = `tarkam-idm-backup-${timestamp.replace(/[:.]/g, '-')}.json`;

    return new NextResponse(JSON.stringify(backupData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[BACKUP_EXPORT_ERROR]', error);
    return NextResponse.json(
      { error: 'Gagal mengekspor backup. Coba lagi nanti.' },
      { status: 500 }
    );
  }
}
