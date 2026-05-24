import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/whatsapp/bot - Get bot status
export async function GET() {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  try {
    let bot = await db.whatsAppBot.findFirst();

    // Auto-create a default bot record if none exists
    if (!bot) {
      bot = await db.whatsAppBot.create({
        data: {
          name: 'TARKAM Bot',
          status: 'offline',
          autoReply: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: bot.id,
        name: bot.name,
        status: bot.status,
        lastConnectedAt: bot.lastConnectedAt,
        messagesSent: bot.messagesSent,
        messagesReceived: bot.messagesReceived,
        autoReply: bot.autoReply,
        welcomeMessage: bot.welcomeMessage,
      },
    }, { headers });
  } catch (error) {
    console.error('Get WhatsApp bot status error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/whatsapp/bot - Update bot settings
export async function PUT(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { autoReply, welcomeMessage, status, name } = body;

    let bot = await db.whatsAppBot.findFirst();

    // Auto-create if not found
    if (!bot) {
      bot = await db.whatsAppBot.create({
        data: {
          name: name || 'TARKAM Bot',
          status: status || 'offline',
          autoReply: autoReply ?? true,
          welcomeMessage: welcomeMessage || null,
        },
      });

      return NextResponse.json({
        success: true,
        data: bot,
      });
    }

    const updateData: Record<string, unknown> = {};
    if (autoReply !== undefined) updateData.autoReply = autoReply;
    if (welcomeMessage !== undefined) updateData.welcomeMessage = welcomeMessage;
    if (status !== undefined) updateData.status = status;
    if (name !== undefined) updateData.name = name;

    const updated = await db.whatsAppBot.update({
      where: { id: bot.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Update WhatsApp bot error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
