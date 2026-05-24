import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';

/**
 * DELETE /api/skins/revoke
 * Revoke/remove a skin from a player (admin auth required)
 * Body: { accountId, skinType }
 */
export async function DELETE(request: Request) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { accountId, skinType } = body;

    // Validate required fields
    if (!accountId || !skinType) {
      return NextResponse.json(
        { error: 'accountId dan skinType harus diisi' },
        { status: 400 }
      );
    }

    // Find the skin by type
    const skin = await db.skin.findUnique({
      where: { type: skinType },
    });

    if (!skin) {
      return NextResponse.json(
        { error: `Skin type "${skinType}" tidak ditemukan` },
        { status: 404 }
      );
    }

    // Find the PlayerSkin record
    const playerSkin = await db.playerSkin.findUnique({
      where: { accountId_skinId: { accountId, skinId: skin.id } },
    });

    if (!playerSkin) {
      return NextResponse.json(
        { error: `Pemain tidak memiliki skin "${skin.displayName}"` },
        { status: 404 }
      );
    }

    // Delete the PlayerSkin record
    await db.playerSkin.delete({
      where: { id: playerSkin.id },
    });

    // Get account info for confirmation message
    const account = await db.account.findUnique({
      where: { id: accountId },
      include: {
        player: { select: { gamertag: true } },
      },
    });

    const gamertag = account?.player?.gamertag || accountId;

    return NextResponse.json({
      success: true,
      message: `Skin "${skin.displayName}" revoked dari ${gamertag}`,
    });
  } catch (error) {
    console.error('Revoke skin error:', error);
    return NextResponse.json(
      { error: 'Failed to revoke skin' },
      { status: 500 }
    );
  }
}
