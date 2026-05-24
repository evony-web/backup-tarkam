import { db } from '@/lib/db';

// Types for achievement criteria
interface AchievementCriteria {
  type: string;
  count?: number;
  threshold?: number;
  consecutive?: boolean;
}

// Achievement check result
interface AchievementResult {
  achievementId: string;
  achievementName: string;
  displayName: string;
  icon: string;
  tier: string;
  rewardPoints: number;
  playerId: string;
  gamertag: string;
  context?: Record<string, unknown>;
}

/**
 * Check and award achievements for a player after tournament finalization
 */
export async function checkAndAwardAchievements(
  playerId: string,
  tournamentId: string
): Promise<AchievementResult[]> {
  const results: AchievementResult[] = [];

  // Get player with all relevant data
  const player = await db.player.findUnique({
    where: { id: playerId },
    include: {
      participations: {
        include: { tournament: true },
        orderBy: { createdAt: 'asc' },
      },
      achievements: { include: { achievement: true } },
      clubMembers: { include: { profile: true } },
    },
  });

  if (!player) return results;

  // Get all active achievements
  const allAchievements = await db.achievement.findMany({
    where: { isActive: true },
  });

  // Track which achievements player already has
  const earnedNames = new Set(player.achievements.map(pa => pa.achievement.name));

  // Check each achievement
  for (const achievement of allAchievements) {
    if (earnedNames.has(achievement.name)) continue;

    const criteria: AchievementCriteria = JSON.parse(achievement.criteria);
    const checkResult = await checkAchievementCriteria(
      player as unknown as Parameters<typeof checkAchievementCriteria>[0],
      criteria,
      tournamentId
    );

    if (checkResult.earned) {
      // Award the achievement
      await db.playerAchievement.create({
        data: {
          playerId: player.id,
          achievementId: achievement.id,
          tournamentId: tournamentId,
          context: checkResult.context ? JSON.stringify(checkResult.context) : null,
        },
      });

      // Achievement badge only — NO bonus points awarded
      // Points come from: match wins, streak bonus, and prize juara only
      // Achievement reward points are intentionally NOT added to player total

      results.push({
        achievementId: achievement.id,
        achievementName: achievement.name,
        displayName: achievement.displayName,
        icon: achievement.icon,
        tier: achievement.tier,
        rewardPoints: achievement.rewardPoints,
        playerId: player.id,
        gamertag: player.gamertag,
        context: checkResult.context,
      });

      // Add to earned set to prevent duplicates
      earnedNames.add(achievement.name);
    }
  }

  return results;
}

/**
 * Check if player meets achievement criteria
 */
async function checkAchievementCriteria(
  player: {
    id: string;
    gamertag: string;
    points: number;
    totalWins: number;
    totalMvp: number;
    participations: Array<{
      id: string;
      tournamentId: string;
      isWinner: boolean;
      isMvp: boolean;
      pointsEarned: number;
      tournament: { weekNumber: number; createdAt: Date };
    }>;
    clubMembers: Array<{ clubId: string; profileId: string; club: { name: string } }>;
  },
  criteria: AchievementCriteria,
  currentTournamentId: string
): Promise<{ earned: boolean; context?: Record<string, unknown> }> {
  switch (criteria.type) {
    case 'wins': {
      // Get all tournament wins
      const wins = player.participations.filter(p => p.isWinner);
      const winCount = wins.length;

      if (criteria.consecutive) {
        // Check for consecutive wins
        const recentParticipations = await db.participation.findMany({
          where: { 
            playerId: player.id, 
            isWinner: true,
            tournament: { status: 'completed' }
          },
          include: { tournament: true },
          orderBy: { createdAt: 'desc' },
          take: criteria.count || 2,
        });

        if (recentParticipations.length >= (criteria.count || 2)) {
          const weeks = recentParticipations.map(p => p.tournament.weekNumber).sort((a, b) => b - a);
          let consecutive = true;
          for (let i = 1; i < weeks.length; i++) {
            if (weeks[i - 1] - weeks[i] !== 1) {
              consecutive = false;
              break;
            }
          }
          
          if (consecutive) {
            return { 
              earned: true, 
              context: { 
                winCount: recentParticipations.length,
                weeks: weeks,
              } 
            };
          }
        }
        return { earned: false };
      } else {
        // Non-consecutive, just count wins
        if (winCount >= (criteria.count || 1)) {
          return { earned: true, context: { winCount } };
        }
      }
      return { earned: false };
    }

    case 'top3_count': {
      // Only count Juara 1 wins (isWinner = true), not all podium positions
      const juara1Count = player.participations.filter(p => p.isWinner).length;
      if (juara1Count >= (criteria.count || 5)) {
        return { earned: true, context: { top3Count: juara1Count } };
      }
      return { earned: false };
    }

    case 'participations': {
      const participationCount = player.participations.length;
      if (participationCount >= (criteria.count || 10)) {
        return { earned: true, context: { participationCount } };
      }
      return { earned: false };
    }

    case 'mvp_count': {
      const mvpCount = player.totalMvp;
      if (mvpCount >= (criteria.count || 1)) {
        return { earned: true, context: { mvpCount } };
      }
      return { earned: false };
    }

    case 'mvp_streak': {
      const mvpParticipations = await db.participation.findMany({
        where: {
          playerId: player.id,
          isMvp: true,
          tournament: { status: 'completed' }
        },
        include: { tournament: true },
        orderBy: { createdAt: 'desc' },
        take: criteria.count || 2,
      });

      if (mvpParticipations.length >= (criteria.count || 2)) {
        const weeks = mvpParticipations.map(p => p.tournament.weekNumber).sort((a, b) => b - a);
        let consecutive = true;
        for (let i = 1; i < weeks.length; i++) {
          if (weeks[i - 1] - weeks[i] !== 1) {
            consecutive = false;
            break;
          }
        }
        
        if (consecutive) {
          return { earned: true, context: { streak: weeks.length, weeks } };
        }
      }
      return { earned: false };
    }

    case 'points': {
      if (player.points >= (criteria.threshold || 100)) {
        return { earned: true, context: { totalPoints: player.points } };
      }
      return { earned: false };
    }

    case 'club_win': {
      const currentParticipation = player.participations.find(p => p.tournamentId === currentTournamentId);
      if (currentParticipation?.isWinner && player.clubMembers.length > 0) {
        return { earned: true, context: { clubId: player.clubMembers[0].profileId } };
      }
      return { earned: false };
    }

    case 'club_dominance': {
      if (player.clubMembers.length === 0) return { earned: false };

      const profileId = player.clubMembers[0].profileId;

      const clubMembers = await db.clubMember.findMany({
        where: { profileId, leftAt: null },
        include: { player: { include: { participations: true } } },
      });

      const winnersInTournament = clubMembers.filter(cm => 
        cm.player.participations.some(p => 
          p.tournamentId === currentTournamentId && p.isWinner
        )
      );

      if (winnersInTournament.length >= (criteria.count || 3)) {
        return { 
          earned: true, 
          context: { 
            clubId: profileId,
            winnerCount: winnersInTournament.length,
            winners: winnersInTournament.map(w => w.player.gamertag),
          } 
        };
      }
      return { earned: false };
    }

    default:
      return { earned: false };
  }
}

/**
 * Get player achievements with details
 */
export async function getPlayerAchievements(playerId: string) {
  const achievements = await db.playerAchievement.findMany({
    where: { playerId },
    include: { 
      achievement: true,
      tournament: { select: { name: true, weekNumber: true } },
    },
    orderBy: { earnedAt: 'desc' },
  });

  return achievements.map(pa => ({
    id: pa.id,
    achievement: {
      id: pa.achievement.id,
      name: pa.achievement.name,
      displayName: pa.achievement.displayName,
      description: pa.achievement.description,
      category: pa.achievement.category,
      icon: pa.achievement.icon,
      tier: pa.achievement.tier,
    },
    tournament: pa.tournament ? { name: pa.tournament.name, weekNumber: pa.tournament.weekNumber } : null,
    context: pa.context ? JSON.parse(pa.context) : null,
    earnedAt: pa.earnedAt,
  }));
}

/**
 * Check achievements for all players in a tournament
 */
export async function checkTournamentAchievements(tournamentId: string): Promise<AchievementResult[]> {
  // Get all participants of the tournament
  const participations = await db.participation.findMany({
    where: { tournamentId },
    select: { playerId: true },
  });

  const allResults: AchievementResult[] = [];

  for (const participation of participations) {
    const results = await checkAndAwardAchievements(participation.playerId, tournamentId);
    allResults.push(...results);
  }

  return allResults;
}
