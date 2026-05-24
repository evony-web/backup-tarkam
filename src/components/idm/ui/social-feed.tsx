'use client';

import { Heart, MessageCircle, Share2, TrendingUp, Flame, Clock, Users } from 'lucide-react';
import { useState, useEffect } from 'react';
import Image from 'next/image';

interface FeedItem {
  id: string;
  type: 'match_result' | 'achievement' | 'mvp' | 'tournament' | 'champion';
  title: string;
  description?: string;
  image?: string;
  timestamp: string;
  engagement?: {
    likes: number;
    comments: number;
    shares: number;
  };
  author?: {
    name: string;
    avatar?: string;
  };
  metadata?: Record<string, any>;
}

interface SocialFeedProps {
  items: FeedItem[];
  className?: string;
}

export function SocialFeed({ items, className = '' }: SocialFeedProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {items.map((item, index) => (
        <FeedCard key={item.id} item={item} index={index} />
      ))}
    </div>
  );
}

function FeedCard({ item, index }: { item: FeedItem; index: number }) {
  const [liked, setLiked] = useState(false);

  const getIcon = () => {
    switch (item.type) {
      case 'match_result':
        return <Flame className="w-4 h-4 text-orange-400" />;
      case 'achievement':
        return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'mvp':
        return <Users className="w-4 h-4 text-idm-gold-warm" />;
      case 'tournament':
        return <Clock className="w-4 h-4 text-blue-400" />;
      case 'champion':
        return <TrendingUp className="w-4 h-4 text-idm-gold-warm" />;
      default:
        return null;
    }
  };

  return (
    <div
      className="animate-fade-enter feed-card p-4"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        {item.author?.avatar && (
          <Image
            src={item.author.avatar}
            alt={item.author.name}
            width={40}
            height={40}
            className="w-10 h-10 rounded-full object-cover"
          />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{item.author?.name || 'Tarkam IDM'}</span>
            {getIcon()}
          </div>
          <span className="text-xs text-muted-foreground">{item.timestamp}</span>
        </div>
      </div>

      {/* Content */}
      <div className="mb-3">
        <h4 className="font-bold text-base mb-1">{item.title}</h4>
        {item.description && (
          <p className="text-sm text-muted-foreground">{item.description}</p>
        )}
      </div>

      {/* Image */}
      {item.image && (
        <div className="rounded-lg overflow-hidden mb-3">
          <Image src={item.image} alt="" width={800} height={400} className="w-full h-auto object-cover" />
        </div>
      )}

      {/* Engagement */}
      {item.engagement && (
        <div className="flex items-center gap-4 pt-3 border-t border-border">
          <button
            onClick={() => setLiked(!liked)}
            className={`engagement-badge ${liked ? 'text-red-400' : ''}`}
          >
            <Heart
              className={`w-4 h-4 ${liked ? 'fill-red-400' : ''}`}
            />
            <span>{item.engagement.likes + (liked ? 1 : 0)}</span>
          </button>
          <button className="engagement-badge">
            <MessageCircle className="w-4 h-4" />
            <span>{item.engagement.comments}</span>
          </button>
          <button className="engagement-badge">
            <Share2 className="w-4 h-4" />
            <span>{item.engagement.shares}</span>
          </button>
        </div>
      )}
    </div>
  );
}

// Live Match Banner Component
interface LiveMatchBannerProps {
  team1: { name: string; logo?: string };
  team2: { name: string; logo?: string };
  score1?: number;
  score2?: number;
  division: 'male' | 'female';
  tournamentName: string;
  className?: string;
}

export function LiveMatchBanner({
  team1,
  team2,
  score1 = 0,
  score2 = 0,
  division,
  tournamentName,
  className = '',
}: LiveMatchBannerProps) {
  const accentColor = division === 'male' ? '#57B5FF' : '#FF5C9A';

  return (
    <div
      className={`animate-fade-enter relative rounded-2xl p-4 overflow-hidden ${className}`}
      style={{
        background: `linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)`,
        border: `1px solid ${accentColor}30`,
      }}
    >
      {/* Live indicator */}
      <div className="absolute top-3 right-3">
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/20 animate-pulse"
        >
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-[10px] font-bold text-red-400 uppercase">Live</span>
        </div>
      </div>

      {/* Tournament name */}
      <div className="text-xs text-muted-foreground mb-3">{tournamentName}</div>

      {/* Match */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {team1.logo && (
            <Image src={team1.logo} alt={team1.name} width={32} height={32} className="w-8 h-8 rounded-full" />
          )}
          <span className="font-bold">{team1.name}</span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-background">
          <span className="text-xl font-bold" style={{ color: accentColor }}>{score1}</span>
          <span className="text-muted-foreground">-</span>
          <span className="text-xl font-bold" style={{ color: accentColor }}>{score2}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-bold">{team2.name}</span>
          {team2.logo && (
            <Image src={team2.logo} alt={team2.name} width={32} height={32} className="w-8 h-8 rounded-full" />
          )}
        </div>
      </div>

      {/* Watch button */}
      <button
        className="hover-scale-sm mt-4 w-full py-2 rounded-lg text-sm font-bold"
        style={{
          background: `linear-gradient(135deg, ${accentColor}20, ${accentColor}10)`,
          border: `1px solid ${accentColor}30`,
          color: accentColor,
        }}
      >
        Tonton Sekarang
      </button>
    </div>
  );
}

// Countdown Timer Component
interface CountdownTimerProps {
  targetDate: Date;
  label?: string;
  className?: string;
}

export function CountdownTimer({ targetDate, label, className = '' }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const target = targetDate.getTime();
      const diff = target - now;

      if (diff <= 0) {
        clearInterval(interval);
        return;
      }

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  return (
    <div className={`text-center ${className}`}>
      {label && <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">{label}</div>}
      <div className="flex items-center justify-center gap-2">
        {[
          { value: timeLeft.days, label: 'D' },
          { value: timeLeft.hours, label: 'H' },
          { value: timeLeft.minutes, label: 'M' },
          { value: timeLeft.seconds, label: 'S' },
        ].map((item, index) => (
          <div key={index} className="text-center">
            <div
              className="animate-pulse-scale w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-lg bg-idm-gold-warm/10 border border-idm-gold-warm/20"
              key={`${item.value}-${index}`}
            >
              <span className="text-xl sm:text-2xl font-black text-idm-gold-warm">
                {String(item.value).padStart(2, '0')}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground mt-1">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
