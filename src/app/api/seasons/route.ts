import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { createAuditLog } from '@/lib/audit';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const headers = new Headers();
  headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  headers.set('Vary', 'Accept-Encoding');

  const { searchParams } = new URL(request.url);
  const division = searchParams.get('division');

  const where: Record<string, string | undefined> = {};
  if (division) where.division = division;

  const seasons = await db.season.findMany({
    where,
    orderBy: { number: 'desc' },
    include: {
      _count: { select: { tournaments: true, clubs: true } },
    },
  });

  return NextResponse.json(seasons, { headers });
}

export async function POST(request: Request) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const body = await request.json();
  const { name, number, division, startDate, endDate } = body;

  if (!name || !number || !division) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Validate: only 1 active season per division at a time
  const existingActive = await db.season.findFirst({
    where: { division, status: 'active' },
  });
  if (existingActive) {
    return NextResponse.json({
      error: `Sudah ada season aktif untuk divisi "${division}" (${existingActive.name}). Tutup season yang aktif terlebih dahulu sebelum membuat season baru.`,
    }, { status: 400 });
  }

  const season = await db.season.create({
    data: {
      name,
      number,
      division,
      status: 'active',
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
    },
  });

  await createAuditLog({
    adminId: authResult.id,
    adminName: authResult.username,
    action: 'create',
    entity: 'season',
    entityId: season.id,
    details: `Membuat season "${season.name}"`,
  });

  return NextResponse.json(season, { status: 201 });
}
