'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { Swords, Music, Shield, Crown, Users, Building2, Gamepad2, ArrowRight, Play, UserPlus, Calendar, Clock, MapPin, Heart, UserCheck, X, Zap, Flag, Target, Trophy, Star, ChevronRight, Search, Medal, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { AnimatedSection, SectionHeader, GlassCard, InteractiveCard, AnimatedGradientBorder } from './shared';
import { formatCurrency, parseWitaDate, formatWIBWeekdayShort, formatWIBTime, getAvatarUrl, hashString } from '@/lib/utils';
import type { StatsData } from '@/types/stats';

interface TournamentHubProps {
  maleData: StatsData | undefined;
  femaleData: StatsData | undefined;
  cmsSections: Record<string, any>;
  cmsSettings?: Record<string, string>;
  onEnterApp: (division: 'male' | 'female') => void;
  onRegister: (division: 'male' | 'female') => void;
  onDonate: (division: 'male' | 'female') => void;
  onVideoPlay?: (url: string, title: string) => void;
  onViewBracket?: (division: 'male' | 'female') => void;
  maleRegOpen?: boolean;
  femaleRegOpen?: boolean;
}

/* ────────────────────────── Division Config ────────────────────────── */
const DIVISION = {
  male: {
    key: 'male' as const,
    title: 'Cowo Tarkam',
    icon: Music,
    color: '#2E9FFF',
    colorLight: '#57B5FF',
    colorRgb: '46,159,255',
    gradient: 'from-idm-male/40 via-[#1478D9]/30 to-mid',
    badgeBg: 'bg-idm-male/15',
    badgeText: 'text-idm-male',
    badgeBorder: 'border-idm-male/25',
    iconBg: 'bg-idm-male/10 border-idm-male/25',
    ctaBg: 'bg-idm-male/10 border-idm-male/25 text-idm-male hover:bg-idm-male/20',
    statBg: 'bg-idm-male/[0.06] border-idm-male/10',
    hoverBorder: 'rgba(46,159,255,0.3)',
    hoverShadow: '0 8px 40px rgba(46,159,255,0.15)',
    patternOpacity: 'opacity-[0.04]',
  },
  female: {
    key: 'female' as const,
    title: 'Cewe Tarkam',
    icon: Shield,
    color: '#FF2D78',
    colorLight: '#FF5C9A',
    colorRgb: '255,45,120',
    gradient: 'from-idm-female/40 via-[#D9165E]/30 to-mid',
    badgeBg: 'bg-idm-female/15',
    badgeText: 'text-idm-female',
    badgeBorder: 'border-idm-female/25',
    iconBg: 'bg-idm-female/10 border-idm-female/25',
    ctaBg: 'bg-idm-female/10 border-idm-female/25 text-idm-female hover:bg-idm-female/20',
    statBg: 'bg-idm-female/[0.06] border-idm-female/10',
    hoverBorder: 'rgba(255,45,120,0.3)',
    hoverShadow: '0 8px 40px rgba(255,45,120,0.15)',
    patternOpacity: 'opacity-[0.04]',
  },
} as const;

/* ────────────────────────── Peserta TARKAM Modal ────────────────────────── */

interface TournamentParticipant {
  id: string;
  rank: number;
  gamertag: string;
  name: string;
  city: string;
  tier: string;
  avatar: string | null;
  points: number;
  clubName: string | null;
  clubLogo: string | null;
  seasonRank: number | null;
  status: 'approved' | 'pending';
}

type FilterTab = 'all' | 'approved' | 'pending';

function PesertaTarkamModal({
  open,
  onOpenChange,
  division,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  division: typeof DIVISION.male | typeof DIVISION.female;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['approved-players', division.key],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/approved-players?division=${division.key}`);
      if (!res.ok) throw new Error('Gagal memuat data');
      return res.json();
    },
    enabled: open,
    staleTime: 30000,
  });

  const participants: TournamentParticipant[] = data?.participants || [];
  const tournamentName = data?.tournamentName;
  const weekNumber = data?.weekNumber;
  const seasonName = data?.seasonName;
  const approvedCount = data?.counts?.approved || 0;
  const pendingCount = data?.counts?.pending || 0;
  const totalCount = data?.counts?.total || 0;

  // Filter by status tab + search query
  const filteredParticipants = useMemo(() => {
    let result = participants;
    // Filter by tab
    if (activeFilter === 'approved') result = result.filter(p => p.status === 'approved');
    if (activeFilter === 'pending') result = result.filter(p => p.status === 'pending');
    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(p =>
        p.gamertag.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.clubName && p.clubName.toLowerCase().includes(q))
      );
    }
    return result;
  }, [participants, activeFilter, searchQuery]);

  // Reset state when modal closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSearchQuery('');
      setActiveFilter('all');
    }
    onOpenChange(newOpen);
  };

  // Tier badge config
  const tierConfig: Record<string, { bg: string; text: string; border: string }> = {
    S: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/25' },
    A: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/25' },
    B: { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/25' },
  };

  // Approved participants for stats (always use all, not filtered)
  const approvedParticipants = participants.filter(p => p.status === 'approved');
  const topPlayer = approvedParticipants[0];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-xl p-0 overflow-hidden border-border/50 bg-background max-h-[90vh] flex flex-col">
        <DialogHeader className="sr-only">
          <DialogTitle>Peserta TARKAM</DialogTitle>
          <DialogDescription>Daftar peserta {division.title} — approved dan pending</DialogDescription>
        </DialogHeader>

        {/* ═══ Modal Header — Division gradient with mesh pattern ═══ */}
        <div className={`relative h-28 sm:h-32 bg-gradient-to-br ${division.key === 'male' ? 'from-idm-male via-idm-male/80 to-idm-male-light/60' : 'from-idm-female via-idm-female/80 to-idm-female-light/60'} overflow-hidden shrink-0`}>
          {/* Mesh pattern overlay */}
          <div className="absolute inset-0 opacity-[0.08]" style={{
            backgroundImage: `radial-gradient(circle, white 1px, transparent 1px)`,
            backgroundSize: '16px 16px',
          }} />
          {/* Top-down vignette */}
          <div className="absolute inset-0 bg-black/10" />
          {/* Decorative large icon watermark */}
          <Users className="absolute -right-4 -bottom-4 w-32 h-32 text-white/[0.08]" strokeWidth={0.5} />

          <div className="relative z-10 flex items-center justify-between h-full px-4 sm:px-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg shadow-black/10">
                <Users className="w-5.5 h-5.5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">Peserta TARKAM</h2>
                <p className="text-[10px] sm:text-[11px] text-white/70 font-medium">
                  {tournamentName ? `${tournamentName}` : division.title}
                  {weekNumber ? ` · W${weekNumber}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Count badges — approved + pending */}
              <div className="flex items-center gap-1.5">
                <div className="px-2 py-1 rounded-md bg-green-500/20 backdrop-blur-sm border border-green-400/25">
                  <span className="text-[10px] font-bold text-green-300 tabular-nums flex items-center gap-1">
                    <UserCheck className="w-2.5 h-2.5" />
                    {approvedCount}
                  </span>
                </div>
                {pendingCount > 0 && (
                  <div className="px-2 py-1 rounded-md bg-amber-500/20 backdrop-blur-sm border border-amber-400/25">
                    <span className="text-[10px] font-bold text-amber-300 tabular-nums flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {pendingCount}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => handleOpenChange(false)}
                aria-label="Tutup"
                className="w-8 h-8 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center hover:bg-black/40 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Bottom glow line */}
          <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: `linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.3) 30%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0.3) 70%, transparent 95%)` }} />
        </div>

        {/* ═══ Filter Tabs ═══ */}
        <div className="flex items-center gap-1 px-3 pt-3 pb-1">
          {([
            { key: 'all' as FilterTab, label: 'Semua', count: totalCount },
            { key: 'approved' as FilterTab, label: 'Approved', count: approvedCount },
            { key: 'pending' as FilterTab, label: 'Pending', count: pendingCount },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 cursor-pointer ${
                activeFilter === tab.key
                  ? 'bg-foreground/10 text-foreground border border-border/30 shadow-sm'
                  : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/30 border border-transparent'
              }`}
            >
              {tab.key === 'approved' && <UserCheck className="w-3 h-3 text-green-500" />}
              {tab.key === 'pending' && <Clock className="w-3 h-3 text-amber-500" />}
              {tab.key === 'all' && <Users className="w-3 h-3" />}
              <span>{tab.label}</span>
              <span className={`tabular-nums text-[9px] px-1.5 py-0.5 rounded-md ${
                activeFilter === tab.key
                  ? 'bg-foreground/10 text-foreground/70'
                  : 'bg-muted/30 text-muted-foreground/40'
              }`}>{tab.count}</span>
            </button>
          ))}
        </div>

        {/* ═══ Search bar ═══ */}
        {participants.length > 3 && (
          <div className="px-3 pb-1.5 pt-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
              <input
                type="text"
                placeholder="Cari peserta..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-muted/30 border border-border/30 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:border-transparent transition-all"
                style={{ '--tw-ring-color': division.color } as React.CSSProperties}
              />
            </div>
          </div>
        )}

        {/* ═══ Stats summary bar ═══ */}
        {topPlayer && (
          <div className="flex items-center gap-3 px-4 py-2 border-b border-border/20 bg-muted/10">
            <div className="flex items-center gap-1.5">
              <Medal className="w-3 h-3 text-idm-gold-warm" />
              <span className="text-[10px] font-semibold text-muted-foreground">Top Poin:</span>
              <span className="text-[10px] font-bold" style={{ color: division.color }}>{topPlayer.gamertag}</span>
              <span className="text-[10px] text-muted-foreground">({topPlayer.points} pts)</span>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <Users className="w-3 h-3 text-muted-foreground/50" />
              <span className="text-[10px] text-muted-foreground">{approvedParticipants.length} Peserta</span>
            </div>
          </div>
        )}

        {/* ═══ Modal Body — scrollable participant list ═══ */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
          {isLoading ? (
            /* Loading skeleton */
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/10 bg-muted/5 animate-pulse">
                  <div className="w-5 h-5 rounded-full bg-muted/20" />
                  <div className="w-10 h-10 rounded-xl bg-muted/20" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-24 rounded bg-muted/20" />
                    <div className="h-2 w-16 rounded bg-muted/15" />
                  </div>
                  <div className="h-5 w-16 rounded bg-muted/20" />
                </div>
              ))}
            </div>
          ) : filteredParticipants.length === 0 ? (
            /* Empty state */
            <div className="py-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted/10 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-muted-foreground/20" />
              </div>
              <p className="text-sm font-bold text-muted-foreground">
                {searchQuery ? 'Tidak ditemukan' : activeFilter === 'pending' ? 'Belum ada peserta pending' : 'Belum ada peserta'}
              </p>
              <p className="text-xs text-muted-foreground/50 mt-1.5 max-w-[200px] mx-auto">
                {searchQuery
                  ? `Tidak ada peserta yang cocok dengan "${searchQuery}"`
                  : activeFilter === 'pending'
                    ? 'Semua pendaftar sudah di-approve admin'
                    : 'Peserta yang mendaftar akan muncul di sini'
                }
              </p>
            </div>
          ) : (
            /* Participant list */
            <div className="space-y-1.5">
              {filteredParticipants.map((p, idx) => {
                const isApproved = p.status === 'approved';
                const isPending = p.status === 'pending';
                const tc = tierConfig[p.tier] || tierConfig.B;
                const avatarSrc = getAvatarUrl(p.gamertag, division.key as 'male' | 'female', p.avatar);
                const isTop3 = isApproved && p.rank <= 3;
                const rankDisplay = isApproved
                  ? (p.rank <= 3
                    ? p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : '🥉'
                    : `#${p.rank}`)
                  : '—';

                return (
                  <div
                    key={p.id}
                    className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-200 hover:scale-[1.005] active:scale-[0.995] cursor-default ${
                      isPending
                        ? 'border-amber-500/10 bg-amber-500/[0.02] hover:border-amber-500/20'
                        : isTop3
                          ? 'border-border/10'
                          : 'border-border/10 bg-muted/[0.02] hover:border-border/20'
                    }`}
                    style={isTop3 && isApproved ? {
                      borderColor: `rgba(${division.colorRgb},0.15)`,
                      backgroundColor: `rgba(${division.colorRgb},0.04)`,
                    } : undefined}
                  >
                    {/* Status indicator + Rank */}
                    <div className="flex flex-col items-center gap-0.5 w-7 shrink-0">
                      {isApproved ? (
                        <div className="w-4.5 h-4.5 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        </div>
                      ) : (
                        <div className="w-4.5 h-4.5 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                          <Clock className="w-2.5 h-2.5 text-amber-500" />
                        </div>
                      )}
                      <span className={`text-[9px] font-bold tabular-nums leading-none ${
                        isTop3 ? '' : 'text-muted-foreground/30'
                      }`} style={isTop3 ? { color: division.color } : undefined}>
                        {rankDisplay}
                      </span>
                    </div>

                    {/* Avatar */}
                    <div className={`relative w-10 h-10 rounded-xl overflow-hidden shrink-0 border ${
                      isPending
                        ? 'border-amber-500/20 opacity-70'
                        : isTop3
                          ? 'border-idm-gold-warm/30'
                          : 'border-border/20'
                    }`} style={isTop3 && isApproved ? {
                      boxShadow: `0 0 12px rgba(${division.colorRgb},0.15)`,
                    } : undefined}>
                      <Image
                        src={avatarSrc}
                        alt={p.gamertag}
                        fill
                        sizes="40px"
                        className="object-cover"
                        style={{ objectPosition: 'center 37%' }}
                        unoptimized
                      />
                      {/* Status dot overlay */}
                      {isApproved && (
                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-background" />
                      )}
                      {isPending && (
                        <div className="absolute inset-0 bg-amber-500/10" />
                      )}
                    </div>

                    {/* Player info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-xs sm:text-sm font-bold truncate ${isPending ? 'opacity-60' : ''}`}>{p.gamertag}</p>
                        {/* Tier badge */}
                        <span className={`inline-flex items-center justify-center w-4 h-4 rounded text-[8px] font-black ${tc.bg} ${tc.text} border ${tc.border}`}>
                          {p.tier}
                        </span>
                        {/* Status text badge — only for pending */}
                        {isPending && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                            <Clock className="w-2 h-2 text-amber-500" />
                            <span className="text-[8px] font-bold text-amber-500 uppercase tracking-wider">Pending</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {/* Club */}
                        {p.clubName ? (
                          <span className={`text-[9px] sm:text-[10px] text-muted-foreground/70 truncate flex items-center gap-0.5 ${isPending ? 'opacity-50' : ''}`}>
                            <Building2 className="w-2.5 h-2.5 shrink-0" />
                            {p.clubName}
                          </span>
                        ) : (
                          <span className={`text-[9px] sm:text-[10px] text-muted-foreground/40 truncate ${isPending ? 'opacity-50' : ''}`}>{p.city || p.name}</span>
                        )}
                      </div>
                    </div>

                    {/* Points */}
                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1">
                        <Star className={`w-3 h-3 ${isPending ? 'text-amber-500/50' : 'text-idm-gold-warm'}`} />
                        <span className={`text-xs sm:text-sm font-black tabular-nums ${isPending ? 'text-amber-600/60' : ''}`} style={isApproved ? { color: division.color } : undefined}>
                          {p.points}
                        </span>
                      </div>
                      <p className={`text-[8px] mt-0.5 ${isPending ? 'text-amber-500/40' : 'text-muted-foreground/50'}`}>PTS</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ═══ Footer ═══ */}
        {totalCount > 0 && (
          <div className="px-4 py-2.5 border-t border-border/20 bg-muted/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-muted-foreground/50">
                {seasonName || division.title}
              </span>
              <span className="text-[9px] text-muted-foreground/30">·</span>
              <span className="text-[9px] text-green-500/60 flex items-center gap-0.5">
                <svg className="w-2 h-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                {approvedCount} approved
              </span>
              {pendingCount > 0 && (
                <>
                  <span className="text-[9px] text-muted-foreground/30">·</span>
                  <span className="text-[9px] text-amber-500/60 flex items-center gap-0.5">
                    <Clock className="w-2 h-2" />
                    {pendingCount} pending
                  </span>
                </>
              )}
            </div>
            <span className="text-[9px] text-muted-foreground/50">
              {filteredParticipants.length} dari {totalCount}
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────── Tournament Card ────────────────────────── */
/* ─── Participants Modal ─── */
function ParticipantsModal({
  open,
  onOpenChange,
  division,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  division: typeof DIVISION.male | typeof DIVISION.female;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['tournament-participants', division.key],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/participants?division=${division.key}`);
      if (!res.ok) throw new Error('Gagal memuat data');
      return res.json();
    },
    enabled: open,
    staleTime: 30000,
  });

  const participants = data?.participants || [];
  const counts = data?.counts || { pending: 0, approved: 0, total: 0 };
  const tournamentName = data?.tournamentName;
  const weekNumber = data?.weekNumber;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg p-0 overflow-hidden border-border/50 bg-background max-h-[85vh] flex flex-col">
        <DialogHeader className="sr-only">
          <DialogTitle>Pendaftar Turnamen</DialogTitle>
          <DialogDescription>Daftar pemain yang mendaftar/daftar ulang turnamen {division.title}</DialogDescription>
        </DialogHeader>

        {/* Modal Header */}
        <div className={`relative h-16 bg-gradient-to-br ${division.key === 'male' ? 'from-idm-male via-idm-male/80 to-idm-male-light/60' : 'from-idm-female via-idm-female/80 to-idm-female-light/60'} overflow-hidden shrink-0`}>
          <div className="absolute inset-0 bg-black/10" />
          <div className="relative z-10 flex items-center justify-between h-full px-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <Users className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Pendaftar Turnamen</h2>
                <p className="text-[10px] text-white/70">{tournamentName ? `${tournamentName} • W${weekNumber}` : division.title}</p>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              aria-label="Tutup"
              className="compact-pill w-8 h-8 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center hover:bg-black/40 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Count pills */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/30 bg-muted/20">
          <Badge className="bg-blue-500/15 text-blue-400 border-0 text-[9px] gap-1"><Clock className="w-2.5 h-2.5" />{counts.pending} Pending</Badge>
          <Badge className="bg-green-500/15 text-green-400 border-0 text-[9px] gap-1"><UserCheck className="w-2.5 h-2.5" />{counts.approved} Approved</Badge>
          <Badge className="bg-muted/30 text-muted-foreground border-0 text-[9px] ml-auto">{counts.total} Total</Badge>
        </div>

        {/* Modal Body — scrollable */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
          {isLoading ? (
            <div className="py-10 text-center">
              <div className="animate-spin-slow inline-block mb-3">
                <Users className={`w-8 h-8 ${division.key === 'male' ? 'text-idm-male' : 'text-idm-female'}`} />
              </div>
              <p className="text-sm text-muted-foreground">Memuat data peserta...</p>
            </div>
          ) : participants.length === 0 ? (
            <div className="py-10 text-center">
              <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-semibold text-muted-foreground">Belum ada pendaftar</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Belum ada pemain yang mendaftar atau daftar ulang</p>
            </div>
          ) : (
            <div className="space-y-1">
              {participants.map((p: { id: string; gamertag: string; name: string; city: string; status: string; tier: string; createdAt: string }, idx: number) => {
                const isPending = p.status === 'pending';
                const isApproved = p.status === 'approved';
                return (
                  <div key={p.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border ${
                    isPending ? 'border-blue-500/15 bg-blue-500/[0.03]' :
                    `border-green-500/10 bg-green-500/[0.03]`
                  }`}>
                    {/* Number */}
                    <span className="text-[10px] font-bold text-muted-foreground/50 w-5 text-right tabular-nums">{idx + 1}</span>
                    {/* Avatar placeholder */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isPending ? 'bg-blue-500/10 text-blue-400' :
                      'bg-green-500/10 text-green-400'
                    }`}>
                      {p.gamertag.charAt(0).toUpperCase()}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{p.gamertag}</p>
                      <p className="text-[9px] text-muted-foreground truncate">{p.name}{p.city ? ` • ${p.city}` : ''}</p>
                    </div>
                    {/* Status badge */}
                    <Badge className={`${
                      isPending ? 'bg-blue-500/15 text-blue-400' :
                      'bg-green-500/15 text-green-400'
                    } border-0 text-[8px] shrink-0`}>
                      {isPending ? 'Pending' : 'Approved'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────── Tournament Card ────────────────────────── */
function TournamentCard({
  division,
  data,
  cmsSections,
  cmsSettings,
  onEnterApp,
  onRegister,
  onDonate,
  onVideoPlay,
  onViewBracket,
  isRegOpen,
}: {
  division: typeof DIVISION.male | typeof DIVISION.female;
  data: StatsData | undefined;
  cmsSections: Record<string, any>;
  cmsSettings?: Record<string, string>;
  onEnterApp: (division: 'male' | 'female') => void;
  onRegister: (division: 'male' | 'female') => void;
  onDonate: (division: 'male' | 'female') => void;
  onVideoPlay?: (url: string, title: string) => void;
  onViewBracket?: (division: 'male' | 'female') => void;
  isRegOpen?: boolean;
}) {
  const Icon = division.icon;
  // Show current running week (not completed count) — e.g. "Week 2" when week 2 is active
  const currentWeek = data?.activeTournament?.weekNumber || (data?.seasonProgress?.completedWeeks ? data.seasonProgress.completedWeeks + 1 : 0);
  const totalPlayers = data?.totalPlayers || 0;
  const totalClubs = data?.clubs?.length || 0;
  const totalMatches = data?.recentMatches?.length || 0;

  /* ─── Participants modal state + count query ─── */
  const [participantsModalOpen, setParticipantsModalOpen] = useState(false);
  const [pesertaTarkamModalOpen, setPesertaTarkamModalOpen] = useState(false);
  const { data: pesertaCountData } = useQuery({
    queryKey: ['peserta-tarkam-count', division.key],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/approved-players?division=${division.key}`);
      if (!res.ok) throw new Error('Gagal memuat data');
      return res.json();
    },
    staleTime: 60000,
    select: (d: any) => ({
      approved: d.counts?.approved ?? 0,
      pending: d.counts?.pending ?? 0,
      total: d.counts?.total ?? 0,
    }),
  });
  const pesertaCounts = pesertaCountData ?? { approved: 0, pending: 0, total: 0 };
  // PrizePool: use per-tournament prize pool (resets each week), fallback to season aggregate
  // Uses ?? (not ||) so that activeTournamentPrizePool=0 (week completed, no new week yet)
  // is respected as a valid value and does NOT fall through to the season aggregate.
  const prizePool = data?.activeTournamentPrizePool ?? (division.key === 'female'
    ? (data?.femalePrizePool || data?.totalPrizePool || 0)
    : (data?.malePrizePool || data?.totalPrizePool || 0));

  // Check if registration is open for this division
  // Priority: 1) Full stats data (most accurate), 2) Fast tournament-status prop (fallback during loading)
  // This prevents the button from being disabled while the heavy /api/stats is still loading
  const tournamentStatus = data?.activeTournament?.status;
  const isRegistrationOpen = tournamentStatus === 'registration' || tournamentStatus === 'approval' || isRegOpen || false;

  // CMS text fields with fallbacks
  const cardTitle = cmsSettings?.[`kompetisi_${division.key}_title`] || division.title;
  const cardBadge = cmsSettings?.[`kompetisi_${division.key}_badge`] || 'Weekly Tournament';
  const cardFormat = cmsSettings?.[`kompetisi_${division.key}_format`] || 'Bracket elimination — 1 tim, 3 pemain';
  const cardDescription = cmsSettings?.[`kompetisi_${division.key}_description`] ||
    `Turnamen mingguan dengan format bracket elimination. Peserta tarkam ${division.key === 'male' ? 'putra' : 'putri'} bertanding setiap minggu. Juara weekly berhak atas prize pool dan gelar champion.`;

  // Video URL extraction
  const videoUrl =
    cmsSettings?.[`kompetisi_${division.key}_video_url`] ||
    cmsSections.kompetisi?.cards?.find(
      (c: { division?: string; videoUrl?: string }) => c.division === division.key && c.videoUrl
    )?.videoUrl;

  // Check if tournament is currently in progress for animated border glow
  const isLiveTournament = data?.activeTournament?.status === 'in_progress';

  return (
    <div
      className={`group tournament-card-tilt ios-tournament-card relative overflow-hidden backdrop-blur-md bg-white/[0.03] dark:bg-white/[0.05] border border-white/[0.06] dark:border-white/[0.08] transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_8px_40px_rgba(0,0,0,0.15)] active:scale-[0.995] ${isLiveTournament ? 'ring-1' : ''}`}
      style={
        {
          '--division-color': division.color,
          '--division-color-rgb': division.colorRgb,
          // Glassmorphism: removed solid bg gradient, using transparent glass bg above instead
          ...(isLiveTournament ? { boxShadow: `0 0 20px rgba(${division.colorRgb},0.15), 0 4px 30px rgba(0,0,0,0.2)`, ringColor: `rgba(${division.colorRgb},0.3)` } : {}),
        } as React.CSSProperties
      }
    >
      {/* ═══ iOS-style gold accent line at top ═══ */}
      <div className="ios-gold-line" aria-hidden="true" />
      {/* ═══ Animated border glow for active tournament ═══ */}
      {isLiveTournament && (
        <>
          <div className="absolute inset-0 rounded-[inherit] pointer-events-none z-0" aria-hidden="true" style={{ boxShadow: `inset 0 0 12px rgba(${division.colorRgb},0.1)` }} />
          {/* Animated gradient border — rotating conic gradient for live feel */}
          <div className="absolute -inset-[1.5px] rounded-[inherit] pointer-events-none z-0 overflow-hidden" aria-hidden="true">
            <div className="absolute inset-[-50%] w-[200%] h-[200%]" style={{
              background: `conic-gradient(from 0deg, rgba(${division.colorRgb},0.5), rgba(239,249,35,0.3), rgba(${division.colorRgb},0.5), transparent, rgba(${division.colorRgb},0.5))`,
              animation: 'agb-rotate 3s linear infinite',
            }} />
          </div>
        </>
      )}
      {/* ── Image Area ── */}
      <div className={`relative h-40 sm:h-52 overflow-hidden tournament-header-mesh ${division.key === 'male' ? 'tournament-header-mesh-male' : 'tournament-header-mesh-female'}`}>
        {/* Pattern overlay */}
        <div
          className={`absolute inset-0 ${division.patternOpacity}`}
          style={{
            backgroundImage: `radial-gradient(circle, ${division.color} 1px, transparent 1px)`,
            backgroundSize: '20px 20px',
          }}
        />

        {/* Large watermark icon */}
        <Icon
          className="absolute -right-6 -bottom-6 w-40 h-40 text-white/[0.04] tournament-watermark-float"
          strokeWidth={0.5}
        />

        {/* Decorative grid lines */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(${division.color} 1px, transparent 1px), linear-gradient(90deg, ${division.color} 1px, transparent 1px)`,
            backgroundSize: '30px 30px',
          }}
        />

        {/* Badge overlay — top left */}
        <div className="absolute top-4 left-4 z-10">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${division.badgeBg} border ${division.badgeBorder}`}
          >
            {/* Pulsing LIVE indicator when tournament is active */}
            {(data?.activeTournament?.status === 'in_progress') && (
              <span className="relative flex h-2 w-2 mr-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
            )}
            <Swords className="w-3 h-3 text-idm-gold-warm" />
            <span className={`text-[10px] font-bold uppercase tracking-wider ${division.badgeText}`}>
              {cardBadge}
            </span>
            {(data?.activeTournament?.status === 'in_progress') && (
              <span className="text-[9px] font-black text-red-400 animate-pulse uppercase">LIVE</span>
            )}
          </div>
        </div>

        {/* Tournament count — top right */}
        <div className="absolute top-4 right-4 z-10">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-foreground/5 dark:bg-black/50 border border-border/40">
            <Gamepad2 className="w-3 h-3 text-idm-gold-warm" />
            <span className="text-[10px] font-bold text-foreground/80">
              {currentWeek > 0 ? `Week ${currentWeek}` : 'TBA'}
            </span>
          </div>
        </div>

        {/* Video play button — premium pulsing design */}
        {videoUrl && onVideoPlay && (
          <button
            onClick={() => onVideoPlay(videoUrl, cardTitle)}
            className="absolute bottom-4 right-4 z-10 group/play cursor-pointer"
            aria-label={`Play ${division.title} video`}
          >
            {/* Outer pulsing ring */}
            <span className="absolute inset-0 rounded-full play-btn-pulse-ring" style={{ background: `rgba(${division.colorRgb},0.25)` }} />
            {/* Mid glow */}
            <span className="absolute -inset-1.5 rounded-full play-btn-pulse-glow" style={{ background: `radial-gradient(circle, rgba(${division.colorRgb},0.2) 0%, transparent 70%)` }} />
            {/* Button body */}
            <span className="relative flex items-center justify-center w-11 h-11 rounded-full backdrop-blur-sm border transition-all duration-300 group-hover/play:scale-110 group-hover/play:border-idm-gold-warm/50"
              style={{
                background: `linear-gradient(135deg, rgba(${division.colorRgb},0.25) 0%, rgba(0,0,0,0.7) 100%)`,
                borderColor: `rgba(${division.colorRgb},0.35)`,
                boxShadow: `0 0 20px rgba(${division.colorRgb},0.15), inset 0 1px 0 rgba(255,255,255,0.1)`,
              }}
            >
              <Play className="w-4 h-4 text-idm-gold-warm dark:text-white fill-idm-gold-warm dark:fill-white ml-0.5 drop-shadow-[0_0_4px_rgba(239,249,35,0.3)] dark:drop-shadow-[0_0_4px_rgba(255,255,255,0.4)]" />
            </span>
            {/* Label tooltip on hover */}
            <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-wider text-foreground dark:text-white/80 bg-background/90 dark:bg-black/70 border border-border/20 dark:border-0 px-2 py-0.5 rounded whitespace-nowrap opacity-0 group-hover/play:opacity-100 transition-opacity duration-200 pointer-events-none"
              style={{ backdropFilter: 'blur(4px)' }}
            >
              Watch Video
            </span>
          </button>
        )}

        {/* Gradient overlay at bottom — smoother blend into card body */}
        <div className="absolute inset-x-0 bottom-0 h-28" style={{ background: 'linear-gradient(to top, var(--bg-mid), transparent)' }} />

        {/* Division glow line at header bottom — content area accent */}
        <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: `linear-gradient(90deg, transparent 5%, rgba(${division.colorRgb},0.3) 30%, rgba(${division.colorRgb},0.5) 50%, rgba(${division.colorRgb},0.3) 70%, transparent 95%)` }} />

        {/* Subtle shine sweep on hover */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(105deg, transparent 40%, rgba(${division.colorRgb},0.05) 45%, rgba(${division.colorRgb},0.1) 50%, rgba(${division.colorRgb},0.05) 55%, transparent 60%)`,
              transform: 'translateX(-100%)',
              animation: 'card-shine-sweep 1.5s ease-in-out forwards',
            }}
          />
        </div>
      </div>

      {/* ── Content Area ── */}
      <div className="p-4 sm:p-6">
        {/* Icon + Title row — iOS clean hierarchy */}
        <div className="flex items-center gap-3 mb-3">
          <div
            className={`w-10 h-10 rounded-xl ${division.iconBg} flex items-center justify-center shrink-0`}
            style={{ boxShadow: `0 0 20px rgba(${division.colorRgb},0.1)` }}
          >
            <Icon className="w-5 h-5 tournament-icon-pulse" style={{ color: division.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg sm:text-xl font-extrabold text-foreground dark:text-white truncate ios-heading">{cardTitle}</h3>
            <p className="text-[11px] font-light text-muted-foreground dark:text-[#a09880]">{cardFormat}</p>
          </div>
          {/* List Peserta CTA — shows approved + pending count */}
          {pesertaCounts.total > 0 && (
            <button
              onClick={() => setPesertaTarkamModalOpen(true)}
              className="compact-pill shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/30 bg-muted/20 text-[10px] font-semibold text-muted-foreground hover:text-idm-gold-warm hover:border-idm-gold-warm/30 hover:bg-idm-gold-warm/5 transition-all cursor-pointer active:scale-95"
              title="Lihat list peserta"
            >
              <Users className="w-3 h-3" />
              <span className="tabular-nums">{pesertaCounts.approved}</span>
              {pesertaCounts.pending > 0 && (
                <span className="text-amber-500 tabular-nums">+{pesertaCounts.pending}</span>
              )}
              <span className="hidden sm:inline">Peserta</span>
            </button>
          )}
        </div>

        {/* Description — iOS lighter secondary text */}
        <p className="text-sm font-light text-muted-foreground/80 dark:text-[#a09880] leading-relaxed mb-4">
          {cardDescription}
        </p>

        {/* Info row — Date/Time, Arena, BPM (like dashboard hero) */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 mb-4">
          <div className="ios-card relative p-2 sm:p-3 text-center tournament-stat-item tournament-stat-separator overflow-hidden" style={{ background: `linear-gradient(135deg, rgba(${division.colorRgb},0.06) 0%, rgba(${division.colorRgb},0.02) 100%)`, borderColor: `rgba(${division.colorRgb},0.1)` }}>
            <Calendar className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 opacity-[0.06]" style={{ color: division.color }} />
            <p className="relative text-xs sm:text-sm font-bold tabular-nums" style={{ color: division.color }}>
              {data?.activeTournament?.scheduledAt ? formatWIBWeekdayShort(parseWitaDate(data.activeTournament.scheduledAt)!) : '–'}
            </p>
            <p className="relative text-[9px] sm:text-[10px] text-muted-foreground dark:text-[#a09880] flex items-center justify-center gap-1 mt-0.5">
              <Clock className="w-2.5 h-2.5" />
              {data?.activeTournament?.scheduledAt ? formatWIBTime(parseWitaDate(data.activeTournament.scheduledAt)!) : 'TBA'}
            </p>
          </div>
          <div className="ios-card relative p-2 sm:p-3 text-center tournament-stat-item tournament-stat-separator overflow-hidden" style={{ background: `linear-gradient(135deg, rgba(${division.colorRgb},0.06) 0%, rgba(${division.colorRgb},0.02) 100%)`, borderColor: `rgba(${division.colorRgb},0.1)` }}>
            <MapPin className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 opacity-[0.06]" style={{ color: division.color }} />
            <p className="relative text-xs sm:text-sm font-bold" style={{ color: division.color }}>
              {data?.activeTournament?.location || 'Online'}
            </p>
            <p className="relative text-[9px] sm:text-[10px] text-muted-foreground dark:text-[#a09880] flex items-center justify-center gap-1 mt-0.5">
              <MapPin className="w-2.5 h-2.5" />
              Arena
            </p>
          </div>
          <div className="ios-card relative p-2 sm:p-3 text-center tournament-stat-item overflow-hidden" style={{ background: `linear-gradient(135deg, rgba(${division.colorRgb},0.06) 0%, rgba(${division.colorRgb},0.02) 100%)`, borderColor: `rgba(${division.colorRgb},0.1)` }}>
            <Heart className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 opacity-[0.06]" style={{ color: division.color }} />
            <p className="relative text-xs sm:text-sm font-bold tabular-nums" style={{ color: division.color }}>
              {data?.activeTournament?.bpm || '–'}
            </p>
            <p className="relative text-[9px] sm:text-[10px] text-muted-foreground dark:text-[#a09880] flex items-center justify-center gap-1 mt-0.5">
              <Heart className="w-2.5 h-2.5" />
              BPM
            </p>
          </div>
        </div>

        {/* Prize pool highlight — iOS frosted glass */}
        {prizePool > 0 && (
          <div className="ios-card flex items-center gap-2 mb-4 px-3 py-2" style={{ background: 'rgba(239,249,35,0.06)', borderColor: 'rgba(239,249,35,0.1)' }}>
            <Crown className="w-3.5 h-3.5 text-idm-gold-warm" />
            <span className="text-[11px] text-muted-foreground dark:text-[#a09880]">Prize Pool</span>
            <span className="text-sm font-bold text-gradient-champion ml-auto">
              {formatCurrency(prizePool)}
            </span>
          </div>
        )}

        {/* Season Progress — compact timeline inside division card */}
        {data?.seasonProgress && (() => {
          const { totalWeeks, completedWeeks, percentage } = data.seasonProgress;
          const curWeek = data?.activeTournament?.weekNumber || (completedWeeks + 1);
          const hasActive = curWeek <= totalWeeks && curWeek > completedWeeks;
          // Phase config — use actual tournament status when available
          const tournamentStatus = data?.activeTournament?.status;
          const phase = (() => {
            // If we have an active tournament, use its actual status
            if (tournamentStatus === 'registration' || tournamentStatus === 'approval') return 'registration';
            if (tournamentStatus === 'in_progress') return 'competition';
            if (tournamentStatus === 'completed') return 'competition';
            // Fallback: infer from week number
            if (curWeek <= 2) return 'registration';
            if (curWeek <= totalWeeks - 2) return 'competition';
            return 'playoffs';
          })();
          const phaseCfg = {
            registration: { label: 'Registrasi', Icon: Flag, bg: 'bg-blue-500/10', text: 'text-blue-400' },
            competition: { label: 'Kompetisi', Icon: Zap, bg: 'bg-green-500/10', text: 'text-green-400' },
            playoffs: { label: 'Playoff', Icon: Target, bg: 'bg-amber-500/10', text: 'text-amber-400' },
          }[phase];
          const PhaseIcon = phaseCfg.Icon;
          return (
            <div className="mt-4 pt-3 pb-4 border-t border-border/10">
              {/* Header: season name + phase badge */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  <span className="font-semibold text-foreground/80">{data.season?.name || `Season ${data.season?.number || ''}`}</span>
                </span>
                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full ${phaseCfg.bg} ${phaseCfg.text}`}>
                  <PhaseIcon className="w-2.5 h-2.5" />
                  <span className="text-[8px] font-bold uppercase tracking-wider">{phaseCfg.label}</span>
                </div>
              </div>
              {/* Week timeline bars */}
              <div className="flex items-center gap-1 mb-1.5">
                {Array.from({ length: totalWeeks }, (_, i) => {
                  const wn = i + 1;
                  const done = wn <= completedWeeks;
                  const active = wn === curWeek && hasActive;
                  return (
                    <div key={wn} className="flex-1 flex flex-col items-center gap-0.5">
                      <div className="relative w-full h-1.5 rounded-full overflow-hidden bg-muted/15">
                        {done && (
                          <div className="absolute inset-0 rounded-full transition-all duration-500" style={{ background: `linear-gradient(90deg, ${division.color}, ${division.color}cc)` }} />
                        )}
                        {active && (
                          <div className="absolute inset-0 rounded-full animate-pulse" style={{ backgroundColor: `${division.color}40` }} />
                        )}
                      </div>
                      <span className={`text-[7px] font-medium tabular-nums ${
                        done ? '' : active ? 'font-bold' : 'text-muted-foreground/30'
                      }`} style={done || active ? { color: division.color } : undefined}>
                        {wn}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* Stats row */}
              <div className="flex items-center justify-between text-[9px]">
                <span className="text-muted-foreground">
                  <span className="font-bold" style={{ color: division.color }}>{completedWeeks}</span>/{totalWeeks} minggu
                  {hasActive && <> · Minggu <span className="font-bold" style={{ color: division.color }}>{curWeek}</span></>}
                </span>
                <span className="font-bold tabular-nums" style={{ color: division.color }}>{percentage}%</span>
              </div>
            </div>
          );
        })()}

        {/* CTA buttons — Daftar+Sawer in one row, Peserta TARKAM + Lihat Hasil below */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => isRegistrationOpen && onRegister(division.key)}
              disabled={!isRegistrationOpen}
              className={`flex-1 py-2.5 min-h-[40px] sm:min-h-[44px] rounded-xl sm:rounded-2xl border text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-1.5 sm:gap-2 relative overflow-hidden ${
                isRegistrationOpen
                  ? `tournament-cta-secondary cursor-pointer ${division.ctaBg}`
                  : 'bg-gray-500/10 border-gray-500/20 text-gray-500 cursor-not-allowed opacity-60'
              }`}
              title={isRegistrationOpen ? 'Daftar sekarang' : 'Pendaftaran belum dibuka'}
            >
              <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>{isRegistrationOpen ? 'Daftar' : 'Belum Buka'}</span>
            </button>
            <button
              onClick={() => onDonate(division.key)}
              className={`flex-1 py-2.5 min-h-[40px] sm:min-h-[44px] rounded-xl sm:rounded-2xl border text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer active:scale-[0.98] ${division.ctaBg}`}
              title="Sawer untuk prize pool"
            >
              <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Sawer</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPesertaTarkamModalOpen(true)}
              className="flex-1 py-2.5 min-h-[40px] sm:min-h-[44px] rounded-xl sm:rounded-2xl text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer active:scale-[0.98] relative overflow-hidden border"
              style={{
                background: `linear-gradient(135deg, rgba(${division.colorRgb},0.12) 0%, rgba(${division.colorRgb},0.05) 100%)`,
                borderColor: `rgba(${division.colorRgb},0.25)`,
                color: division.color,
                boxShadow: `0 2px 12px rgba(${division.colorRgb},0.08)`,
              }}
              title="Lihat daftar peserta TARKAM"
            >
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Peserta TARKAM</span>
              <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-60" />
            </button>
            <button
              onClick={() => onViewBracket?.(division.key)}
              className="compact-pill py-2.5 min-h-[40px] sm:min-h-[44px] px-4 rounded-xl sm:rounded-2xl border border-border/20 text-xs sm:text-sm font-semibold transition-all duration-300 cursor-pointer flex items-center justify-center gap-1.5 hover:opacity-80 active:scale-[0.98] text-white"
            >
              <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
              <span className="hidden sm:inline text-white">Lihat Hasil</span>
            </button>
          </div>
        </div>
      </div>

      {/* Participants Modal */}
      <ParticipantsModal
        open={participantsModalOpen}
        onOpenChange={setParticipantsModalOpen}
        division={division}
      />

      {/* Peserta TARKAM Modal */}
      <PesertaTarkamModal
        open={pesertaTarkamModalOpen}
        onOpenChange={setPesertaTarkamModalOpen}
        division={division}
      />
    </div>
  );
}

/* ────────────────────────── Main Component ────────────────────────── */
export function TournamentHub({
  maleData,
  femaleData,
  cmsSections,
  cmsSettings,
  onEnterApp,
  onRegister,
  onDonate,
  onVideoPlay,
  onViewBracket,
  maleRegOpen,
  femaleRegOpen,
}: TournamentHubProps) {
  // CMS text fields with fallbacks
  const sectionLabel = cmsSettings?.kompetisi_label || 'Kompetisi';
  const sectionTitle = cmsSettings?.kompetisi_title || 'Tarkam Arena';
  const sectionSubtitle = cmsSettings?.kompetisi_subtitle || 'Weekly tournament setiap minggu — pilih tarkammu dan langsung bertanding di arena kompetisi IDM';


  return (
    <section
      id="kompetisi"
      role="region"
      aria-label={sectionLabel}
      className="landing-section relative py-6 sm:py-12 px-4 sm:px-6 lg:px-8 overflow-hidden bg-deep border-t border-border/10 dark:border-t-0"
    >
      {/* ── Top edge glow — section boundary ── */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-idm-gold-warm/30 to-transparent" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-idm-gold-warm/3 to-transparent pointer-events-none" aria-hidden="true" />

      {/* ── Background ── */}
      {/* Gold dot pattern overlay — parallax section bg */}
      <div
        className="absolute inset-0 opacity-[0.025] parallax-section-bg"
        style={{
          backgroundImage: 'radial-gradient(circle, #EFF923 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      {/* Subtle radial glow at center top — parallax section bg */}
      <div
        className="absolute inset-0 parallax-section-bg"
        style={{
          background:
            'radial-gradient(ellipse at 50% 20%, rgba(239,249,35,0.04) 0%, transparent 60%)',
        }}
      />
      {/* Bilateral division atmosphere */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 20% 50%, rgba(46,159,255,0.03) 0%, transparent 50%), radial-gradient(ellipse at 80% 50%, rgba(255,45,120,0.03) 0%, transparent 50%)',
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* ── Section Header ── */}
        <AnimatedSection>
          <SectionHeader
            icon={Swords}
            label={sectionLabel}
            title={sectionTitle}
            subtitle={sectionSubtitle}
          />
        </AnimatedSection>

        {/* ── Tournament Cards Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          {/* Male Tarkam */}
          <AnimatedSection variant="fadeLeft">
            <TournamentCard
              division={DIVISION.male}
              data={maleData}
              cmsSections={cmsSections}
              cmsSettings={cmsSettings}
              onEnterApp={onEnterApp}
              onRegister={onRegister}
              onDonate={onDonate}
              onVideoPlay={onVideoPlay}
              onViewBracket={onViewBracket}
              isRegOpen={maleRegOpen}
            />
          </AnimatedSection>

          {/* Female Tarkam */}
          <AnimatedSection variant="fadeRight">
            <TournamentCard
              division={DIVISION.female}
              data={femaleData}
              cmsSections={cmsSections}
              cmsSettings={cmsSettings}
              onEnterApp={onEnterApp}
              onRegister={onRegister}
              onDonate={onDonate}
              onVideoPlay={onVideoPlay}
              onViewBracket={onViewBracket}
              isRegOpen={femaleRegOpen}
            />
          </AnimatedSection>
        </div>


      </div>


    </section>
  );
}
