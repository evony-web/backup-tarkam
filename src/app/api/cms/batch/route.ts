import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { createAuditLog } from '@/lib/audit';
import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

// PUT /api/cms/batch — Batch save multiple CMS settings
export async function PUT(request: Request) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { items } = body as { items: { key: string; value: string }[] };

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'items array is required' }, { status: 400 });
    }

    // Update each setting in sequence (safe for all database providers)
    const results: Array<{ id: string; key: string; value: string; updatedAt: Date; type: string }> = [];
    for (const item of items) {
      const result = await db.cmsSetting.upsert({
        where: { key: item.key },
        update: { value: item.value, updatedAt: new Date() },
        create: { key: item.key, value: item.value },
      });
      results.push({
        id: result.id,
        key: result.key,
        value: result.value,
        updatedAt: result.updatedAt,
        type: result.type,
      });
    }

    // ★ Invalidate CDN + ISR cache so landing page shows updated CMS content immediately
    revalidatePath('/');
    revalidateTag('cms-content', 'max');
    revalidatePath('/api/cms/content');

    await createAuditLog({
      adminId: authResult.id,
      adminName: authResult.username,
      action: 'update',
      entity: 'cms',
      details: 'Batch update konten',
    });

    return NextResponse.json({ 
      success: true, 
      count: results.length,
      updated: results.map(r => r.key),
    });
  } catch (error) {
    console.error('CMS batch save error:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
