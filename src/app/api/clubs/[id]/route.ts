import { db, neonTransaction, neonDeleteMany, isPostgreSQL } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { createAuditLog } from '@/lib/audit';
import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

// GET /api/clubs/[id] — Club detail with profile, members, and season info
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  const { id } = await params;
  const club = await db.club.findUnique({
    where: { id },
    include: {
      profile: {
        include: {
          members: {
            where: { leftAt: null },
            include: { player: { select: { id: true, name: true, gamertag: true, division: true, tier: true, points: true, totalWins: true, totalMvp: true, streak: true, avatar: true } } },
            orderBy: [{ role: 'desc' }, { player: { gamertag: 'asc' } }],
          },
        },
      },
      season: { select: { id: true, name: true, division: true, status: true } },
    },
  });
  if (!club) return NextResponse.json({ error: 'Club not found' }, { headers,  status: 404 });

  // Flatten for frontend compatibility
  const flat = {
    id: club.id,
    profileId: club.profileId,
    name: club.profile.name,
    logo: club.profile.logo,
    bannerImage: club.profile.bannerImage,
    division: club.division,
    seasonId: club.seasonId,
    wins: club.wins,
    losses: club.losses,
    points: club.points,
    gameDiff: club.gameDiff,
    season: club.season,
    members: club.profile.members.map(m => ({
      id: m.id,
      role: m.role,
      joinedAt: m.joinedAt,
      player: m.player,
    })),
    _count: { members: club.profile.members.length },
  };

  return NextResponse.json(flat, { headers });
}

// PUT /api/clubs/[id] — Edit club (name, logo, banner → all on ClubProfile now)
// Accepts BOTH Club ID (season entry) and ClubProfile ID (unified mode)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const body = await request.json();
  const { name, logo, bannerImage } = body;

  // Try to find as Club (season entry) first, then as ClubProfile
  let club = await db.club.findUnique({
    where: { id },
    include: { profile: true, season: true },
  });

  let profileId: string;
  let profileName: string;

  if (club) {
    // ID is a Club (season entry) ID
    profileId = club.profileId;
    profileName = club.profile.name;
  } else {
    // Try as ClubProfile ID (unified mode returns profile.id)
    const profile = await db.clubProfile.findUnique({ where: { id } });
    if (!profile) {
      return NextResponse.json({ error: 'Club tidak ditemukan' }, { status: 404 });
    }
    profileId = profile.id;
    profileName = profile.name;
  }

  // ── Update ClubProfile (persistent identity: name, logo, banner) ──
  if (name || logo !== undefined || bannerImage !== undefined) {
    // Check name uniqueness if renaming
    if (name && name !== profileName) {
      const existing = await db.clubProfile.findFirst({
        where: { name, id: { not: profileId } },
      });
      if (existing) {
        return NextResponse.json({ error: 'Nama club sudah digunakan' }, { status: 409 });
      }
    }

    await db.clubProfile.update({
      where: { id: profileId },
      data: {
        ...(name && { name: name.trim() }),
        ...(logo !== undefined && { logo }),
        ...(bannerImage !== undefined && { bannerImage }),
      },
    });
  }

  // Re-fetch updated profile
  const updatedProfile = await db.clubProfile.findUnique({
    where: { id: profileId },
  });

  // If we originally found a Club entry, also return club-level data
  if (club) {
    const updatedClub = await db.club.findUnique({
      where: { id: club.id },
    });
    revalidatePath('/');
    revalidatePath('/api/stats');
    revalidateTag('cms-content', 'max');

    // ★ Pusher: notify all clients of club data change (logo, name, etc.)
    try {
      const { pusherTrigger, PUSHER_CHANNELS, PUSHER_EVENTS } = await import('@/lib/pusher');
      void pusherTrigger(PUSHER_CHANNELS.LEADERBOARD, PUSHER_EVENTS.LEADERBOARD_UPDATED, {});
      void pusherTrigger(PUSHER_CHANNELS.FEED, PUSHER_EVENTS.CLUB_MEMBER_CHANGED, {
        type: 'club-update',
        clubId: id,
      });
    } catch { /* non-critical */ }

    await createAuditLog({
      adminId: authResult.id,
      adminName: authResult.username,
      action: 'update',
      entity: 'club',
      entityId: id,
      details: `Update club "${profileName}"`,
    });

    return NextResponse.json({
      id: updatedClub!.id,
      profileId: updatedProfile!.id,
      name: updatedProfile!.name,
      logo: updatedProfile!.logo,
      bannerImage: updatedProfile!.bannerImage,
      division: updatedClub!.division,
      seasonId: updatedClub!.seasonId,
      wins: updatedClub!.wins,
      losses: updatedClub!.losses,
      points: updatedClub!.points,
      gameDiff: updatedClub!.gameDiff,
    });
  }

  // Return profile-level response for unified mode
  revalidatePath('/');
  revalidatePath('/api/stats');
  revalidateTag('cms-content', 'max');

  // ★ Pusher: notify all clients of club data change (logo, name, etc.)
  try {
    const { pusherTrigger, PUSHER_CHANNELS, PUSHER_EVENTS } = await import('@/lib/pusher');
    void pusherTrigger(PUSHER_CHANNELS.LEADERBOARD, PUSHER_EVENTS.LEADERBOARD_UPDATED, {});
    void pusherTrigger(PUSHER_CHANNELS.FEED, PUSHER_EVENTS.CLUB_MEMBER_CHANGED, {
      type: 'club-update',
      clubId: id,
    });
  } catch { /* non-critical */ }

  await createAuditLog({
    adminId: authResult.id,
    adminName: authResult.username,
    action: 'update',
    entity: 'club',
    entityId: id,
    details: `Update club "${profileName}"`,
  });

  return NextResponse.json({
    id: updatedProfile!.id,
    profileId: updatedProfile!.id,
    name: updatedProfile!.name,
    logo: updatedProfile!.logo,
    bannerImage: updatedProfile!.bannerImage,
  });
}

// DELETE /api/clubs/[id] — Delete club
// Accepts BOTH Club ID (season entry) and ClubProfile ID (unified mode)
// When deleting via ClubProfile ID: deletes ALL season entries + the profile itself
// When deleting via Club ID: deletes only that season entry (keeps profile)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;

    // Try to find as Club (season entry) first, then as ClubProfile
    let club;
    try {
      club = await db.club.findUnique({
        where: { id },
        include: {
          profile: { select: { id: true, name: true } },
          season: { select: { id: true, name: true } },
        },
      });
    } catch (clubErr: any) {
      console.error('[DELETE /api/clubs] Error finding club by ID:', clubErr?.message);
      club = null;
    }

    if (club) {
      // ID is a Club (season entry) ID — delete only this season entry
      await db.club.delete({ where: { id } });

      // Invalidate cache
      revalidatePath('/');
      revalidatePath('/api/stats');
      revalidateTag('cms-content', 'max');

      await createAuditLog({
        adminId: authResult.id,
        adminName: authResult.username,
        action: 'delete',
        entity: 'club',
        entityId: id,
        details: `Menghapus club "${club.profile.name}" dari season`,
      });

      return NextResponse.json({ success: true, message: `Club "${club.profile.name}" berhasil dihapus dari season ini. Profil club dan anggota tetap tersimpan.` });
    }

    // Try as ClubProfile ID (unified mode)
    // Step 1: Find the profile with simple query first
    let profile;
    try {
      profile = await db.clubProfile.findUnique({ where: { id } });
    } catch (profileErr: any) {
      console.error('[DELETE /api/clubs] Error finding profile by ID:', profileErr?.message);
      return NextResponse.json({ error: 'Gagal mencari club. Silakan coba lagi.' }, { status: 500 });
    }

    if (!profile) {
      return NextResponse.json({ error: 'Club tidak ditemukan' }, { status: 404 });
    }

    // Step 2: Check for season entries
    const seasonEntries = await db.club.findMany({
      where: { profileId: id },
      select: {
        id: true,
        division: true,
        seasonId: true,
      },
    });

    // Delete all season entries + profile in one transaction
    const profileName = profile.name;

    await neonTransaction(async (tx) => {
      // Delete all Club season entries for this profile
      if (isPostgreSQL) {
        await neonDeleteMany('Club', [{ column: 'profileId', operator: '=', value: id }], tx);
      } else {
        await tx.club.deleteMany({
          where: { profileId: id },
        });
      }

      // Delete the ClubProfile (cascade will remove ClubMember records)
      await tx.clubProfile.delete({
        where: { id },
      });
    });

    // Invalidate cache
    revalidatePath('/');
    revalidatePath('/api/stats');
    revalidateTag('cms-content', 'max');

    // ★ Pusher: notify all clients of club deletion
    try {
      const { pusherTrigger, PUSHER_CHANNELS, PUSHER_EVENTS } = await import('@/lib/pusher');
      void pusherTrigger(PUSHER_CHANNELS.LEADERBOARD, PUSHER_EVENTS.LEADERBOARD_UPDATED, {});
      void pusherTrigger(PUSHER_CHANNELS.FEED, PUSHER_EVENTS.CLUB_MEMBER_CHANGED, {
        type: 'club-deleted',
        clubId: id,
      });
    } catch { /* non-critical */ }

    await createAuditLog({
      adminId: authResult.id,
      adminName: authResult.username,
      action: 'delete',
      entity: 'club',
      entityId: id,
      details: `Menghapus club "${profileName}" beserta seluruh data season dan keanggotaan`,
    });

    return NextResponse.json({ success: true, message: `Club "${profileName}" berhasil dihapus secara permanen beserta seluruh season dan keanggotaannya.` });
  } catch (error: any) {
    console.error('[DELETE /api/clubs] Unexpected error:', error);
    return NextResponse.json({ error: 'Gagal menghapus club. Silakan coba lagi.' }, { status: 500 });
  }
}
