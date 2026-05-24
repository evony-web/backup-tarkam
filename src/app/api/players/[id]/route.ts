import { NextRequest, NextResponse } from 'next/server';
import { db, neonUpdateMany, isPostgreSQL } from '@/lib/db';
import { verifyAdmin, verifyPlayer } from '@/lib/api-auth';
import { createAuditLog } from '@/lib/audit';
import { revalidatePath, revalidateTag } from 'next/cache';

/** Normalize phone to international format (628xxx) to match waNumber */
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length >= 10) {
    digits = '62' + digits.slice(1);
  }
  return digits || null;
}

// Fields that a player can update on their OWN profile (safe fields only)
const PLAYER_SELF_UPDATE_FIELDS = new Set([
  'name', 'city', 'phone', 'avatar',
]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  const { id } = await params;
  const player = await db.player.findUnique({
    where: { id },
    include: {
      teamPlayers: { include: { team: { include: { tournament: true } } } },
      participations: { include: { tournament: true } },
      clubMembers: {
        where: { leftAt: null },
        include: { profile: { select: { id: true, name: true, logo: true } } },
      },
    },
  });

  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { headers,  status: 404 });
  }

  return NextResponse.json(player, { headers });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  // ── Dual auth: try admin first, then player ──
  // Key: if admin cookie is present but invalid, don't fall back to player —
  // that would cause a confusing 403 when the admin session just expired.
  const hasAdminCookie = !!(request.cookies.get('idm-admin-session')?.value);
  const admin = await verifyAdmin(request);
  const player = admin ? null : (hasAdminCookie ? null : await verifyPlayer(request));

  if (!admin && !player) {
    if (hasAdminCookie) {
      return NextResponse.json({ error: 'Sesi admin telah kedaluwarsa. Silakan login kembali.' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Unauthorized — Admin or player login required' }, { status: 401 });
  }

  // Build update data object based on auth level
  const updateData: Record<string, unknown> = {};

  if (admin) {
    // Admin can update ALL fields
    if (body.name !== undefined) updateData.name = body.name;
    if (body.gamertag !== undefined) updateData.gamertag = body.gamertag;
    if (body.tier !== undefined) updateData.tier = body.tier;
    if (body.avatar !== undefined) updateData.avatar = body.avatar;
    if (body.points !== undefined) updateData.points = body.points;
    if (body.totalWins !== undefined) updateData.totalWins = body.totalWins;
    if (body.totalMvp !== undefined) updateData.totalMvp = body.totalMvp;
    if (body.streak !== undefined) updateData.streak = body.streak;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.registrationStatus !== undefined) updateData.registrationStatus = body.registrationStatus;
    if (body.city !== undefined) updateData.city = body.city;
    if (body.phone !== undefined) updateData.phone = normalizePhone(body.phone);
    if (body.joki !== undefined) updateData.joki = body.joki;
    if (body.division !== undefined) updateData.division = body.division;
  } else if (player) {
    // Player can only update their OWN profile, and only safe fields
    if (player.playerId !== id) {
      return NextResponse.json({ error: 'Forbidden — You can only update your own profile' }, { status: 403 });
    }

    for (const key of Object.keys(body)) {
      if (PLAYER_SELF_UPDATE_FIELDS.has(key) && body[key] !== undefined) {
        // Normalize phone to international format (628xxx) to match waNumber
        if (key === 'phone') {
          updateData[key] = normalizePhone(body[key]);
        } else {
          updateData[key] = body[key];
        }
      }
    }

    // Club changes NOT allowed via player self-update (admin only)
    if (body.clubId !== undefined) {
      return NextResponse.json({ error: 'Forbidden — Club changes require admin action' }, { status: 403 });
    }
  }

  // If no valid fields to update, return current player
  if (Object.keys(updateData).length === 0 && body.clubId === undefined) {
    const current = await db.player.findUnique({
      where: { id },
      include: {
        clubMembers: {
          where: { leftAt: null },
          include: { profile: { select: { id: true, name: true, logo: true } } },
        },
      },
    });
    return NextResponse.json(current);
  }

  const playerResult = await db.player.update({
    where: { id },
    data: updateData,
  });

  // Handle club membership change (admin only)
  if (admin && body.clubId !== undefined) {
    // Soft-remove existing club memberships (set leftAt)
    // Neon workaround: updateMany() doesn't work with PrismaNeonHttp
    if (isPostgreSQL) {
      await neonUpdateMany('ClubMember',
        [{ column: 'playerId', operator: '=', value: id }, { column: 'leftAt', operator: 'IS NULL' }],
        { leftAt: new Date().toISOString() },
      );
    } else {
      await db.clubMember.updateMany({
        where: { playerId: id, leftAt: null },
        data: { leftAt: new Date() },
      });
    }

    // Add new club membership if clubId is provided (not null/empty)
    if (body.clubId) {
      let profileId: string | null = null;
      const club = await db.club.findUnique({ where: { id: body.clubId } });
      if (club) {
        profileId = club.profileId;
      } else {
        const profile = await db.clubProfile.findUnique({ where: { id: body.clubId } });
        if (profile) {
          profileId = profile.id;
        }
      }

      if (profileId) {
        const existing = await db.clubMember.findFirst({
          where: { playerId: id, profileId },
        });
        if (existing) {
          await db.clubMember.update({
            where: { id: existing.id },
            data: { leftAt: null, role: 'member', joinedAt: new Date() },
          });
        } else {
          await db.clubMember.create({
            data: { playerId: id, profileId, role: 'member' },
          });
        }
      }
    }
  }

  // Return player with updated club membership
  const updatedPlayer = await db.player.findUnique({
    where: { id },
    include: {
      clubMembers: {
        where: { leftAt: null },
        include: { profile: { select: { id: true, name: true, logo: true } } },
      },
    },
  });


  // ★ Invalidate CDN + ISR cache so landing page shows updated data immediately
  try {
    revalidatePath('/');
    revalidatePath('/api/stats');
    revalidateTag('landing-stats', 'max');
  } catch (e) {
    console.warn('[PUT /api/players/[id]] revalidateTag error (non-critical):', e);
  }

  // ★ Pusher: notify all clients of player data change (avatar, stats, etc.)
  try {
    const { pusherTrigger, PUSHER_CHANNELS, PUSHER_EVENTS } = await import('@/lib/pusher');
    void pusherTrigger(PUSHER_CHANNELS.LEADERBOARD, PUSHER_EVENTS.LEADERBOARD_UPDATED, {
      division: updatedPlayer?.clubMembers?.[0] ? undefined : playerResult.division,
    });
    void pusherTrigger(PUSHER_CHANNELS.FEED, PUSHER_EVENTS.FEED_UPDATED, {
      type: 'player-update',
      playerId: id,
    });
  } catch { /* non-critical — Pusher failure should not block the response */ }

  // Audit log — only for admin actions
  if (admin) {
    await createAuditLog({
      adminId: admin.id,
      adminName: admin.username,
      action: 'update',
      entity: 'player',
      entityId: id,
      details: `Update player: ${playerResult.name} (${playerResult.gamertag})`,
      metadata: { updatedFields: Object.keys(updateData) },
    });
  }

  return NextResponse.json(updatedPlayer || playerResult);
}
