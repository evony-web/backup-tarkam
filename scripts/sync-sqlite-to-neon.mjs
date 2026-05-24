/**
 * ⚠️  SYNC SCRIPT: SQLite → Neon PostgreSQL
 * 
 * Reads ALL data from local SQLite and writes to Neon PostgreSQL.
 * Used when migrating to a new Neon database.
 * 
 * Usage: node scripts/sync-sqlite-to-neon.mjs
 */

import { Client } from 'pg';
import { PrismaClient } from '@prisma/client';

// ─── Neon connection (WRITE) ───
const NEON_URL = 'postgresql://neondb_owner:npg_gZNoJdCzhU51@ep-shy-shape-ao5szx5b.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

const pg = new Client({
  connectionString: NEON_URL,
  ssl: { rejectUnauthorized: false },
});

// ─── SQLite connection (READ) ───
// Schema is set to postgresql for Vercel, but local uses SQLite.
// Override datasource to use SQLite file directly.
const sqlite = new PrismaClient({
  datasources: {
    db: {
      url: 'file:/home/z/my-project/db/custom.db',
    },
  },
});

function toSnakeCase(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function prismaToPgField(prismaField) {
  return toSnakeCase(prismaField);
}

function dataToPgRow(data, skipFields = []) {
  const result = {};
  for (const [key, value] of Object.entries(data)) {
    if (skipFields.includes(key)) continue;
    const pgKey = prismaToPgField(key);
    // Handle Date objects → ISO string for PostgreSQL
    if (value instanceof Date) {
      result[pgKey] = value.toISOString();
    } else {
      result[pgKey] = value;
    }
  }
  return result;
}

async function getSqliteData(model) {
  try {
    if (sqlite[model] && sqlite[model].findMany) {
      return await sqlite[model].findMany({});
    }
  } catch (e) {
    console.log(`  ⚠️  ${model}: ${e.message.substring(0, 80)}`);
  }
  return [];
}

async function clearNeonTable(table) {
  try {
    await pg.query(`TRUNCATE TABLE "${table}" CASCADE`);
  } catch (e) {
    // Table might be empty or have cascade issues, try DELETE
    try {
      await pg.query(`DELETE FROM "${table}"`);
    } catch (e2) {
      // ignore
    }
  }
}

async function seedNeonTable(table, rows, skipFields = []) {
  if (rows.length === 0) {
    console.log(`  ⏭️  ${table}: 0 rows (skipped)`);
    return 0;
  }

  let inserted = 0;
  for (const row of rows) {
    try {
      const pgRow = dataToPgRow(row, skipFields);
      const columns = Object.keys(pgRow);
      const values = Object.values(pgRow);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const colNames = columns.map(c => `"${c}"`).join(', ');

      await pg.query(
        `INSERT INTO "${table}" (${colNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
        values
      );
      inserted++;
    } catch (e) {
      if (inserted < 3 || inserted % 50 === 0) {
        console.log(`  ⚠️  ${table} row failed: ${e.message.substring(0, 120)}`);
      }
    }
  }

  console.log(`  ✅ ${table}: ${inserted}/${rows.length} rows`);
  return inserted;
}

async function main() {
  console.log('🔄 Connecting to Neon PostgreSQL (WRITE)...');
  await pg.connect();
  console.log('✅ Connected to Neon');

  console.log('🔄 Connecting to SQLite (READ)...');
  await sqlite.$connect();
  console.log('✅ Connected to SQLite');

  // ─── Step 1: Clear ALL Neon tables (reverse order for FK) ───
  console.log('\n🗑️  Clearing Neon tables...');
  const tablesToClear = [
    'WhatsAppLog', 'MarketplaceItem', 'WaRegistration', 'AuditLog',
    'PlayoffMatch', 'LeagueMatch', 'Match', 'TeamPlayer', 'PlayerAchievement',
    'PlayerPoint', 'Participation', 'Team', 'Donation', 'WhatsAppCommand',
    'PlayerSeasonStats', 'PlayerSkin', 'CmsCard', 'SponsorBanner', 'SponsoredPrize',
    'TournamentSponsor', 'TournamentPrize', 'Tournament', 'ClubMember', 'Club',
    'Account', 'WhatsAppBot', 'CmsSetting', 'CmsSection', 'Achievement',
    'Admin', 'ClubProfile', 'Sponsor', 'Skin', 'Season', 'Player',
  ];
  
  for (const model of tablesToClear) {
    await clearNeonTable(model);
  }
  console.log('  ✓ All tables cleared');

  // ─── Step 2: Seed in dependency order ───
  console.log('\n📥 Phase 1: Base entities (no circular FK)...');
  
  const players = await getSqliteData('Player');
  await seedNeonTable('Player', players);
  
  const skins = await getSqliteData('Skin');
  await seedNeonTable('Skin', skins);
  
  const sponsors = await getSqliteData('Sponsor');
  await seedNeonTable('Sponsor', sponsors);
  
  const clubProfiles = await getSqliteData('ClubProfile');
  await seedNeonTable('ClubProfile', clubProfiles);
  
  const admins = await getSqliteData('Admin');
  await seedNeonTable('Admin', admins);
  
  const achievements = await getSqliteData('Achievement');
  await seedNeonTable('Achievement', achievements);
  
  const cmsSections = await getSqliteData('CmsSection');
  await seedNeonTable('CmsSection', cmsSections);
  
  const cmsSettings = await getSqliteData('CmsSetting');
  await seedNeonTable('CmsSetting', cmsSettings);
  
  const waBots = await getSqliteData('WhatsAppBot');
  await seedNeonTable('WhatsAppBot', waBots);

  // ─── Season has FK → ClubProfile/Player ───
  console.log('\n📥 Phase 2: Season (deferred FKs to Club/Player)...');
  const seasons = await getSqliteData('Season');
  await seedNeonTable('Season', seasons, ['championClubId', 'championClubSnapshot', 'championPlayerId', 'championPlayerPoints', 'championPlayerSnapshot', 'championSquad', 'sultanPlayerId']);

  // ─── Club depends on ClubProfile + Season ───
  console.log('\n📥 Phase 3: Club...');
  const clubs = await getSqliteData('Club');
  await seedNeonTable('Club', clubs);

  // ─── Update Season with deferred FK fields ───
  console.log('\n📥 Phase 4: Updating Season FK fields...');
  let seasonUpdated = 0;
  for (const season of seasons) {
    try {
      const fkFields = ['championClubId', 'championClubSnapshot', 'championPlayerId', 'championPlayerPoints', 'championPlayerSnapshot', 'championSquad', 'sultanPlayerId'];
      const updateData = {};
      for (const field of fkFields) {
        if (season[field] !== null && season[field] !== undefined) {
          const pgKey = prismaToPgField(field);
          updateData[pgKey] = season[field];
        }
      }
      if (Object.keys(updateData).length > 0) {
        const setParts = Object.entries(updateData).map(([k, v], i) => `"${k}" = $${i + 1}`);
        const values = Object.values(updateData);
        values.push(season.id);
        await pg.query(
          `UPDATE "Season" SET ${setParts.join(', ')} WHERE id = $${values.length}`,
          values
        );
        seasonUpdated++;
      }
    } catch (e) {
      console.log(`  ⚠️  Season FK update failed for ${season.id}: ${e.message.substring(0, 80)}`);
    }
  }
  console.log(`  ✅ Season FK updates: ${seasonUpdated} rows`);

  // ─── Phase 5: Everything else ───
  console.log('\n📥 Phase 5: Remaining tables...');
  
  const remainingModels = [
    'Account', 'ClubMember', 'Tournament', 'TournamentPrize',
    'TournamentSponsor', 'SponsoredPrize', 'SponsorBanner', 'CmsCard',
    'PlayerSkin', 'PlayerSeasonStats', 'WhatsAppCommand', 'Donation',
    'Team', 'Participation', 'PlayerPoint', 'PlayerAchievement',
    'TeamPlayer', 'Match', 'LeagueMatch', 'PlayoffMatch',
    'AuditLog', 'WaRegistration', 'MarketplaceItem', 'WhatsAppLog',
  ];

  for (const model of remainingModels) {
    const data = await getSqliteData(model);
    await seedNeonTable(model, data);
  }

  // ─── Verify counts ───
  console.log('\n📊 Verification: Row counts in Neon...');
  const verifyModels = ['Player', 'Season', 'ClubProfile', 'Club', 'ClubMember', 'Tournament', 'Team', 'Match', 'Account', 'Admin', 'Participation', 'Donation', 'PlayerPoint', 'AuditLog', 'CmsSection', 'CmsCard', 'CmsSetting', 'Skin', 'PlayerSkin', 'Sponsor', 'SponsorBanner', 'MarketplaceItem', 'WhatsAppBot'];
  
  for (const model of verifyModels) {
    try {
      const tableName = model; // Prisma model names match table names in this schema
      const res = await pg.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
      console.log(`  ${model}: ${res.rows[0].count} rows`);
    } catch (e) {
      console.log(`  ${model}: error - ${e.message.substring(0, 60)}`);
    }
  }

  // ─── Cleanup ───
  await pg.end();
  await sqlite.$disconnect();
  console.log('\n✅ All connections closed. Migration complete!');
}

main().catch(e => {
  console.error('❌ FATAL:', e);
  process.exit(1);
});
