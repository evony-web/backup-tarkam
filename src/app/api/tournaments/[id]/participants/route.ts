import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Get tournament participants - maps to Participation in our schema
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  try {
    const { id: tournamentId } = await params;

    const participants = await db.participation.findMany({
      where: { tournamentId },
      include: {
        player: {
          select: {
            id: true,
            name: true,
            gamertag: true,
            avatar: true,
            tier: true,
            points: true,
            totalWins: true,
            totalMvp: true,
            division: true,
            city: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: participants,
    }, { headers });
  } catch (error) {
    console.error('Get participants error:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { headers,  status: 500 }
    );
  }
}
