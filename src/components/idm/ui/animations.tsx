'use client';

import { type ReactNode } from 'react';

/**
 * CSS-only animation utilities — replaces heavy Framer Motion
 * AnimatePresence + motion.div patterns for better mid-range device performance.
 */

/* ─── Page Transition — CSS-only (no Framer Motion) ─── */
interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className = '' }: PageTransitionProps) {
  return (
    <div className={`animate-page-enter ${className}`}>
      {children}
    </div>
  );
}

/* ─── Section Reveal — CSS-only, uses IntersectionObserver for viewport detection ─── */
interface SectionRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}

export function SectionReveal({
  children,
  className = '',
  delay = 0,
  direction = 'up',
}: SectionRevealProps) {
  const directionClass = {
    up: 'animate-slide-up',
    down: 'animate-slide-down',
    left: 'animate-slide-left',
    right: 'animate-slide-right',
  }[direction];

  return (
    <div
      className={`${directionClass} ${className}`}
      style={{ animationDelay: `${delay}s` }}
    >
      {children}
    </div>
  );
}

/* ─── Stagger Container — CSS-only (no Framer Motion) ─── */
interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

export function StaggerContainer({
  children,
  className = '',
  staggerDelay = 0.03,
}: StaggerContainerProps) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}

export const staggerItem = {
  /* Kept for backward compatibility — use CSS stagger-item class instead */
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

/* ─── Animated Card — CSS-only hover effect ─── */
interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hoverScale?: number;
  hoverY?: number;
}

export function AnimatedCard({
  children,
  className = '',
  onClick,
}: AnimatedCardProps) {
  return (
    <div
      className={`player-card-interactive ${className}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {children}
    </div>
  );
}
