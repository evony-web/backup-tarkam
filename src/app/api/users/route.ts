import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';

// User listing - maps to Player/Account in our schema
export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  try {
    const { searchParams } = new URL(request.url);
    const division = searchParams.get('division');
    const search = searchParams.get('search');
    const role = searchParams.get('role');
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');
    const skip = (page - 1) * limit;

    // If role is admin, query Admin table
    if (role === 'admin' || role === 'super_admin') {
      const admins = await db.admin.findMany({
        where: role ? { role } : {},
        select: {
          id: true,
          username: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      });

      const total = await db.admin.count({ where: role ? { role } : {} });

      return NextResponse.json({
        success: true,
        data: admins.map(a => ({ ...a, name: a.username, type: 'admin' })),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      }, { headers });
    }

    // Otherwise query Players
    const where: any = { isActive: true, registrationStatus: 'approved' };
    if (division) where.division = division;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { gamertag: { contains: search } },
        { city: { contains: search } },
      ];
    }

    const players = await db.player.findMany({
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
        matches: true,
        city: true,
        registrationStatus: true,
        createdAt: true,
      },
      orderBy: { points: 'desc' },
      take: limit,
      skip,
    });

    const total = await db.player.count({ where });

    return NextResponse.json({
      success: true,
      data: players.map(p => ({ ...p, type: 'player' })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    }, { headers });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { headers,  status: 500 }
    );
  }
}
