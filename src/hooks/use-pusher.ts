'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Hook to subscribe to a Pusher channel and bind to events.
 * Automatically cleans up on unmount.
 *
 * @param channelName - Pusher channel name (e.g. 'idm-feed')
 * @param events - Map of event names to callbacks
 * @param enabled - Whether to subscribe (default: true)
 */
export function usePusherChannel(
  channelName: string,
  events: Record<string, (data: any) => void>,
  enabled = true
) {
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    if (!enabled) return;

    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!pusherKey || !pusherCluster) return;

    let pusher: any;
    let channel: any;

    import('pusher-js').then(({ default: PusherJS }) => {
      pusher = new PusherJS(pusherKey, { cluster: pusherCluster });
      channel = pusher.subscribe(channelName);

      for (const [event] of Object.entries(eventsRef.current)) {
        channel.bind(event, (data: any) => {
          eventsRef.current[event]?.(data);
        });
      }
    }).catch(() => {
      // Pusher not available — graceful fallback
    });

    return () => {
      if (channel) {
        channel.unbind_all();
        channel.unsubscribe();
      }
      if (pusher) pusher.disconnect();
    };
  }, [channelName, enabled]);
}

/**
 * Subscribe to all Pusher channels and invalidate React Query keys on events.
 * Covers: feed updates, leaderboard changes, tournament lifecycle,
 * league matches, season changes, registrations, donations, and club member changes.
 *
 * ★ INP OPTIMIZATION: All invalidations are batched and deferred to idle time.
 * Instead of firing 5-6 invalidations synchronously on each Pusher event
 * (which blocks the main thread for 200-400ms), we collect them into a Set
 * and flush them during requestIdleCallback. This ensures user interactions
 * are never blocked by invalidation cascades.
 */
export function usePusherRealtime(enabled = true) {
  const qc = useQueryClient();
  const qcRef = useRef(qc);
  qcRef.current = qc;

  useEffect(() => {
    if (!enabled) return;
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    // ★ INP-optimized invalidation: batch keys, flush on idle
    let pendingKeys: Set<string> | null = null;
    let idleHandle: ReturnType<typeof requestIdleCallback> | null = null;

    const scheduleInvalidation = (keys: string[]) => {
      if (!pendingKeys) pendingKeys = new Set();
      for (const key of keys) pendingKeys.add(key);

      // Already scheduled? Skip.
      if (idleHandle !== null) return;

      // Flush during idle time — never blocks user interaction
      const flush = () => {
        idleHandle = null;
        if (!pendingKeys) return;
        const keysToFlush = Array.from(pendingKeys);
        pendingKeys = null;
        for (const key of keysToFlush) {
          qcRef.current.invalidateQueries({ queryKey: [key] });
        }
      };

      if (typeof requestIdleCallback !== 'undefined') {
        idleHandle = requestIdleCallback(flush, { timeout: 2000 });
      } else {
        // Fallback: defer to next frame
        idleHandle = requestAnimationFrame(flush) as unknown as number;
      }
    };

    // ★ Polling fallback — when Pusher is not configured, poll every 120s
    // INP optimization: reduced from 30s to 120s — 4x fewer query invalidations
    if (!pusherKey || !pusherCluster) {
      const pollInterval = setInterval(() => {
        scheduleInvalidation(['stats', 'feed']);
      }, 120_000);
      return () => clearInterval(pollInterval);
    }

    let pusher: any;
    const channels: any[] = [];

    import('pusher-js').then(({ default: PusherJS }) => {
      pusher = new PusherJS(pusherKey, { cluster: pusherCluster });

      // ─── Feed Channel ───
      const feedCh = pusher.subscribe('idm-feed');
      feedCh.bind('feed-updated', () => {
        scheduleInvalidation(['feed', 'stats', 'admin-players']);
      });
      feedCh.bind('donation-approved', () => {
        scheduleInvalidation(['feed', 'donations', 'top-donors']);
      });
      feedCh.bind('donation-rejected', () => {
        scheduleInvalidation(['donations', 'feed']);
      });
      feedCh.bind('player-registered', () => {
        scheduleInvalidation(['feed', 'stats', 'tournament-overview', 'admin-players']);
      });
      feedCh.bind('club-member-changed', () => {
        scheduleInvalidation(['feed', 'stats', 'clubs', 'admin-players']);
      });
      channels.push(feedCh);

      // ─── Leaderboard Channel ───
      const lbCh = pusher.subscribe('idm-leaderboard');
      lbCh.bind('leaderboard-updated', () => {
        scheduleInvalidation(['leaderboard', 'rankings', 'stats', 'admin-players']);
      });
      channels.push(lbCh);

      // ─── Tournament Channel ───
      const tCh = pusher.subscribe('idm-tournament');
      tCh.bind('tournament-scored', () => {
        scheduleInvalidation(['stats', 'feed']);
      });
      tCh.bind('tournament-finalized', () => {
        scheduleInvalidation(['stats', 'feed', 'tournament-overview', 'my-tournament-status']);
      });
      tCh.bind('tournament-status-changed', () => {
        scheduleInvalidation(['stats', 'feed', 'tournament-overview', 'my-tournament-status']);
      });
      tCh.bind('tournament-created', () => {
        scheduleInvalidation(['stats', 'feed', 'tournament-overview']);
      });
      channels.push(tCh);

      // ─── League Channel ───
      const lCh = pusher.subscribe('idm-league');
      lCh.bind('league-match-scored', () => {
        scheduleInvalidation(['stats', 'feed']);
      });
      lCh.bind('season-closed', () => {
        scheduleInvalidation(['stats', 'feed']);
      });
      channels.push(lCh);
    }).catch(() => {
      // Pusher not available — graceful fallback to polling (120s interval for INP)
      const pollInterval = setInterval(() => {
        scheduleInvalidation(['stats', 'feed']);
      }, 120_000);
      // Store cleanup for fallback polling
      return () => clearInterval(pollInterval);
    });

    return () => {
      for (const ch of channels) {
        ch.unbind_all();
        ch.unsubscribe();
      }
      if (pusher) pusher.disconnect();
      if (idleHandle !== null && typeof cancelIdleCallback !== 'undefined') {
        cancelIdleCallback(idleHandle);
      }
    };
  }, [enabled]);
}
