'use client';

import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/lib/store';
import { motion } from 'framer-motion';
import {
  Heart, MapPin, Users, Trophy, Clock, Flame,
  TrendingUp, Award, Gift, Zap, Crown, Sparkles,
  Radio, Shield, Music, Swords,
  Gamepad2, Calendar, Target, Wallet, Search, List, Grid3X3, ChevronDown, ChevronUp, ChevronRight, Filter
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { CountdownTimer } from './countdown-timer';
import { PlayerCard } from './player-card';
import { PlayerProfile } from './player-profile';
import { ClubProfile } from './club-profile';
import { BracketView } from './bracket-view';
import { ParticipantGrid } from './participant-grid';
import { DanceMatchCard } from './match-card';
import { WeekNavigator } from './week-navigator';
import React, { useState, useMemo } from 'react';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { formatCurrency, cdnImage, parseWIBDate, formatWIBWeekdayShort } from '@/lib/utils';
import type { StatsData } from '@/types/stats';
import { StatusBadge } from './status-badge';
import { staggerContainerFast, fadeUpItemSubtle } from '@/lib/animations';

/* ─── Animation variants (imported from shared module) ─── */
const container = staggerContainerFast;
const item = fadeUpItemSubtle;

/* ─── Helper: extract club name string from TopPlayer.club ─── */
function clubName(club: string | { id: string; name: string; logo?: string | null } | undefined): string | undefined {
  if (!club) return undefined;
  if (typeof club === 'string') return club;
  return club.name;
}

/* ─── CasinoHeaderCard — kept but used only for hero area ─── */
const CasinoHeaderCard = React.memo(function CasinoHeaderCard({ icon: Icon, title, badge, children, className = '' }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const dt = useDivisionTheme();
  return (
    <Card className={`${dt.casinoCard} ${dt.casinoGlow} casino-shimmer overflow-hidden group ${className}`}>
      <div className={dt.casinoBar} />
      <div className="relative img-zoom h-28 sm:h-32">
        <img src={dt.division === 'male' ? cdnImage('/bg-male.jpg', 1920) : cdnImage('/bg-female.jpg', 1920)} alt="" className={`w-full h-full object-cover card-cover ${dt.division === 'male' ? 'object-[center_25%]' : ''}`} aria-hidden="true" />
        <div className="casino-img-overlay" />
        <div className={`absolute top-2 left-2 ${dt.cornerAccent}`} />
        <div className={`absolute top-2 right-2 rotate-90 ${dt.cornerAccent}`} />
        {badge && <Badge className={`absolute top-3 right-3 ${dt.casinoBadge} backdrop-blur-sm`}>{badge}</Badge>}
        <div className="absolute bottom-3 left-4 flex items-center gap-3 z-10">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${dt.division === 'male' ? 'from-idm-male to-idm-male-light' : 'from-idm-female to-idm-female-light'} flex items-center justify-center shadow-lg`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <h3 className={`text-sm font-bold ${dt.neonText}`}>{title}</h3>
        </div>
      </div>
      <CardContent className="p-4 relative z-10">{children}</CardContent>
    </Card>
  );
})

/* ─── Toornament-style Section Card — clean header with thin bottom border ─── */
const SectionCard = React.memo(function SectionCard({ title, icon: Icon, badge, children, className = '' }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const dt = useDivisionTheme();
  return (
    <Card className={`${dt.casinoCard} overflow-hidden ${className}`}>
      <div className={dt.casinoBar} />
      <CardContent className="p-0 relative z-10">
        {/* Toornament-style section header — full width, bordered bottom */}
        <div className={`flex items-center gap-2.5 px-4 py-3 border-b ${dt.borderSubtle}`}>
          <div className={`w-5 h-5 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
            <Icon className={`w-3 h-3 ${dt.neonText}`} />
          </div>
          <h3 className="text-xs font-semibold uppercase tracking-wider">{title}</h3>
          {badge && <Badge className={`${dt.casinoBadge} ml-auto text-[9px]`}>{badge}</Badge>}
        </div>
        <div className="p-4">
          {children}
        </div>
      </CardContent>
    </Card>
  );
})

/* ─── Toornament-style Match Row — clean, compact ─── */
const MatchRow = React.memo(function MatchRow({ club1, club2, score1, score2, week, status, mvp, isLive }: {
  club1: string; club2: string; score1: number; score2: number;
  week?: number; status?: string; mvp?: string; isLive?: boolean;
}) {
  const dt = useDivisionTheme();
  const isUpcoming = status === 'upcoming';
  const isCompleted = status === 'completed' || (!isUpcoming && score1 !== score2);
  const winner1 = !isUpcoming && score1 > score2;
  const winner2 = !isUpcoming && score2 > score1;

  // For upcoming matches, show dash instead of 0
  const displayScore1 = isUpcoming ? '-' : score1;
  const displayScore2 = isUpcoming ? '-' : score2;

  return (
    <div className={`group flex items-stretch rounded-lg overflow-hidden ${dt.bgSubtle} ${dt.borderSubtle} border transition-all ${dt.hoverBorder} hover:shadow-sm`}>
      {/* Week/Round indicator — toornament style left bar */}
      {week && (
        <div className={`w-10 shrink-0 flex items-center justify-center ${dt.bg} border-r ${dt.borderSubtle}`}>
          <span className={`text-[9px] font-bold ${dt.neonText}`}>W{week}</span>
        </div>
      )}
      {/* Main match content */}
      <div className="flex-1 min-w-0">
        {/* Team 1 */}
        <div className={`flex items-center px-3 py-1.5 border-b ${dt.borderSubtle} ${isUpcoming ? '' : winner1 ? '' : 'opacity-60'}`}>
          <span className={`text-xs font-semibold truncate flex-1 ${winner1 ? dt.neonText : 'text-muted-foreground'}`}>
            {winner1 && <span className="mr-1">▸</span>}
            {club1}
          </span>
          <span className={`text-sm font-bold tabular-nums w-6 text-right ${winner1 ? dt.neonText : 'text-foreground'}`}>{displayScore1}</span>
        </div>
        {/* Team 2 */}
        <div className={`flex items-center px-3 py-1.5 ${isUpcoming ? '' : winner2 ? '' : 'opacity-60'}`}>
          <span className={`text-xs font-semibold truncate flex-1 ${winner2 ? dt.neonText : 'text-muted-foreground'}`}>
            {winner2 && <span className="mr-1">▸</span>}
            {club2}
          </span>
          <span className={`text-sm font-bold tabular-nums w-6 text-right ${winner2 ? dt.neonText : 'text-foreground'}`}>{displayScore2}</span>
        </div>
      </div>
      {/* Status / MVP indicator */}
      <div className="w-16 shrink-0 flex flex-col items-center justify-center border-l border-transparent">
        {isLive ? (
          <Badge className="bg-red-500/10 text-red-500 text-[8px] border-0 live-dot">LIVE</Badge>
        ) : isCompleted ? (
          <Badge className="bg-green-500/10 text-green-500 text-[8px] border-0">FT</Badge>
        ) : (
          <Badge className={`${dt.casinoBadge} text-[8px]`}>VS</Badge>
        )}
        {mvp && <span className="text-[8px] text-yellow-500 mt-0.5">MVP</span>}
      </div>
    </div>
  );
})

/* ─── Toornament-style Bracket Match ─── */
const BracketMatch = React.memo(function BracketMatch({ team1, team2, score1, score2, status, round, matchIdx, isLast }: {
  team1: string; team2: string; score1: number | null; score2: number | null;
  status: string; round: number; matchIdx: number; isLast: boolean;
}) {
  const dt = useDivisionTheme();
  const hasScore = score1 !== null && score2 !== null;
  const winner1 = hasScore && score1! > score2!;
  const winner2 = hasScore && score2! > score1!;
  const isLive = status === 'live';

  return (
    <div className="relative" style={{ marginBottom: isLast ? 0 : 'var(--bracket-gap, 24px)' }}>
      {/* Connector lines for rounds > 0 */}
      {round > 0 && (
        <div className="absolute -left-5 top-1/2 w-5 flex items-center">
          <div className={`w-full h-px ${dt.borderSubtle}`} />
        </div>
      )}
      <div className={`rounded-lg overflow-hidden border ${dt.borderSubtle} ${isLive ? `border-red-500/30 ${dt.neonPulse}` : ''} transition-all ${dt.hoverBorder} hover:shadow-sm`} style={{ background: 'var(--card-bg, rgba(20,17,10,0.6))' }}>
        {/* Team 1 row */}
        <div className={`flex items-center px-2.5 py-1.5 border-b ${dt.borderSubtle} ${winner1 ? dt.bgSubtle : ''}`}>
          <span className={`text-[11px] font-semibold truncate flex-1 ${winner1 ? dt.neonText : 'text-foreground/80'}`}>
            {team1 || 'TBD'}
          </span>
          <span className={`text-xs font-bold tabular-nums w-5 text-right ${winner1 ? dt.neonText : 'text-muted-foreground'}`}>
            {hasScore ? score1 : '-'}
          </span>
        </div>
        {/* Team 2 row */}
        <div className={`flex items-center px-2.5 py-1.5 ${winner2 ? dt.bgSubtle : ''}`}>
          <span className={`text-[11px] font-semibold truncate flex-1 ${winner2 ? dt.neonText : 'text-foreground/80'}`}>
            {team2 || 'TBD'}
          </span>
          <span className={`text-xs font-bold tabular-nums w-5 text-right ${winner2 ? dt.neonText : 'text-muted-foreground'}`}>
            {hasScore ? score2 : '-'}
          </span>
        </div>
      </div>
    </div>
  );
})

/* ─── Toornament-style Participant Row ─── */
const ParticipantRow = React.memo(function ParticipantRow({ player, rank, onClick }: {
  player: StatsData['topPlayers'][0];
  rank: number;
  onClick: () => void;
}) {
  const dt = useDivisionTheme();
  const division = useAppStore(s => s.division);

  return (
    <motion.div
      whileHover={{ x: 2 }}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors border border-transparent ${dt.hoverBorder} ${dt.hoverBgSubtle}`}
      onClick={onClick}
    >
      {/* Rank */}
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
        rank === 1 ? 'bg-yellow-500/20 text-yellow-500' :
        rank === 2 ? 'bg-gray-400/20 text-muted-foreground' :
        rank === 3 ? 'bg-amber-600/20 text-amber-600' :
        `${dt.bgSubtle} text-muted-foreground`
      }`}>
        {rank}
      </span>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full ${rank <= 3
        ? 'bg-gradient-to-br ' + (division === 'male' ? 'from-idm-male to-idm-male-light' : 'from-idm-female to-idm-female-light')
        : dt.iconBg
      } flex items-center justify-center text-[10px] font-bold ${rank <= 3 ? 'text-white' : dt.text} shrink-0 shadow-sm`}>
        {player.gamertag.slice(0, 2).toUpperCase()}
      </div>
      {/* Name & Club */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate">{player.gamertag}</p>
        {player.club && (
          <p className="text-[9px] text-muted-foreground truncate flex items-center gap-0.5">
            <Shield className="w-2.5 h-2.5" />
            {clubName(player.club)}
          </p>
        )}
      </div>
      {/* Points */}
      <div className="w-14 text-right shrink-0">
        <p className={`text-xs font-bold ${rank <= 3 ? dt.neonText : ''}`}>{player.points}</p>
        <p className="text-[8px] text-muted-foreground">pts</p>
      </div>
      {/* Quick stats */}
      <div className="hidden sm:flex items-center gap-2 shrink-0 text-[9px] text-muted-foreground">
        <span className="text-green-500 font-medium">{player.totalWins}W</span>
        <span className="text-red-500 font-medium">{player.matches - player.totalWins}L</span>
        {player.streak > 1 && <span className="text-orange-400">🔥{player.streak}</span>}
      </div>
    </motion.div>
  );
})

/* ─── Main Dashboard Component ─── */
export function Dashboard() {
  const { division } = useAppStore();
  const dt = useDivisionTheme();
  const [selectedPlayer, setSelectedPlayer] = useState<StatsData['topPlayers'][0] | null>(null);
  const [selectedClub, setSelectedClub] = useState<StatsData['clubs'][0] | null>(null);
  const [participantView, setParticipantView] = useState<'list' | 'grid'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [leaderboardSort, setLeaderboardSort] = useState<'players' | 'clubs'>('players');
  const [showAllPlayers, setShowAllPlayers] = useState(false);
  const [showAllClubs, setShowAllClubs] = useState(false);
  const [bracketType, setBracketType] = useState<string>('single_elimination');
  const [topPlayerTab, setTopPlayerTab] = useState<'top3' | 'champion' | 'mvp'>('top3');
  const [selectedChampionWeek, setSelectedChampionWeek] = useState<number>(1);
  const [selectedMvpWeek, setSelectedMvpWeek] = useState<number>(1);

  const { data, isLoading } = useQuery<StatsData>({
    queryKey: ['stats', division],
    queryFn: async () => {
      const res = await fetch(`/api/stats?division=${division}`);
      return res.json();
    },
  });

  /* Group matches by week for the Matches tab */
  const recentMatches = data?.recentMatches ?? [];
  const upcomingMatches = data?.upcomingMatches ?? [];

  const matchesByWeek = useMemo(() => {
    if (recentMatches.length === 0) return {} as Record<number, StatsData['recentMatches']>;
    return recentMatches.reduce((acc, m) => {
      if (!acc[m.week]) acc[m.week] = [];
      acc[m.week].push(m);
      return acc;
    }, {} as Record<number, StatsData['recentMatches']>);
  }, [recentMatches]);

  const upcomingByWeek = useMemo(() => {
    if (upcomingMatches.length === 0) return {} as Record<number, StatsData['upcomingMatches']>;
    return upcomingMatches.reduce((acc, m) => {
      if (!acc[m.week]) acc[m.week] = [];
      acc[m.week].push(m);
      return acc;
    }, {} as Record<number, StatsData['upcomingMatches']>);
  }, [upcomingMatches]);

  /* Group tournament matches by round for bracket view */
  const tournamentMatchesByRound = useMemo(() => {
    if (!data?.activeTournament?.matches) return {} as Record<number, NonNullable<StatsData['activeTournament']>['matches']>;
    return data.activeTournament.matches.reduce((acc, m) => {
      const round = 'round' in m ? (m as any).round || 1 : 1;
      if (!acc[round]) acc[round] = [];
      acc[round].push(m);
      return acc;
    }, {} as Record<number, NonNullable<StatsData['activeTournament']>['matches']>);
  }, [data?.activeTournament?.matches]);

  /* Filtered participants */
  const filteredPlayers = useMemo(() => {
    if (!data?.topPlayers) return [];
    if (!searchQuery) return data.topPlayers;
    return data.topPlayers.filter(p =>
      p.gamertag.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.club && clubName(p.club)?.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [data?.topPlayers, searchQuery]);

  /* Displayed players/clubs — computed inline (trivial slice, no memo needed) */
  const topPlayers = data?.topPlayers ?? [];
  const displayedPlayers = showAllPlayers ? topPlayers : topPlayers.slice(0, 10);
  const clubs = data?.clubs ?? [];
  const displayedClubs = showAllClubs ? clubs : clubs.slice(0, 6);

  if (isLoading) {
    return (
      <div className="space-y-5 max-w-5xl mx-auto">
        <Skeleton className="h-44 rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-10 rounded-lg" />
        <div className="space-y-3">
          <Skeleton className="h-32 rounded-xl" />
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data?.hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Gamepad2 className={`w-12 h-12 ${dt.text} mb-4 opacity-30`} />
        <h3 className="text-lg font-semibold mb-1">Belum Ada Data</h3>
        <p className="text-sm text-muted-foreground max-w-xs">Mulai dengan menambahkan players dan membuat tournament melalui Panel Admin</p>
      </div>
    );
  }

  const t = data.activeTournament;

  return (
    <>
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5 max-w-5xl mx-auto">

      {/* ========== HERO BANNER ========== */}
      <motion.div variants={item} className={`relative rounded-2xl overflow-hidden ${dt.casinoCard} ${dt.neonPulse} min-h-[180px] casino-shimmer`}>
        <div className={dt.casinoBar} />
        <div className="absolute inset-0">
          <img src={division === 'male' ? cdnImage('/bg-male.jpg', 1920) : cdnImage('/bg-female.jpg', 1920)} alt="" className={`w-full h-full object-cover ${division === 'male' ? 'object-[center_25%]' : ''}`} aria-hidden="true" />
        </div>
        <div className="casino-img-overlay" />
        <div className={`absolute top-1/3 right-1/4 w-64 h-64 rounded-full blur-3xl ${dt.bg} opacity-30`} />
        <div className={`absolute top-3 left-3 ${dt.cornerAccent}`} />
        <div className={`absolute top-3 right-3 rotate-90 ${dt.cornerAccent}`} />
        <div className="absolute top-3 right-3 z-10">
          <StatusBadge status={t?.status || 'registration'} />
        </div>
        <div className="absolute bottom-4 left-5 right-5 z-10">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={`${dt.casinoBadge} px-2 py-0.5`}>
              🐉 Season {data.season?.number || 1}
            </Badge>
            <Badge className={`${dt.casinoBadge} px-2 py-0.5`}>
              {division === 'male' ? '🕺 Cowo' : '💃 Cewe'}
            </Badge>
          </div>
          <h2 className={`text-2xl lg:text-3xl font-black ${dt.neonGradient}`}>{t?.name || 'IDM League Babak'}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{data.season?.name}</p>
          <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className={`w-3 h-3 ${dt.neonText}`} />{t?.scheduledAt ? (parseWIBDate(t.scheduledAt) ? formatWIBWeekdayShort(parseWIBDate(t.scheduledAt)!) : 'Segera Hadir') : 'Segera Hadir'}</span>
            <span className="flex items-center gap-1"><MapPin className={`w-3 h-3 ${dt.neonText}`} />{t?.location || 'Online'}</span>
            <span className="flex items-center gap-1"><Flame className={`w-3 h-3 ${dt.neonText}`} />Week {t?.weekNumber || 5}</span>
            {t?.bpm && <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-red-400 live-dot" />{t.bpm} BPM</span>}
          </div>
        </div>
      </motion.div>

      {/* ========== COUNTDOWN + PRIZE POOL ========== */}
      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {t?.scheduledAt && t.status !== 'completed' && (
          <div className={`flex items-center justify-center rounded-xl ${dt.bgSubtle} ${dt.border} p-3`}>
            <CountdownTimer targetDate={t.scheduledAt} />
          </div>
        )}
        <div className={`p-4 sm:p-5 rounded-xl ${dt.bgSubtle} ${dt.border}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">💰 Prize Pool</span>
            <span className={`text-lg font-bold ${dt.neonGradient}`}>{formatCurrency(t?.prizePool || 0)}</span>
          </div>
          <Progress value={data.activeTournamentPrizePool > 0 ? Math.min((data.activeTournamentPrizePool / (data.activeTournamentPrizePool * 2 || 1)) * 100, 100) : 0} className="mt-2 h-1.5" />
          <p className="text-[10px] text-muted-foreground mt-1">Terkumpul: {formatCurrency(data.activeTournamentPrizePool ?? data.totalPrizePool)}</p>
        </div>
      </motion.div>

      {/* ========== QUICK STATS — Casino Pills ========== */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Users, value: `${data.totalPlayers}`, label: 'Players', color: 'from-idm-male to-idm-male-light' },
          { icon: Shield, value: `${data.clubs?.length || 0}`, label: 'Clubs', color: 'from-idm-female to-idm-female-light' },
          { icon: Wallet, value: formatCurrency(data.activeTournamentPrizePool ?? data.totalPrizePool).replace('Rp', '').trim(), label: 'Prize Pool', color: 'from-idm-gold-warm to-[#B7791F]' },
          { icon: Target, value: `${data.seasonProgress?.percentage || 0}%`, label: 'Progress', color: 'from-green-500 to-green-600' },
        ].map((stat, i) => (
          <motion.div key={i} whileHover={{ scale: 1.03, y: -2 }} className="group">
            <div className={`casino-pill ${dt.casinoGlow}`}>
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shrink-0`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className={`text-lg font-bold ${dt.neonGradient}`}>{stat.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* ========== SUB-NAVIGATION TABS — Toornament underline style ========== */}
      <Tabs defaultValue="overview" className="w-full">
        <div className={`border-b ${dt.border}`}>
          <TabsList className="bg-transparent h-auto p-0 gap-0 rounded-none">
            {[
              { value: 'overview', label: 'Ringkasan', icon: Trophy },
              { value: 'standings', label: 'Klasemen', icon: Award },
              { value: 'matches', label: 'Match', icon: Music },
              { value: 'participants', label: 'Peserta', icon: Gamepad2 },
            ].map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className={`relative px-4 py-2.5 text-xs font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-current data-[state=active]:bg-transparent data-[state=active]:shadow-none ${dt.text} data-[state=active]:${dt.text} text-muted-foreground hover:text-foreground transition-colors`}
              >
                <tab.icon className="w-3.5 h-3.5 mr-1.5 inline" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* ═══════════════ OVERVIEW TAB ═══════════════ */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">

            {/* Recent Results — Toornament match row style */}
            {data.recentMatches?.length > 0 ? (
              <motion.div variants={item}>
                <SectionCard title="Hasil Terbaru" icon={Radio} badge="LIVE">
                  <div className="space-y-2">
                    {data.recentMatches.slice(0, 6).map(m => (
                      <MatchRow
                        key={m.id}
                        club1={m.club1.name}
                        club2={m.club2.name}
                        score1={m.score1}
                        score2={m.score2}
                        week={m.week}
                        status="completed"
                      />
                    ))}
                  </div>
                </SectionCard>
              </motion.div>
            ) : (
              <motion.div variants={item}>
                <SectionCard title="Hasil Terbaru" icon={Radio} badge="LIVE">
                  <div className={`p-6 rounded-xl ${dt.bgSubtle} ${dt.border} text-center`}>
                    <Music className={`w-8 h-8 mx-auto mb-2 opacity-30 ${dt.text}`} />
                    <p className="text-sm text-muted-foreground">Belum ada hasil match</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">Match yang sudah selesai akan muncul di sini</p>
                  </div>
                </SectionCard>
              </motion.div>
            )}

            {/* Top Players — Tabbed: Podium / Juara Pekan Ini */}
            <motion.div variants={item}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-7 h-7 rounded-lg ${dt.iconBg} flex items-center justify-center shrink-0`}>
                  <Crown className={`w-3.5 h-3.5 ${dt.neonText}`} />
                </div>
                <h3 className="text-sm font-semibold">Top Players</h3>
              </div>

              {/* Sub-tabs — underline style */}
              <div className={`flex items-center gap-1 mb-3 border-b ${dt.border}`}>
                <button
                  onClick={() => setTopPlayerTab('top3')}
                  className={`relative px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                    topPlayerTab === 'top3'
                      ? `border-current ${dt.text}`
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Trophy className="w-3 h-3 mr-1 inline" />
                  Top 3
                </button>
                <button
                  onClick={() => setTopPlayerTab('champion')}
                  className={`relative px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                    topPlayerTab === 'champion'
                      ? `border-current ${dt.text}`
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Crown className="w-3 h-3 mr-1 inline" />
                  Juara Pekan Ini
                </button>
                <button
                  onClick={() => setTopPlayerTab('mvp')}
                  className={`relative px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                    topPlayerTab === 'mvp'
                      ? `border-current ${dt.text}`
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Award className="w-3 h-3 mr-1 inline" />
                  MVP
                </button>
              </div>

              {/* Tab Content */}
              {topPlayerTab === 'top3' && (
                <>
                  {data.topPlayers?.length > 0 ? (
                    <div className="grid grid-cols-3 gap-3">
                      {data.topPlayers.slice(0, 3).map((p, idx) => (
                        <PlayerCard
                          key={p.id}
                          gamertag={p.gamertag}
                          avatar={p.avatar}
                          points={p.points}
                          totalWins={p.totalWins}
                          totalMvp={p.totalMvp}
                          streak={p.streak}
                          rank={idx + 1}
                          isMvp={p.totalMvp > 0 && idx === 0}
                          club={p.club}
                          onClick={() => setSelectedPlayer(p)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className={`p-6 rounded-xl ${dt.bgSubtle} ${dt.border} text-center`}>
                      <Users className={`w-8 h-8 mx-auto mb-2 opacity-30 ${dt.text}`} />
                      <p className="text-sm text-muted-foreground">Belum ada peserta terdaftar</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">Peserta akan muncul setelah pendaftaran</p>
                    </div>
                  )}
                </>
              )}

              {topPlayerTab === 'champion' && (
                <>
                  {data.weeklyChampions?.length > 0 ? (
                    (() => {
                      const completedWeeks = data.weeklyChampions.map(c => c.weekNumber);
                      const totalWeeks = data.seasonProgress?.totalWeeks || 11;
                      const selected = data.weeklyChampions.find(c => c.weekNumber === selectedChampionWeek) || data.weeklyChampions[data.weeklyChampions.length - 1];
                      const winnerTeam = selected.winnerTeam;
                      const championPlayers = winnerTeam?.players || [];
                      return (
                        <div className="space-y-3">
                          {/* Team banner */}
                          <div className={`flex items-center gap-3 p-4 sm:p-5 rounded-xl ${dt.bgSubtle} ${dt.border}`}>
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center shadow-lg shrink-0`}>
                              <Crown className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-yellow-400 truncate">{winnerTeam?.name || 'TBD'}</p>
                              <p className="text-[10px] text-muted-foreground">Week {selected.weekNumber} Champion • {selected.tournamentName}</p>
                            </div>
                            <Badge className="bg-yellow-500/15 text-yellow-500 border-0 text-[9px]">🏆 JUARA</Badge>
                          </div>
                          {/* 3 Players in the winning team */}
                          {championPlayers.length > 0 ? (
                            <div className="grid grid-cols-3 gap-3">
                              {championPlayers.map((p, idx) => (
                                <PlayerCard
                                  key={p.id}
                                  gamertag={p.gamertag}
                                  avatar={p.avatar}
                                  points={p.points}
                                  totalWins={p.totalWins}
                                  totalMvp={p.totalMvp}
                                  streak={p.streak}
                                  rank={idx + 1}
                                  isMvp={selected.mvp?.id === p.id}
                                  onClick={() => setSelectedPlayer({
                                    ...p,
                                    name: p.gamertag,
                                    maxStreak: 0,
                                    club: undefined,
                                    division: division,
                                  })}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className={`p-6 rounded-xl ${dt.bgSubtle} ${dt.border} text-center`}>
                              <p className="text-sm text-muted-foreground">Belum ada data week ini</p>
                            </div>
                          )}
                          {/* Week Navigator */}
                          <WeekNavigator
                            totalWeeks={totalWeeks}
                            completedWeeks={completedWeeks}
                            selectedWeek={selectedChampionWeek}
                            onWeekChange={setSelectedChampionWeek}
                            accent={division === 'male' ? '#06b6d4' : '#a855f7'}
                            accentLight={division === 'male' ? '#22d3ee' : '#c084fc'}
                            size="sm"
                          />
                        </div>
                      );
                    })()
                  ) : (
                    <div className={`p-6 rounded-xl ${dt.bgSubtle} ${dt.border} text-center`}>
                      <Crown className={`w-8 h-8 mx-auto mb-2 opacity-30 text-yellow-500`} />
                      <p className="text-sm text-muted-foreground">Belum ada juara pekan ini</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">Juara akan muncul setelah turnamen selesai</p>
                    </div>
                  )}
                </>
              )}

              {topPlayerTab === 'mvp' && (
                <>
                  {data.mvpHallOfFame?.length > 0 ? (
                    (() => {
                      const mvpWeeks = data.mvpHallOfFame.map(m => m.weekNumber);
                      const totalWeeks = data.seasonProgress?.totalWeeks || 11;
                      const selectedMvp = data.mvpHallOfFame.find(m => m.weekNumber === selectedMvpWeek) || data.mvpHallOfFame[data.mvpHallOfFame.length - 1];
                      return (
                        <div className="space-y-3">
                          {/* Week label */}
                          <div className={`flex items-center gap-2 px-1`}>
                            <div className={`w-5 h-5 rounded bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center shrink-0`}>
                              <Award className="w-3 h-3 text-white" />
                            </div>
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Week {selectedMvp.weekNumber}</span>
                            <span className="text-[9px] text-muted-foreground/50 truncate">{selectedMvp.tournamentName}</span>
                          </div>
                          {/* MVP Player Card + Stats */}
                          <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-1">
                              <PlayerCard
                                gamertag={selectedMvp.gamertag}
                                avatar={selectedMvp.avatar}
                                points={selectedMvp.points}
                                totalWins={selectedMvp.totalWins}
                                totalMvp={selectedMvp.totalMvp}
                                streak={selectedMvp.streak}
                                rank={1}
                                isMvp={true}
                                onClick={() => setSelectedPlayer({
                                  ...selectedMvp,
                                  name: selectedMvp.gamertag,
                                  maxStreak: 0,
                                  club: undefined,
                                  division: selectedMvp.division || division,
                                  matches: 0,
                                })}
                              />
                            </div>
                            {/* MVP stats highlight */}
                            <div className={`col-span-2 flex flex-col justify-center gap-2 p-4 sm:p-5 rounded-xl ${dt.bgSubtle} ${dt.border}`}>
                              <div className="flex items-center gap-2">
                                <Crown className="w-4 h-4 text-yellow-400" />
                                <span className="text-sm font-bold text-yellow-400">{selectedMvp.gamertag}</span>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div className={`p-3 sm:p-4 rounded-lg ${dt.bgSubtle} ${dt.borderSubtle} text-center`}>
                                  <p className={`text-sm font-bold ${dt.neonText}`}>{selectedMvp.totalMvp}x</p>
                                  <p className="text-[9px] text-muted-foreground">MVP</p>
                                </div>
                                <div className={`p-3 sm:p-4 rounded-lg ${dt.bgSubtle} ${dt.borderSubtle} text-center`}>
                                  <p className={`text-sm font-bold ${dt.neonText}`}>{selectedMvp.points}</p>
                                  <p className="text-[9px] text-muted-foreground">Points</p>
                                </div>
                                <div className={`p-3 sm:p-4 rounded-lg ${dt.bgSubtle} ${dt.borderSubtle} text-center`}>
                                  <p className={`text-sm font-bold ${dt.neonText}`}>{selectedMvp.totalWins}</p>
                                  <p className="text-[9px] text-muted-foreground">Wins</p>
                                </div>
                              </div>
                            </div>
                          </div>
                          {/* Week Navigator */}
                          <WeekNavigator
                            totalWeeks={totalWeeks}
                            completedWeeks={mvpWeeks}
                            selectedWeek={selectedMvpWeek}
                            onWeekChange={setSelectedMvpWeek}
                            accent={division === 'male' ? '#06b6d4' : '#a855f7'}
                            accentLight={division === 'male' ? '#22d3ee' : '#c084fc'}
                            size="sm"
                          />
                        </div>
                      );
                    })()
                  ) : (
                    <div className={`p-6 rounded-xl ${dt.bgSubtle} ${dt.border} text-center`}>
                      <Award className={`w-8 h-8 mx-auto mb-2 opacity-30 text-yellow-500`} />
                      <p className="text-sm text-muted-foreground">Belum ada MVP</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">MVP akan ditampilkan setelah turnamen selesai dan ditentukan oleh admin</p>
                    </div>
                  )}
                </>
              )}
            </motion.div>
            <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SectionCard title="Donasi & Sawer" icon={Gift} badge="LIVE">
                <div className={`p-4 sm:p-5 rounded-xl ${dt.bgSubtle} ${dt.border} mb-3`}>
                  <p className="text-xs text-muted-foreground mb-1">Total Prize Pool</p>
                  <p className={`text-xl font-bold ${dt.neonGradient}`}>{formatCurrency(data.activeTournamentPrizePool ?? data.totalPrizePool)}</p>
                  <Progress value={(data.activeTournamentPrizePool ?? data.totalPrizePool) > 0 ? Math.min(((data.activeTournamentPrizePool ?? data.totalPrizePool) / ((data.activeTournamentPrizePool ?? data.totalPrizePool) * 2 || 1)) * 100, 100) : 0} className="mt-2 h-1.5" />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">Donatur Teratas</p>
                  {data.topDonors?.length > 0 ? (
                    data.topDonors.slice(0, 3).map((d, i) => (
                      <div key={i} className={`flex items-center justify-between text-xs p-3 sm:p-4 rounded-lg ${dt.bgSubtle} ${dt.borderSubtle}`}>
                        <span className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            i === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                            i === 1 ? 'bg-gray-400/20 text-muted-foreground' :
                            `${dt.iconBg} ${dt.text}`
                          }`}>{i + 1}</span>
                          {d.donorName}
                        </span>
                        <span className={`font-semibold ${dt.neonText}`}>{formatCurrency(d.totalAmount)}</span>
                      </div>
                    ))
                  ) : (
                    <div className={`p-6 rounded-xl ${dt.bgSubtle} ${dt.border} text-center`}>
                      <Gift className={`w-8 h-8 mx-auto mb-2 opacity-30 ${dt.text}`} />
                      <p className="text-sm text-muted-foreground">Belum ada donasi</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">Donasi akan muncul di sini</p>
                    </div>
                  )}
                </div>
              </SectionCard>

              <SectionCard title="Season Progress" icon={TrendingUp} badge={`${data.seasonProgress?.percentage}%`}>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">{data.season?.name}</span>
                      <span className={`font-semibold ${dt.neonText}`}>{data.seasonProgress?.completedWeeks}/{data.seasonProgress?.totalWeeks} Weeks</span>
                    </div>
                    <Progress value={data.seasonProgress?.percentage || 0} className="h-2.5" />
                    <p className={`text-[10px] ${dt.neonText} font-semibold mt-1`}>{data.seasonProgress?.percentage}% Selesai</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className={`p-2.5 rounded-xl ${dt.bgSubtle} ${dt.border} text-center`}>
                      <p className={`text-lg font-bold ${dt.neonText}`}>{data.totalPlayers}</p>
                      <p className="text-[10px] text-muted-foreground">Players</p>
                    </div>
                    <div className={`p-2.5 rounded-xl ${dt.bgSubtle} ${dt.border} text-center cursor-pointer`} onClick={() => setSelectedClub(data.clubs?.[0])}>
                      <p className={`text-lg font-bold ${dt.neonText}`}>{data.clubs?.length || 0}</p>
                      <p className="text-[10px] text-muted-foreground">Clubs</p>
                    </div>
                    <div className={`p-2.5 rounded-xl ${dt.bgSubtle} ${dt.border} text-center`}>
                      <p className={`text-sm font-bold ${dt.neonText}`}>{formatCurrency(data.seasonDonationTotal || 0)}</p>
                      <p className="text-[10px] text-muted-foreground">Terdanai</p>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </motion.div>

            {/* Featured Match — DanceMatchCard style */}
            {t?.matches?.filter(m => m.status === 'completed').length ? (
              <motion.div variants={item}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-7 h-7 rounded-lg ${dt.iconBg} flex items-center justify-center shrink-0`}>
                    <Music className={`w-3.5 h-3.5 ${dt.neonText}`} />
                  </div>
                  <h3 className="text-sm font-semibold">Match Unggulan</h3>
                  <Badge className={`${dt.casinoBadge} ml-auto`}>HASIL</Badge>
                </div>
                {t!.matches.filter(m => m.status === 'completed').slice(-1).map(m => (
                  <DanceMatchCard
                    key={m.id}
                    team1={m.team1}
                    team2={m.team2}
                    score1={m.score1}
                    score2={m.score2}
                    status={m.status}
                    week={t!.weekNumber}
                    mvpPlayer={m.mvpPlayer}
                  />
                ))}
              </motion.div>
            ) : null}
          </motion.div>
        </TabsContent>

        {/* ═══════════════ STANDINGS TAB — Toornament Style ═══════════════ */}
        <TabsContent value="standings" className="mt-4 space-y-4">
          <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">

            {/* Toornament-style sub-tabs for Players/Clubs */}
            <div className={`flex items-center gap-1 p-1 rounded-lg ${dt.bgSubtle} ${dt.border} w-fit`}>
              <button
                onClick={() => setLeaderboardSort('players')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${leaderboardSort === 'players' ? `${dt.bg} ${dt.text} shadow-sm` : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Users className="w-3 h-3" /> Players
              </button>
              <button
                onClick={() => setLeaderboardSort('clubs')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${leaderboardSort === 'clubs' ? `${dt.bg} ${dt.text} shadow-sm` : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Shield className="w-3 h-3" /> Clubs
              </button>
            </div>

            {/* Player Leaderboard — Card-per-row design */}
            {leaderboardSort === 'players' && (
              <motion.div variants={item} className="space-y-3">
                {/* Section header */}
                <div className="flex items-center gap-2.5 px-1">
                  <div className={`w-5 h-5 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
                    <Award className={`w-3 h-3 ${dt.neonText}`} />
                  </div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Peringkat Player</h3>
                  <Badge className={`${dt.casinoBadge} ml-auto text-[9px]`}>TOP {displayedPlayers?.length || 10}</Badge>
                </div>

                {/* Card list */}
                <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-0.5">
                  {displayedPlayers?.map((p, idx) => {
                    const losses = p.matches - p.totalWins;
                    const isTop = idx < 3;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedPlayer(p)}
                        className={`rounded-xl border cursor-pointer transition-all duration-200 ${
                          idx === 0
                            ? 'bg-gradient-to-br from-idm-gold-warm/[0.06] via-card/80 to-idm-gold-warm/[0.03] border-idm-gold-warm/20 shadow-[0_0_10px_rgba(239,249,35,0.06),0_0_20px_rgba(239,249,35,0.03)]'
                            : isTop
                              ? 'bg-card/60 border-border/30'
                              : idx % 2 === 0
                                ? 'bg-card/50 border-border/20'
                                : 'bg-card/35 border-border/15'
                        } hover:border-idm-gold-warm/20 hover:bg-card/70`}
                      >
                        <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3">
                          {/* Rank */}
                          <span className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold shrink-0 ${
                            idx === 0
                              ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-black shadow-md shadow-yellow-500/25'
                              : idx === 1
                                ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-black shadow-md shadow-gray-400/20'
                                : idx === 2
                                  ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white shadow-md shadow-amber-600/20'
                                  : 'bg-muted text-muted-foreground'
                          }`}>{idx + 1}</span>

                          {/* Avatar */}
                          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden shrink-0 ${
                            idx === 0 ? 'ring-2 ring-idm-gold-warm/50' :
                            idx === 1 ? 'ring-2 ring-gray-400/40' :
                            idx === 2 ? 'ring-2 ring-amber-600/40' : ''
                          }`}>
                            <div className={`w-full h-full ${dt.iconBg} flex items-center justify-center text-[10px] font-bold ${dt.text}`}>
                              {p.gamertag.slice(0, 2).toUpperCase()}
                            </div>
                          </div>

                          {/* Player info */}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm font-medium truncate">{p.gamertag}</p>
                            {p.club && <p className="text-[9px] text-muted-foreground truncate">{clubName(p.club)}</p>}
                          </div>

                          {/* Stats */}
                          <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-border/40 shrink-0">
                            <div className="text-center min-w-[36px]">
                              <p className={`text-sm sm:text-base font-bold ${isTop ? dt.neonText : ''}`}>{p.points}</p>
                              <p className="text-[8px] text-muted-foreground uppercase">pts</p>
                            </div>
                            <div className="hidden sm:flex items-center gap-2">
                              <div className="text-center min-w-[20px]">
                                <p className="text-xs text-green-500 font-semibold">{p.totalWins}</p>
                                <p className="text-[7px] text-muted-foreground">W</p>
                              </div>
                              <div className="text-center min-w-[20px]">
                                <p className="text-xs text-red-500 font-semibold">{losses > 0 ? losses : 0}</p>
                                <p className="text-[7px] text-muted-foreground">L</p>
                              </div>
                            </div>
                            <div className="hidden md:block text-center min-w-[28px]">
                              {p.streak > 1 ? (
                                <span className="text-orange-400 font-semibold flex items-center gap-0.5 justify-center text-xs"><Flame className="w-3 h-3" />{p.streak}</span>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                              <p className="text-[7px] text-muted-foreground">streak</p>
                            </div>
                            <div className="hidden sm:block text-center min-w-[20px]">
                              {p.totalMvp > 0 ? (
                                <p className="text-yellow-500 font-semibold text-xs">{p.totalMvp}</p>
                              ) : (
                                <p className="text-muted-foreground text-xs">0</p>
                              )}
                              <p className="text-[7px] text-muted-foreground">mvp</p>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 hidden sm:block" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Show more / less toggle */}
                {data.topPlayers?.length > 10 && (
                  <div className="flex items-center justify-center pt-1">
                    <button
                      onClick={() => setShowAllPlayers(!showAllPlayers)}
                      className={`flex items-center gap-1 text-[10px] font-medium ${dt.text} hover:underline cursor-pointer`}
                    >
                      {showAllPlayers ? <><ChevronUp className="w-3 h-3" /> Tampilkan Sedikit</> : <><ChevronDown className="w-3 h-3" /> Tampilkan Semua ({data.topPlayers.length})</>}
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* Club Standings — Card-per-row design */}
            {leaderboardSort === 'clubs' && (
              <motion.div variants={item} className="space-y-3">
                {/* Section header */}
                <div className="flex items-center gap-2.5 px-1">
                  <div className={`w-5 h-5 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
                    <Shield className={`w-3 h-3 ${dt.neonText}`} />
                  </div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Klasemen Club</h3>
                  <Badge className={`${dt.casinoBadge} ml-auto text-[9px]`}>{data.clubs?.length || 0} Clubs</Badge>
                </div>

                {data.clubs?.length > 0 ? (
                  <>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-0.5">
                      {displayedClubs?.map((club, idx) => {
                        const isTop = idx < 4;
                        return (
                          <div
                            key={club.id}
                            onClick={() => setSelectedClub(club)}
                            className={`rounded-xl border cursor-pointer transition-all duration-200 ${
                              idx === 0
                                ? 'bg-gradient-to-br from-idm-gold-warm/[0.06] via-card/80 to-idm-gold-warm/[0.03] border-idm-gold-warm/20 shadow-[0_0_10px_rgba(239,249,35,0.06),0_0_20px_rgba(239,249,35,0.03)]'
                                : isTop
                                  ? 'bg-card/60 border-border/30'
                                  : idx % 2 === 0
                                    ? 'bg-card/50 border-border/20'
                                    : 'bg-card/35 border-border/15'
                            } hover:border-idm-gold-warm/20 hover:bg-card/70`}
                          >
                            <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3">
                              {/* Rank */}
                              <span className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold shrink-0 ${
                                idx === 0
                                  ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-black shadow-md shadow-yellow-500/25'
                                  : idx === 1
                                    ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-black shadow-md shadow-gray-400/20'
                                    : idx === 2
                                      ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white shadow-md shadow-amber-600/20'
                                      : 'bg-muted text-muted-foreground'
                              }`}>{idx + 1}</span>

                              {/* Club logo */}
                              <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg ${dt.iconBg} flex items-center justify-center shrink-0`}>
                                <Shield className={`w-4 h-4 ${dt.text}`} />
                              </div>

                              {/* Club info */}
                              <div className="min-w-0 flex-1">
                                <p className="text-xs sm:text-sm font-semibold truncate">{club.name}</p>
                              </div>

                              {/* Stats */}
                              <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-border/40 shrink-0">
                                <div className="hidden sm:flex items-center gap-2">
                                  <div className="text-center min-w-[20px]">
                                    <p className="text-xs text-green-500 font-semibold">{club.wins}</p>
                                    <p className="text-[7px] text-muted-foreground">W</p>
                                  </div>
                                  <div className="text-center min-w-[20px]">
                                    <p className="text-xs text-red-500 font-semibold">{club.losses}</p>
                                    <p className="text-[7px] text-muted-foreground">L</p>
                                  </div>
                                </div>
                                <div className="hidden md:block text-center min-w-[28px]">
                                  <span className={`text-xs font-semibold ${club.gameDiff > 0 ? 'text-green-500' : club.gameDiff < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                                    {club.gameDiff > 0 ? '+' : ''}{club.gameDiff}
                                  </span>
                                  <p className="text-[7px] text-muted-foreground">selisih</p>
                                </div>
                                <div className="text-center min-w-[36px]">
                                  <p className={`text-sm sm:text-base font-bold ${idx === 0 ? dt.neonGradient : isTop ? dt.neonText : ''}`}>{club.points}</p>
                                  <p className="text-[8px] text-muted-foreground uppercase">pts</p>
                                </div>
                                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 hidden sm:block" />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {data.clubs?.length > 6 && (
                      <div className="flex items-center justify-center pt-1">
                        <button
                          onClick={() => setShowAllClubs(!showAllClubs)}
                          className={`flex items-center gap-1 text-[10px] font-medium ${dt.text} hover:underline cursor-pointer`}
                        >
                          {showAllClubs ? <><ChevronUp className="w-3 h-3" /> Tampilkan Sedikit</> : <><ChevronDown className="w-3 h-3" /> Tampilkan Semua ({data.clubs.length})</>}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className={`p-6 rounded-2xl ${dt.bgSubtle} ${dt.border} text-center`}>
                    <Shield className={`w-8 h-8 mx-auto mb-2 opacity-30 ${dt.text}`} />
                    <p className="text-sm text-muted-foreground">Belum ada club terdaftar</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">Club akan muncul setelah pendaftaran</p>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        </TabsContent>

        {/* ═══════════════ MATCHES TAB — MPL-Style Bracket ═══════════════ */}
        <TabsContent value="matches" className="mt-4 space-y-4">
          <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">

            {/* Bracket View — with type selector */}
            <motion.div variants={item}>
              <Card className={`${dt.casinoCard} overflow-hidden`}>
                <div className={dt.casinoBar} />
                <div className="relative z-10">
                  {/* Header with bracket type selector */}
                  <div className={`flex items-center gap-2.5 px-4 py-3 border-b ${dt.borderSubtle}`}>
                    <div className={`w-5 h-5 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
                      <Music className={`w-3 h-3 ${dt.neonText}`} />
                    </div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider">Bracket</h3>
                    <Badge className={`${dt.casinoBadge} ml-auto text-[9px]`}>{t?.matches?.length || recentMatches.length} Match</Badge>
                  </div>
                  {/* Bracket type sub-tabs */}
                  <div className={`flex items-center gap-1 px-4 py-2 border-b ${dt.borderSubtle}`}>
                    {[
                      { value: 'single_elimination', label: 'Elim. Langsung', icon: Music },
                      { value: 'group_stage', label: 'Fase Grup', icon: Users },
                      { value: 'upper_semi', label: 'Upper Semi', icon: Swords },
                      { value: 'round_robin', label: 'Round Robin', icon: Calendar },
                    ].map(bt => (
                      <button
                        key={bt.value}
                        onClick={() => setBracketType(bt.value)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                          bracketType === bt.value ? `${dt.bg} ${dt.text} shadow-sm` : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <bt.icon className="w-3 h-3" />
                        {bt.label}
                      </button>
                    ))}
                  </div>
                  <div className="p-4">
                    {t?.matches && t.matches.length > 0 ? (
                      <BracketView
                        matches={t.matches.map(m => ({
                          ...m,
                          round: 'round' in m ? (m as any).round || 1 : 1,
                        }))}
                        bracketType={bracketType as any}
                      />
                    ) : (
                      /* League matches — convert to bracket format */
                      <BracketView
                        matches={recentMatches.map(m => ({
                          id: m.id,
                          score1: m.score1 as number | null,
                          score2: m.score2 as number | null,
                          status: 'completed',
                          team1: { id: m.club1.name, name: m.club1.name },
                          team2: { id: m.club2.name, name: m.club2.name },
                          mvpPlayer: null,
                          round: m.week,
                        }))}
                        bracketType={bracketType as any}
                      />
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Completed Matches — grouped by week (Toornament match list style) */}
            {Object.keys(matchesByWeek).length > 0 && (
              <motion.div variants={item}>
                <SectionCard title="Hasil Match" icon={Trophy} badge={`${data.recentMatches?.length || 0} Match`}>
                  <div className="space-y-5">
                    {Object.entries(matchesByWeek)
                      .sort(([a], [b]) => Number(b) - Number(a))
                      .map(([week, matches]) => (
                        <div key={week}>
                          {/* Week header — toornament style */}
                          <div className={`flex items-center gap-3 mb-2.5`}>
                            <div className={`px-2.5 py-1 rounded-md ${dt.bg} ${dt.text} text-[10px] font-bold uppercase tracking-wider`}>
                              Week {week}
                            </div>
                            <div className={`flex-1 h-px ${dt.borderSubtle}`} />
                            <span className="text-[9px] text-muted-foreground">{matches.length} match</span>
                          </div>
                          <div className="space-y-2">
                            {matches.map(m => (
                              <MatchRow
                                key={m.id}
                                club1={m.club1.name}
                                club2={m.club2.name}
                                score1={m.score1}
                                score2={m.score2}
                                status="completed"
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </SectionCard>
              </motion.div>
            )}

            {/* Upcoming Matches — grouped by week */}
            {Object.keys(upcomingByWeek).length > 0 && (
              <motion.div variants={item}>
                <SectionCard title="Akan Datang" icon={Calendar} badge="JADWAL">
                  <div className="space-y-5">
                    {Object.entries(upcomingByWeek)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([week, matches]) => (
                        <div key={week}>
                          <div className="flex items-center gap-3 mb-2.5">
                            <div className={`px-2.5 py-1 rounded-md ${dt.bg} ${dt.text} text-[10px] font-bold uppercase tracking-wider`}>
                              Week {week}
                            </div>
                            <div className={`flex-1 h-px ${dt.borderSubtle}`} />
                            <span className="text-[9px] text-muted-foreground">{matches.length} match</span>
                          </div>
                          <div className="space-y-2">
                            {matches.map(m => (
                              <MatchRow
                                key={m.id}
                                club1={m.club1.name}
                                club2={m.club2.name}
                                score1={0}
                                score2={0}
                                status="upcoming"
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </SectionCard>
              </motion.div>
            )}

            {Object.keys(matchesByWeek).length === 0 && Object.keys(upcomingByWeek).length === 0 && (
              <motion.div variants={item}>
                <div className={`p-8 rounded-xl ${dt.bgSubtle} ${dt.border} text-center`}>
                  <Gamepad2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Belum ada match</p>
                </div>
              </motion.div>
            )}
          </motion.div>
        </TabsContent>

        {/* ═══════════════ PARTICIPANTS TAB — Tournament Poster Grid ═══════════════ */}
        <TabsContent value="participants" className="mt-4">
          <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
            <motion.div variants={item}>
              <ParticipantGrid
                players={data.topPlayers || []}
                onPlayerClick={(player) => setSelectedPlayer(player)}
              />
            </motion.div>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Player & Club Profiles */}
      {selectedPlayer && (
        <PlayerProfile player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
      )}
      {selectedClub && (
        <ClubProfile club={selectedClub} onClose={() => setSelectedClub(null)} />
      )}
    </motion.div>
    </>
  );
}
