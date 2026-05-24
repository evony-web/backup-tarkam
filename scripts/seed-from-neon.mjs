/**
 * ⚠️  SEED SCRIPT v2: Neon PostgreSQL → SQLite
 * 
 * READ ONLY dari Neon — tidak ada write ke Neon.
 * Menulis ke SQLite lokal menggunakan Prisma Client.
 * 
 * Handles circular FK: Season→ClubProfile/Player, Club→Season
 * Strategy: Seed Season without FK fields first, then update after Club is seeded
 * 
 * Usage: node scripts/seed-from-neon.mjs
 */

import { Client } from 'pg';
import { PrismaClient } from '@prisma/client';

// ─── Neon connection (READ ONLY) ───
const NEON_URL = 'postgresql://neondb_owner:npg_gZNoJdCzhU51@ep-shy-shape-ao5szx5b-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pg = new Client({
  connectionString: NEON_URL,
  ssl: { rejectUnauthorized: false },
});

// ─── SQLite connection (WRITE) ───
const prisma = new PrismaClient();

function pgToPrismaField(pgCol) {
  return pgCol.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function rowToPrismaData(row, columns, skipFields = []) {
  const data = {};
  for (const col of columns) {
    const prismaField = pgToPrismaField(col);
    if (skipFields.includes(prismaField)) continue;
    const value = row[col];
    if (value !== null && value !== undefined) {
      data[prismaField] = value;
    }
  }
  return data;
}

async function readTable(table) {
  const res = await pg.query(`SELECT * FROM "${table}"`);
  const columns = res.fields.map(f => f.name);
  return { rows: res.rows, columns };
}

async function seedTable(table, opts = {}) {
  const { skipFields = [], rows: existingRows, columns: existingColumns } = opts;
  
  try {
    const { rows, columns } = existingRows ? { rows: existingRows, columns: existingColumns } : await readTable(table);
    
    if (rows.length === 0) {
      console.log(`  ⏭️  ${table}: 0 rows (skipped)`);
      return { total: 0, inserted: 0 };
    }
    
    let inserted = 0;
    for (const row of rows) {
      try {
        const data = rowToPrismaData(row, columns, skipFields);
        if (prisma[table] && prisma[table].create) {
          await prisma[table].create({ data });
          inserted++;
        }
      } catch (e) {
        if (opts.logErrors !== false) {
          console.log(`  ⚠️  ${table} row failed: ${e.message.substring(0, 120)}`);
        }
      }
    }
    
    console.log(`  ✅ ${table}: ${inserted}/${rows.length} rows seeded${skipFields.length ? ' (deferred FKs: ' + skipFields.join(', ') + ')' : ''}`);
    return { total: rows.length, inserted, rows, columns };
    
  } catch (e) {
    console.log(`  ❌ ${table} error: ${e.message.substring(0, 120)}`);
    return { total: 0, inserted: 0 };
  }
}

async function main() {
  console.log('🔄 Connecting to Neon PostgreSQL (READ ONLY)...');
  await pg.connect();
  await pg.query('SET TRANSACTION READ ONLY');
  console.log('✅ Connected to Neon (READ ONLY mode — safe, no writes to Neon)');
  
  console.log('🔄 Connecting to SQLite...');
  await prisma.$connect();
  console.log('✅ Connected to SQLite');
  
  // ─── Step 1: Clear ALL SQLite tables (reverse order for FK) ───
  console.log('\n🗑️  Clearing SQLite tables...');
  const allModels = [
    'WhatsAppLog', 'MarketplaceItem', 'WaRegistration', 'AuditLog',
    'PlayoffMatch', 'LeagueMatch', 'Match', 'TeamPlayer', 'PlayerAchievement',
    'PlayerPoint', 'Participation', 'Team', 'Donation', 'WhatsAppCommand',
    'PlayerSeasonStats', 'PlayerSkin', 'CmsCard', 'SponsorBanner', 'SponsoredPrize',
    'TournamentSponsor', 'TournamentPrize', 'Tournament', 'ClubMember', 'Club',
    'Account', 'WhatsAppBot', 'CmsSetting', 'CmsSection', 'Achievement',
    'Admin', 'ClubProfile', 'Sponsor', 'Skin', 'Season', 'Player',
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
  
  // ─── Season has FK → ClubProfile (championClubId) and Player (championPlayerId, sultanPlayerId) ───
  // Seed WITHOUT the FK fields first, then update later after Club is seeded
  console.log('\n📥 Phase 2: Seeding Season (deferred FKs to Club/Player)...');
  const seasonResult = await seedTable('Season', {
    skipFields: ['championClubId', 'championClubSnapshot', 'championPlayerId', 'championPlayerPoints', 'championPlayerSnapshot', 'championSquad', 'sultanPlayerId'],
  });
  
  // ─── Now seed Club (depends on ClubProfile + Season, both now exist) ───
  console.log('\n📥 Phase 3: Seeding Club (depends on ClubProfile + Season)...');
  await seedTable('Club');
  
  // ─── Update Season with deferred FK fields ───
  console.log('\n📥 Phase 4: Updating Season with champion FK fields...');
  if (seasonResult.rows) {
    let updated = 0;
    for (const row of seasonResult.rows) {
      try {
        const id = row.id;
        const updateData = {};
        const fkFields = ['championClubId', 'championClubSnapshot', 'championPlayerId', 'championPlayerPoints', 'championPlayerSnapshot', 'championSquad', 'sultanPlayerId'];
        for (const col of fkFields) {
          if (row[col] !== null && row[col] !== undefined) {
            updateData[col] = row[col];
          }
        }
        if (Object.keys(updateData).length > 0) {
          await prisma.season.update({ where: { id }, data: updateData });
          updated++;
        }
      } catch (e) {
        console.log(`  ⚠️  Season update failed for ${row.id}: ${e.message.substring(0, 100)}`);
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
  await seedTable('Participation');
  await seedTable('PlayerPoint');
  await seedTable('PlayerAchievement');
  await seedTable('TeamPlayer');
  await seedTable('Match');
  await seedTable('LeagueMatch');
  await seedTable('PlayoffMatch');
  await seedTable('AuditLog', { logErrors: false });
  await seedTable('WaRegistration');
  await seedTable('MarketplaceItem');
  await seedTable('WhatsAppLog');
  
  // ─── Verify counts ───
  console.log('\n📊 Verification: Row counts in SQLite...');
  const verifyModels = ['Player', 'Season', 'ClubProfile', 'Club', 'ClubMember', 'Tournament', 'Team', 'Match', 'Account', 'Admin', 'Participation', 'Donation', 'PlayerPoint', 'AuditLog', 'CmsSection', 'CmsCard', 'CmsSetting', 'Skin', 'PlayerSkin', 'Sponsor', 'SponsorBanner', 'MarketplaceItem', 'WhatsAppBot'];
  for (const model of verifyModels) {
    try {
      if (prisma[model] && prisma[model].count) {
        const count = await prisma[model].count();
        console.log(`  ${model}: ${count} rows`);
      }
    } catch (e) { /* ignore */ }
  }
  
  // ─── Cleanup ───
  await pg.end();
  await prisma.$disconnect();
  console.log('\n✅ All connections closed. Neon was NOT modified (READ ONLY).');
}

main().catch(e => {
  console.error('❌ FATAL:', e);
  process.exit(1);
});
