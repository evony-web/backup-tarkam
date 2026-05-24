import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { pusherTrigger, PUSHER_CHANNELS, PUSHER_EVENTS } from '@/lib/pusher';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const body = await request.json();
  const { playerId, playerIds } = body;

  // Support bulk registration
  const idsToRegister: string[] = playerIds || (playerId ? [playerId] : []);

  if (idsToRegister.length === 0) {
    return NextResponse.json({ error: 'playerId or playerIds required' }, { status: 400 });
  }

  const tournament = await db.tournament.findUnique({ where: { id } });
  if (!tournament) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  }

  if (tournament.status !== 'registration' && tournament.status !== 'setup') {
    return NextResponse.json({ error: 'Registration is not open' }, { status: 400 });
  }

  const results = { registered: 0, skipped: 0, errors: [] as string[] };

  for (const pid of idsToRegister) {
    // Check division match
    const player = await db.player.findUnique({ where: { id: pid } });
    if (!player) {
      results.errors.push(`Player ${pid} not found`);
      continue;
    }

    // Only allow registering players that have been approved by admin
    if (player.registrationStatus !== 'approved') {
      results.errors.push(`Player ${player.gamertag || pid} is not approved (status: ${player.registrationStatus})`);
      continue;
    }

    // Check if already registered
    const existing = await db.participation.findUnique({
      where: { playerId_tournamentId: { playerId: pid, tournamentId: id } },
    });
    if (existing) {
      results.skipped++;
      continue;
    }

    await db.participation.create({
      data: {
        playerId: pid,
        tournamentId: id,
        status: 'registered',
        pointsEarned: 0,
      },
    });
    results.registered++;
  }

  // Update tournament status to registration if it was setup
  if (tournament.status === 'setup') {
    await db.tournament.update({ where: { id }, data: { status: 'registration' } });
  }

  // Pusher: Notify real-time clients about player registration
  if (results.registered > 0) {
    // For bulk registration, send a summary; for single, include gamertag
    if (idsToRegister.length === 1) {
      const player = await db.player.findUnique({ where: { id: idsToRegister[0] } });
      void pusherTrigger(PUSHER_CHANNELS.FEED, PUSHER_EVENTS.FEED_UPDATED, {
        type: 'player-registered', gamertag: player?.gamertag || '', tournamentId: id, division: tournament.division,
      });
    } else {
      void pusherTrigger(PUSHER_CHANNELS.FEED, PUSHER_EVENTS.FEED_UPDATED, {
        type: 'player-registered', count: results.registered, tournamentId: id, division: tournament.division,
      });
    }
  }

  return NextResponse.json(results, { status: 201 });
}

// DELETE — unregister players from tournament (admin only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const body = await request.json();
  const { playerId, playerIds } = body;

  const idsToRemove: string[] = playerIds || (playerId ? [playerId] : []);
  if (idsToRemove.length === 0) {
    return NextResponse.json({ error: 'playerId or playerIds required' }, { status: 400 });
  }

  const tournament = await db.tournament.findUnique({ where: { id } });
  if (!tournament) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  }

  // Only allow unregister during registration/setup/approval phase
  if (!['setup', 'registration', 'approval'].includes(tournament.status)) {
    return NextResponse.json({ error: 'Cannot unregister — tournament already in progress' }, { status: 400 });
  }

  const results = { removed: 0, skipped: 0 };

  for (const pid of idsToRemove) {
    const existing = await db.participation.findUnique({
      where: { playerId_tournamentId: { playerId: pid, tournamentId: id } },
    });
    if (!existing) {
      results.skipped++;
      continue;
    }
    // Only allow removing 'registered' status, not approved/assigned
    if (existing.status !== 'registered') {
      results.skipped++;
      continue;
    }
    await db.participation.delete({
      where: { playerId_tournamentId: { playerId: pid, tournamentId: id } },
    });
    results.removed++;
  }

  return NextResponse.json(results);
}
