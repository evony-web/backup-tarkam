'use client';

import { useCallback, useRef, useEffect } from 'react';

type SoundType = 'win' | 'lose' | 'match' | 'point' | 'level-up' | 'click' | 'success';

// Sound URLs (can be replaced with actual hosted sounds)
const SOUND_SOURCES: Record<SoundType, string> = {
  win: '/sounds/win.mp3',
  lose: '/sounds/lose.mp3',
  match: '/sounds/match.mp3',
  point: '/sounds/point.mp3',
  'level-up': '/sounds/level-up.mp3',
  click: '/sounds/click.mp3',
  success: '/sounds/success.mp3',
};

interface UseSoundEffectsOptions {
  enabled?: boolean;
  volume?: number;
}

export function useSoundEffects(options: UseSoundEffectsOptions = {}) {
  const { enabled = true, volume = 0.5 } = options;
  const audioRefs = useRef<Map<SoundType, HTMLAudioElement>>(new Map());

  useEffect(() => {
    // Preload all sounds
    Object.entries(SOUND_SOURCES).forEach(([type, src]) => {
      const audio = new Audio(src);
      audio.volume = volume;
      audio.preload = 'auto';
      audioRefs.current.set(type as SoundType, audio);
    });

    return () => {
      audioRefs.current.forEach((audio) => {
        audio.pause();
        audio.src = '';
      });
      audioRefs.current.clear();
    };
  }, [volume]);

  const play = useCallback(
    (type: SoundType) => {
      if (!enabled) return;

      const audio = audioRefs.current.get(type);
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {
          // Ignore autoplay restrictions
        });
      }
    },
    [enabled]
  );

  const playWin = useCallback(() => play('win'), [play]);
  const playLose = useCallback(() => play('lose'), [play]);
  const playMatch = useCallback(() => play('match'), [play]);
  const playPoint = useCallback(() => play('point'), [play]);
  const playLevelUp = useCallback(() => play('level-up'), [play]);
  const playClick = useCallback(() => play('click'), [play]);
  const playSuccess = useCallback(() => play('success'), [play]);

  return {
    play,
    playWin,
    playLose,
    playMatch,
    playPoint,
    playLevelUp,
    playClick,
    playSuccess,
  };
}

// Simple sound button component
export function SoundButton({
  children,
  sound = 'click',
  onClick,
  className,
  ...props
}: {
  children: React.ReactNode;
  sound?: SoundType;
  onClick?: () => void;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { play } = useSoundEffects();

  const handleClick = () => {
    play(sound);
    onClick?.();
  };

  return (
    <button className={className} onClick={handleClick} {...props}>
      {children}
    </button>
  );
}
