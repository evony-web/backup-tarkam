import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { createAuditLog } from '@/lib/audit';
import { pusherTrigger, PUSHER_CHANNELS, PUSHER_EVENTS } from '@/lib/pusher';
import { revalidateTag } from 'next/cache';

// POST /api/admin/players/approve — Approve or reject a pending player
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  try {
    const body = await request.json();
    const { playerId, action, tier, reason } = body;

    // Validate required fields
    if (!playerId || typeof playerId !== 'string') {
      return NextResponse.json(
        { error: 'ID player wajib diisi' },
        { status: 400 }
      );
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Action harus "approve" atau "reject"' },
        { status: 400 }
      );
    }

    // Find the player
    const player = await db.player.findUnique({
      where: { id: playerId },
      include: { account: true },
    });

    if (!player) {
      return NextResponse.json(
        { error: 'Player tidak ditemukan' },
        { status: 404 }
      );
    }

    // Verify player is currently pending
    if (player.registrationStatus !== 'pending') {
      return NextResponse.json(
        { error: `Player sudah berstatus "${player.registrationStatus}". Hanya player dengan status "pending" yang bisa diproses.` },
        { status: 400 }
      );
    }

    let updatedPlayer;

    if (action === 'approve') {
      // Validate tier if provided
      const validTiers = ['S', 'A', 'B'];
      const assignedTier = tier && validTiers.includes(tier) ? tier : 'B';

      // NOTE: Neon HTTP adapter doesn't support transactions.
      // db.player.update() with `include` that has `where` filters on relations
      // triggers an internal transaction, causing "Transactions are not supported in HTTP mode".
      // Fix: split update and read into two separate operations.
      await db.player.update({
        where: { id: playerId },
        data: {
          registrationStatus: 'approved',
          tier: assignedTier,
          isActive: true,
        },
      });

      updatedPlayer = await db.player.findUnique({
        where: { id: playerId },
        include: {
          account: { select: { id: true, username: true } },
          clubMembers: {
            where: { leftAt: null },
            include: { profile: { select: { id: true, name: true, logo: true } } },
          },
        },
      });
    } else {
      // action === 'reject'
      if (!reason || typeof reason !== 'string' || !reason.trim()) {
        return NextResponse.json(
          { error: 'Alasan penolakan wajib diisi' },
          { status: 400 }
        );
      }

      await db.player.update({
        where: { id: playerId },
        data: {
          registrationStatus: 'rejected',
          isActive: false,
        },
      });

      updatedPlayer = await db.player.findUnique({
        where: { id: playerId },
        include: {
          account: { select: { id: true, username: true } },
          clubMembers: {
            where: { leftAt: null },
            include: { profile: { select: { id: true, name: true, logo: true } } },
          },
        },
      });
    }

    // Invalidate cached data
    try {
      revalidateTag('landing-stats', 'max');
      revalidateTag('landing-league', 'max');
    } catch (cacheErr) {
      console.warn('[ADMIN_APPROVE] revalidateTag failed:', cacheErr);
    }

    // Trigger Pusher real-time events
    try {
      await pusherTrigger(PUSHER_CHANNELS.LEADERBOARD, PUSHER_EVENTS.LEADERBOARD_UPDATED, {
        division: player.division,
      });
      await pusherTrigger(PUSHER_CHANNELS.FEED, PUSHER_EVENTS.PLAYER_REGISTERED, {
        type: action === 'approve' ? 'player-approved' : 'player-rejected',
        playerId: player.id,
        gamertag: player.gamertag,
        division: player.division,
        timestamp: new Date().toISOString(),
      });
    } catch (pusherError) {
      console.warn('[PUSHER] Failed to trigger player approval event:', pusherError);
    }

    // Audit log
    await createAuditLog({
      adminId: admin.id,
      adminName: admin.username,
      action: action === 'approve' ? 'approve' : 'reject',
      entity: 'player',
      entityId: playerId,
      details: `${action === 'approve' ? 'Menyetujui' : 'Menolak'} pendaftaran player: ${player.name} (${player.gamertag})`,
      metadata: {
        previousStatus: 'pending',
        newStatus: action === 'approve' ? 'approved' : 'rejected',
        tier: action === 'approve' ? (tier && ['S', 'A', 'B'].includes(tier) ? tier : 'B') : undefined,
        reason: action === 'reject' ? reason : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        action === 'approve'
          ? `Player "${player.gamertag}" berhasil disetujui`
          : `Player "${player.gamertag}" berhasil ditolak`,
      player: updatedPlayer,
    });
  } catch (error) {
    console.error('[ADMIN_PLAYERS_APPROVE_POST]', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memproses pendaftaran player' },
      { status: 500 }
    );
  }
}

// GET /api/admin/players/approve — List players by registration status
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const division = searchParams.get('division');

    // Validate status filter
    const validStatuses = ['pending', 'approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Status harus salah satu dari: ${validStatuses.join(', ')}` },
        { status: 400, headers }
      );
    }

    // Validate division filter if provided
    if (division && !['male', 'female'].includes(division)) {
      return NextResponse.json(
        { error: 'Division harus "male" atau "female"' },
        { status: 400, headers }
      );
    }

    const where: Record<string, unknown> = {
      registrationStatus: status,
    };
    if (division) where.division = division;

    const players = await db.player.findMany({
      where,
      include: {
        account: {
          select: { id: true, username: true },
        },
        clubMembers: {
          where: { leftAt: null },
          include: {
            profile: { select: { id: true, name: true, logo: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      {
        success: true,
        data: players,
        count: players.length,
      },
      { headers }
    );
  } catch (error) {
    console.error('[ADMIN_PLAYERS_APPROVE_GET]', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data player' },
      { status: 500, headers }
    );
  }
}
