'use client';

// framer-motion removed — replaced with CSS animations
import { X, Gift, Trophy, Music, Crown, Flame } from 'lucide-react';
import { getSawerTier } from '@/lib/skin-utils';
import { useState, useEffect, useCallback, useRef } from 'react';

interface Notification {
  id: string;
  type: 'donation' | 'match' | 'mvp' | 'streak' | 'victory';
  message: string;
}

const iconMap = {
  donation: Gift,
  match: Music,
  mvp: Crown,
  streak: Flame,
  victory: Trophy,
};

const glowMap = {
  donation: 'glow-gold',
  match: 'glow-amber',
  mvp: 'glow-gold',
  streak: 'shadow-[0_0_20px_rgba(249,115,22,0.3)]',
  victory: 'glow-gold',
};

export function DonationPopup({ show, message, onClose }: { show: boolean; message: string; onClose: () => void }) {
  // Detect notification type from message
  const getType = (msg: string): Notification['type'] => {
    if (msg.includes('Donasi') || msg.includes('donation') || msg.includes('sawer') || msg.includes('Sawer')) return 'donation';
    if (msg.includes('MVP')) return 'mvp';
    if (msg.includes('Streak') || msg.includes('🔥')) return 'streak';
    if (msg.includes('Victory') || msg.includes('Win')) return 'victory';
    return 'match';
  };

  const type = getType(message);
  const Icon = iconMap[type];

  // Extract sawer tier emoji from message if it's a donation
  const getSawerTierEmoji = (msg: string): string | null => {
    // Try to extract amount from message like "X menyawer Rp 100.000"
    const amountMatch = msg.match(/Rp\s*([\d.]+)/);
    if (amountMatch) {
      const amount = parseInt(amountMatch[1].replace(/\./g, ''));
      const tier = getSawerTier(amount);
      if (tier === 'sawer_diamond') return '💎';
      if (tier === 'sawer_gold') return '🥇';
      if (tier === 'sawer_silver') return '🥈';
      if (tier === 'sawer_bronze') return '🥉';
    }
    return null;
  };

  const sawerEmoji = type === 'donation' ? getSawerTierEmoji(message) : null;

  const startTimeRef = useRef(Date.now());
  const [progress, setProgress] = useState(100);

  const stableOnClose = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (!show) return;
    startTimeRef.current = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const duration = 5000;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        stableOnClose();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [show, stableOnClose]);

  return (
    <>
      {show && (
        <div
          className={`animate-fade-enter fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 glass ${glowMap[type]} rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg max-w-sm relative overflow-hidden`}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            type === 'donation' ? 'bg-primary/10' :
            type === 'mvp' ? 'bg-yellow-500/10' :
            type === 'streak' ? 'bg-orange-500/10' :
            type === 'victory' ? 'bg-green-500/10' :
            'bg-idm-amber/10'
          }`}>
            {sawerEmoji ? (
              <span className="text-base">{sawerEmoji}</span>
            ) : (
              <Icon className={`w-4 h-4 ${
                type === 'donation' ? 'text-primary' :
                type === 'mvp' ? 'text-yellow-500' :
                type === 'streak' ? 'text-orange-500' :
                type === 'victory' ? 'text-green-500' :
                'text-idm-amber'
              }`} />
            )}
          </div>
          <span className="text-sm font-medium">{message}</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
          {/* Auto-dismiss progress bar */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary/10 rounded-b-xl overflow-hidden">
            <div
              className="h-full bg-primary/40 transition-[width] duration-50 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </>
  );
}
