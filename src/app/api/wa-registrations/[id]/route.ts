import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { requireAdmin } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/wa-registrations/[id] — Get single registration by ID
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const registration = await db.waRegistration.findUnique({
      where: { id },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            weekNumber: true,
            division: true,
            status: true,
            seasonId: true,
          },
        },
      },
    });

    if (!registration) {
      return NextResponse.json(
        { success: false, error: 'Registration not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: registration });
  } catch (error) {
    console.error('[WA_REGISTRATION_GET]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/wa-registrations/[id] — Update a registration
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id } = await params;
    const body = await request.json();

    // Verify registration exists
    const existing = await db.waRegistration.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Registration not found' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (body.status !== undefined) updateData.status = body.status;
    if (body.approvedBy !== undefined) updateData.approvedBy = body.approvedBy;
    if (body.assignedTier !== undefined) updateData.assignedTier = body.assignedTier;
    if (body.playerId !== undefined) updateData.playerId = body.playerId;
    if (body.tournamentId !== undefined) updateData.tournamentId = body.tournamentId;

    const registration = await db.waRegistration.update({
      where: { id },
      data: updateData,
    });

    // If status changed to "approved", handle side effects
    if (body.status === 'approved' && existing.status !== 'approved') {
      await handleApprovalSideEffects(registration);
    }

    // Return updated registration with tournament relation
    const updated = await db.waRegistration.findUnique({
      where: { id },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            weekNumber: true,
            division: true,
            status: true,
            seasonId: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[WA_REGISTRATION_PUT]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/wa-registrations/[id] — Delete a registration
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id } = await params;

    const existing = await db.waRegistration.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Registration not found' },
        { status: 404 }
      );
    }

    await db.waRegistration.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      data: { id, deleted: true },
    });
  } catch (error) {
    console.error('[WA_REGISTRATION_DELETE]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Handle side effects when a registration is approved:
 * - Find or create Player with matching gamertag
 * - Update player's waNumber and phone if not set (phone = waNumber, same format)
 * - Auto-create Account with default password (last 6 digits of WA number)
 * - Create Participation record if tournamentId exists
 */
async function handleApprovalSideEffects(reg: {
  id: string;
  gamertag: string;
  name: string;
  division: string;
  waNumber: string;
  city: string;
  tournamentId: string | null;
  assignedTier: string | null;
  approvedBy: string | null;
}) {
  // Normalize division from "M"/"F" to "male"/"female"
  const divisionMap: Record<string, string> = { M: 'male', F: 'female' };
  const playerDivision = divisionMap[reg.division] || reg.division.toLowerCase();

  // phone = waNumber (same value, 628xxx format)
  // All matching logic uses normalizePhone + last-8-digits comparison,
  // so format consistency between waNumber and phone is safe.
  const playerPhone = reg.waNumber;

  // Find or create player by gamertag
  let player = await db.player.findUnique({
    where: { gamertag: reg.gamertag },
  });

  if (!player) {
    player = await db.player.create({
      data: {
        gamertag: reg.gamertag,
        name: reg.name,
        division: playerDivision,
        tier: reg.assignedTier || 'B',
        waNumber: reg.waNumber,
        phone: playerPhone,
        city: reg.city || '',
        registrationStatus: 'approved',
        isActive: true,
      },
    });
  } else {
    // Update waNumber and phone if not set AND update tier if assigned and higher than current
    const updateData: Record<string, string> = {};
    if (!player.waNumber) updateData.waNumber = reg.waNumber;
    if (!player.phone) updateData.phone = playerPhone;
    if (reg.assignedTier) {
      const tierOrder = ['B', 'A', 'S'];
      const currentIdx = tierOrder.indexOf(player.tier.toUpperCase());
      const newIdx = tierOrder.indexOf(reg.assignedTier.toUpperCase());
      if (newIdx > currentIdx) {
        updateData.tier = reg.assignedTier;
      }
    }
    if (Object.keys(updateData).length > 0) {
      await db.player.update({
        where: { id: player.id },
        data: updateData,
      });
    }
  }

  // Update registration with playerId
  await db.waRegistration.update({
    where: { id: reg.id },
    data: { playerId: player.id },
  });

  // Auto-create Account with default password if player doesn't have one
  const existingAccount = await db.account.findUnique({
    where: { playerId: player.id },
  });

  if (!existingAccount) {
    // Default password: last 6 digits of WA number
    const defaultPassword = reg.waNumber.replace(/\D/g, '').slice(-6);

    if (defaultPassword.length >= 6) {
      const passwordHash = await hashPassword(defaultPassword);

      // Check if username is already taken
      const existingUsername = await db.account.findUnique({
        where: { username: player.gamertag },
      });

      if (!existingUsername) {
        await db.account.create({
          data: {
            playerId: player.id,
            username: player.gamertag,
            passwordHash,
            phone: reg.waNumber,
          },
        });
        console.log(`[WA_APPROVAL] Auto-created account for ${player.gamertag} with default password`);
      } else {
        console.warn(`[WA_APPROVAL] Username ${player.gamertag} already taken, skipping account creation`);
      }
    } else {
      console.warn(`[WA_APPROVAL] WA number too short for default password: ${reg.waNumber}`);
    }
  }

  // Create Participation record if tournamentId exists
  if (reg.tournamentId) {
    const existingParticipation = await db.participation.findUnique({
      where: {
        playerId_tournamentId: {
          playerId: player.id,
          tournamentId: reg.tournamentId,
        },
      },
    });

    if (!existingParticipation) {
      await db.participation.create({
        data: {
          playerId: player.id,
          tournamentId: reg.tournamentId,
          status: 'registered',
          tierOverride: reg.assignedTier || null,
        },
      });
    }
  }
}
