import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/whatsapp/logs - Get bot logs
export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');
    const type = searchParams.get('type'); // filter by type
    const sender = searchParams.get('sender'); // filter by sender

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (sender) where.sender = sender;

    const [logs, total] = await Promise.all([
      db.whatsAppLog.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      db.whatsAppLog.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: logs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    }, { headers });
  } catch (error) {
    console.error('Get WhatsApp logs error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
