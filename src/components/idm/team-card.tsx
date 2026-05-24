'use client';

import { Crown, Zap } from 'lucide-react';

interface TeamCardProps {
  name: string;
  players: { gamertag: string; tier: string; points: number }[];
  power: number;
  isWinner?: boolean;
  showPower?: boolean;
}

export function TeamCard({ name, players, power, isWinner, showPower = true }: TeamCardProps) {
  return (
    <div
      className={`perspective-card hover-scale-sm p-4 sm:p-6 rounded-2xl border transition-all ${
        isWinner
          ? 'bg-yellow-500/5 border-yellow-500/20 glow-gold'
          : 'bg-card border-border/50 hover:border-primary/20'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">{name}</span>
          {isWinner && <Crown className="w-4 h-4 text-yellow-500" />}
        </div>
        {showPower && (
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-primary" />
            <span className="text-xs font-bold text-primary">{power}</span>
          </div>
        )}
      </div>

      {/* Power bar */}
      {showPower && (
        <div className="w-full h-1 bg-muted rounded-full mb-2 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${Math.min((power / 600) * 100, 100)}%` }}
          />
        </div>
      )}

      {/* Players */}
      <div className="space-y-1">
        {players.map((p) => (
          <div key={p.gamertag} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-medium">{p.gamertag}</span>
            </div>
            <span className="text-muted-foreground">{p.points}pts</span>
          </div>
        ))}
      </div>
    </div>
  );
}
