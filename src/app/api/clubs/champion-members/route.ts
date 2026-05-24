import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/**
 * GET /api/clubs/champion-members?clubId=xxx
 *
 * Given a champion club ID (can be ClubProfile ID or Club ID),
 * return all active members from that ClubProfile.
 *
 * Since clubs are now unified entities via ClubProfile, members
 * from both male and female divisions are automatically included.
 */
export async function GET(request: Request) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  const { searchParams } = new URL(request.url);
  const clubId = searchParams.get('clubId');

  if (!clubId) {
    return NextResponse.json({ error: 'clubId is required' }, { headers,  status: 400 });
  }

  // Try to find as ClubProfile first, then as Club
  let profileId = clubId;
  let profileName: string | null = null;

  const profile = await db.clubProfile.findUnique({
    where: { id: clubId },
    select: { id: true, name: true },
  });

  if (profile) {
    profileId = profile.id;
    profileName = profile.name;
  } else {
    // Maybe it's a Club ID — look up the profile
    const club = await db.club.findUnique({
      where: { id: clubId },
      include: { profile: { select: { id: true, name: true } } },
    });

    if (!club) {
      return NextResponse.json({ error: 'Club tidak ditemukan' }, { headers,  status: 404 });
    }

    profileId = club.profileId;
    profileName = club.profile.name;
  }

  // Get all active members from this ClubProfile
  const members = await db.clubMember.findMany({
    where: { profileId, leftAt: null },
    include: {
      player: {
        select: {
          id: true,
          gamertag: true,
          division: true,
          avatar: true,
          tier: true,
        },
      },
    },
    orderBy: { player: { gamertag: 'asc' } },
  });

  // Get all division entries for this profile
  const seasonEntries = await db.club.findMany({
    where: { profileId },
    select: { id: true, division: true, seasonId: true },
  });

  const divisions = [...new Set(seasonEntries.map(c => c.division))];

  return NextResponse.json({
    clubName: profileName,
    divisions,
    members: members.map(m => ({
      id: m.player.id,
      gamertag: m.player.gamertag,
      division: m.player.division,
      avatar: m.player.avatar,
      tier: m.player.tier,
      role: m.role,
      profileId,
    })),
  }, { headers });
}
