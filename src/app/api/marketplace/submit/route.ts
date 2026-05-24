import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePlayer } from '@/lib/api-auth';

const VALID_CATEGORIES = ['ava', 'item', 'char', 'jasa', 'dll'];

// POST /api/marketplace/submit — User submission (REQUIRES player login)
// Items are created with status "pending" and need admin approval
export async function POST(request: NextRequest) {
  try {
    // Require player authentication
    const playerAuth = await requirePlayer(request);
    if (playerAuth instanceof NextResponse) return playerAuth;

    const body = await request.json();
    const { sellerWhatsapp, title, description, price, category, imageUrl, images } = body;

    // Validate required fields
    if (!title || !description || price === undefined || !category) {
      return NextResponse.json(
        { error: 'title, description, price, and category are required' },
        { status: 400 }
      );
    }

    // Validate strings length (prevent spam)
    if (title.length > 100 || description.length > 500) {
      return NextResponse.json(
        { error: 'Text too long. Max: title 100, description 500 characters' },
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

    // Rate limiting: max 5 pending submissions per player per day
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentSubmissions = await db.marketplaceItem.count({
      where: {
        playerId: playerAuth.playerId,
        status: 'pending',
        createdAt: { gte: oneDayAgo },
      },
    });

    if (recentSubmissions >= 5) {
      return NextResponse.json(
        { error: 'Kamu sudah mengajukan 5 iklan hari ini. Tunggu approval dari admin terlebih dahulu.' },
        { status: 429 }
      );
    }

    // Validate images array (max 5)
    let imagesJson: string | null = null;
    if (images && Array.isArray(images)) {
      const validImages = images.filter((url: string) => typeof url === 'string' && url.trim()).slice(0, 5);
      if (validImages.length > 0) imagesJson = JSON.stringify(validImages);
    }

    // Auto-fill seller info from player account
    const player = playerAuth.player;

    const item = await db.marketplaceItem.create({
      data: {
        playerId: playerAuth.playerId,
        sellerName: player.gamertag, // Auto-filled from gamertag
        sellerAvatar: player.avatar, // Auto-filled from player avatar
        sellerWhatsapp: sellerWhatsapp || null,
        title,
        description,
        price,
        category,
        imageUrl: imageUrl || (imagesJson ? JSON.parse(imagesJson)[0] : null),
        images: imagesJson,
        isPremium: false, // User submissions cannot be premium
        status: 'pending', // Requires admin approval
      },
    });

    return NextResponse.json({
      item,
      message: 'Iklan berhasil diajukan! Menunggu approval admin sebelum ditampilkan.',
    }, { status: 201 });
  } catch (error) {
    console.error('Error submitting marketplace item:', error);
    return NextResponse.json(
      { error: 'Failed to submit marketplace item' },
      { status: 500 }
    );
  }
}
