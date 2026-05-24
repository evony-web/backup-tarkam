import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, createSessionToken, hashPassword, isBcryptHash } from '@/lib/auth';
import { db, isPostgreSQL } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { checkRateLimit, getClientIp, RATE_LIMITS, rateLimitHeaders } from '@/lib/rate-limit';
import { validateInput, loginSchema } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 login attempts per 15 minutes per IP
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(clientIp, RATE_LIMITS.ADMIN_LOGIN);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)), ...rateLimitHeaders(rateLimit) } }
      );
    }

    const body = await request.json();

    // Validate input with Zod
    const validation = validateInput(loginSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const { username, password } = validation.data;

    const admin = await authenticateAdmin(username, password);
    if (!admin) {
      return NextResponse.json(
        { error: 'Username atau password salah' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Migrate bcrypt hash to scrypt on successful login (non-blocking)
    try {
      const adminRecord = await db.admin.findUnique({ where: { id: admin.id } });
      if (adminRecord && isBcryptHash(adminRecord.passwordHash)) {
        const newHash = await hashPassword(password);
        if (isPostgreSQL) {
          // Neon HTTP adapter doesn't support $executeRaw — use normal update
          await db.admin.update({
            where: { id: admin.id },
            data: { passwordHash: newHash },
          });
        } else {
          await db.admin.update({
            where: { id: admin.id },
            data: { passwordHash: newHash },
          });
        }
      }
    } catch (migrateError) {
      console.error('[ADMIN_LOGIN] Hash migration error (non-critical):', migrateError);
      // Don't fail the login if migration fails
    }

    const token = createSessionToken(admin.id, admin.role);

    const response = NextResponse.json({
      success: true,
      admin: { id: admin.id, username: admin.username, role: admin.role },
    }, { headers: { 'Cache-Control': 'no-store' } });

    // Set httpOnly cookie
    response.cookies.set('idm-admin-session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    // Audit log (fire-and-forget)
    void createAuditLog({
      adminId: admin.id,
      adminName: admin.username,
      action: 'login',
      entity: 'auth',
      details: `Login sebagai ${admin.username}`,
    });

    return response;
  } catch (error: any) {
    console.error('[ADMIN_LOGIN] Fatal error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
