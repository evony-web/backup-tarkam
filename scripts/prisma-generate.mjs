/**
 * Prisma Generate Wrapper for Turso/libSQL deployments
 *
 * Problem: On Vercel, DATABASE_URL is set to "libsql://..." but
 * schema.prisma has provider = "sqlite" which doesn't accept libsql URLs.
 * This causes "prisma generate" (postinstall) to fail with a validation error.
 *
 * Solution: Before running "prisma generate", we temporarily override
 * DATABASE_URL to a valid SQLite file path. When using driver adapters,
 * Prisma doesn't actually use this URL for connections — the adapter
 * handles the real connection via TURSO_DATABASE_URL.
 *
 * Local dev is unaffected because DATABASE_URL is already "file:...".
 */

import { execSync } from 'child_process';

const dbUrl = process.env.DATABASE_URL || '';

// If DATABASE_URL is a libsql/http URL, override it with a dummy SQLite path
// for schema validation during prisma generate
if (dbUrl.startsWith('libsql://') || dbUrl.startsWith('http://') || dbUrl.startsWith('https://')) {
  console.log('[prisma-generate] DATABASE_URL is a libsql/http URL — overriding to file:./dev.db for schema validation');
  process.env.DATABASE_URL = 'file:./dev.db';
}

try {
  execSync('prisma generate', { stdio: 'inherit' });
} catch (e) {
  console.error('[prisma-generate] Failed to run prisma generate');
  process.exit(1);
}
