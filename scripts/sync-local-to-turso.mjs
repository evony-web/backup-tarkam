/**
 * ⚠️  SYNC SCRIPT: Local SQLite → Turso (libSQL)
 *
 * Reads ALL data from local SQLite (via Prisma) and writes to Turso.
 * Used to populate Turso with missing data from local development DB.
 *
 * Rules:
 * - SKIP tables: Player, Season, Account, ClubProfile, AuditLog (already correct in Turso)
 * - For tables with partial data: clear Turso data first, then insert from local
 * - For empty tables: INSERT all rows from local
 *
 * Key conversions:
 * - Date objects → ISO strings for Turso
 * - Boolean true/false → 1/0 for Turso
 * - BigInt → Number
 *
 * Usage: bun run scripts/sync-local-to-turso.mjs
 */

import { createClient } from '@libsql/client';
import { PrismaClient } from '@prisma/client';

// ─── Turso connection (WRITE) ───
const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error('❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN env vars');
  process.exit(1);
}

const turso = createClient({
  url: TURSO_URL,
  authToken: TURSO_TOKEN,
});

// ─── SQLite connection (READ) ───
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:/home/z/my-project/db/custom.db',
    },
  },
});

// Tables that already have correct data in Turso — DO NOT TOUCH
const SKIP_TABLES = ['Player', 'Season', 'Account', 'ClubProfile', 'AuditLog'];

// Boolean columns per table (Prisma returns true/false, Turso expects 1/0)
const BOOLEAN_COLUMNS = {
  Player: ['isActive'],
  Team: ['isWinner'],
  Skin: ['isActive'],
  Sponsor: ['isActive'],
  SponsoredPrize: ['isActive'],
  SponsorBanner: ['isActive'],
  CmsSection: ['isActive'],
  CmsCard: ['isActive'],
  Achievement: ['isActive'],
  MarketplaceItem: ['isPremium', 'isActive'],
  Participation: ['isMvp', 'isWinner'],
  WhatsAppBot: ['autoReply'],
  WhatsAppCommand: ['isActive'],
  WhatsAppLog: ['isError'],
};

// DateTime columns per table (Prisma returns Date objects, Turso expects ISO strings)
const DATETIME_COLUMNS = {
  Player: ['createdAt', 'updatedAt'],
  Season: ['startDate', 'endDate', 'createdAt', 'updatedAt'],
  Tournament: ['scheduledAt', 'finalizedAt', 'completedAt', 'createdAt', 'updatedAt'],
  Team: [],
  TeamPlayer: [],
  Match: ['scheduledAt', 'completedAt', 'createdAt'],
  Participation: ['createdAt'],
  Donation: ['createdAt'],
  TournamentPrize: ['createdAt'],
  Account: ['lastLoginAt', 'sessionInvalidatedAt', 'createdAt', 'updatedAt'],
  Skin: ['createdAt', 'updatedAt'],
  PlayerSkin: ['expiresAt', 'createdAt'],
  Admin: ['sessionInvalidatedAt', 'createdAt', 'updatedAt'],
  ClubProfile: ['createdAt', 'updatedAt'],
  Club: [],
  ClubMember: ['joinedAt', 'leftAt'],
  AuditLog: ['createdAt'],
  CmsSection: ['createdAt', 'updatedAt'],
  CmsCard: ['createdAt', 'updatedAt'],
  CmsSetting: ['updatedAt'],
  PlayerPoint: ['createdAt'],
  Achievement: ['createdAt', 'updatedAt'],
  PlayerAchievement: ['earnedAt'],
  Sponsor: ['createdAt', 'updatedAt'],
  TournamentSponsor: ['createdAt'],
  SponsoredPrize: ['createdAt'],
  SponsorBanner: ['startDate', 'endDate', 'createdAt'],
  MarketplaceItem: ['createdAt', 'updatedAt'],
  WaRegistration: ['expiresAt', 'createdAt', 'updatedAt'],
  WhatsAppBot: ['lastConnectedAt', 'createdAt', 'updatedAt'],
  WhatsAppCommand: ['createdAt', 'updatedAt'],
  WhatsAppLog: ['createdAt'],
  PlayerSeasonStats: ['createdAt'],
};

// Map Prisma model names to table names
const MODEL_TO_TABLE = {
  player: 'Player',
  season: 'Season',
  tournament: 'Tournament',
  team: 'Team',
  teamPlayer: 'TeamPlayer',
  match: 'Match',
  participation: 'Participation',
  donation: 'Donation',
  tournamentPrize: 'TournamentPrize',
  account: 'Account',
  skin: 'Skin',
  playerSkin: 'PlayerSkin',
  admin: 'Admin',
  clubProfile: 'ClubProfile',
  club: 'Club',
  clubMember: 'ClubMember',
  auditLog: 'AuditLog',
  cmsSection: 'CmsSection',
  cmsCard: 'CmsCard',
  cmsSetting: 'CmsSetting',
  playerPoint: 'PlayerPoint',
  achievement: 'Achievement',
  playerAchievement: 'PlayerAchievement',
  sponsor: 'Sponsor',
  tournamentSponsor: 'TournamentSponsor',
  sponsoredPrize: 'SponsoredPrize',
  sponsorBanner: 'SponsorBanner',
  marketplaceItem: 'MarketplaceItem',
  waRegistration: 'WaRegistration',
  whatsAppBot: 'WhatsAppBot',
  whatsAppCommand: 'WhatsAppCommand',
  whatsAppLog: 'WhatsAppLog',
  playerSeasonStats: 'PlayerSeasonStats',
};

// Insertion order respecting FK constraints
// Tables in SKIP_TABLES are excluded
const SYNC_ORDER = [
  // Phase 1: Base entities that depend on already-existing tables
  'Tournament',    // depends on Season (exists in Turso)
  'Skin',          // standalone
  'Sponsor',       // standalone
  'Achievement',   // standalone
  'CmsSection',    // standalone
  'CmsSetting',    // standalone
  'WhatsAppBot',   // standalone

  // Phase 2: Depends on Phase 1 + existing Turso tables
  'Team',                  // depends on Tournament
  'Club',                  // depends on ClubProfile, Season (both exist in Turso)
  'TournamentPrize',       // depends on Tournament
  'CmsCard',               // depends on CmsSection
  'TournamentSponsor',     // depends on Tournament, Sponsor
  'SponsoredPrize',        // depends on Tournament, Sponsor
  'SponsorBanner',         // depends on Sponsor

  // Phase 3: Depends on Phase 2
  'TeamPlayer',            // depends on Team, Player (Player exists in Turso)
  'ClubMember',            // depends on ClubProfile, Player (both exist in Turso)
  'PlayerSkin',            // depends on Account, Skin (Account exists in Turso)

  // Phase 4: Depends on Phase 3
  'Match',                 // depends on Tournament, Team, Player
  'Participation',         // depends on Player, Tournament
  'Donation',              // depends on Tournament, Season, Player
  'PlayerAchievement',     // depends on Player, Achievement, Tournament
  'PlayerSeasonStats',     // depends on Player, Season

  // Phase 5: Depends on Phase 4
  'PlayerPoint',           // depends on Player, Tournament, Match, Season

  // Phase 6: Remaining
  'Admin',                 // standalone
  'WaRegistration',        // depends on Tournament
  'MarketplaceItem',       // depends on Player
  'WhatsAppCommand',       // standalone
  'WhatsAppLog',           // standalone
];

// ─── Get Turso table column info ───
async function getTursoColumns(tableName) {
  const result = await turso.execute(`PRAGMA table_info("${tableName}")`);
  return result.rows.map(row => row.name);
}

// ─── Convert a Prisma value to Turso-compatible value ───
function convertValue(value, colName, tableName) {
  if (value === null || value === undefined) return null;

  // BigInt → Number
  if (typeof value === 'bigint') {
    return Number(value);
  }

  // Boolean conversion: true/false → 1/0
  const boolCols = BOOLEAN_COLUMNS[tableName] || [];
  if (boolCols.includes(colName)) {
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'number') return value !== 0 ? 1 : 0;
    if (typeof value === 'string') return (value === '1' || value === 'true') ? 1 : 0;
    return Boolean(value) ? 1 : 0;
  }

  // DateTime conversion: Date object → ISO string
  const dtCols = DATETIME_COLUMNS[tableName] || [];
  if (dtCols.includes(colName)) {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'string') {
      return value; // Already a string, keep as is
    }
    if (typeof value === 'number') {
      return new Date(value).toISOString();
    }
    return value;
  }

  return value;
}

// ─── Read all data from local SQLite via Prisma ───
async function readLocalData(modelName) {
  try {
    if (prisma[modelName] && prisma[modelName].findMany) {
      return await prisma[modelName].findMany({});
    }
  } catch (e) {
    console.log(`  ⚠️  ${modelName}: ${e.message.substring(0, 100)}`);
  }
  return [];
}

// ─── Clear a Turso table ───
async function clearTursoTable(tableName) {
  try {
    await turso.execute(`DELETE FROM "${tableName}"`);
  } catch (e) {
    // ignore - table might be empty
  }
}

// ─── Get count of a Turso table ───
async function getTursoCount(tableName) {
  try {
    const result = await turso.execute(`SELECT COUNT(*) as cnt FROM "${tableName}"`);
    return Number(result.rows[0].cnt);
  } catch (e) {
    return -1;
  }
}

// ─── Insert a batch of rows into Turso ───
async function insertBatch(tableName, rows, tursoColumns) {
  if (rows.length === 0) return { inserted: 0, errors: 0 };

  let inserted = 0;
  let errors = 0;
  const errorMessages = [];

  // Filter columns: only use columns that exist in Turso
  const validColumns = (cols) => cols.filter(c => tursoColumns.includes(c));

  for (const row of rows) {
    try {
      const data = {};
      for (const [key, value] of Object.entries(row)) {
        if (!tursoColumns.includes(key)) continue; // Skip columns not in Turso
        data[key] = convertValue(value, key, tableName);
      }

      const columns = Object.keys(data);
      if (columns.length === 0) continue;

      const values = Object.values(data);
      const placeholders = columns.map(() => '?').join(', ');
      const colNames = columns.map(c => `"${c}"`).join(', ');

      await turso.execute({
        sql: `INSERT INTO "${tableName}" (${colNames}) VALUES (${placeholders})`,
        args: values,
      });
      inserted++;
    } catch (e) {
      errors++;
      if (errorMessages.length < 3) {
        errorMessages.push(`${tableName} row failed: ${e.message.substring(0, 200)}`);
      }
    }
  }

  if (errorMessages.length > 0) {
    for (const msg of errorMessages) {
      console.log(`  ⚠️  ${msg}`);
    }
    if (errors > 3) {
      console.log(`  ⚠️  ... and ${errors - 3} more errors`);
    }
  }

  return { inserted, errors };
}

// ─── Main ───
async function main() {
  console.log('🔄 Sync Local SQLite → Turso');
  console.log('═'.repeat(60));

  // Test connections
  console.log('\n📡 Testing connections...');
  const tursoTest = await turso.execute('SELECT 1 as test');
  console.log(`  ✅ Turso connected: ${TURSO_URL}`);

  await prisma.$connect();
  console.log('  ✅ SQLite connected: file:/home/z/my-project/db/custom.db');

  // Get Turso column info for all tables we'll sync
  console.log('\n📋 Fetching Turso table schemas...');
  const tursoSchemas = {};
  for (const tableName of SYNC_ORDER) {
    if (SKIP_TABLES.includes(tableName)) continue;
    tursoSchemas[tableName] = await getTursoColumns(tableName);
  }

  // ─── Pre-sync: Report current state ───
  console.log('\n📊 Current state (Local → Turso):');
  console.log('─'.repeat(60));
  for (const tableName of SYNC_ORDER) {
    const modelName = Object.entries(MODEL_TO_TABLE).find(([_, t]) => t === tableName)?.[0];
    if (!modelName) continue;

    const localData = await readLocalData(modelName);
    const tursoCount = await getTursoCount(tableName);
    const localCount = localData.length;
    const skip = SKIP_TABLES.includes(tableName);
    const action = skip ? 'SKIP' : (tursoCount === 0 ? 'INSERT' : 'CLEAR+INSERT');
    console.log(`  ${tableName.padEnd(22)} Local: ${String(localCount).padStart(4)}  Turso: ${String(tursoCount).padStart(4)}  → ${action}`);
  }

  // ─── Sync each table ───
  console.log('\n🔄 Syncing tables...');
  console.log('═'.repeat(60));

  const results = {};

  for (const tableName of SYNC_ORDER) {
    if (SKIP_TABLES.includes(tableName)) {
      console.log(`  ⏭️  ${tableName}: SKIPPED (protected)`);
      continue;
    }

    const modelName = Object.entries(MODEL_TO_TABLE).find(([_, t]) => t === tableName)?.[0];
    if (!modelName) {
      console.log(`  ⚠️  ${tableName}: No Prisma model mapping found`);
      continue;
    }

    // Read from local
    const localData = await readLocalData(modelName);

    if (localData.length === 0) {
      console.log(`  ⏭️  ${tableName}: 0 rows in local (skipped)`);
      results[tableName] = { local: 0, inserted: 0, errors: 0 };
      continue;
    }

    // Check Turso count
    const tursoCount = await getTursoCount(tableName);

    // Clear existing data if any
    if (tursoCount > 0) {
      console.log(`  🗑️  ${tableName}: Clearing ${tursoCount} existing rows...`);
      await clearTursoTable(tableName);
    }

    // Get Turso columns
    const tursoColumns = tursoSchemas[tableName] || [];

    // Insert
    const { inserted, errors } = await insertBatch(tableName, localData, tursoColumns);
    results[tableName] = { local: localData.length, inserted, errors };

    const status = errors === 0 ? '✅' : '⚠️';
    console.log(`  ${status} ${tableName}: ${inserted}/${localData.length} rows synced${errors > 0 ? ` (${errors} errors)` : ''}`);
  }

  // ─── Post-sync verification ───
  console.log('\n📊 Post-sync verification (Turso counts):');
  console.log('═'.repeat(60));
  for (const tableName of SYNC_ORDER) {
    const tursoCount = await getTursoCount(tableName);
    const r = results[tableName];
    const local = r ? r.local : (SKIP_TABLES.includes(tableName) ? '(protected)' : '?');
    console.log(`  ${tableName.padEnd(22)} Turso: ${String(tursoCount).padStart(4)}  (local: ${local})`);
  }

  // Also show SKIP tables
  console.log('\n🔒 Protected tables (NOT modified):');
  for (const tableName of SKIP_TABLES) {
    const tursoCount = await getTursoCount(tableName);
    console.log(`  ${tableName.padEnd(22)} Turso: ${tursoCount} rows (untouched)`);
  }

  // ─── Summary ───
  console.log('\n📈 Sync Summary:');
  console.log('═'.repeat(60));
  let totalInserted = 0;
  let totalErrors = 0;
  for (const [tableName, r] of Object.entries(results)) {
    totalInserted += r.inserted;
    totalErrors += r.errors;
  }
  console.log(`  Total rows inserted: ${totalInserted}`);
  console.log(`  Total errors: ${totalErrors}`);
  console.log(`  Protected tables: ${SKIP_TABLES.join(', ')}`);

  // ─── Cleanup ───
  turso.close();
  await prisma.$disconnect();
  console.log('\n✅ Sync complete! All connections closed.');
}

main().catch(e => {
  console.error('❌ FATAL:', e);
  process.exit(1);
});
