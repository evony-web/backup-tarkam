'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { AppShell } from '@/components/idm/app-shell';
import { ErrorBoundary } from '@/components/idm/error-boundary';
import type { CmsContent } from '@/lib/cms-data';

interface ClientAppProps {
  initialCms?: CmsContent;
  initialMaleStats?: any | null;
  initialFemaleStats?: any | null;
}

export function ClientApp({ initialCms, initialMaleStats, initialFemaleStats }: ClientAppProps) {
  const [queryClient] = useState(
    () => {
      const qc = new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000, // 15 seconds cache
            refetchOnWindowFocus: true,
            refetchOnMount: true, // Refetch on mount for fresher data
            refetchOnReconnect: true,
            retry: 1,
          },
        },
      });

      // ★ Hydrate React Query cache with SSR data
      // This ensures the first client render already has ALL data
      // and there's no "stale flash" or loading delay.
      if (initialCms) {
        qc.setQueryData(['cms-content'], initialCms);
      }

      // ★ Pre-hydrate stats data — matches the query keys used in landing-page.tsx
      // Query key: ['stats', 'male', null] — null is the default selectedSeasonId
      if (initialMaleStats) {
        qc.setQueryData(['stats', 'male', null], initialMaleStats);
      }
      if (initialFemaleStats) {
        qc.setQueryData(['stats', 'female', null], initialFemaleStats);
      }

      return qc;
    }
  );

  // ★ Non-blocking: init deferred until after page render
  // NOTE: Auto-seed DISABLED — manual seed only via admin panel or /api/seed?force=true
  // INP optimization: longer timeout (5s) and requestIdleCallback to avoid blocking first paint
  useEffect(() => {
    const deferInit = () => {
      // Init admin — fire and forget (only creates if none exists)
      fetch('/api/init-admin', { method: 'POST' }).catch(() => {});
    };

    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(deferInit, { timeout: 5000 });
    } else {
      setTimeout(deferInit, 5000);
    }
  }, []);

  // ★ Version check — less aggressive polling (every 2 min)
  useEffect(() => {
    let lastVersion: string | null = null;

    const checkVersion = async () => {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (lastVersion !== null && data.version !== lastVersion) {
          queryClient.invalidateQueries();
        }
        lastVersion = data.version;
      } catch {
        // Silent fail
      }
    };

    checkVersion();
    const interval = setInterval(checkVersion, 300_000); // 5min — reduced from 2min for INP optimization
    return () => clearInterval(interval);
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <AppShell />
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
