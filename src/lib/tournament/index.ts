/**
 * Tournament Module
 * Export all tournament-related utilities and functions
 */

// Export everything from tournament-utils (primary utility module)
export * from './tournament-utils'

// Export only unique functions from bracket-generator (excluding duplicates)
export {
  generateSingleElimination,
  generateDoubleElimination,
  generateRoundRobin,
  generateGroupStage,
  generateSwiss,
  generatePlayoff,
  getRoundName,
  getBracketRoundLabel,
} from './bracket-generator'

// Export only unique functions from match-advancement
export {
  advanceWinner,
  updateBracket,
  calculateGroupStandings,
} from './match-advancement'
export type { AdvancementResult } from './match-advancement'
