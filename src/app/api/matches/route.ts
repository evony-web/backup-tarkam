import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/matches - List matches
export async function GET(request: NextRequest) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  try {
    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get('tournamentId');
    const status = searchParams.get('status');
    const round = searchParams.get('round');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const where: any = {};
    if (tournamentId) where.tournamentId = tournamentId;
    if (status) where.status = status;
    if (round) where.round = parseInt(round);

    const [matches, total] = await Promise.all([
      db.match.findMany({
        where,
        skip,
        take: limit,
        include: {
          team1: { select: { id: true, name: true } },
          team2: { select: { id: true, name: true } },
          winner: { select: { id: true, name: true } },
          mvpPlayer: { select: { id: true, name: true, gamertag: true } },
          tournament: { select: { id: true, name: true, format: true } },
        },
        orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
      }),
      db.match.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: matches,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, { headers });
  } catch (error) {
    console.error('Get matches error:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { headers,  status: 500 }
    );
  }
}
