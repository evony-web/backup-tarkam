import { db } from '@/lib/db';
import { hashPassword, isBcryptHash } from '@/lib/auth';
import { verifyAdmin } from '@/lib/api-auth';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // First check: if super admin already exists, migrate bcrypt hash if needed
    const existing = await db.admin.findFirst({ where: { role: 'super_admin' } });
    if (existing) {
      // Migrate legacy bcrypt hash to scrypt for Turbopack compatibility
      if (isBcryptHash(existing.passwordHash)) {
        const password = process.env.ADMIN_PASSWORD;
        if (!password) {
          return NextResponse.json({
            error: 'ADMIN_PASSWORD environment variable must be set for bcrypt migration. Set it in your .env file.',
          }, { status: 500 });
        }
        const newHash = await hashPassword(password);
        await db.admin.update({
          where: { id: existing.id },
          data: { passwordHash: newHash },
        });
        console.log(`[init-admin] Migrated admin "${existing.username}" from bcrypt to scrypt`);
      }

      return NextResponse.json({
        success: true,
        message: 'Super admin already exists',
        admin: { id: existing.id, username: existing.username, role: existing.role },
      });
    }

    // If any other admin exists (but no super_admin yet), require auth to create super_admin
    const anyAdmin = await db.admin.findFirst();
    if (anyAdmin) {
      const admin = await verifyAdmin(request);
      if (!admin) {
        return NextResponse.json({ error: 'Unauthorized - Admin login required to create super admin' }, { status: 401 });
      }
    }

    // No admin exists at all — safe to create super admin (first-time setup)
    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;
    if (!username || !password) {
      return NextResponse.json({
        error: 'ADMIN_USERNAME and ADMIN_PASSWORD environment variables must be set before creating the initial admin. Set them in your .env file or deployment environment.',
      }, { status: 500 });
    }
    const passwordHash = await hashPassword(password);
    let admin;
    try {
      admin = await db.admin.create({
        data: {
          username,
          passwordHash,
          role: 'super_admin',
        },
      });
    } catch (createError: any) {
      // Handle race condition: another request may have created the admin already
      if (createError?.code === 'P2002') {
        const existingAdmin = await db.admin.findFirst({ where: { role: 'super_admin' } });
        if (existingAdmin) {
          return NextResponse.json({
            success: true,
            message: 'Super admin already exists',
            admin: { id: existingAdmin.id, username: existingAdmin.username, role: existingAdmin.role },
          });
        }
      }
      throw createError;
    }

    return NextResponse.json({
      success: true,
      message: 'Super admin created successfully',
      admin: { id: admin.id, username: admin.username, role: admin.role },
    });
  } catch (error) {
    console.error('Init admin error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize admin' },
      { status: 500 }
    );
  }
}
