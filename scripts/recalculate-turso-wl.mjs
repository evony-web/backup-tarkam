/**
 * RECALCULATE Win/Loss counters in Turso from actual match data
 * 
 * Player.totalWins and Player.matches are denormalized counters that
 * got out of sync with actual match results. This script recalculates
 * them from the Match + TeamPlayer data.
 */

import { createClient } from '@libsql/client';

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error('❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN env vars');
  process.exit(1);
}

const turso = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

async function main() {
  console.log('🔄 Recalculating Player W/L from match data in Turso');
  console.log('═'.repeat(60));

  // 1. Get all completed matches from tournaments in main_event or later status
  // (excludes rolled-back tournaments that are back to bracket_generation, etc.)
  const matches = await turso.execute(`
    SELECT m.id, m.team1Id, m.team2Id, m.winnerId, m.status
    FROM "Match" m
    JOIN "Tournament" t ON m.tournamentId = t.id
    WHERE m.status = 'completed'
      AND t.status IN ('main_event', 'finalization', 'completed')
  `);
  console.log(`Completed matches: ${matches.rows.length}`);

  // 2. Get all team-player mappings
  const teamPlayers = await turso.execute(`SELECT teamId, playerId FROM TeamPlayer`);
  const teamPlayerMap = {};
  for (const tp of teamPlayers.rows) {
    if (!teamPlayerMap[tp.teamId]) teamPlayerMap[tp.teamId] = [];
    teamPlayerMap[tp.teamId].push(tp.playerId);
  }

  // 3. Calculate actual wins/losses per player
  const playerStats = {};
  for (const m of matches.rows) {
    const winnerPlayers = teamPlayerMap[m.winnerId] || [];
    const loserId = m.winnerId === m.team1Id ? m.team2Id : m.team1Id;
    const loserPlayers = teamPlayerMap[loserId] || [];

    for (const pid of winnerPlayers) {
      if (!playerStats[pid]) playerStats[pid] = { wins: 0, losses: 0, total: 0 };
      playerStats[pid].wins++;
      playerStats[pid].total++;
    }
    for (const pid of loserPlayers) {
      if (!playerStats[pid]) playerStats[pid] = { wins: 0, losses: 0, total: 0 };
      playerStats[pid].losses++;
      playerStats[pid].total++;
    }
  }

  // 4. Get all players
  const players = await turso.execute(`SELECT id, gamertag, totalWins, matches, division FROM Player`);

  // 5. Update mismatched players
  let updated = 0;
  let alreadyCorrect = 0;
  const errors = [];

  for (const p of players.rows) {
    const actual = playerStats[p.id] || { wins: 0, losses: 0, total: 0 };
    const storedWins = p.totalWins;
    const storedTotal = p.matches;

    if (actual.wins === storedWins && actual.total === storedTotal) {
      alreadyCorrect++;
      continue;
    }

    try {
      await turso.execute({
        sql: `UPDATE Player SET totalWins = ?, matches = ? WHERE id = ?`,
        args: [actual.wins, actual.total, p.id],
      });
      updated++;
      console.log(`  ✅ ${p.gamertag} (${p.division}): W${storedWins}/T${storedTotal} → W${actual.wins}/L${actual.losses}/T${actual.total}`);
    } catch (e) {
      errors.push(`${p.gamertag}: ${e.message}`);
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`📊 Summary:`);
  console.log(`  Already correct: ${alreadyCorrect}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Errors: ${errors.length}`);
  if (errors.length > 0) {
    for (const e of errors) console.log(`  ❌ ${e}`);
  }

  // 6. Verify
  console.log('\n📊 Verification (sample):');
  const verifyPlayers = await turso.execute(`SELECT gamertag, division, totalWins, matches FROM Player WHERE division = 'female' LIMIT 5`);
  for (const p of verifyPlayers.rows) {
    console.log(`  ${p.gamertag} (${p.division}): W${p.totalWins}/L${p.matches - p.totalWins}/T${p.matches}`);
  }

  turso.close();
  console.log('\n✅ Done!');
}

main().catch(e => {
  console.error('❌ FATAL:', e);
  process.exit(1);
});
