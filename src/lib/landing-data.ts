// ═══════════════════════════════════════════════════════════
// LANDING DATA FETCHER — Server-side pre-fetching for SSR
// ═══════════════════════════════════════════════════════════
// Pre-fetches essential landing page data on the server so the
// initial HTML already contains real data (no stale flash).
// Client-side React Query will fetch FULL data and update.
//
// OPTIMIZED for Vercel free tier:
//   • unstable_cache with revalidation tags — avoids 20-30+ DB
//     queries on every ISR revalidation
//   • Batched N+1 champion/club/sultan queries into single
//     findMany calls (player, clubProfile, clubMember,
//     playerSeasonStats)
//   • approvedPlayerCount merged into main Promise.all
//   • leagueMatch.count batched into parallel query
//   • Completed-season snapshots used as-is (no live enrichment
//     when snapshot already has avatar/city/club)

import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';
import { SEASON_TOTAL_WEEKS } from '@/lib/constants';
import { withDbRetry } from '@/lib/db-resilience';
// ★ buildSkinMap import removed — SSR no longer computes skin map.
// React Query fills skinMap client-side on first fetch.

// ─────────────────────────────────────────────────────────────
// fetchLandingStats — inner implementation (throws on failure)
// ─────────────────────────────────────────────────────────────
async function fetchLandingStatsInner(division: 'male' | 'female') {
  const divisionFilter = division;

  // Find seasons for this division
  const allSeasons = await withDbRetry(() => db.season.findMany({
    where: { division: divisionFilter, status: { in: ['active', 'completed'] } },
    orderBy: { number: 'desc' },
    include: { _count: { select: { tournaments: true } } },
  }));

  const season = allSeasons[0];

  if (!season) {
    return {
      hasData: false,
      division,
      allSeasons: [],
      weeklyChampions: [],
      weeklyTopPerformers: [],
      sultanOfWeekly: [],
      totalPlayers: 0,
      approvedPlayerCount: 0,
      topPlayers: [],
      clubs: [],
      skinMap: {},
      recentMatches: [],
      upcomingMatches: [],
      topDonors: [],
      mvpHallOfFame: [],
      totalPrizePool: 0,
      malePrizePool: 0,
      femalePrizePool: 0,
      activeTournamentPrizePool: 0,
      seasonDonationTotal: 0,
      seasonProgress: { totalWeeks: SEASON_TOTAL_WEEKS, completedWeeks: 0, percentage: 0 },
      activeTournament: null,
    };
  }

  // Find season with clubs (handles new seasons without clubs yet)
  const seasonWithClubs = await withDbRetry(() => db.season.findFirst({
    where: {
      division: divisionFilter,
      id: { in: allSeasons.map(s => s.id) },
      clubs: { some: {} },
    },
    orderBy: { number: 'desc' },
  }));

  const activeSeasonId = season.id;
  const clubSeasonId = seasonWithClubs?.id || season.id;

  // ── Collect IDs for batched enrichment queries ──────────────
  // Instead of N+1 per-season findUnique calls, we collect all
  // IDs upfront and issue a single findMany for each entity type.
  const allPlayerIds = Array.from(new Set([
    ...allSeasons.filter((s: any) => s.championPlayerId).map((s: any) => s.championPlayerId as string),
    ...allSeasons.filter((s: any) => s.sultanPlayerId).map((s: any) => s.sultanPlayerId as string),
  ]));

  const allClubProfileIds: string[] = [];
  const completedClubIds: string[] = [];

  // ── Run all queries in parallel (main + batched enrichment) ─
  const [
    totalPlayers,
    seasonPointsRaw,
    allDivisionPlayers,
    clubs,
    tournaments,
    seasonDonations,
    approvedPlayerCount,
    batchPlayers,
    batchClubProfiles,
    batchClubMembers,
    allPlayersForDonorMatching,
  ] = await Promise.all([
    // Total players
    withDbRetry(() => db.player.count({ where: { division: divisionFilter, isActive: true, registrationStatus: 'approved' } })),

    // Per-season points aggregation
    withDbRetry(() => db.playerPoint.groupBy({
      by: ['playerId'],
      where: { seasonId: activeSeasonId },
      _sum: { amount: true },
    })),

    // All active players for leaderboard
    withDbRetry(() => db.player.findMany({
      where: { division: divisionFilter, isActive: true, registrationStatus: 'approved' },
      select: {
        id: true, name: true, gamertag: true, avatar: true, tier: true,
        points: true, totalWins: true, totalMvp: true, streak: true,
        maxStreak: true, matches: true, division: true, city: true, isActive: true,
        clubMembers: {
          where: { leftAt: null },
          include: { profile: { select: { id: true, name: true, logo: true } } },
          take: 1,
        },
      },
    })),

    // Clubs standings
    withDbRetry(() => db.club.findMany({
      where: { seasonId: clubSeasonId },
      orderBy: [{ points: 'desc' }, { gameDiff: 'desc' }],
      include: {
        profile: { include: { _count: { select: { members: true } } } },
        season: { select: { name: true, division: true } },
      },
    })),

    // Tournaments (for weekly champions)
    withDbRetry(() => db.tournament.findMany({
      where: { seasonId: { in: allSeasons.map(s => s.id) } },
      orderBy: { weekNumber: 'asc' },
      include: {
        _count: { select: { teams: true, participations: true } },
        teams: {
          where: { isWinner: true },
          include: {
            teamPlayers: {
              include: {
                player: {
                  include: {
                    clubMembers: {
                      where: { leftAt: null },
                      include: { profile: { select: { id: true, name: true, logo: true } } },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        },
        participations: {
          where: { isMvp: true },
          include: { player: true },
        },
      },
    })),

    // Season donations
    withDbRetry(() => db.donation.findMany({
      where: {
        status: 'approved',
        division: divisionFilter,
        OR: [
          { seasonId: { in: allSeasons.map(s => s.id) } },
          { seasonId: null },
        ],
      },
    })),

    // ★ Approved player count (was separate await — now in Promise.all)
    withDbRetry(() => db.participation.count({
      where: {
        status: { in: ['approved', 'assigned'] },
        tournament: { seasonId: clubSeasonId },
        player: { division: divisionFilter },
      },
    })),

    // ★ Batch: all champion + sultan players (replaces per-season findUnique)
    allPlayerIds.length > 0
      ? withDbRetry(() => db.player.findMany({
          where: { id: { in: allPlayerIds } },
          include: {
            clubMembers: {
              where: { leftAt: null },
              include: { profile: { select: { id: true, name: true, logo: true } } },
              take: 1,
            },
          },
        }))
      : Promise.resolve([] as any[]),

    // ★ Batch: all champion club profiles (replaces per-season findUnique)
    allClubProfileIds.length > 0
      ? withDbRetry(() => db.clubProfile.findMany({
          where: { id: { in: allClubProfileIds } },
          select: { id: true, name: true, logo: true },
        }))
      : Promise.resolve([] as any[]),

    // ★ Batch: all club members for completed seasons (replaces per-season findMany)
    completedClubIds.length > 0
      ? withDbRetry(() => db.clubMember.findMany({
          where: { profileId: { in: completedClubIds }, leftAt: null },
          include: {
            player: { select: { id: true, gamertag: true, avatar: true, tier: true, division: true } },
          },
        }))
      : Promise.resolve([] as any[]),

    // ★ Cross-division players for Sultan of the Week donor matching
    // Sultan donor can be from ANY division, so we must search both male & female players
    withDbRetry(() => db.player.findMany({
      where: { isActive: true, registrationStatus: 'approved' },
      select: {
        id: true, name: true, gamertag: true, avatar: true, tier: true,
        points: true, totalWins: true, totalMvp: true, streak: true,
        division: true, city: true,
        clubMembers: {
          where: { leftAt: null },
          include: { profile: { select: { id: true, name: true, logo: true } } },
          take: 1,
        },
      },
    })),
  ]);

  // ── Build lookup maps from batched results ──
  const playersMap = new Map((batchPlayers as any[]).map((p: any) => [p.id, p]));
  const clubProfilesMap = new Map((batchClubProfiles as any[]).map((c: any) => [c.id, c]));
  const clubMembersByProfileId = new Map<string, any[]>();
  for (const cm of batchClubMembers as any[]) {
    const existing = clubMembersByProfileId.get(cm.profileId) || [];
    existing.push(cm);
    clubMembersByProfileId.set(cm.profileId, existing);
  }

  // ── Compute topPlayers leaderboard ──
  const seasonPointsMap = new Map(
    seasonPointsRaw.map((sp: { playerId: string; _sum: { amount: number | null } }) => [sp.playerId, sp._sum.amount || 0])
  );

  const topPlayers = (allDivisionPlayers as any[])
    .map(p => {
      const activeClub = p.clubMembers?.[0]?.profile;
      return {
        ...p,
        points: seasonPointsMap.get(p.id) || 0,
        seasonPoints: seasonPointsMap.get(p.id) || 0,
        lifetimePoints: p.points,
        club: activeClub ? { id: activeClub.id, name: activeClub.name, logo: activeClub.logo } : undefined,
      };
    })
    .sort((a: any, b: any) => {
      if (b.seasonPoints !== a.seasonPoints) return b.seasonPoints - a.seasonPoints;
      if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
      return b.totalMvp - a.totalMvp;
    });

  // ── Flatten clubs ──
  const flatClubs = clubs.map((c: any) => ({
    id: c.id,
    name: c.profile?.name || '',
    logo: c.profile?.logo || null,
    bannerImage: c.profile?.bannerImage || null,
    division: c.division,
    seasonId: c.seasonId,
    wins: c.wins,
    losses: c.losses,
    points: c.points,
    gameDiff: c.gameDiff,
    _count: { members: c.profile?._count?.members || 0 },
    profileId: c.profileId,
  }));

  // ── Compute weeklyChampions ──
  const completedTournaments = tournaments.filter(t => t.status === 'completed');
  const seasonLookup = new Map(allSeasons.map((s: any) => [s.id, s]));

  const weeklyChampions = completedTournaments.map(t => {
    const winnerTeam = t.teams[0];
    const mvpParticipation = t.participations.find((p: any) => p.isMvp);
    const mvpPlayer = mvpParticipation?.player;
    const tournamentSeason = seasonLookup.get(t.seasonId) as any;
    return {
      weekNumber: t.weekNumber,
      tournamentName: t.name,
      prizePool: t.prizePool,
      completedAt: t.completedAt,
      seasonId: t.seasonId,
      seasonNumber: tournamentSeason?.number ?? 1,
      seasonStatus: tournamentSeason?.status ?? 'active',
      winnerTeam: winnerTeam ? {
        name: winnerTeam.name,
        players: winnerTeam.teamPlayers.map((tp: any) => {
          const activeClub = tp.player.clubMembers?.[0]?.profile;
          return {
            id: tp.player.id,
            gamertag: tp.player.gamertag,
            avatar: tp.player.avatar,
            tier: tp.player.tier,
            points: seasonPointsMap.get(tp.player.id) || tp.player.points,
            totalWins: tp.player.totalWins,
            totalMvp: tp.player.totalMvp,
            streak: tp.player.streak,
            matches: tp.player.matches,
            club: activeClub ? { id: activeClub.id, name: activeClub.name, logo: activeClub.logo } : null,
            city: tp.player.city || null,
          };
        }),
      } : null,
      mvp: mvpPlayer ? {
        id: mvpPlayer.id, gamertag: mvpPlayer.gamertag, avatar: mvpPlayer.avatar,
        tier: mvpPlayer.tier, totalMvp: mvpPlayer.totalMvp, points: seasonPointsMap.get(mvpPlayer.id) || mvpPlayer.points,
      } : null,
    };
  });

  // ── Compute prize pools ──
  // IMPORTANT: Must match the /api/stats computation exactly:
  //   malePrizePool = basePrizePool from male tournaments + male weekly donations
  //   femalePrizePool = basePrizePool from female tournaments + female weekly donations
  // Previously SSR only counted donations (missing base prize pool), causing
  // SSR→API data mismatch (e.g. 10K vs 260K for male).
  const weeklyDonations = seasonDonations.filter(d => d.type === 'weekly');
  const donationTotal = weeklyDonations.reduce((sum, d) => sum + d.amount, 0);
  const maleDonationTotal = weeklyDonations.filter(d => d.division === 'male').reduce((sum, d) => sum + d.amount, 0);
  const femaleDonationTotal = weeklyDonations.filter(d => d.division === 'female').reduce((sum, d) => sum + d.amount, 0);

  // Sum base prize pool from all tournaments in the season (admin-inputted)
  const basePrizePoolTotal = tournaments.reduce((sum, t) => sum + (t.prizePool || 0), 0);
  const baseMalePrizePool = tournaments.filter(t => t.division === 'male').reduce((sum, t) => sum + (t.prizePool || 0), 0);
  const baseFemalePrizePool = tournaments.filter(t => t.division === 'female').reduce((sum, t) => sum + (t.prizePool || 0), 0);

  // Combined: base prize pool (admin) + saweran (donations) — SEASON AGGREGATE
  const totalPrizePool = basePrizePoolTotal + donationTotal;
  const malePrizePool = baseMalePrizePool + maleDonationTotal;
  const femalePrizePool = baseFemalePrizePool + femaleDonationTotal;
  const seasonDonationTotal = seasonDonations.reduce((sum, d) => sum + d.amount, 0);

  // ── Build cross-division player lookup for donor matching ──
  // Defined early so it's available for both topDonors and sultanOfWeekly enrichment
  const playerByGamertag = new Map(
    (allPlayersForDonorMatching as any[]).map((p: any) => {
      const activeClub = p.clubMembers?.[0]?.profile;
      return [p.gamertag?.toLowerCase(), { ...p, club: activeClub ? { id: activeClub.id, name: activeClub.name, logo: activeClub.logo } : null }];
    })
  );

  // ── Top donors ──
  const donorAccum = new Map<string, { totalAmount: number; donationCount: number }>();
  for (const d of seasonDonations) {
    const entry = donorAccum.get(d.donorName) ?? { totalAmount: 0, donationCount: 0 };
    donorAccum.set(d.donorName, {
      totalAmount: entry.totalAmount + d.amount,
      donationCount: entry.donationCount + 1,
    });
  }
  const topDonors = Array.from(donorAccum.entries())
    .map(([donorName, data]) => {
      const matchedPlayer = playerByGamertag.get(donorName?.toLowerCase());
      return {
        donorName,
        totalAmount: data.totalAmount,
        donationCount: data.donationCount,
        player: matchedPlayer ? {
          id: matchedPlayer.id,
          gamertag: matchedPlayer.gamertag,
          avatar: matchedPlayer.avatar,
          tier: matchedPlayer.tier,
          points: matchedPlayer.points,
          totalWins: matchedPlayer.totalWins,
          totalMvp: matchedPlayer.totalMvp,
          streak: matchedPlayer.streak,
          division: matchedPlayer.division,
          city: matchedPlayer.city || null,
          club: matchedPlayer.club || null,
        } : null,
      };
    })
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 10);

  // ── Season progress ──
  const completedWeeks = tournaments.filter(t => t.status === 'completed').length;

  // ── MVP Hall of Fame ──
  const mvpHallOfFame = completedTournaments
    .flatMap(t =>
      t.participations.map((p: any) => ({
        _sortKey: p.createdAt as Date,
        id: p.player.id, gamertag: p.player.gamertag, avatar: p.player.avatar,
        tier: p.player.tier, totalMvp: p.player.totalMvp, points: seasonPointsMap.get(p.player.id) || p.player.points,
        totalWins: p.player.totalWins, streak: p.player.streak,
        weekNumber: t.weekNumber, tournamentName: t.name,
      }))
    )
    .sort((a, b) => +b._sortKey - +a._sortKey)
    .map(({ _sortKey, ...rest }: any) => rest);

  // ── Sultan of the Week — top penyawer per tournament (SSR pre-fetch) ──
  // Replicates the same logic as /api/stats so the card renders immediately
  // instead of waiting for client-side React Query.
  const tournamentMap = new Map(tournaments.map((t: any) => [t.id, t]));

  // Group donations by tournamentId, then by donorName
  // Includes earliestDonationAt for automatic tie-breaking when amounts are equal
  const tournamentDonors = new Map<string, Map<string, { totalAmount: number; donationCount: number; earliestDonationAt: Date }>>();
  for (const d of seasonDonations as any[]) {
    if (!d.tournamentId) continue;
    const tId = d.tournamentId as string;
    if (!tournamentMap.has(tId)) continue; // Only include donations for tournaments in our list

    let donorMap = tournamentDonors.get(tId);
    if (!donorMap) {
      donorMap = new Map();
      tournamentDonors.set(tId, donorMap);
    }
    const donationDate = d.createdAt instanceof Date ? d.createdAt : new Date(d.createdAt as string | number);
    const existing = donorMap.get(d.donorName);
    donorMap.set(d.donorName, {
      totalAmount: (existing?.totalAmount || 0) + d.amount,
      donationCount: (existing?.donationCount || 0) + 1,
      earliestDonationAt: existing ? (existing.earliestDonationAt < donationDate ? existing.earliestDonationAt : donationDate) : donationDate,
    });
  }

  // ═══ playerByGamertag map already built above (before topDonors) ═══

  // ═══ For each tournament with donations, determine Sultan of the Week ═══
  // Tie-breaking rules (automatic, no admin intervention needed):
  //   1. Highest totalAmount wins
  //   2. If amounts are equal → earliest donation wins (first to donate)
  //   3. If still tied → most donation count wins (more active supporter)
  //   4. If still fully tied → Co-Sultan (both get the title)
  // Admin can still override via tournament.sultanPlayerId
  const sultanOfWeekly: any[] = [];

  // Build player info helper
  const buildPlayerInfo = (donorName: string) => {
    const matchedPlayer = playerByGamertag.get(donorName?.toLowerCase());
    if (!matchedPlayer) return null;
    return {
      id: matchedPlayer.id,
      gamertag: matchedPlayer.gamertag,
      avatar: matchedPlayer.avatar,
      tier: matchedPlayer.tier,
      points: matchedPlayer.points,
      totalWins: matchedPlayer.totalWins,
      totalMvp: matchedPlayer.totalMvp,
      streak: matchedPlayer.streak,
      division: matchedPlayer.division,
      city: matchedPlayer.city || null,
      club: matchedPlayer.club || null,
    };
  };

  for (const [tId, donorMap] of tournamentDonors) {
    const tournament = tournamentMap.get(tId);
    if (!tournament) continue;

    // Sort donors by: totalAmount DESC → earliestDonationAt ASC → donationCount DESC
    const sortedDonors = Array.from(donorMap.entries())
      .sort((a, b) => {
        if (b[1].totalAmount !== a[1].totalAmount) return b[1].totalAmount - a[1].totalAmount;
        // Tie-break 1: earliest donation wins
        const timeDiff = +a[1].earliestDonationAt - +b[1].earliestDonationAt;
        if (timeDiff !== 0) return timeDiff;
        // Tie-break 2: more donations wins
        return b[1].donationCount - a[1].donationCount;
      });
    if (sortedDonors.length === 0) continue;

    // ─── Check for Co-Sultan (amounts truly equal after tie-breaks) ───
    const topAmount = sortedDonors[0][1].totalAmount;
    const coSultans = sortedDonors.filter(([_, data]) => data.totalAmount === topAmount);
    const isCoSultan = coSultans.length > 1;

    // Sultan override: if admin manually set sultanPlayerId
    if ((tournament as any).sultanPlayerId) {
      const overridePlayer = playerByGamertag.get(
        (allPlayersForDonorMatching as any[]).find((p: any) => p.id === (tournament as any).sultanPlayerId)?.gamertag?.toLowerCase() || ''
      );

      let playerInfo: any = null;
      if (overridePlayer) {
        playerInfo = {
          id: overridePlayer.id, gamertag: overridePlayer.gamertag, avatar: overridePlayer.avatar,
          tier: overridePlayer.tier, points: overridePlayer.points,
          totalWins: overridePlayer.totalWins, totalMvp: overridePlayer.totalMvp,
          streak: overridePlayer.streak, division: overridePlayer.division,
          city: overridePlayer.city || null, club: overridePlayer.club || null,
        };
      }

      const allDonorsList = sortedDonors.map(([name, data]: [string, any]) => ({
        donorName: name, totalAmount: data.totalAmount, donationCount: data.donationCount,
        player: buildPlayerInfo(name),
      }));

      sultanOfWeekly.push({
        weekNumber: tournament.weekNumber, tournamentName: tournament.name, tournamentId: tId,
        tournamentDivision: tournament.division,
        donorName: overridePlayer?.gamertag || sortedDonors[0]?.[0] || 'Anonymous',
        totalAmount: sortedDonors[0]?.[1]?.totalAmount || 0,
        donationCount: sortedDonors[0]?.[1]?.donationCount || 0,
        player: playerInfo,
        isCrossDivision: playerInfo ? playerInfo.division !== tournament.division : false,
        isOverride: true, isCoSultan: false, coSultans: [],
        allDonors: allDonorsList,
      });
      continue;
    }

    // Build full per-tournament donor list for leaderboard display
    const allDonorsList = sortedDonors.map(([name, data]: [string, any]) => ({
      donorName: name,
      totalAmount: data.totalAmount,
      donationCount: data.donationCount,
      player: buildPlayerInfo(name),
    }));

    // Co-Sultan: multiple donors with the same top amount
    if (isCoSultan) {
      const coSultanData = coSultans.map(([name, data]: [string, any]) => ({
        donorName: name, totalAmount: data.totalAmount, donationCount: data.donationCount,
        player: buildPlayerInfo(name),
        isCrossDivision: (() => {
          const p = playerByGamertag.get(name?.toLowerCase());
          return p ? p.division !== tournament.division : false;
        })(),
      }));

      sultanOfWeekly.push({
        weekNumber: tournament.weekNumber, tournamentName: tournament.name, tournamentId: tId,
        tournamentDivision: tournament.division,
        donorName: sortedDonors[0][0] || 'Anonymous',
        totalAmount: topAmount,
        donationCount: sortedDonors[0][1].donationCount,
        player: coSultanData[0].player,
        isCrossDivision: coSultanData[0].isCrossDivision,
        isCoSultan: true, isOverride: false, coSultans: coSultanData,
        allDonors: allDonorsList,
      });
      continue;
    }

    // Single Sultan (default case)
    const [topDonorName, topDonorData] = sortedDonors[0];
    const playerInfo = buildPlayerInfo(topDonorName);

    sultanOfWeekly.push({
      weekNumber: tournament.weekNumber,
      tournamentName: tournament.name,
      tournamentId: tId,
      tournamentDivision: tournament.division,
      donorName: topDonorName || 'Anonymous',
      totalAmount: topDonorData.totalAmount,
      donationCount: topDonorData.donationCount,
      player: playerInfo,
      isCrossDivision: playerInfo ? playerInfo.division !== tournament.division : false,
      isCoSultan: false, isOverride: false, coSultans: [],
      allDonors: allDonorsList,
    });
  }

  // Sort by weekNumber ascending
  sultanOfWeekly.sort((a, b) => a.weekNumber - b.weekNumber);

  // ═══ Compute Weekly Top Performers — "Bintang Minggu Ini" (SSR pre-fetch) ═══
  // Replicates the same composite score logic as /api/stats so the hero
  // section cards render immediately without waiting for React Query.
  let computedWeeklyTopPerformers: any[] = [];
  const latestTournamentForPerformers = [...tournaments]
    .filter(t => t.seasonId === activeSeasonId)
    .sort((a: any, b: any) => b.weekNumber - a.weekNumber)[0];

  if (latestTournamentForPerformers) {
    const [weeklyPointsRaw, weeklyParticipations, weeklyMatchesRaw] = await Promise.all([
      withDbRetry(() => db.playerPoint.groupBy({
        by: ['playerId'],
        where: { tournamentId: latestTournamentForPerformers.id },
        _sum: { amount: true },
      })),
      withDbRetry(() => db.participation.findMany({
        where: { tournamentId: latestTournamentForPerformers.id, status: 'approved' },
        include: { player: true },
      })),
      withDbRetry(() => db.match.findMany({
        where: { tournamentId: latestTournamentForPerformers.id, status: 'completed' },
        include: {
          winner: { include: { teamPlayers: true } },
          loser: { include: { teamPlayers: true } },
        },
      })),
    ]);

    // Build match stats map
    const matchStatsMap = new Map<string, { wins: number; losses: number }>();
    for (const match of weeklyMatchesRaw as any[]) {
      if (match.winner?.teamPlayers) {
        for (const tp of match.winner.teamPlayers) {
          const existing = matchStatsMap.get(tp.playerId) || { wins: 0, losses: 0 };
          existing.wins++;
          matchStatsMap.set(tp.playerId, existing);
        }
      }
      if (match.loser?.teamPlayers) {
        for (const tp of match.loser.teamPlayers) {
          const existing = matchStatsMap.get(tp.playerId) || { wins: 0, losses: 0 };
          existing.losses++;
          matchStatsMap.set(tp.playerId, existing);
        }
      }
    }

    const weeklyPointsMap = new Map(
      weeklyPointsRaw.map((wp: any) => [wp.playerId, wp._sum.amount || 0])
    );
    const weeklyPartMap = new Map(
      weeklyParticipations.map((p: any) => [p.playerId, p])
    );
    const topPlayersMap = new Map(
      topPlayers.map((p: any) => [p.id, p])
    );

    const candidates: any[] = [];
    for (const [playerId, weeklyPts] of weeklyPointsMap) {
      const player = topPlayersMap.get(playerId);
      if (!player) continue;
      const matchStats = matchStatsMap.get(playerId) || { wins: 0, losses: 0 };
      const totalMatches = matchStats.wins + matchStats.losses;
      const matchWinRate = totalMatches > 0 ? Math.round((matchStats.wins / totalMatches) * 100) : 0;
      candidates.push({
        id: player.id, gamertag: player.gamertag, avatar: player.avatar,
        tier: player.tier || 'B', points: player.seasonPoints ?? player.points ?? 0,
        weeklyPointsGained: weeklyPts, weeklyWins: matchStats.wins, weeklyLosses: matchStats.losses,
        weeklyMatches: totalMatches, weeklyWinRate: matchWinRate, streak: player.streak ?? 0,
        city: player.city, club: player.clubMembers?.[0]?.profile?.name ?? null,
      });
    }
    for (const [playerId, part] of weeklyPartMap) {
      if (weeklyPointsMap.has(playerId)) continue;
      const player = topPlayersMap.get(playerId);
      if (!player) continue;
      const matchStats = matchStatsMap.get(playerId) || { wins: 0, losses: 0 };
      const totalMatches = matchStats.wins + matchStats.losses;
      const matchWinRate = totalMatches > 0 ? Math.round((matchStats.wins / totalMatches) * 100) : 0;
      candidates.push({
        id: player.id, gamertag: player.gamertag, avatar: player.avatar,
        tier: player.tier || 'B', points: player.seasonPoints ?? player.points ?? 0,
        weeklyPointsGained: (part as any).pointsEarned ?? 0,
        weeklyWins: matchStats.wins, weeklyLosses: matchStats.losses,
        weeklyMatches: totalMatches, weeklyWinRate: matchWinRate, streak: player.streak ?? 0,
        city: player.city, club: player.clubMembers?.[0]?.profile?.name ?? null,
      });
    }

    if (candidates.length > 0) {
      const maxWeeklyPts = Math.max(...candidates.map(c => c.weeklyPointsGained), 1);
      const maxStreak = Math.max(...candidates.map(c => c.streak), 1);
      const tierScore = (tier: string) => { const t = tier.toUpperCase(); if (t === 'B') return 100; if (t === 'A') return 50; return 0; };

      for (const c of candidates) {
        c.compositeScore = Math.round(
          ((c.weeklyPointsGained / maxWeeklyPts) * 100) * 0.40 +
          c.weeklyWinRate * 0.25 +
          ((c.streak / maxStreak) * 100) * 0.15 +
          (c.weeklyWins > 0 ? 100 : 0) * 0.10 +
          tierScore(c.tier) * 0.10
        );
      }

      const tierRank = (tier: string) => { const t = tier.toUpperCase(); if (t === 'B') return 1; if (t === 'A') return 2; return 3; };
      candidates.sort((a, b) => {
        if (b.compositeScore !== a.compositeScore) return b.compositeScore - a.compositeScore;
        return tierRank(a.tier) - tierRank(b.tier);
      });

      computedWeeklyTopPerformers = candidates.slice(0, 5).map(c => ({
        ...c, division: c.division || divisionFilter, weekNumber: latestTournamentForPerformers.weekNumber,
      }));
    }
  }

  // ── Active Tournament + Prize Pool (SSR) ──
  // Find the active tournament: non-completed first, then latest in season
  // This must match the /api/stats logic for consistency
  const activeTournamentData = tournaments.find(t => t.status !== 'completed')
    || tournaments[tournaments.length - 1]
    || null;

  // Compute activeTournamentPrizePool: base prize pool + that tournament's weekly donations
  // When the "active" tournament is actually completed (no new week yet), prize pool resets to 0.
  const isActiveTournamentActuallyActive = activeTournamentData && activeTournamentData.status !== 'completed';
  const activeTournamentBasePrizePool = isActiveTournamentActuallyActive ? (activeTournamentData.prizePool || 0) : 0;
  const activeTournamentWeeklyDonations = isActiveTournamentActuallyActive
    ? weeklyDonations.filter(d => d.tournamentId === activeTournamentData?.id)
    : [];
  const activeTournamentDonationTotal = activeTournamentWeeklyDonations.reduce((sum, d) => sum + d.amount, 0);
  const activeTournamentPrizePool = activeTournamentBasePrizePool + activeTournamentDonationTotal;

  // Build active tournament info object for the UI
  const activeTournamentInfo = activeTournamentData ? {
    id: activeTournamentData.id,
    name: activeTournamentData.name,
    weekNumber: activeTournamentData.weekNumber,
    status: activeTournamentData.status,
    format: activeTournamentData.format,
    prizePool: activeTournamentData.prizePool || 0,
    basePrizePool: activeTournamentData.prizePool || 0,
    bpm: activeTournamentData.bpm || null,
    location: activeTournamentData.location || null,
    scheduledAt: activeTournamentData.scheduledAt || null,
    _count: {
      teams: activeTournamentData._count?.teams || 0,
      participations: activeTournamentData._count?.participations || 0,
    },
  } : null;

  // ── Batch: player season stats (depends on club member player IDs) ──
  const memberPlayerIds = Array.from(new Set((batchClubMembers as any[]).map((cm: any) => cm.player.id)));

  // Build season number → IDs from allSeasons (replaces per-season db.season.findMany)
  const seasonNumberToIds = new Map<number, string[]>();
  for (const s of allSeasons) {
    const existing = seasonNumberToIds.get(s.number) || [];
    existing.push(s.id);
    seasonNumberToIds.set(s.number, existing);
  }

  const completedSeasonNumbers: number[] = Array.from(new Set(
    allSeasons.filter((s: any) => s.championPlayerId && s.status === 'completed').map((s: any) => s.number as number)
  ));
  const allStatsSeasonIds: string[] = Array.from(new Set(
    completedSeasonNumbers.flatMap(n => seasonNumberToIds.get(n) || [])
  ));

  // ★ INP/TTFB OPTIMIZATION: buildSkinMap removed from SSR.
  // It runs 2+ extra DB queries and processes data — only needed for avatar borders.
  // React Query will fill skinMap client-side on first fetch.
  // This cuts SSR DB queries by ~15% and reduces TTFB.

  // Run player season stats only (skip buildSkinMap in SSR)
  const batchPlayerSeasonStats = (memberPlayerIds.length > 0 && allStatsSeasonIds.length > 0)
    ? await withDbRetry(() => db.playerSeasonStats.findMany({
        where: { playerId: { in: memberPlayerIds }, seasonId: { in: allStatsSeasonIds } },
      }))
    : [];

  // Build stats map keyed by playerId → seasonNumber → { points, tier }
  // Replaces the per-season local statsMap with a single pre-computed structure
  const statsByPlayerAndSeasonNumber = new Map<string, Map<number, { points: number; tier: string }>>();
  for (const ps of batchPlayerSeasonStats as any[]) {
    const seasonForId = allSeasons.find(s => s.id === ps.seasonId);
    if (!seasonForId) continue;
    const sNumber = seasonForId.number;

    if (!statsByPlayerAndSeasonNumber.has(ps.playerId)) {
      statsByPlayerAndSeasonNumber.set(ps.playerId, new Map());
    }
    const playerStats = statsByPlayerAndSeasonNumber.get(ps.playerId)!;
    const existing = playerStats.get(sNumber);
    if (existing) {
      existing.points += ps.points;
      const tierOrder = ['S', 'A', 'B'];
      if (tierOrder.indexOf(ps.tier) < tierOrder.indexOf(existing.tier)) existing.tier = ps.tier;
    } else {
      playerStats.set(sNumber, { points: ps.points, tier: ps.tier });
    }
  }

  // ── Assemble allSeasonsInfo using batched lookup maps ───────
  // This replaces the Promise.all(allSeasons.map(async ...)) N+1 pattern
  // with synchronous map lookups over the pre-fetched batch data.
  const allSeasonsInfo = allSeasons.map((s: any) => {
    // ── Champion player ──
    let championPlayer: any = null;
    if (s.championPlayerId) {
      // Try snapshot first for completed seasons — use aggressively
      if (s.championPlayerSnapshot && s.status === 'completed') {
        try {
          const snapshot = JSON.parse(s.championPlayerSnapshot);
          championPlayer = {
            id: s.championPlayerId,
            gamertag: snapshot.gamertag || '',
            avatar: snapshot.avatar || null,
            tier: snapshot.tier || 'B',
            points: snapshot.points || 0,
            totalWins: snapshot.totalWins || 0,
            totalMvp: snapshot.totalMvp || 0,
            streak: snapshot.streak || 0,
            maxStreak: snapshot.maxStreak || 0,
            matches: snapshot.matches || 0,
            club: snapshot.club || null,
            city: snapshot.city || null,
            division: snapshot.division,
            hasSeasonChampionSkin: true, // Season champions always have the virtual skin
          };

          // ★ Enrich snapshot with live data only when snapshot is missing fields.
          // Uses batched playersMap instead of per-season findUnique.
          if (!snapshot.avatar || !snapshot.city || (typeof snapshot.club === 'string' || !snapshot.club)) {
            const livePlayer = playersMap.get(s.championPlayerId);
            if (livePlayer) {
              if (!snapshot.avatar && livePlayer.avatar) {
                championPlayer.avatar = livePlayer.avatar;
              }
              if (!snapshot.city && (livePlayer as any).city) {
                championPlayer.city = (livePlayer as any).city;
              }
              if (typeof snapshot.club === 'string' || !snapshot.club) {
                const activeClub = (livePlayer as any).clubMembers?.[0]?.profile;
                if (activeClub) {
                  championPlayer.club = { id: activeClub.id, name: activeClub.name, logo: activeClub.logo };
                }
              }
            }
          }
        } catch { /* fallback to live data from batch */ }
      }

      if (!championPlayer) {
        const player = playersMap.get(s.championPlayerId);
        if (player) {
          const activeClubProfile = (player as any).clubMembers?.[0]?.profile;
          championPlayer = {
            id: player.id, gamertag: player.gamertag, avatar: player.avatar,
            tier: player.tier, points: s.championPlayerPoints ?? player.points,
            totalWins: player.totalWins, totalMvp: player.totalMvp,
            streak: player.streak, maxStreak: player.maxStreak, matches: player.matches,
            club: activeClubProfile ? { id: activeClubProfile.id, name: activeClubProfile.name, logo: activeClubProfile.logo } : null,
            city: player.city || null, division: player.division,
            hasSeasonChampionSkin: true, // Season champions always have the virtual skin
          };
        }
      }
    }

    // ── Champion club ──
    // ── Champion club ── (Tarkam: not used, always null)
    const championClub = null;

    // ── Sultan of Season (top penyawer) ──
    // Uses batched playersMap instead of per-season findUnique.
    let sultanPlayer: any = null;
    if (s.sultanPlayerId) {
      const sultan = playersMap.get(s.sultanPlayerId);
      if (sultan) {
        const activeClub = (sultan as any).clubMembers?.[0]?.profile;
        sultanPlayer = {
          id: sultan.id,
          gamertag: sultan.gamertag,
          avatar: sultan.avatar,
          division: sultan.division,
          tier: sultan.tier,
          points: sultan.points,
          city: sultan.city || null,
          club: activeClub ? { id: activeClub.id, name: activeClub.name, logo: activeClub.logo } : null,
        };
      }
    }

    return {
      id: s.id, name: s.name, number: s.number, status: s.status,
      startDate: s.startDate, endDate: s.endDate,
      tournamentCount: s._count?.tournaments ?? 0,
      championPlayerId: s.championPlayerId,
      championPlayer,
      sultanPlayerId: s.sultanPlayerId,
      sultanPlayer,
    };
  });

  return {
    hasData: true,
    division,
    season: { id: season.id, name: season.name, number: season.number, status: season.status },
    allSeasons: allSeasonsInfo,
    topPlayers,
    clubs: flatClubs,
    weeklyChampions,
    mvpHallOfFame,
    totalPlayers,
    approvedPlayerCount,
    totalPrizePool,
    malePrizePool,
    femalePrizePool,
    activeTournamentPrizePool, // Computed from active tournament base + its donations
    seasonDonationTotal,
    topDonors,
    seasonProgress: {
      totalWeeks: SEASON_TOTAL_WEEKS,
      completedWeeks,
      percentage: SEASON_TOTAL_WEEKS > 0 ? Math.round((completedWeeks / SEASON_TOTAL_WEEKS) * 100) : 0,
    },
    // ── Simplified fields: loaded by client-side React Query ──
    skinMap: {},
    weeklyTopPerformers: computedWeeklyTopPerformers,
    sultanOfWeekly,
    recentMatches: [] as any[],
    upcomingMatches: [] as any[],
    activeTournament: activeTournamentInfo,
  };
}

// ─── Cached wrapper — errors are NOT cached ───────────────────
const fetchLandingStatsCached = unstable_cache(
  fetchLandingStatsInner,
  ['landing-stats'],
  { revalidate: 600, tags: ['landing-stats'] }
);

/**
 * Fetch essential stats data for the landing page SSR.
 * Returns data compatible with the StatsData type used by components.
 * Some fields are simplified (empty arrays) — React Query fills them client-side.
 *
 * Wrapped with unstable_cache keyed on division, revalidating every 120s
 * with tag 'landing-stats' for on-demand revalidation.
 */
export async function fetchLandingStats(division: 'male' | 'female') {
  try {
    return await fetchLandingStatsCached(division);
  } catch (error) {
    console.error(`[landing-data] Failed to fetch ${division} stats:`, error);
    return null;
  }
}

