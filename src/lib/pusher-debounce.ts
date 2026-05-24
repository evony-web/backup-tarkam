// ============================================
// IDM LEAGUE - PUSH EVENT DEBOUNCE
// ============================================
// Batches Pusher triggers so rapid admin score updates
// (e.g. 5 scores in 10 seconds) don't trigger 5x client refetches.
// Instead, clients get ONE event after a short delay.

import { pusherTrigger, PUSHER_CHANNELS, PUSHER_EVENTS } from './pusher';

interface PendingEvent {
  channel: string;
  event: string;
  data: Record<string, unknown>;
}

// Debounce window in ms — collect events, then fire once
const DEBOUNCE_MS = 1500;

// Track pending timers per "group key" (e.g. tournamentId or division)
const pendingTimers = new Map<string, NodeJS.Timeout>();
const pendingEvents = new Map<string, PendingEvent[]>();

/**
 * Queue a Pusher event for debounced delivery.
 * Events with the same groupKey are batched together.
 * After DEBOUNCE_MS of silence, all queued events are merged and sent as ONE trigger.
 */
export function queuePusherEvent(
  groupKey: string,
  channel: string,
  event: string,
  data: Record<string, unknown>
): void {
  const key = `${channel}:${event}:${groupKey}`;

  // Add to pending queue
  if (!pendingEvents.has(key)) {
    pendingEvents.set(key, []);
  }
  pendingEvents.get(key)!.push({ channel, event, data });

  // Clear existing timer
  const existingTimer = pendingTimers.get(key);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  // Set new timer — when it fires, flush all queued events
  const timer = setTimeout(() => {
    flushEvents(key);
    pendingTimers.delete(key);
  }, DEBOUNCE_MS);

  pendingTimers.set(key, timer);
}

/**
 * Flush all pending events for a key — merge data and send ONE trigger
 */
function flushEvents(key: string): void {
  const events = pendingEvents.get(key);
  pendingEvents.delete(key);

  if (!events || events.length === 0) return;

  // Use the LAST event's data (most recent state wins)
  const lastEvent = events[events.length - 1];

  // Merge: include count of batched events so client knows this was a batch
  const mergedData = {
    ...lastEvent.data,
    _batchCount: events.length,
    _batchedAt: Date.now(),
  };

  // Fire — non-blocking, errors are caught inside pusherTrigger
  void pusherTrigger(lastEvent.channel, lastEvent.event, mergedData);
}

/**
 * Immediately flush all pending events (e.g. on server shutdown)
 */
export function flushAllPendingEvents(): void {
  for (const [key] of pendingTimers) {
    clearTimeout(pendingTimers.get(key));
    flushEvents(key);
  }
  pendingTimers.clear();
}

// ============================================
// CONVENIENCE HELPERS — common debounced events
// ============================================

/**
 * Debounced score update — groups by tournamentId
 * Client receives: { tournamentId, matchId (latest), division, _batchCount }
 */
export function notifyScoreUpdate(tournamentId: string, data: {
  matchId: string;
  score1: number;
  score2: number;
  division: string;
  seasonId: string;
}): void {
  // Debounced tournament event
  queuePusherEvent(tournamentId, PUSHER_CHANNELS.TOURNAMENT, PUSHER_EVENTS.TOURNAMENT_SCORED, {
    tournamentId,
    matchId: data.matchId,
    score1: data.score1,
    score2: data.score2,
    division: data.division,
  });

  // Debounced leaderboard event — groups by division
  queuePusherEvent(data.division, PUSHER_CHANNELS.LEADERBOARD, PUSHER_EVENTS.LEADERBOARD_UPDATED, {
    division: data.division,
    seasonId: data.seasonId,
  });

  // Debounced feed event — groups by tournamentId
  queuePusherEvent(`feed:${tournamentId}`, PUSHER_CHANNELS.FEED, PUSHER_EVENTS.FEED_UPDATED, {
    type: 'score',
    tournamentId,
  });
}
