'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { hexToRgba } from '@/lib/utils';

/* ═══════════════════════════════════════════════
   Tarkam IDM — Reusable Skeleton Components
   Elegant shimmer placeholders for loading states
   ═══════════════════════════════════════════════ */

/* ─── Base shimmer block — the atomic building unit ─── */
function ShimmerBlock({ className = '' }: { className?: string }) {
  return (
    <div
      className={`skeleton-shimmer rounded-md bg-muted/50 ${className}`}
      aria-hidden="true"
    />
  );
}

/* ─── CardSkeleton ─── */
export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <Card className={`overflow-hidden border border-border/50 ${className}`}>
      <CardContent className="p-4 space-y-3">
        <ShimmerBlock className="h-4 w-3/4" />
        <ShimmerBlock className="h-3 w-1/2" />
        <div className="flex items-center gap-2 pt-1">
          <ShimmerBlock className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <ShimmerBlock className="h-3 w-2/3" />
            <ShimmerBlock className="h-2 w-1/3" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── AvatarSkeleton ─── */
export function AvatarSkeleton({
  size = 'md',
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const sizeMap = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-20 h-20',
    xl: 'w-24 h-24',
  };
  return <ShimmerBlock className={`${sizeMap[size]} rounded-full ${className}`} />;
}

/* ─── TextSkeleton ─── */
export function TextSkeleton({
  width = 'medium',
  className = '',
  lines = 1,
}: {
  width?: 'short' | 'medium' | 'long';
  className?: string;
  lines?: number;
}) {
  const widthMap = {
    short: 'w-1/4',
    medium: 'w-1/2',
    long: 'w-3/4',
  };
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <ShimmerBlock
          key={i}
          className={`h-3 ${i === lines - 1 ? widthMap[width] : 'w-full'} ${className}`}
        />
      ))}
    </div>
  );
}

/* ─── StatsRowSkeleton ─── */
export function StatsRowSkeleton({ count = 4, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`grid grid-cols-2 lg:grid-cols-${count} gap-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border/50 bg-card p-4 sm:p-6 text-center space-y-2">
          <ShimmerBlock className="w-8 h-8 sm:w-10 sm:h-10 mx-auto rounded-lg" />
          <ShimmerBlock className="h-5 sm:h-7 w-12 mx-auto" />
          <ShimmerBlock className="h-2 w-14 mx-auto" />
        </div>
      ))}
    </div>
  );
}

/* ─── MatchRowSkeleton ─── */
export function MatchRowSkeleton({ count = 3, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-stretch rounded-lg overflow-hidden border border-border/50 bg-card/60"
        >
          {/* Week indicator */}
          <div className="w-10 shrink-0 flex items-center justify-center bg-muted/30 border-r border-border/50">
            <ShimmerBlock className="h-3 w-6" />
          </div>
          {/* Teams */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center px-3 py-1.5 border-b border-border/30">
              <ShimmerBlock className="h-3 flex-1 mr-2" />
              <ShimmerBlock className="h-4 w-5" />
            </div>
            <div className="flex items-center px-3 py-1.5">
              <ShimmerBlock className="h-3 flex-1 mr-2" />
              <ShimmerBlock className="h-4 w-5" />
            </div>
          </div>
          {/* Status */}
          <div className="w-14 shrink-0 flex items-center justify-center border-l border-transparent">
            <ShimmerBlock className="h-4 w-8 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── MVPCardSkeleton ─── */
export function MVPCardSkeleton({
  accent = '#2E9FFF',
  className = '',
}: {
  accent?: string;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-2xl overflow-hidden min-h-[520px] border ${className}`}
      style={{ borderColor: hexToRgba(accent, 0x15) }}
      aria-hidden="true"
    >
      {/* Neon accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 z-20"
        style={{ background: `linear-gradient(to right, transparent, ${accent}, transparent)` }}
      />
      {/* Background shimmer blocks */}
      <div className="absolute inset-0">
        <ShimmerBlock className="w-full h-full rounded-none" />
      </div>
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-background/30" />

      {/* Top Badges */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        <ShimmerBlock className="h-7 w-20 rounded-lg" />
        <ShimmerBlock className="h-7 w-16 rounded-lg" />
      </div>

      {/* Bottom Info */}
      <div className="absolute bottom-0 inset-x-0 p-5 z-10 space-y-3">
        <ShimmerBlock className="h-3 w-16 rounded" />
        <ShimmerBlock className="h-8 w-32 rounded" />
        <div className="flex items-center gap-2.5 mt-2">
          <ShimmerBlock className="h-5 w-12 rounded-lg" />
          <ShimmerBlock className="h-5 w-16 rounded-lg" />
        </div>
        {/* Stats Row */}
        <div className="flex items-center gap-5 mt-4 pt-3 border-t border-border/30">
          <div>
            <ShimmerBlock className="h-6 w-10 mb-1" />
            <ShimmerBlock className="h-2 w-12" />
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div>
            <ShimmerBlock className="h-6 w-10 mb-1" />
            <ShimmerBlock className="h-2 w-10" />
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div>
            <ShimmerBlock className="h-6 w-10 mb-1" />
            <ShimmerBlock className="h-2 w-12" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── ChampionCardSkeleton ─── */
export function ChampionCardSkeleton({
  accent = '#2E9FFF',
  division = 'male',
  className = '',
}: {
  accent?: string;
  division?: 'male' | 'female';
  className?: string;
}) {
  return (
    <Card
      className={`overflow-hidden border ${className}`}
      style={{ borderColor: hexToRgba(accent, 0x20) }}
      aria-hidden="true"
    >
      {/* Accent line */}
      <div
        className="h-0.5"
        style={{ background: `linear-gradient(to right, transparent, ${accent}, transparent)` }}
      />
      <CardContent className="p-0">
        {/* Banner area */}
        <div className="relative h-48 overflow-hidden">
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, ${hexToRgba(accent, 0x08)} 0%, ${hexToRgba(accent, 0x04)} 50%, transparent 100%)` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          {/* Division label */}
          <div className="absolute bottom-4 inset-x-0 px-5 flex items-end justify-between">
            <div className="flex items-center gap-3">
              <ShimmerBlock className="w-9 h-9 rounded-2xl" />
              <div className="space-y-1.5">
                <ShimmerBlock className="h-4 w-28 rounded" />
                <ShimmerBlock className="h-2 w-20 rounded" />
              </div>
            </div>
            <ShimmerBlock className="h-5 w-16 rounded-lg" />
          </div>
        </div>
        {/* Content area */}
        <div className="p-5 space-y-4">
          {/* Team name */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShimmerBlock className="w-5 h-5 rounded" />
              <ShimmerBlock className="h-6 w-32 rounded" />
            </div>
            <div className="flex items-center gap-2">
              <ShimmerBlock className="h-5 w-20 rounded-lg" />
            </div>
          </div>
          {/* 3 Player slots */}
          <div className="flex rounded-2xl overflow-hidden border border-border/30" style={{ height: '320px' }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="relative flex-1 border-r last:border-r-0 border-border/20">
                <ShimmerBlock className="absolute inset-0 rounded-none" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
                <div className="absolute top-3 left-3 z-10">
                  <ShimmerBlock className="w-7 h-7 rounded-lg" />
                </div>
                <div className="absolute bottom-0 inset-x-0 p-3 z-10">
                  <ShimmerBlock className="h-4 w-16 mb-2 rounded" />
                  <ShimmerBlock className="h-3 w-10 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── TableSkeleton ─── */
export function TableSkeleton({
  rows = 5,
  cols = 4,
  className = '',
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-border/50 overflow-hidden ${className}`} aria-hidden="true">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-muted/30">
        {Array.from({ length: cols }).map((_, i) => (
          <ShimmerBlock key={i} className={`h-3 ${i === 0 ? 'w-16' : i === cols - 1 ? 'w-12' : 'flex-1'}`} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex items-center gap-3 px-4 py-3 border-b border-border/20 last:border-b-0"
        >
          {/* Rank circle */}
          <ShimmerBlock className="w-6 h-6 rounded-full shrink-0" />
          {/* Avatar */}
          <ShimmerBlock className="w-8 h-8 rounded-full shrink-0" />
          {Array.from({ length: cols - 2 }).map((_, colIdx) => (
            <ShimmerBlock
              key={colIdx}
              className={`h-3 ${colIdx === 0 ? 'flex-1' : colIdx === cols - 3 ? 'w-12' : 'w-14'}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ─── SectionHeaderSkeleton ─── */
export function SectionHeaderSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`text-center mb-14 ${className}`} aria-hidden="true">
      <div className="flex items-center justify-center gap-3 mb-4">
        <ShimmerBlock className="h-px w-16" />
        <ShimmerBlock className="h-7 w-28 rounded-full" />
        <ShimmerBlock className="h-px w-16" />
      </div>
      <ShimmerBlock className="h-8 sm:h-10 w-48 mx-auto mb-3 rounded-lg" />
      <ShimmerBlock className="h-3 w-64 mx-auto rounded" />
    </div>
  );
}

/* ─── CasinoHeroSkeleton — for dashboard hero banner ─── */
export function CasinoHeroSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative rounded-2xl overflow-hidden min-h-[180px] border border-border/50 ${className}`}
      aria-hidden="true"
    >
      <ShimmerBlock className="absolute inset-0 rounded-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
      <div className="absolute bottom-4 left-5 right-5 z-10 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <ShimmerBlock className="h-5 w-20 rounded-lg" />
          <ShimmerBlock className="h-5 w-20 rounded-lg" />
        </div>
        <ShimmerBlock className="h-6 w-48 rounded" />
        <ShimmerBlock className="h-3 w-32 rounded" />
      </div>
    </div>
  );
}

/* ─── MatchDayHeroSkeleton — for match day center hero ─── */
export function MatchDayHeroSkeleton({ className = '' }: { className?: string }) {
  return (
    <Card className={`overflow-hidden border border-border/50 ${className}`} aria-hidden="true">
      <CardContent className="p-0">
        <div className="relative p-4 lg:p-6">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <ShimmerBlock className="h-6 w-16 rounded-lg" />
              <ShimmerBlock className="h-6 w-24 rounded-lg" />
            </div>
            <ShimmerBlock className="h-6 w-16 rounded-lg" />
          </div>
          {/* VS center */}
          <div className="flex items-center gap-4 lg:gap-8 py-6">
            {/* Team 1 */}
            <div className="flex-1 text-center space-y-3">
              <ShimmerBlock className="w-20 h-20 lg:w-28 lg:h-28 mx-auto rounded-2xl" />
              <ShimmerBlock className="h-5 w-20 mx-auto rounded" />
            </div>
            {/* VS */}
            <div className="flex flex-col items-center shrink-0 space-y-2">
              <ShimmerBlock className="w-16 h-16 lg:w-24 lg:h-24 rounded-full" />
              <ShimmerBlock className="h-3 w-16 rounded" />
            </div>
            {/* Team 2 */}
            <div className="flex-1 text-center space-y-3">
              <ShimmerBlock className="w-20 h-20 lg:w-28 lg:h-28 mx-auto rounded-2xl" />
              <ShimmerBlock className="h-5 w-20 mx-auto rounded" />
            </div>
          </div>
          {/* Meta */}
          <div className="flex items-center justify-center gap-4 mt-4">
            <ShimmerBlock className="h-3 w-20 rounded" />
            <ShimmerBlock className="h-3 w-16 rounded" />
            <ShimmerBlock className="h-3 w-20 rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
