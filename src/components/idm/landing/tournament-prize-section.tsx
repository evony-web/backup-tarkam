'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Trophy, Coins, Star, Users } from 'lucide-react';
import { AnimatedSection, SectionHeader } from './shared';
import { formatCurrency } from '@/lib/utils';


/* ═══════════════════════════════════════════════════════
   TOURNAMENT PRIZE POOL SECTION
   Shows prize distribution for active tournaments
   ═══════════════════════════════════════════════════════ */

interface Prize {
  id: string;
  label: string;
  position: number;
  prizeAmount: number;
  pointsPerPlayer: number;
  recipientCount: number;
}

interface TournamentWithPrizes {
  id: string;
  name: string;
  weekNumber: number;
  division: string;
  status: string;
  prizePool: number;
  prizes: Prize[];
}

function PrizeCard({ prize, totalPool }: { prize: Prize; totalPool: number }) {
  const percentage = totalPool > 0 ? Math.round((prize.prizeAmount / totalPool) * 100) : 0;
  const positionEmoji = prize.position === 1 ? '🥇' : prize.position === 2 ? '🥈' : prize.position === 3 ? '🥉' : '🎁';
  const positionBg = prize.position === 1 
    ? 'from-yellow-500/20 to-yellow-600/5 border-yellow-500/25' 
    : prize.position === 2 
    ? 'from-gray-400/15 to-gray-500/5 border-gray-400/20' 
    : prize.position === 3 
    ? 'from-amber-700/15 to-amber-800/5 border-amber-700/20' 
    : 'from-muted/10 to-muted/5 border-border/30';
  
  return (
    <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${positionBg} transition-all duration-300 hover:shadow-md`}>
      <div className="p-3 sm:p-4 flex items-center gap-3">
        {/* Position */}
        <div className="text-2xl sm:text-3xl shrink-0">{positionEmoji}</div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-bold text-sm text-foreground truncate">{prize.label}</span>
            {prize.recipientCount > 1 && (
              <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 border-border/40">
                <Users className="w-2.5 h-2.5 mr-0.5" /> {prize.recipientCount}p
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-idm-gold-warm font-bold">{formatCurrency(prize.prizeAmount)}</span>
            {prize.pointsPerPlayer > 0 && (
              <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-0.5">
                <Star className="w-2.5 h-2.5 text-idm-gold-warm" /> +{prize.pointsPerPlayer} pts
              </span>
            )}
          </div>
        </div>
        
        {/* Percentage bar */}
        <div className="shrink-0 text-right">
          <div className="text-[10px] font-bold text-muted-foreground mb-1">{percentage}%</div>
          <div className="w-12 h-1.5 rounded-full bg-muted/30 overflow-hidden">
            <div 
              className="h-full rounded-full bg-idm-gold-warm/60 transition-all duration-700"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function TournamentPrizeDisplay({ tournament }: { tournament: TournamentWithPrizes }) {
  const isMale = tournament.division === 'male';
  const accentColor = isMale ? 'text-idm-male' : 'text-idm-female';
  const divisionLabel = isMale ? 'Cowo' : 'Cewe';
  const divisionBorderAccent = isMale ? 'border-idm-male/15' : 'border-idm-female/15';
  const divisionGlowAccent = isMale
    ? 'shadow-[inset_0_1px_0_rgba(34,197,94,0.06)]'
    : 'shadow-[inset_0_1px_0_rgba(236,72,153,0.06)]';
  
  return (
    <div className={`space-y-3 p-3 sm:p-4 rounded-2xl border bg-background/30 backdrop-blur-sm ${divisionBorderAccent} ${divisionGlowAccent}`}>
      {/* Tournament Header */}
      <div className="flex items-center gap-2 mb-2">
        <h3 className={`font-bold text-sm ${accentColor} flex items-center gap-1.5`}>
          <span className="text-base">{isMale ? '🕺' : '💃'}</span>
          Tarkam {divisionLabel}, Week {tournament.weekNumber}
        </h3>
      </div>
      
      {/* Total Prize Pool */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-idm-gold-warm/5 border border-idm-gold-warm/15">
        <Coins className="w-5 h-5 text-idm-gold-warm shrink-0" />
        <div>
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total Prize Pool</div>
          <div className="text-base sm:text-lg font-black text-idm-gold-warm">{formatCurrency(tournament.prizePool)}</div>
        </div>
      </div>
      
      {/* Prize List */}
      <div className="space-y-2">
        {tournament.prizes
          .sort((a, b) => a.position - b.position)
          .map(prize => (
            <PrizeCard key={prize.id} prize={prize} totalPool={tournament.prizePool} />
          ))}
      </div>
    </div>
  );
}

export function TournamentPrizeSection() {
  // Fetch tournaments with prizes
  const { data: tournamentsData } = useQuery({
    queryKey: ['tournaments'],
    queryFn: () => fetch('/api/tournaments').then(r => r.json()),
    staleTime: 30000,
  });
  
  const allTournamentsWithPrizes: TournamentWithPrizes[] = [];
  
  if (Array.isArray(tournamentsData)) {
    for (const t of tournamentsData) {
      if (!t.prizes?.length || t.prizePool <= 0) continue;
      allTournamentsWithPrizes.push({
        id: t.id,
        name: t.name,
        weekNumber: t.weekNumber,
        division: t.division,
        status: t.status,
        prizePool: t.prizePool || 0,
        prizes: t.prizes.map((p: any) => ({
          id: p.id,
          label: p.label,
          position: p.position,
          prizeAmount: p.prizeAmount,
          pointsPerPlayer: p.pointsPerPlayer,
          recipientCount: p.recipientCount,
        })),
      });
    }
  }
  
  if (allTournamentsWithPrizes.length === 0) return null;

  // Find the latest week that has prizes — if current week has no prizes yet, fallback to previous
  const latestWeek = Math.max(...allTournamentsWithPrizes.map(t => t.weekNumber));
  const latestWeekTournaments = allTournamentsWithPrizes.filter(t => t.weekNumber === latestWeek);
  
  // Side-by-side: male + female from the latest week
  const maleTournament = latestWeekTournaments.find(t => t.division === 'male');
  const femaleTournament = latestWeekTournaments.find(t => t.division === 'female');
  const displayPair = [maleTournament, femaleTournament].filter(Boolean) as TournamentWithPrizes[];

  return (
    <AnimatedSection>
      <section className="landing-section relative py-6 sm:py-12 px-4 sm:px-6 lg:px-8 overflow-hidden bg-deep border-y border-border/30 dark:border-0">
        {/* Background — dot pattern (center-weighted) */}
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(239,249,35,0.5) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        {/* Radial glow — centered, stronger gold (prize theme) */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(239,249,35,0.06) 0%, transparent 55%), radial-gradient(ellipse at 80% 70%, rgba(255,45,120,0.03) 0%, transparent 40%)' }} />
        {/* Top edge glow */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-idm-gold-warm/30 to-transparent" aria-hidden="true" />
        <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-idm-gold-warm/[3] to-transparent pointer-events-none" aria-hidden="true" />
        {/* Bottom edge glow */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-idm-gold-warm/15 to-transparent" aria-hidden="true" />

        <SectionHeader
          label={`Prize Pool · Week ${latestWeek}`}
          title="Hadiah Turnamen"
          subtitle="Distribusi hadiah untuk turnamen aktif"
          icon={Trophy}
        />
        
        {/* Male & Female side by side */}
        <div className="mt-6 max-w-5xl mx-auto">
          {displayPair.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {displayPair.map(tournament => (
                <TournamentPrizeDisplay key={tournament.id} tournament={tournament} />
              ))}
            </div>
          )}
        </div>
      </section>
    </AnimatedSection>
  );
}
