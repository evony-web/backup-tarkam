import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, verifyPassword, invalidatePlayerSession } from '@/lib/auth';
import { requirePlayer } from '@/lib/api-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS, rateLimitHeaders } from '@/lib/rate-limit';
import { createPlayerAuditLog } from '@/lib/audit';

const PLAYER_SESSION_COOKIE = 'idm-player-session';

/**
 * POST /api/account/change-password - Change own password (authenticated player)
 *
 * Flow:
 * 1. Verify player session
 * 2. Validate current password
 * 3. Hash and save new password
 * 4. Clear session cookie (force re-login)
 */
export async function POST(request: NextRequest) {
  const player = await requirePlayer(request);
  if (player instanceof NextResponse) return player;

  try {
    // Rate limit: 5 password changes per 15 minutes per IP
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(clientIp, RATE_LIMITS.PASSWORD_CHANGE);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan ubah password. Coba lagi dalam 15 menit.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)), ...rateLimitHeaders(rateLimit) } }
      );
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Password lama dan baru wajib diisi' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password baru minimal 6 karakter' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: 'Password baru harus berbeda dari password lama' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Get current account with password hash
    const account = await db.account.findUnique({
      where: { id: player.id },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Akun tidak ditemukan' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, account.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Password lama tidak sesuai' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Hash and update new password
    const newPasswordHash = await hashPassword(newPassword);
    await db.account.update({
      where: { id: account.id },
      data: { passwordHash: newPasswordHash },
    });

    // ★ Invalidate all existing sessions for this account
    // This ensures any other sessions (on other devices/browsers) are also terminated
    await invalidatePlayerSession(account.id);

    // ★ Audit log: player password change
    void createPlayerAuditLog({
      playerId: player.playerId,
      playerName: player.player.gamertag,
      action: 'password_change',
      entity: 'player_auth',
      entityId: player.id,
      details: `Password changed for player: ${player.player.gamertag}`,
    });

    // Clear session cookie to force re-login with new password
    const response = NextResponse.json({
      success: true,
      message: 'Password berhasil diubah. Silakan login kembali dengan password baru.',
    }, { headers: { 'Cache-Control': 'no-store' } });

    response.cookies.set(PLAYER_SESSION_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // Expire immediately
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Player change password error:', error);
    return NextResponse.json(
      { error: 'Gagal mengubah password' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
