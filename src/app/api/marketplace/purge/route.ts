import { NextRequest, NextResponse } from 'next/server';
import { db, neonDeleteMany, isPostgreSQL } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/api-auth';

// DELETE /api/marketplace/purge — Hard-delete ALL marketplace items (super admin only)
// Use with caution — this permanently removes all marketplace data
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireSuperAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const count = await db.marketplaceItem.count();

    if (count === 0) {
      return NextResponse.json({ message: 'Tidak ada marketplace item untuk dihapus', deleted: 0 });
    }

    // Neon workaround: deleteMany() may not work with PrismaNeonHttp
    if (isPostgreSQL) {
      await neonDeleteMany('MarketplaceItem', []);
    } else {
      await db.marketplaceItem.deleteMany();
    }

    return NextResponse.json({
      message: `Semua marketplace item berhasil dihapus`,
      deleted: count,
    });
  } catch (error) {
    console.error('Error purging marketplace items:', error);
    return NextResponse.json(
      { error: 'Failed to purge marketplace items' },
      { status: 500 }
    );
  }
}
