import { NextResponse } from 'next/server';
import { db, neonDeleteMany, isPostgreSQL } from '@/lib/db';
import { requirePlayer } from '@/lib/api-auth';

/**
 * GET /api/skins/my
 * Get current player's active skins (player auth required)
 * Auto-cleans expired skins (champion/mvp that passed expiresAt)
 * Returns skins sorted by priority desc with skin details
 */
export async function GET(request: Request) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  const authResult = await requirePlayer(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const accountId = authResult.id;

    // Find all PlayerSkin records for this account
    const playerSkins = await db.playerSkin.findMany({
      where: { accountId },
      include: { skin: true },
    });

    const now = new Date();
    const activeSkins: typeof playerSkins = [];
    const expiredIds: string[] = [];

    for (const ps of playerSkins) {
      const isExpired = ps.expiresAt && new Date(ps.expiresAt) < now;
      if (isExpired) {
        expiredIds.push(ps.id);
      } else {
        activeSkins.push(ps);
      }
    }

    // Auto-clean expired skins
    // Neon workaround: deleteMany() doesn't work with PrismaNeonHttp
    if (expiredIds.length > 0) {
      if (isPostgreSQL) {
        await neonDeleteMany('PlayerSkin', [{ column: 'id', operator: 'IN', value: expiredIds }]);
      } else {
        await db.playerSkin.deleteMany({
          where: { id: { in: expiredIds } },
        });
      }
    }

    // Sort by skin priority desc (highest priority first)
    activeSkins.sort((a, b) => b.skin.priority - a.skin.priority);

    // Get donorBadgeCount and sawerBadgeTier from account
    const account = await db.account.findUnique({
      where: { id: accountId },
      select: { donorBadgeCount: true, sawerBadgeTier: true },
    });

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
      awardedBy: ps.awardedBy,
      expiresAt: ps.expiresAt,
      createdAt: ps.createdAt,
      donorBadgeCount: ps.skin.type === 'donor' ? (account?.donorBadgeCount ?? 0) : undefined,
    }));

    // If player has donor badges but no active donor skin, add virtual donor_badge entry
    const donorBadgeCount = account?.donorBadgeCount ?? 0;
    if (donorBadgeCount > 0 && !skinsData.some(s => s.skinType === 'donor')) {
      skinsData.push({
        id: 'virtual-donor-badge',
        skinId: '',
        skinType: 'donor_badge',
        displayName: donorBadgeCount >= 5 ? 'Heart Badge ★' : 'Heart Badge',
        description: 'Permanent donor heart badge',
        icon: '❤️',
        colorClass: JSON.parse('{"frame":"#fb7185","name":"#fb7185|#ef4444|#f472b6","badge":"rgba(244,63,94,0.2)|#fda4af","border":"#f43f5e|#ef4444|#f472b6","glow":"rgba(244,63,94,0.35)"}'),
        priority: 0,
        duration: 'permanent',
        reason: `${donorBadgeCount}x donasi`,
        awardedBy: null,
        expiresAt: null,
        createdAt: new Date(),
        donorBadgeCount,
      });
    }

    // If player has a sawer badge tier but no active sawer skin, add virtual sawer_badge entry
    const sawerBadgeTier = account?.sawerBadgeTier ?? 'none';
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
          awardedBy: null,
          expiresAt: null,
          createdAt: new Date(),
          sawerBadgeTier: `sawer_${sawerBadgeTier}`,
        });
      }
    }

    return NextResponse.json({
      count: skinsData.length,
      expiredRemoved: expiredIds.length,
      donorBadgeCount,
      skins: skinsData,
    }, { headers });
  } catch (error) {
    console.error('Get my skins error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch skins' },
      { headers,  status: 500 }
    );
  }
}
