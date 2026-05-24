import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { NextResponse } from 'next/server';

/**
 * POST /api/admin/update-credentials
 * One-time endpoint to update super admin credentials.
 * Protected by a secret token.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { secret, newUsername, newPassword } = body;

    // Secret from environment variable — set ADMIN_UPDATE_SECRET to enable this endpoint
    const expectedSecret = process.env.ADMIN_UPDATE_SECRET;
    if (!expectedSecret || secret !== expectedSecret) {
      return NextResponse.json({ error: !expectedSecret ? 'Endpoint disabled' : 'Invalid secret' }, { status: 403 });
    }

    if (!newUsername && !newPassword) {
      return NextResponse.json({ error: 'Provide newUsername and/or newPassword' }, { status: 400 });
    }

    // Find the super admin
    const superAdmin = await db.admin.findFirst({ where: { role: 'super_admin' } });
    if (!superAdmin) {
      return NextResponse.json({ error: 'No super admin found' }, { status: 404 });
    }

    const data: { username?: string; passwordHash?: string } = {};
    if (newUsername) data.username = newUsername;
    if (newPassword) data.passwordHash = await hashPassword(newPassword);

    const updated = await db.admin.update({
      where: { id: superAdmin.id },
      data,
    });

    return NextResponse.json({
      success: true,
      message: 'Credentials updated',
      admin: { id: updated.id, username: updated.username, role: updated.role },
    });
  } catch (error) {
    console.error('UPDATE_CREDENTIALS', error);
    return NextResponse.json({ error: 'Failed to update credentials' }, { status: 500 });
  }
}
