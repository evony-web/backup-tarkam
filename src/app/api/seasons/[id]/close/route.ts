import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { createAuditLog } from '@/lib/audit';
import { autoAwardSeasonChampionSkins } from '@/lib/skin-auto-award';
import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

/**
 * POST /api/seasons/[id]/close
 *
 * Tutup Season — close an active season, auto-determine champion from per-season points,
 * and snapshot the champion data. Does NOT create the next season (admin creates manually).
 *
 * Rules:
 * - Only works on seasons with status "active"
 * - Sets status to "completed" and endDate to now
 * - Determines championPlayerId from per-season PlayerPoint aggregation
 * - Snapshots full champion stats so historical display is accurate even after new seasons
 * - Only 1 active season per division at a time (validated on season creation, not here)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  try {
    const season = await db.season.findUnique({
      where: { id },
      include: {
        tournaments: { select: { id: true, status: true } },
      },
    });

    if (!season) {
      return NextResponse.json({ error: 'Season tidak ditemukan' }, { status: 404 });
    }

    if (season.status !== 'active') {
      return NextResponse.json({
        error: `Season tidak bisa ditutup karena status saat ini "${season.status}". Hanya season "active" yang bisa ditutup.`,
      }, { status: 400 });
    }

    // Warn if there are incomplete tournaments
    const incompleteTournaments = season.tournaments.filter(
      t => t.status !== 'completed' && t.status !== 'setup'
    );
    if (incompleteTournaments.length > 0) {
      return NextResponse.json({
        error: `Masih ada ${incompleteTournaments.length} tournament yang belum selesai. Finalisasi semua tournament terlebih dahulu sebelum menutup season.`,
      }, { status: 400 });
    }

    // ===== DETERMINE CHAMPION =====
    const updateData: {
      status: string;
      endDate: Date;
      championPlayerId?: string | null;
      championPlayerPoints?: number | null;
      championPlayerSnapshot?: string | null;
    } = {
      status: 'completed',
      endDate: new Date(),
    };

    // Champion is the player with most per-season points
    // Compute from PlayerPoint records (not lifetime Player.points)
    const seasonPoints = await db.playerPoint.groupBy({
      by: ['playerId'],
      where: { seasonId: id },
      _sum: { amount: true },
    });

    if (seasonPoints.length > 0) {
      // Get player details for tiebreaking AND snapshot
      const playerIds = seasonPoints.map(sp => sp.playerId);
      const players = await db.player.findMany({
        where: { id: { in: playerIds }, division: season.division, isActive: true },
        include: {
          clubMembers: {
            where: { leftAt: null },
            include: { profile: { select: { id: true, name: true, logo: true } } },
            take: 1,
          },
        },
      });
      const playerMap = new Map(players.map(p => [p.id, p]));

      // Sort by per-season points desc, then totalWins desc as tiebreaker
      seasonPoints.sort((a, b) => {
        const ptsA = a._sum.amount || 0;
        const ptsB = b._sum.amount || 0;
        if (ptsB !== ptsA) return ptsB - ptsA;
        const winsA = playerMap.get(a.playerId)?.totalWins || 0;
        const winsB = playerMap.get(b.playerId)?.totalWins || 0;
        return winsB - winsA;
      });

      const championId = seasonPoints[0]?.playerId;
      updateData.championPlayerId = championId || null;
      updateData.championPlayerPoints = seasonPoints[0]?._sum.amount || null;

      // Snapshot the champion player data at time of season closure
      if (championId) {
        const champion = playerMap.get(championId);
        if (champion) {
          const activeClub = champion.clubMembers[0]?.profile;
          const clubSnapshot = activeClub ? { id: activeClub.id, name: activeClub.name, logo: activeClub.logo } : null;
          updateData.championPlayerSnapshot = JSON.stringify({
            gamertag: champion.gamertag,
            avatar: champion.avatar,
            tier: champion.tier,
            points: seasonPoints[0]?._sum.amount || 0, // Per-season points (not lifetime)
            totalWins: champion.totalWins,
            totalMvp: champion.totalMvp,
            streak: champion.streak,
            maxStreak: champion.maxStreak,
            matches: champion.matches,
            club: clubSnapshot,
            city: champion.city || '',
            division: champion.division,
          });
        }
      }
    } else {
      updateData.championPlayerId = null;
      updateData.championPlayerPoints = null;
    }

    // ===== CLOSE THE SEASON =====
    // Neon HTTP workaround: update() with include triggers internal transaction
    // Split into: update first (no include), then read with include separately
    await db.season.update({
      where: { id },
      data: updateData,
    });

    const updated = await db.season.findUnique({
      where: { id },
      include: {
        championPlayer: { select: { id: true, gamertag: true, division: true, avatar: true, points: true } },
        _count: { select: { tournaments: true, clubs: true } },
      },
    });

    // ===== AUTO-AWARD SEASON CHAMPION SKIN =====
    // Award the season_champion (Diamond Blue) skin to the champion player.
    // If the player has no Account, the skin is skipped but the virtual skin
    // entry in the stats API will still render the diamond blue effect.
    let skinAwardMessage = '';
    if (updateData.championPlayerId) {
      try {
        const skinResults = await autoAwardSeasonChampionSkins(
          updateData.championPlayerId,
          season.name,
          authResult.id,
          'player'
        );
        const awarded = skinResults.filter(r => r.action === 'awarded' || r.action === 'extended');
        const skipped = skinResults.filter(r => r.action === 'skipped_no_account');
        if (awarded.length > 0) {
          skinAwardMessage = ` 💎 Season Champion skin diberikan ke ${awarded.map(r => r.gamertag).join(', ')}.`;
        }
        if (skipped.length > 0) {
          skinAwardMessage += ` ⚠️ ${skipped.map(r => r.gamertag).join(', ')} belum punya akun — skin akan tampil otomatis saat akun dibuat.`;
        }
      } catch (skinErr) {
        console.warn('[close-season] Failed to auto-award season_champion skin:', skinErr);
        // Non-critical — virtual skin entries in stats API ensure rendering works
      }
    }

    // Invalidate caches
    revalidatePath('/');
    revalidateTag('landing-stats', 'max');

    // Pusher: Notify real-time clients about season closure
    try {
      const { pusherTrigger, PUSHER_CHANNELS, PUSHER_EVENTS } = await import('@/lib/pusher');
      await pusherTrigger(PUSHER_CHANNELS.LEADERBOARD, PUSHER_EVENTS.LEADERBOARD_UPDATED, {
        division: season.division, seasonId: id,
      });
      await pusherTrigger(PUSHER_CHANNELS.FEED, PUSHER_EVENTS.FEED_UPDATED, {
        type: 'season_closed', seasonId: id,
      });
    } catch { /* non-critical */ }

    await createAuditLog({
      adminId: authResult.id,
      adminName: authResult.username,
      action: 'update',
      entity: 'season',
      entityId: id,
      details: 'Tutup season',
    });

    return NextResponse.json({
      success: true,
      message: `Season "${season.name}" berhasil ditutup!${updateData.championPlayerId ? ' Champion otomatis ditentukan dari per-season points.' : ' Tidak ada champion yang ditentukan (belum ada point record).'}${skinAwardMessage} `,
      season: updated,
    });

  } catch (error) {
    console.error('Close season error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan saat menutup season' }, { status: 500 });
  }
}
