// @ts-nocheck
// Dead code — references Prisma enums/types that don't exist in current schema
import { User, Tournament, Team, Match, Club, Season, Division, PlayerTierType, TournamentStatus, MatchStatus, UserRole } from '@prisma/client'

// User types
export type UserType = User
export type UserRoleType = UserRole

// Tournament types
export type TournamentType = Tournament
export type TournamentStatusType = TournamentStatus

// Team types
export type TeamType = Team & {
  members?: (TeamMemberType & {
    user: UserType
  })[]
}

export type TeamMemberType = {
  id: string
  teamId: string
  userId: string
  role: 'CAPTAIN' | 'PLAYER' | 'SUBSTITUTE'
  isMVP: boolean
  user?: UserType
}

// Match types
export type MatchType = Match & {
  homeTeam?: TeamType
  awayTeam?: TeamType
  scores?: MatchScoreType[]
}

export type MatchScoreType = {
  id: string
  matchId: string
  userId: string
  score: number
  kills?: number | null
  deaths?: number | null
  assists?: number | null
  isMVP: boolean
  user?: UserType
}

// Club types
export type ClubType = Club & {
  members?: ClubMemberType[]
}

export type ClubMemberType = {
  id: string
  clubId: string
  userId: string
  role: 'LEADER' | 'COACH' | 'PLAYER' | 'SUBSTITUTE'
  ign?: string | null
  position?: string | null
  isCaptain: boolean
  user?: UserType
}

// Season types
export type SeasonType = Season

// Division types
export type DivisionType = Division
export type PlayerTierTypeType = PlayerTierType
export type MatchStatusType = MatchStatus

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Dashboard stats
export interface DashboardStats {
  totalTournaments: number
  activeTournaments: number
  totalPlayers: number
  totalPrizePool: number
  totalMatches: number
  completedMatches: number
}

// Leaderboard entry
export interface LeaderboardEntry {
  rank: number
  userId: string
  name: string
  avatar?: string
  tier: PlayerTierType
  totalPoints: number
  totalWins: number
  totalMVPs: number
  winStreak: number
}

// Donation notification
export interface DonationNotification {
  id: string
  donorName: string
  amount: number
  message?: string
  createdAt: Date
}
