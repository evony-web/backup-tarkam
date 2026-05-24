import { db, neonCreateMany, isPostgreSQL } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/whatsapp/commands - List WhatsApp commands
export async function GET() {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  try {
    let commands = await db.whatsAppCommand.findMany({
      orderBy: { command: 'asc' },
    });

    // Seed default commands if none exist
    if (commands.length === 0) {
      const defaults = [
        { command: 'help', response: '📖 *TARKAM Bot Commands*\n\np daftar <gamertag> <M/F> [nama] [club]\np info — Cek status registrasi\np batal — Batalkan registrasi\np ranking — Top 10 leaderboard\np status [gamertag] — Cek stats pemain\np recap — Recap turnamen\np next — Match selanjutnya\np live — Match sedang berlangsung', minRole: 'player', isActive: true },
        { command: 'daftar', response: null, minRole: 'player', isActive: true },
        { command: 'info', response: null, minRole: 'player', isActive: true },
        { command: 'batal', response: null, minRole: 'player', isActive: true },
        { command: 'ranking', response: null, minRole: 'player', isActive: true },
        { command: 'status', response: null, minRole: 'player', isActive: true },
        { command: 'recap', response: null, minRole: 'player', isActive: true },
        { command: 'next', response: null, minRole: 'player', isActive: true },
        { command: 'live', response: null, minRole: 'player', isActive: true },
        { command: 'result', response: null, minRole: 'admin', isActive: true },
        { command: 'mvp', response: null, minRole: 'admin', isActive: true },
        { command: 'start', response: null, minRole: 'admin', isActive: true },
        { command: 'end', response: null, minRole: 'admin', isActive: true },
        { command: 'ban', response: null, minRole: 'admin', isActive: true },
        { command: 'unban', response: null, minRole: 'admin', isActive: true },
        { command: 'broadcast', response: null, minRole: 'admin', isActive: true },
        { command: 'cekgrup', response: null, minRole: 'admin', isActive: true },
      ];

      // Neon workaround: createMany() doesn't work with PrismaNeonHttp
      if (isPostgreSQL) {
        await neonCreateMany(db.whatsAppCommand, defaults);
      } else {
        await db.whatsAppCommand.createMany({ data: defaults });
      }
      commands = await db.whatsAppCommand.findMany({
        orderBy: { command: 'asc' },
      });
    }

    return NextResponse.json({
      success: true,
      data: commands,
    }, { headers });
  } catch (error) {
    console.error('Get WhatsApp commands error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/whatsapp/commands - Update command
export async function PUT(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { id, response, isActive, minRole } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (response !== undefined) updateData.response = response;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (minRole !== undefined) updateData.minRole = minRole;

    const command = await db.whatsAppCommand.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: command,
    });
  } catch (error) {
    console.error('Update WhatsApp command error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
