import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';

/**
 * POST /api/skins/award
 * Award a skin to a player (admin auth required)
 * Body: { accountId, skinType, reason?, expiresAt? }
 *
 * Special: Awarding "donor" skin also increments donorBadgeCount on Account
 * (permanent heart badge persists even after skin expires)
 */
export async function POST(request: Request) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { accountId, skinType, reason, expiresAt } = body;

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
        { error: `Skin type "${skinType}" tidak ditemukan. Jalankan /api/skins/seed terlebih dahulu.` },
        { status: 404 }
      );
    }

    // Verify the account exists
    const account = await db.account.findUnique({
      where: { id: accountId },
      include: {
        player: {
          select: { id: true, gamertag: true, name: true },
        },
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Akun tidak ditemukan' },
        { status: 404 }
      );
    }

    // If awarding donor skin, increment donorBadgeCount (permanent heart badge)
    if (skinType === 'donor') {
      await db.account.update({
        where: { id: accountId },
        data: { donorBadgeCount: { increment: 1 } },
      });
    }

    // Check if the player already has this skin (active, non-expired)
    const existingPlayerSkin = await db.playerSkin.findUnique({
      where: { accountId_skinId: { accountId, skinId: skin.id } },
    });

    if (existingPlayerSkin) {
      // If existing skin is expired, we can re-award by updating the expiry
      // If not expired, return error
      const isExpired = existingPlayerSkin.expiresAt && new Date(existingPlayerSkin.expiresAt) < new Date();
      if (!isExpired) {
        return NextResponse.json(
          { error: `Pemain sudah memiliki skin "${skin.displayName}" yang masih aktif` },
          { status: 409 }
        );
      }

      // Re-award: update the existing record
      const updatedPlayerSkin = await db.playerSkin.update({
        where: { id: existingPlayerSkin.id },
        data: {
          awardedBy: authResult.id,
          reason: reason || null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          createdAt: new Date(), // Reset creation time
        },
      });

      // Get updated donorBadgeCount
      const updatedAccount = await db.account.findUnique({
        where: { id: accountId },
        select: { donorBadgeCount: true },
      });

      return NextResponse.json({
        success: true,
        message: `Skin "${skin.displayName}" re-awarded ke ${account.player.gamertag}`,
        playerSkin: {
          id: updatedPlayerSkin.id,
          accountId: updatedPlayerSkin.accountId,
          skinId: updatedPlayerSkin.skinId,
          skinType: skin.type,
          displayName: skin.displayName,
          icon: skin.icon,
          reason: updatedPlayerSkin.reason,
          expiresAt: updatedPlayerSkin.expiresAt,
          colorClass: JSON.parse(skin.colorClass),
          priority: skin.priority,
          duration: skin.duration,
          donorBadgeCount: updatedAccount?.donorBadgeCount ?? 0,
        },
      });
    }

    // Create new PlayerSkin record
    const playerSkin = await db.playerSkin.create({
      data: {
        accountId,
        skinId: skin.id,
        awardedBy: authResult.id,
        reason: reason || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    // Get updated donorBadgeCount
    const updatedAccount = await db.account.findUnique({
      where: { id: accountId },
      select: { donorBadgeCount: true },
    });

    return NextResponse.json({
      success: true,
      message: `Skin "${skin.displayName}" awarded ke ${account.player.gamertag}`,
      playerSkin: {
        id: playerSkin.id,
        accountId: playerSkin.accountId,
        skinId: playerSkin.skinId,
        skinType: skin.type,
        displayName: skin.displayName,
        icon: skin.icon,
        reason: playerSkin.reason,
        expiresAt: playerSkin.expiresAt,
        colorClass: JSON.parse(skin.colorClass),
        priority: skin.priority,
        duration: skin.duration,
        donorBadgeCount: updatedAccount?.donorBadgeCount ?? 0,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Award skin error:', error);
    return NextResponse.json(
      { error: 'Failed to award skin' },
      { status: 500 }
    );
  }
}
