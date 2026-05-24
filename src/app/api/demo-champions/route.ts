import { db, neonUpdateMany, neonDeleteMany, isPostgreSQL } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/api-auth';
import { getSafeErrorMessage } from '@/lib/api-error';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Endpoint tidak tersedia di production' }, { status: 403 });
  }
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    // Get or create active seasons
    let maleSeason = await db.season.findFirst({
      where: { division: 'male', status: 'active' },
    });

    let femaleSeason = await db.season.findFirst({
      where: { division: 'female', status: 'active' },
    });

    if (!maleSeason) {
      maleSeason = await db.season.create({
        data: {
          name: 'IDM League Season 1 - Cowo',
          number: 1,
          division: 'male',
          status: 'active',
          startDate: new Date(),
        },
      });
    }

    if (!femaleSeason) {
      femaleSeason = await db.season.create({
        data: {
          name: 'IDM League Season 1 - Cewe',
          number: 1,
          division: 'female',
          status: 'active',
          startDate: new Date(),
        },
      });
    }

    // Female players data
    const femalePlayersData = [
      { gamertag: 'reptil', avatar: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775925572/idm/avatars/djaofxhgermzmom3vz86.webp' },
      { gamertag: 'yaay', avatar: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775926628/idm/avatars/bva7fpdxfhcgfckxaqky.webp' },
      { gamertag: 'vion', avatar: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775925375/idm/avatars/f4jpwokqm6kcwey3nrw1.webp' },
    ];

    // Male players data
    const malePlayersData = [
      { gamertag: 'tazos', avatar: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775851121/idm/avatars/gbo7dj4148ys9zeie5tf.webp' },
      { gamertag: 'bambang', avatar: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775841632/idm/avatars/hborl4c9sipzw9duoymj.webp' },
      { gamertag: 'ipin', avatar: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775740636/idm/avatars/wmsjsfqayngx8cexwiue.webp' },
    ];

    // Create or update female players
    const femalePlayerIds: string[] = [];
    for (const p of femalePlayersData) {
      const existing = await db.player.findUnique({ where: { gamertag: p.gamertag } });
      if (existing) {
        await db.player.update({
          where: { id: existing.id },
          data: {
            avatar: p.avatar,
            points: 300,
            totalWins: 10,
            streak: 5,
            matches: 15,
            tier: 'S',
          },
        });
        femalePlayerIds.push(existing.id);
      } else {
        const player = await db.player.create({
          data: {
            name: p.gamertag,
            gamertag: p.gamertag,
            division: 'female',
            tier: 'S',
            avatar: p.avatar,
            points: 300,
            totalWins: 10,
            totalMvp: 2,
            streak: 5,
            maxStreak: 5,
            matches: 15,
            isActive: true,
            city: '',
            registrationStatus: 'approved',
          },
        });
        femalePlayerIds.push(player.id);
      }
    }

    // Create or update male players
    const malePlayerIds: string[] = [];
    for (const p of malePlayersData) {
      const existing = await db.player.findUnique({ where: { gamertag: p.gamertag } });
      if (existing) {
        await db.player.update({
          where: { id: existing.id },
          data: {
            avatar: p.avatar,
            points: 300,
            totalWins: 10,
            streak: 5,
            matches: 15,
            tier: 'S',
          },
        });
        malePlayerIds.push(existing.id);
      } else {
        const player = await db.player.create({
          data: {
            name: p.gamertag,
            gamertag: p.gamertag,
            division: 'male',
            tier: 'S',
            avatar: p.avatar,
            points: 300,
            totalWins: 10,
            totalMvp: 2,
            streak: 5,
            maxStreak: 5,
            matches: 15,
            isActive: true,
            city: '',
            registrationStatus: 'approved',
          },
        });
        malePlayerIds.push(player.id);
      }
    }

    // Check if tournament exists for female, if so update it, otherwise create
    let femaleTournament = await db.tournament.findFirst({
      where: { division: 'female', seasonId: femaleSeason.id, weekNumber: 1 },
    });

    if (femaleTournament) {
      // Update existing tournament
      femaleTournament = await db.tournament.update({
        where: { id: femaleTournament.id },
        data: {
          status: 'completed',
          prizePool: 300000, // Rp 300.000 / 1000 / 3 players = 100 pts per player
          completedAt: new Date(),
        },
      });
      // Clear existing teams and participations
      // Neon workaround: deleteMany() doesn't work with PrismaNeonHttp
      if (isPostgreSQL) {
        // Must find team IDs first to delete TeamPlayer
        const femaleTeams = await db.team.findMany({ where: { tournamentId: femaleTournament.id }, select: { id: true } });
        const femaleTeamIds = femaleTeams.map(t => t.id);
        if (femaleTeamIds.length > 0) {
          await neonDeleteMany('TeamPlayer', [{ column: 'teamId', operator: 'IN', value: femaleTeamIds }]);
        }
        await neonDeleteMany('Team', [{ column: 'tournamentId', operator: '=', value: femaleTournament.id }]);
        await neonDeleteMany('Participation', [{ column: 'tournamentId', operator: '=', value: femaleTournament.id }]);
      } else {
        await db.teamPlayer.deleteMany({ where: { team: { tournamentId: femaleTournament.id } } });
        await db.team.deleteMany({ where: { tournamentId: femaleTournament.id } });
        await db.participation.deleteMany({ where: { tournamentId: femaleTournament.id } });
      }
    } else {
      // Create new tournament
      femaleTournament = await db.tournament.create({
        data: {
          name: 'Week 1 Champion Demo',
          weekNumber: 1,
          division: 'female',
          seasonId: femaleSeason.id,
          status: 'completed',
          prizePool: 300000, // Rp 300.000 / 1000 / 3 players = 100 pts per player
          completedAt: new Date(),
        },
      });
    }

    // Create winning team for female — named after first (S-tier) player
    const femaleChampionGamertag = await db.player.findUnique({ where: { id: femalePlayerIds[0] }, select: { gamertag: true } });
    const femaleTeam = await db.team.create({
      data: {
        name: `Tim ${femaleChampionGamertag?.gamertag || 'Champion'}`,
        tournamentId: femaleTournament.id,
        isWinner: true,
        rank: 1,
        power: 900,
      },
    });

    // Add female players to team
    for (const playerId of femalePlayerIds) {
      await db.teamPlayer.create({
        data: {
          teamId: femaleTeam.id,
          playerId,
        },
      });
    }

    // Create participations for female players
    for (const playerId of femalePlayerIds) {
      await db.participation.create({
        data: {
          playerId,
          tournamentId: femaleTournament.id,
          status: 'assigned',
          pointsEarned: 100,
          isWinner: true,
        },
      });
    }

    // Set first player as MVP for female
    // Neon workaround: updateMany() doesn't work with PrismaNeonHttp
    if (isPostgreSQL) {
      await neonUpdateMany('Participation',
        [{ column: 'tournamentId', operator: '=', value: femaleTournament.id }, { column: 'playerId', operator: '=', value: femalePlayerIds[0] }],
        { isMvp: true },
      );
    } else {
      await db.participation.updateMany({
        where: { tournamentId: femaleTournament.id, playerId: femalePlayerIds[0] },
        data: { isMvp: true },
      });
    }

    // Check if tournament exists for male, if so update it, otherwise create
    let maleTournament = await db.tournament.findFirst({
      where: { division: 'male', seasonId: maleSeason.id, weekNumber: 1 },
    });

    if (maleTournament) {
      // Update existing tournament
      maleTournament = await db.tournament.update({
        where: { id: maleTournament.id },
        data: {
          status: 'completed',
          prizePool: 300000, // Rp 300.000 / 1000 / 3 players = 100 pts per player
          completedAt: new Date(),
        },
      });
      // Clear existing teams and participations
      // Neon workaround: deleteMany() doesn't work with PrismaNeonHttp
      if (isPostgreSQL) {
        // Must find team IDs first to delete TeamPlayer
        const maleTeams = await db.team.findMany({ where: { tournamentId: maleTournament.id }, select: { id: true } });
        const maleTeamIds = maleTeams.map(t => t.id);
        if (maleTeamIds.length > 0) {
          await neonDeleteMany('TeamPlayer', [{ column: 'teamId', operator: 'IN', value: maleTeamIds }]);
        }
        await neonDeleteMany('Team', [{ column: 'tournamentId', operator: '=', value: maleTournament.id }]);
        await neonDeleteMany('Participation', [{ column: 'tournamentId', operator: '=', value: maleTournament.id }]);
      } else {
        await db.teamPlayer.deleteMany({ where: { team: { tournamentId: maleTournament.id } } });
        await db.team.deleteMany({ where: { tournamentId: maleTournament.id } });
        await db.participation.deleteMany({ where: { tournamentId: maleTournament.id } });
      }
    } else {
      // Create new tournament
      maleTournament = await db.tournament.create({
        data: {
          name: 'Week 1 Champion Demo',
          weekNumber: 1,
          division: 'male',
          seasonId: maleSeason.id,
          status: 'completed',
          prizePool: 300000, // Rp 300.000 / 1000 / 3 players = 100 pts per player
          completedAt: new Date(),
        },
      });
    }

    // Create winning team for male — named after first (S-tier) player
    const maleChampionGamertag = await db.player.findUnique({ where: { id: malePlayerIds[0] }, select: { gamertag: true } });
    const maleTeam = await db.team.create({
      data: {
        name: `Tim ${maleChampionGamertag?.gamertag || 'Champion'}`,
        tournamentId: maleTournament.id,
        isWinner: true,
        rank: 1,
        power: 900,
      },
    });

    // Add male players to team
    for (const playerId of malePlayerIds) {
      await db.teamPlayer.create({
        data: {
          teamId: maleTeam.id,
          playerId,
        },
      });
    }

    // Create participations for male players
    for (const playerId of malePlayerIds) {
      await db.participation.create({
        data: {
          playerId,
          tournamentId: maleTournament.id,
          status: 'assigned',
          pointsEarned: 100,
          isWinner: true,
        },
      });
    }

    // Set first player as MVP for male
    // Neon workaround: updateMany() doesn't work with PrismaNeonHttp
    if (isPostgreSQL) {
      await neonUpdateMany('Participation',
        [{ column: 'tournamentId', operator: '=', value: maleTournament.id }, { column: 'playerId', operator: '=', value: malePlayerIds[0] }],
        { isMvp: true },
      );
    } else {
      await db.participation.updateMany({
        where: { tournamentId: maleTournament.id, playerId: malePlayerIds[0] },
        data: { isMvp: true },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Demo champions created successfully',
      data: {
        female: {
          players: femalePlayersData.map(p => p.gamertag),
          team: femaleTeam.name,
        },
        male: {
          players: malePlayersData.map(p => p.gamertag),
          team: maleTeam.name,
        },
      },
    });
  } catch (e: unknown) {
    const error = e as Error;
    console.error('Demo champions error:', error);
    return NextResponse.json({ error: getSafeErrorMessage(e) }, { status: 500 });
  }
}
