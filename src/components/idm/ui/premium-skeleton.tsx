'use client';

import { cn } from '@/lib/utils';

/**
 * Premium skeleton loading components matching the Night Gold theme.
 * Uses the `skeleton-shimmer` CSS animation from globals.css.
 *
 * Usage:
 *   <Skeleton className="h-4 w-48" />
 *   <SkeletonCircle size={48} />
 *   <SkeletonCard />
 */

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn('skeleton-shimmer', className)}
      aria-hidden="true"
    />
  );
}

interface SkeletonCircleProps {
  size?: number;
  className?: string;
}

export function SkeletonCircle({ size = 40, className }: SkeletonCircleProps) {
  return (
    <div
      className={cn('skeleton-shimmer rounded-full', className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div className={cn('rounded-2xl overflow-hidden', className)} aria-hidden="true">
      {/* Avatar area */}
      <Skeleton className="w-full aspect-[3/4]" />
      {/* Info overlay */}
      <div className="p-4 sm:p-5 space-y-2">
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-2 w-1/2" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-2 w-8" />
          <Skeleton className="h-2 w-8" />
          <Skeleton className="h-2 w-8" />
        </div>
      </div>
    </div>
  );
}

/** Skeleton for leaderboard standings rows */
export function SkeletonRow({ className }: SkeletonProps) {
  return (
    <div className={cn('flex items-center gap-3 px-3 py-2.5', className)} aria-hidden="true">
      <Skeleton className="h-5 w-5 rounded-full shrink-0" />
      <SkeletonCircle size={32} />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-2 w-16" />
      </div>
      <Skeleton className="h-4 w-8" />
    </div>
  );
}

/** Skeleton for stat cards */
export function SkeletonStat({ className }: SkeletonProps) {
  return (
    <div className={cn('p-4 rounded-xl space-y-2', className)} aria-hidden="true">
      <Skeleton className="h-2 w-12" />
      <Skeleton className="h-6 w-16" />
      <Skeleton className="h-2 w-20" />
    </div>
  );
}
