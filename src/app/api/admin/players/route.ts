import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';

// Admin player management — supports pagination via limit & offset
export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  try {
    const { searchParams } = new URL(request.url);
    const division = searchParams.get('division');
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: any = { isActive: true };

    if (division) where.division = division;
    if (status) where.registrationStatus = status;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { gamertag: { contains: search } },
        { city: { contains: search } },
      ];
    }

    const [players, total] = await Promise.all([
      db.player.findMany({
        where,
        select: {
          id: true,
          name: true,
          gamertag: true,
          division: true,
          tier: true,
          avatar: true,
          points: true,
          totalWins: true,
          totalMvp: true,
          streak: true,
          maxStreak: true,
          matches: true,
          isActive: true,
          phone: true,
          city: true,
          registrationStatus: true,
          createdAt: true,
          updatedAt: true,
          clubMembers: {
            where: { leftAt: null },
            include: {
              profile: {
                select: { id: true, name: true, logo: true }
              }
            }
          },
        },
        orderBy: { points: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.player.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: players,
      total,
      limit,
      offset,
    }, { headers });
  } catch (error) {
    console.error('Get players error:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { headers,  status: 500 }
    );
  }
}
