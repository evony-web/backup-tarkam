import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/api-auth';
import { invalidateAdminSession } from '@/lib/auth';

// Update user role - maps to Admin role in our schema
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id } = await params;
    const body = await request.json();
    const { role } = body;

    if (!role || !['admin', 'super_admin'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Role tidak valid' },
        { status: 400 }
      );
    }

    const admin = await db.admin.update({
      where: { id },
      data: { role },
      select: { id: true, username: true, role: true, createdAt: true, updatedAt: true },
    });

    await invalidateAdminSession(id);

    return NextResponse.json({ success: true, data: admin });
  } catch (error) {
    console.error('Update role error:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
