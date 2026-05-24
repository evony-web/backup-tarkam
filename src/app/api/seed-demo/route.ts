import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/api-auth';
import { getSafeErrorMessage } from '@/lib/api-error';
import { NextResponse } from 'next/server';

// ─── GET: Return current data stats ───
export async function GET(request: Request) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Endpoint tidak tersedia di production' }, { headers,  status: 403 });
  }
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const [
      playerCount,
      matchCount,
      tournamentCount,
      donationCount,
      achievementCount,
      playerAchievementCount,
      clubCount,
      seasonCount,
      teamCount,
    ] = await Promise.all([
      db.player.count(),
      db.match.count(),
      db.tournament.count(),
      db.donation.count(),
      db.achievement.count(),
      db.playerAchievement.count(),
      db.club.count(),
      db.season.count(),
      db.team.count(),
    ]);

    const completedMatches = await db.match.count({ where: { status: 'completed' } });
    const approvedDonations = await db.donation.count({ where: { status: 'approved' } });

    return NextResponse.json({
      stats: {
        players: playerCount,
        matches: matchCount,
        completedMatches,
        tournaments: tournamentCount,
        teams: teamCount,
        donations: donationCount,
        approvedDonations,
        achievements: achievementCount,
        playerAchievements: playerAchievementCount,
        clubs: clubCount,
        seasons: seasonCount,
      },
    }, { headers });
  } catch (e: unknown) {
    const error = e as Error;
    console.error('Seed-demo GET error:', error);
    return NextResponse.json({ error: getSafeErrorMessage(e) }, { headers,  status: 500 });
  }
}

// ─── Helper: random integer in range [min, max] ───
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Helper: pick random element from array ───
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Helper: shuffle array (Fisher-Yates) ───
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── POST: Seed demo data ───
export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Endpoint tidak tersedia di production' }, { status: 403 });
  }
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  try {
    // 1. Find the first active season
    const activeSeason = await db.season.findFirst({
      where: { status: 'active' },
    });

    if (!activeSeason) {
      return NextResponse.json(
        { error: 'No active season found. Please seed base data first.' },
        { status: 400 }
      );
    }

    const results = {
      matchesCreated: 0,
      donationsCreated: 0,
      achievementsCreated: 0,
      playerAchievementsCreated: 0,
      mvpSet: 0,
      tournamentsCreated: 0,
      teamsCreated: 0,
    };

    // ─────────────────────────────────────────────
    // Ensure we have tournaments and teams for matches
    // ─────────────────────────────────────────────
    let tournaments = await db.tournament.findMany({
      where: { seasonId: activeSeason.id },
    });

    if (tournaments.length === 0) {
      // Create 3 tournaments for the active season
      const divisions: string[] = [activeSeason.division];
      for (let w = 1; w <= 3; w++) {
        const tournament = await db.tournament.create({
          data: {
            name: `Week ${w} Tournament - ${activeSeason.division === 'male' ? 'Cowo' : 'Cewe'}`,
            weekNumber: w,
            division: activeSeason.division,
            seasonId: activeSeason.id,
            status: 'main_event',
            format: 'single_elimination',
            defaultMatchFormat: 'BO1',
            prizePool: 150000 * w,
            bpm: `${140 + w * 5}`,
            location: 'IDM Arena',
            scheduledAt: new Date(Date.now() - (3 - w) * 7 * 24 * 60 * 60 * 1000),
          },
        });
        tournaments.push(tournament);
        results.tournamentsCreated++;
      }
    }

    // Ensure teams exist in tournaments (we need at least 2 per tournament for matches)
    const players = await db.player.findMany({
      where: { isActive: true },
      take: 30,
    });

    for (const tournament of tournaments.slice(0, 3)) {
      const existingTeams = await db.team.findMany({
        where: { tournamentId: tournament.id },
      });

      if (existingTeams.length < 4 && players.length >= 4) {
        const shuffledPlayers = shuffle(players);
        for (let t = 0; t < 4; t++) {
          const teamPlayersList = shuffledPlayers.slice(t * 3, t * 3 + 3);
          // Name team after the first player (acts as S-tier/leader)
          const teamName = `Tim ${teamPlayersList[0]?.gamertag || `Team ${t + 1}`}`;
          const team = await db.team.create({
            data: {
              name: teamName,
              tournamentId: tournament.id,
              power: randInt(50, 100),
            },
          });

          // Add 3 players per team
          const teamPlayers = shuffledPlayers.slice(t * 3, t * 3 + 3);
          for (const player of teamPlayers) {
            await db.teamPlayer.create({
              data: {
                teamId: team.id,
                playerId: player.id,
              },
            });
          }
          results.teamsCreated++;
        }
      }
    }

    // ─────────────────────────────────────────────
    // 2. Create 5 completed Matches with random scores
    // ─────────────────────────────────────────────
    for (const tournament of tournaments) {
      const teams = await db.team.findMany({
        where: { tournamentId: tournament.id },
      });

      if (teams.length < 2) continue;

      // Create up to 5 matches across tournaments
      const matchesToCreate = Math.min(
        5 - results.matchesCreated,
        Math.floor(teams.length / 2)
      );

      for (let i = 0; i < matchesToCreate; i++) {
        const team1 = teams[i * 2 % teams.length];
        const team2 = teams[(i * 2 + 1) % teams.length];
        if (team1.id === team2.id) continue;

        const score1 = randInt(0, 3);
        const score2 = randInt(0, 3);
        const winnerId = score1 > score2 ? team1.id : score2 > score1 ? team2.id : team1.id;
        const loserId = winnerId === team1.id ? team2.id : team1.id;

        await db.match.create({
          data: {
            tournamentId: tournament.id,
            round: i + 1,
            matchNumber: i + 1,
            bracket: i < 2 ? 'upper' : 'lower',
            format: 'BO1',
            team1Id: team1.id,
            team2Id: team2.id,
            score1,
            score2,
            status: 'completed',
            winnerId,
            loserId,
            completedAt: new Date(
              Date.now() - randInt(1, 14) * 24 * 60 * 60 * 1000
            ),
          },
        });
        results.matchesCreated++;
      }

      if (results.matchesCreated >= 5) break;
    }

    // ─────────────────────────────────────────────
    // 3. Create 3 approved Donations with Indonesian names
    // ─────────────────────────────────────────────
    const indonesianDonors = [
      { name: 'Budi Santoso', amount: 50000, message: 'Semangat IDM League! 🎉' },
      { name: 'Siti Rahayu', amount: 100000, message: 'Untuk hadiah MVP minggu ini' },
      { name: 'Ahmad Wijaya', amount: 75000, message: 'Dukung terus komunitas dance!' },
    ];

    for (const donor of indonesianDonors) {
      // Check if this donor already exists to avoid duplicates
      const existing = await db.donation.findFirst({
        where: { donorName: donor.name, amount: donor.amount },
      });

      if (!existing) {
        await db.donation.create({
          data: {
            donorName: donor.name,
            amount: donor.amount,
            message: donor.message,
            type: pickRandom(['weekly', 'season']),
            status: 'approved',
            seasonId: activeSeason.id,
            tournamentId: tournaments[0]?.id ?? null,
          },
        });
        results.donationsCreated++;
      }
    }

    // ─────────────────────────────────────────────
    // 4. Create 5 Achievement records if they don't exist
    // ─────────────────────────────────────────────
    const demoAchievements = [
      {
        name: 'first_win',
        displayName: 'First Win',
        description: 'Pertama kali menang dalam pertandingan',
        category: 'tournament',
        icon: '🏆',
        tier: 'bronze',
        criteria: JSON.stringify({ type: 'wins', count: 1 }),
        rewardPoints: 10,
      },
      {
        name: 'streak_master',
        displayName: 'Streak Master',
        description: 'Mendapatkan 3 kemenangan beruntun',
        category: 'tournament',
        icon: '🔥',
        tier: 'silver',
        criteria: JSON.stringify({ type: 'win_streak', count: 3 }),
        rewardPoints: 50,
      },
      {
        name: 'mvp_award',
        displayName: 'MVP Award',
        description: 'Terpilih sebagai MVP pertandingan',
        category: 'mvp',
        icon: '⭐',
        tier: 'gold',
        criteria: JSON.stringify({ type: 'mvp_count', count: 1 }),
        rewardPoints: 25,
      },
      {
        name: 'champion',
        displayName: 'Champion',
        description: 'Menjadi juara tournament',
        category: 'tournament',
        icon: '👑',
        tier: 'platinum',
        criteria: JSON.stringify({ type: 'championships', count: 1 }),
        rewardPoints: 100,
      },
      {
        name: 'dedicated_player',
        displayName: 'Dedicated Player',
        description: 'Berpartisipasi dalam 5 pertandingan atau lebih',
        category: 'points',
        icon: '💪',
        tier: 'bronze',
        criteria: JSON.stringify({ type: 'participations', count: 5 }),
        rewardPoints: 15,
      },
    ];

    for (const ach of demoAchievements) {
      const result = await db.achievement.upsert({
        where: { name: ach.name },
        update: {},
        create: ach,
      });
      if (result) {
        // Check if this was a new creation by seeing if updatedAt ≈ createdAt
        // Since upsert always returns the record, we track only new ones
        const existingCount = await db.achievement.count();
        // We just count all achievements that match our set
        results.achievementsCreated++;
      }
    }

    // Re-count to get accurate "new" count
    const totalAchievements = await db.achievement.count();
    const demoAchievementNames = demoAchievements.map((a) => a.name);
    const existingAchievementCount = totalAchievements - demoAchievements.length;
    results.achievementsCreated = Math.max(
      0,
      totalAchievements - existingAchievementCount
    );

    // ─────────────────────────────────────────────
    // 5. Create 8 PlayerAchievements linking players to achievements
    // ─────────────────────────────────────────────
    const allAchievements = await db.achievement.findMany({
      where: { name: { in: demoAchievementNames } },
    });

    const activePlayers = await db.player.findMany({
      where: { isActive: true },
      take: 20,
    });

    if (allAchievements.length > 0 && activePlayers.length > 0) {
      const shuffledPlayers = shuffle(activePlayers);
      const shuffledAchievements = shuffle(allAchievements);

      // Create 8 player-achievement links, avoiding duplicates
      const existingPlayerAchievements = await db.playerAchievement.findMany({
        where: {
          playerId: { in: shuffledPlayers.map((p) => p.id) },
          achievementId: { in: shuffledAchievements.map((a) => a.id) },
        },
        select: { playerId: true, achievementId: true },
      });

      const existingSet = new Set(
        existingPlayerAchievements.map((pa) => `${pa.playerId}-${pa.achievementId}`)
      );

      let created = 0;
      for (let i = 0; i < 16 && created < 8; i++) {
        const player = shuffledPlayers[i % shuffledPlayers.length];
        const achievement = shuffledAchievements[i % shuffledAchievements.length];
        const key = `${player.id}-${achievement.id}`;

        if (!existingSet.has(key)) {
          await db.playerAchievement.create({
            data: {
              playerId: player.id,
              achievementId: achievement.id,
              tournamentId: tournaments[0]?.id ?? null,
              earnedAt: new Date(Date.now() - randInt(1, 30) * 24 * 60 * 60 * 1000),
              context: JSON.stringify({
                reason: `Earned ${achievement.displayName} through demo seeding`,
              }),
            },
          });
          existingSet.add(key);
          created++;
        }
      }
      results.playerAchievementsCreated = created;
    }

    // ─────────────────────────────────────────────
    // 6. LeagueMatch seeding removed (Liga IDM)
    // ─────────────────────────────────────────────

    // ─────────────────────────────────────────────
    // 8. Set MVP on completed matches (mvpPlayerId)
    // ─────────────────────────────────────────────
    const completedMatchesWithoutMvp = await db.match.findMany({
      where: {
        status: 'completed',
        mvpPlayerId: null,
      },
      take: 10,
    });

    if (completedMatchesWithoutMvp.length > 0 && activePlayers.length > 0) {
      // Pick top players (higher points) as potential MVPs
      const topPlayers = await db.player.findMany({
        where: { isActive: true },
        orderBy: { points: 'desc' },
        take: 10,
      });

      const mvpCandidates = topPlayers.length > 0 ? topPlayers : activePlayers;

      for (const match of completedMatchesWithoutMvp) {
        const mvp = pickRandom(mvpCandidates);
        await db.match.update({
          where: { id: match.id },
          data: { mvpPlayerId: mvp.id },
        });
        results.mvpSet++;
      }
    }

    // ─────────────────────────────────────────────
    // Also update some player stats to make leaderboard look populated
    // ─────────────────────────────────────────────
    const playersToUpdate = await db.player.findMany({
      where: { isActive: true, points: 0 },
      take: 15,
    });

    for (let i = 0; i < playersToUpdate.length; i++) {
      const player = playersToUpdate[i];
      const points = randInt(50, 500);
      const wins = randInt(1, 10);
      const mvpCount = randInt(0, 3);
      const streak = randInt(0, 5);
      const matchCount = randInt(3, 20);
      const tiers = ['S', 'A', 'B', 'C', 'D'];
      // Higher points -> higher tier
      const tierIndex = Math.min(
        Math.floor((points - 50) / 100),
        tiers.length - 1
      );
      const tier = tiers[tiers.length - 1 - Math.min(tierIndex, tiers.length - 1)];

      await db.player.update({
        where: { id: player.id },
        data: {
          points,
          totalWins: wins,
          totalMvp: mvpCount,
          streak,
          maxStreak: Math.max(streak, randInt(2, 6)),
          matches: matchCount,
          tier,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Demo data seeded successfully',
      season: {
        id: activeSeason.id,
        name: activeSeason.name,
        division: activeSeason.division,
      },
      results,
    });
  } catch (e: unknown) {
    const error = e as Error;
    console.error('Seed-demo POST error:', error);
    return NextResponse.json({ error: getSafeErrorMessage(e) }, { status: 500 });
  }
}
