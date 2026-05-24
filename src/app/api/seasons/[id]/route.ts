import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { createAuditLog } from '@/lib/audit';
import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  try {
    const { id } = await params;
    const season = await db.season.findUnique({
      where: { id },
      include: {
        tournaments: { orderBy: { weekNumber: 'asc' } },
        clubs: {
          orderBy: { points: 'desc' },
          include: {
            profile: { select: { id: true, name: true, logo: true } },
          },
        },
        donations: { orderBy: { createdAt: 'desc' } },
        championPlayer: { select: { id: true, gamertag: true, division: true, avatar: true, points: true } },
        sultanPlayer: { select: { id: true, gamertag: true, division: true, avatar: true, points: true, tier: true, totalWins: true, totalMvp: true, streak: true, maxStreak: true, matches: true } },
        _count: { select: { tournaments: true, clubs: true, donations: true } },
      },
    });

    if (!season) {
      return NextResponse.json({ error: 'Season not found' }, { headers, status: 404 });
    }

    // For completed seasons, use PlayerSeasonStats for accurate historical data
    let seasonPlayers: Array<{ id: string; gamertag: string; division: string; avatar: string | null; points: number; rank: number | null; tier: string; club: string | null; tournamentCount: number }> = [];

    if (season.status === 'completed') {
      // Use PlayerSeasonStats for completed seasons — accurate historical snapshots
      const statsRecords = await db.playerSeasonStats.findMany({
        where: { seasonId: id },
        include: {
          player: {
            select: {
              id: true, gamertag: true, division: true, avatar: true,
              clubMembers: {
                where: { leftAt: null },
                include: { profile: { select: { name: true } } },
                take: 1,
              },
            },
          },
        },
        orderBy: [
          { points: 'desc' },
          { totalWins: 'desc' },
        ],
      });

      seasonPlayers = statsRecords.map((stat, idx) => ({
        id: stat.player.id,
        gamertag: stat.player.gamertag,
        division: stat.player.division,
        avatar: stat.player.avatar,
        points: stat.points,
        rank: stat.rank || idx + 1,
        tier: stat.tier,
        club: stat.player.clubMembers[0]?.profile?.name || null,
        tournamentCount: 0,
      }));
    } else {
      // Active/upcoming seasons — use live participation data
      const participations = await db.participation.findMany({
        where: {
          tournament: { seasonId: id },
          status: { in: ['approved', 'assigned'] },
        },
        include: {
          player: {
            select: {
              id: true, gamertag: true, division: true, avatar: true, points: true,
              clubMembers: {
                where: { leftAt: null },
                include: { profile: { select: { name: true } } },
                take: 1,
              },
            },
          },
        },
      });
      const playerMap = new Map<string, { id: string; gamertag: string; division: string; avatar: string | null; points: number; tier: string; club: string | null; tournamentCount: number }>();
      for (const p of participations) {
        const existing = playerMap.get(p.player.id);
        if (existing) {
          existing.tournamentCount++;
        } else {
          playerMap.set(p.player.id, {
            id: p.player.id,
            gamertag: p.player.gamertag,
            division: p.player.division,
            avatar: p.player.avatar,
            points: p.player.points,
            tier: p.player.clubMembers[0]?.profile?.name ? 'B' : 'B', // will be overridden
            club: p.player.clubMembers[0]?.profile?.name || null,
            tournamentCount: 1,
          });
        }
      }
      seasonPlayers = Array.from(playerMap.values())
        .sort((a, b) => b.points - a.points)
        .map((p, idx) => ({ ...p, rank: null, tier: 'B' }));
    }

    // Parse JSON string fields
    const response = { ...season } as Record<string, unknown>;
    if (response.championSquad && typeof response.championSquad === 'string') {
      try {
        response.championSquad = JSON.parse(response.championSquad as string);
      } catch {
        response.championSquad = null;
      }
    }
    if (response.championPlayerSnapshot && typeof response.championPlayerSnapshot === 'string') {
      try {
        response.championPlayerSnapshot = JSON.parse(response.championPlayerSnapshot as string);
      } catch {
        response.championPlayerSnapshot = null;
      }
    }
    // Add players for seasons
    if (seasonPlayers.length > 0) {
      response.players = seasonPlayers;
    }

    return NextResponse.json(response, { headers });
  } catch (error: unknown) {
    console.error('[GET /api/seasons/[id]] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/seasons/[id] — Update season (status, championPlayerId, endDate, name)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, status, championPlayerId, championPlayerPoints, championSquad, endDate, sultanPlayerId } = body;

    const season = await db.season.findUnique({ where: { id } });
    if (!season) {
      return NextResponse.json({ error: 'Season tidak ditemukan' }, { status: 404 });
    }

    // Validate championPlayerId if provided (references Player)
    if (championPlayerId !== undefined && championPlayerId !== null) {
      const player = await db.player.findUnique({ where: { id: championPlayerId } });
      if (!player) {
        return NextResponse.json({ error: 'Player champion tidak ditemukan' }, { status: 400 });
      }
    }

    // Validate sultanPlayerId if provided (Sultan of Season — references Player)
    if (sultanPlayerId !== undefined && sultanPlayerId !== null) {
      const player = await db.player.findUnique({ where: { id: sultanPlayerId } });
      if (!player) {
        return NextResponse.json({ error: 'Sultan of Season tidak ditemukan' }, { status: 400 });
      }
    }

    // Validate championSquad if provided — must be array with max 5 members
    if (championSquad !== undefined) {
      if (championSquad !== null && !Array.isArray(championSquad)) {
        return NextResponse.json({ error: 'championSquad harus berupa array' }, { status: 400 });
      }
      if (Array.isArray(championSquad) && championSquad.length > 5) {
        return NextResponse.json({ error: 'championSquad maksimal 5 anggota' }, { status: 400 });
      }
    }

    // Validate status transition
    if (status && !['active', 'completed', 'upcoming'].includes(status)) {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 });
    }

    // If completing season, auto-set endDate
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (status !== undefined) updateData.status = status;
    if (championPlayerId !== undefined) updateData.championPlayerId = championPlayerId || null;
    if (sultanPlayerId !== undefined) updateData.sultanPlayerId = sultanPlayerId || null;
    if (championPlayerPoints !== undefined) updateData.championPlayerPoints = championPlayerPoints || null;
    if (championSquad !== undefined) updateData.championSquad = championSquad ? JSON.stringify(championSquad) : null;
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;

    // When status is set to completed and no endDate, set now
    if (status === 'completed' && !endDate && !season.endDate) {
      updateData.endDate = new Date();
    }

    // ===== SNAPSHOT CHAMPION DATA when manually setting champion + completing season =====
    const willBeCompleted = status === 'completed' || (status === undefined && season.status === 'completed');

    // Snapshot champion player
    if (championPlayerId && willBeCompleted) {
      const player = await db.player.findUnique({
        where: { id: championPlayerId },
        include: {
          clubMembers: {
            where: { leftAt: null },
            include: { profile: { select: { id: true, name: true, logo: true } } },
            take: 1,
          },
        },
      });
      if (player) {
        const activeClub = player.clubMembers[0]?.profile?.name || null;
        let perSeasonPoints = championPlayerPoints;
        if (!perSeasonPoints) {
          const seasonPoints = await db.playerPoint.groupBy({
            by: ['playerId'],
            where: { playerId: championPlayerId, seasonId: id },
            _sum: { amount: true },
          });
          perSeasonPoints = seasonPoints[0]?._sum.amount || 0;
        }
        updateData.championPlayerSnapshot = JSON.stringify({
          gamertag: player.gamertag,
          avatar: player.avatar,
          tier: player.tier,
          points: perSeasonPoints,
          totalWins: player.totalWins,
          totalMvp: player.totalMvp,
          streak: player.streak,
          maxStreak: player.maxStreak,
          matches: player.matches,
          club: activeClub ? { id: player.clubMembers[0]?.profile?.id, name: activeClub, logo: player.clubMembers[0]?.profile?.logo || null } : null,
          division: player.division,
        });
      }
    }

    // Clear snapshots when removing champion
    if (championPlayerId === null) {
      updateData.championPlayerSnapshot = null;
    }

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
        sultanPlayer: { select: { id: true, gamertag: true, division: true, avatar: true, points: true, tier: true, totalWins: true, totalMvp: true, streak: true, maxStreak: true, matches: true } },
        _count: { select: { tournaments: true, clubs: true } },
      },
    });

    // Parse JSON string fields
    const updatedResponse = { ...(updated || {}) } as Record<string, unknown>;
    if (updatedResponse.championSquad && typeof updatedResponse.championSquad === 'string') {
      try {
        updatedResponse.championSquad = JSON.parse(updatedResponse.championSquad as string);
      } catch {
        updatedResponse.championSquad = null;
      }
    }
    if (updatedResponse.championPlayerSnapshot && typeof updatedResponse.championPlayerSnapshot === 'string') {
      try {
        updatedResponse.championPlayerSnapshot = JSON.parse(updatedResponse.championPlayerSnapshot as string);
      } catch {
        updatedResponse.championPlayerSnapshot = null;
      }
    }

    // Invalidate Next.js server cache so landing page shows updated champion data
    revalidatePath('/');
    revalidateTag('landing-stats', 'max');

    await createAuditLog({
      adminId: authResult.id,
      adminName: authResult.username,
      action: 'update',
      entity: 'season',
      entityId: id,
      details: `Update season "${season.name}"`,
    });

    return NextResponse.json(updatedResponse);
  } catch (error: unknown) {
    console.error('[PUT /api/seasons/[id]] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/seasons/[id] — Delete season (cascade handled by Prisma schema)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id } = await params;

    const season = await db.season.findUnique({
      where: { id },
      include: { _count: { select: { tournaments: true, clubs: true } } },
    });
    if (!season) {
      return NextResponse.json({ error: 'Season tidak ditemukan' }, { status: 404 });
    }

    // Prisma cascade deletes will handle: tournaments → teams → teamPlayers, matches → playerPoints,
    // clubs → clubMembers, donations (SetNull), etc.
    await db.season.delete({ where: { id } });

    await createAuditLog({
      adminId: authResult.id,
      adminName: authResult.username,
      action: 'delete',
      entity: 'season',
      entityId: id,
      details: `Menghapus season "${season.name}"`,
    });

    return NextResponse.json({ success: true, message: 'Season berhasil dihapus' });
  } catch (error: unknown) {
    console.error('[DELETE /api/seasons/[id]] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
