import { NextRequest, NextResponse } from 'next/server';
import { db, isPostgreSQL } from '@/lib/db';
import { verifyPassword, createPlayerSessionToken, hashPassword, isBcryptHash } from '@/lib/auth';
import { checkRateLimit, getClientIp, RATE_LIMITS, rateLimitHeaders } from '@/lib/rate-limit';
import { createPlayerAuditLog } from '@/lib/audit';

const PLAYER_SESSION_COOKIE = 'idm-player-session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10 login attempts per 15 minutes per IP
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(clientIp, RATE_LIMITS.PLAYER_LOGIN);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)), ...rateLimitHeaders(rateLimit) } }
      );
    }

    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username dan password harus diisi' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Find account by username (which is gamertag)
    const account = await db.account.findUnique({
      where: { username },
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
      return NextResponse.json(
        { error: 'Username atau password salah' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, account.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Username atau password salah' },
        { status: 401 }
      );
    }

    // Migrate bcrypt hash to scrypt on successful login (non-blocking)
    if (isBcryptHash(account.passwordHash)) {
      try {
        const newHash = await hashPassword(password);
        await db.account.update({
          where: { id: account.id },
          data: { passwordHash: newHash, lastLoginAt: new Date() },
        });
      } catch (migrateError) {
        console.error('[PLAYER_LOGIN] Hash migration error (non-critical):', migrateError);
        // Still update last login even if migration fails
        try {
          await db.account.update({
            where: { id: account.id },
            data: { lastLoginAt: new Date() },
          });
        } catch (updateError) {
          console.error('[PLAYER_LOGIN] Last login update error (non-critical):', updateError);
        }
      }
    } else {
      // Update last login (non-blocking — don't fail login if this errors)
      try {
        await db.account.update({
          where: { id: account.id },
          data: { lastLoginAt: new Date() },
        });
      } catch (updateError) {
        console.error('[PLAYER_LOGIN] Last login update error (non-critical):', updateError);
      }
    }

    // Create player session token (format: player:accountId:playerId:timestamp:signature)
    const token = createPlayerSessionToken(account.id, account.playerId);

    // Get active skins for the player (non-blocking — don't fail login if skins query fails)
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
      // Neon HTTP adapter may fail on complex queries — don't block login
      console.error('[PLAYER_LOGIN] Skin fetch error (non-critical, login continues):', skinError);
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

    // ★ Audit log: player login (fire-and-forget)
    void createPlayerAuditLog({
      playerId: account.playerId,
      playerName: account.player.gamertag,
      action: 'login',
      entity: 'player_auth',
      details: `Player login: ${account.player.gamertag}`,
    });

    const response = NextResponse.json({
      success: true,
      account: {
        id: account.id,
        username: account.username,
        donorBadgeCount: account.donorBadgeCount,
        skins: skinsData,
        player: account.player,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });

    // Set httpOnly cookie for player session
    response.cookies.set(PLAYER_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('[PLAYER_LOGIN] Fatal error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
