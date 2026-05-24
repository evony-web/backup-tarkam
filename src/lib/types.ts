export interface StatsData {
  players: {
    total: number
    male: number
    female: number
    byTier: { S: number; A: number; B: number }
  }
  clubs: {
    total: number
    names: string[]
  }
  activeSeason: {
    id: string
    name: string
    number: number
    tournamentCount: number
  } | null
  matches: {
    total: number
    completed: number
    pending: number
  }
  prizePool: {
    total: number
  }
  donations: {
    totalAmount: number
  }
  tournamentsByStatus: { status: string; count: number }[]
  recentActivityCount: number
}

export interface TournamentData {
  id: string
  seasonId: string
  name: string
  weekNumber: number
  division: string
  scheduledAt: string
  bpm: string | null
  /** Location/area where tournament takes place */
  location?: string | null
  /** @deprecated Use location instead */
  area: string
  status: string
  prizePool: number
  createdAt: string
  updatedAt: string
  season: { name: string; number: number }
  _count: {
    participants: number
    teams: number
    matches: number
    donations: number
  }
}

export interface PlayerData {
  id: string
  name: string
  gamertag: string
  division: string
  tier: string
  clubName: string | null
  avatarUrl: string | null
  avatar?: string | null
  totalPoints: number
  totalWins: number
  totalLosses: number
  mvpCount: number
  streak: number
  bestStreak: number
  matches?: number
  isActive: boolean
  /** WhatsApp number for WA-registered players */
  waNumber?: string | null
  /** Player's city */
  city?: string
  /** Name of joki if player is played by someone else */
  joki?: string | null
  /** Registration status: "pending" | "approved" | "rejected" */
  registrationStatus?: string
}

export interface RankingData {
  id: string
  seasonId: string
  playerId: string
  division: string
  points: number
  wins: number
  losses: number
  mvpAwards: number
  position: number | null
  player: PlayerData
  season: { name: string; number: number }
}

export interface DonationData {
  id: string
  tournamentId: string
  playerId: string | null
  donorName: string
  amount: number
  message: string | null
  isAnonymous: boolean
  createdAt: string
  player: { id: string; name: string; avatarUrl: string | null } | null
  tournament: { id: string; name: string; division: string }
}

export interface ActivityData {
  id: string
  type: string
  division: string
  title: string
  description: string | null
  icon: string | null
  createdAt: string
}

export interface SeasonData {
  id: string
  name: string
  number: number
  startDate: string
  endDate: string | null
  isActive: boolean
  isCompleted: boolean
  _count: {
    tournaments: number
    rankings: number
  }
}

export interface TeamData {
  id: string
  tournamentId: string
  name: string
  color: string | null
  logoUrl: string | null
  totalPower: number
  isWinner: boolean
  createdAt: string
  participants: {
    id: string
    playerId: string
    assignedTier: string | null
    status: string
    player: PlayerData
  }[]
}

export interface MatchData {
  id: string
  tournamentId: string
  round: number
  matchNumber: number
  status: string
  winnerId: string | null
  mvpPlayerId: string | null
  completedAt: string | null
  winPoints: number
  participationPoints: number
  mvpPoints: number
  teams: {
    id: string
    matchId: string
    teamId: string
    score: number
    result: string
    team: TeamData
  }[]
  mvpPlayer: PlayerData | null
}

export interface TournamentDetailData {
  id: string
  seasonId: string
  name: string
  weekNumber: number
  division: string
  scheduledAt: string
  bpm: string | null
  /** Location/area where tournament takes place */
  location?: string | null
  /** @deprecated Use location instead */
  area: string
  status: string
  prizePool: number
  participants: {
    id: string
    tournamentId: string
    playerId: string
    teamId: string | null
    status: string
    assignedTier: string | null
    registeredAt: string
    approvedAt: string | null
    player: PlayerData
    team: TeamData | null
  }[]
  teams: TeamData[]
  matches: MatchData[]
  donations: DonationData[]
  season: SeasonData
}

export function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`
}

export function tierColor(tier: string): string {
  switch (tier) {
    case 'S': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    case 'A': return 'bg-slate-300/20 text-slate-200 border-slate-300/30 dark:text-slate-200'
    case 'B': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }
}

export function tierBg(tier: string): string {
  switch (tier) {
    case 'S': return 'from-emerald-500/10 to-emerald-600/5'
    case 'A': return 'from-slate-300/10 to-slate-400/5'
    case 'B': return 'from-cyan-500/10 to-cyan-600/5'
    default: return 'from-gray-500/10 to-gray-600/5'
  }
}

export function divisionLabel(division: string): string {
  switch (division) {
    case 'MALE': return '♂ Cowo'
    case 'FEMALE': return '♀ Cewe'
    default: return '🌐 Semua'
  }
}

export function divisionBadge(division: string): string {
  switch (division) {
    case 'MALE': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
    case 'FEMALE': return 'bg-pink-300/20 text-pink-300 border-pink-300/30'
    default: return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
  }
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    SETUP: 'Setup',
    REGISTRATION: 'Pendaftaran',
    APPROVAL: 'Persetujuan',
    TEAM_GENERATION: 'Tim Dibuat',
    BRACKET_GENERATED: 'Bracket Siap',
    MATCH_IN_PROGRESS: 'Match Berlangsung',
    SCORING: 'Scoring',
    FINALIZATION: 'Finalisasi',
    COMPLETED: 'Selesai',
  }
  return map[status] || status
}

export function statusColor(status: string): string {
  switch (status) {
    case 'COMPLETED': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    case 'REGISTRATION': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
    case 'MATCH_IN_PROGRESS': return 'bg-pink-300/20 text-pink-300 border-pink-300/30'
    case 'SCORING': return 'bg-teal-500/20 text-teal-400 border-teal-500/30'
    case 'APPROVAL': return 'bg-emerald-400/20 text-emerald-300 border-emerald-400/30'
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }
}

// ── Generic API Response type ──
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}
