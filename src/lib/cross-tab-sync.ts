'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

/**
 * Cross-tab cache invalidation using BroadcastChannel API.
 *
 * When admin updates data (logo, banner, etc.) in one browser tab,
 * this hook ensures the landing page in OTHER tabs invalidates its cache
 * and fetches fresh data.
 *
 * Usage:
 * - In admin mutations: broadcastInvalidation('stats')
 * - In landing page: useCrossTabInvalidation() — listens and refetches
 */

const CHANNEL_NAME = 'idm-league-cache-sync';

// Message types that trigger cache invalidation
type InvalidationMessage = {
  type: 'invalidate';
  keys: string[];
  timestamp: number;
};

// Singleton channel — shared across hook instances
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel {
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }
  return channel;
}

/**
 * Broadcast cache invalidation to other tabs.
 * Call this in admin mutation onSuccess callbacks.
 */
export function broadcastInvalidation(...queryKeys: string[]) {
  try {
    const ch = getChannel();
    const message: InvalidationMessage = {
      type: 'invalidate',
      keys: queryKeys,
      timestamp: Date.now(),
    };
    ch.postMessage(message);
  } catch {
    // BroadcastChannel not supported — silently fail
    // Cross-tab sync won't work, but same-tab invalidation still works
  }
}

/**
 * Hook to listen for cross-tab cache invalidation messages.
 * Add this to the landing page component.
 *
 * When another tab (admin panel) broadcasts invalidation,
 * this hook invalidates the matching React Query cache entries
 * and triggers a refetch.
 */
export function useCrossTabInvalidation() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let ch: BroadcastChannel;
    try {
      ch = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      // BroadcastChannel not supported
      return;
    }

    ch.onmessage = (event: MessageEvent<InvalidationMessage>) => {
      const { type, keys } = event.data;
      if (type === 'invalidate' && keys.length > 0) {
        // Invalidate only the specific query keys — React Query will refetch on next render
        for (const key of keys) {
          queryClient.invalidateQueries({ queryKey: [key] });
        }
        // NOTE: Removed blanket invalidateQueries() — it was nuking ALL caches
        // causing mass refetching that blocks the main thread (INP +200-400ms)
      }
    };

    return () => {
      ch.close();
    };
  }, [queryClient]);
}
