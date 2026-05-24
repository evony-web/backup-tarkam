// ─── Database Client — Triple Environment ───
// Production (Vercel): Turso libSQL via Prisma driver adapter
//   - DATABASE_URL must be a valid SQLite URL for Prisma schema validation (e.g. file:./dev.db)
//   - TURSO_DATABASE_URL is the actual libsql:// connection URL used by the adapter
//   - TURSO_AUTH_TOKEN is the auth token for Turso
// Legacy Production:   Neon PostgreSQL via standard PrismaClient
// Local development:   SQLite via standard PrismaClient
//
// NOTE: Lazy initialization is required because Turbopack may evaluate
// this module before .env is loaded. By deferring PrismaClient creation
// to first actual use, we ensure process.env.DATABASE_URL is available.

// Ensure .env is loaded with correct values before Prisma Client initialization.
// Bun auto-loads .env but may cache stale values; dotenv with override fixes this.
import { config as dotenvConfig } from 'dotenv'
import { resolve } from 'path'
dotenvConfig({ path: resolve(process.cwd(), '.env'), override: true })

import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Detect the database type based on environment variables.
 *
 * CRITICAL: On Vercel production, DATABASE_URL must be a valid SQLite URL
 * (e.g. file:./dev.db) for Prisma schema validation. The ACTUAL Turso
 * connection is made via TURSO_DATABASE_URL + the driver adapter.
 *
 * Detection logic:
 * 1. If DATABASE_URL starts with postgres:// → PostgreSQL (legacy)
 * 2. If DATABASE_URL starts with libsql:// → Turso (legacy, not recommended)
 * 3. If USE_TURSO=true AND TURSO_DATABASE_URL is set → Turso (recommended for Vercel)
 * 4. Otherwise → local SQLite
 */
function _getDbType(): 'postgres' | 'libsql' | 'sqlite' {
  const dbUrl = process.env.DATABASE_URL || ''

  // Check if DATABASE_URL itself is a postgres URL
  if (dbUrl.startsWith('postgres')) return 'postgres'

  // Check if DATABASE_URL itself is a libsql URL (legacy fallback)
  if (dbUrl.startsWith('libsql://') || dbUrl.startsWith('http://') || dbUrl.startsWith('https://')) {
    return 'libsql'
  }

  // Check explicit USE_TURSO flag (recommended for Vercel)
  // This keeps local dev using SQLite even when TURSO_DATABASE_URL exists in .env
  if (process.env.USE_TURSO === 'true') {
    const tursoUrl = process.env.TURSO_DATABASE_URL || ''
    if (tursoUrl.startsWith('libsql://') || tursoUrl.startsWith('http://') || tursoUrl.startsWith('https://')) {
      return 'libsql'
    }
  }

  // Default: local SQLite
  return 'sqlite'
}

function createPrismaClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL
  const dbType = _getDbType()

  if (!dbUrl) {
    console.error('[DB] ❌ DATABASE_URL is not set! Database connection will fail.')
    console.error('[DB] Set DATABASE_URL in .env (local) or Vercel Environment Variables (production)')
  }

  const logLevel = process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']

  if (dbType === 'libsql') {
    // ── Production: Turso libSQL via driver adapter ──
    // The actual connection URL comes from TURSO_DATABASE_URL
    // DATABASE_URL must be a valid SQLite URL for Prisma schema validation
    const tursoUrl = process.env.TURSO_DATABASE_URL || dbUrl || ''
    console.log('[DB] Using Turso libSQL —', tursoUrl?.substring(0, 40) + '...')

    // When using driver adapters, Prisma doesn't use DATABASE_URL for connections,
    // but the PrismaClient constructor may still validate the URL format.
    // Override it to a valid SQLite path to prevent validation errors.
    if (dbUrl && (dbUrl.startsWith('libsql://') || dbUrl.startsWith('http://') || dbUrl.startsWith('https://'))) {
      process.env.DATABASE_URL = 'file:./dev.db'
    }

    // PrismaLibSql@7.x accepts a config object { url, authToken } directly.
    // It creates the @libsql/client internally via createClient(config).
    const adapter = new PrismaLibSql({
      url: tursoUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
    return new PrismaClient({ adapter, log: logLevel }) as PrismaClient
  }

  if (dbType === 'postgres') {
    // ── Legacy Production: Neon PostgreSQL ──
    console.log('[DB] Using Neon PostgreSQL —', dbUrl?.substring(0, 30) + '...')
    return new PrismaClient({ log: logLevel })
  }

  // ── Local development: SQLite ──
  console.log('[DB] Using SQLite —', dbUrl || '(no URL)')
  return new PrismaClient({
    log: logLevel,
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  })
}

function getDb(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
  }
  return globalForPrisma.prisma
}

// Lazy proxy: forwards all property accesses to the real PrismaClient
// which is created on first use (after .env is loaded).
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const real = getDb()
    const value = Reflect.get(real, prop, receiver)
    if (typeof value === 'function') {
      return value.bind(real)
    }
    return value
  },
})

/** Export provider info so other modules can adapt behavior */
const _dbType = _getDbType()
export const isSQLite = _dbType === 'sqlite'
export const isPostgreSQL = _dbType === 'postgres'
export const isTurso = _dbType === 'libsql'

// ═══════════════════════════════════════════════════════════
// POSTGRESQL COMPATIBILITY HELPERS
// ═══════════════════════════════════════════════════════════
// When running on PostgreSQL (Neon), certain Prisma operations
// need raw SQL workarounds. On SQLite/Turso, standard Prisma is used.
// ═══════════════════════════════════════════════════════════

/**
 * PostgreSQL-compatible replacement for Prisma's updateMany().
 * When running on PostgreSQL, uses raw SQL instead.
 * When running on SQLite/Turso, falls back to normal Prisma updateMany.
 *
 * @param table - Prisma model name (e.g. 'Participation', 'Player')
 * @param whereClauses - Array of { column, operator, value } conditions
 * @param data - Object of { column: value } to update
 * @returns Number of rows affected
 */
export async function neonUpdateMany(
  table: string,
  whereClauses: Array<{ column: string; operator: '=' | 'IN' | 'NOT NULL' | 'IS NULL'; value?: string | string[] }>,
  data: Record<string, unknown>
): Promise<number> {
  if (_dbType !== 'postgres') {
    throw new Error('neonUpdateMany should only be called for PostgreSQL. Use db.model.updateMany for SQLite/Turso.');
  }

  // Build SET clause
  const setParts: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  for (const [col, val] of Object.entries(data)) {
    if (val === null) {
      setParts.push(`"${col}" = NULL`);
    } else if (typeof val === 'string') {
      params.push(val);
      setParts.push(`"${col}" = $${paramIdx++}`);
    } else if (typeof val === 'number') {
      params.push(val);
      setParts.push(`"${col}" = $${paramIdx++}`);
    } else if (typeof val === 'boolean') {
      params.push(val);
      setParts.push(`"${col}" = $${paramIdx++}`);
    } else {
      params.push(val);
      setParts.push(`"${col}" = $${paramIdx++}`);
    }
  }

  // Build WHERE clause
  const whereParts: string[] = [];
  for (const wc of whereClauses) {
    if (wc.operator === '=' && wc.value !== undefined) {
      params.push(wc.value);
      whereParts.push(`"${wc.column}" = $${paramIdx++}`);
    } else if (wc.operator === 'IN' && Array.isArray(wc.value) && wc.value.length > 0) {
      const placeholders = wc.value.map(() => `$${paramIdx++}`).join(', ');
      params.push(...wc.value);
      whereParts.push(`"${wc.column}" IN (${placeholders})`);
    } else if (wc.operator === 'NOT NULL') {
      whereParts.push(`"${wc.column}" IS NOT NULL`);
    } else if (wc.operator === 'IS NULL') {
      whereParts.push(`"${wc.column}" IS NULL`);
    }
  }

  const sql = `UPDATE "${table}" SET ${setParts.join(', ')}${whereParts.length > 0 ? ' WHERE ' + whereParts.join(' AND ') : ''}`;
  return db.$executeRawUnsafe(sql, ...params);
}

/**
 * PostgreSQL-compatible replacement for Prisma's deleteMany().
 * When running on PostgreSQL, uses raw SQL instead.
 * When running on SQLite/Turso, falls back to normal Prisma deleteMany.
 *
 * IMPORTANT: When called inside a neonTransaction(), pass the transaction client (tx)
 * as the 3rd argument so the delete runs WITHIN the transaction.
 * If no tx is provided, uses the global db client (outside transaction).
 *
 * @param table - Prisma model name (e.g. 'TeamPlayer', 'Match')
 * @param whereClauses - Array of { column, operator, value } conditions
 * @param tx - Optional PrismaClient transaction client to run within a transaction
 * @returns Number of rows deleted
 */
export async function neonDeleteMany(
  table: string,
  whereClauses: Array<{ column: string; operator: '=' | 'IN' | 'NOT NULL' | 'IS NULL'; value?: string | string[] }>,
  tx?: PrismaClient
): Promise<number> {
  if (_dbType !== 'postgres') {
    throw new Error('neonDeleteMany should only be called for PostgreSQL. Use db.model.deleteMany for SQLite/Turso.');
  }

  const params: unknown[] = [];
  let paramIdx = 1;
  const whereParts: string[] = [];

  for (const wc of whereClauses) {
    if (wc.operator === '=' && wc.value !== undefined && typeof wc.value === 'string') {
      params.push(wc.value);
      whereParts.push(`"${wc.column}" = $${paramIdx++}`);
    } else if (wc.operator === 'IN' && Array.isArray(wc.value) && wc.value.length > 0) {
      const placeholders = wc.value.map(() => `$${paramIdx++}`).join(', ');
      params.push(...wc.value);
      whereParts.push(`"${wc.column}" IN (${placeholders})`);
    } else if (wc.operator === 'NOT NULL') {
      whereParts.push(`"${wc.column}" IS NOT NULL`);
    } else if (wc.operator === 'IS NULL') {
      whereParts.push(`"${wc.column}" IS NULL`);
    }
  }

  const sql = `DELETE FROM "${table}"${whereParts.length > 0 ? ' WHERE ' + whereParts.join(' AND ') : ''}`;
  const client = tx || db;
  return client.$executeRawUnsafe(sql, ...params);
}

/**
 * PostgreSQL-compatible replacement for Prisma's createMany().
 * When running on PostgreSQL, creates rows one by one sequentially.
 * When running on SQLite/Turso, falls back to normal Prisma createMany.
 *
 * @param model - Prisma model delegate (e.g. db.teamPlayer)
 * @param data - Array of data objects to create
 * @returns Count of created rows
 */
export async function neonCreateMany<T>(
  model: { create: (args: { data: T }) => Promise<unknown> },
  data: T[]
): Promise<number> {
  if (_dbType !== 'postgres') {
    throw new Error('neonCreateMany should only be called for PostgreSQL. Use db.model.createMany for SQLite/Turso.');
  }

  let count = 0;
  for (const item of data) {
    await model.create({ data: item });
    count++;
  }
  return count;
}

/**
 * PostgreSQL-compatible replacement for Prisma's $transaction().
 * For PostgreSQL (Neon): uses extended timeout (30s) to prevent
 * "Transaction not found" errors on serverless with many sequential queries.
 * For SQLite/Turso: uses default timeout.
 */
export async function neonTransaction<T>(
  fn: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  if (_dbType !== 'postgres') {
    return db.$transaction(fn as never) as Promise<T>;
  }
  // PostgreSQL (Neon): use extended timeout to prevent transaction expiry
  // Neon serverless can have cold starts and high latency; default 5s is too short
  return db.$transaction(fn as never, {
    maxWait: 10000,   // Max time to acquire a connection from the pool (10s)
    timeout: 30000,   // Max time for the entire transaction (30s)
  }) as Promise<T>;
}
