'use client';

import React from 'react';
import Image from 'next/image';
import { useEffect, useRef } from 'react';
import {
  Trophy,
  Users,
  Building2,
  Radio,
  UserPlus,
  Gift,
  ArrowRight,
  Calendar,
  Zap,
  Music,
  Clock,
  MapPin,
  Gauge,
  Coins,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useBackgroundImages } from '@/hooks/use-background-images';
import { parseWIBDate, formatWIBTime, formatWIBDateNumeric, getWIBDayOfWeek, formatCurrencyShort } from '@/lib/utils';
import type { StatsData } from '@/types/stats';

/* ═══════════════════════════════════════════════════════
   Animated Number — count-up with ease-out expo (ref-based, no setState)
   ═══════════════════════════════════════════════════════ */
const AnimatedNumber = React.memo(function AnimatedNumber({ target, duration = 1500, prefix = '', suffix = '' }: { target: number; duration?: number; prefix?: string; suffix?: string }) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const currentValueRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const start = currentValueRef.current;
    const diff = target - start;
    if (diff === 0) return;

    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.round(start + diff * eased);
      currentValueRef.current = current;

      if (spanRef.current) {
        spanRef.current.textContent = `${prefix}${current.toLocaleString('id-ID')}${suffix}`;
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, prefix, suffix]);

  return <span ref={spanRef}>{prefix}0{suffix}</span>;
});

/* ═══════════════════════════════════════════════════════
   Date/Time Helpers — WIB (Asia/Jakarta) timezone formatting
   Uses utility functions that respect timeZone regardless of browser locale
   ═══════════════════════════════════════════════════════ */

/** Parse scheduledAt as UTC from DB — parseWIBDate returns raw Date with correct epoch ms */
const parseSchedule = parseWIBDate;

/* ═══════════════════════════════════════════════════════
   Status Badge — Tournament status indicator pill
   ═══════════════════════════════════════════════════════ */
type TournamentStatus = 'live' | 'registration' | 'completed' | 'offseason';

type RawTournamentStatus =
  | 'setup' | 'registration' | 'approval' | 'team_generation'
  | 'bracket_generation' | 'main_event' | 'finalization' | 'completed'
  | string;

/** Map raw DB tournament status → display status for the UI */
function mapTournamentStatus(raw: RawTournamentStatus | undefined | null): TournamentStatus {
  if (!raw) return 'offseason';
  switch (raw) {
    case 'registration':
    case 'approval':
    case 'team_generation':
    case 'bracket_generation':
      return 'registration';
    case 'main_event':
      return 'live';
    case 'finalization':
    case 'completed':
      return 'completed';
    case 'setup':
    default:
      return 'offseason';
  }
}

const STATUS_CONFIG: Record<TournamentStatus, {
  label: string;
  labelId: string;
  dotClass: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  icon: typeof Radio;
}> = {
  live: {
    label: 'LIVE NOW',
    labelId: 'LIVE',
    dotClass: 'bg-red-500',
    bgClass: 'bg-red-500/12',
    borderClass: 'border-red-500/30',
    textClass: 'text-red-400',
    icon: Radio,
  },
  registration: {
    label: 'REGISTRATION',
    labelId: 'DAFTAR',
    dotClass: 'bg-amber-500',
    bgClass: 'bg-amber-500/12',
    borderClass: 'border-amber-500/30',
    textClass: 'text-amber-400',
    icon: UserPlus,
  },
  completed: {
    label: 'COMPLETED',
    labelId: 'SELESAI',
    dotClass: 'bg-emerald-500',
    bgClass: 'bg-emerald-500/12',
    borderClass: 'border-emerald-500/30',
    textClass: 'text-emerald-400',
    icon: Trophy,
  },
  offseason: {
    label: 'OFFSEASON',
    labelId: 'OFFSEASON',
    dotClass: 'bg-muted-foreground',
    bgClass: 'bg-muted-foreground/12',
    borderClass: 'border-border/30',
    textClass: 'text-muted-foreground',
    icon: Calendar,
  },
};

function StatusBadge({ status }: { status: TournamentStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.offseason;
  const Icon = config.icon;
  const isLive = status === 'live';

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${config.bgClass} ${config.borderClass}`}
    >
      <span className="relative flex h-2 w-2">
        {isLive && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dotClass}`} />
      </span>
      <span className={`text-[10px] sm:text-xs font-black uppercase tracking-[0.15em] ${config.textClass}`}>
        {config.label}
      </span>
      <Icon className={`w-3 h-3 ${config.textClass}`} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Tournament Detail Row — info item with icon + label
   ═══════════════════════════════════════════════════════ */
function DetailItem({
  icon: Icon,
  label,
  value,
  iconColor,
  mono = false,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
  iconColor: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Icon className={`w-3 h-3 shrink-0 ${iconColor} opacity-60`} />
      <span className="text-[9px] sm:text-[10px] text-muted-foreground/60 shrink-0">{label}</span>
      <span className={`text-[10px] sm:text-xs font-bold truncate ${mono ? 'font-mono tabular-nums' : ''}`}>
        {value}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Division Card — tournament info card for Male/Female
   Shows: status, name, detail info, players, + CTA buttons
   ═══════════════════════════════════════════════════════ */
const DivisionCard = React.memo(function DivisionCard({
  division,
  data,
  status,
  playerCount,
  onSawer,
  onRegister,
  onPayment,
  onGoToBracket,
}: {
  division: 'male' | 'female';
  data?: StatsData;
  status: TournamentStatus;
  playerCount: number;
  onSawer?: () => void;
  onRegister?: () => void;
  onPayment?: () => void;
  onGoToBracket: () => void;
}) {
  const { setCurrentView, setDivision } = useAppStore();
  const isMale = division === 'male';
  const borderColor = isMale ? 'border-idm-male/20' : 'border-idm-female/20';
  const bgBase = isMale ? 'bg-idm-male/[0.03]' : 'bg-idm-female/[0.03]';
  const textAccent = isMale ? 'text-idm-male' : 'text-idm-female';
  const textAccentMuted = isMale ? 'text-idm-male/80' : 'text-idm-female/80';
  const emoji = isMale ? '🕺' : '💃';

  // Division-specific theme for buttons
  const btnPrimary = isMale
    ? 'bg-gradient-to-r from-idm-male to-idm-male-light text-black hover:shadow-[0_0_16px_rgba(87,181,255,0.4)]'
    : 'bg-gradient-to-r from-idm-female to-idm-female-light text-white hover:shadow-[0_0_16px_rgba(255,92,154,0.4)]';
  const btnSecondary = isMale
    ? 'bg-idm-male/10 border-idm-male/25 text-idm-male hover:bg-idm-male/20'
    : 'bg-idm-female/10 border-idm-female/25 text-idm-female hover:bg-idm-female/20';

  // Tournament data
  const tournament = data?.activeTournament;
  const schedule = parseSchedule(tournament?.scheduledAt ?? null);
  const bpm = tournament?.bpm;
  const location = tournament?.location;
  // PrizePool: use per-tournament prize pool (resets each week), fallback to season aggregate
  // Uses ?? (not ||) so that activeTournamentPrizePool=0 (week completed, no new week yet)
  // is respected as a valid value and does NOT fall through to the season aggregate.
  const prizePool = data?.activeTournamentPrizePool ?? (division === 'female'
    ? (data?.femalePrizePool || data?.totalPrizePool || 0)
    : (data?.malePrizePool || data?.totalPrizePool || 0));

  // Status pill colors
  const statusPill = (() => {
    switch (status) {
      case 'live': return 'bg-red-500/15 text-red-400';
      case 'registration': return 'bg-amber-500/15 text-amber-400';
      case 'completed': return 'bg-emerald-500/15 text-emerald-400';
      default: return 'bg-muted/20 text-muted-foreground';
    }
  })();
  const statusLabel = status === 'live' ? 'LIVE' : status === 'registration' ? 'DAFTAR' : status === 'completed' ? 'SELESAI' : '-';

  const glowShadow = status === 'live'
    ? `0 0 20px rgba(${isMale ? '34,211,238' : '192,132,252'},0.1)`
    : undefined;

  // Navigation
  const goToRegister = () => {
    setDivision(division);
    if (onRegister) {
      onRegister();
    } else {
      // Fallback: navigate to landing page where registration modal is accessible
      setCurrentView('landing');
    }
  };

  const goToArenaLive = () => {
    setDivision(division);
    // Redirect to bracket view instead of removed matchday view
    setCurrentView('bracket');
  };

  // Determine which CTA to show based on status
  // 'registration' = admin opened registration (includes raw 'approval'/'team_generation'/'bracket_generation' mapped to 'registration')
  const isRegistrationOpen = status === 'registration';
  const showLiveBtn = status === 'live';
  const showResultBtn = status === 'completed';
  const showSawerBtn = !!onSawer && !!tournament;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${borderColor} ${bgBase} p-4 sm:p-6 w-full community-division-card ${isMale ? 'community-division-card-male' : 'community-division-card-female'} ${isMale ? 'hero-mesh-bg-male' : 'hero-mesh-bg-female'}`}
      style={{ boxShadow: glowShadow, transition: 'box-shadow 0.3s ease, border-color 0.3s ease' }}
    >
      {/* ── Header: Division + Status ── */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Music className={`w-3.5 h-3.5 ${textAccent}`} />
          <span className={`text-[10px] sm:text-xs font-black uppercase tracking-wider ${textAccent}`}>
            {emoji} {isMale ? 'Cowo' : 'Cewe'}
          </span>
        </div>
        <span className={`text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-full ${statusPill}`}>
          {statusLabel}
        </span>
      </div>

      {/* ── Tournament Name ── */}
      <p className="text-xs sm:text-sm font-bold text-foreground/90 truncate mb-2">
        {tournament?.name || 'Belum ada turnamen'}
      </p>

      {/* ── Tournament Detail Info Grid ── */}
      {tournament && (
        <div className={`grid grid-cols-2 gap-x-3 gap-y-1.5 p-3 sm:p-4 rounded-lg ${isMale ? 'bg-idm-male/5 border-idm-male/10' : 'bg-idm-female/5 border-idm-female/10'} border mb-2.5`}>
          {schedule && (
            <>
              <DetailItem
                icon={Calendar}
                label="Tanggal"
                value={formatWIBDateNumeric(schedule)}
                iconColor={textAccent}
              />
              <DetailItem
                icon={Clock}
                label="Waktu"
                value={formatWIBTime(schedule)}
                iconColor={textAccent}
                mono
              />
              <DetailItem
                icon={Calendar}
                label="Hari"
                value={getWIBDayOfWeek(schedule)}
                iconColor={textAccent}
              />
            </>
          )}
          {bpm && (
            <DetailItem
              icon={Gauge}
              label="BPM"
              value={bpm}
              iconColor={textAccent}
              mono
            />
          )}
          {location && (
            <DetailItem
              icon={MapPin}
              label="Area"
              value={location}
              iconColor={textAccent}
            />
          )}
          {/* Fallback if no schedule details at all */}
          {!schedule && !bpm && !location && (
            <div className="col-span-2 text-[9px] text-muted-foreground/40 text-center py-1">
              Detail belum diatur admin
            </div>
          )}
        </div>
      )}

      {/* ── Meta: Players + Week ── */}
      <div className="flex flex-wrap items-center gap-3 text-[9px] sm:text-[10px] mb-3">
        {playerCount > 0 && (
          <span className={`flex items-center gap-1 ${textAccentMuted} font-medium`}>
            <Users className="w-2.5 h-2.5" />{playerCount} Pemain
          </span>
        )}
        {tournament?.weekNumber && (
          <span className="flex items-center gap-1 text-muted-foreground font-medium">
            <Zap className="w-2.5 h-2.5" />W{tournament.weekNumber}
          </span>
        )}
      </div>

      {/* ── CTA Buttons ── */}
      <div className="flex flex-col gap-2">
        {/* Row 1: Primary action buttons — Daftar, Hasil, Sawer, Arena Live, Payment */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Daftar / Register — always visible, disabled when registration not open */}
          <button
            onClick={isRegistrationOpen ? (e: React.MouseEvent) => { e.stopPropagation(); goToRegister(); } : undefined}
            aria-disabled={!isRegistrationOpen}
            disabled={!isRegistrationOpen}
            className={`group flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all duration-200 ${
              isRegistrationOpen
                ? `${btnPrimary} hover:scale-[1.02] active:scale-95 cursor-pointer`
                : 'bg-muted/20 border border-border/30 text-muted-foreground cursor-not-allowed opacity-60'
            }`}
            title={isRegistrationOpen ? 'Daftar sekarang' : 'Pendaftaran belum dibuka'}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{isRegistrationOpen ? 'Daftar' : 'Selesai'}</span>
            {isRegistrationOpen && <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />}
          </button>

          {/* Lihat Hasil */}
          {showResultBtn && (
            <button
              onClick={(e) => { e.stopPropagation(); onGoToBracket(); }}
              className={`group flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-xs font-bold text-white bg-white/10 border border-white/20 hover:bg-white/20 hover:scale-[1.02] active:scale-95 transition-all duration-200 cursor-pointer`}
            >
              <Trophy className="w-3.5 h-3.5 text-white" />
              <span>Hasil</span>
            </button>
          )}

          {/* Sawer — next to Hasil */}
          {showSawerBtn && (
            <button
              onClick={(e) => { e.stopPropagation(); onSawer?.(); }}
              className="group flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-xs font-bold bg-idm-gold-warm/10 border border-idm-gold-warm/20 text-idm-gold-warm hover:bg-idm-gold-warm/20 hover:shadow-[0_0_12px_rgba(239,249,35,0.2)] hover:scale-[1.02] active:scale-95 transition-all duration-200 cursor-pointer"
            >
              <Gift className="w-3.5 h-3.5" />
              <span>Sawer</span>
            </button>
          )}

          {/* Arena Live */}
          {showLiveBtn && (
            <button
              onClick={(e) => { e.stopPropagation(); goToArenaLive(); }}
              className="group flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-xs font-bold bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 hover:shadow-[0_0_12px_rgba(239,68,68,0.2)] hover:scale-[1.02] active:scale-95 transition-all duration-200 cursor-pointer"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Arena Live</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}

          {/* DANA Payment */}
          {onPayment && (
            <button
              onClick={(e) => { e.stopPropagation(); onPayment(); }}
              className="group flex items-center gap-1 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-xs font-bold bg-[#108ee9]/15 border border-[#108ee9]/25 text-[#5cb8f5] hover:bg-[#108ee9]/25 hover:shadow-[0_0_12px_rgba(16,142,233,0.2)] hover:scale-[1.02] active:scale-95 transition-all duration-200 cursor-pointer"
            >
              <svg className="w-7 h-3.5 shrink-0" viewBox="0 0 48 16" fill="currentColor">
                <text x="0" y="13" fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="14" letterSpacing="1.5">DANA</text>
              </svg>
            </button>
          )}
        </div>

        {/* Row 2: PrizePool — standalone below */}
        {tournament && (
          <div className="w-full text-center px-3 py-2 rounded-lg text-[10px] sm:text-xs font-bold bg-idm-gold-warm/10 border border-idm-gold-warm/20 text-idm-gold-warm">
            <span className="inline-flex items-center justify-center gap-2">
              <Coins className="w-4 h-4" />
              <span className="uppercase tracking-wider text-[9px] sm:text-[10px] opacity-70">PrizePool</span>
              <span className="text-xs sm:text-sm font-black">{prizePool > 0 ? formatCurrencyShort(prizePool) : 'Rp 0'}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════
   COMMUNITY HERO — Redesigned tournament-centric banner
   With tournament detail info + CTA buttons in each card
   ═══════════════════════════════════════════════════════ */
interface CommunityHeroProps {
  maleData?: StatsData;
  femaleData?: StatsData;
  onSawer?: () => void;
  onRegister?: () => void;
  onPayment?: (division: 'male' | 'female') => void;
}

export const CommunityHero = React.memo(function CommunityHero({ maleData, femaleData, onSawer, onRegister, onPayment }: CommunityHeroProps) {
  const { setCurrentView, setDivision, playerAuth } = useAppStore();
  const { heroBannerDashboard } = useBackgroundImages();

  // Extract data
  const malePlayers = maleData?.totalPlayers || 0;
  const femalePlayers = femaleData?.totalPlayers || 0;
  const maleApprovedPlayers = maleData?.approvedPlayerCount || 0;
  const femaleApprovedPlayers = femaleData?.approvedPlayerCount || 0;
  const totalPlayers = malePlayers + femalePlayers;
  const totalClubs = (maleData?.clubs?.length || 0) + (femaleData?.clubs?.length || 0);
  const totalMatches = (maleData?.recentMatches?.length || 0) + (femaleData?.recentMatches?.length || 0);
  const completedMatches = 0;

  // Season progress
  const seasonProgress = maleData?.seasonProgress || femaleData?.seasonProgress;
  const completedWeeks = seasonProgress?.completedWeeks || 0;
  const totalWeeks = seasonProgress?.totalWeeks || 10;
  const seasonPercentage = totalWeeks > 0 ? Math.round((completedWeeks / totalWeeks) * 100) : 0;
  const seasonName =
    maleData?.season?.name?.replace(/\s*[-–]\s*(Male|Female|Cowo|Cewe)\s*$/i, '') ||
    femaleData?.season?.name?.replace(/\s*[-–]\s*(Male|Female|Cowo|Cewe)\s*$/i, '');

  // Per-division status
  const maleStatus: TournamentStatus = mapTournamentStatus(maleData?.activeTournament?.status as RawTournamentStatus | undefined);
  const femaleStatus: TournamentStatus = mapTournamentStatus(femaleData?.activeTournament?.status as RawTournamentStatus | undefined);

  // Overall status — pick the most "active"
  const overallStatus: TournamentStatus = (() => {
    const statuses = [maleStatus, femaleStatus];
    if (statuses.includes('live')) return 'live';
    if (statuses.includes('registration')) return 'registration';
    if (statuses.includes('completed')) return 'completed';
    return 'offseason';
  })();

  const hasLive = overallStatus === 'live';
  const liveMatchCount = 0;

  // Quick stats for inline display
  const quickStats = [
    { icon: Users, value: totalPlayers, label: 'Pemain', color: 'text-idm-gold-warm' },
    { icon: Building2, value: totalClubs, label: 'Klub', color: 'text-emerald-400' },
    { icon: Trophy, value: totalMatches, label: 'Match', color: 'text-cyan-400' },
  ];

  // Personal user data — for smart highlight
  const loggedInPlayer = playerAuth.isAuthenticated ? playerAuth.account?.player : null;
  const playerDivision = loggedInPlayer?.division as 'male' | 'female' | undefined;
  // Find player rank from top players list
  const playerRank = (() => {
    if (!loggedInPlayer) return null;
    const list = playerDivision === 'female' ? femaleData?.topPlayers : maleData?.topPlayers;
    const idx = list?.findIndex(p => p.gamertag === loggedInPlayer.gamertag);
    return idx !== undefined && idx >= 0 ? idx + 1 : null;
  })();

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-idm-gold-warm/15"
      aria-label="Community tournament banner"
    >
      {/* ═══ Background Layers ═══ */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(145deg, var(--bg-deep) 0%, var(--bg-mid) 35%, var(--bg-mid) 70%, var(--bg-deep) 100%)`,
        }}
      />

      {/* ═══ Dot Grid Pattern ═══ */}
      <div className="absolute inset-0 community-hero-dots pointer-events-none opacity-60" />

      {heroBannerDashboard && (
        <Image
          src={heroBannerDashboard}
          alt=""
          fill
          sizes="100vw"
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover object-center opacity-15 pointer-events-none"
          aria-hidden="true"
          priority={false}
        />
      )}

      {heroBannerDashboard && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, rgba(10,10,20,0.6) 0%, rgba(10,10,20,0.75) 50%, rgba(10,10,20,0.85) 100%)',
          }}
        />
      )}

      {/* Subtle navy depth haze — dark canvas, no gold wash */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 20%, rgba(30,41,59,0.10) 0%, transparent 60%)',
        }}
      />

      {/* Male glow — left */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 20% 50%, rgba(87,181,255,0.04) 0%, transparent 50%)',
        }}
      />

      {/* Female glow — right */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 80% 50%, rgba(255,92,154,0.04) 0%, transparent 50%)',
        }}
      />

      {/* ═══ Floating gold particles — hidden on mobile to reduce paint/GPU cost ═══ */}
      <div className="hidden sm:block absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full animate-float-subtle"
            style={{
              width: `${3 + (i % 3)}px`,
              height: `${3 + (i % 3)}px`,
              background: `radial-gradient(circle, rgba(239,249,35,${0.15 + (i % 3) * 0.1}) 0%, transparent 70%)`,
              left: `${15 + i * 14}%`,
              top: `${20 + ((i * 17) % 60)}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${3 + (i % 2)}s`,
            }}
          />
        ))}
      </div>

      {/* ═══ Content ═══ */}
      <div className="relative z-10 p-4 sm:p-5 lg:p-6">

        {/* ── Row 1: Status + Season + Week ── */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
          <StatusBadge status={overallStatus} />

          <span className="hidden sm:inline text-border/40">·</span>

          <h2
            className="text-xs sm:text-sm font-black uppercase tracking-wider"
            style={{
              background:
                'linear-gradient(135deg, #FAF0DC 0%, #EFF923 30%, #F9CB25 50%, #F9CB25 70%, #EFF923 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {seasonName || 'IDM TARKAM'}
          </h2>

          <span className="hidden sm:inline text-border/40">·</span>

          <span className="text-[10px] sm:text-xs text-muted-foreground font-semibold">
            Week {completedWeeks}/{totalWeeks}
          </span>

          {/* Live match count */}
          {hasLive && liveMatchCount > 0 && (
            <>
              <span className="hidden sm:inline text-border/40">·</span>
              <span className="text-[10px] sm:text-xs text-red-400 font-bold flex items-center gap-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                </span>
                {liveMatchCount} Live
              </span>
            </>
          )}
        </div>

        {/* ── Row 2: Division Cards (with tournament details + CTA buttons) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4" style={{ contain: 'layout style' }}>
          <DivisionCard
            division="male"
            data={maleData}
            status={maleStatus}
            playerCount={maleApprovedPlayers}
            onSawer={onSawer}
            onRegister={onRegister}
            onPayment={onPayment ? () => onPayment('male') : undefined}
            onGoToBracket={() => { setDivision('male'); setCurrentView('bracket'); }}
          />
          <DivisionCard
            division="female"
            data={femaleData}
            status={femaleStatus}
            playerCount={femaleApprovedPlayers}
            onSawer={onSawer}
            onRegister={onRegister}
            onPayment={onPayment ? () => onPayment('female') : undefined}
            onGoToBracket={() => { setDivision('female'); setCurrentView('bracket'); }}
          />
        </div>

        {/* ── Row 2.5: Personal Stats — reserve space to prevent CLS ── */}
        <div style={{ minHeight: loggedInPlayer ? undefined : 0, contain: 'layout style' }}>
        {loggedInPlayer && (
          <div className="flex items-center gap-3 p-4 sm:p-5 rounded-2xl bg-idm-gold-warm/5 border border-idm-gold-warm/10 mb-4">
            {/* Avatar */}
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-idm-gold-warm/30 to-idm-gold-warm/10 flex items-center justify-center shrink-0 border border-idm-gold-warm/20">
              <span className="text-xs font-black text-idm-gold-warm">
                {loggedInPlayer.gamertag.slice(0, 2).toUpperCase()}
              </span>
            </div>
            {/* Player info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-idm-gold-warm shrink-0" />
                <span className="text-xs font-bold text-foreground truncate">{loggedInPlayer.gamertag}</span>
                {playerRank && (
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                    playerRank <= 3 ? 'bg-yellow-500/15 text-yellow-400' : 'bg-idm-gold-warm/10 text-idm-gold-warm'
                  }`}>
                    #{playerRank}
                  </span>
                )}
                {playerDivision && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                    playerDivision === 'male' ? 'bg-idm-male/15 text-idm-male' : 'bg-idm-female/15 text-idm-female'
                  }`}>
                    {playerDivision === 'male' ? '🕺' : '💃'}
                  </span>
                )}
              </div>
              {/* Personal quick stats */}
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[11px] text-idm-gold-warm font-bold tabular-nums">
                  <Trophy className="w-2.5 h-2.5 inline mr-0.5" />
                  {loggedInPlayer.points} pts
                </span>
                <span className="text-[11px] text-emerald-400 font-bold tabular-nums">
                  {loggedInPlayer.totalWins}W
                </span>
                <span className="text-[11px] text-red-400 font-bold tabular-nums">
                  {loggedInPlayer.matches - loggedInPlayer.totalWins}L
                </span>
                <span className="text-[11px] text-yellow-400 font-bold tabular-nums">
                  {loggedInPlayer.totalMvp} MVP
                </span>
                {loggedInPlayer.streak > 0 && (
                  <span className="text-[11px] text-orange-400 font-bold tabular-nums">
                    🔥 {loggedInPlayer.streak} streak
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
        </div>

        {/* ── Row 3: Quick Stats + Progress (inline, compact) ── */}
        <div className="flex items-center gap-4 sm:gap-6 p-4 sm:p-5 rounded-2xl bg-idm-gold-warm/5 border border-idm-gold-warm/10" style={{ contain: 'layout style' }}>
          {/* Stats */}
          <div className="flex items-center gap-3 sm:gap-5 shrink-0">
            {quickStats.map(stat => (
              <div key={stat.label} className="flex items-center gap-1.5">
                <stat.icon className={`w-3.5 h-3.5 ${stat.color} opacity-70`} />
                <div className="flex flex-col">
                  <span className={`text-xs sm:text-sm font-black tabular-nums ${stat.color} leading-tight`}>
                    <AnimatedNumber target={stat.value} />
                  </span>
                  <span className="text-[7px] sm:text-[8px] text-muted-foreground uppercase tracking-wider font-semibold leading-tight">
                    {stat.label}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-border/20 shrink-0 hidden sm:block" />

          {/* Season Progress — compact inline */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] sm:text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                <Calendar className="w-2.5 h-2.5" />
                <span className="truncate">{seasonName || 'Season'}</span>
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold text-idm-gold-warm shrink-0 ml-2">
                {completedWeeks}/{totalWeeks} · {seasonPercentage}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-idm-gold-warm/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out community-progress-bar"
                style={{
                  width: `${seasonPercentage}%`,
                  background: seasonPercentage > 0
                    ? 'linear-gradient(90deg, #EFF923, #F9CB25, #F9CB25)'
                    : undefined,
                  boxShadow: seasonPercentage > 0 ? '0 0 6px rgba(239,249,35,0.3)' : undefined,
                  animation: seasonPercentage > 0 ? 'progress-bar-breathe 2s ease-in-out infinite' : undefined,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
