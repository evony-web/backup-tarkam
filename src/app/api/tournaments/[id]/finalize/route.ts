import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { SEASON_TOTAL_WEEKS } from '@/lib/constants';
import { awardPoints } from '@/lib/points';
import { checkTournamentAchievements } from '@/lib/achievements';
import { autoAwardTournamentSkins } from '@/lib/skin-auto-award';
import { getSafeErrorMessage } from '@/lib/api-error';
import { pusherTrigger, PUSHER_CHANNELS, PUSHER_EVENTS } from '@/lib/pusher';
import { createAuditLog } from '@/lib/audit';
import { revalidateTag, revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  let body: { mvpPlayerId?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is OK — mvpPlayerId is optional
  }
  const { mvpPlayerId } = body;

  try {
  const tournament = await db.tournament.findUnique({
    where: { id },
    include: {
      matches: { include: { team1: true, team2: true, winner: true, loser: true, mvpPlayer: true }, orderBy: { round: 'asc' } },
      teams: { include: { teamPlayers: { include: { player: true } } } },
      participations: { include: { player: true } },
      prizes: { orderBy: { position: 'asc' } },
    },
  });

  if (!tournament) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  }

  // Auto-advance: Handle various statuses that can lead to finalization
  // Bug fix: Previously only handled main_event → finalization.
  // Now also handles bracket_generation (if all matches done) and ensures proper flow.
  const playableIncomplete = tournament.matches.filter(
    m => (m.status === 'pending' || m.status === 'ready' || m.status === 'live') && m.team1Id && m.team2Id
  );
  const completedMatches = tournament.matches.filter(m => m.status === 'completed');

  if (tournament.status === 'main_event') {
    if (playableIncomplete.length === 0 && completedMatches.length > 0) {
      // All playable matches are done — auto-advance to finalization
      await db.tournament.update({ where: { id }, data: { status: 'finalization' } });
      tournament.status = 'finalization';
    } else if (playableIncomplete.length > 0) {
      return NextResponse.json({
        error: `Masih ada ${playableIncomplete.length} pertandingan yang belum selesai (${playableIncomplete.map(m => m.status).filter((v, i, a) => a.indexOf(v) === i).join(', ')}). Selesaikan semua match terlebih dahulu.`,
      }, { status: 400 });
    } else {
      return NextResponse.json({
        error: 'Tournament belum ada match yang selesai. Mainkan dan selesaikan pertandingan terlebih dahulu sebelum finalisasi.',
      }, { status: 400 });
    }
  } else if (tournament.status === 'bracket_generation') {
    // If bracket was just generated and all matches are already done (e.g., auto-completed),
    // advance through main_event to finalization
    if (playableIncomplete.length === 0 && completedMatches.length > 0) {
      await db.tournament.update({ where: { id }, data: { status: 'finalization' } });
      tournament.status = 'finalization';
    } else {
      return NextResponse.json({
        error: 'Tournament masih dalam fase bracket generation. Mulai event (main_event) dan selesaikan semua match terlebih dahulu.',
      }, { status: 400 });
    }
  }

  if (tournament.status !== 'finalization') {
    return NextResponse.json({ 
      error: `Tournament harus dalam status finalization. Status saat ini: ${tournament.status}. ${
        tournament.status === 'team_generation' ? 'Generate bracket terlebih dahulu, lalu mainkan dan selesaikan semua match.' :
        tournament.status === 'approval' ? 'Setujui peserta dan generate tim terlebih dahulu.' :
        tournament.status === 'registration' ? 'Buka registrasi dan setujui peserta terlebih dahulu.' :
        tournament.status === 'setup' ? 'Lengkapi setup tournament terlebih dahulu.' :
        tournament.status === 'completed' ? 'Tournament sudah difinalisasi. Tidak bisa finalisasi ulang.' :
        'Lanjutkan proses tournament hingga fase main_event, selesaikan semua match, lalu finalisasi.'
      }` 
    }, { status: 400 });
  }

  // Re-check incomplete matches after auto-advance (data is from original fetch, should be consistent)
  // Matches with null teams (unfilled bracket slots) are OK — they were never playable
  if (playableIncomplete.length > 0) {
    return NextResponse.json({
      error: `Masih ada ${playableIncomplete.length} pertandingan yang belum selesai. Semua match harus diselesaikan sebelum finalisasi.`,
    }, { status: 400 });
  }

  // Check if there are any completed matches at all
  if (completedMatches.length === 0) {
    return NextResponse.json({ error: 'Tournament belum ada match yang selesai. Tidak bisa finalisasi.' }, { status: 400 });
  }

  // ===== DETERMINE TEAM RANKINGS =====
  const format = tournament.format;

  let rank1TeamId: string | null = null;
  let rank2TeamId: string | null = null;
  let rank3TeamIds: string[] = [];

  if (format === 'single_elimination') {
    // Find the final match (highest round in upper bracket)
    const upperMatches = tournament.matches.filter(m => m.bracket === 'upper');
    const maxRound = Math.max(...upperMatches.map(m => m.round));
    const finalMatch = upperMatches.find(m => m.round === maxRound && m.status === 'completed');

    if (finalMatch) {
      rank1TeamId = finalMatch.winnerId;
      rank2TeamId = finalMatch.loserId;

      // Semi-final losers = rank 3
      const semiMatches = upperMatches.filter(m => m.round === maxRound - 1 && m.status === 'completed');
      for (const sm of semiMatches) {
        if (sm.loserId && sm.loserId !== rank2TeamId) {
          rank3TeamIds.push(sm.loserId);
        }
      }
    }
  } else if (format === 'group_stage') {
    // Group Stage can use two different playoff formats:
    // 1. OLD: explicit 'Final' and '3rd' place match (groupLabel = 'Final', '3rd')
    // 2. NEW: double elimination with Grand Final + Lower Bracket (bracket = 'grand_final', 'lower')
    //
    // BUG FIX: Previously only handled old format (groupLabel === 'Final' / '3rd'),
    // which meant new double-elimination playoffs got NO rankings at all, or worse,
    // the LB Final WINNER was incorrectly assigned 3rd place instead of advancing to GF.
    //
    // Correct double-elimination ranking:
    // - Rank 1: Grand Final WINNER
    // - Rank 2: Grand Final LOSER
    // - Rank 3: Lower Bracket Final LOSER (the team eliminated in the last LB match)

    // Try new double-elimination format first
    const gfMatch = completedMatches.find(m => m.bracket === 'grand_final') ||
                    completedMatches.find(m => m.groupLabel === 'GF');

    if (gfMatch) {
      // Double elimination playoff format
      rank1TeamId = gfMatch.winnerId;
      rank2TeamId = gfMatch.loserId;

      // Find Lower Bracket Final (highest round in lower bracket)
      const lowerMatches = completedMatches.filter(m => m.bracket === 'lower');
      if (lowerMatches.length > 0) {
        const maxLowerRound = Math.max(...lowerMatches.map(m => m.round));
        const lowerFinal = lowerMatches.find(m => m.round === maxLowerRound);
        if (lowerFinal?.loserId) {
          rank3TeamIds = [lowerFinal.loserId]; // LOSER of LB Final = 3rd place
        }
      }
    } else {
      // Fallback: old-style group_stage with explicit Final and 3rd place match
      const finalMatch = tournament.matches.find(m => m.groupLabel === 'Final' && m.status === 'completed');
      const thirdMatch = tournament.matches.find(m => m.groupLabel === '3rd' && m.status === 'completed');

      if (finalMatch) {
        rank1TeamId = finalMatch.winnerId;
        rank2TeamId = finalMatch.loserId;
      }
      if (thirdMatch) {
        // In old format with explicit 3rd place match, the WINNER of that match is 3rd
        rank3TeamIds = thirdMatch.winnerId ? [thirdMatch.winnerId] : [];
      }
    }
  } else if (format === 'upper_semi') {
    // Double-elimination format (Upper Semi):
    // Brackets: upper (semi + upper final), lower (lower rounds + lower final), grand_final
    // Rank 1: Grand Final winner
    // Rank 2: Grand Final loser
    // Rank 3: Lower Bracket Final loser
    const completedMatches = tournament.matches.filter(m => m.status === 'completed');

    // Find Grand Final match
    let finalMatch = completedMatches.find(m => m.bracket === 'grand_final');
    if (!finalMatch) {
      // Fallback: match with groupLabel 'GF' or 'Final'
      finalMatch = completedMatches.find(m => m.groupLabel === 'GF' || m.groupLabel === 'Final');
    }

    if (finalMatch) {
      rank1TeamId = finalMatch.winnerId;
      rank2TeamId = finalMatch.loserId;
    }

    // Find Lower Bracket Final (highest round in lower bracket)
    const lowerMatches = completedMatches.filter(m => m.bracket === 'lower');
    if (lowerMatches.length > 0) {
      const maxLowerRound = Math.max(...lowerMatches.map(m => m.round));
      const lowerFinal = lowerMatches.find(m => m.round === maxLowerRound);
      if (lowerFinal?.loserId) {
        rank3TeamIds = [lowerFinal.loserId];
      }
    }

    // Fallback: if no Grand Final found, determine from match wins
    if (!rank1TeamId && tournament.teams.length > 0) {
      const teamWins: Record<string, number> = {};
      for (const team of tournament.teams) {
        teamWins[team.id] = 0;
      }
      for (const match of completedMatches) {
        if (match.winnerId && teamWins[match.winnerId] !== undefined) {
          teamWins[match.winnerId]++;
        }
      }

      const sortedTeamIds = Object.entries(teamWins)
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => id);

      if (sortedTeamIds[0]) rank1TeamId = sortedTeamIds[0];
      if (sortedTeamIds[1]) rank2TeamId = sortedTeamIds[1];
      if (sortedTeamIds[2]) rank3TeamIds = [sortedTeamIds[2]];
    }
  } else if (format === 'swiss') {
    // Swiss format: Swiss rounds followed by playoff bracket (SF/Final/3rd place)
    // The playoff matches use bracket='upper' (SF + Final) and bracket='lower' (3rd place)
    // OR they may use groupLabel='Final'/'3rd'/'SF1'/'SF2'
    const completedMatches = tournament.matches.filter(m => m.status === 'completed');

    // Try to find Final match by groupLabel first, then by bracket
    let finalMatch = completedMatches.find(m => m.groupLabel === 'Final');
    if (!finalMatch) {
      // Fallback: highest round in upper bracket = Final
      const upperMatches = completedMatches.filter(m => m.bracket === 'upper');
      if (upperMatches.length > 0) {
        const maxRound = Math.max(...upperMatches.map(m => m.round));
        finalMatch = upperMatches.find(m => m.round === maxRound);
      }
    }

    if (finalMatch) {
      rank1TeamId = finalMatch.winnerId;
      rank2TeamId = finalMatch.loserId;
    }

    // Try to find 3rd place match by groupLabel first, then by bracket
    let thirdMatch = completedMatches.find(m => m.groupLabel === '3rd');
    if (!thirdMatch) {
      // Fallback: highest round in lower bracket = 3rd place
      const lowerMatches = completedMatches.filter(m => m.bracket === 'lower');
      if (lowerMatches.length > 0) {
        const maxRound = Math.max(...lowerMatches.map(m => m.round));
        thirdMatch = lowerMatches.find(m => m.round === maxRound);
      }
    }

    if (thirdMatch) {
      rank3TeamIds = thirdMatch.winnerId ? [thirdMatch.winnerId] : [];
    }

    // If no playoff matches found (pure Swiss without playoffs),
    // determine rankings from Swiss round win counts
    if (!rank1TeamId && tournament.teams.length > 0) {
      // Count match wins per team
      const teamWins: Record<string, number> = {};
      for (const team of tournament.teams) {
        teamWins[team.id] = 0;
      }
      for (const match of completedMatches) {
        if (match.winnerId && teamWins[match.winnerId] !== undefined) {
          teamWins[match.winnerId]++;
        }
      }

      // Sort teams by wins descending
      const sortedTeamIds = Object.entries(teamWins)
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => id);

      if (sortedTeamIds[0]) rank1TeamId = sortedTeamIds[0];
      if (sortedTeamIds[1]) rank2TeamId = sortedTeamIds[1];
      if (sortedTeamIds[2]) rank3TeamIds = [sortedTeamIds[2]];
    }
  }

  // Update team ranks
  if (rank1TeamId) {
    await db.team.update({ where: { id: rank1TeamId }, data: { rank: 1, isWinner: true } });
  }
  if (rank2TeamId) {
    await db.team.update({ where: { id: rank2TeamId }, data: { rank: 2 } });
  }
  for (const tid of rank3TeamIds) {
    await db.team.update({ where: { id: tid }, data: { rank: 3 } });
  }

  // ===== AWARD PRIZE POINTS WITH AUDIT TRAIL =====
  // Bug #6 fix: Use position field for matching instead of label string matching
  // Tier upgrades are NO LONGER automatic — admin manually controls tier via approval/assignment
  // This prevents all players eventually reaching S tier over time

  // Build position → team map
  const positionTeamMap: Record<number, string | null> = {
    1: rank1TeamId,
    2: rank2TeamId,
    3: rank3TeamIds[0] || null,
  };

  // ===== MVP DESIGNATION — Always set when mvpPlayerId is provided =====
  // Bug fix: Previously, isMvp flag was ONLY set when an MVP prize existed.
  // This meant MVP never appeared in the Juara page if no MVP prize was configured.
  // Now, MVP designation (isMvp flag, mvpPlayerId on match, totalMvp increment)
  // is ALWAYS set when admin provides mvpPlayerId, regardless of prize existence.
  // Prize point awarding is separate and still conditional on isMvpPrize.
  let mvpPrizePointsAwarded = false;

  // Map prize reason
  const getPrizeReason = (position: number, label: string): string => {
    const l = label.toLowerCase();
    if (l.includes('mvp') || position === 99) return 'prize_mvp';
    if (position === 1 || l.includes('juara 1') || l.includes('1st') || l.includes('champion')) return 'prize_juara1';
    if (position === 2 || l.includes('juara 2') || l.includes('2nd') || l.includes('runner')) return 'prize_juara2';
    if (position === 3 || l.includes('juara 3') || l.includes('3rd')) return 'prize_juara3';
    return 'prize_other';
  };

  if (mvpPlayerId) {
    const mvpPlayer = await db.player.findUnique({ where: { id: mvpPlayerId } });
    if (mvpPlayer) {
      // Always increment totalMvp and set isMvp flag on participation
      await db.player.update({
        where: { id: mvpPlayerId },
        data: { totalMvp: mvpPlayer.totalMvp + 1 },
      });

      const mvpPart = await db.participation.findUnique({
        where: { playerId_tournamentId: { playerId: mvpPlayerId, tournamentId: id } },
      });
      if (mvpPart) {
        await db.participation.update({
          where: { id: mvpPart.id },
          data: { isMvp: true },
        });
      }

      // Set MVP on the grand final / last match
      const lastMatch = tournament.matches
        .filter(m => m.status === 'completed')
        .sort((a, b) => b.round - a.round)[0];
      if (lastMatch) {
        await db.match.update({ where: { id: lastMatch.id }, data: { mvpPlayerId } });
      }
    }
  }

  for (const prize of tournament.prizes) {
    const isMvpPrize = prize.label.toLowerCase().includes('mvp') || prize.position === 99;

    if (isMvpPrize && mvpPlayerId && !mvpPrizePointsAwarded) {
      // Award MVP prize points (separate from MVP designation above)
      const player = await db.player.findUnique({ where: { id: mvpPlayerId } });
      if (player) {
        await awardPoints({
          playerId: mvpPlayerId,
          amount: prize.pointsPerPlayer,
          reason: getPrizeReason(prize.position, prize.label),
          description: `MVP - ${tournament.name}`,
          tournamentId: id,
          seasonId: tournament.seasonId,
        });

        const part = await db.participation.findUnique({
          where: { playerId_tournamentId: { playerId: mvpPlayerId, tournamentId: id } },
        });
        if (part) {
          await db.participation.update({
            where: { id: part.id },
            data: { pointsEarned: part.pointsEarned + prize.pointsPerPlayer },
          });
        }

        mvpPrizePointsAwarded = true; // Only award MVP prize points once
      }
    } else if (!isMvpPrize) {
      // Bug #6 fix: Use position field first, fall back to label matching
      let targetTeamId: string | null = null;

      // Primary: use position field (1=1st, 2=2nd, 3=3rd)
      if (prize.position >= 1 && prize.position <= 3) {
        targetTeamId = positionTeamMap[prize.position] || null;
      }

      // Fallback: if position is 0 or invalid, try label matching
      if (!targetTeamId && prize.position === 0) {
        const l = prize.label.toLowerCase();
        if (l.includes('juara 1') || l.includes('1st') || l.includes('champion')) {
          targetTeamId = rank1TeamId;
        } else if (l.includes('juara 2') || l.includes('2nd') || l.includes('runner')) {
          targetTeamId = rank2TeamId;
        } else if (l.includes('juara 3') || l.includes('3rd')) {
          targetTeamId = rank3TeamIds[0] || null;
        }
      }

      if (targetTeamId) {
        const team = await db.team.findUnique({
          where: { id: targetTeamId },
          include: { teamPlayers: { include: { player: true } } },
        });

        if (team) {
          for (const tp of team.teamPlayers) {
            await awardPoints({
              playerId: tp.playerId,
              amount: prize.pointsPerPlayer,
              reason: getPrizeReason(prize.position, prize.label),
              description: `${prize.label} - ${tournament.name} (${team.name})`,
              tournamentId: id,
              seasonId: tournament.seasonId,
            });

            const part = await db.participation.findUnique({
              where: { playerId_tournamentId: { playerId: tp.playerId, tournamentId: id } },
            });
            if (part) {
              await db.participation.update({
                where: { id: part.id },
                data: {
                  pointsEarned: part.pointsEarned + prize.pointsPerPlayer,
                  isWinner: rank1TeamId === targetTeamId,
                },
              });
            }

            // No automatic tier upgrade — admin controls tier manually
          }
        }
      }
    }
  }

  // ===== FIX isWinner FLAG — Only Juara 1 should have isWinner=true =====
  // The score route sets isWinner=true for any match win, but for achievements
  // and skins, isWinner should ONLY mean "tournament champion (Juara 1)"
  try {
    // Get all participation IDs for this tournament
    const allParticipations = tournament.participations;
    // Get Juara 1 team player IDs
    const juara1PlayerIds = new Set<string>();
    if (rank1TeamId) {
      const juara1Team = await db.team.findUnique({
        where: { id: rank1TeamId },
        include: { teamPlayers: true },
      });
      if (juara1Team) {
        for (const tp of juara1Team.teamPlayers) {
          juara1PlayerIds.add(tp.playerId);
        }
      }
    }
    // Set isWinner=false for all non-Juara-1 players
    for (const part of allParticipations) {
      if (!juara1PlayerIds.has(part.playerId) && part.isWinner) {
        await db.participation.update({
          where: { id: part.id },
          data: { isWinner: false },
        });
      }
    }
  } catch (e) {
    console.error('Fix isWinner flag error (non-fatal):', e);
  }

  // ===== FINALIZE TOURNAMENT =====
  await db.tournament.update({
    where: { id },
    data: { status: 'completed', finalizedAt: new Date(), completedAt: new Date() },
  });

  // ===== INVALIDATE CACHES =====
  // Finalization changes champion data, standings, and points —
  // must purge all relevant caches so the landing page and dashboard update immediately.
  try {
    revalidateTag('landing-stats', 'max');
    revalidateTag('stats-data', 'max'); // Match Surrogate-Key used by /api/stats
    revalidatePath('/');
    revalidatePath('/api/stats');
  } catch (cacheErr) {
    console.warn('[FINALIZE] Cache revalidation failed (non-critical):', cacheErr);
  }

  // ===== UPDATE SEASON CHAMPION after each tournament finalization =====
  // Bug fix: Previously, championPlayerId was ONLY set when the season auto-closed
  // (all weeks completed). This meant the "Season Champion" section in the Juara
  // page never showed any data until the entire season was finished.
  // Now we update championPlayerId after EVERY finalization so the current leader
  // appears as "Season Champion" in real-time.
  try {
    const season = await db.season.findUnique({
      where: { id: tournament.seasonId },
      select: { id: true, division: true, status: true, number: true },
    });

    if (season) {
      const completedCount = await db.tournament.count({
        where: { seasonId: tournament.seasonId, status: 'completed' },
      });

      const isSeasonComplete = completedCount >= SEASON_TOTAL_WEEKS;

      // Build update data
      const updateData: {
        status?: string;
        endDate?: Date;
        championClubId?: string | null;
        championPlayerId?: string | null;
        championPlayerPoints?: number | null;
        championPlayerSnapshot?: string | null;
        championClubSnapshot?: string | null;
      } = {};

      if (isSeasonComplete) {
        updateData.status = 'completed';
        updateData.endDate = new Date();
      }

      if (season.division === 'liga') {
        // Liga mode: champion is the club with most points in this season
        const topClub = await db.club.findFirst({
          where: { seasonId: tournament.seasonId },
          orderBy: [{ points: 'desc' }, { gameDiff: 'desc' }],
          include: { profile: { select: { id: true, name: true, logo: true } } },
        });
        updateData.championClubId = topClub?.profileId || null;

        // Snapshot the champion club data
        if (topClub?.profile) {
          updateData.championClubSnapshot = JSON.stringify({
            name: topClub.profile.name,
            logo: topClub.profile.logo,
            wins: topClub.wins,
            losses: topClub.losses,
            points: topClub.points,
            gameDiff: topClub.gameDiff,
          });
        }
      } else {
        // Tarkam mode: champion is the player with most per-season points
        // Compute from PlayerPoint records (not lifetime Player.points)
        const seasonPoints = await db.playerPoint.groupBy({
          by: ['playerId'],
          where: { seasonId: tournament.seasonId },
          _sum: { amount: true },
        });

        // Get player details for tiebreaking AND snapshot
        const playerIds = seasonPoints.map(sp => sp.playerId);
        const players = await db.player.findMany({
          where: { id: { in: playerIds }, division: season.division || 'male', isActive: true },
          include: {
            clubMembers: {
              where: { leftAt: null },
              include: { profile: { select: { name: true } } },
              take: 1,
            },
          },
        });
        const playerMap = new Map(players.map(p => [p.id, p]));

        // Sort by per-season points desc, then totalWins desc as tiebreaker
        seasonPoints.sort((a, b) => {
          const ptsA = a._sum.amount || 0;
          const ptsB = b._sum.amount || 0;
          if (ptsB !== ptsA) return ptsB - ptsA;
          const winsA = playerMap.get(a.playerId)?.totalWins || 0;
          const winsB = playerMap.get(b.playerId)?.totalWins || 0;
          return winsB - winsA;
        });

        const championId = seasonPoints[0]?.playerId;
        updateData.championPlayerId = championId || null;
        updateData.championPlayerPoints = seasonPoints[0]?._sum.amount || null;

        // Snapshot the champion player data (at time of this finalization)
        if (championId) {
          const champion = playerMap.get(championId);
          if (champion) {
            const activeClub = champion.clubMembers[0]?.profile?.name || null;
            updateData.championPlayerSnapshot = JSON.stringify({
              gamertag: champion.gamertag,
              avatar: champion.avatar,
              tier: champion.tier,
              points: seasonPoints[0]?._sum.amount || 0, // Per-season points (not lifetime)
              totalWins: champion.totalWins,
              totalMvp: champion.totalMvp,
              streak: champion.streak,
              maxStreak: champion.maxStreak,
              matches: champion.matches,
              club: activeClub,
              division: champion.division,
            });
          }
        }
      }

      await db.season.update({
        where: { id: tournament.seasonId },
        data: updateData,
      });
    }
  } catch (e) {
    console.error('Update season champion error (non-fatal):', e);
    // Don't fail finalization if season champion update fails
  }

  // ===== CHECK AND AWARD ACHIEVEMENTS =====
  let achievementsAwarded: Awaited<ReturnType<typeof checkTournamentAchievements>> = [];
  try {
    achievementsAwarded = await checkTournamentAchievements(id);
  } catch (e) {
    console.error('Achievement check error (non-fatal):', e);
    // Don't fail finalization if achievement check fails
  }

  // ===== AUTO-AWARD SKINS (Champion + MVP) =====
  let skinsAwarded: { playerId: string; gamertag: string; skinType: string; displayName: string; action: string }[] = [];
  try {
    // Build team rankings array for all podium positions
    const teamRankings: Array<{ teamId: string; rank: number }> = [];
    if (rank1TeamId) teamRankings.push({ teamId: rank1TeamId, rank: 1 });
    if (rank2TeamId) teamRankings.push({ teamId: rank2TeamId, rank: 2 });
    for (const tid of rank3TeamIds) {
      teamRankings.push({ teamId: tid, rank: 3 });
    }
    skinsAwarded = await autoAwardTournamentSkins(id, teamRankings, mvpPlayerId ?? null, authResult.id);
  } catch (e) {
    console.error('Auto-award skins error (non-fatal):', e);
    // Don't fail finalization if skin awarding fails
  }

  const result = await db.tournament.findUnique({
    where: { id },
    include: {
      matches: { include: { team1: true, team2: true, winner: true, mvpPlayer: true }, orderBy: { round: 'asc' } },
      teams: { include: { teamPlayers: { include: { player: true } } }, orderBy: { rank: 'asc' } },
      participations: { include: { player: true }, orderBy: { pointsEarned: 'desc' } },
      prizes: { orderBy: { position: 'asc' } },
    },
  });

  // Pusher: Notify real-time clients about tournament finalization
  void pusherTrigger(PUSHER_CHANNELS.TOURNAMENT, PUSHER_EVENTS.TOURNAMENT_FINALIZED, {
    tournamentId: id, division: tournament.division, weekNumber: tournament.weekNumber,
  });
  void pusherTrigger(PUSHER_CHANNELS.LEADERBOARD, PUSHER_EVENTS.LEADERBOARD_UPDATED, {
    division: tournament.division, seasonId: tournament.seasonId,
  });
  void pusherTrigger(PUSHER_CHANNELS.FEED, PUSHER_EVENTS.FEED_UPDATED, {
    type: 'finalized', tournamentId: id,
  });

  await createAuditLog({
    adminId: authResult.id,
    adminName: authResult.username,
    action: 'update',
    entity: 'tournament',
    entityId: id,
    details: 'Finalisasi turnamen',
  });

  return NextResponse.json({ ...result, achievementsAwarded, skinsAwarded });

  } catch (error: unknown) {
    console.error('Finalization error:', error);
    return NextResponse.json({ error: getSafeErrorMessage(error) }, { status: 500 });
  }
}
