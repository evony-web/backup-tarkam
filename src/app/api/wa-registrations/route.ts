import { db, neonUpdateMany, isPostgreSQL } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { requireAdmin } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/wa-registrations — List registrations with filters and pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const division = searchParams.get('division');
    const tournamentId = searchParams.get('tournamentId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (division) where.division = division;
    if (tournamentId) where.tournamentId = tournamentId;

    const [registrations, total] = await Promise.all([
      db.waRegistration.findMany({
        where,
        orderBy: { createdAt: 'desc' },
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
        take: limit,
        skip: offset,
      }),
      db.waRegistration.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: registrations,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('[WA_REGISTRATIONS_GET]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/wa-registrations — Bulk status update
export async function PATCH(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { ids, status, approvedBy, assignedTier } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ids must be a non-empty array' },
        { status: 400 }
      );
    }

    const validStatuses = ['pending', 'approved', 'rejected', 'expired', 'registered'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: `status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = { status };
    if (approvedBy !== undefined) updateData.approvedBy = approvedBy;
    if (assignedTier !== undefined) updateData.assignedTier = assignedTier;

    // Neon workaround: updateMany() doesn't work with PrismaNeonHttp
    let result: { count: number };
    if (isPostgreSQL) {
      const updateCount = await neonUpdateMany('WaRegistration',
        [{ column: 'id', operator: 'IN', value: ids }],
        updateData,
      );
      result = { count: updateCount };
    } else {
      result = await db.waRegistration.updateMany({
        where: { id: { in: ids } },
        data: updateData,
      });
    }

    // If approving, handle player creation and participation for each registration
    if (status === 'approved') {
      const registrations = await db.waRegistration.findMany({
        where: { id: { in: ids }, status: 'approved' },
      });

      for (const reg of registrations) {
        await handleApprovalSideEffects(reg);
      }
    }

    return NextResponse.json({
      success: true,
      data: { updated: result.count },
    });
  } catch (error) {
    console.error('[WA_REGISTRATIONS_PATCH]', error);
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
