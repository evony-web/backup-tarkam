import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';

// GET - Get sponsors for a tournament
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  try {
    const { id } = await params;

    const tournamentSponsors = await db.tournamentSponsor.findMany({
      where: { tournamentId: id },
      include: {
        sponsor: true,
      },
      orderBy: [{ displayOrder: 'asc' }],
    });

    // Also get sponsored prizes
    const sponsoredPrizes = await db.sponsoredPrize.findMany({
      where: { tournamentId: id, isActive: true },
      include: {
        sponsor: { select: { id: true, name: true, logo: true } },
      },
      orderBy: [{ position: 'asc' }],
    });

    // Get presented_by sponsor (main presenter)
    const presentedBy = tournamentSponsors.find(ts => ts.role === 'presented_by');

    return NextResponse.json({
      sponsors: tournamentSponsors,
      sponsoredPrizes,
      presentedBy: presentedBy?.sponsor || null,
    }, { headers });
  } catch (error) {
    console.error('Error fetching tournament sponsors:', error);
    return NextResponse.json({ error: 'Failed to fetch tournament sponsors' }, { headers,  status: 500 });
  }
}

// POST - Add sponsor to tournament
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let admin;
  try {
    admin = await requireAdmin(request);
    if (admin instanceof NextResponse) return admin;

    const { id } = await params;
    const body = await request.json();
    const { sponsorId, role, displayOrder } = body;

    if (!sponsorId) {
      return NextResponse.json({ error: 'sponsorId is required' }, { status: 400 });
    }

    // Check if already exists
    const existing = await db.tournamentSponsor.findUnique({
      where: { tournamentId_sponsorId: { tournamentId: id, sponsorId } },
    });

    if (existing) {
      return NextResponse.json({ error: 'Sponsor already added to tournament' }, { status: 400 });
    }

    // Neon HTTP adapter doesn't support transactions — split create + include into separate calls
    const tournamentSponsor = await db.tournamentSponsor.create({
      data: {
        tournamentId: id,
        sponsorId,
        role: role || 'supporter',
        displayOrder: displayOrder || 0,
      },
    });

    // Fetch with sponsor relation separately (Neon HTTP compat)
    const tournamentSponsorWithRelation = await db.tournamentSponsor.findUnique({
      where: { id: tournamentSponsor.id },
      include: {
        sponsor: true,
      },
    });

    return NextResponse.json({ tournamentSponsor: tournamentSponsorWithRelation });
  } catch (error) {
    console.error('Error adding sponsor to tournament:', error);
    return NextResponse.json({ error: 'Failed to add sponsor to tournament' }, { status: 500 });
  }
}

// DELETE - Remove sponsor from tournament
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let admin;
  try {
    admin = await requireAdmin(request);
    if (admin instanceof NextResponse) return admin;

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const sponsorId = searchParams.get('sponsorId');

    if (!sponsorId) {
      return NextResponse.json({ error: 'sponsorId is required' }, { status: 400 });
    }

    await db.tournamentSponsor.delete({
      where: { tournamentId_sponsorId: { tournamentId: id, sponsorId } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing sponsor from tournament:', error);
    return NextResponse.json({ error: 'Failed to remove sponsor from tournament' }, { status: 500 });
  }
}
