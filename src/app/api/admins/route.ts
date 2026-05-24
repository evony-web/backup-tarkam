import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, invalidateAdminSession } from '@/lib/auth';
import { requireSuperAdmin, requireAdmin } from '@/lib/api-auth';
import { createAuditLog } from '@/lib/audit';
import { validateInput, createAdminSchema, updateAdminSchema, deleteAdminSchema } from '@/lib/validation';

/**
 * GET /api/admins - List all admins (super_admin only)
 */
export async function GET(request: NextRequest) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  const result = await requireSuperAdmin(request);
  if (result instanceof NextResponse) return result;

  try {
    const admins = await db.admin.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ admins }, { headers });
  } catch (error) {
    console.error('List admins error:', error);
    return NextResponse.json(
      { error: 'Gagal mengambil daftar admin' },
      { headers,  status: 500 }
    );
  }
}

/**
 * POST /api/admins - Create a new admin (super_admin only)
 */
export async function POST(request: NextRequest) {
  const result = await requireSuperAdmin(request);
  if (result instanceof NextResponse) return result;

  try {
    const body = await request.json();

    // Validate input with Zod
    const validation = validateInput(createAdminSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { username, password, role: adminRole } = validation.data;

    // Check if username already exists
    const existing = await db.admin.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json(
        { error: 'Username sudah digunakan' },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const admin = await db.admin.create({
      data: {
        username,
        passwordHash,
        role: adminRole,
      },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
      },
    });

    await createAuditLog({
      adminId: result.id,
      adminName: result.username,
      action: 'create',
      entity: 'admin',
      entityId: admin.id,
      details: `Buat admin: ${username}`,
    });

    return NextResponse.json({
      success: true,
      message: 'Admin berhasil dibuat',
      admin,
    });
  } catch (error) {
    console.error('Create admin error:', error);
    return NextResponse.json(
      { error: 'Gagal membuat admin' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admins - Update admin (super_admin only, or self for limited fields)
 */
export async function PUT(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result instanceof NextResponse) return result;

  try {
    const body = await request.json();

    // Validate input with Zod
    const validation = validateInput(updateAdminSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { id, username, role } = validation.data;

    if (!id) {
      return NextResponse.json(
        { error: 'ID admin wajib diisi' },
        { status: 400 }
      );
    }

    // Check if target admin exists
    const targetAdmin = await db.admin.findUnique({ where: { id } });
    if (!targetAdmin) {
      return NextResponse.json(
        { error: 'Admin tidak ditemukan' },
        { status: 404 }
      );
    }

    const isSuperAdmin = result.role === 'super_admin';
    const isSelf = result.id === id;

    // Only super_admin can change roles and update other admins
    if (!isSuperAdmin && !isSelf) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki izin untuk mengubah admin lain' },
        { status: 403 }
      );
    }

    // Non-super_admin cannot change roles
    if (!isSuperAdmin && role && role !== targetAdmin.role) {
      return NextResponse.json(
        { error: 'Hanya super admin yang dapat mengubah role' },
        { status: 403 }
      );
    }

    // Prevent super_admin from demoting themselves
    if (isSelf && isSuperAdmin && role && role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Anda tidak dapat menurunkan role diri sendiri' },
        { status: 400 }
      );
    }

    const updateData: { username?: string; role?: string } = {};
    if (username) updateData.username = username;
    if (role && isSuperAdmin) updateData.role = role;

    // Check for duplicate username if changing
    if (username && username !== targetAdmin.username) {
      const duplicate = await db.admin.findUnique({ where: { username } });
      if (duplicate) {
        return NextResponse.json(
          { error: 'Username sudah digunakan' },
          { status: 409 }
        );
      }
    }

    const updated = await db.admin.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        role: true,
        updatedAt: true,
      },
    });

    // Invalidate sessions if role was changed
    if (role && role !== targetAdmin.role) {
      await invalidateAdminSession(id);
    }

    await createAuditLog({
      adminId: result.id,
      adminName: result.username,
      action: 'update',
      entity: 'admin',
      entityId: id,
      details: `Update admin: ${username || targetAdmin.username}`,
    });

    return NextResponse.json({
      success: true,
      message: 'Admin berhasil diperbarui',
      admin: updated,
    });
  } catch (error) {
    console.error('Update admin error:', error);
    return NextResponse.json(
      { error: 'Gagal memperbarui admin' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admins - Delete admin (super_admin only)
 */
export async function DELETE(request: NextRequest) {
  const result = await requireSuperAdmin(request);
  if (result instanceof NextResponse) return result;

  try {
    const body = await request.json();

    // Validate input with Zod
    const validation = validateInput(deleteAdminSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { id } = validation.data;

    // Prevent deleting self
    if (result.id === id) {
      return NextResponse.json(
        { error: 'Anda tidak dapat menghapus akun sendiri' },
        { status: 400 }
      );
    }

    const targetAdmin = await db.admin.findUnique({ where: { id } });
    if (!targetAdmin) {
      return NextResponse.json(
        { error: 'Admin tidak ditemukan' },
        { status: 404 }
      );
    }

    // Invalidate session before deleting (so the deleted admin's session is immediately revoked)
    await invalidateAdminSession(id);
    await db.admin.delete({ where: { id } });

    await createAuditLog({
      adminId: result.id,
      adminName: result.username,
      action: 'delete',
      entity: 'admin',
      entityId: id,
      details: `Hapus admin: ${id}`,
    });

    return NextResponse.json({
      success: true,
      message: `Admin "${targetAdmin.username}" berhasil dihapus`,
    });
  } catch (error) {
    console.error('Delete admin error:', error);
    return NextResponse.json(
      { error: 'Gagal menghapus admin' },
      { status: 500 }
    );
  }
}
