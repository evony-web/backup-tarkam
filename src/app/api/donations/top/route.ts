import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '10');

  const topDonors = await db.donation.groupBy({
    by: ['donorName'],
    _sum: { amount: true },
    _count: { id: true },
    where: { status: 'approved' },
    orderBy: { _sum: { amount: 'desc' } },
    take: limit,
  });

  return NextResponse.json(topDonors.map(d => ({
    donorName: d.donorName,
    totalAmount: d._sum.amount,
    donationCount: d._count.id,
  })), { headers });
}
