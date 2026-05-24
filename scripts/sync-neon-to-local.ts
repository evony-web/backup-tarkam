/**
 * sync-neon-to-local.ts
 * 
 * READ-ONLY: Reads all data from Neon PostgreSQL production database
 * and copies it to the local SQLite database.
 * 
 * Does NOT modify Neon in any way — only SELECT queries are used.
 * 
 * Usage: bun scripts/sync-neon-to-local.ts
 */

import { neon } from '@neondatabase/serverless';
import { PrismaClient } from '@prisma/client';

// ── Neon Connection (READ ONLY) ──
const NEON_URL = 'postgresql://neondb_owner:npg_gZNoJdCzhU51@ep-shy-shape-ao5szx5b-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const sql = neon(NEON_URL);

// ── Local SQLite Connection ──
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:/home/z/my-project/db/custom.db',
    },
  },
});

// ── Helper: query Neon using sql.query() and return rows ──
async function fetchTable(tableName: string): Promise<any[]> {
  console.log(`  Reading ${tableName}...`);
  try {
    const rows = await sql.query(`SELECT * FROM "${tableName}"`, []);
    console.log(`    → ${rows.length} rows`);
    return rows as any[];
  } catch (err: any) {
    console.warn(`  ⚠️  Error reading ${tableName}: ${err.message}`);
    return [];
  }
}

// ── Helper: convert PostgreSQL row to Prisma create input ──
function toPrismaInput(row: any): any {
  const input: any = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null) {
      input[key] = null;
    } else if (value instanceof Date) {
      input[key] = value.toISOString();
    } else {
      input[key] = value;
    }
  }
  return input;
}

// ── Insert order respecting foreign key dependencies ──
const INSERT_ORDER = [
  'Admin', 'ClubProfile', 'Player', 'Skin', 'Achievement',
  'Sponsor', 'CmsSection', 'CmsSetting', 'AuditLog',
  'WhatsAppBot', 'WhatsAppCommand',
  'Account', 'Season', 'Club', 'ClubMember', 'CmsCard', 'SponsorBanner',
  'Tournament', 'PlayerSkin',
  'Team', 'Participation', 'Donation', 'TournamentPrize',
  'TournamentSponsor', 'SponsoredPrize', 'PlayerAchievement',
  'TeamPlayer', 'LeagueMatch', 'PlayoffMatch', 'PlayerSeasonStats',
  'MarketplaceItem', 'WaRegistration',
  'Match', 'PlayerPoint', 'WhatsAppLog',
];

// ── Prisma model delegates mapped by table name ──
function getModelDelegate(tableName: string) {
  const prismaAny = prisma as any;
  const delegateName = tableName.charAt(0).toLowerCase() + tableName.slice(1);
  return prismaAny[delegateName];
}

async function main() {
  console.log('🔄 Syncing Neon PostgreSQL → Local SQLite');
  console.log('📖 READ-ONLY on Neon — no data will be modified on production\n');

  // ── Step 1: Read all data from Neon ──
  console.log('═══ Step 1: Reading from Neon PostgreSQL ═══');
  const allData: Record<string, any[]> = {};
  for (const table of INSERT_ORDER) {
    allData[table] = await fetchTable(table);
  }

  console.log('\n📊 Data summary from Neon:');
  let totalRows = 0;
  for (const [table, rows] of Object.entries(allData)) {
    if (rows.length > 0) console.log(`  ${table}: ${rows.length} rows`);
    totalRows += rows.length;
  }
  console.log(`  Total: ${totalRows} rows\n`);

  // ── Step 2: Clear local SQLite data (reverse dependency order) ──
  console.log('═══ Step 2: Clearing local SQLite ═══');
  const reverseOrder = [...INSERT_ORDER].reverse();
  for (const table of reverseOrder) {
    const delegate = getModelDelegate(table);
    if (delegate) {
      try {
        await delegate.deleteMany({});
        console.log(`  ✓ Cleared ${table}`);
      } catch (err: any) {
        console.warn(`  ⚠️  Error clearing ${table}: ${err.message}`);
      }
    }
  }

  // ── Step 3: Insert data into local SQLite ──
  console.log('\n═══ Step 3: Writing to local SQLite ═══');
  let insertedTotal = 0;
  let errorTotal = 0;

  for (const table of INSERT_ORDER) {
    const rows = allData[table];
    if (!rows || rows.length === 0) {
      console.log(`  ⊘ ${table}: no data to insert`);
      continue;
    }

    const delegate = getModelDelegate(table);
    if (!delegate) {
      console.warn(`  ⚠️  No Prisma delegate for ${table}`);
      continue;
    }

    let inserted = 0;
    let errors = 0;

    for (const row of rows) {
      try {
        const input = toPrismaInput(row);
        await delegate.create({ data: input });
        inserted++;
      } catch (err: any) {
        errors++;
        if (errors <= 2) {
          console.error(`  ❌ ${table} insert error: ${err.message?.substring(0, 200)}`);
        }
      }
    }

    insertedTotal += inserted;
    errorTotal += errors;
    const icon = errors === 0 ? '✅' : '⚠️';
    console.log(`  ${icon} ${table}: ${inserted}/${rows.length} inserted${errors > 0 ? ` (${errors} errors)` : ''}`);
  }

  console.log(`\n═══ Sync Complete ═══`);
  console.log(`  ✅ Inserted: ${insertedTotal} rows`);
  console.log(`  ❌ Errors: ${errorTotal} rows`);
  console.log(`  📖 Neon was NOT modified (read-only)\n`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
