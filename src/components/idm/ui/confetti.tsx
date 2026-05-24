'use client';

import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface ConfettiPiece {
  id: number;
  x: number;
  color: string;
  delay: number;
  duration: number;
  size: number;
  rotation: number;
}

interface ConfettiProps {
  trigger: boolean;
  onComplete?: () => void;
  colors?: string[];
  pieceCount?: number;
}

export function Confetti({
  trigger,
  onComplete,
  colors = ['#EFF923', '#F9CB25', '#e8d5a3', '#57B5FF', '#FF5C9A', '#22c55e'],
  pieceCount = 50,
}: ConfettiProps) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const generateConfetti = useCallback(() => {
    const newPieces: ConfettiPiece[] = Array.from({ length: pieceCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 0.5,
      duration: 2 + Math.random() * 2,
      size: 6 + Math.random() * 8,
      rotation: Math.random() * 360,
    }));
    setPieces(newPieces);

    // Clear confetti after animation
    const maxDuration = Math.max(...newPieces.map(p => p.duration + p.delay)) * 1000;
    setTimeout(() => {
      setPieces([]);
      onComplete?.();
    }, maxDuration + 500);
  }, [colors, pieceCount, onComplete]);

  useEffect(() => {
    if (trigger) {
      generateConfetti();
    }
  }, [trigger, generateConfetti]);

  if (!isClient || pieces.length === 0) return null;

  return createPortal(
    <div className="confetti-container">
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="confetti-piece"
          style={{
            left: `${piece.x}%`,
            backgroundColor: piece.color,
            width: `${piece.size}px`,
            height: `${piece.size}px`,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            transform: `rotate(${piece.rotation}deg)`,
            borderRadius: Math.random() > 0.5 ? '50%' : '0',
          }}
        />
      ))}
    </div>,
    document.body
  );
}

// Hook for easy confetti trigger
export function useConfetti() {
  const [showConfetti, setShowConfetti] = useState(false);

  const triggerConfetti = useCallback(() => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 100);
  }, []);

  return { showConfetti, triggerConfetti, ConfettiComponent: () => <Confetti trigger={showConfetti} /> };
}
