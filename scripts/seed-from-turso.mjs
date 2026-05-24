/**
 * ⚠️  SEED SCRIPT v3: Turso (libSQL) → Local SQLite
 * 
 * READ ONLY dari Turso — tidak ada write ke Turso.
 * Menulis ke SQLite lokal menggunakan Prisma Client.
 * 
 * Database Turso sudah LIVE di Vercel, jadi script ini HANYA MEMBACA.
 * Tidak ada operasi write/push/alter ke Turso.
 * 
 * Key differences handled:
 * - Turso timestamps are epoch milliseconds → converted to ISO strings for Prisma
 * - Turso booleans are 0/1 integers → converted to true/false
 * - Turso has extra columns (totalLosses, championClubId, etc.) → skipped
 * - BigInt values → converted to Number
 * 
 * Usage: bun run scripts/seed-from-turso.mjs
 */

import { createClient } from '@libsql/client';
import { PrismaClient } from '@prisma/client';

// ─── Turso connection (READ ONLY) ───
const TURSO_URL = process.env.TURSO_DATABASE_URL || 'libsql://tarkam-qhairulalamsyah-beep.aws-ap-northeast-1.turso.io';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || '';

const turso = createClient({
  url: TURSO_URL,
  authToken: TURSO_TOKEN,
});

// ─── SQLite connection (WRITE) ───
const prisma = new PrismaClient();

// Columns that exist in Turso but NOT in our local Prisma schema (removed during Liga IDM cleanup)
const SKIP_COLUMNS = {
  'Player': ['totalLosses'],
  'Season': ['championClubId', 'championClubSnapshot'],
};

// Boolean columns per table (Turso stores as 0/1, Prisma expects true/false)
const BOOLEAN_COLUMNS = {
  'Player': ['isActive'],
  'Team': ['isWinner'],
  'Skin': ['isActive'],
  'Sponsor': ['isActive'],
  'SponsoredPrize': ['isActive'],
  'SponsorBanner': ['isActive'],
  'CmsSection': ['isActive'],
  'CmsCard': ['isActive'],
  'Achievement': ['isActive'],
  'MarketplaceItem': ['isPremium', 'isActive'],
  'WaRegistration': [], // status is string
  'WhatsAppBot': ['autoReply'],
  'WhatsAppCommand': ['isActive'],
  'WhatsAppLog': ['isError'],
  'Participation': ['isMvp', 'isWinner'],
  'Account': [], // donorBadgeCount is Int
};

// DateTime columns that might be stored as epoch millis in Turso
const DATETIME_COLUMNS = {
  'Player': ['createdAt', 'updatedAt'],
  'Season': ['startDate', 'endDate', 'createdAt', 'updatedAt'],
  'Tournament': ['scheduledAt', 'finalizedAt', 'completedAt', 'createdAt', 'updatedAt'],
  'Club': [],
  'ClubProfile': ['createdAt', 'updatedAt'],
  'ClubMember': ['joinedAt', 'leftAt'],
  'Admin': ['sessionInvalidatedAt', 'createdAt', 'updatedAt'],
  'Account': ['lastLoginAt', 'sessionInvalidatedAt', 'createdAt', 'updatedAt'],
  'Skin': ['createdAt', 'updatedAt'],
  'PlayerSkin': ['expiresAt', 'createdAt'],
  'Sponsor': ['createdAt', 'updatedAt'],
  'SponsorBanner': ['startDate', 'endDate', 'createdAt'],
  'CmsSection': ['createdAt', 'updatedAt'],
  'CmsCard': ['createdAt', 'updatedAt'],
  'CmsSetting': ['updatedAt'],
  'Donation': ['createdAt'],
  'Match': ['scheduledAt', 'completedAt', 'createdAt'],
  'Participation': ['createdAt'],
  'PlayerPoint': ['createdAt'],
  'PlayerAchievement': ['earnedAt'],
  'TournamentPrize': ['createdAt'],
  'TournamentSponsor': ['createdAt'],
  'SponsoredPrize': ['createdAt'],
  'WaRegistration': ['expiresAt', 'createdAt', 'updatedAt'],
  'WhatsAppBot': ['lastConnectedAt', 'createdAt', 'updatedAt'],
  'WhatsAppLog': ['createdAt'],
  'MarketplaceItem': ['createdAt', 'updatedAt'],
  'AuditLog': ['createdAt'],
  'PlayerSeasonStats': ['createdAt'],
};

function convertValue(value, colName, tableName) {
  if (value === null || value === undefined) return undefined;
  
  // BigInt → Number
  if (typeof value === 'bigint') {
    value = Number(value);
  }
  
  // Boolean conversion
  const boolCols = BOOLEAN_COLUMNS[tableName] || [];
  if (boolCols.includes(colName)) {
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value === '1' || value === 'true';
    return Boolean(value);
  }
  
  // DateTime conversion (epoch millis → ISO string)
  const dtCols = DATETIME_COLUMNS[tableName] || [];
  if (dtCols.includes(colName)) {
    if (typeof value === 'number') {
      // Epoch milliseconds to ISO string
      return new Date(value).toISOString();
    }
    if (typeof value === 'string' && /^\d{10,13}$/.test(value.trim())) {
      // String epoch to ISO
      const ms = parseInt(value.trim());
      return new Date(ms).toISOString();
    }
    // Already an ISO string or other format — keep as is
    return value;
  }
  
  return value;
}

function rowToPrismaData(row, columns, tableName, skipFields = []) {
  const data = {};
  const skipCols = SKIP_COLUMNS[tableName] || [];
  
  for (const col of columns) {
    // Skip columns that don't exist in our local schema
    if (skipCols.includes(col)) continue;
    // Skip deferred FK fields
    if (skipFields.includes(col)) continue;
    
    const value = row[col];
    if (value !== null && value !== undefined) {
      data[col] = convertValue(value, col, tableName);
    }
  }
  return data;
}

async function readTable(table) {
  const result = await turso.execute(`SELECT * FROM "${table}"`);
  const columns = result.columns;
  const rows = result.rows.map(row => {
    const obj = {};
    for (const col of columns) {
      obj[col] = row[col];
    }
    return obj;
  });
  return { rows, columns };
}

// Map table names to Prisma model accessor names
const MODEL_MAP = {
  'Player': 'player',
  'Season': 'season',
  'Tournament': 'tournament',
  'Team': 'team',
  'TeamPlayer': 'teamPlayer',
  'Match': 'match',
  'Participation': 'participation',
  'Donation': 'donation',
  'TournamentPrize': 'tournamentPrize',
  'Account': 'account',
  'Skin': 'skin',
  'PlayerSkin': 'playerSkin',
  'Admin': 'admin',
  'ClubProfile': 'clubProfile',
  'Club': 'club',
  'ClubMember': 'clubMember',
  'AuditLog': 'auditLog',
  'CmsSection': 'cmsSection',
  'CmsCard': 'cmsCard',
  'CmsSetting': 'cmsSetting',
  'PlayerPoint': 'playerPoint',
  'Achievement': 'achievement',
  'PlayerAchievement': 'playerAchievement',
  'Sponsor': 'sponsor',
  'TournamentSponsor': 'tournamentSponsor',
  'SponsoredPrize': 'sponsoredPrize',
  'SponsorBanner': 'sponsorBanner',
  'MarketplaceItem': 'marketplaceItem',
  'WaRegistration': 'waRegistration',
  'WhatsAppBot': 'whatsAppBot',
  'WhatsAppCommand': 'whatsAppCommand',
  'WhatsAppLog': 'whatsAppLog',
  'PlayerSeasonStats': 'playerSeasonStats',
};

async function seedTable(table, opts = {}) {
  const { skipFields = [] } = opts;
  
  try {
    const { rows, columns } = await readTable(table);
    
    if (rows.length === 0) {
      console.log(`  ⏭️  ${table}: 0 rows (skipped)`);
      return { total: 0, inserted: 0, rows: [], columns };
    }
    
    const prismaModel = MODEL_MAP[table];
    if (!prismaModel || !prisma[prismaModel]) {
      console.log(`  ⚠️  No Prisma model for table: ${table}`);
      return { total: rows.length, inserted: 0, rows, columns };
    }
    
    let inserted = 0;
    let errors = 0;
    for (const row of rows) {
      try {
        const data = rowToPrismaData(row, columns, table, skipFields);
        await prisma[prismaModel].create({ data });
        inserted++;
      } catch (e) {
        errors++;
        if (errors <= 3) {
          // Show first 3 errors in detail
          console.log(`  ⚠️  ${table} row failed: ${e.message.substring(0, 200)}`);
          // Show the data that failed for debugging
          const data = rowToPrismaData(row, columns, table, skipFields);
          console.log(`     Data keys: ${Object.keys(data).join(', ')}`);
          if (e.message.includes('Unknown field')) {
            const match = e.message.match(/Unknown field `(\w+)`/);
            if (match) console.log(`     → Unknown field: ${match[1]}`);
          }
        }
      }
    }
    
    if (errors > 3) {
      console.log(`  ⚠️  ... and ${errors - 3} more errors`);
    }
    
    console.log(`  ✅ ${table}: ${inserted}/${rows.length} rows seeded${skipFields.length ? ' (deferred FKs: ' + skipFields.join(', ') + ')' : ''}`);
    return { total: rows.length, inserted, rows, columns };
    
  } catch (e) {
    console.log(`  ❌ ${table} error: ${e.message.substring(0, 200)}`);
    return { total: 0, inserted: 0, rows: [], columns: [] };
  }
}

async function main() {
  console.log('🔄 Connecting to Turso (READ ONLY)...');
  const testResult = await turso.execute('SELECT 1 as test');
  console.log('✅ Connected to Turso (READ ONLY mode — safe, no writes to Turso)');
  console.log(`   URL: ${TURSO_URL}`);
  
  console.log('🔄 Connecting to SQLite...');
  await prisma.$connect();
  console.log('✅ Connected to SQLite');
  
  // ─── Step 1: Clear ALL SQLite tables (reverse order for FK) ───
  console.log('\n🗑️  Clearing SQLite tables...');
  const allModels = [
    'whatsAppLog', 'marketplaceItem', 'waRegistration', 'auditLog',
    'match', 'teamPlayer', 'playerAchievement',
    'playerPoint', 'participation', 'team', 'donation', 'whatsAppCommand',
    'playerSeasonStats', 'playerSkin', 'cmsCard', 'sponsorBanner', 'sponsoredPrize',
    'tournamentSponsor', 'tournamentPrize', 'tournament', 'clubMember', 'club',
    'account', 'whatsAppBot', 'cmsSetting', 'cmsSection', 'achievement',
    'admin', 'clubProfile', 'sponsor', 'skin', 'season', 'player',
  ];
  
  for (const model of allModels) {
    try {
      if (prisma[model] && prisma[model].deleteMany) {
        await prisma[model].deleteMany({});
      }
    } catch (e) { /* ignore */ }
  }
  console.log('  ✓ All tables cleared');
  
  // ─── Step 2: Seed in dependency order ───
  console.log('\n📥 Phase 1: Seeding base entities (no circular FK)...');
  
  await seedTable('Player');
  await seedTable('Skin');
  await seedTable('Sponsor');
  await seedTable('ClubProfile');
  await seedTable('Admin');
  await seedTable('Achievement');
  await seedTable('CmsSection');
  await seedTable('CmsSetting');
  await seedTable('WhatsAppBot');
  
  // ─── Season has FK → Player (championPlayerId, sultanPlayerId) ───
  // Also skip championClubId/championClubSnapshot which don't exist in local schema
  console.log('\n📥 Phase 2: Seeding Season (deferred FKs to Player)...');
  const seasonResult = await seedTable('Season', {
    skipFields: ['championPlayerId', 'championPlayerPoints', 'championPlayerSnapshot', 'championSquad', 'sultanPlayerId'],
  });
  
  // ─── Now seed Club (depends on ClubProfile + Season, both now exist) ───
  console.log('\n📥 Phase 3: Seeding Club (depends on ClubProfile + Season)...');
  await seedTable('Club');
  
  // ─── Update Season with deferred FK fields ───
  console.log('\n📥 Phase 4: Updating Season with champion FK fields...');
  if (seasonResult.rows && seasonResult.rows.length > 0) {
    let updated = 0;
    const fkFields = ['championPlayerId', 'championPlayerPoints', 'championPlayerSnapshot', 'championSquad', 'sultanPlayerId'];
    for (const row of seasonResult.rows) {
      try {
        const id = row.id;
        const updateData = {};
        for (const field of fkFields) {
          if (row[field] !== null && row[field] !== undefined) {
            updateData[field] = convertValue(row[field], field, 'Season');
          }
        }
        if (Object.keys(updateData).length > 0) {
          await prisma.season.update({ where: { id }, data: updateData });
          updated++;
        }
      } catch (e) {
        console.log(`  ⚠️  Season update failed for ${row.id}: ${e.message.substring(0, 150)}`);
      }
    }
    console.log(`  ✅ Season FK updates: ${updated} rows updated`);
  }
  
  // ─── Phase 5: Seed everything else ───
  console.log('\n📥 Phase 5: Seeding remaining tables...');
  
  await seedTable('Account');
  await seedTable('ClubMember');
  await seedTable('Tournament');
  await seedTable('TournamentPrize');
  await seedTable('TournamentSponsor');
  await seedTable('SponsoredPrize');
  await seedTable('SponsorBanner');
  await seedTable('CmsCard');
  await seedTable('PlayerSkin');
  await seedTable('PlayerSeasonStats');
  await seedTable('WhatsAppCommand');
  await seedTable('Donation');
  await seedTable('Team');
  await seedTable('TeamPlayer');
  await seedTable('Match');
  await seedTable('Participation');
  await seedTable('PlayerPoint');
  await seedTable('PlayerAchievement');
  await seedTable('AuditLog');
  await seedTable('WaRegistration');
  await seedTable('MarketplaceItem');
  await seedTable('WhatsAppLog');
  
  // ─── Verify counts ───
  console.log('\n📊 Verification: Row counts in SQLite...');
  for (const [name, model] of Object.entries(MODEL_MAP)) {
    try {
      if (prisma[model] && prisma[model].count) {
        const count = await prisma[model].count();
        if (count > 0) console.log(`  ${name}: ${count} rows`);
      }
    } catch (e) { /* ignore */ }
  }
  
  // ─── Cleanup ───
  turso.close();
  await prisma.$disconnect();
  console.log('\n✅ All connections closed. Turso was NOT modified (READ ONLY).');
  console.log('✅ Local SQLite has been seeded from Turso production data.');
}

main().catch(e => {
  console.error('❌ FATAL:', e);
  process.exit(1);
});
