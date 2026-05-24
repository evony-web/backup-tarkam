'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { Clock, Calendar, MapPin, Music, ArrowRight } from 'lucide-react';
import { SectionHeader } from './shared';
import { useAppStore } from '@/lib/store';

/* ═══════════════════════════════════════════════════════════════
   TOURNAMENT COUNTDOWN TIMER SECTION
   Shows a countdown to the next scheduled tournament with
   animated flip-clock style numbers.
   Gold/amber themed, responsive, graceful empty state.
   ═══════════════════════════════════════════════════════════════ */

interface TournamentData {
  id: string;
  name: string;
  weekNumber: number;
  division: string;
  status: string;
  scheduledAt: string | null;
  bpm: string | null;
  location: string | null;
  prizePool: number;
  season: { name: string; number: number };
  _count: { teams: number; participations: number; matches: number };
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function useCountdown(targetDate: Date | null): TimeLeft {
  const calculateTimeLeft = useCallback((): TimeLeft => {
    if (!targetDate) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    const diff = targetDate.getTime() - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / (1000 * 60)) % 60),
      seconds: Math.floor((diff / 1000) % 60),
    };
  }, [targetDate]);

  const [timeLeft, setTimeLeft] = useState<TimeLeft>(calculateTimeLeft);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    return () => clearInterval(timer);
  }, [calculateTimeLeft]);

  return timeLeft;
}

/* ─── Flip-clock digit ─── */
function FlipDigit({ value, label }: { value: number; label: string }) {
  const display = String(value).padStart(2, '0');

  return (
    <div className="flex flex-col items-center gap-1.5 sm:gap-2">
      <div className="relative">
        {/* Background glow */}
        <div className="absolute inset-0 rounded-lg sm:rounded-xl bg-idm-gold-warm/5 blur-sm" aria-hidden="true" />

        <div className="relative flex items-stretch gap-[2px] sm:gap-1">
          {display.split('').map((digit, i) => (
            <div
              key={`${label}-${i}-${digit}`}
              className="relative w-10 h-12 sm:w-14 sm:h-18 md:w-16 md:h-20 flex items-center justify-center rounded-lg sm:rounded-xl border border-idm-gold-warm/20 bg-gradient-to-b from-idm-gold-warm/[0.08] to-idm-gold-warm/[0.03] shadow-[0_2px_10px_rgba(239,249,35,0.08)] overflow-hidden"
            >
              {/* Center line — flip clock divider */}
              <div className="absolute left-0 right-0 top-1/2 h-px bg-idm-gold-warm/10" aria-hidden="true" />
              {/* Top half gradient */}
              <div className="absolute inset-0 h-1/2 bg-gradient-to-b from-idm-gold-warm/[0.04] to-transparent" aria-hidden="true" />

              <span className="relative text-xl sm:text-2xl md:text-3xl font-black tabular-nums text-idm-gold-warm drop-shadow-[0_0_8px_rgba(239,249,35,0.3)]">
                {digit}
              </span>
            </div>
          ))}
        </div>
      </div>

      <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
        {label}
      </span>
    </div>
  );
}

/* ─── Colon separator ─── */
function ColonSeparator() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 sm:gap-3 pt-0 pb-5 sm:pb-6">
      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-idm-gold-warm/40 animate-pulse" />
      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-idm-gold-warm/40 animate-pulse" />
    </div>
  );
}

/* ─── Skeleton ─── */
function CountdownSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center justify-center gap-2 sm:gap-3 mb-6">
        {[1, 2].map(i => (
          <div key={i} className="flex gap-1">
            <div className="w-10 h-12 sm:w-14 sm:h-18 rounded-lg bg-idm-gold-warm/10" />
            <div className="w-10 h-12 sm:w-14 sm:h-18 rounded-lg bg-idm-gold-warm/10" />
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-4">
        <div className="h-3 w-16 rounded bg-idm-gold-warm/5" />
        <div className="h-3 w-16 rounded bg-idm-gold-warm/5" />
        <div className="h-3 w-16 rounded bg-idm-gold-warm/5" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export function TournamentCountdownSection() {
  const { setCurrentView, setDivision } = useAppStore();

  /* Fetch upcoming tournaments with scheduled dates */
  const { data: tournaments, isLoading } = useQuery<TournamentData[]>({
    queryKey: ['tournaments-upcoming'],
    queryFn: async () => {
      const res = await fetch('/api/tournaments');
      if (!res.ok) return [];
      const data: TournamentData[] = await res.json();
      return data;
    },
    staleTime: 60000,
    refetchInterval: 300000,
    refetchIntervalInBackground: false,
  });

  /* Find the next upcoming tournament (scheduled in the future) */
  const nextTournament = tournaments?.find(t => {
    if (!t.scheduledAt) return false;
    if (t.status === 'completed') return false;
    return new Date(t.scheduledAt).getTime() > Date.now();
  });

  /* Also check for active/in-progress tournaments that are close */
  const activeTournament = tournaments?.find(t =>
    t.status === 'registration' ||
    t.status === 'approval' ||
    t.status === 'main_event' ||
    t.status === 'bracket_generation' ||
    t.status === 'team_generation'
  );

  const displayTournament = nextTournament || activeTournament || null;
  const targetDate = nextTournament?.scheduledAt ? new Date(nextTournament.scheduledAt) : null;
  const timeLeft = useCountdown(targetDate);
  const isCounting = targetDate !== null && (timeLeft.days + timeLeft.hours + timeLeft.minutes + timeLeft.seconds) > 0;
  const divisionLabel = displayTournament?.division === 'male' ? '♂ Cowo' : '♀ Cewe';
  const divisionColor = displayTournament?.division === 'male' ? 'idm-male' : 'idm-female';

  const handleViewBracket = () => {
    if (displayTournament) {
      setDivision(displayTournament.division as 'male' | 'female');
    }
    setCurrentView('bracket');
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  return (
    <section className="relative py-8 sm:py-12" aria-label="Hitung Mundur Turnamen">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        {/* Section Header */}
        <SectionHeader
          icon={Clock}
          label="Countdown"
          title="Hitung Mundur Turnamen"
          subtitle="Menuju pertarungan berikutnya"
        />

        {isLoading ? (
          <CountdownSkeleton />
        ) : !displayTournament ? (
          /* Graceful empty state */
          <div className="text-center py-10 sm:py-14">
            <div className="relative inline-block mb-4">
              <div className="absolute inset-0 rounded-full bg-idm-gold-warm/5 blur-xl" aria-hidden="true" />
              <Calendar className="relative w-12 h-12 sm:w-14 sm:h-14 text-idm-gold-warm/20" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground mb-1">Tidak ada turnamen terjadwal</p>
            <p className="text-xs text-muted-foreground/60">Cek kembali nanti untuk jadwal turnamen berikutnya</p>
          </div>
        ) : (
          <div className="relative">
            {/* Background glow effect */}
            <div className="absolute inset-0 -top-8 -bottom-8 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(239,249,35,0.03) 0%, transparent 50%)' }} aria-hidden="true" />

            <div className="relative">
              {/* Tournament info bar */}
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-5 sm:mb-7">
                {/* Division badge */}
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-${divisionColor}/10 text-${divisionColor} border-${divisionColor}/20`}>
                  {divisionLabel}
                </span>

                {/* Tournament name */}
                <span className="text-xs sm:text-sm font-bold text-foreground">
                  {displayTournament.name}
                </span>

                {/* Season */}
                <span className="text-[10px] text-muted-foreground/60">
                  {displayTournament.season?.name}
                </span>

                {/* Status badge */}
                {activeTournament && !nextTournament && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border border-idm-gold-warm/20 bg-idm-gold-warm/5 text-idm-gold-warm animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-idm-gold-warm" />
                    {activeTournament.status === 'registration' ? 'Registrasi Dibuka' :
                     activeTournament.status === 'approval' ? 'Proses Approval' :
                     activeTournament.status === 'main_event' ? 'Berlangsung' : 'Persiapan'}
                  </span>
                )}
              </div>

              {/* Countdown digits */}
              {isCounting ? (
                <div className="flex items-center justify-center gap-1.5 sm:gap-2 md:gap-3 mb-5 sm:mb-7">
                  <FlipDigit value={timeLeft.days} label="Hari" />
                  <ColonSeparator />
                  <FlipDigit value={timeLeft.hours} label="Jam" />
                  <ColonSeparator />
                  <FlipDigit value={timeLeft.minutes} label="Menit" />
                  <ColonSeparator />
                  <FlipDigit value={timeLeft.seconds} label="Detik" />
                </div>
              ) : activeTournament ? (
                /* Tournament is happening now — no countdown */
                <div className="text-center mb-5 sm:mb-7">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-idm-gold-warm/20 bg-idm-gold-warm/5">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-idm-gold-warm opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-idm-gold-warm" />
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-idm-gold-warm">Turnamen Sedang Berlangsung!</span>
                  </div>
                </div>
              ) : (
                /* Tournament was in the past */
                <div className="text-center mb-5 sm:mb-7">
                  <p className="text-sm text-muted-foreground">Jadwal turnamen telah lewat</p>
                </div>
              )}

              {/* Tournament meta info */}
              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground/70 mb-5">
                {displayTournament.bpm && (
                  <span className="flex items-center gap-1">
                    <Music className="w-3 h-3" />
                    {displayTournament.bpm} BPM
                  </span>
                )}
                {displayTournament.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {displayTournament.location}
                  </span>
                )}
                {displayTournament.prizePool > 0 && (
                  <span className="flex items-center gap-1 text-idm-gold-warm/70">
                    🏆 Rp {displayTournament.prizePool.toLocaleString('id-ID')}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  👥 {displayTournament._count?.participations || 0} peserta
                </span>
              </div>

              {/* CTA button */}
              <div className="flex justify-center">
                <button
                  onClick={handleViewBracket}
                  className="btn-press group flex items-center gap-2 px-5 py-2.5 rounded-full border border-idm-gold-warm/20 bg-idm-gold-warm/[0.06] hover:bg-idm-gold-warm/10 hover:border-idm-gold-warm/30 transition-all cursor-pointer text-xs font-bold text-idm-gold-warm uppercase tracking-wider"
                >
                  Lihat Bracket
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
