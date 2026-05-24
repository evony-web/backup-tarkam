import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';

const VALID_CATEGORIES = ['ava', 'item', 'char', 'jasa', 'dll'];

// GET /api/marketplace — List marketplace items (public: approved only, admin: all)
export async function GET(request: NextRequest) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const status = searchParams.get('status'); // Admin filter: "pending" | "approved" | "rejected" | "all"
    const adminMode = searchParams.get('admin') === 'true';

    const where: Record<string, unknown> = { isActive: true };

    // Public only sees approved items; admin can filter by status
    if (adminMode) {
      try {
        const authResult = await requireAdmin(request);
        if (!(authResult instanceof NextResponse)) {
          // Admin authenticated — apply status filter
          if (status && status !== 'all') {
            where.status = status;
          }
        } else {
          // Admin auth failed — fall back to approved only
          where.status = 'approved';
        }
      } catch {
        where.status = 'approved';
      }
    } else {
      where.status = 'approved';
    }

    if (category && VALID_CATEGORIES.includes(category)) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const items = await db.marketplaceItem.findMany({
      where,
      orderBy: [
        { isPremium: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 50,
    });

    return NextResponse.json({ items }, { headers });
  } catch (error) {
    console.error('Error fetching marketplace items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch marketplace items' },
      { headers,  status: 500 }
    );
  }
}

// POST /api/marketplace — Create a marketplace item (admin only, auto-approved)
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { sellerName, sellerAvatar, sellerWhatsapp, title, description, price, category, imageUrl, images, isPremium } = body;

    // Validate required fields
    if (!sellerName || !title || !description || price === undefined || !category) {
      return NextResponse.json(
        { error: 'sellerName, title, description, price, and category are required' },
        { status: 400 }
      );
    }

    // Validate category
    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate price is a non-negative integer
    if (typeof price !== 'number' || price < 0 || !Number.isInteger(price)) {
      return NextResponse.json(
        { error: 'Price must be a non-negative integer' },
        { status: 400 }
      );
    }

    // Validate images array (max 5)
    let imagesJson: string | null = null;
    if (images && Array.isArray(images)) {
      const validImages = images.filter((url: string) => typeof url === 'string' && url.trim()).slice(0, 5);
      if (validImages.length > 0) imagesJson = JSON.stringify(validImages);
    }

    const item = await db.marketplaceItem.create({
      data: {
        sellerName,
        sellerAvatar: sellerAvatar || null,
        sellerWhatsapp: sellerWhatsapp || null,
        title,
        description,
        price,
        category,
        imageUrl: imageUrl || (imagesJson ? JSON.parse(imagesJson)[0] : null),
        images: imagesJson,
        isPremium: isPremium ?? false,
        status: 'approved', // Admin-created items are auto-approved
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error('Error creating marketplace item:', error);
    return NextResponse.json(
      { error: 'Failed to create marketplace item' },
      { status: 500 }
    );
  }
}
