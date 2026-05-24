import { NextResponse } from 'next/server';
import { db, isPostgreSQL, isSQLite } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || '';
  const startTime = Date.now();

  try {
    // Test database connectivity
    let playerCount = 0;
    let tournamentCount = 0;

    try {
      playerCount = await db.player.count();
      tournamentCount = await db.tournament.count();
    } catch (queryErr) {
      return NextResponse.json({
        status: 'error',
        database: 'connection_failed',
        provider: isPostgreSQL ? 'postgresql' : isSQLite ? 'sqlite' : 'unknown',
        urlPrefix: dbUrl ? dbUrl.substring(0, 20) + '...' : 'NOT_SET',
        error: queryErr instanceof Error ? queryErr.message : 'Unknown error',
        hint: !dbUrl
          ? 'DATABASE_URL is not set! Add it in Vercel Dashboard → Settings → Environment Variables'
          : dbUrl.startsWith('file:')
            ? 'SQLite URL detected in production. Set DATABASE_URL to Neon PostgreSQL connection string.'
            : 'Check if Neon database has the schema pushed (run: DATABASE_URL=<neon-url> npx prisma db push)',
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      provider: isPostgreSQL ? 'postgresql' : isSQLite ? 'sqlite' : 'unknown',
      urlPrefix: dbUrl ? dbUrl.substring(0, 20) + '...' : 'NOT_SET',
      stats: {
        players: playerCount,
        tournaments: tournamentCount,
      },
      responseTimeMs: responseTime,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({
      status: 'error',
      database: 'unknown_error',
      error: err instanceof Error ? err.message : 'Unknown error',
      provider: isPostgreSQL ? 'postgresql' : isSQLite ? 'sqlite' : 'unknown',
      urlPrefix: dbUrl ? dbUrl.substring(0, 20) + '...' : 'NOT_SET',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
