import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { SEASON_TOTAL_WEEKS } from '@/lib/constants';
import { pusherTrigger, PUSHER_CHANNELS, PUSHER_EVENTS } from '@/lib/pusher';
import { createAuditLog } from '@/lib/audit';
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { wibToUTC } from '@/lib/utils';

export async function GET(request: Request) {
  const headers = new Headers();
  headers.set('Cache-Control', 's-maxage=10, stale-while-revalidate=60');
  headers.set('Vary', 'Accept-Encoding');

  const { searchParams } = new URL(request.url);
  const division = searchParams.get('division');
  const seasonId = searchParams.get('seasonId');
  const status = searchParams.get('status');

  const where: Record<string, unknown> = {};
  if (division) where.division = division;
  if (seasonId) where.seasonId = seasonId;
  if (status) where.status = status;

  const tournaments = await db.tournament.findMany({
    where,
    orderBy: { weekNumber: 'desc' },
    include: {
      _count: { select: { teams: true, participations: true, matches: true, prizes: true } },
      season: { select: { name: true, number: true } },
      teams: { where: { isWinner: true }, select: { id: true, name: true, isWinner: true } },
      prizes: { orderBy: { position: 'asc' } },
      participations: {
        include: { player: { select: { id: true, gamertag: true, name: true, tier: true, points: true, division: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  return NextResponse.json(tournaments, { headers });
}

export async function POST(request: Request) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const body = await request.json();
  const { name, weekNumber, division, seasonId, prizePool, format, defaultMatchFormat, bpm, location, scheduledAt } = body;

  if (!name || !weekNumber || !division || !seasonId) {
    return NextResponse.json({ error: 'Missing required fields: name, weekNumber, division, seasonId' }, { status: 400 });
  }

  const validFormats = ['single_elimination', 'group_stage', 'swiss', 'upper_semi'];
  const validMatchFormats = ['BO1', 'BO3', 'BO5'];

  if (format && !validFormats.includes(format)) {
    return NextResponse.json({ error: 'Invalid format. Use: single_elimination, group_stage, swiss, upper_semi' }, { status: 400 });
  }

  if (defaultMatchFormat && !validMatchFormats.includes(defaultMatchFormat)) {
    return NextResponse.json({ error: 'Invalid match format. Use: BO1, BO3, BO5' }, { status: 400 });
  }

  // ── Validate: 1 season = max 10 weeks ──
  // Check the season's current tournament count
  const season = await db.season.findUnique({
    where: { id: seasonId },
    include: { _count: { select: { tournaments: true } } },
  });

  if (!season) {
    return NextResponse.json({ error: 'Season tidak ditemukan' }, { status: 404 });
  }

  if (season.status === 'completed') {
    return NextResponse.json({ error: `Season ${season.name} sudah selesai (completed). Buat season baru untuk melanjutkan.` }, { status: 400 });
  }

  // Count completed + in-progress tournaments for this season
  const existingTournaments = await db.tournament.count({
    where: { seasonId },
  });

  if (existingTournaments >= SEASON_TOTAL_WEEKS) {
    return NextResponse.json({
      error: `Season ${season.name} sudah penuh (${SEASON_TOTAL_WEEKS} weeks). Week berikutnya harus masuk ke season baru.`,
      hint: 'Buat season baru terlebih dahulu, lalu assign tournament ke season tersebut.',
    }, { status: 400 });
  }

  // Auto-correct weekNumber if it exceeds the max for this season
  // The weekNumber should be the next available slot (existingTournaments + 1)
  const correctedWeekNumber = weekNumber > existingTournaments + 1 ? existingTournaments + 1 : weekNumber;

  // Check for duplicate weekNumber+division+seasonId combination
  const existingWeek = await db.tournament.findUnique({
    where: { weekNumber_division_seasonId: { weekNumber: correctedWeekNumber, division, seasonId } },
  });

  if (existingWeek) {
    return NextResponse.json({
      error: `Week ${correctedWeekNumber} (${division}) di season ini sudah ada! Hapus turnamen lama atau gunakan week lain.`,
      hint: `Turnamen yang bentrok: "${existingWeek.name}" (status: ${existingWeek.status})`,
    }, { status: 409 });
  }

  let tournament;
  try {
    tournament = await db.tournament.create({
      data: {
        name,
        weekNumber: correctedWeekNumber,
        division,
        seasonId,
        status: 'setup',
        format: format || 'single_elimination',
        defaultMatchFormat: defaultMatchFormat || 'BO1',
        prizePool: prizePool || 0,
        location: location || 'Online',
        bpm: bpm || null,
        scheduledAt: scheduledAt ? wibToUTC(scheduledAt) : null,
      },
    });
  } catch (e: unknown) {
    const error = e as Error;
    console.error('[Tournament Create Error]', error);
    if (error.message?.includes('Unique') || error.message?.includes('unique')) {
      return NextResponse.json({
        error: `Week ${correctedWeekNumber} (${division}) di season ini sudah ada! Hapus turnamen lama atau gunakan week lain.`,
      }, { status: 409 });
    }
    return NextResponse.json({ error: 'Gagal membuat turnamen. Coba lagi.' }, { status: 500 });
  }

  // Pusher: Notify real-time clients about tournament creation
  void pusherTrigger(PUSHER_CHANNELS.TOURNAMENT, PUSHER_EVENTS.TOURNAMENT_STATUS_CHANGED, {
    tournamentId: tournament.id, division: tournament.division, weekNumber: tournament.weekNumber, status: tournament.status,
  });
  void pusherTrigger(PUSHER_CHANNELS.FEED, PUSHER_EVENTS.FEED_UPDATED, {
    type: 'tournament-created', tournamentId: tournament.id, division: tournament.division, weekNumber: tournament.weekNumber,
  });

  await createAuditLog({
    adminId: authResult.id,
    adminName: authResult.username,
    action: 'create',
    entity: 'tournament',
    entityId: tournament.id,
    details: `Create tournament: ${tournament.name}`,
  });

  // Purge CDN cache so dashboard shows the new tournament
  revalidateTag('league-data', 'max');

  return NextResponse.json(tournament, { status: 201 });
}
