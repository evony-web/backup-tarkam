import { db, isPostgreSQL, neonUpdateMany, neonDeleteMany } from '../src/lib/db';

const TOURNAMENT_ID = 'cmp56z7yc0001ky044vldr31x';

async function main() {
  console.log('=== Creating Female Week 1 Teams ===\n');

  // 1. Get all female players
  const players = await db.player.findMany({
    where: { division: 'female', isActive: true },
  });
  const playerMap = new Map(players.map(p => [p.gamertag.toUpperCase(), p]));

  // 2. Define teams
  const teamDefs = [
    {
      name: 'Tim Arcalya',
      players: { S: 'ARCALYA', A: 'CIKI_W', B: 'ARAANII_' }
    },
    {
      name: 'Tim Indy',
      players: { S: 'INDY', A: 'YSL', B: 'AITAN' }
    },
    {
      name: 'Tim Veronic',
      players: { S: 'VERONICC', A: 'MOY', B: 'MEATRY' }
    },
    {
      name: 'Tim Reptil',
      players: { S: 'REPTIL', A: 'CHEEYAQQ', B: 'AFRONA' }
    }
  ];

  // 3. Validate all players exist
  for (const team of teamDefs) {
    for (const [tier, gamertag] of Object.entries(team.players)) {
      const player = playerMap.get(gamertag);
      if (!player) {
        console.error(`❌ Player "${gamertag}" not found in database!`);
        process.exit(1);
      }
      console.log(`  ✓ ${gamertag} → ${player.gamertag} (tier: ${player.tier}, points: ${player.points})`);
    }
  }

  // 4. Delete existing teams
  const existingTeams = await db.team.findMany({ where: { tournamentId: TOURNAMENT_ID } });
  if (existingTeams.length > 0) {
    const teamIds = existingTeams.map(t => t.id);
    console.log(`\n🗑️  Deleting ${existingTeams.length} existing teams...`);
    await neonDeleteMany('TeamPlayer', [{ column: 'teamId', operator: 'IN', value: teamIds }]);
    await neonDeleteMany('Team', [{ column: 'tournamentId', operator: '=', value: TOURNAMENT_ID }]);
    console.log('  ✓ Existing teams deleted');
  }

  // 5. Create teams
  console.log('\n🔨 Creating teams...\n');
  for (const teamDef of teamDefs) {
    const sPlayer = playerMap.get(teamDef.players.S)!;
    const aPlayer = playerMap.get(teamDef.players.A)!;
    const bPlayer = playerMap.get(teamDef.players.B)!;

    const power = sPlayer.points + aPlayer.points + bPlayer.points;

    const team = await db.team.create({
      data: {
        name: teamDef.name,
        tournamentId: TOURNAMENT_ID,
        power,
      },
    });

    // Create TeamPlayer entries
    await db.teamPlayer.create({ data: { teamId: team.id, playerId: sPlayer.id, tier: 'S' } });
    await db.teamPlayer.create({ data: { teamId: team.id, playerId: aPlayer.id, tier: 'A' } });
    await db.teamPlayer.create({ data: { teamId: team.id, playerId: bPlayer.id, tier: 'B' } });

    console.log(`✅ ${teamDef.name} (power: ${power})`);
    console.log(`   S: ${sPlayer.gamertag} (${sPlayer.points}pts)`);
    console.log(`   A: ${aPlayer.gamertag} (${aPlayer.points}pts)`);
    console.log(`   B: ${bPlayer.gamertag} (${bPlayer.points}pts)`);
  }

  // 6. Update tournament status to team_generation
  await db.tournament.update({
    where: { id: TOURNAMENT_ID },
    data: { status: 'team_generation' },
  });
  console.log('\n✅ Tournament status updated to "team_generation"');

  // 7. Update participations from approved to assigned
  await neonUpdateMany(
    'Participation',
    [
      { column: 'tournamentId', operator: '=', value: TOURNAMENT_ID },
      { column: 'status', operator: '=', value: 'approved' },
    ],
    { status: 'assigned' },
  );
  console.log('✅ Participations updated to "assigned"');

  // 8. Verify
  const finalTeams = await db.team.findMany({
    where: { tournamentId: TOURNAMENT_ID },
    include: { teamPlayers: { include: { player: true } } },
    orderBy: { name: 'asc' },
  });

  console.log('\n=== Final Teams ===');
  for (const team of finalTeams) {
    console.log(`\n🏆 ${team.name} (power: ${team.power})`);
    for (const tp of team.teamPlayers) {
      console.log(`   ${tp.tier}: ${tp.player.gamertag}`);
    }
  }

  console.log('\n✅ DONE! All teams created successfully.');
}

main().catch(e => { console.error(e); process.exit(1); });
