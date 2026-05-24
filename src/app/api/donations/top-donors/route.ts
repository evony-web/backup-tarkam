import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  try {
    // Get top 5 donors grouped by name, with their latest donation details
    const topDonors = await db.donation.groupBy({
      by: ['donorName'],
      _sum: { amount: true },
      _count: { id: true },
      _max: { createdAt: true },
      where: { status: 'approved' },
      orderBy: { _sum: { amount: 'desc' } },
      take: 5,
    });

    // For each top donor, get their latest donation type
    const donorsWithDetails = await Promise.all(
      topDonors.map(async (d) => {
        const latestDonation = await db.donation.findFirst({
          where: {
            donorName: d.donorName,
            status: 'approved',
          },
          orderBy: { createdAt: 'desc' },
          select: { type: true, createdAt: true },
        });

        // Get total unique donors count and total amount for summary
        return {
          donorName: d.donorName || 'Anonymous',
          totalAmount: d._sum.amount || 0,
          donationCount: d._count.id,
          latestType: latestDonation?.type || 'weekly',
          latestDate: latestDonation?.createdAt?.toISOString() || null,
        };
      })
    );

    // Get overall totals for the summary header
    const totals = await db.donation.aggregate({
      _sum: { amount: true },
      _count: { id: true },
      where: { status: 'approved' },
    });

    const uniqueDonors = await db.donation.groupBy({
      by: ['donorName'],
      where: { status: 'approved' },
      _count: { id: true },
    });

    return NextResponse.json({
      donors: donorsWithDetails,
      summary: {
        totalAmount: totals._sum.amount || 0,
        totalDonors: uniqueDonors.length,
        totalDonations: totals._count.id || 0,
      },
    }, { headers });
  } catch {
    return NextResponse.json(
      { donors: [], summary: { totalAmount: 0, totalDonors: 0, totalDonations: 0 } },
      { headers,  status: 200 }
    );
  }
}
