import { NextRequest, NextResponse } from 'next/server';
import { verifyPlayerSessionToken } from '@/lib/auth';
import { db } from '@/lib/db';

const PLAYER_SESSION_COOKIE = 'idm-player-session';

export async function GET(request: NextRequest) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  try {
    // Try NextRequest.cookies API first (works when Caddy gateway forwards cookies properly)
    let token: string | null = request.cookies.get(PLAYER_SESSION_COOKIE)?.value || null;

    // Fallback: manual header parsing
    if (!token) {
      const cookieHeader = request.headers.get('cookie');
      if (!cookieHeader) {
        return NextResponse.json({ authenticated: false }, { headers });
      }

      const cookies = Object.fromEntries(
        cookieHeader.split(';').map(c => {
          const [key, ...val] = c.trim().split('=');
          return [key, val.join('=')];
        })
      );

      const rawToken = cookies[PLAYER_SESSION_COOKIE];
      if (!rawToken) {
        return NextResponse.json({ authenticated: false }, { headers });
      }

      token = decodeURIComponent(rawToken);
    }

    const session = verifyPlayerSessionToken(token);
    if (!session) {
      return NextResponse.json({ authenticated: false }, { headers });
    }

    // Get account data using accountId from player session
    const account = await db.account.findUnique({
      where: { id: session.accountId },
      include: {
        player: {
          select: {
            id: true,
            gamertag: true,
            name: true,
            division: true,
            tier: true,
            avatar: true,
            points: true,
            totalWins: true,
            totalMvp: true,
            matches: true,
            streak: true,
            city: true,
          },
        },
      },
    });

    if (!account) {
      return NextResponse.json({ authenticated: false }, { headers });
    }

    // Get active skins for the player (non-blocking — don't fail session if skins query fails)
    let skinsData: Array<{
      type: string;
      icon: string;
      displayName: string;
      colorClass: string;
      priority: number;
      duration: string;
      reason: string | null;
      expiresAt: string | null;
      donorBadgeCount?: number;
    }> = [];

    try {
      const playerSkins = await db.playerSkin.findMany({
        where: {
          accountId: account.id,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        include: {
          skin: { select: { id: true, type: true, displayName: true, icon: true, colorClass: true, priority: true, duration: true } },
        },
        orderBy: { skin: { priority: 'desc' } },
      });

      skinsData = playerSkins.map(ps => ({
        type: ps.skin.type,
        icon: ps.skin.icon,
        displayName: ps.skin.displayName,
        colorClass: ps.skin.colorClass,
        priority: ps.skin.priority,
        duration: ps.skin.duration,
        reason: ps.reason,
        expiresAt: ps.expiresAt?.toISOString() ?? null,
        donorBadgeCount: ps.skin.type === 'donor' ? account.donorBadgeCount : undefined,
      }));
    } catch (skinError) {
      console.error('[PLAYER_SESSION] Skin fetch error (non-critical):', skinError);
    }

    // If player has donor badges but no active donor skin, add virtual donor_badge entry
    if (account.donorBadgeCount > 0 && !skinsData.some(s => s.type === 'donor')) {
      skinsData.push({
        type: 'donor_badge',
        icon: '❤️',
        displayName: account.donorBadgeCount >= 5 ? 'Heart Badge ★' : 'Heart Badge',
        colorClass: '{"frame":"#fb7185","name":"#fb7185|#ef4444|#f472b6","badge":"rgba(244,63,94,0.2)|#fda4af","border":"#f43f5e|#ef4444|#f472b6","glow":"rgba(244,63,94,0.35)"}',
        priority: 0,
        duration: 'permanent',
        reason: `${account.donorBadgeCount}x donasi`,
        expiresAt: null,
        donorBadgeCount: account.donorBadgeCount,
      });
    }

    return NextResponse.json({
      authenticated: true,
      account: {
        id: account.id,
        username: account.username,
        donorBadgeCount: account.donorBadgeCount,
        skins: skinsData,
        player: account.player,
      },
    }, { headers });
  } catch (error) {
    console.error('[PLAYER_SESSION] Fatal error:', error);
    return NextResponse.json({ authenticated: false }, { headers });
  }
}
