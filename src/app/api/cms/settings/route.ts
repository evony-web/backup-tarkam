import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

// GET all settings
export async function GET() {
  const settings = await db.cmsSetting.findMany({
    orderBy: { key: 'asc' },
  });
  // Convert to key-value object for easy frontend usage
  const map: Record<string, string> = {};
  for (const s of settings) {
    map[s.key] = s.value;
  }
  return NextResponse.json({ settings, map }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}

// POST upsert a setting or batch upsert multiple settings
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const body = await request.json();

  // Batch mode: accept { items: [{ key, value, type }, ...] }
  if (body.items && Array.isArray(body.items)) {
    const results = await Promise.all(
      body.items.map((item: { key: string; value: string; type?: string }) =>
        db.cmsSetting.upsert({
          where: { key: item.key },
          update: { value: item.value ?? '', type: item.type ?? 'text' },
          create: { key: item.key, value: item.value ?? '', type: item.type ?? 'text' },
        })
      )
    );

    // ★ Invalidate CDN + ISR cache so landing page shows updated CMS content immediately
    revalidatePath('/');
    revalidateTag('cms-content', 'max');
    revalidatePath('/api/cms/content');

    return NextResponse.json({ success: true, count: results.length });
  }

  // Single mode: accept { key, value, type }
  const { key, value, type } = body;

  if (!key) {
    return NextResponse.json({ error: 'Key is required' }, { status: 400 });
  }

  const setting = await db.cmsSetting.upsert({
    where: { key },
    update: { value: value ?? '', type: type ?? 'text' },
    create: { key, value: value ?? '', type: type ?? 'text' },
  });

  // ★ Invalidate CDN + ISR cache so landing page shows updated CMS content immediately
  revalidatePath('/');
  revalidateTag('cms-content', 'max');
  revalidatePath('/api/cms/content');

  return NextResponse.json(setting);
}

// DELETE a setting
export async function DELETE(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const { key } = await request.json();
  if (!key) return NextResponse.json({ error: 'Key required' }, { status: 400 });

  await db.cmsSetting.delete({ where: { key } });

  // ★ Invalidate CDN + ISR cache
  revalidatePath('/');
  revalidateTag('cms-content', 'max');
  revalidatePath('/api/cms/content');

  return NextResponse.json({ success: true });
}
