import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/skins/player/[accountId]
 * Get any player's active skins (public, no auth needed - for display on profiles)
 * Returns active (non-expired) skins for the given accountId
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  try {
    const { accountId } = await params;

    if (!accountId) {
      return NextResponse.json(
        { error: 'accountId diperlukan' },
        { headers,  status: 400 }
      );
    }

    // Verify the account exists
    const account = await db.account.findUnique({
      where: { id: accountId },
      include: {
        player: {
          select: { gamertag: true, name: true },
        },
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Akun tidak ditemukan' },
        { headers,  status: 404 }
      );
    }

    // Find all PlayerSkin records for this account
    const playerSkins = await db.playerSkin.findMany({
      where: { accountId },
      include: { skin: true },
    });

    const now = new Date();

    // Filter out expired skins (don't auto-clean for public view, just filter)
    const activeSkins = playerSkins.filter(ps => {
      return !ps.expiresAt || new Date(ps.expiresAt) >= now;
    });

    // Sort by skin priority desc (highest priority first)
    activeSkins.sort((a, b) => b.skin.priority - a.skin.priority);

    const skinsData: Array<Record<string, any>> = activeSkins.map(ps => ({
      id: ps.id,
      skinId: ps.skinId,
      skinType: ps.skin.type,
      displayName: ps.skin.displayName,
      description: ps.skin.description,
      icon: ps.skin.icon,
      colorClass: JSON.parse(ps.skin.colorClass),
      priority: ps.skin.priority,
      duration: ps.skin.duration,
      reason: ps.reason,
      expiresAt: ps.expiresAt,
      createdAt: ps.createdAt,
      donorBadgeCount: ps.skin.type === 'donor' ? account.donorBadgeCount : undefined,
    }));

    // If player has donor badges but no active donor skin, add virtual donor_badge entry
    if (account.donorBadgeCount > 0 && !skinsData.some(s => s.skinType === 'donor')) {
      skinsData.push({
        id: 'virtual-donor-badge',
        skinId: '',
        skinType: 'donor_badge',
        displayName: account.donorBadgeCount >= 5 ? 'Heart Badge ★' : 'Heart Badge',
        description: 'Permanent donor heart badge',
        icon: '❤️',
        colorClass: JSON.parse('{"frame":"#fb7185","name":"#fb7185|#ef4444|#f472b6","badge":"rgba(244,63,94,0.2)|#fda4af","border":"#f43f5e|#ef4444|#f472b6","glow":"rgba(244,63,94,0.35)"}'),
        priority: 0,
        duration: 'permanent',
        reason: `${account.donorBadgeCount}x donasi`,
        expiresAt: null,
        createdAt: new Date(),
        donorBadgeCount: account.donorBadgeCount,
      });
    }

    // If player has a sawer badge tier but no active sawer skin, add virtual sawer_badge entry
    const sawerBadgeTier = account.sawerBadgeTier ?? 'none';
    const sawerSkinTypes = ['sawer_bronze', 'sawer_silver', 'sawer_gold', 'sawer_diamond'];
    const hasActiveSawerSkin = skinsData.some(s => sawerSkinTypes.includes(s.skinType));
    if (sawerBadgeTier !== 'none' && !hasActiveSawerSkin) {
      const tierMap: Record<string, { icon: string; label: string; frame: string }> = {
        bronze: { icon: '🥉', label: 'Bronze Sawer', frame: '#b45309' },
        silver: { icon: '🥈', label: 'Silver Sawer', frame: '#9ca3af' },
        gold: { icon: '🥇', label: 'Gold Sawer', frame: '#facc15' },
        diamond: { icon: '💎', label: 'Diamond Sawer', frame: '#57B5FF' },
      };
      const tierInfo = tierMap[sawerBadgeTier];
      if (tierInfo) {
        skinsData.push({
          id: 'virtual-sawer-badge',
          skinId: '',
          skinType: 'sawer_badge',
          displayName: tierInfo.label,
          description: `Permanent sawer badge (${sawerBadgeTier})`,
          icon: tierInfo.icon,
          colorClass: { frame: tierInfo.frame, name: tierInfo.frame, badge: `rgba(255,255,255,0.1)|${tierInfo.frame}`, border: tierInfo.frame, glow: 'transparent' },
          priority: 0,
          duration: 'permanent',
          reason: `Sawer ${sawerBadgeTier}`,
          expiresAt: null,
          createdAt: new Date(),
          sawerBadgeTier: `sawer_${sawerBadgeTier}`,
        });
      }
    }

    return NextResponse.json({
      accountId,
      gamertag: account.player.gamertag,
      name: account.player.name,
      count: skinsData.length,
      donorBadgeCount: account.donorBadgeCount,
      skins: skinsData,
    }, { headers });
  } catch (error) {
    console.error('Get player skins error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch player skins' },
      { headers,  status: 500 }
    );
  }
}
