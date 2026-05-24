'use client';

import { useState, useEffect } from 'react';

interface CountdownTimerProps {
  targetDate: string | Date;
  className?: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function CountdownTimer({ targetDate, className = '' }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setTimeout(() => setMounted(true), 0) }, []);

  useEffect(() => {
    if (!mounted) return;

    const target = new Date(targetDate).getTime();

    function calculate() {
      const now = Date.now();
      const diff = Math.max(target - now, 0);

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    }

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [targetDate, mounted]);

  if (!mounted) return null;

  const units = [
    { value: timeLeft.days, label: 'hari' },
    { value: timeLeft.hours, label: 'jam' },
    { value: timeLeft.minutes, label: 'menit' },
    { value: timeLeft.seconds, label: 'detik' },
  ];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {units.map((u, i) => (
        <div key={u.label} className="flex items-center gap-2">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-lg font-bold font-mono text-primary">
                {String(u.value).padStart(2, '0')}
              </span>
            </div>
            <span className="text-[9px] text-muted-foreground mt-0.5">{u.label}</span>
          </div>
          {i < units.length - 1 && (
            <span className="text-primary font-bold text-lg -mt-4">:</span>
          )}
        </div>
      ))}
    </div>
  );
}
