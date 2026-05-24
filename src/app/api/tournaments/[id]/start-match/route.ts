import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { pusherTrigger, PUSHER_CHANNELS, PUSHER_EVENTS } from '@/lib/pusher';
import { createAuditLog } from '@/lib/audit';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const body = await request.json();
  const { matchId } = body;

  if (!matchId) {
    return NextResponse.json({ error: 'matchId required' }, { status: 400 });
  }

  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }

  if (match.tournamentId !== id) {
    return NextResponse.json({ error: 'Match does not belong to this tournament' }, { status: 400 });
  }

  if (match.status === 'completed') {
    return NextResponse.json({ error: 'Match already completed' }, { status: 400 });
  }

  if (!match.team1Id || !match.team2Id) {
    return NextResponse.json({ error: 'Both teams must be set before starting' }, { status: 400 });
  }

  // Set match to live
  await db.match.update({
    where: { id: matchId },
    data: { status: 'live', scheduledAt: new Date() },
  });

  // Ensure tournament is in main_event status
  const tournament = await db.tournament.findUnique({ where: { id } });
  if (tournament && ['bracket_generation', 'approval', 'team_generation'].includes(tournament.status)) {
    await db.tournament.update({ where: { id }, data: { status: 'main_event' } });
  }

  // Pusher: Notify real-time clients about match going live
  void pusherTrigger(PUSHER_CHANNELS.TOURNAMENT, PUSHER_EVENTS.TOURNAMENT_STATUS_CHANGED, {
    tournamentId: id, matchId, status: 'live',
  });

  await createAuditLog({
    adminId: authResult.id,
    adminName: authResult.username,
    action: 'update',
    entity: 'match',
    entityId: matchId,
    details: 'Mulai match',
    metadata: { tournamentId: id, matchId },
  });

  return NextResponse.json({ success: true, message: 'Match started' });
}
