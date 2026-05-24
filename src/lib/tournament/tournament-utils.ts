/**
 * Tournament Utility Functions
 * Helper functions for bracket generation and tournament management
 */

/**
 * Calculate total rounds needed for a single elimination bracket
 */
export function calculateTotalRounds(teamCount: number): number {
  if (teamCount <= 1) return 0
  return Math.ceil(Math.log2(teamCount))
}

/**
 * Check if a number is a power of two
 */
export function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0
}

/**
 * Get the next power of two greater than or equal to n
 */
export function getNextPowerOfTwo(n: number): number {
  if (n <= 1) return 1
  if (isPowerOfTwo(n)) return n
  return Math.pow(2, Math.ceil(Math.log2(n)))
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Calculate the number of byes needed for a bracket
 */
export function calculateByes(teamCount: number): number {
  const nextPower = getNextPowerOfTwo(teamCount)
  return nextPower - teamCount
}

/**
 * Get the number of matches in a single elimination bracket
 */
export function getSingleEliminationMatchCount(teamCount: number): number {
  return teamCount - 1
}

/**
 * Get the number of matches in a double elimination bracket
 */
export function getDoubleEliminationMatchCount(teamCount: number): number {
  // Upper bracket: n-1 matches
  // Lower bracket: 2*(n-1) matches
  // Grand final: 1 or 2 matches (we assume 1 for now)
  return (teamCount - 1) + 2 * (teamCount - 1) + 1
}

/**
 * Calculate round robin match count
 */
export function getRoundRobinMatchCount(teamCount: number): number {
  return (teamCount * (teamCount - 1)) / 2
}

/**
 * Get teams per group for group stage
 */
export function getTeamsPerGroup(teamCount: number, groupCount: number): number[] {
  const base = Math.floor(teamCount / groupCount)
  const remainder = teamCount % groupCount
  
  const groups: number[] = []
  for (let i = 0; i < groupCount; i++) {
    groups.push(base + (i < remainder ? 1 : 0))
  }
  return groups
}

/**
 * Generate a unique slug from name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    + '-' + Math.random().toString(36).substring(2, 8)
}

/**
 * Get match label for display (e.g., "Round 1 - Match 1")
 */
export function getMatchLabel(round: number, matchNumber: number, totalRounds: number): string {
  if (round === totalRounds) {
    return 'Final'
  } else if (round === totalRounds - 1) {
    return `Semi-Final ${matchNumber}`
  } else if (round === totalRounds - 2) {
    return `Quarter-Final ${matchNumber}`
  }
  return `Round ${round} - Match ${matchNumber}`
}

/**
 * Calculate Swiss round pairings
 */
export function getSwissPairings(
  teams: { id: string; wins: number; losses: number; points: number }[],
  previousPairings: Set<string>
): [string, string][] {
  // Sort teams by points (descending)
  const sortedTeams = [...teams].sort((a, b) => b.points - a.points)
  
  const pairings: [string, string][] = []
  const used = new Set<string>()
  
  for (const team of sortedTeams) {
    if (used.has(team.id)) continue
    
    // Find the best opponent with same/similar points that hasn't played
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
  
  return pairings
}

/**
 * Calculate standings for a group or tournament
 */
export interface StandingEntry {
  teamId: string
  played: number
  won: number
  drawn: number
  lost: number
  points: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
}

export function sortStandings(entries: StandingEntry[]): StandingEntry[] {
  return [...entries].sort((a, b) => {
    // Sort by points, then goal difference, then goals for
    if (b.points !== a.points) return b.points - a.points
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
    return b.goalsFor - a.goalsFor
  })
}
