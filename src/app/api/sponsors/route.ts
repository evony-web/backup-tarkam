import { NextRequest, NextResponse } from 'next/server';
import { db, neonDeleteMany, isPostgreSQL } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';

// GET - List all sponsors
export async function GET(request: NextRequest) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  try {
    const { searchParams } = new URL(request.url);
    const tier = searchParams.get('tier');
    const activeOnly = searchParams.get('active') === 'true';

    const where: Record<string, unknown> = {};
    if (tier) where.tier = tier;
    if (activeOnly) where.isActive = true;

    const sponsors = await db.sponsor.findMany({
      where,
      include: {
        _count: {
          select: {
            tournamentSponsors: true,
            sponsoredPrizes: true,
            banners: true,
          },
        },
      },
      orderBy: [
        { createdAt: 'asc' },
      ],
    });

    return NextResponse.json({ sponsors }, { headers });
  } catch (error) {
    console.error('Error fetching sponsors:', error);
    return NextResponse.json({ error: 'Failed to fetch sponsors' }, { headers,  status: 500 });
  }
}

// POST - Create new sponsor
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  try {
    const body = await request.json();
    const { name, logo, website, description, tier } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const sponsor = await db.sponsor.create({
      data: {
        name,
        logo,
        website,
        description,
        tier: tier || 'bronze',
      },
    });

    return NextResponse.json({ sponsor });
  } catch (error) {
    console.error('Error creating sponsor:', error);
    return NextResponse.json({ error: 'Failed to create sponsor' }, { status: 500 });
  }
}

// PUT - Update sponsor
export async function PUT(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Sponsor ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { name, logo, website, description, tier, isActive } = body;

    const sponsor = await db.sponsor.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(logo !== undefined && { logo }),
        ...(website !== undefined && { website }),
        ...(description !== undefined && { description }),
        ...(tier !== undefined && { tier }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({ sponsor });
  } catch (error) {
    console.error('Error updating sponsor:', error);
    return NextResponse.json({ error: 'Failed to update sponsor' }, { status: 500 });
  }
}

// DELETE - Delete sponsor
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Sponsor ID is required' }, { status: 400 });
    }

    // Delete related records first
    // Neon workaround: deleteMany() doesn't work with PrismaNeonHttp
    if (isPostgreSQL) {
      await neonDeleteMany('SponsorBanner', [{ column: 'sponsorId', operator: '=', value: id }]);
      await neonDeleteMany('SponsoredPrize', [{ column: 'sponsorId', operator: '=', value: id }]);
      await neonDeleteMany('TournamentSponsor', [{ column: 'sponsorId', operator: '=', value: id }]);
    } else {
      await db.sponsorBanner.deleteMany({ where: { sponsorId: id } });
      await db.sponsoredPrize.deleteMany({ where: { sponsorId: id } });
      await db.tournamentSponsor.deleteMany({ where: { sponsorId: id } });
    }

    // Then delete the sponsor
    await db.sponsor.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting sponsor:', error);
    return NextResponse.json({ error: 'Failed to delete sponsor' }, { status: 500 });
  }
}
