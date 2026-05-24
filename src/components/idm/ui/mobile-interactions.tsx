'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

// Pull to Refresh Hook
interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
}

export function usePullToRefresh({ onRefresh, threshold = 80 }: UsePullToRefreshOptions) {
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const scrollTop = containerRef.current?.scrollTop ?? window.scrollY;
    if (scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;

    const currentScrollTop = containerRef.current?.scrollTop ?? window.scrollY;
    if (diff > 0 && currentScrollTop === 0) {
      setPullDistance(Math.min(diff, threshold * 1.5));
    }
  }, [isPulling, isRefreshing, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    setIsPulling(false);
    setPullDistance(0);
  }, [pullDistance, threshold, isRefreshing, onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart);
    container.addEventListener('touchmove', handleTouchMove);
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const progress = Math.min(pullDistance / threshold, 1);

  return {
    containerRef,
    isPulling,
    isRefreshing,
    pullDistance,
    progress,
  };
}

// Swipe Navigation Hook
interface UseSwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}

export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
}: UseSwipeOptions) {
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const startX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    startX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      const endX = e.changedTouches[0].clientX;
      const diff = endX - startX.current;

      if (Math.abs(diff) > threshold) {
        if (diff > 0) {
          setSwipeDirection('right');
          onSwipeRight?.();
        } else {
          setSwipeDirection('left');
          onSwipeLeft?.();
        }
        setTimeout(() => setSwipeDirection(null), 300);
      }
    },
    [threshold, onSwipeLeft, onSwipeRight]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart);
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchEnd]);

  return { containerRef, swipeDirection };
}

// Haptic Feedback Hook
export function useHaptic() {
  const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
      const patterns = {
        light: [10],
        medium: [20],
        heavy: [30],
      };
      navigator.vibrate(patterns[type]);
    }
  }, []);

  const hapticTap = useCallback(() => triggerHaptic('light'), [triggerHaptic]);
  const hapticPress = useCallback(() => triggerHaptic('medium'), [triggerHaptic]);
  const hapticSuccess = useCallback(() => triggerHaptic('heavy'), [triggerHaptic]);

  return { triggerHaptic, hapticTap, hapticPress, hapticSuccess };
}

// Pull to Refresh Component
interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
}

export function PullToRefresh({ onRefresh, children, className = '' }: PullToRefreshProps) {
  const { containerRef, isRefreshing, progress } = usePullToRefresh({ onRefresh });

  return (
    <div ref={containerRef} className={`pull-to-refresh ${className}`}>
      {/* Refresh indicator */}
      <div
        className={`pull-to-refresh-indicator flex items-center justify-center py-2 ${
          isRefreshing ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          transform: `translateY(${progress * 40}px)`,
        }}
      >
        <div
          className={`w-6 h-6 border-2 border-idm-gold-warm border-t-transparent rounded-full ${isRefreshing ? 'animate-spin-slow' : ''}`}
          style={!isRefreshing ? { transform: `rotate(${progress * 360}deg)` } : undefined}
        />
      </div>
      {children}
    </div>
  );
}

// Swipeable Container
interface SwipeableProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  className?: string;
}

export function Swipeable({ children, onSwipeLeft, onSwipeRight, className = '' }: SwipeableProps) {
  const { containerRef, swipeDirection } = useSwipe({ onSwipeLeft, onSwipeRight });

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        transform: `translateX(${swipeDirection === 'left' ? -10 : swipeDirection === 'right' ? 10 : 0}px)`,
        transition: 'transform 200ms',
      }}
    >
      {children}
    </div>
  );
}
