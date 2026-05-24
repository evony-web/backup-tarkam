import Pusher from 'pusher';

// Server-side Pusher instance — used in API routes to trigger real-time events
let _pusher: Pusher | null = null;

export function getPusher(): Pusher | null {
  if (_pusher) return _pusher;

  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;

  if (!appId || !key || !secret || !cluster) {
    console.warn('[Pusher] Missing environment variables — real-time updates disabled');
    return null;
  }

  _pusher = new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });

  return _pusher;
}

// Channel and event constants
export const PUSHER_CHANNELS = {
  FEED: 'idm-feed',
  LEADERBOARD: 'idm-leaderboard',
  TOURNAMENT: 'idm-tournament',
  LEAGUE: 'idm-league',
} as const;

export const PUSHER_EVENTS = {
  // Feed channel
  DONATION_APPROVED: 'donation-approved',
  DONATION_REJECTED: 'donation-rejected',
  FEED_UPDATED: 'feed-updated',
  PLAYER_REGISTERED: 'player-registered',
  CLUB_MEMBER_CHANGED: 'club-member-changed',

  // Leaderboard channel
  LEADERBOARD_UPDATED: 'leaderboard-updated',

  // Tournament channel
  TOURNAMENT_CREATED: 'tournament-created',
  TOURNAMENT_SCORED: 'tournament-scored',
  TOURNAMENT_FINALIZED: 'tournament-finalized',
  TOURNAMENT_STATUS_CHANGED: 'tournament-status-changed',

  // League channel
  LEAGUE_MATCH_SCORED: 'league-match-scored',
  SEASON_CLOSED: 'season-closed',
} as const;

/**
 * Helper to trigger a Pusher event with graceful fallback if Pusher is not configured
 */
export async function pusherTrigger(
  channel: string,
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const pusher = getPusher();
    if (!pusher) return;
    await pusher.trigger(channel, event, data);
  } catch (error) {
    console.warn(`[Pusher] Failed to trigger ${event} on ${channel}:`, error);
  }
}
