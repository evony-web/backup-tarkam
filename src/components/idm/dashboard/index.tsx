'use client';

import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/lib/store';
/* framer-motion removed — using CSS animations for performance */
import Image from 'next/image';
import {
  Heart, MapPin, Trophy, Flame,
  Shield, Music, Zap,
  Gift, BookOpen,
  Calendar, Clock, Crown, Star,
  Search, Target, Swords, Play, CheckCircle2, XCircle, Users,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  CasinoHeroSkeleton,
  StatsRowSkeleton,
  TableSkeleton,
} from '../ui/skeleton';
import { PlayerProfile } from '../player-profile';
import { ClubProfile } from '../club-profile';

import { StatusBadge } from '../status-badge';
import { ShareButton } from '../ui/share-button';
import { SkinBadgesRow, SkinName } from '../skin-renderer';
import { getPrimarySkin } from '@/lib/skin-utils';
import React, { useState, useRef, useEffect } from 'react';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { useBackgroundImages } from '@/hooks/use-background-images';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatCurrency, formatCurrencyShort, clubToString, parseWitaDate, toStrictDivision, formatWIBWeekdayShort, formatWIBTime } from '@/lib/utils';
import type { StatsData } from '@/types/stats';

import { NoSeasonState } from './no-season-state';
import { NoTournamentState } from './no-tournament-state';
import { OverviewTab } from './overview-tab';
import { StandingsTab } from './standings-tab';
import { MatchesTab } from './matches-tab';
import { DonationModal } from '../donation-modal';
import { ActivityFeed } from '../activity-feed';

import { QuickStatsBar } from './quick-stats-bar';
import { TopDonorsWidget } from './top-donors-widget';
import { DivisionRivalryWidget } from './division-rivalry-widget';
import { LiveMatchCounter } from './live-match-counter';
import { LiveMatchIndicator } from './live-match-indicator';
import { StreakWidget } from './streak-widget';
import { TopPlayersSection } from './top-players-section';
import { DanceMatchCard } from '../match-card';

/* ─── Tournament Progress Steps ─── */
function TournamentProgress({ status }: { status: string }) {
  const dt = useDivisionTheme();
  const steps = [
    { key: 'setup', label: 'Setup' },
    { key: 'registration', label: 'Daftar' },
    { key: 'approval', label: 'Approval' },
    { key: 'team_generation', label: 'Tim' },
    { key: 'bracket_generation', label: 'Bracket' },
    { key: 'main_event', label: 'Main' },
    { key: 'finalization', label: 'Final' },
    { key: 'completed', label: 'Selesai' },
  ];
  const currentIdx = steps.findIndex(s => s.key === status);

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto pb-1 scrollbar-none">
      {steps.map((step, idx) => {
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <div key={step.key} className="flex items-center">
            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-semibold whitespace-nowrap ${
              isDone ? `${dt.bgSubtle} ${dt.neonText}` :
              isCurrent ? `${dt.bg} ${dt.text} ${dt.neonPulse}` :
              'bg-muted/30 text-muted-foreground/50'
            }`}>
              {isDone ? <CheckCircle2 className="w-2.5 h-2.5" /> :
               isCurrent ? <Play className="w-2.5 h-2.5" /> :
               <div className="w-2.5 h-2.5 rounded-full border border-current opacity-30" />}
              <span className="hidden sm:inline">{step.label}</span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`w-2 h-0.5 ${isDone ? dt.neonText : 'bg-muted/30'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Status Badge for tournament overview ─── */
function OverviewStatusBadge({ status, division }: { status: string; division: string }) {
  const config: Record<string, { label: string; class: string }> = {
    setup: { label: 'Setup', class: 'bg-muted/30 text-muted-foreground' },
    registration: { label: 'Pendaftaran', class: 'bg-blue-500/15 text-blue-400' },
    approval: { label: 'Approval', class: 'bg-yellow-500/15 text-yellow-400' },
    team_generation: { label: 'Tim Dibentuk', class: 'bg-orange-500/15 text-orange-400' },
    bracket_generation: { label: 'Bracket', class: 'bg-purple-500/15 text-purple-400' },
    main_event: { label: 'Main Event', class: 'bg-idm-gold-warm/15 text-idm-gold-warm' },
    finalization: { label: 'Finalisasi', class: 'bg-amber-500/15 text-amber-400' },
    completed: { label: 'Selesai', class: 'bg-green-500/15 text-green-400' },
  };
  const c = config[status] || config.setup;
  return <Badge className={`${c.class} border-0 text-[9px] gap-0.5`}>{c.label}</Badge>;
}

/* ─── Round Label Helper ─── */
function getRoundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return 'Grand Final';
  if (fromEnd === 1) return 'Semi Final';
  if (fromEnd === 2) return 'Quarter Final';
  return `Ronde ${round}`;
}

/* ─── Main Dashboard Component ─── */
export function Dashboard() {
  const { division, initialDashboardTab, setInitialDashboardTab, playerAuth } = useAppStore();
  const dt = useDivisionTheme();
  const isMobile = useIsMobile();
  const { bgMale, bgFemale } = useBackgroundImages();

  const [selectedPlayer, setSelectedPlayer] = useState<StatsData['topPlayers'][0] | null>(null);
  const [selectedClub, setSelectedClub] = useState<StatsData['clubs'][0] | null>(null);
  const [donationOpen, setDonationOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    return initialDashboardTab || 'overview';
  });

  // Tour Saya search state — integrated into Beranda tab
  const [searchName, setSearchName] = useState(() => (playerAuth.isAuthenticated && playerAuth.account ? playerAuth.account.player.gamertag : ''));
  const [submittedName, setSubmittedName] = useState('');
  const [showAllMatches, setShowAllMatches] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-fill search with logged-in player
  const loggedInGamertag = playerAuth.isAuthenticated && playerAuth.account ? playerAuth.account.player.gamertag : null;
  const loggedInSkins = playerAuth.isAuthenticated && playerAuth.account ? playerAuth.account.skins : undefined;

  // Clear the initialDashboardTab once consumed
  React.useEffect(() => {
    if (initialDashboardTab) {
      setActiveTab(initialDashboardTab);
      const timer = setTimeout(() => setInitialDashboardTab(null), 100);
      return () => clearTimeout(timer);
    }
  }, [initialDashboardTab, setInitialDashboardTab]);

  const { data, isLoading } = useQuery<StatsData>({
    queryKey: ['stats', division],
    queryFn: async () => {
      const res = await fetch(`/api/stats?division=${division}`);
      return res.json();
    },
  });

  // Also fetch the OTHER division's data for the unified Peringkat tab
  const otherDivision = division === 'male' ? 'female' : 'male';
  const { data: otherDivisionData } = useQuery<StatsData>({
    queryKey: ['stats', otherDivision],
    queryFn: async () => {
      const res = await fetch(`/api/stats?division=${otherDivision}`);
      return res.json();
    },
    // Don't refetch as aggressively — this is secondary data
    staleTime: 120000,
    refetchInterval: 120000,
  });

  // CMS settings for donation modal
  const { data: cms } = useQuery<Record<string, string>>({
    queryKey: ['cms-content'],
    queryFn: async () => {
      const res = await fetch('/api/cms/content');
      if (!res.ok) return { settings: {}, sections: {} };
      return res.json();
    },
    select: (data) => data.settings || {},
  });

  /* ─── Tournament Overview query — for integrated Tour Saya ─── */
  const { data: overview } = useQuery({
    queryKey: ['tournament-overview', division],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/overview?division=${division}`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  /* ─── My-status query — only when searching ─── */
  const { data: myStatus, isLoading: myStatusLoading, error: myStatusError } = useQuery({
    queryKey: ['my-tournament-status', submittedName, division],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/my-status?name=${encodeURIComponent(submittedName)}&division=${division}&gamertag=${encodeURIComponent(submittedName)}`);
      if (!res.ok) throw new Error('Gagal mengambil data');
      return res.json();
    },
    enabled: !!submittedName,
    refetchInterval: 30000,
  });

  const handleSearch = () => {
    if (!searchName.trim()) return;
    setSubmittedName(searchName.trim());
    setShowAllMatches(false);
  };

  const handleReset = () => {
    setSubmittedName('');
    setSearchName('');
    setShowAllMatches(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // Track recently viewed players
  const handleSelectPlayer = (player: any) => {
    const normalizedPlayer = {
      ...player,
      club: clubToString(player.club) || undefined,
    };
    setSelectedPlayer(normalizedPlayer);
  };

  const recentMatches = data?.recentMatches ?? [];
  const upcomingMatches = data?.upcomingMatches ?? [];

  /* Group matches by week for the Bracket tab */
  const matchesByWeek = React.useMemo(() => {
    const map: Record<number, StatsData['recentMatches']> = {};
    for (const m of recentMatches) {
      const w = m.week;
      if (!map[w]) map[w] = [];
      map[w].push(m);
    }
    return map;
  }, [recentMatches]);

  const upcomingByWeek = React.useMemo(() => {
    const map: Record<number, StatsData['upcomingMatches']> = {};
    for (const m of upcomingMatches) {
      const w = m.week;
      if (!map[w]) map[w] = [];
      map[w].push(m);
    }
    return map;
  }, [upcomingMatches]);

  if (isLoading) {
    return (
      <div className="space-y-5">
        <CasinoHeroSkeleton />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="flex items-center justify-center rounded-2xl border border-border/50 bg-card/60 p-3">
            <Skeleton className="h-8 w-48 rounded-lg" />
          </div>
          <div className="p-3 sm:p-4 rounded-2xl border border-border/50 bg-card/60 space-y-2">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-6 w-32 rounded" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        </div>
        <StatsRowSkeleton count={4} />
        <div className="border-b border-border">
          <div className="flex items-center gap-0">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-24 rounded-none" />
            ))}
          </div>
        </div>
        <TableSkeleton rows={5} cols={4} />
      </div>
    );
  }

  /* ─── Level 1: No Season at all ─── */
  if (!data?.hasData) {
    return <NoSeasonState division={toStrictDivision(division)} />;
  }

  const t = data.activeTournament;

  /* ─── Level 2: Season exists but no active tournament ─── */
  const hasTournament = !!t;

  if (!hasTournament) {
    return <NoTournamentState data={data} setSelectedPlayer={handleSelectPlayer} />;
  }

  /* ─── RENDER: Tour Saya Search Results (inline in Beranda) ─── */
  const renderMyTournamentResults = () => {
    if (!submittedName) return null;

    if (myStatusLoading) {
      return (
        <Card className={`${dt.casinoCard}`}>
          <CardContent className="p-5 relative z-10 text-center">
            <div className="animate-spin-slow inline-block mb-3">
              <Swords className={`w-8 h-8 ${dt.neonText}`} />
            </div>
            <p className="text-sm text-muted-foreground">Mencari data turnamen...</p>
          </CardContent>
        </Card>
      );
    }

    if (myStatusError) {
      return (
        <Card className={`${dt.casinoCard}`}>
          <CardContent className="p-5 relative z-10">
            <div className="text-center py-4">
              <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-red-400 mb-1">Gagal Memuat Data</h3>
              <p className="text-xs text-muted-foreground mb-3">Terjadi kesalahan saat mencari. Coba lagi.</p>
              <Button size="sm" variant="outline" onClick={handleReset}>Kembali</Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (!myStatus?.found) {
      return (
        <Card className={`${dt.casinoCard}`}>
          <CardContent className="p-5 relative z-10">
            <div className="text-center py-4">
              <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-red-400 mb-1">Tidak Ditemukan</h3>
              <p className="text-xs text-muted-foreground mb-1">{myStatus?.message || 'Nama tidak ditemukan dalam database'}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-2">Pastikan nama atau nickname sudah benar.</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (!myStatus.hasActiveTournament) {
      return (
        <Card className={`${dt.casinoCard}`}>
          <div className={dt.casinoBar} />
          <CardContent className="p-5 relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${dt.iconBg}`}>
                <Users className={`w-5 h-5 ${dt.neonText}`} />
              </div>
              <div>
                <p className="text-sm font-bold">{myStatus.player.gamertag}</p>
                <p className="text-[10px] text-muted-foreground">{myStatus.player.name} • {myStatus.player.city}</p>
              </div>
            </div>
            <div className="text-center py-4">
              <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-base font-bold mb-1">Belum Ada Turnamen Aktif</h3>
              <p className="text-xs text-muted-foreground">{myStatus.message}</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (!myStatus.myTeam) {
      return (
        <Card className={`${dt.casinoCard}`}>
          <div className={dt.casinoBar} />
          <CardContent className="p-5 relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${dt.iconBg}`}>
                <Users className={`w-5 h-5 ${dt.neonText}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <SkinName skin={myStatus.player.gamertag === loggedInGamertag && loggedInSkins?.length ? getPrimarySkin(loggedInSkins) : null}>
                    <p className="text-sm font-bold truncate">{myStatus.player.gamertag}</p>
                  </SkinName>
                  {myStatus.player.gamertag === loggedInGamertag && loggedInSkins && loggedInSkins.length > 0 && <SkinBadgesRow skins={loggedInSkins} />}
                </div>
                <p className="text-[10px] text-muted-foreground">{myStatus.player.name} • {myStatus.player.city}</p>
              </div>
            </div>
            <div className={`p-4 sm:p-5 rounded-lg ${dt.bgSubtle} border ${dt.borderSubtle} mb-4`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold">{myStatus.tournament.name}</span>
                <Badge className={`${dt.casinoBadge} text-[9px]`}>Week {myStatus.tournament.weekNumber}</Badge>
              </div>
              <TournamentProgress status={myStatus.tournament.status} />
            </div>
            <div className="text-center py-3">
              <Shield className={`w-8 h-8 ${dt.neonText} mx-auto mb-2 opacity-50`} />
              <h3 className="text-sm font-bold mb-1">
                {myStatus.tournament.isCompleted ? 'Turnamen Sudah Selesai' :
                 myStatus.tournament.status === 'registration' ? 'Pendaftaran Dibuka' :
                 myStatus.tournament.status === 'approval' ? 'Menunggu Persetujuan' :
                 'Belum Masuk Tim'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {myStatus.tournament.isCompleted ? 'Cek hasilnya di Arena Live.' :
                 myStatus.tournament.status === 'approval' ? (myStatus.participationStatus === 'registered' ? 'Pendaftaran kamu sedang menunggu persetujuan admin.' : myStatus.participationStatus === 'approved' ? 'Kamu sudah disetujui! Tim akan segera dibentuk.' : myStatus.message) :
                 myStatus.message}
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }

    /* ─── FULL RESULTS: Player Has a Team ─── */
    const myTeam = myStatus.myTeam;
    const myMatches = myStatus.myMatches || [];
    const liveMatch = myStatus.liveMatch;
    const nextMatch = myStatus.nextMatch;
    const nextOpponent = myStatus.nextOpponent;
    const totalRounds = Math.max(...myMatches.map((m: any) => m.round), 1);

    return (
      <div className="space-y-3">
        {/* Player + Team Header */}
        <Card className={`${dt.casinoCard} ${dt.cornerAccent} overflow-hidden`}>
          <div className={dt.casinoBar} />
          <CardContent className="p-0 relative z-10">
            <div className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${dt.iconBg}`}>
                  <Users className={`w-5 h-5 ${dt.neonText}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <SkinName skin={myStatus.player.gamertag === loggedInGamertag && loggedInSkins?.length ? getPrimarySkin(loggedInSkins) : null}>
                      <p className="text-sm font-bold truncate">{myStatus.player.gamertag}</p>
                    </SkinName>
                    {myStatus.player.gamertag === loggedInGamertag && loggedInSkins && loggedInSkins.length > 0 && <SkinBadgesRow skins={loggedInSkins} />}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{myStatus.player.name} • {myStatus.player.city}</p>
                </div>
                </div>
              <div className={`p-4 sm:p-5 rounded-2xl border ${myStatus.isChampion ? 'border-yellow-500/40 bg-yellow-500/5' : myStatus.isEliminated ? 'border-red-500/20 bg-red-500/5' : `${dt.borderSubtle} ${dt.bgSubtle}`}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {myStatus.isChampion && <Crown className="w-4 h-4 text-yellow-500" />}
                    <span className={`text-sm font-bold ${myStatus.isChampion ? 'text-yellow-500' : myStatus.isEliminated ? 'text-red-400' : dt.neonText}`}>
                      {myTeam.name}
                    </span>
                  </div>
                  {myStatus.isChampion ? (
                    <Badge className="bg-yellow-500/15 text-yellow-500 border-0 text-[9px]"><Crown className="w-3 h-3 mr-0.5" /> Juara!</Badge>
                  ) : myStatus.isEliminated ? (
                    <Badge className="bg-red-500/15 text-red-400 border-0 text-[9px]"><XCircle className="w-3 h-3 mr-0.5" /> Tereliminasi</Badge>
                  ) : (
                    <Badge className="bg-green-500/15 text-green-400 border-0 text-[9px]"><Play className="w-3 h-3 mr-0.5" /> Masih Bermain</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {myTeam.teammates.map((tm: any) => (
                    <div key={tm.id} className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] ${
                      tm.isMe
                        ? `bg-gradient-to-r ${dt.divisionBg} border ${dt.divisionBadge}`
                        : `${dt.bgSubtle}`
                    }`}>
                      <span className={tm.isMe ? 'font-bold' : ''}>{tm.gamertag}</span>
                      {tm.isMe && <span className="text-[8px] opacity-60">(kamu)</span>}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/20">
                  <span className="text-[10px] text-muted-foreground">
                    Rekor: <span className="text-green-400 font-bold">{myStatus.matchRecord.wins}W</span>
                    <span className="mx-0.5">-</span>
                    <span className="text-red-400 font-bold">{myStatus.matchRecord.losses}L</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Kekuatan: <span className="font-bold">{myTeam.power}</span>
                  </span>
                </div>
              </div>
            </div>
            <div className={`px-4 py-2.5 border-t ${dt.borderSubtle} bg-muted/20`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-semibold text-muted-foreground">{myStatus.tournament.name} • Week {myStatus.tournament.weekNumber}</span>
                <Badge className={`${dt.casinoBadge} text-[9px]`}>{myStatus.tournament.format?.replace('_', ' ').toUpperCase()}</Badge>
              </div>
              <TournamentProgress status={myStatus.tournament.status} />
            </div>
          </CardContent>
        </Card>

        {/* Live / Next / Status + Match History */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="space-y-3">
            {liveMatch && (
              <Card className="border-red-500/40 bg-red-500/5 shadow-lg shadow-red-500/10">
                <CardContent className="p-4 relative z-10">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-red-500 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-red-500">LIVE SEKARANG!</h3>
                      <p className="text-[10px] text-muted-foreground">{getRoundLabel(liveMatch.round, totalRounds)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 sm:p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                    <span className="text-xs font-bold">{myTeam.name}</span>
                    <span className="text-sm font-bold tabular-nums text-red-400">
                      {liveMatch.myScore ?? 0} - {liveMatch.opponentScore ?? 0}
                    </span>
                    <span className="text-xs font-bold">{liveMatch.opponent.name}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {nextMatch && !myStatus.isEliminated && !liveMatch && (
              <Card className={`${dt.casinoCard} border-green-500/20`}>
                <CardContent className="p-4 relative z-10">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${dt.iconBg}`}>
                      <Swords className={`w-4 h-4 ${dt.neonText}`} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold">Lawan Selanjutnya</h3>
                      <p className="text-[10px] text-muted-foreground">{getRoundLabel(nextMatch.round, totalRounds)}</p>
                    </div>
                  </div>
                  <div className={`p-4 sm:p-5 rounded-2xl border ${dt.borderSubtle}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold">{nextOpponent?.name || 'TBD'}</span>
                      <Badge className={`${dt.casinoBadge} text-[9px]`}>Lawan</Badge>
                    </div>
                    {nextOpponent?.players?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {nextOpponent.players.map((p: any) => (
                          <div key={p.id} className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted/30 text-[10px]">
                            <span>{p.gamertag}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {myStatus.isEliminated && !myStatus.isChampion && (
              <Card className="border-red-500/20 bg-red-500/5">
                <CardContent className="p-4 relative z-10">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                    <div>
                      <h3 className="text-sm font-bold text-red-400">Tim Tereliminasi</h3>
                      <p className="text-[10px] text-muted-foreground">{myStatus.eliminationInfo || 'Tim kamu telah gugur dari bracket'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {myStatus.isChampion && (
              <Card className="border-yellow-500/30 bg-yellow-500/5">
                <CardContent className="p-4 relative z-10 text-center">
                  <div className="animate-pulse-scale inline-block mb-2">
                    <Trophy className="w-10 h-10 text-yellow-500" />
                  </div>
                  <h3 className="text-base font-bold text-yellow-500 mb-1">Selamat, Juara!</h3>
                  <p className="text-xs text-muted-foreground">{myTeam.name} memenangkan tournament ini!</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Match History */}
          {myMatches.length > 0 && (
            <Card className={`${dt.casinoCard}`}>
              <div className={dt.casinoBar} />
              <CardContent className="p-0 relative z-10">
                <div className={`flex items-center gap-2.5 px-4 py-3 border-b ${dt.borderSubtle}`}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider">Riwayat Match</h3>
                  <Badge className={`${dt.casinoBadge} ml-auto text-[9px]`}>{myStatus.completedMatchCount} Main</Badge>
                </div>
                <div className="p-3 space-y-1.5 max-h-80 overflow-y-auto custom-scrollbar">
                  {(showAllMatches ? myMatches : myMatches.slice(0, 5)).map((m: any) => (
                    <div key={m.id} className={`p-3 sm:p-4 rounded-lg border ${
                      m.won ? `border-green-500/20 ${dt.bgSubtle}` :
                      m.lost ? 'border-red-500/10' :
                      'border-border/20'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-muted-foreground">{getRoundLabel(m.round, totalRounds)}</span>
                        <div className="flex items-center gap-1.5">
                          {m.won && <Badge className="bg-green-500/15 text-green-400 border-0 text-[8px]">Menang</Badge>}
                          {m.lost && <Badge className="bg-red-500/15 text-red-400 border-0 text-[8px]">Kalah</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold flex-1 ${m.won ? 'text-green-400' : ''}`}>{myTeam.name}</span>
                        <span className={`text-sm font-bold tabular-nums ${m.won ? 'text-green-400' : m.lost ? 'text-red-400' : ''}`}>
                          {m.myScore !== null && m.opponentScore !== null ? `${m.myScore} - ${m.opponentScore}` : 'VS'}
                        </span>
                        <span className={`text-xs font-semibold flex-1 text-right ${m.lost ? 'text-red-400' : ''}`}>{m.opponent.name}</span>
                      </div>
                    </div>
                  ))}
                  {myMatches.length > 5 && (
                    <button onClick={() => setShowAllMatches(!showAllMatches)} className="w-full py-2 text-[10px] text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 transition-colors min-h-[36px]">
                      {showAllMatches ? <>Tutup <ChevronUp className="w-3 h-3" /></> : <>Lihat semua ({myMatches.length}) <ChevronDown className="w-3 h-3" /></>}
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
    <div className="space-y-3 sm:space-y-4">

      {/* ========== HERO BANNER ========== */}
      <div className={`stagger-item-subtle stagger-d0 relative rounded-2xl sm:rounded-2xl overflow-hidden ${dt.casinoCard} min-h-[180px] sm:min-h-[260px] lg:min-h-[340px] ${!isMobile ? 'casino-shimmer' : ''}`} style={{ contain: 'layout style' }}>
        <div className={dt.casinoBar} />
        <div className="absolute inset-0">
          {(division === 'male' ? bgMale : bgFemale) && (
            <Image src={division === 'male' ? bgMale : bgFemale} alt="" fill sizes="100vw" className="object-cover object-[center_20%]" aria-hidden="true" loading="lazy" />
          )}
        </div>
        <div className="casino-img-overlay" />
        <div className={`hidden lg:block absolute top-1/3 right-1/4 w-64 h-64 rounded-full blur-3xl ${dt.bg} opacity-30 lg:opacity-40`} />
        <div className={`hidden lg:block absolute bottom-1/4 left-1/3 w-48 h-48 rounded-full blur-3xl ${dt.bg} opacity-20`} />
        <div className={`absolute top-3 left-3 ${dt.cornerAccent}`} />
        <div className={`absolute top-3 right-3 rotate-90 ${dt.cornerAccent}`} />
        <div className={`hidden lg:block absolute bottom-3 left-3 rotate-180 ${dt.cornerAccent}`} />
        <div className={`hidden lg:block absolute bottom-3 right-3 rotate-270 ${dt.cornerAccent}`} />
        {/* Content */}
        <div className="absolute inset-0 z-10 flex">
          {/* LEFT ZONE */}
          <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Badge className={`${dt.casinoBadge} px-2 py-0.5 text-[9px] sm:text-[10px]`}>
                  🐉 Season {data.season?.number || 1}
                </Badge>
                <Badge className={`${dt.divisionBadge} px-2 py-0.5 text-[9px] sm:text-[10px]`}>
                  {division === 'male' ? '🕺 Cowo' : '💃 Cewe'}
                </Badge>
              </div>
              <div className="flex sm:hidden flex-col items-end gap-1">
                <div className="flex items-center gap-1.5">
                  <ShareButton
                    title={t?.name || 'Tarkam IDM'}
                    description={`Week ${t?.weekNumber || '-'} — ${division === 'male' ? 'Cowo' : 'Cewe'} Tarkam`}
                    variant="icon"
                  />
                  <StatusBadge status={t?.status || 'registration'} />
                </div>
                <span className="px-2.5 py-1 rounded-md bg-gradient-to-r from-idm-gold-warm/25 to-[#e8d5a3]/15 border border-idm-gold-warm/30 text-[10px] sm:text-xs font-bold text-idm-gold-warm drop-shadow-[0_0_8px_rgba(249,203,37,0.3)]">💰 {formatCurrencyShort(data.activeTournamentPrizePool ?? t?.prizePool ?? data.totalPrizePool)}</span>
              </div>
            </div>

            <div className="mt-2 sm:mt-3 lg:mt-4">
              <h2 className={`text-lg sm:text-3xl lg:text-5xl font-black ${dt.neonGradient} leading-tight tracking-tight`}>{t?.name || 'Tarkam IDM Babak'}</h2>
              <p className="text-[10px] sm:text-xs lg:text-base text-muted-foreground mt-1.5">{data.season?.name}</p>
            </div>

            <div className="mt-auto pt-2 sm:pt-4">
              {/* Mobile: compact single row info pills */}
              <div className="flex sm:flex-wrap items-center gap-1 sm:gap-2 lg:gap-3 overflow-x-auto scrollbar-none">
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 sm:px-0 sm:py-0 rounded sm:rounded-none bg-black/30 sm:bg-transparent text-[8px] sm:text-xs lg:text-sm text-white/80 whitespace-nowrap"><Flame className={`w-2 h-2 sm:w-3 sm:h-3 lg:w-4 lg:h-4 ${dt.neonText}`} />W{t?.weekNumber || 5}</span>
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 sm:px-0 sm:py-0 rounded sm:rounded-none bg-black/30 sm:bg-transparent text-[8px] sm:text-xs lg:text-sm text-white/80 whitespace-nowrap"><Trophy className={`w-2 h-2 sm:w-3 sm:h-3 lg:w-4 lg:h-4 ${dt.neonText}`} />{t?.format === 'group_stage' ? 'Group' : t?.format === 'swiss' ? 'Swiss' : 'Elim'}</span>
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 sm:px-0 sm:py-0 rounded sm:rounded-none bg-black/30 sm:bg-transparent text-[8px] sm:text-xs lg:text-sm text-white/80 whitespace-nowrap"><MapPin className={`w-2 h-2 sm:w-3 sm:h-3 lg:w-4 lg:h-4 ${dt.neonText}`} />{t?.location || 'Online'}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 lg:gap-3 mt-1 sm:mt-2">
                {t?.scheduledAt && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 sm:px-0 sm:py-0 rounded sm:rounded-none bg-black/30 sm:bg-transparent text-[9px] sm:text-xs lg:text-sm text-white/80"><Calendar className={`w-2.5 h-2.5 sm:w-3 sm:h-3 lg:w-4 lg:h-4 ${dt.neonText}`} />{parseWitaDate(t.scheduledAt) ? formatWIBWeekdayShort(parseWitaDate(t.scheduledAt)!) : ''}</span>}
                {t?.scheduledAt && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 sm:px-0 sm:py-0 rounded sm:rounded-none bg-black/30 sm:bg-transparent text-[9px] sm:text-xs lg:text-sm text-white/80"><Clock className={`w-2.5 h-2.5 sm:w-3 sm:h-3 lg:w-4 lg:h-4 ${dt.neonText}`} />{parseWitaDate(t.scheduledAt) ? formatWIBTime(parseWitaDate(t.scheduledAt)!) : ''}</span>}
                {t?.bpm && <span className="hidden sm:inline-flex items-center gap-1 text-xs lg:text-sm text-white/70"><Heart className="w-3 h-3 lg:w-4 lg:h-4 text-red-400 live-dot" />{t.bpm} BPM</span>}
                <span className="hidden sm:inline-flex items-center gap-1 text-xs lg:text-sm text-white/70"><Music className={`w-3 h-3 lg:w-4 lg:h-4 ${dt.neonText}`} />{t?.matches?.length || recentMatches.length} Match</span>
              </div>
            </div>
          </div>

          {/* RIGHT ZONE (Desktop) */}
          <div className="hidden sm:flex flex-col items-stretch justify-between w-[150px] lg:w-[220px] shrink-0 border-l border-border p-4 lg:p-6 gap-3">
            <div className="flex items-center gap-2">
              <ShareButton
                title={t?.name || 'Tarkam IDM'}
                description={`Week ${t?.weekNumber || '-'} — ${division === 'male' ? 'Cowo' : 'Cewe'} Tarkam`}
                variant="icon"
              />
              <StatusBadge status={t?.status || 'registration'} />
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <p className="text-[10px] lg:text-xs text-white/40 uppercase tracking-[0.2em] font-semibold">Prize Pool</p>
              <p className="px-3 py-2 lg:px-5 lg:py-2.5 rounded-2xl bg-black/60 text-base lg:text-2xl font-black text-idm-gold-warm drop-shadow-[0_0_16px_rgba(249,203,37,0.45)] whitespace-nowrap">{formatCurrency(data.activeTournamentPrizePool ?? t?.prizePool ?? data.totalPrizePool)}</p>
              <p className="text-[8px] text-idm-gold-warm/50 font-medium">💰 dari saweran komunitas</p>
            </div>
            <button
              onClick={() => setDonationOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 lg:px-5 lg:py-3 rounded-2xl text-xs lg:text-sm font-bold bg-gradient-to-r from-idm-gold-warm to-[#e8d5a3] text-black hover:scale-105 hover:shadow-[0_0_20px_rgba(249,203,37,0.3)] active:scale-95 transition-all cursor-pointer min-h-[40px] lg:min-h-[44px]"
            >
              <Gift className="w-4 h-4 lg:w-5 lg:h-5" />
              Sawer
            </button>
          </div>
        </div>

        {/* Mobile Sawer button — prominent gold CTA */}
        <div className="sm:hidden absolute bottom-2 right-2 z-20">
          <button
            onClick={() => setDonationOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[11px] font-bold bg-gradient-to-r from-idm-gold-warm to-[#e8d5a3] text-black shadow-lg shadow-idm-gold-warm/30 active:scale-95 transition-all cursor-pointer min-h-[44px]"
          >
            <Gift className="w-4 h-4" />
            Sawer
          </button>
        </div>
      </div>

      {/* ========== TAB BAR — 4 tabs: Beranda, Bracket, Peringkat, Info ========== */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="sticky top-0 z-20 sm:static sm:z-auto overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className={`border-b ${dt.border} bg-background/95 sm:bg-transparent`}>
            <TabsList className="bg-transparent h-auto p-0 gap-0 rounded-none">
              {[
                { value: 'overview', label: 'Beranda', icon: Trophy },
                { value: 'matches', label: 'Bracket', icon: Swords },
                { value: 'standings', label: 'Peringkat', icon: Shield },
                { value: 'info', label: 'Info', icon: BookOpen },
              ].map(tab => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className={`relative px-3 sm:px-5 py-2.5 sm:py-2.5 text-xs font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-current data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-idm-gold-warm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap min-h-[44px]`}
                >
                  <tab.icon className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {/* Subtle gradient for visual depth on mobile */}
            <div className="h-px bg-gradient-to-r from-transparent via-idm-gold-warm/20 to-transparent sm:hidden" />
          </div>
        </div>

        {/* ═══════════════ BERANDA TAB — Streamlined + Integrated Tour Saya ═══════════════ */}
        <TabsContent value="overview" className="mt-3 sm:mt-4 lg:mt-6 space-y-3 sm:space-y-4">

          {/* ── Cari Turnamen Saya — Search Bar (prominent on mobile) ── */}
          <div className={`rounded-2xl border-2 sm:border border-idm-gold-warm/20 sm:border-[inherit] ${dt.bgSubtle} p-3 sm:p-4 relative z-10 shadow-lg shadow-idm-gold-warm/5 sm:shadow-none transition-all`}>
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${dt.iconBg}`}>
                <Target className={`w-4.5 h-4.5 ${dt.neonText}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-gradient-fury">Cari Turnamen Kamu</h3>
                <p className="text-[10px] text-muted-foreground">Ketik nama/nickname untuk cek status turnamen</p>
              </div>
              {submittedName && (
                <Button size="sm" variant="outline" className="h-8 text-[10px] shrink-0 gap-1 min-h-[44px]" onClick={handleReset}>
                  ✕ Reset
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  ref={inputRef}
                  placeholder="Contoh: montiel, Afroki..."
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-9 h-11 sm:h-10 text-sm bg-background border-2 border-idm-gold/30 focus:border-idm-gold-warm focus:ring-1 focus:ring-idm-gold-warm/30 placeholder:text-muted-foreground/60 rounded-xl sm:rounded-lg transition-all"
                  maxLength={30}
                  autoComplete="off"
                  enterKeyHint="search"
                />
              </div>
              <Button
                onClick={handleSearch}
                disabled={!searchName.trim()}
                className={`h-11 sm:h-10 px-4 text-sm font-bold gap-1.5 shrink-0 bg-idm-gold-warm hover:bg-idm-gold-warm/90 text-black min-h-[44px] sm:min-h-0`}
              >
                <Search className="w-4 h-4" />
                Cari
              </Button>
            </div>
          </div>

          {/* ── Tour Saya Search Results (inline) ── */}
          {renderMyTournamentResults()}

          {/* ── Quick Stats ── */}
          <QuickStatsBar data={data} division={toStrictDivision(division)} />

          {/* ── Live Match ── */}
          <div className="stagger-item-subtle stagger-d0">
            <LiveMatchIndicator />
          </div>
          <LiveMatchCounter />

          {/* ── Active Tournament Status (from overview) ── */}
          {overview?.hasTournament && overview.tournament.status !== 'completed' && (
            <Card className={`${dt.casinoCard} ${dt.cornerAccent} overflow-hidden`}>
              <div className={dt.casinoBar} />
              <CardContent className="p-0 relative z-10">
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${dt.iconBg}`}>
                      <Flame className={`w-4.5 h-4.5 ${dt.neonText}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold truncate">{overview.tournament.name}</h3>
                        <OverviewStatusBadge status={overview.tournament.status} division={division} />
                      </div>
                      <p className="text-[9px] text-muted-foreground">
                        Week {overview.tournament.weekNumber} • {overview.tournament.season?.name || `Season`}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {overview.tournament.totalMatches > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] text-muted-foreground">Progress</span>
                        <span className="text-[9px] font-bold">{overview.tournament.progressPercent}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r from-idm-gold-warm to-idm-amber transition-all duration-700`}
                          style={{ width: `${overview.tournament.progressPercent}%` }}
                        />
                      </div>
                      <p className="text-[8px] text-muted-foreground mt-0.5">
                        {overview.tournament.completedMatchCount}/{overview.tournament.totalMatches} match selesai
                        {overview.tournament.liveMatchCount > 0 && <span className="text-red-400 ml-1">• {overview.tournament.liveMatchCount} LIVE</span>}
                      </p>
                    </div>
                  )}

                  <TournamentProgress status={overview.tournament.status} />

                  {/* Quick Stats */}
                  <div className="grid grid-cols-4 gap-2 mt-3">
                    <div className="text-center">
                      <div className={`text-sm font-bold ${dt.neonText}`}>{overview.tournament.totalTeams}</div>
                      <div className="text-[8px] text-muted-foreground">Tim</div>
                    </div>
                    <div className="text-center">
                      <div className={`text-sm font-bold ${dt.neonText}`}>{overview.tournament.totalParticipants}</div>
                      <div className="text-[8px] text-muted-foreground">Pemain</div>
                    </div>
                    <div className="text-center">
                      <div className={`text-sm font-bold ${dt.neonText}`}>{overview.tournament.totalMatches}</div>
                      <div className="text-[8px] text-muted-foreground">Match</div>
                    </div>
                    <div className="text-center">
                      <div className={`text-sm font-bold ${dt.neonText}`}>{overview.tournament.prizePool > 0 ? `Rp ${(overview.tournament.prizePool / 1000).toFixed(0)}K` : '-'}</div>
                      <div className="text-[8px] text-muted-foreground">Hadiah</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Top Players + Top Saweran (side by side on desktop) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            <TopPlayersSection data={data} division={toStrictDivision(division)} setSelectedPlayer={handleSelectPlayer} />
            <TopDonorsWidget onDonate={() => setDonationOpen(true)} statsData={data} />
          </div>

          {/* ── Activity Feed ── */}
          <ActivityFeed />

          {/* ── Recent Match Results (compact) ── */}
          {t?.matches?.filter(m => m.status === 'completed').length ? (
            <Card className={`${dt.casinoCard} overflow-hidden`}>
              <div className={dt.casinoBar} />
              <CardContent className="p-0 relative z-10">
                <div className={`flex items-center gap-2.5 px-4 py-3 border-b ${dt.borderSubtle}`}>
                  <div className={`w-5 h-5 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
                    <Music className={`w-3 h-3 ${dt.neonText}`} />
                  </div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider">Hasil Terbaru</h3>
                  <Badge className={`${dt.casinoBadge} ml-auto`}>HASIL</Badge>
                </div>
                <div className="p-3 space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
                  {t.matches.filter(m => m.status === 'completed').slice(-5).reverse().map(m => (
                    <DanceMatchCard
                      key={m.id}
                      team1={m.team1}
                      team2={m.team2}
                      score1={m.score1}
                      score2={m.score2}
                      status={m.status}
                      week={t.weekNumber}
                      mvpPlayer={m.mvpPlayer}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        {/* ═══════════════ BRACKET TAB ═══════════════ */}
        <TabsContent value="matches" className="mt-3 sm:mt-4 lg:mt-6 space-y-3 sm:space-y-4">
          <MatchesTab
            data={data}
            recentMatches={recentMatches}
            upcomingMatches={upcomingMatches}
            matchesByWeek={matchesByWeek}
            upcomingByWeek={upcomingByWeek}
            clubs={data.clubs}
          />
        </TabsContent>

        {/* ═══════════════ PERINGKAT TAB ═══════════════ */}
        <TabsContent value="standings" className="mt-3 sm:mt-4 lg:mt-6 space-y-3 sm:space-y-4 lg:space-y-6">
          <StandingsTab
            data={data}
            otherDivisionData={otherDivisionData}
            currentDivision={toStrictDivision(division)}
            setSelectedPlayer={handleSelectPlayer}
            setSelectedClub={setSelectedClub}
          />
        </TabsContent>

        {/* ═══════════════ INFO TAB — Lightweight reference info ═══════════════ */}
        <TabsContent value="info" className="mt-3 sm:mt-4 lg:mt-6 space-y-3 sm:space-y-4">

          {/* Division Rivalry + Streak */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            <DivisionRivalryWidget setSelectedPlayer={handleSelectPlayer} />
            <StreakWidget />
          </div>

          {/* Compare Players + Season Timeline */}
          <OverviewTab
            data={data}
            division={toStrictDivision(division)}
            setSelectedPlayer={handleSelectPlayer}
            setSelectedClub={setSelectedClub}
          />
        </TabsContent>

      </Tabs>

      {/* Player & Club Profiles */}
      {selectedPlayer && (
        <PlayerProfile
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
          rank={(data?.topPlayers?.findIndex(p => p.id === selectedPlayer.id) ?? -1) + 1}
          skinMap={{ ...(data?.skinMap || {}), ...(otherDivisionData?.skinMap || {}) }}
        />
      )}
      {selectedClub && (
        <ClubProfile club={selectedClub} onClose={() => setSelectedClub(null)} />
      )}

      {/* Donation Modal */}
      <DonationModal
        open={donationOpen}
        onOpenChange={setDonationOpen}
        defaultType="weekly"
        tournamentId={t?.id || null}
        cmsSettings={cms || {}}
      />

    </div>
    </>
  );
}
