import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { NextResponse } from 'next/server';

// PUT /api/clubs/[id]/captain — Transfer captain role (via ClubProfile)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id: clubId } = await params;
  const body = await request.json();
  const { newCaptainId } = body;

  if (!newCaptainId) {
    return NextResponse.json({ error: 'New captain player ID wajib diisi' }, { status: 400 });
  }

  // Validate club and get profileId
  const club = await db.club.findUnique({
    where: { id: clubId },
    include: { profile: true },
  });
  if (!club) {
    return NextResponse.json({ error: 'Club tidak ditemukan' }, { status: 404 });
  }

  const profileId = club.profileId;

  // Validate new captain is an active member of this club profile
  const newCaptainMembership = await db.clubMember.findFirst({
    where: { profileId, playerId: newCaptainId, leftAt: null },
    include: { player: { select: { gamertag: true } } },
  });

  if (!newCaptainMembership) {
    return NextResponse.json({ error: 'Player bukan anggota club ini' }, { status: 400 });
  }

  // Demote current captain
  const currentCaptain = await db.clubMember.findFirst({
    where: { profileId, role: 'captain', leftAt: null },
  });

  if (currentCaptain) {
    await db.clubMember.update({
      where: { id: currentCaptain.id },
      data: { role: 'member' },
    });
  }

  // Promote new captain
  await db.clubMember.update({
    where: { id: newCaptainMembership.id },
    data: { role: 'captain' },
  });

  return NextResponse.json({
    success: true,
    message: `Captain berhasil dipindahkan ke ${newCaptainMembership.player.gamertag}`,
    newCaptain: {
      playerId: newCaptainId,
      gamertag: newCaptainMembership.player.gamertag,
    },
  });
}
