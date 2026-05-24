'use client';

import { cn } from '@/lib/utils';

interface AchievementBadgeProps {
  icon: string;
  name: string;
  displayName: string;
  description: string;
  tier: string;
  earned?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  animated?: boolean;
}

const tierColors: Record<string, string> = {
  bronze: 'from-amber-700 to-amber-900 border-amber-600',
  silver: 'from-gray-400 to-gray-600 border-gray-300',
  gold: 'from-yellow-500 to-amber-600 border-yellow-400',
  platinum: 'from-slate-300 to-slate-500 border-slate-200',
  diamond: 'from-cyan-400 to-blue-600 border-cyan-300',
};

const tierGlow: Record<string, string> = {
  bronze: 'shadow-amber-500/30',
  silver: 'shadow-gray-400/30',
  gold: 'shadow-yellow-500/50',
  platinum: 'shadow-slate-300/40',
  diamond: 'shadow-cyan-400/50',
};

const tierSizes = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-12 h-12 text-xl',
  lg: 'w-16 h-16 text-2xl',
};

export function AchievementBadge({
  icon,
  name,
  displayName,
  description,
  tier,
  earned = true,
  size = 'md',
  showLabel = true,
  animated = true,
}: AchievementBadgeProps) {
  const isEarned = earned;

  return (
    <div
      className={cn(
        'flex items-center gap-2',
        !isEarned && 'opacity-40 grayscale',
        animated && 'animate-fade-enter hover-scale-md'
      )}
    >
      {/* Badge Icon */}
      <div className="relative group">
        <div
          className={cn(
            'rounded-full bg-gradient-to-br border-2 flex items-center justify-center',
            tierSizes[size],
            isEarned ? tierColors[tier] : 'from-gray-600 to-gray-800 border-gray-500',
            isEarned && `shadow-lg ${tierGlow[tier]}`
          )}
        >
          <span className={isEarned ? '' : 'opacity-50'}>{icon}</span>
        </div>

        {/* Glow effect for earned achievements */}
        {isEarned && animated && (
          <div
            className={cn(
              'absolute inset-0 rounded-full bg-gradient-to-br opacity-50 blur-md -z-10 animate-pulse-scale',
              tierColors[tier]
            )}
          />
        )}

        {/* Tooltip */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-popover border border-border shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap">
          <p className="text-xs font-semibold">{displayName}</p>
          <p className="text-[10px] text-muted-foreground">{description}</p>
          <p className={cn('text-[9px] mt-1 uppercase tracking-wider', `text-${tier === 'diamond' ? 'cyan' : tier === 'gold' ? 'yellow' : tier === 'platinum' ? 'slate' : tier === 'silver' ? 'gray' : 'amber'}-400`)}>
            {tier}
          </p>
        </div>
      </div>

      {/* Label */}
      {showLabel && (
        <div className="flex flex-col">
          <span className="text-xs font-medium">{displayName}</span>
          <span className="text-[10px] text-muted-foreground">{tier}</span>
        </div>
      )}
    </div>
  );
}

// Achievement badge list component
interface Achievement {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  icon: string;
  tier: string;
  earned?: boolean;
  earnedAt?: string;
  context?: Record<string, unknown>;
}

interface AchievementListProps {
  achievements: Achievement[];
  maxShow?: number;
  size?: 'sm' | 'md' | 'lg';
  showUnearned?: boolean;
}

export function AchievementList({
  achievements,
  maxShow,
  size = 'sm',
  showUnearned = false,
}: AchievementListProps) {
  const displayAchievements = maxShow
    ? achievements.slice(0, maxShow)
    : achievements;

  if (displayAchievements.length === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-2">
        Belum ada achievement
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {displayAchievements.map((achievement, i) => (
        <AchievementBadge
          key={achievement.id || i}
          icon={achievement.icon}
          name={achievement.name}
          displayName={achievement.displayName}
          description={achievement.description}
          tier={achievement.tier}
          earned={achievement.earned !== false}
          size={size}
          showLabel={false}
        />
      ))}
      {maxShow && achievements.length > maxShow && (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-xs text-muted-foreground">
          +{achievements.length - maxShow}
        </div>
      )}
    </div>
  );
}
