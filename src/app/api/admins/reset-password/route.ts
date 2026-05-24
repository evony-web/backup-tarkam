import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, invalidateAdminSession } from '@/lib/auth';
import { requireSuperAdmin } from '@/lib/api-auth';
import { createAuditLog } from '@/lib/audit';

/**
 * POST /api/admins/reset-password - Reset another admin's password (super_admin only)
 */
export async function POST(request: NextRequest) {
  const result = await requireSuperAdmin(request);
  if (result instanceof NextResponse) return result;

  try {
    const body = await request.json();
    const { adminId, newPassword } = body;

    if (!adminId || !newPassword) {
      return NextResponse.json(
        { error: 'ID admin dan password baru wajib diisi' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password baru minimal 6 karakter' },
        { status: 400 }
      );
    }

    // Prevent resetting own password through this endpoint
    if (result.id === adminId) {
      return NextResponse.json(
        { error: 'Gunakan fitur Ganti Password untuk mengubah password Anda sendiri' },
        { status: 400 }
      );
    }

    const targetAdmin = await db.admin.findUnique({ where: { id: adminId } });
    if (!targetAdmin) {
      return NextResponse.json(
        { error: 'Admin tidak ditemukan' },
        { status: 404 }
      );
    }

    const passwordHash = await hashPassword(newPassword);
    await db.admin.update({
      where: { id: adminId },
      data: { passwordHash },
    });

    // Invalidate all existing sessions so the target admin must re-login
    await invalidateAdminSession(adminId);

    await createAuditLog({
      adminId: result.id,
      adminName: result.username,
      action: 'update',
      entity: 'admin',
      entityId: adminId,
      details: `Reset password admin: ${adminId}`,
    });

    return NextResponse.json({
      success: true,
      message: `Password admin "${targetAdmin.username}" berhasil direset`,
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Gagal mereset password' },
      { status: 500 }
    );
  }
}
