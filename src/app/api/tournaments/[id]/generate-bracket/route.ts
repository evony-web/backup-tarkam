import { db, neonDeleteMany, isPostgreSQL } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { pusherTrigger, PUSHER_CHANNELS, PUSHER_EVENTS } from '@/lib/pusher';
import { createAuditLog } from '@/lib/audit';
import { NextResponse } from 'next/server';

/** Fisher-Yates shuffle */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Generate standard bracket seeding positions.
 * Ensures top seeds meet bottom seeds late in the tournament.
 * For size 2: [1, 2]
 * For size 4: [1, 4, 2, 3]
 * For size 8: [1, 8, 4, 5, 2, 7, 3, 6]
 */
function standardSeeding(size: number): number[] {
  if (size === 2) return [1, 2];
  const half = standardSeeding(size / 2);
  const result: number[] = [];
  for (const seed of half) {
    result.push(seed);
    result.push(size + 1 - seed);
  }
  return result;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const tournament = await db.tournament.findUnique({
    where: { id },
    include: { teams: true },
  });

  if (!tournament) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  }

  if (tournament.teams.length < 2) {
    return NextResponse.json({ error: 'Need at least 2 teams to generate bracket' }, { status: 400 });
  }

  // Delete existing matches (regeneration support)
  // Neon HTTP adapter does NOT support deleteMany with complex where — use raw SQL
  if (isPostgreSQL) {
    await neonDeleteMany('Match', [{ column: 'tournamentId', operator: '=', value: id }]);
  } else {
    await db.match.deleteMany({ where: { tournamentId: id } });
  }

  const shuffledTeams = shuffle(tournament.teams);
  const teamCount = shuffledTeams.length;
  const format = tournament.format || 'single_elimination';
  const matchFormat = tournament.defaultMatchFormat || 'BO1';

  const matches: Awaited<ReturnType<typeof db.match.create>>[] = [];

  // ===== SINGLE ELIMINATION (No WO matches - bye teams go directly to R2) =====
  if (format === 'single_elimination') {
    const p2 = nextPowerOf2(teamCount);
    const totalRounds = Math.ceil(Math.log2(p2));
    const byes = p2 - teamCount;

    let matchNumber = 0;

    // Assign teams to bracket slots using standard seeding
    // Seed positions ensure fairness: top seeds get byes and meet later
    const seeding = standardSeeding(p2);
    const slots: (typeof shuffledTeams[0] | null)[] = new Array(p2).fill(null);

    // Map teams (seed 1 = shuffledTeams[0], etc.) into bracket positions
    for (let i = 0; i < teamCount; i++) {
      const seedPosition = seeding.indexOf(i + 1);
      if (seedPosition >= 0) {
        slots[seedPosition] = shuffledTeams[i];
      }
    }
    // Remaining slots are null (bye positions)

    // Round 1: Create only REAL matches (no WO)
    // Track which R1 positions have matches for proper R2 seeding
    for (let i = 0; i < p2 / 2; i++) {
      const team1 = slots[i * 2];
      const team2 = slots[i * 2 + 1];
      const positionInRound = i + 1; // 1-indexed

      if (team1 && team2) {
        // Real match — both teams exist
        matchNumber++;
        const match = await db.match.create({
          data: {
            tournamentId: id,
            round: 1,
            matchNumber,
            bracket: 'upper',
            format: matchFormat,
            groupLabel: `U1-${positionInRound}`,
            team1Id: team1.id,
            team2Id: team2.id,
            status: 'ready',
          },
        });
        matches.push(match);
      }
      // If only one team or no team → bye, skip creating R1 match
      // Bye team will be seeded directly into R2
    }

    // Create rounds 2+ with TBD teams
    for (let round = 2; round <= totalRounds; round++) {
      const matchesInRound = p2 / Math.pow(2, round);
      for (let i = 1; i <= matchesInRound; i++) {
        matchNumber++;
        const match = await db.match.create({
          data: {
            tournamentId: id,
            round,
            matchNumber,
            bracket: 'upper',
            format: matchFormat,
            groupLabel: `U${round}-${i}`,
            team1Id: null,
            team2Id: null,
            status: 'pending',
          },
        });
        matches.push(match);
      }
    }

    // Seed bye teams directly into R2
    // Bye teams from positions where only one team exists in a pair
    const r2Seeds: { r2Pos: number; slot: 'team1Id' | 'team2Id'; teamId: string }[] = [];

    for (let i = 0; i < p2 / 2; i++) {
      const team1 = slots[i * 2];
      const team2 = slots[i * 2 + 1];
      const positionInRound = i + 1; // 1-indexed R1 position

      if (team1 && !team2) {
        // Team1 has a bye → goes to R2 at the slot where R1 winner would go
        const r2Pos = Math.ceil(positionInRound / 2);
        const slot = positionInRound % 2 === 1 ? 'team1Id' : 'team2Id';
        r2Seeds.push({ r2Pos, slot, teamId: team1.id });
      } else if (!team1 && team2) {
        // Team2 has a bye
        const r2Pos = Math.ceil(positionInRound / 2);
        const slot = positionInRound % 2 === 1 ? 'team1Id' : 'team2Id';
        r2Seeds.push({ r2Pos, slot, teamId: team2.id });
      }
    }

    // Apply R2 seeds
    for (const seed of r2Seeds) {
      const r2Match = await db.match.findFirst({
        where: { tournamentId: id, round: 2, bracket: 'upper', groupLabel: `U2-${seed.r2Pos}` },
      });
      if (r2Match) {
        await db.match.update({
          where: { id: r2Match.id },
          data: { [seed.slot]: seed.teamId },
        });
      }
    }

    // Check R2 matches — if both teams filled (two bye teams face each other), mark as ready
    const r2Matches = await db.match.findMany({
      where: { tournamentId: id, round: 2, bracket: 'upper' },
    });
    for (const r2 of r2Matches) {
      if (r2.team1Id && r2.team2Id && r2.status === 'pending') {
        await db.match.update({ where: { id: r2.id }, data: { status: 'ready' } });
      }
    }

    // If no R1 matches exist (teamCount is power of 2 with 2 teams), ensure R1 has matches
    const r1Count = await db.match.count({ where: { tournamentId: id, round: 1, bracket: 'upper' } });
    if (r1Count === 0 && teamCount >= 2) {
      // All teams go to R2 via bye — but this means R1 is empty
      // This happens when teamCount = 2 (p2=2, byes=0)
      // Actually with byes=0, all R1 matches should be real
      // If we get here, it means all matches were byes which shouldn't happen with correct seeding
      // Fallback: create R1 matches for all pairs
      for (let i = 0; i < p2 / 2; i++) {
        const team1 = slots[i * 2];
        const team2 = slots[i * 2 + 1];
        if (team1 && team2) {
          matchNumber++;
          const match = await db.match.create({
            data: {
              tournamentId: id, round: 1, matchNumber, bracket: 'upper',
              format: matchFormat, groupLabel: `U1-${i + 1}`,
              team1Id: team1.id, team2Id: team2.id, status: 'ready',
            },
          });
          matches.push(match);
        }
      }
    }
  }

  // ===== SWISS =====
  else if (format === 'swiss') {
    const swissRounds = Math.ceil(Math.log2(teamCount)) + 2;
    const swissTeams = shuffle(tournament.teams);
    let matchNumber = 0;

    // --- Round 1: shuffle + pair [0v1, 2v3, 4v5, ...] ---
    const isOdd = swissTeams.length % 2 !== 0;
    const pairedCount = isOdd ? swissTeams.length - 1 : swissTeams.length;

    for (let i = 0; i < pairedCount; i += 2) {
      matchNumber++;
      const pairIndex = Math.floor(i / 2) + 1;
      const match = await db.match.create({
        data: {
          tournamentId: id,
          round: 1,
          matchNumber,
          bracket: 'swiss',
          groupLabel: `SR1-${pairIndex}`,
          format: matchFormat,
          team1Id: swissTeams[i].id,
          team2Id: swissTeams[i + 1].id,
          status: 'ready',
        },
      });
      matches.push(match);
    }

    // --- BYE handling (odd number of teams) ---
    if (isOdd) {
      const byeTeam = swissTeams[swissTeams.length - 1];
      matchNumber++;
      const byeMatch = await db.match.create({
        data: {
          tournamentId: id,
          round: 1,
          matchNumber,
          bracket: 'swiss',
          groupLabel: `SR1-${matchNumber}`,
          format: matchFormat,
          team1Id: byeTeam.id,
          team2Id: null,
          score1: 0,
          score2: 0,
          status: 'completed',
          winnerId: null, // No winner for BYE — team did not play
        },
      });
      matches.push(byeMatch);
    }

    // --- Playoff bracket (pre-created, teams TBD) ---
    // Top 4 teams after all Swiss rounds advance to single elimination playoff
    // Semi Finals
    matchNumber++;
    const sf1 = await db.match.create({
      data: {
        tournamentId: id,
        round: swissRounds + 1,
        matchNumber,
        bracket: 'upper',
        groupLabel: 'SF1',
        format: matchFormat,
        team1Id: null,
        team2Id: null,
        status: 'pending',
      },
    });
    matches.push(sf1);

    matchNumber++;
    const sf2 = await db.match.create({
      data: {
        tournamentId: id,
        round: swissRounds + 1,
        matchNumber,
        bracket: 'upper',
        groupLabel: 'SF2',
        format: matchFormat,
        team1Id: null,
        team2Id: null,
        status: 'pending',
      },
    });
    matches.push(sf2);

    // Grand Final (BO5 always)
    matchNumber++;
    const grandFinal = await db.match.create({
      data: {
        tournamentId: id,
        round: swissRounds + 2,
        matchNumber,
        bracket: 'upper',
        groupLabel: 'Final',
        format: 'BO5',
        team1Id: null,
        team2Id: null,
        status: 'pending',
      },
    });
    matches.push(grandFinal);

    // 3rd Place (BO3 always)
    matchNumber++;
    const thirdPlace = await db.match.create({
      data: {
        tournamentId: id,
        round: swissRounds + 2,
        matchNumber,
        bracket: 'lower',
        groupLabel: '3rd',
        format: 'BO3',
        team1Id: null,
        team2Id: null,
        status: 'pending',
      },
    });
    matches.push(thirdPlace);
  }

  // ===== UPPER SEMI (Double Elimination) =====
  else if (format === 'upper_semi') {
    if (teamCount < 4 || teamCount > 8) {
      return NextResponse.json(
        { error: 'Upper Semi format requires 4-8 teams' },
        { status: 400 }
      );
    }

    // Sort teams by power for seeding (highest power = seed 1)
    const seededTeams = [...shuffledTeams].sort((a, b) => b.power - a.power);
    let matchNumber = 0;

    // Helper: create a match record (matchNumber is pre-incremented by caller)
    const createMatch = async (
      round: number,
      mNum: number,
      bracket: 'upper' | 'lower' | 'grand_final',
      groupLabel: string,
      team1Id: string | null,
      team2Id: string | null,
    ) => {
      const status = (team1Id && team2Id) ? 'ready' : 'pending';
      const match = await db.match.create({
        data: {
          tournamentId: id,
          round,
          matchNumber: mNum,
          bracket,
          groupLabel,
          format: matchFormat,
          team1Id,
          team2Id,
          status,
        },
      });
      matches.push(match);
      return match;
    };

    if (teamCount === 4) {
      // 4 Teams (6 matches)
      // UB R1: U1-1 Seed1 vs Seed4, U1-2 Seed2 vs Seed3
      await createMatch(1, ++matchNumber, 'upper', 'U1-1', seededTeams[0].id, seededTeams[3].id);
      await createMatch(1, ++matchNumber, 'upper', 'U1-2', seededTeams[1].id, seededTeams[2].id);
      // UB R2: U2-1 W(U1-1) vs W(U1-2)
      await createMatch(2, ++matchNumber, 'upper', 'U2-1', null, null);
      // LB R1: L1-1 L(U1-1) vs L(U1-2)
      await createMatch(1, ++matchNumber, 'lower', 'L1-1', null, null);
      // LB R2: L2-1 L(U2-1) vs W(L1-1)
      await createMatch(2, ++matchNumber, 'lower', 'L2-1', null, null);
      // GF: W(U2-1) vs W(L2-1)
      await createMatch(3, ++matchNumber, 'grand_final', 'GF', null, null);
    } else if (teamCount === 5) {
      // 5 Teams (8 matches)
      // UB R1: U1-1 Seed4 vs Seed5 (Play-in)
      await createMatch(1, ++matchNumber, 'upper', 'U1-1', seededTeams[3].id, seededTeams[4].id);
      // UB R2: U2-1 Seed1 vs W(U1-1), U2-2 Seed2 vs Seed3
      await createMatch(2, ++matchNumber, 'upper', 'U2-1', seededTeams[0].id, null);
      await createMatch(2, ++matchNumber, 'upper', 'U2-2', seededTeams[1].id, seededTeams[2].id);
      // UB R3: U3-1 W(U2-1) vs W(U2-2) (Upper Final)
      await createMatch(3, ++matchNumber, 'upper', 'U3-1', null, null);
      // LB R1: L1-1 L(U1-1) vs L(U2-2)
      await createMatch(1, ++matchNumber, 'lower', 'L1-1', null, null);
      // LB R2: L2-1 W(L1-1) vs L(U2-1)
      await createMatch(2, ++matchNumber, 'lower', 'L2-1', null, null);
      // LB R3: L3-1 L(U3-1) vs W(L2-1) (Lower Final)
      await createMatch(3, ++matchNumber, 'lower', 'L3-1', null, null);
      // GF: W(U3-1) vs W(L3-1)
      await createMatch(4, ++matchNumber, 'grand_final', 'GF', null, null);
    } else if (teamCount === 6) {
      // 6 Teams (10 matches)
      // UB R1: U1-1 Seed3 vs Seed6, U1-2 Seed4 vs Seed5
      await createMatch(1, ++matchNumber, 'upper', 'U1-1', seededTeams[2].id, seededTeams[5].id);
      await createMatch(1, ++matchNumber, 'upper', 'U1-2', seededTeams[3].id, seededTeams[4].id);
      // UB R2: U2-1 Seed1 vs W(U1-1), U2-2 Seed2 vs W(U1-2)
      await createMatch(2, ++matchNumber, 'upper', 'U2-1', seededTeams[0].id, null);
      await createMatch(2, ++matchNumber, 'upper', 'U2-2', seededTeams[1].id, null);
      // UB R3: U3-1 W(U2-1) vs W(U2-2) (Upper Final)
      await createMatch(3, ++matchNumber, 'upper', 'U3-1', null, null);
      // LB R1: L1-1 L(U1-1) vs L(U2-2) (cross bracket), L1-2 L(U1-2) vs L(U2-1) (cross bracket)
      await createMatch(1, ++matchNumber, 'lower', 'L1-1', null, null);
      await createMatch(1, ++matchNumber, 'lower', 'L1-2', null, null);
      // LB R2: L2-1 W(L1-1) vs W(L1-2) (Lower Semi)
      await createMatch(2, ++matchNumber, 'lower', 'L2-1', null, null);
      // LB R3: L3-1 L(U3-1) vs W(L2-1) (Lower Final)
      await createMatch(3, ++matchNumber, 'lower', 'L3-1', null, null);
      // GF: W(U3-1) vs W(L3-1)
      await createMatch(4, ++matchNumber, 'grand_final', 'GF', null, null);
    } else if (teamCount === 7) {
      // 7 Teams (12 matches)
      // UB R1: U1-1 Seed2 vs Seed7, U1-2 Seed3 vs Seed6, U1-3 Seed4 vs Seed5
      await createMatch(1, ++matchNumber, 'upper', 'U1-1', seededTeams[1].id, seededTeams[6].id);
      await createMatch(1, ++matchNumber, 'upper', 'U1-2', seededTeams[2].id, seededTeams[5].id);
      await createMatch(1, ++matchNumber, 'upper', 'U1-3', seededTeams[3].id, seededTeams[4].id);
      // UB R2: U2-1 Seed1 vs W(U1-1), U2-2 W(U1-2) vs W(U1-3)
      await createMatch(2, ++matchNumber, 'upper', 'U2-1', seededTeams[0].id, null);
      await createMatch(2, ++matchNumber, 'upper', 'U2-2', null, null);
      // UB R3: U3-1 W(U2-1) vs W(U2-2) (Upper Final)
      await createMatch(3, ++matchNumber, 'upper', 'U3-1', null, null);
      // LB R1: L1-1 L(U1-2) vs L(U1-3)
      await createMatch(1, ++matchNumber, 'lower', 'L1-1', null, null);
      // LB R2: L2-1 L(U1-1) vs W(L1-1)
      await createMatch(2, ++matchNumber, 'lower', 'L2-1', null, null);
      // LB R3: L3-1 L(U2-1) vs L(U2-2) (Lower Semi)
      await createMatch(3, ++matchNumber, 'lower', 'L3-1', null, null);
      // LB R4: L4-1 W(L2-1) vs W(L3-1)
      await createMatch(4, ++matchNumber, 'lower', 'L4-1', null, null);
      // LB R5: L5-1 L(U3-1) vs W(L4-1) (Lower Final)
      await createMatch(5, ++matchNumber, 'lower', 'L5-1', null, null);
      // GF: W(U3-1) vs W(L5-1)
      await createMatch(6, ++matchNumber, 'grand_final', 'GF', null, null);
    } else if (teamCount === 8) {
      // 8 Teams (14 matches)
      // UB R1: U1-1 Seed1 vs Seed8, U1-2 Seed4 vs Seed5, U1-3 Seed2 vs Seed7, U1-4 Seed3 vs Seed6
      await createMatch(1, ++matchNumber, 'upper', 'U1-1', seededTeams[0].id, seededTeams[7].id);
      await createMatch(1, ++matchNumber, 'upper', 'U1-2', seededTeams[3].id, seededTeams[4].id);
      await createMatch(1, ++matchNumber, 'upper', 'U1-3', seededTeams[1].id, seededTeams[6].id);
      await createMatch(1, ++matchNumber, 'upper', 'U1-4', seededTeams[2].id, seededTeams[5].id);
      // UB R2: U2-1 W(U1-1) vs W(U1-2), U2-2 W(U1-3) vs W(U1-4)
      await createMatch(2, ++matchNumber, 'upper', 'U2-1', null, null);
      await createMatch(2, ++matchNumber, 'upper', 'U2-2', null, null);
      // UB R3: U3-1 W(U2-1) vs W(U2-2) (Upper Final)
      await createMatch(3, ++matchNumber, 'upper', 'U3-1', null, null);
      // LB R1: L1-1 L(U1-1) vs L(U1-2) (top), L1-2 L(U1-3) vs L(U1-4) (bottom)
      await createMatch(1, ++matchNumber, 'lower', 'L1-1', null, null);
      await createMatch(1, ++matchNumber, 'lower', 'L1-2', null, null);
      // LB R2: L2-1 W(L1-1) vs L(U2-2) (cross bracket top), L2-2 W(L1-2) vs L(U2-1) (cross bracket bottom)
      await createMatch(2, ++matchNumber, 'lower', 'L2-1', null, null);
      await createMatch(2, ++matchNumber, 'lower', 'L2-2', null, null);
      // LB R3: L3-1 W(L2-1) vs W(L2-2) (Lower Semi)
      await createMatch(3, ++matchNumber, 'lower', 'L3-1', null, null);
      // LB R4: L4-1 L(U3-1) vs W(L3-1) (Lower Final)
      await createMatch(4, ++matchNumber, 'lower', 'L4-1', null, null);
      // GF: W(U3-1) vs W(L4-1)
      await createMatch(5, ++matchNumber, 'grand_final', 'GF', null, null);
    }
  }

  // ===== GROUP STAGE =====
  // Distributes teams evenly across groups (max difference of 1 team per group).
  // Then creates round-robin matches within each group, followed by double elimination playoff.
  //
  // Examples:
  //   4 teams → 2 groups (2+2) → Double Elim (4 teams: UB Semi → UB Final, LB → GF)
  //   5 teams → 2 groups (3+2) → Double Elim (4 teams)
  //   6 teams → 2 groups (3+3) → Double Elim (4 teams)
  //   7 teams → 2 groups (4+3) → Double Elim (4 teams)
  //   8 teams → 2 groups (4+4) → Double Elim (4 teams)
  //   9 teams → 3 groups (3+3+3) → Double Elim (4 teams)
  //  10 teams → 2 groups (5+5) or 3 groups (4+3+3) → Double Elim (4 teams)
  //  12 teams → 4 groups (3+3+3+3) → Double Elim (8 teams: UB QF → SF → Final, LB → GF)
  //  16 teams → 4 groups (4+4+4+4) → Double Elim (8 teams)
  //
  else if (format === 'group_stage') {
    const groupLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    let matchNumber = 0;

    // ── Determine number of groups and distribute teams evenly ──
    // Logic: find the ideal number of groups so each group has 3-5 teams
    // Teams are distributed as evenly as possible (max diff of 1 per group)
    function calculateGroupDistribution(teamCount: number): { numGroups: number; groupSizes: number[] } {
      // For very small team counts, use 2 groups minimum
      if (teamCount <= 3) {
        return { numGroups: 2, groupSizes: [Math.ceil(teamCount / 2), Math.floor(teamCount / 2)] };
      }

      // Find ideal number of groups: target 3-5 teams per group
      // Prefer groups of 3-4, allow 2 or 5 only when necessary
      let numGroups: number;

      if (teamCount <= 8) {
        // 4-8 teams → 2 groups
        numGroups = 2;
      } else if (teamCount <= 12) {
        // 9-12 teams → 3 groups
        numGroups = 3;
      } else if (teamCount <= 16) {
        // 13-16 teams → 4 groups
        numGroups = 4;
      } else {
        // 17+ teams → aim for ~4 per group
        numGroups = Math.ceil(teamCount / 4);
      }

      // Distribute teams evenly: e.g., 5 teams → [3, 2], 7 teams → [4, 3]
      const baseSize = Math.floor(teamCount / numGroups);
      const remainder = teamCount % numGroups;
      const groupSizes: number[] = [];
      for (let g = 0; g < numGroups; g++) {
        // First `remainder` groups get +1 team
        groupSizes.push(baseSize + (g < remainder ? 1 : 0));
      }

      return { numGroups, groupSizes };
    }

    const { numGroups, groupSizes } = calculateGroupDistribution(teamCount);

    // ── Create group matches (round-robin within each group) ──
    let teamIndex = 0;
    for (let g = 0; g < numGroups; g++) {
      const groupTeams = shuffledTeams.slice(teamIndex, teamIndex + groupSizes[g]);
      teamIndex += groupSizes[g];
      const label = groupLabels[g];

      // Round-robin: each team plays every other team in the group
      for (let i = 0; i < groupTeams.length; i++) {
        for (let j = i + 1; j < groupTeams.length; j++) {
          matchNumber++;
          const match = await db.match.create({
            data: {
              tournamentId: id, round: 1, matchNumber, bracket: 'group', groupLabel: label, format: matchFormat,
              team1Id: groupTeams[i].id, team2Id: groupTeams[j].id, status: 'ready',
            },
          });
          matches.push(match);
        }
      }
    }

    // ── Create playoff bracket based on number of groups ──
    // Double elimination: Upper Bracket + Lower Bracket + Grand Final
    const createPlayoffMatch = async (
      round: number,
      mNum: number,
      bracket: 'upper' | 'lower' | 'grand_final',
      groupLabel: string,
      team1Id: string | null,
      team2Id: string | null,
    ) => {
      const status = (team1Id && team2Id) ? 'ready' : 'pending';
      const match = await db.match.create({
        data: {
          tournamentId: id, round, matchNumber: mNum,
          bracket, groupLabel, format: 'BO3',
          team1Id, team2Id, status,
        },
      });
      matches.push(match);
      return match;
    };

    if (numGroups <= 3) {
      // 1-3 groups: Rank 1&2 → Upper Bracket, Rank 3 → Lower Bracket (waiting)
      // NEW FORMAT: Rank 3 from each group waits in Lower Bracket for Upper SF losers
      //
      // Upper R1: U1-1, U1-2 (Semi Finals) — seeded with Rank 1&2
      // Upper R2: U2-1 (Upper Final)
      // Lower R1: L1-1, L1-2 — team1 = Rank 3 (pre-seeded), team2 = Upper SF loser (TBD)
      // Lower R2: L2-1 — winner of L1-1 vs winner of L1-2
      // Lower R3: L3-1 — winner of L2-1 vs Upper Final loser (UB→LB drop)
      // Grand Final: GF
      //
      // For 2 groups: 2 rank-3 teams → 2 lower R1 matches
      // For 1 group: only top 4 advance; rank 3 & 4 go to lower R1
      await createPlayoffMatch(2, ++matchNumber, 'upper', 'U1-1', null, null);
      await createPlayoffMatch(2, ++matchNumber, 'upper', 'U1-2', null, null);
      await createPlayoffMatch(3, ++matchNumber, 'upper', 'U2-1', null, null);
      // Lower bracket: L1-1 and L1-2 — team1 pre-seeded with rank 3, team2 TBD (upper SF loser)
      const numLowerR1 = numGroups === 1 ? 2 : Math.min(numGroups, 2); // 1 group → 2 lower matches, 2 groups → 2 lower matches
      for (let i = 1; i <= numLowerR1; i++) {
        await createPlayoffMatch(3, ++matchNumber, 'lower', `L1-${i}`, null, null);
      }
      await createPlayoffMatch(4, ++matchNumber, 'lower', 'L2-1', null, null);
      await createPlayoffMatch(5, ++matchNumber, 'lower', 'L3-1', null, null);
      await createPlayoffMatch(6, ++matchNumber, 'grand_final', 'GF', null, null);
    } else if (numGroups === 4) {
      // 4 groups: Rank 1&2 → Upper Bracket, Rank 3 → Lower Bracket (waiting)
      // NEW FORMAT: Rank 3 from each group waits in Lower Bracket for Upper QF losers
      //
      // Upper R1: U1-1..U1-4 (Quarter Finals) — seeded with Rank 1&2 (cross-bracket)
      // Upper R2: U2-1, U2-2 (Semi Finals)
      // Upper R3: U3-1 (Upper Final)
      // Lower R1: L1-1..L1-4 — team1 = Rank 3 (pre-seeded), team2 = Upper QF loser (TBD)
      // Lower R2: L2-1 (L1-1w vs L1-2w), L2-2 (L1-3w vs L1-4w)
      // Lower R3: L3-1 (L2-1w vs U2-2 loser), L3-2 (L2-2w vs U2-1 loser) — cross-bracket
      // Lower R4: L4-1 (L3-1w vs L3-2w) — Lower Final (also receives U3-1 loser)
      // Grand Final: GF
      await createPlayoffMatch(2, ++matchNumber, 'upper', 'U1-1', null, null);
      await createPlayoffMatch(2, ++matchNumber, 'upper', 'U1-2', null, null);
      await createPlayoffMatch(2, ++matchNumber, 'upper', 'U1-3', null, null);
      await createPlayoffMatch(2, ++matchNumber, 'upper', 'U1-4', null, null);
      await createPlayoffMatch(3, ++matchNumber, 'upper', 'U2-1', null, null);
      await createPlayoffMatch(3, ++matchNumber, 'upper', 'U2-2', null, null);
      await createPlayoffMatch(4, ++matchNumber, 'upper', 'U3-1', null, null);
      // Lower bracket: L1-1..L1-4 — team1 pre-seeded with rank 3, team2 TBD (upper QF loser)
      for (let i = 1; i <= 4; i++) {
        await createPlayoffMatch(3, ++matchNumber, 'lower', `L1-${i}`, null, null);
      }
      await createPlayoffMatch(4, ++matchNumber, 'lower', 'L2-1', null, null);
      await createPlayoffMatch(4, ++matchNumber, 'lower', 'L2-2', null, null);
      await createPlayoffMatch(5, ++matchNumber, 'lower', 'L3-1', null, null);
      await createPlayoffMatch(5, ++matchNumber, 'lower', 'L3-2', null, null);
      await createPlayoffMatch(6, ++matchNumber, 'lower', 'L4-1', null, null);
      await createPlayoffMatch(7, ++matchNumber, 'grand_final', 'GF', null, null);
    } else {
      // 5+ groups: Rank 1&2 → Upper, Rank 3 → Lower (waiting for upper losers)
      // NEW FORMAT: Each group's rank 3 team is pre-seeded into Lower Bracket R1
      // Upper QF losers drop to face the waiting rank-3 teams
      const playoffTeams = nextPowerOf2(numGroups * 2); // 2 teams per group go to upper
      const upperRounds = Math.ceil(Math.log2(numGroups * 2));

      // Upper bracket rounds
      for (let round = 2; round <= 1 + upperRounds; round++) {
        const roundWithinBracket = round - 1; // 1-indexed within upper bracket
        const matchesInRound = Math.floor(numGroups * 2 / Math.pow(2, roundWithinBracket));
        for (let i = 1; i <= Math.max(1, matchesInRound); i++) {
          await createPlayoffMatch(round, ++matchNumber, 'upper', `U${roundWithinBracket}-${i}`, null, null);
        }
      }

      // Lower bracket rounds — Rank 3 teams wait in L1 for upper losers
      // L1: numGroups matches — each has rank 3 (team1) vs upper R1 loser (team2)
      // Then proceeds as standard consolidation rounds
      const upperFinalRound = 1 + upperRounds;

      // L1: numGroups matches (rank 3 vs upper first-round loser)
      for (let i = 1; i <= numGroups; i++) {
        await createPlayoffMatch(upperFinalRound + 1, ++matchNumber, 'lower', `L1-${i}`, null, null);
      }

      // Calculate remaining lower bracket rounds
      let currentTeams = numGroups; // winners of L1
      let lowerRound = 2;
      while (currentTeams > 1 || lowerRound <= upperRounds) {
        // Check if there's an upper bracket drop this round
        const upperDropRound = lowerRound; // Upper bracket round that drops losers this round
        const upperRoundIdx = lowerRound; // Which upper round is dropping
        let matchesThisRound: number;

        if (upperRoundIdx <= upperRounds) {
          // This lower round receives upper bracket drops
          // Number of upper matches dropping = matches in that upper round
          const upperMatchesDropping = Math.max(1, Math.floor(numGroups * 2 / Math.pow(2, upperRoundIdx)));
          // Total teams = currentTeams (from prev LB round) + upperMatchesDropping (drops)
          matchesThisRound = Math.max(1, Math.ceil((currentTeams + upperMatchesDropping) / 2));
          currentTeams = matchesThisRound;
        } else {
          // No more drops — pure consolidation
          matchesThisRound = Math.max(1, Math.ceil(currentTeams / 2));
          currentTeams = matchesThisRound;
        }

        if (matchesThisRound === 1 && upperRoundIdx > upperRounds) {
          // Lower Final
          await createPlayoffMatch(upperFinalRound + lowerRound, ++matchNumber, 'lower', `L${lowerRound}-1`, null, null);
          break;
        }

        for (let i = 1; i <= matchesThisRound; i++) {
          await createPlayoffMatch(upperFinalRound + lowerRound, ++matchNumber, 'lower', `L${lowerRound}-${i}`, null, null);
        }
        lowerRound++;

        if (lowerRound > upperRounds * 3) break; // Safety limit
      }

      // Grand Final
      await createPlayoffMatch(upperFinalRound + lowerRound + 1, ++matchNumber, 'grand_final', 'GF', null, null);
    }
  }

  await db.tournament.update({ where: { id }, data: { status: 'bracket_generation' } });

  // Pusher: Notify real-time clients about bracket generation
  void pusherTrigger(PUSHER_CHANNELS.TOURNAMENT, PUSHER_EVENTS.TOURNAMENT_STATUS_CHANGED, {
    tournamentId: id, division: tournament.division, status: 'bracket_generation',
  });
  void pusherTrigger(PUSHER_CHANNELS.FEED, PUSHER_EVENTS.FEED_UPDATED, {
    type: 'bracket-generated', tournamentId: id, division: tournament.division,
  });

  await createAuditLog({
    adminId: authResult.id,
    adminName: authResult.username,
    action: 'create',
    entity: 'tournament',
    entityId: id,
    details: 'Generate bracket',
  });

  return NextResponse.json({ matches, teamCount, format });
  } catch (error) {
    console.error('[generate-bracket] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate bracket', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
