// @ts-nocheck
/**
 * Match Advancement Logic
 * Handles winner advancement and bracket updates
 */

import { db } from '@/lib/db'
import { BracketType, MatchStatus, TournamentStatus } from '@prisma/client'

export interface AdvancementResult {
  success: boolean
  message: string
  nextMatch?: {
    id: string
    round: number
    matchNumber: number
  }
  tournamentCompleted?: boolean
  winner?: {
    id: string
    name: string
  }
}

/**
 * Advance winner to the next match in the bracket
 */
export async function advanceWinner(
  matchId: string,
  winnerId: string
): Promise<AdvancementResult> {
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: {
      tournament: true,
      homeTeam: true,
      awayTeam: true
    }
  })

  if (!match) {
    return { success: false, message: 'Match not found' }
  }

  if (match.status === MatchStatus.COMPLETED) {
    return { success: false, message: 'Match already completed' }
  }

  // Validate winner is a participant
  if (match.homeTeamId !== winnerId && match.awayTeamId !== winnerId) {
    return { success: false, message: 'Winner is not a participant in this match' }
  }

  // Update current match
  await db.match.update({
    where: { id: matchId },
    data: {
      winnerId,
      status: MatchStatus.COMPLETED
    }
  })

  // Update team stats
  await updateTeamStats(match.homeTeamId!, match.awayTeamId!, winnerId)

  // Handle bracket-specific advancement
  const result = await handleBracketAdvancement(match, winnerId)

  return result
}

/**
 * Handle advancement based on bracket type
 */
async function handleBracketAdvancement(
  match: any,
  winnerId: string
): Promise<AdvancementResult> {
  const bracketType = match.tournament.bracketType

  switch (bracketType) {
    case BracketType.SINGLE_ELIMINATION:
      return handleSingleEliminationAdvancement(match, winnerId)
    
    case BracketType.DOUBLE_ELIMINATION:
      return handleDoubleEliminationAdvancement(match, winnerId)
    
    case BracketType.ROUND_ROBIN:
      return handleRoundRobinAdvancement(match)
    
    case BracketType.GROUP_STAGE:
      return handleGroupStageAdvancement(match, winnerId)
    
    case BracketType.SWISS:
      return handleSwissAdvancement(match)
    
    case BracketType.PLAYOFF:
      return handleSingleEliminationAdvancement(match, winnerId)
    
    default:
      return { success: true, message: 'Match completed' }
  }
}

/**
 * Single Elimination advancement
 */
async function handleSingleEliminationAdvancement(
  match: any,
  winnerId: string
): Promise<AdvancementResult> {
  const tournament = match.tournament
  const totalRounds = calculateTotalRounds(
    await db.team.count({ where: { tournamentId: tournament.id } })
  )

  // Check if this was the final
  if (match.round === totalRounds) {
    // Tournament is complete
    await db.tournament.update({
      where: { id: tournament.id },
      data: { status: TournamentStatus.COMPLETED }
    })

    await db.team.update({
      where: { id: winnerId },
      data: { finalRank: 1 }
    })

    const winner = await db.team.findUnique({
      where: { id: winnerId }
    })

    return {
      success: true,
      message: 'Tournament completed!',
      tournamentCompleted: true,
      winner: winner ? { id: winner.id, name: winner.name } : undefined
    }
  }

  // Find next match
  const nextMatch = await findNextMatch(tournament.id, match.round, match.matchNumber)
  
  if (nextMatch) {
    // Place winner in next match
    const isHomeSlot = determineSlot(match.matchNumber)
    
    await db.match.update({
      where: { id: nextMatch.id },
      data: isHomeSlot 
        ? { homeTeamId: winnerId }
        : { awayTeamId: winnerId }
    })

    return {
      success: true,
      message: 'Winner advanced to next round',
      nextMatch: {
        id: nextMatch.id,
        round: nextMatch.round,
        matchNumber: nextMatch.matchNumber
      }
    }
  }

  return { success: true, message: 'Match completed' }
}

/**
 * Double Elimination advancement
 */
async function handleDoubleEliminationAdvancement(
  match: any,
  winnerId: string
): Promise<AdvancementResult> {
  const tournament = match.tournament
  const bracketRound = match.bracketRound // 'UPPER', 'LOWER', 'GRAND_FINAL'

  // Handle Grand Final
  if (bracketRound === 'GRAND_FINAL') {
    await db.tournament.update({
      where: { id: tournament.id },
      data: { status: TournamentStatus.COMPLETED }
    })

    await db.team.update({
      where: { id: winnerId },
      data: { finalRank: 1 }
    })

    const winner = await db.team.findUnique({
      where: { id: winnerId }
    })

    return {
      success: true,
      message: 'Tournament completed!',
      tournamentCompleted: true,
      winner: winner ? { id: winner.id, name: winner.name } : undefined
    }
  }

  // Handle Upper Bracket
  if (bracketRound === 'UPPER') {
    // Winner advances in upper bracket
    const nextUpperMatch = await findNextMatch(
      tournament.id, 
      match.round, 
      match.matchNumber,
      'UPPER'
    )

    if (nextUpperMatch) {
      const isHomeSlot = determineSlot(match.matchNumber)
      await db.match.update({
        where: { id: nextUpperMatch.id },
        data: isHomeSlot 
          ? { homeTeamId: winnerId }
          : { awayTeamId: winnerId }
      })
    }

    // Loser drops to lower bracket
    const loserId = match.homeTeamId === winnerId ? match.awayTeamId : match.homeTeamId
    if (loserId) {
      await dropToLowerBracket(tournament.id, match.round, match.matchNumber, loserId)
    }

    return {
      success: true,
      message: 'Winner advanced in upper bracket, loser dropped to lower bracket',
      nextMatch: nextUpperMatch ? {
        id: nextUpperMatch.id,
        round: nextUpperMatch.round,
        matchNumber: nextUpperMatch.matchNumber
      } : undefined
    }
  }

  // Handle Lower Bracket
  if (bracketRound === 'LOWER') {
    const nextLowerMatch = await findNextMatch(
      tournament.id,
      match.round,
      match.matchNumber,
      'LOWER'
    )

    if (nextLowerMatch) {
      const isHomeSlot = determineSlot(match.matchNumber)
      await db.match.update({
        where: { id: nextLowerMatch.id },
        data: isHomeSlot 
          ? { homeTeamId: winnerId }
          : { awayTeamId: winnerId }
      })

      return {
        success: true,
        message: 'Winner advanced in lower bracket',
        nextMatch: {
          id: nextLowerMatch.id,
          round: nextLowerMatch.round,
          matchNumber: nextLowerMatch.matchNumber
        }
      }
    }

    // No more lower bracket matches - advance to Grand Final
    const grandFinal = await db.match.findFirst({
      where: {
        tournamentId: tournament.id,
        bracketRound: 'GRAND_FINAL'
      }
    })

    if (grandFinal) {
      await db.match.update({
        where: { id: grandFinal.id },
        data: { awayTeamId: winnerId } // Lower bracket winner is away team
      })

      return {
        success: true,
        message: 'Winner advanced to Grand Final!',
        nextMatch: {
          id: grandFinal.id,
          round: grandFinal.round,
          matchNumber: grandFinal.matchNumber
        }
      }
    }
  }

  return { success: true, message: 'Match completed' }
}

/**
 * Round Robin advancement - just update standings
 */
async function handleRoundRobinAdvancement(match: any): Promise<AdvancementResult> {
  // No bracket advancement needed for round robin
  // Just check if all matches are complete
  const incompleteMatches = await db.match.count({
    where: {
      tournamentId: match.tournamentId,
      status: { not: MatchStatus.COMPLETED }
    }
  })

  if (incompleteMatches === 0) {
    await db.tournament.update({
      where: { id: match.tournamentId },
      data: { status: TournamentStatus.COMPLETED }
    })

    // Calculate final standings
    await calculateFinalStandings(match.tournamentId)

    return {
      success: true,
      message: 'Round Robin completed!',
      tournamentCompleted: true
    }
  }

  return { success: true, message: 'Match completed' }
}

/**
 * Group Stage advancement
 */
async function handleGroupStageAdvancement(
  match: any,
  winnerId: string
): Promise<AdvancementResult> {
  if (match.groupId) {
    // Update group standings
    await updateGroupStandings(match.groupId, match)
  }

  // Check if all group matches are complete
  const incompleteGroupMatches = await db.match.count({
    where: {
      tournamentId: match.tournamentId,
      groupId: { not: null },
      status: { not: MatchStatus.COMPLETED }
    }
  })

  if (incompleteGroupMatches === 0) {
    // All group matches done - advance top teams to playoffs
    await advanceFromGroupsToPlayoffs(match.tournamentId)
  }

  return { success: true, message: 'Match completed' }
}

/**
 * Swiss advancement - just update standings
 */
async function handleSwissAdvancement(match: any): Promise<AdvancementResult> {
  // Check if current round is complete
  const currentRound = match.round
  const incompleteInRound = await db.match.count({
    where: {
      tournamentId: match.tournamentId,
      round: currentRound,
      status: { not: MatchStatus.COMPLETED }
    }
  })

  if (incompleteInRound === 0) {
    // Current round complete, generate next round if needed
    await generateNextSwissRound(match.tournamentId, currentRound + 1)
  }

  return { success: true, message: 'Match completed' }
}

// Helper functions

function calculateTotalRounds(teamCount: number): number {
  if (teamCount <= 1) return 0
  return Math.ceil(Math.log2(teamCount))
}

async function findNextMatch(
  tournamentId: string,
  currentRound: number,
  currentMatchNumber: number,
  bracket?: string
): Promise<any> {
  const nextRound = currentRound + 1
  const nextMatchNumber = Math.ceil(currentMatchNumber / 2)

  const where: any = {
    tournamentId,
    round: nextRound,
    matchNumber: nextMatchNumber
  }

  if (bracket) {
    where.bracketRound = bracket
  }

  return db.match.findFirst({ where })
}

function determineSlot(matchNumber: number): boolean {
  // Odd match numbers go to home slot, even to away
  return matchNumber % 2 === 1
}

async function dropToLowerBracket(
  tournamentId: string,
  upperRound: number,
  upperMatchNumber: number,
  loserId: string
): Promise<void> {
  // Calculate the appropriate lower bracket round and match
  const lowerRound = 2 * (upperRound - 1) + 1
  const lowerMatchNumber = Math.ceil(upperMatchNumber / 2)

  const lowerMatch = await db.match.findFirst({
    where: {
      tournamentId,
      round: lowerRound,
      matchNumber: lowerMatchNumber,
      bracketRound: 'LOWER'
    }
  })

  if (lowerMatch) {
    const slot = upperMatchNumber % 2 === 1 ? 'homeTeamId' : 'awayTeamId'
    await db.match.update({
      where: { id: lowerMatch.id },
      data: { [slot]: loserId }
    })
  }
}

async function updateTeamStats(
  homeTeamId: string,
  awayTeamId: string,
  winnerId: string
): Promise<void> {
  // Update home team
  if (homeTeamId) {
    const isWinner = homeTeamId === winnerId
    await db.team.update({
      where: { id: homeTeamId },
      data: {
        wins: { increment: isWinner ? 1 : 0 },
        losses: { increment: isWinner ? 0 : 1 },
        points: { increment: isWinner ? 3 : 0 }
      }
    })
  }

  // Update away team
  if (awayTeamId) {
    const isWinner = awayTeamId === winnerId
    await db.team.update({
      where: { id: awayTeamId },
      data: {
        wins: { increment: isWinner ? 1 : 0 },
        losses: { increment: isWinner ? 0 : 1 },
        points: { increment: isWinner ? 3 : 0 }
      }
    })
  }
}

async function updateGroupStandings(groupId: string, match: any): Promise<void> {
  const winnerId = match.winnerId
  const isDraw = match.homeScore === match.awayScore

  // Update home team group standing
  if (match.homeTeamId) {
    const homeMember = await db.groupMember.findUnique({
      where: { groupId_teamId: { groupId, teamId: match.homeTeamId } }
    })

    if (homeMember) {
      const won = match.homeTeamId === winnerId ? 1 : 0
      const drawn = isDraw ? 1 : 0
      const lost = match.awayTeamId === winnerId ? 1 : 0
      const points = won * 3 + drawn * 1

      await db.groupMember.update({
        where: { id: homeMember.id },
        data: {
          played: { increment: 1 },
          won: { increment: won },
          drawn: { increment: drawn },
          lost: { increment: lost },
          points: { increment: points },
          goalsFor: { increment: match.homeScore },
          goalsAgainst: { increment: match.awayScore }
        }
      })
    }
  }

  // Update away team group standing
  if (match.awayTeamId) {
    const awayMember = await db.groupMember.findUnique({
      where: { groupId_teamId: { groupId, teamId: match.awayTeamId } }
    })

    if (awayMember) {
      const won = match.awayTeamId === winnerId ? 1 : 0
      const drawn = isDraw ? 1 : 0
      const lost = match.homeTeamId === winnerId ? 1 : 0
      const points = won * 3 + drawn * 1

      await db.groupMember.update({
        where: { id: awayMember.id },
        data: {
          played: { increment: 1 },
          won: { increment: won },
          drawn: { increment: drawn },
          lost: { increment: lost },
          points: { increment: points },
          goalsFor: { increment: match.awayScore },
          goalsAgainst: { increment: match.homeScore }
        }
      })
    }
  }
}

async function calculateFinalStandings(tournamentId: string): Promise<void> {
  const teams = await db.team.findMany({
    where: { tournamentId },
    orderBy: [
      { points: 'desc' },
      { wins: 'desc' }
    ]
  })

  // Assign final ranks
  for (let i = 0; i < teams.length; i++) {
    await db.team.update({
      where: { id: teams[i].id },
      data: { finalRank: i + 1 }
    })
  }
}

async function advanceFromGroupsToPlayoffs(tournamentId: string): Promise<void> {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      groups: {
        include: {
          members: {
            include: { team: true },
            orderBy: [
              { points: 'desc' },
              { goalsFor: 'desc' }
            ]
          }
        }
      }
    }
  })

  if (!tournament) return

  // Get top 2 from each group
  const advancingTeams: string[] = []
  for (const group of tournament.groups) {
    for (let i = 0; i < Math.min(2, group.members.length); i++) {
      advancingTeams.push(group.members[i].teamId)
    }
  }

  // Update playoff bracket matches
  const playoffMatches = await db.match.findMany({
    where: {
      tournamentId,
      groupId: null,
      round: 1
    },
    orderBy: { matchNumber: 'asc' }
  })

  // Seed teams into playoff bracket
  for (let i = 0; i < Math.min(advancingTeams.length, playoffMatches.length * 2); i++) {
    const matchIndex = Math.floor(i / 2)
    const isHome = i % 2 === 0
    
    if (playoffMatches[matchIndex]) {
      await db.match.update({
        where: { id: playoffMatches[matchIndex].id },
        data: isHome 
          ? { homeTeamId: advancingTeams[i] }
          : { awayTeamId: advancingTeams[i] }
      })
    }
  }
}

async function generateNextSwissRound(tournamentId: string, round: number): Promise<void> {
  // Get current standings
  const teams = await db.team.findMany({
    where: { tournamentId },
    select: {
      id: true,
      name: true,
      wins: true,
      losses: true,
      points: true
    }
  })

  // Get previous pairings
  const previousMatches = await db.match.findMany({
    where: {
      tournamentId,
      status: MatchStatus.COMPLETED
    },
    select: {
      homeTeamId: true,
      awayTeamId: true
    }
  })

  const previousPairings = new Set<string>()
  previousMatches.forEach(m => {
    if (m.homeTeamId && m.awayTeamId) {
      const key = [m.homeTeamId, m.awayTeamId].sort().join('-')
      previousPairings.add(key)
    }
  })

  // Sort teams by points
  const sortedTeams = [...teams].sort((a, b) => b.points - a.points)

  // Generate pairings
  const pairings: [string, string][] = []
  const used = new Set<string>()

  for (const team of sortedTeams) {
    if (used.has(team.id)) continue

    for (const opponent of sortedTeams) {
      if (opponent.id === team.id) continue
      if (used.has(opponent.id)) continue

      const pairingKey = [team.id, opponent.id].sort().join('-')
      if (previousPairings.has(pairingKey)) continue

      pairings.push([team.id, opponent.id])
      used.add(team.id)
      used.add(opponent.id)
      break
    }
  }

  // Update matches for this round
  const roundMatches = await db.match.findMany({
    where: { tournamentId, round },
    orderBy: { matchNumber: 'asc' }
  })

  for (let i = 0; i < pairings.length; i++) {
    if (roundMatches[i]) {
      await db.match.update({
        where: { id: roundMatches[i].id },
        data: {
          homeTeamId: pairings[i][0],
          awayTeamId: pairings[i][1]
        }
      })
    }
  }
}

/**
 * Calculate standings for a group
 */
export async function calculateGroupStandings(groupId: string) {
  const members = await db.groupMember.findMany({
    where: { groupId },
    include: { team: true },
    orderBy: [
      { points: 'desc' },
      { goalsFor: 'desc' },
      { goalsAgainst: 'asc' }
    ]
  })

  return members.map((m, index) => ({
    rank: index + 1,
    teamId: m.teamId,
    teamName: m.team.name,
    played: m.played,
    won: m.won,
    drawn: m.drawn,
    lost: m.lost,
    points: m.points,
    goalsFor: m.goalsFor,
    goalsAgainst: m.goalsAgainst,
    goalDifference: m.goalsFor - m.goalsAgainst
  }))
}

/**
 * Update bracket after match completion
 */
export async function updateBracket(matchId: string): Promise<void> {
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: { tournament: true }
  })

  if (!match || !match.winnerId) return

  // This is a simplified version - full implementation would handle
  // all bracket types and edge cases
  await advanceWinner(matchId, match.winnerId)
}
