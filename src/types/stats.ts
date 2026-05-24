/**
 * Shared data interfaces for IDM League stats API response.
 * All components should import from here instead of defining locally.
 */

export interface SeasonData {
  id: string;
  name: string;
  number: number;
  status: string;
}

export interface TournamentTeamPlayer {
  player: {
    id: string;
    name: string;
    gamertag: string;
    tier: string;
    points: number;
  };
}

export interface TournamentTeam {
  id: string;
  name: string;
  isWinner: boolean;
  power: number;
  teamPlayers: TournamentTeamPlayer[];
}

export interface TournamentMatch {
  id: string;
  score1: number | null;
  score2: number | null;
  status: string;
  round?: number;
  matchNumber?: number;
  bracket?: string;
  groupLabel?: string;
  team1: { id: string; name: string } | null;
  team2: { id: string; name: string } | null;
  mvpPlayer: { id: string; name: string; gamertag: string } | null;
}

export interface TournamentDonation {
  id: string;
  donorName: string;
  amount: number;
  message: string | null;
}

export interface ActiveTournament {
  id: string;
  name: string;
  weekNumber: number;
  status: string;
  format?: string;
  division?: 'male' | 'female';
  prizePool: number;
  bpm: string | null;
  location: string;
  scheduledAt: string;
  teams: TournamentTeam[];
  matches: TournamentMatch[];
  donations: TournamentDonation[];
}

export interface TopPlayer {
  id: string;
  name: string;
  gamertag: string;
  avatar?: string | null;
  tier: string;
  points: number;
  totalWins: number;
  streak: number;
  maxStreak: number;
  totalMvp: number;
  matches: number;
  club?: string | { id: string; name: string; logo?: string | null };
  division?: string;
  city?: string;
}

export interface ClubData {
  id: string;
  name: string;
  logo?: string | null;
  bannerImage?: string | null;
  wins: number;
  losses: number;
  points: number;
  gameDiff: number;
  _count?: { members: number };
  /** Tarkam leaderboard: combined points from both divisions */
  malePoints?: number;
  /** Tarkam leaderboard: combined points from both divisions */
  femalePoints?: number;
  /** Tarkam leaderboard: rank position */
  rank?: number;
  /** Tarkam leaderboard: total active members */
  memberCount?: number;
  /** Tarkam leaderboard: male division members */
  maleMemberCount?: number;
  /** Tarkam leaderboard: female division members */
  femaleMemberCount?: number;
  /** Tarkam leaderboard: member details */
  members?: {
    id: string;
    gamertag: string;
    name: string;
    division: string;
    tier: string;
    points: number;
    role: string;
    avatar: string | null;
  }[];
}

export interface MatchResult {
  id: string;
  score1: number;
  score2: number;
  club1: { name: string };
  club2: { name: string };
  week: number;
}

export interface UpcomingMatch {
  id: string;
  club1: { name: string };
  club2: { name: string };
  week: number;
}

export interface SeasonProgress {
  totalWeeks: number;
  completedWeeks: number;
  percentage: number;
}

export interface TopDonor {
  donorName: string;
  totalAmount: number;
  donationCount: number;
  /** Matched player info (if donorName matches a player gamertag — searches BOTH divisions) */
  player?: {
    id: string;
    gamertag: string;
    avatar?: string | null;
    tier: string;
    points: number;
    totalWins: number;
    totalMvp: number;
    streak: number;
    division: string;
    city?: string;
    club?: string | { id: string; name: string; logo?: string | null } | null;
  } | null;
}

export interface TopDonorEnriched extends TopDonor {
  tier: string;
  tierColor: string;
  tierIcon: string;
}

export interface WeeklyChampion {
  weekNumber: number;
  tournamentName: string;
  prizePool: number;
  completedAt: string | null;
  /** Which season this champion week belongs to */
  seasonId: string;
  seasonNumber: number;
  seasonStatus: string;
  winnerTeam: {
    name: string;
    players: {
      id: string;
      gamertag: string;
      avatar?: string | null;
      tier: string;
      points: number;
      totalWins: number;
      totalMvp: number;
      streak: number;
      matches: number;
      club?: string | { id: string; name: string; logo?: string | null } | null;
      city?: string;
    }[];
  } | null;
  mvp: { id: string; gamertag: string; avatar?: string | null; tier: string; totalMvp: number; points: number } | null;
}

export interface MvpHallOfFameEntry {
  id: string;
  gamertag: string;
  avatar?: string | null;
  tier: string;
  totalMvp: number;
  points: number;
  totalWins: number;
  streak: number;
  matches: number;
  weekNumber: number;
  tournamentName: string;
  division?: 'male' | 'female';
}

export interface TournamentSummary {
  id: string;
  name: string;
  weekNumber: number;
  status: string;
  prizePool: number;
}

/**
 * Main StatsData interface — matches /api/stats response.
 * All optional enrichment fields are marked as optional.
 */
export interface SeasonChampionPlayer {
  id: string;
  gamertag: string;
  avatar?: string | null;
  tier: string;
  points: number;
  totalWins: number;
  totalMvp: number;
  streak: number;
  maxStreak: number;
  matches: number;
  club?: string | { id: string; name: string; logo?: string | null } | null;
  city?: string;
  division?: string;
  /** Embedded skin flag — true for all season champions (virtual skin entry).
   *  Eliminates the need for a separate skinMap lookup in components. */
  hasSeasonChampionSkin?: boolean;
}

export interface SultanPlayer {
  id: string;
  gamertag: string;
  avatar?: string | null;
  division: string;
  tier: string;
  points: number;
  city?: string | null;
  club?: { id: string; name: string; logo?: string | null } | null;
}

export interface SeasonInfo {
  id: string;
  name: string;
  number: number;
  status: string;
  startDate: string;
  endDate: string | null;
  tournamentCount: number;
  championClubId: string | null;
  championPlayerId: string | null;
  championPlayer: SeasonChampionPlayer | null;
  championClub: {
    id: string;
    name: string;
    logo: string | null;
    members?: {
      id: string;
      gamertag: string;
      avatar?: string | null;
      tier: string;
      points: number;
      division: 'male' | 'female';
    }[];
    totalPoints?: number;
    maleScore?: number;
    femaleScore?: number;
  } | null;
  sultanPlayerId: string | null;
  sultanPlayer: SultanPlayer | null;
}

export interface StatsData {
  hasData: boolean;
  division: string;
  season: SeasonData;
  /** All seasons for this division (for season selector) */
  allSeasons: SeasonInfo[];
  activeTournament: ActiveTournament | null;
  totalPlayers: number;
  /** Count of players with approved/assigned status in the active tournament */
  approvedPlayerCount: number;
  totalPrizePool: number;
  malePrizePool: number;
  femalePrizePool: number;
  /** Prize pool for the ACTIVE tournament only (base + that tournament's weekly donations). Resets each week. */
  activeTournamentPrizePool: number;
  seasonDonationTotal: number;
  topPlayers: TopPlayer[];
  /** Map of playerId → active skin data array (for displaying skins on any player) */
  skinMap: Record<string, PlayerSkinInfo[]>;
  recentMatches: MatchResult[];
  upcomingMatches: UpcomingMatch[];
  seasonProgress: SeasonProgress;
  topDonors: TopDonor[];
  /** Top donors for the active/latest tournament only (per-week, not per-season) */
  weeklyTopDonors: TopDonor[];
  clubs: ClubData[];
  weeklyChampions: WeeklyChampion[];
  mvpHallOfFame: MvpHallOfFameEntry[];
  /** Optional: included in landing page enriched response */
  tournaments?: TournamentSummary[];
  /** Optional: enriched topDonors with tier info (landing page) */
  topDonorsEnriched?: TopDonorEnriched[];
  /** Weekly top performers — "Bintang Minggu Ini" composite score */
  weeklyTopPerformers: WeeklyPerformer[];
  /** Sultan of the Week — top penyawer per tournament */
  sultanOfWeekly: SultanOfWeekly[];
  /** When true, this response contains historical data from a completed season's snapshot */
  isHistorical?: boolean;
}

/** Sultan of the Week — top penyawer per tournament */
export interface SultanOfWeekly {
  weekNumber: number;
  tournamentName: string;
  tournamentId: string;
  /** The tournament's division (male/female) — the Sultan title belongs to this tournament */
  tournamentDivision: string;
  /** Top donor's name (from Donation.donorName) */
  donorName: string;
  /** Total donation amount for this tournament */
  totalAmount: number;
  /** Number of donations */
  donationCount: number;
  /** Matched player info (if donorName matches a player gamertag — searches BOTH divisions) */
  player?: {
    id: string;
    gamertag: string;
    avatar?: string | null;
    tier: string;
    points: number;
    totalWins: number;
    totalMvp: number;
    streak: number;
    division: string;
    city?: string;
    club?: string | { id: string; name: string; logo?: string | null } | null;
  } | null;
  /** True when the matched player's division differs from the tournament's division (cross-division donor) */
  isCrossDivision: boolean;
  /** True when multiple donors have the same top amount (Co-Sultan) */
  isCoSultan?: boolean;
  /** True when this Sultan was manually set by admin (override) */
  isOverride?: boolean;
  /** List of co-sultans when isCoSultan is true */
  coSultans?: {
    donorName: string;
    totalAmount: number;
    donationCount: number;
    player?: {
      id: string;
      gamertag: string;
      avatar?: string | null;
      tier: string;
      points: number;
      totalWins: number;
      totalMvp: number;
      streak: number;
      division: string;
      city?: string;
      club?: string | { id: string; name: string; logo?: string | null } | null;
    } | null;
    isCrossDivision: boolean;
  }[];
  /** Full per-tournament donor list (sorted by totalAmount DESC) for leaderboard display.
   *  Guaranteed to contain only donors for THIS specific tournament/week. */
  allDonors?: {
    donorName: string;
    totalAmount: number;
    donationCount: number;
    player?: {
      id: string;
      gamertag: string;
      avatar?: string | null;
      tier: string;
      points: number;
      totalWins: number;
      totalMvp: number;
      streak: number;
      division: string;
      city?: string;
      club?: string | { id: string; name: string; logo?: string | null } | null;
    } | null;
  }[];
}

/** Weekly top performer — "Bintang Minggu Ini" composite score */
export interface WeeklyPerformer {
  id: string;
  gamertag: string;
  avatar?: string | null;
  tier: string;
  points: number;               // total season points
  weeklyPointsGained: number;   // points earned this week
  weeklyWins: number;           // match wins this week (from actual match results)
  weeklyLosses: number;         // match losses this week (from actual match results)
  weeklyMatches: number;        // total matches played this week (wins + losses)
  weeklyWinRate: number;        // match win rate this week (0-100)
  streak: number;               // current active streak
  compositeScore: number;       // calculated composite score (0-100)
  division: 'male' | 'female';
  weekNumber: number;           // which week this performance is from
  city?: string;
  club?: string | null;
}

/** Lightweight skin info returned in the skinMap for each player */
export interface PlayerSkinInfo {
  type: string;
  icon: string;
  displayName: string;
  colorClass: string;
  priority: number;
  duration: string;
  reason?: string | null;
  expiresAt?: string | null;
  /** Permanent donor heart badge count (independent of skin expiry) */
  donorBadgeCount?: number;
}
