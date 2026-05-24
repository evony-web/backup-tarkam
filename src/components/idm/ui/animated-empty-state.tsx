'use client';

import React from 'react';
import { useDivisionTheme } from '@/hooks/use-division-theme';

interface AnimatedEmptyStateProps {
  /** The lucide icon component to display */
  icon: React.ComponentType<{ className?: string }>;
  /** Main message — rendered with gradient text */
  message: string;
  /** Subtitle/hint text */
  hint: string;
  /** Optional CTA button */
  cta?: React.ReactNode;
  /** Show subtle background pattern */
  pattern?: boolean;
}

/**
 * Reusable animated empty state component for dashboard sections.
 * Features: floating/rotating icon, pulsing glow ring, sparkle decorations, gradient text.
 * CSS-only animations for performance. Respects prefers-reduced-motion.
 */
export function AnimatedEmptyState({ icon: Icon, message, hint, cta, pattern }: AnimatedEmptyStateProps) {
  const dt = useDivisionTheme();

  return (
    <div className={`relative p-8 rounded-2xl ${dt.bgSubtle} ${dt.border} text-center overflow-hidden`}>
      {/* Subtle background pattern */}
      {pattern && (
        <div className="empty-state-pattern absolute inset-0 pointer-events-none" aria-hidden="true" />
      )}
      {/* Icon container with glow ring and sparkles */}
      <div className="relative inline-flex items-center justify-center mb-4">
        {/* Pulsing glow ring behind icon */}
        <div className={`empty-glow-ring absolute inset-0 rounded-full ${dt.bg}`} />

        {/* Floating icon with subtle rotation */}
        <div className="empty-icon-float relative z-10">
          <Icon className={`w-10 h-10 ${dt.text} opacity-50`} />
        </div>

        {/* Sparkle/dot decorations around the icon */}
        <span className={`empty-sparkle empty-sparkle-1 absolute w-1.5 h-1.5 rounded-full ${dt.text} opacity-60`} />
        <span className={`empty-sparkle empty-sparkle-2 absolute w-1 h-1 rounded-full ${dt.text} opacity-40`} />
        <span className={`empty-sparkle empty-sparkle-3 absolute w-1 h-1 rounded-full ${dt.text} opacity-50`} />
        <span className={`empty-sparkle empty-sparkle-4 absolute w-0.5 h-0.5 rounded-full ${dt.text} opacity-30`} />
      </div>

      {/* Gradient text message */}
      <p className={`empty-gradient-text text-sm font-semibold bg-gradient-to-r ${dt.division === 'male'
        ? 'from-idm-male via-idm-male-light to-idm-male'
        : 'from-idm-female via-idm-female-light to-idm-female'
      } bg-clip-text text-transparent`}>
        {message}
      </p>

      {/* Hint text */}
      <p className="text-[10px] text-muted-foreground/60 mt-1.5">{hint}</p>

      {/* Optional CTA */}
      {cta && <div className="mt-3">{cta}</div>}
    </div>
  );
}
