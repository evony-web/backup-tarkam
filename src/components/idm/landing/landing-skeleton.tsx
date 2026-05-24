'use client';

import React from 'react';

/**
 * LandingSkeleton — Full-page skeleton that mimics the landing page layout.
 * Shown while data (players, seasons, clubs, CMS) is being fetched.
 * Sections match: Hero, Marquee, TournamentHub, Players, Highlights,
 * SeasonChampion, Experiences, Clubs, CTA, Footer.
 */

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-lg ${className}`} />;
}

function SkeletonCard({ className = '', children }: { className?: string; children?: React.ReactNode }) {
  return <div className={`rounded-2xl border border-border/30 bg-card/40 p-4 space-y-3 ${className}`}>{children}</div>;
}

/* ─── Hero Skeleton ─── */
function HeroSkeleton() {
  return (
    <section className="relative min-h-[60vh] sm:min-h-[80vh] flex items-center justify-center overflow-hidden">
      {/* Background shimmer */}
      <div className="absolute inset-0 skeleton-shimmer opacity-20" />
      <div className="relative z-10 text-center space-y-4 px-4 max-w-2xl mx-auto">
        <SkeletonBlock className="h-6 w-32 mx-auto" />
        <SkeletonBlock className="h-12 sm:h-16 w-72 sm:w-96 mx-auto" />
        <SkeletonBlock className="h-5 w-48 mx-auto" />
        <div className="flex items-center justify-center gap-3 pt-4">
          <SkeletonBlock className="h-10 w-32 rounded-full" />
          <SkeletonBlock className="h-10 w-28 rounded-full" />
        </div>
      </div>
    </section>
  );
}

/* ─── Marquee Skeleton ─── */
function MarqueeSkeleton() {
  return (
    <div className="border-y border-idm-gold-warm/10 bg-deep/80 py-2">
      <div className="flex items-center gap-6 px-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 shrink-0">
            <SkeletonBlock className="h-4 w-4 rounded-full" />
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="h-3 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── TournamentHub Skeleton ─── */
function TournamentHubSkeleton() {
  return (
    <section className="py-12 px-4 max-w-7xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <SkeletonBlock className="h-8 w-56 mx-auto" />
        <SkeletonBlock className="h-4 w-72 mx-auto" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SkeletonCard>
          <SkeletonBlock className="h-5 w-24" />
          <SkeletonBlock className="h-10 w-full" />
          <SkeletonBlock className="h-3 w-32" />
        </SkeletonCard>
        <SkeletonCard>
          <SkeletonBlock className="h-5 w-24" />
          <SkeletonBlock className="h-10 w-full" />
          <SkeletonBlock className="h-3 w-32" />
        </SkeletonCard>
      </div>
    </section>
  );
}

/* ─── Players Skeleton ─── */
function PlayersSkeleton() {
  return (
    <section className="py-12 px-4 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-8 w-36" />
        <SkeletonBlock className="h-7 w-20 rounded-full" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-border/20 bg-card/30">
            <SkeletonBlock className="h-14 w-14 rounded-full" />
            <SkeletonBlock className="h-3 w-16" />
            <SkeletonBlock className="h-2 w-10" />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Highlights / MVP Skeleton ─── */
function HighlightsSkeleton() {
  return (
    <section className="py-12 px-4 max-w-7xl mx-auto space-y-6">
      <SkeletonBlock className="h-8 w-48 mx-auto" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i}>
            <SkeletonBlock className="h-40 w-full rounded-xl" />
            <SkeletonBlock className="h-5 w-32" />
            <SkeletonBlock className="h-3 w-48" />
          </SkeletonCard>
        ))}
      </div>
    </section>
  );
}

/* ─── Season Champion Skeleton ─── */
function SeasonChampionSkeleton() {
  return (
    <section className="py-12 px-4 max-w-7xl mx-auto space-y-6">
      <SkeletonBlock className="h-8 w-52 mx-auto" />
      <div className="flex justify-center">
        <SkeletonCard className="w-full max-w-md text-center">
          <div className="flex flex-col items-center gap-3">
            <SkeletonBlock className="h-20 w-20 rounded-full" />
            <SkeletonBlock className="h-6 w-32" />
            <SkeletonBlock className="h-4 w-20" />
            <SkeletonBlock className="h-3 w-48" />
          </div>
        </SkeletonCard>
      </div>
    </section>
  );
}

/* ─── Experiences / Video Skeleton ─── */
function ExperiencesSkeleton() {
  return (
    <section className="py-12 px-4 max-w-7xl mx-auto space-y-6">
      <SkeletonBlock className="h-8 w-40 mx-auto" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i}>
            <div className="relative aspect-video rounded-xl overflow-hidden">
              <SkeletonBlock className="absolute inset-0" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-background/30" />
              </div>
            </div>
            <SkeletonBlock className="h-4 w-36" />
          </SkeletonCard>
        ))}
      </div>
    </section>
  );
}

/* ─── Clubs Skeleton ─── */
function ClubsSkeleton() {
  return (
    <section className="py-12 px-4 max-w-7xl mx-auto space-y-6">
      <SkeletonBlock className="h-8 w-36 mx-auto" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-border/20 bg-card/30">
            <SkeletonBlock className="h-12 w-12 rounded-xl" />
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="h-2 w-14" />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── CTA Skeleton ─── */
function CTASkeleton() {
  return (
    <section className="py-16 px-4 max-w-4xl mx-auto text-center space-y-4">
      <SkeletonBlock className="h-10 w-72 mx-auto" />
      <SkeletonBlock className="h-4 w-96 mx-auto" />
      <div className="flex items-center justify-center gap-3 pt-4">
        <SkeletonBlock className="h-11 w-36 rounded-full" />
        <SkeletonBlock className="h-11 w-28 rounded-full" />
      </div>
    </section>
  );
}

/* ─── Footer Skeleton ─── */
function FooterSkeleton({ className = '' }: { className?: string } = {}) {
  return (
    <footer className={`py-8 px-4 border-t border-border/20 ${className}`}>
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <SkeletonBlock className="h-4 w-48" />
        <SkeletonBlock className="h-3 w-36" />
      </div>
    </footer>
  );
}

/* ─── Section Divider Skeleton ─── */
function DividerSkeleton() {
  return <div className="h-px bg-border/20 my-0" />;
}

/* ═══ Full Landing Skeleton ═══ */
export function LandingSkeleton() {
  return (
    <div className="relative min-h-screen flex flex-col bg-background overflow-hidden landing-scroll pb-24 md:pb-0">
      {/* Nav skeleton */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 border-b border-idm-gold-warm/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <SkeletonBlock className="h-7 w-7 rounded-lg" />
            <SkeletonBlock className="h-4 w-24" />
          </div>
          <div className="hidden sm:flex items-center gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-4 w-14" />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <SkeletonBlock className="h-8 w-8 rounded-full" />
            <SkeletonBlock className="h-8 w-16 rounded-full" />
          </div>
        </div>
      </nav>

      {/* Main content skeleton */}
      <HeroSkeleton />
      <MarqueeSkeleton />
      <TournamentHubSkeleton />
      <DividerSkeleton />
      <PlayersSkeleton />
      <DividerSkeleton />
      <HighlightsSkeleton />
      <DividerSkeleton />
      <SeasonChampionSkeleton />
      <DividerSkeleton />
      <ExperiencesSkeleton />
      <DividerSkeleton />
      <ClubsSkeleton />
      <DividerSkeleton />
      <CTASkeleton />
      <FooterSkeleton className="mt-auto" />

      {/* Mobile bottom nav skeleton */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/98 border-t border-idm-gold-warm/10 safe-area-bottom">
        <div className="flex items-center justify-around h-16">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <SkeletonBlock className="h-5 w-5 rounded" />
              <SkeletonBlock className="h-2 w-10" />
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
}
