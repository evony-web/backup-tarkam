import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/teams - List teams
export async function GET(request: NextRequest) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  try {
    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get('tournamentId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const where: any = {};
    if (tournamentId) where.tournamentId = tournamentId;

    const [teams, total] = await Promise.all([
      db.team.findMany({
        where,
        skip,
        take: limit,
        include: {
          teamPlayers: {
            include: {
              player: { select: { id: true, name: true, gamertag: true, avatar: true, tier: true } },
            },
          },
          tournament: { select: { id: true, name: true, weekNumber: true } },
        },
        orderBy: { name: 'asc' },
      }),
      db.team.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: teams,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, { headers });
  } catch (error) {
    console.error('Get teams error:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { headers,  status: 500 }
    );
  }
}
