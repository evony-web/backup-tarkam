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
}

/**
 * Reusable animated empty state component for dashboard sections.
 * Features: floating icon, pulsing glow ring, sparkle decorations, gradient text.
 * CSS-only animations for performance.
 */
export function AnimatedEmptyState({ icon: Icon, message, hint, cta }: AnimatedEmptyStateProps) {
  const dt = useDivisionTheme();

  return (
    <div className={`relative p-8 rounded-2xl ${dt.bgSubtle} ${dt.border} text-center overflow-hidden`}>
      {/* Pulsing glow ring behind icon */}
      <div className="relative inline-block mb-3">
        <div
          className={`empty-glow-ring absolute inset-0 w-16 h-16 rounded-full mx-auto ${dt.bg} blur-md`}
          style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '64px', height: '64px' }}
        />
        {/* Floating icon */}
        <div className="empty-icon-float relative">
          <Icon className={`w-10 h-10 mx-auto ${dt.text} opacity-40`} />
          {/* Sparkle dots */}
          <span className={`empty-sparkle-1 absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full ${dt.text} opacity-60`} />
          <span className={`empty-sparkle-2 absolute -top-2 left-0 w-1 h-1 rounded-full ${dt.text} opacity-40`} />
          <span className={`empty-sparkle-3 absolute bottom-0 -right-2 w-1 h-1 rounded-full ${dt.text} opacity-50`} />
        </div>
      </div>

      {/* Gradient text message */}
      <p className={`text-sm font-semibold bg-gradient-to-r from-idm-gold-warm via-idm-amber to-idm-gold-warm bg-clip-text text-transparent`}>
        {message}
      </p>

      {/* Hint text */}
      <p className="text-[10px] text-muted-foreground/60 mt-1.5">{hint}</p>

      {/* Optional CTA */}
      {cta && <div className="mt-3">{cta}</div>}
    </div>
  );
}
