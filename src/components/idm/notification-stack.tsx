'use client';

import { X, Gift, Trophy, Music, Crown, Flame } from 'lucide-react';
import { useAppStore, type NotifType } from '@/lib/store';
import { useEffect, useState, useCallback } from 'react';

const iconMap: Record<NotifType, React.ComponentType<{ className?: string }>> = {
  donation: Gift,
  match: Music,
  mvp: Crown,
  streak: Flame,
  victory: Trophy,
};

const colorMap: Record<NotifType, { bg: string; icon: string; border: string; bar: string }> = {
  donation: { bg: 'bg-primary/5', icon: 'text-primary', border: 'border-primary/20', bar: 'bg-primary/40' },
  match: { bg: 'bg-idm-amber/5', icon: 'text-idm-amber', border: 'border-idm-amber/20', bar: 'bg-idm-amber/40' },
  mvp: { bg: 'bg-yellow-500/5', icon: 'text-yellow-500', border: 'border-yellow-500/20', bar: 'bg-yellow-500/40' },
  streak: { bg: 'bg-orange-500/5', icon: 'text-orange-500', border: 'border-orange-500/20', bar: 'bg-orange-500/40' },
  victory: { bg: 'bg-green-500/5', icon: 'text-green-500', border: 'border-green-500/20', bar: 'bg-green-500/40' },
};

const AUTO_DISMISS_MS = 5000;

function NotificationItem({ notif }: { notif: { id: string; type: NotifType; message: string } }) {
  const removeNotification = useAppStore(s => s.removeNotification);
  const [progress, setProgress] = useState(100);
  const [paused, setPaused] = useState(false);

  const handleRemove = useCallback(() => {
    removeNotification(notif.id);
  }, [removeNotification, notif.id]);

  useEffect(() => {
    if (paused) return;

    const startTime = Date.now();
    const startProgress = progress;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = (startProgress / 100) * AUTO_DISMISS_MS - elapsed;
      const newProgress = Math.max(0, (remaining / AUTO_DISMISS_MS) * 100);

      setProgress(newProgress);

      if (newProgress <= 0) {
        clearInterval(interval);
        handleRemove();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [paused, handleRemove]);

  const Icon = iconMap[notif.type];
  const colors = colorMap[notif.type];

  return (
    <div
      className="animate-slide-in pointer-events-auto glass rounded-2xl shadow-lg border relative overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      <div className={`px-3 py-2.5 flex items-center gap-2.5 ${colors.bg} ${colors.border}`}>
        <div className={`w-7 h-7 rounded-lg ${colors.bg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-3.5 h-3.5 ${colors.icon}`} />
        </div>
        <p className="text-xs font-medium flex-1">{notif.message}</p>
        <button
          onClick={handleRemove}
          className="text-muted-foreground hover:text-foreground shrink-0 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg hover:bg-muted/60 active:bg-muted transition-colors"
          aria-label="Close notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {/* Progress bar */}
      <div className="h-0.5 w-full bg-muted/30">
        <div
          className={`h-full ${colors.bar} transition-[width] duration-100 ease-linear`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export function NotificationStack() {
  const notifications = useAppStore(s => s.notifications);

  return (
    <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 max-w-sm w-full pointer-events-none sm:right-4 sm:left-auto left-4 right-4 sm:max-w-sm max-w-[calc(100vw-2rem)] sm:left-auto">
      {notifications.map((notif) => (
        <NotificationItem key={notif.id} notif={notif} />
      ))}
    </div>
  );
}
