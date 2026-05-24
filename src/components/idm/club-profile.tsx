'use client';

import React, { useEffect, useState } from 'react';
import { AvatarMedia } from '@/components/ui/avatar-media';
import { createPortal } from 'react-dom';

import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, X, Trophy, Shield, Crown, Music, Target,
  TrendingUp, Award, Zap, Users, Star, BarChart3,
  Flame, ChevronRight, MapPin
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { getAvatarUrl, hashString } from '@/lib/utils';
import { ClubLogoImage } from '@/components/idm/club-logo-image';
import { SharePopup } from './social-share-button';

interface ClubProfileProps {
  club: {
    id: string;
    name: string;
    logo?: string | null;
    bannerImage?: string | null;
    division?: 'male' | 'female' | 'league' | string;
    wins: number;
    losses: number;
    points: number;
    gameDiff: number;
    members?: { id: string; name: string; gamertag: string; avatar?: string | null; tier: string; points: number }[];
    rank?: number;
  };
  onClose: () => void;
  rank?: number;
  onPlayerClick?: (player: { id: string; name: string; gamertag: string; avatar?: string | null; tier: string; points: number; division?: string; city?: string }) => void;
}

// ─── Procedural Club Logo Component ───
const ClubLogo = React.memo(function ClubLogo({ name, size = 120, isChampion }: {
  name: string; size?: number; isChampion?: boolean;
}) {
  const hash = hashString(name);
  // Unified clubs use gold/league color scheme
  const primaryColor = '#EFF923';
  const secondaryColor = '#F9CB25';
  const lightColor = '#F9CB25';
  const darkColor = '#8A6818';

  // Generate pattern variants based on hash
  const segments = 5 + (hash % 4);
  const rotation = (hash % 360);
  const innerPattern = hash % 5;
  const accentCount = 3 + (hash % 3);

  // Extract initials
  const words = name.trim().split(/\s+/);
  const initials = words.length >= 2
    ? words.slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : name.slice(0, 2).toUpperCase();

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {isChampion && (
        <>
          <div
            className="absolute rounded-full animate-pulse"
            style={{
              inset: -8,
              border: `2px solid rgba(234, 179, 8, 0.3)`,
              boxShadow: `0 0 20px rgba(234, 179, 8, 0.15), 0 0 40px rgba(234, 179, 8, 0.05)`,
            }}
          />
          <div
            className="absolute rounded-full"
            style={{ inset: -4, border: `1px solid rgba(234, 179, 8, 0.15)` }}
          />
        </>
      )}

      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        className="drop-shadow-2xl"
        style={{ filter: isChampion ? 'drop-shadow(0 0 12px rgba(234, 179, 8, 0.2))' : undefined }}
      >
        <defs>
          <linearGradient id={`grad-${hash}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={primaryColor} />
            <stop offset="50%" stopColor={secondaryColor} />
            <stop offset="100%" stopColor={primaryColor} />
          </linearGradient>
          <linearGradient id={`grad2-${hash}`} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={lightColor} stopOpacity="0.15" />
            <stop offset="100%" stopColor={primaryColor} stopOpacity="0.05" />
          </linearGradient>
          {isChampion && (
            <linearGradient id={`shimmer-${hash}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="45%" stopColor="transparent" />
              <stop offset="50%" stopColor="rgba(250, 204, 21, 0.15)" />
              <stop offset="55%" stopColor="transparent" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          )}
          <clipPath id={`shield-${hash}`}>
            <path d="M60 4 L112 24 L112 68 Q112 102 60 117 Q8 102 8 68 L8 24 Z" />
          </clipPath>
          <filter id={`glow-${hash}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <path d="M60 4 L112 24 L112 68 Q112 102 60 117 Q8 102 8 68 L8 24 Z" fill={`url(#grad-${hash})`} opacity="0.12" />

        <g clipPath={`url(#shield-${hash})`}>
          {Array.from({ length: segments }).map((_, i) => {
            const angle = (360 / segments) * i + rotation;
            return (
              <line key={`seg-${i}`} x1="60" y1="60" x2={60 + Math.cos(angle * Math.PI / 180) * 120} y2={60 + Math.sin(angle * Math.PI / 180) * 120} stroke={lightColor} strokeWidth="0.5" opacity="0.1" />
            );
          })}

          {innerPattern === 0 && (
            <>
              <rect x="30" y="30" width="60" height="60" rx="2" transform="rotate(45 60 60)" fill="none" stroke={lightColor} strokeWidth="0.4" opacity="0.12" />
              <rect x="38" y="38" width="44" height="44" rx="2" transform="rotate(45 60 60)" fill="none" stroke={lightColor} strokeWidth="0.3" opacity="0.08" />
            </>
          )}
          {innerPattern === 1 && Array.from({ length: 7 }).map((_, i) => (
            <line key={`stripe-${i}`} x1="8" y1={25 + i * 14} x2="112" y2={25 + i * 14} stroke={lightColor} strokeWidth="0.4" opacity="0.08" />
          ))}
          {innerPattern === 2 && (
            <>
              <circle cx="60" cy="60" r="40" fill="none" stroke={primaryColor} strokeWidth="0.5" opacity="0.1" />
              <circle cx="60" cy="60" r="30" fill="none" stroke={primaryColor} strokeWidth="0.4" opacity="0.08" />
              <circle cx="60" cy="60" r="20" fill="none" stroke={primaryColor} strokeWidth="0.3" opacity="0.06" />
            </>
          )}
          {innerPattern === 3 && (
            <>
              {Array.from({ length: 6 }).map((_, i) => (<line key={`ch1-${i}`} x1={20 + i * 16} y1="4" x2={20 + i * 16} y2="117" stroke={lightColor} strokeWidth="0.3" opacity="0.06" />))}
              {Array.from({ length: 6 }).map((_, i) => (<line key={`ch2-${i}`} x1="8" y1={20 + i * 16} x2="112" y2={20 + i * 16} stroke={lightColor} strokeWidth="0.3" opacity="0.06" />))}
            </>
          )}
          {innerPattern === 4 && (
            <>
              <polyline points="20,35 60,20 100,35" fill="none" stroke={lightColor} strokeWidth="0.5" opacity="0.1" />
              <polyline points="20,55 60,40 100,55" fill="none" stroke={lightColor} strokeWidth="0.5" opacity="0.08" />
              <polyline points="20,75 60,60 100,75" fill="none" stroke={lightColor} strokeWidth="0.5" opacity="0.06" />
              <polyline points="20,95 60,80 100,95" fill="none" stroke={lightColor} strokeWidth="0.5" opacity="0.04" />
            </>
          )}

          <circle cx="60" cy="58" r="32" fill="none" stroke={primaryColor} strokeWidth="0.8" opacity="0.12" />
          <circle cx="60" cy="58" r="22" fill="none" stroke={primaryColor} strokeWidth="0.5" opacity="0.08" />
          {Array.from({ length: accentCount }).map((_, i) => {
            const dotAngle = (360 / accentCount) * i + rotation * 0.5;
            return <circle key={`dot-${i}`} cx={60 + Math.cos(dotAngle * Math.PI / 180) * 28} cy={58 + Math.sin(dotAngle * Math.PI / 180) * 28} r="1.5" fill={lightColor} opacity="0.2" />;
          })}
          <path d="M60 4 L112 24 L112 68 Q112 102 60 117 Q8 102 8 68 L8 24 Z" fill={`url(#grad2-${hash})`} />
        </g>

        <path d="M60 4 L112 24 L112 68 Q112 102 60 117 Q8 102 8 68 L8 24 Z" fill="none" stroke={primaryColor} strokeWidth="2" opacity="0.35" />
        <path d="M60 11 L105 27 L105 66 Q105 96 60 110 Q15 96 15 66 L15 27 Z" fill="none" stroke={primaryColor} strokeWidth="0.5" opacity="0.15" />
        <path d="M60 14 L98 28 L98 32 L60 20 L22 32 L22 28 Z" fill={primaryColor} opacity="0.08" />
        <path d="M60 106 Q90 96 100 80 L100 84 Q90 100 60 110 Q30 100 20 84 L20 80 Q30 96 60 106 Z" fill={primaryColor} opacity="0.06" />

        <text x="60" y="62" textAnchor="middle" dominantBaseline="middle" fill={primaryColor} fontSize={initials.length > 2 ? '20' : '26'} fontWeight="900" fontFamily="system-ui, -apple-system, sans-serif" letterSpacing="1" opacity="0.85" filter={`url(#glow-${hash})`}>
          {initials}
        </text>

        {isChampion && (
          <path d="M60 4 L112 24 L112 68 Q112 102 60 117 Q8 102 8 68 L8 24 Z" fill={`url(#shimmer-${hash})`}>
            <animate attributeName="opacity" values="0;1;0" dur="3s" repeatCount="indefinite" />
          </path>
        )}
      </svg>

      {isChampion && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ borderRadius: '16px' }}>
          <div className="absolute inset-0" style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(250, 204, 21, 0.08) 45%, rgba(250, 204, 21, 0.15) 50%, rgba(250, 204, 21, 0.08) 55%, transparent 60%)', animation: 'clubLogoShimmer 3s ease-in-out infinite' }} />
        </div>
      )}
    </div>
  );
})

// ─── Banner Geometric Pattern — Gold/League style ───
function BannerPattern() {
  const color = '#EFF923';
  return (
    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 220">
      <defs>
        <linearGradient id="banner-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.08" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <line x1="0" y1="0" x2="400" y2="220" stroke={color} strokeWidth="0.5" opacity="0.06" />
      <line x1="50" y1="0" x2="400" y2="175" stroke={color} strokeWidth="0.3" opacity="0.04" />
      <line x1="100" y1="0" x2="400" y2="150" stroke={color} strokeWidth="0.3" opacity="0.04" />
      <line x1="0" y1="50" x2="350" y2="220" stroke={color} strokeWidth="0.3" opacity="0.04" />
      <polygon points="320,20 340,10 360,20 360,40 340,50 320,40" fill="none" stroke={color} strokeWidth="0.5" opacity="0.07" />
      <polygon points="40,130 55,120 70,130 70,150 55,160 40,150" fill="none" stroke={color} strokeWidth="0.5" opacity="0.05" />
      <circle cx="360" cy="160" r="25" fill="none" stroke={color} strokeWidth="0.4" opacity="0.05" />
      <circle cx="360" cy="160" r="15" fill="none" stroke={color} strokeWidth="0.3" opacity="0.04" />
      <rect x="70" y="30" width="30" height="30" rx="2" transform="rotate(15 85 45)" fill="none" stroke={color} strokeWidth="0.4" opacity="0.05" />
      <circle cx="150" cy="20" r="1.5" fill={color} opacity="0.1" />
      <circle cx="250" cy="40" r="1" fill={color} opacity="0.08" />
      <circle cx="50" cy="80" r="1.5" fill={color} opacity="0.06" />
      <circle cx="370" cy="90" r="1" fill={color} opacity="0.08" />
      <circle cx="200" cy="180" r="1.5" fill={color} opacity="0.05" />
    </svg>
  );
}

function StatBlock({ icon: Icon, label, value, sub, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="px-2 py-2.5 sm:p-4 sm:py-5 rounded-xl sm:rounded-2xl bg-muted/30 border border-border/30 text-center">
      <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${color} mx-auto mb-0.5 sm:mb-1`} />
      <p className="text-base sm:text-lg font-bold leading-tight">{value}</p>
      <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-tight">{label}</p>
      {sub && <p className="text-[8px] sm:text-[9px] text-muted-foreground/70 mt-0.5 leading-tight">{sub}</p>}
    </div>
  );
}

// Unified member type from the API
interface UnifiedMember {
  id: string;
  gamertag: string;
  name: string;
  division: string;
  avatar: string | null;
  tier: string;
  points: number;
  totalWins: number;
  totalMvp: number;
  streak: number;
  maxStreak: number;
  matches: number;
  isActive: boolean;
  role: string;
  clubDivision: string;
  city?: string;
}

export function ClubProfile({ club, onClose, rank, onPlayerClick }: ClubProfileProps) {
  const totalMatches = club.wins + club.losses;
  const winRate = totalMatches > 0 ? Math.round((club.wins / totalMatches) * 100) : 0;
  const isUndefeated = club.losses === 0 && club.wins > 0;
  const isChampion = rank === 1;
  const rankLabel = rank === 1 ? '🏆 Juara Tarkam' : rank === 2 ? '🥈 Juara 2' : rank === 3 ? '🥉 Peringkat 3' : rank ? `#${rank}` : '';

  // Fetch unified club profile with members from both divisions
  const { data: unifiedData, isLoading: isUnifiedLoading } = useQuery({
    queryKey: ['unified-club-profile', club.id],
    queryFn: async () => {
      const res = await fetch(`/api/clubs/unified-profile?clubId=${club.id}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: !!club.id,
  });

  // Use unified data if available, fall back to prop data
  const displayWins = unifiedData?.wins ?? club.wins;
  const displayLosses = unifiedData?.losses ?? club.losses;
  const displayPoints = unifiedData?.points ?? club.points;
  const displayGameDiff = unifiedData?.gameDiff ?? club.gameDiff;
  const displayMalePoints = unifiedData?.malePoints ?? (club as any).malePoints ?? 0;
  const displayFemalePoints = unifiedData?.femalePoints ?? (club as any).femalePoints ?? 0;
  const displayTotalMatches = displayWins + displayLosses;
  const displayWinRate = displayTotalMatches > 0 ? Math.round((displayWins / displayTotalMatches) * 100) : 0;
  const displayIsUndefeated = displayLosses === 0 && displayWins > 0;

  // Members from unified data (both divisions) or prop data (single division fallback)
  const members: UnifiedMember[] = unifiedData?.members || club.members?.map(m => ({
    ...m,
    division: club.division || 'male',
    totalWins: 0,
    totalMvp: 0,
    streak: 0,
    maxStreak: 0,
    matches: 0,
    isActive: true,
    role: 'member',
    clubDivision: club.division || 'male',
  })) || [];

  const hasBothDivisions = unifiedData?.hasMaleDivision && unifiedData?.hasFemaleDivision;
  const maleCount = unifiedData?.maleMembers ?? (club.division === 'male' ? members.length : 0);
  const femaleCount = unifiedData?.femaleMembers ?? (club.division === 'female' ? members.length : 0);

  // Close on Escape
  useEffect(() => {
    // Prevent background scrolling when modal is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handler);
    };
  }, [onClose]);

  // Portal — same fix as PlayerProfile: render into body to avoid parent overflow/transform issues
  const [portalTarget] = useState<HTMLElement | null>(() =>
    typeof document !== 'undefined' ? document.body : null
  );

  if (!portalTarget) return null;

  const modal = (
    <div
      className="modal-backdrop-heavy modal-backdrop-enter z-[9999] p-3 sm:p-4 overflow-hidden"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Profil Club ${club.name}`}
    >
      <div
        className="modal-container modal-container-lg modal-container-gold modal-enter-slide max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
          {/* ═══ Sticky Close Button — always visible, outside scroll area ═══ */}
          <button
            onClick={onClose}
            aria-label="Kembali"
            className="modal-close-dark modal-close-lg absolute top-3 left-3 z-[60]"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* ═══ Share button — always visible, outside scroll area ═══ */}
          <div className="absolute top-3 right-3 z-[60]">
            <SharePopup
              shareUrl={typeof window !== 'undefined' ? `${window.location.origin}/?view=club&name=${encodeURIComponent(club.name)}` : ''}
              title="Bagikan Klub"
              subtitle={<>Klub <span className="font-semibold text-idm-gold-warm">{club.name}</span></>}
              shareText={`Lihat klub ${club.name} di Tarkam IDM!`}
              buttonLabel="Bagikan klub"
              size="sm"
            />
          </div>

          {/* ═══ Scrollable content — EVERYTHING scrolls together ═══ */}
          <div className="relative z-10 bg-background min-h-0 flex-1 overflow-y-auto custom-scrollbar rounded-[inherit]">

          {/* ── Header Banner ── */}
          <div className="relative h-48 sm:h-56 md:h-64">
  {/* FIX: Jangan render bg-section.jpg sebagai fallback */}
  {(() => {
  const bannerSrc = unifiedData?.bannerImage || club.bannerImage;
  return bannerSrc ? (
    <Image src={bannerSrc} alt="" fill sizes="100vw" className="absolute inset-0 object-cover transition-opacity duration-500" aria-hidden="true" loading="lazy" />
  ) : (
    <div className="absolute inset-0 bg-gradient-to-br from-background via-muted/50 to-background" aria-hidden="true" />
  );
})()}

            {/* Gold gradient overlay — unified club uses league gold */}
            <div className="absolute inset-0 bg-gradient-to-br from-background/70 via-background/40 to-background/80" />

            {/* Geometric SVG pattern overlay */}
            <BannerPattern />

            {/* Gold league accent — unified club, no division split */}
            <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
              <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(239,249,35,0.06) 0%, transparent 60%)' }} />
            </div>

            {/* Bottom fade to background */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />

            {/* Decorative large shield watermark */}
            <div className="absolute top-3 right-3 opacity-[0.06]">
              <Shield className="w-28 h-28 text-idm-gold-warm" />
            </div>

            {/* Rank Badge — top left */}
            {rank && rank <= 3 && (
              <div className="absolute top-14 left-3 z-10">
                <Badge className={`text-xs font-bold border-0 ${
                  rank === 1 ? 'bg-yellow-500/20 text-yellow-500' :
                  rank === 2 ? 'bg-gray-400/20 text-muted-foreground' :
                  'bg-amber-600/20 text-amber-600'
                }`}>
                  {rankLabel}
                </Badge>
              </div>
            )}

            {/* ── Large Club Logo ── */}
            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 z-10">
              <div className={`rounded-2xl border-4 border-background ${
                isChampion ? 'bg-yellow-500/5' : ''
              }`}>
                {club.logo ? (
                  <div className="relative" style={{ width: 100, height: 100 }}>
                    {isChampion && (
                      <>
                        <div className="absolute rounded-full animate-pulse" style={{ inset: -8, border: '2px solid rgba(234, 179, 8, 0.3)', boxShadow: '0 0 20px rgba(234, 179, 8, 0.15), 0 0 40px rgba(234, 179, 8, 0.05)' }} />
                        <div className="absolute rounded-full" style={{ inset: -4, border: '1px solid rgba(234, 179, 8, 0.15)' }} />
                      </>
                    )}
                    <ClubLogoImage clubName={club.name} dbLogo={club.logo} alt={club.name} width={100} height={100} className="w-full h-full object-cover" style={isChampion ? { filter: 'drop-shadow(0 0 12px rgba(234, 179, 8, 0.2))' } : undefined} />
                    {/* Season champion badge */}
                    {isChampion && (
                      <div className="absolute -top-1 -right-1 z-20 min-w-[28px] h-[28px] rounded-full bg-idm-gold-warm flex items-center justify-center shadow-lg shadow-idm-gold-warm/30 border-2 border-mid">
                        <span className="text-[10px] font-black text-mid leading-none">S1</span>
                      </div>
                    )}
                    {isChampion && (
                      <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl">
                        <div className="absolute inset-0" style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(250, 204, 21, 0.08) 45%, rgba(250, 204, 21, 0.15) 50%, rgba(250, 204, 21, 0.08) 55%, transparent 60%)', animation: 'clubLogoShimmer 3s ease-in-out infinite' }} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="pt-1">
                    <ClubLogo name={club.name} size={96} isChampion={isChampion} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Content ── */}
          <div className="modal-body-compact pt-16!">
            {/* Name & Division */}
            <div className="text-center mb-4">
              <h2 className="text-xl font-black" style={{ background: 'linear-gradient(135deg, var(--idm-gold-warm), #F9CB25, var(--idm-gold-warm))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{club.name}</h2>
              <div className="flex items-center justify-center gap-2 mt-2">
                {/* Club badge — unified, no division split */}
                <Badge className="bg-idm-gold-warm/10 text-idm-gold-warm text-[10px] border-0">
                  <Shield className="w-3 h-3 mr-1" /> Club Tarkam IDM
                </Badge>
                <Badge className="bg-white/5 text-muted-foreground text-[10px] border-0">
                  <Users className="w-3 h-3 mr-1" /> {members.length} Pemain
                </Badge>
                {displayIsUndefeated && (
                  <Badge className="bg-green-500/10 text-green-500 text-[10px] border-0">
                    🔥 Tak Terkalahkan
                  </Badge>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 max-w-xs mx-auto">
                {unifiedData?.championSeasons?.length
                  ? `Pemenang Tarkam IDM — Club terbaik dengan performa luar biasa`
                  : rank === 1
                  ? 'Juara Tarkam — Club terbaik dengan performa luar biasa'
                  : rank === 2
                  ? 'Juara 2 — Pesaing kuat yang mengejar gelar'
                  : 'Club kompetitif di season Tarkam IDM'
                }
              </p>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-4">
              <StatBlock icon={Trophy} label="Poin" value={displayPoints} color="text-idm-gold-warm" />
              <StatBlock icon={Target} label="Win Rate" value={`${displayWinRate}%`} sub={`${displayWins}W/${displayLosses}L`} color="text-green-500" />
              <StatBlock icon={Music} label="Game Diff" value={displayGameDiff > 0 ? `+${displayGameDiff}` : displayGameDiff} color="text-yellow-500" />
            </div>

            {/* Per-Division Points Breakdown */}
            {(displayMalePoints > 0 || displayFemalePoints > 0) && (
              <div className="flex items-center justify-center gap-3 mb-4">
                {displayMalePoints > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-idm-male/10 border border-idm-male/15">
                    <Music className="w-3.5 h-3.5 text-idm-male-light dark:text-[#57B5FF]" />
                    <span className="text-[11px] font-bold text-idm-male-light dark:text-[#57B5FF]">♂ {displayMalePoints.toLocaleString('id-ID')} pts</span>
                  </div>
                )}
                {displayFemalePoints > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-idm-female/10 border border-idm-female/15">
                    <Shield className="w-3.5 h-3.5 text-idm-female-light dark:text-[#FF5C9A]" />
                    <span className="text-[11px] font-bold text-idm-female-light dark:text-[#FF5C9A]">♀ {displayFemalePoints.toLocaleString('id-ID')} pts</span>
                  </div>
                )}
              </div>
            )}

            {/* Division member count removed — clubs are not gendered.
                Players within a club may participate in male or female divisions,
                but the club itself belongs to ALL divisions. */}

            {/* Detailed Stats */}
            <div className="space-y-3 mb-4">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Rasio Win</span>
                  <span className="font-bold text-idm-gold-warm">{displayWinRate}%</span>
                </div>
                <Progress value={displayWinRate} className="h-2" />
              </div>

              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                <div className="flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl bg-green-500/5 border border-green-500/10">
                  <Trophy className="w-3.5 h-3.5 text-green-500 mb-1" />
                  <span className="text-base sm:text-lg font-bold text-green-500 leading-tight">{displayWins}</span>
                  <span className="text-[9px] sm:text-[10px] text-muted-foreground">Win</span>
                </div>
                <div className="flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                  <X className="w-3.5 h-3.5 text-red-500 mb-1" />
                  <span className="text-base sm:text-lg font-bold text-red-500 leading-tight">{displayLosses}</span>
                  <span className="text-[9px] sm:text-[10px] text-muted-foreground">Kekalahan</span>
                </div>
                <div className="flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl bg-idm-gold-warm/5 border border-idm-gold-warm/10">
                  <Zap className="w-3.5 h-3.5 text-idm-gold-warm mb-1" />
                  <span className="text-base sm:text-lg font-bold text-idm-gold-warm leading-tight">{displayTotalMatches}</span>
                  <span className="text-[9px] sm:text-[10px] text-muted-foreground">Total Match</span>
                </div>
              </div>
            </div>

            {/* Roster — Mixed members from both divisions */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-idm-gold-warm" />
                <h3 className="text-sm font-semibold">Daftar Pemain</h3>
                <Badge className="bg-idm-gold-warm/10 text-idm-gold-warm text-[10px] ml-auto">{members.length} Players</Badge>
              </div>
              {isUnifiedLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-5 h-5 border-2 border-idm-gold-warm/30 border-t-idm-gold-warm rounded-full animate-spin" />
                  <span className="ml-2 text-xs text-muted-foreground">Memuat anggota...</span>
                </div>
              ) : members.length > 0 ? (
                <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
                  {members.map((p) => {
                    const isMale = p.division === 'male';
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 p-3 sm:p-4 rounded-lg bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors cursor-pointer interactive-scale"
                        onClick={() => onPlayerClick?.({
                          id: p.id,
                          name: p.name || p.gamertag,
                          gamertag: p.gamertag,
                          avatar: p.avatar,
                          tier: p.tier,
                          points: p.points,
                          division: p.division,
                          city: p.city,
                        })}
                      >
                        <div className="relative w-8 rounded-md overflow-hidden shrink-0" style={{ aspectRatio: '3/4' }}>
                          <AvatarMedia src={getAvatarUrl(p.gamertag, isMale ? 'male' : 'female', p.avatar)} alt={p.gamertag} fill sizes="60px" objectPosition="top" />
                          <div className="absolute inset-0 bg-gradient-to-t from-background/50 via-transparent to-transparent" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{p.gamertag}</span>
                            {/* Division indicator — subtle, just for info */}
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 bg-idm-gold-warm/50`} title={`Divisi ${isMale ? 'Cowo' : 'Cewe'}`} />
                            {p.role === 'captain' && (
                              <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-idm-gold-warm/15 text-idm-gold-warm">CPT</span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {p.totalWins > 0 && `${p.totalWins}W`}
                            {p.totalMvp > 0 && ` · ${p.totalMvp}x MVP`}
                            {p.city && <> · <MapPin className="w-2.5 h-2.5 inline -mt-0.5" /> {p.city}</>}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-idm-gold-warm">{p.points}</p>
                          <p className="text-[9px] text-muted-foreground">pts</p>
                        </div>
                        <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-idm-gold-warm/5 border border-idm-gold-warm/10 text-center">
                  <Users className="w-5 h-5 text-idm-gold-warm mx-auto mb-1.5 opacity-40" />
                  <p className="text-xs text-muted-foreground">Belum ada anggota</p>
                </div>
              )}
            </div>

            {/* Achievements */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-4 h-4 text-idm-gold-warm" />
                <h3 className="text-sm font-semibold">Prestasi</h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {/* League Season Champion badges — from admin designation */}
                {unifiedData?.championSeasons?.map((cs: { id: string; name: string; number: number; division: string }) => (
                  <Badge key={cs.id} className="bg-yellow-500/10 text-yellow-500 text-[10px] border-0">
                    <Crown className="w-3 h-3 mr-1" /> Pemenang Tarkam Season {cs.number}
                  </Badge>
                ))}
                {displayWins >= 1 && (
                  <Badge className="bg-green-500/10 text-green-500 text-[10px] border-0">
                    <Star className="w-3 h-3 mr-1" /> Win Pertama
                  </Badge>
                )}
                {displayWins >= 3 && (
                  <Badge className="bg-blue-500/10 text-blue-500 text-[10px] border-0">
                    <Trophy className="w-3 h-3 mr-1" /> 3+ Win
                  </Badge>
                )}
                {displayIsUndefeated && displayWins >= 2 && (
                  <Badge className="bg-orange-500/10 text-orange-500 text-[10px] border-0">
                    <Flame className="w-3 h-3 mr-1" /> Tak Terkalahkan
                  </Badge>
                )}
                {rank === 1 && !unifiedData?.championSeasons?.length && (
                  <Badge className="bg-yellow-500/10 text-yellow-500 text-[10px] border-0">
                    <Crown className="w-3 h-3 mr-1" /> Juara Tarkam
                  </Badge>
                )}
                {rank && rank <= 4 && rank > 1 && (
                  <Badge className="bg-idm-gold-warm/10 text-idm-gold-warm text-[10px] border-0">
                    <Shield className="w-3 h-3 mr-1" /> 4 Besar
                  </Badge>
                )}
                {displayGameDiff >= 5 && (
                  <Badge className="bg-amber-500/10 text-amber-500 text-[10px] border-0">
                    <Music className="w-3 h-3 mr-1" /> Dominan (+{displayGameDiff} GD)
                  </Badge>
                )}
                {displayTotalMatches >= 5 && (
                  <Badge className="bg-amber-600/10 text-amber-600 text-[10px] border-0">
                    <BarChart3 className="w-3 h-3 mr-1" /> Club Veteran
                  </Badge>
                )}
                {displayWinRate >= 70 && displayWins > 0 && (
                  <Badge className="bg-idm-gold-warm/10 text-idm-gold-warm text-[10px] border-0">
                    <TrendingUp className="w-3 h-3 mr-1" /> Rasio Win 70%+
                  </Badge>
                )}
              </div>
            </div>

            {/* Recent Matches */}
            {displayTotalMatches > 0 ? (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Music className="w-4 h-4 text-idm-gold-warm" />
                  <h3 className="text-sm font-semibold">Rekor Match</h3>
                </div>
                <div className="p-4 sm:p-5 rounded-lg bg-idm-gold-warm/5 border border-idm-gold-warm/10">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold text-green-500">{displayWins}</p>
                      <p className="text-[9px] text-muted-foreground uppercase">Win</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-muted-foreground">0</p>
                      <p className="text-[9px] text-muted-foreground uppercase">Seri</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-red-500">{displayLosses}</p>
                      <p className="text-[9px] text-muted-foreground uppercase">Kekalahan</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Music className="w-4 h-4 text-idm-gold-warm" />
                  <h3 className="text-sm font-semibold">Rekor Match</h3>
                </div>
                <div className="p-4 rounded-lg bg-idm-gold-warm/5 border border-idm-gold-warm/10 text-center">
                  <Music className="w-5 h-5 text-idm-gold-warm mx-auto mb-1.5 opacity-40" />
                  <p className="text-xs text-muted-foreground">Belum ada match dimainkan</p>
                </div>
              </div>
            )}

            {/* Points Breakdown */}
            <div className="p-4 sm:p-5 rounded-2xl bg-idm-gold-warm/5 border border-idm-gold-warm/10">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-idm-gold-warm" />
                <span className="text-xs font-semibold">Rincian Poin</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Win ({displayWins} × 1pt)</span>
                  <span className="font-bold text-idm-gold-warm">+{displayWins} pts</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Game Diff ({displayGameDiff > 0 ? '+' : ''}{displayGameDiff})</span>
                  <span className={`font-bold ${displayGameDiff > 0 ? 'text-green-500' : 'text-red-500'}`}>{displayGameDiff > 0 ? '+' : ''}{displayGameDiff} pts</span>
                </div>
                <div className="h-px bg-border my-1" />
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span className="text-idm-gold-warm">{displayPoints} pts</span>
                </div>
              </div>
            </div>
          </div>
          </div>
          {/* end scrollable content */}
      </div>
    </div>
  );

  return createPortal(modal, portalTarget);
}
