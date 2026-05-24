import { db, neonDeleteMany, isPostgreSQL } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

// GET all sections with their cards
export async function GET() {
  const sections = await db.cmsSection.findMany({
    orderBy: { order: 'asc' },
    include: { cards: { orderBy: { order: 'asc' } } },
  });
  return NextResponse.json(sections, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}

// POST create or update a section
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin; // 401 response

  const body = await request.json();
  const { id, slug, title, subtitle, description, bannerUrl, isActive, order } = body;

  if (!slug) {
    return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
  }

  const section = id
    ? await db.cmsSection.update({
        where: { id },
        data: { slug, title, subtitle, description, bannerUrl, isActive, order },
      })
    : await db.cmsSection.create({
        data: { slug, title, subtitle, description, bannerUrl, isActive, order },
      });

  // ★ Invalidate CDN + ISR cache so landing page shows updated CMS content immediately
  revalidatePath('/');
  revalidateTag('cms-content', 'max');
  revalidatePath('/api/cms/content');

  return NextResponse.json(section);
}

// DELETE a section
export async function DELETE(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  // Neon workaround: deleteMany() doesn't work with PrismaNeonHttp
  if (isPostgreSQL) {
    await neonDeleteMany('CmsCard', [{ column: 'sectionId', operator: '=', value: id }]);
  } else {
    await db.cmsCard.deleteMany({ where: { sectionId: id } });
  }
  await db.cmsSection.delete({ where: { id } });

  // ★ Invalidate CDN + ISR cache
  revalidatePath('/');
  revalidateTag('cms-content', 'max');
  revalidatePath('/api/cms/content');

  return NextResponse.json({ success: true });
}
