'use client';

import { Star, Crown } from 'lucide-react';
import { AvatarMedia } from '@/components/ui/avatar-media';

interface MVPSpotlightProps {
  gamertag: string;
  avatar?: string | null;
  division: 'male' | 'female';
  stats?: {
    matches?: number;
    wins?: number;
    mvps?: number;
  };
  tournamentName?: string;
  className?: string;
}

export function MVPSpotlight({
  gamertag,
  avatar,
  division,
  stats,
  tournamentName,
  className = '',
}: MVPSpotlightProps) {
  const accentColor = division === 'male' ? '#57B5FF' : '#FF5C9A';

  return (
    <div
      className={`animate-fade-enter mvp-spotlight relative rounded-2xl p-6 overflow-hidden ${className}`}
    >
      {/* Spotlight glow background */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: `radial-gradient(ellipse at 50% 30%, ${accentColor}40 0%, transparent 60%)`,
        }}
      />

      {/* Animated particles — fewer, larger, slower for elegance */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full bg-idm-gold-warm animate-pulse-scale"
            style={{
              left: `${20 + Math.random() * 60}%`,
              top: `${20 + Math.random() * 60}%`,
              animationDelay: `${i * 0.4}s`,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 text-center">
        {/* MVP Badge — larger, premium style */}
        <div
          className="mvp-badge-premium inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5"
        >
          <Star className="w-4 h-4 text-idm-gold-warm fill-idm-gold-warm" />
          <span className="text-xs font-bold text-idm-gold-warm uppercase tracking-wider">
            MVP
          </span>
        </div>

        {/* Avatar with crown — gold pulse ring */}
        <div className="relative inline-block mb-3">
          <div
            className="w-24 h-24 rounded-full overflow-hidden border-4 gold-pulse-ring"
            style={{ borderColor: accentColor }}
          >
            {avatar ? (
              <AvatarMedia
                src={avatar}
                alt={gamertag}
                fill
                className="w-full h-full object-cover"
                sizes="96px"
                loading="lazy"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-2xl font-bold"
                style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
              >
                {gamertag.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Crown — gentle float */}
          <div
            className="absolute -top-3 left-1/2 -translate-x-1/2"
          >
            <Crown className="w-8 h-8 text-idm-gold-warm drop-shadow-[0_0_10px_rgba(239,249,35,0.5)]" />
          </div>
        </div>

        {/* Name */}
        <h3
          className="text-xl font-black mb-1"
          style={{ color: accentColor }}
        >
          {gamertag}
        </h3>

        {/* Tournament name */}
        {tournamentName && (
          <p className="text-xs text-muted-foreground mb-3">{tournamentName}</p>
        )}

        {/* Stats — with subtle panel background */}
        {stats && (
          <div className="mvp-stats-panel inline-flex items-center justify-center gap-4 mt-3 px-4 py-3">
            {stats.matches !== undefined && (
              <div className="text-center">
                <div className="text-lg font-bold">{stats.matches}</div>
                <div className="text-[10px] text-muted-foreground uppercase">Matches</div>
              </div>
            )}
            {stats.wins !== undefined && (
              <div className="text-center">
                <div className="text-lg font-bold text-green-400">{stats.wins}</div>
                <div className="text-[10px] text-muted-foreground uppercase">Wins</div>
              </div>
            )}
            {stats.mvps !== undefined && (
              <div className="text-center">
                <div className="text-lg font-bold text-idm-gold-warm">{stats.mvps}</div>
                <div className="text-[10px] text-muted-foreground uppercase">MVPs</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Mini MVP badge for cards — premium style
export function MVPBadge({ className = '' }: { className?: string }) {
  return (
    <div
      className={`mvp-badge-premium inline-flex items-center gap-1 px-2.5 py-1 rounded-full ${className}`}
    >
      <Star className="w-3.5 h-3.5 text-idm-gold-warm fill-idm-gold-warm" />
      <span className="text-[10px] font-bold text-idm-gold-warm">MVP</span>
    </div>
  );
}
