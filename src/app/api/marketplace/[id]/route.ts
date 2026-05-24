import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';

const VALID_CATEGORIES = ['ava', 'item', 'char', 'jasa', 'dll'];

// DELETE /api/marketplace/[id] — Soft delete a marketplace item (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;

    const item = await db.marketplaceItem.findUnique({ where: { id } });
    if (!item) {
      return NextResponse.json(
        { error: 'Marketplace item not found' },
        { status: 404 }
      );
    }

    // Soft delete: set isActive to false
    const updated = await db.marketplaceItem.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error('Error deleting marketplace item:', error);
    return NextResponse.json(
      { error: 'Failed to delete marketplace item' },
      { status: 500 }
    );
  }
}

// PATCH /api/marketplace/[id] — Update a marketplace item (admin only)
// Supports: update fields, approve, reject
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;

    const item = await db.marketplaceItem.findUnique({ where: { id } });
    if (!item) {
      return NextResponse.json(
        { error: 'Marketplace item not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { sellerName, sellerAvatar, sellerWhatsapp, title, description, price, category, imageUrl, images, isPremium, isActive, status } = body;

    // Validate category if provided
    if (category !== undefined && !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate price if provided
    if (price !== undefined && (typeof price !== 'number' || price < 0 || !Number.isInteger(price))) {
      return NextResponse.json(
        { error: 'Price must be a non-negative integer' },
        { status: 400 }
      );
    }

    // Validate status if provided
    if (status !== undefined && !['pending', 'approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: pending, approved, or rejected' },
        { status: 400 }
      );
    }

    // Validate images array if provided (max 5)
    let imagesJson: string | null | undefined = undefined;
    if (images !== undefined) {
      if (Array.isArray(images)) {
        const validImages = images.filter((url: string) => typeof url === 'string' && url.trim()).slice(0, 5);
        imagesJson = validImages.length > 0 ? JSON.stringify(validImages) : null;
      } else {
        imagesJson = null;
      }
    }

    const updated = await db.marketplaceItem.update({
      where: { id },
      data: {
        ...(sellerName !== undefined && { sellerName }),
        ...(sellerAvatar !== undefined && { sellerAvatar }),
        ...(sellerWhatsapp !== undefined && { sellerWhatsapp }),
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price }),
        ...(category !== undefined && { category }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(imagesJson !== undefined && { images: imagesJson }),
        ...(isPremium !== undefined && { isPremium }),
        ...(isActive !== undefined && { isActive }),
        ...(status !== undefined && { status }),
      },
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error('Error updating marketplace item:', error);
    return NextResponse.json(
      { error: 'Failed to update marketplace item' },
      { status: 500 }
    );
  }
}
