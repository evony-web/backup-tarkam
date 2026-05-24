import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, verifyPassword, invalidateAdminSession } from '@/lib/auth';
import { requireAdmin } from '@/lib/api-auth';
import { createAuditLog } from '@/lib/audit';
import { validateInput, changePasswordSchema } from '@/lib/validation';
import { checkRateLimit, getClientIp, RATE_LIMITS, rateLimitHeaders } from '@/lib/rate-limit';

/**
 * POST /api/auth/change-password - Change own password (any authenticated admin)
 */
export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result instanceof NextResponse) return result;

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

    // Validate input with Zod
    const validation = validateInput(changePasswordSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const { currentPassword, newPassword } = validation.data;

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

    // Get current admin with password hash
    const admin = await db.admin.findUnique({ where: { id: result.id } });
    if (!admin) {
      return NextResponse.json(
        { error: 'Admin tidak ditemukan' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, admin.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Password lama tidak sesuai' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Update password
    const newPasswordHash = await hashPassword(newPassword);
    await db.admin.update({
      where: { id: result.id },
      data: { passwordHash: newPasswordHash },
    });

    // Invalidate all existing sessions so the admin must re-login with new password
    await invalidateAdminSession(result.id);

    await createAuditLog({
      adminId: result.id,
      adminName: result.username,
      action: 'update',
      entity: 'auth',
      details: 'Ubah password',
    });

    return NextResponse.json({
      success: true,
      message: 'Password berhasil diubah',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { error: 'Gagal mengubah password' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
