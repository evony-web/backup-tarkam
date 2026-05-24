import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { createAuditLog } from '@/lib/audit';
import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function GET(request: Request) {
  const headers = new Headers();
  headers.set('Cache-Control', 's-maxage=15, stale-while-revalidate=120');
  headers.set('Vary', 'Accept-Encoding');

  const { searchParams } = new URL(request.url);
  const seasonId = searchParams.get('seasonId');
  const division = searchParams.get('division');
  const unified = searchParams.get('unified') === 'true';

  // ── Unified mode: return ALL clubs from ALL active seasons, deduplicated by name ──
  if (unified) {
    const clubProfiles = await db.clubProfile.findMany({
      orderBy: { name: 'asc' },
      include: {
        members: { where: { leftAt: null } },
        seasonEntries: {
          where: { season: { status: { in: ['active', 'completed'] } } },
          include: { season: { select: { name: true, division: true } } },
        },
      },
    });

    const result = clubProfiles.map(profile => {
      let totalWins = 0, totalLosses = 0, totalPoints = 0, totalGameDiff = 0;
      for (const entry of profile.seasonEntries) {
        totalWins += entry.wins;
        totalLosses += entry.losses;
        totalPoints += entry.points;
        totalGameDiff += entry.gameDiff;
      }

      return {
        id: profile.id,
        name: profile.name,
        logo: profile.logo,
        bannerImage: profile.bannerImage,
        wins: totalWins,
        losses: totalLosses,
        points: totalPoints,
        gameDiff: totalGameDiff,
        memberCount: profile.members.length,
        seasonRecords: profile.seasonEntries.map(e => ({
          id: e.id,
          seasonId: e.seasonId,
          division: e.division,
          memberCount: profile.members.length,
        })),
      };
    });

    // Note: We always use ClubProfile ID as the club ID in the dropdown.
    // This ensures consistency — the player form sends ClubProfile IDs,
    // and the PUT /api/players/:id handler resolves them correctly.

    return NextResponse.json(result, { headers });
  }

  // ── Original mode: filter by seasonId or division ──
  const where: Record<string, unknown> = {};
  if (seasonId) where.seasonId = seasonId;
  if (division) where.division = division;

  const clubs = await db.club.findMany({
    where,
    orderBy: [{ points: 'desc' }, { gameDiff: 'desc' }],
    include: {
      profile: { select: { name: true, logo: true, bannerImage: true } },
      season: { select: { name: true, division: true } },
    },
  });

  return NextResponse.json(clubs, { headers });
}

export async function POST(request: Request) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const body = await request.json();
  const { name, logo, seasonId } = body;

  if (!name) {
    return NextResponse.json({ error: 'Club name is required' }, { status: 400 });
  }

  // ── Find or create the persistent ClubProfile ──
  let profile = await db.clubProfile.findUnique({ where: { name } });

  if (!profile) {
    profile = await db.clubProfile.create({
      data: { name, logo: logo || null },
    });
    console.log(`[POST /api/clubs] Created ClubProfile for "${name}"`);
  } else if (logo && !profile.logo) {
    // Update logo if provided and profile doesn't have one
    profile = await db.clubProfile.update({
      where: { id: profile.id },
      data: { logo },
    });
  }

  // ── Create Club season entries in ALL active seasons (both male & female) ──
  const activeSeasons = await db.season.findMany({
    where: { status: { in: ['active', 'completed'] } },
    select: { id: true, division: true },
  });

  const createdClubs: Array<{
    id: string;
    profileId: string;
    division: string;
    seasonId: string;
    wins: number;
    losses: number;
    points: number;
    gameDiff: number;
  }> = [];

  for (const season of activeSeasons) {
    // Check if club already exists in this season
    const existing = await db.club.findUnique({
      where: { profileId_seasonId_division: { profileId: profile.id, seasonId: season.id, division: season.division } },
    });

    if (existing) {
      createdClubs.push(existing);
      continue;
    }

    const club = await db.club.create({
      data: {
        profileId: profile.id,
        division: season.division,
        seasonId: season.id,
      },
    });
    createdClubs.push(club);
    console.log(`[POST /api/clubs] Created "${name}" entry in ${season.division} season (${season.id})`);
  }

  // Invalidate cache
  revalidatePath('/');
  revalidatePath('/api/stats');
  revalidateTag('cms-content', 'max');

  // ★ Pusher: notify all clients of new club
  try {
    const { pusherTrigger, PUSHER_CHANNELS, PUSHER_EVENTS } = await import('@/lib/pusher');
    void pusherTrigger(PUSHER_CHANNELS.LEADERBOARD, PUSHER_EVENTS.LEADERBOARD_UPDATED, {});
    void pusherTrigger(PUSHER_CHANNELS.FEED, PUSHER_EVENTS.CLUB_MEMBER_CHANGED, {
      type: 'club-created',
    });
  } catch { /* non-critical */ }

  const primaryClub = createdClubs[0];

  await createAuditLog({
    adminId: authResult.id,
    adminName: authResult.username,
    action: 'create',
    entity: 'club',
    entityId: primaryClub?.id,
    details: `Membuat club "${name}"`,
  });

  return NextResponse.json(primaryClub, { status: 201 });
}
