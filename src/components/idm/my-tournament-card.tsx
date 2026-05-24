'use client';

import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search, Swords, Trophy, Crown, Clock, MapPin, Heart, Users,
  ChevronDown, ChevronUp, Zap, CheckCircle2, XCircle, Play,
  Music, Calendar, Shield, Target, Radio,
  Info, X
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

import { useDivisionTheme } from '@/hooks/use-division-theme';
import { useAppStore } from '@/lib/store';

/* ─── Types ─── */
interface Teammate {
  id: string; name: string; gamertag: string; tier: string; avatar?: string | null; isMe: boolean;
}
interface OpponentPlayer {
  id: string; name: string; gamertag: string; tier: string;
}
interface MatchInfo {
  id: string; round: number; matchNumber: number | null; bracket: string | null;
  status: string; format: string | null;
  opponent: { id?: string; name: string; players: OpponentPlayer[] };
  myScore: number | null; opponentScore: number | null;
  won: boolean; lost: boolean; isDraw: boolean;
  mvpPlayer: { id: string; name: string; gamertag: string } | null;
  scheduledAt: string | null;
}

/* ─── Status Step Indicator ─── */
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

/* ─── Round Label Helper ─── */
function getRoundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return 'Grand Final';
  if (fromEnd === 1) return 'Semi Final';
  if (fromEnd === 2) return 'Quarter Final';
  return `Ronde ${round}`;
}

/* ─── Status Badge Helper ─── */
function StatusBadge({ status, division }: { status: string; division: string }) {
  const config: Record<string, { label: string; class: string; icon: typeof Info }> = {
    setup: { label: 'Setup', class: 'bg-muted/30 text-muted-foreground', icon: Info },
    registration: { label: 'Pendaftaran', class: 'bg-blue-500/15 text-blue-400', icon: Users },
    approval: { label: 'Approval', class: 'bg-yellow-500/15 text-yellow-400', icon: Shield },
    team_generation: { label: 'Tim Dibentuk', class: 'bg-orange-500/15 text-orange-400', icon: Users },
    bracket_generation: { label: 'Bracket', class: 'bg-purple-500/15 text-purple-400', icon: Swords },
    main_event: { label: 'Main Event', class: division === 'male' ? 'bg-idm-male/15 text-idm-male' : 'bg-idm-female/15 text-idm-female', icon: Radio },
    finalization: { label: 'Finalisasi', class: 'bg-amber-500/15 text-amber-400', icon: Trophy },
    completed: { label: 'Selesai', class: 'bg-green-500/15 text-green-400', icon: CheckCircle2 },
  };
  const c = config[status] || config.setup;
  const Icon = c.icon;
  return (
    <Badge className={`${c.class} border-0 text-[9px] gap-0.5`}>
      <Icon className="w-2.5 h-2.5" />
      {c.label}
    </Badge>
  );
}

/* ─── Stat Pill Component ─── */
function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  const dt = useDivisionTheme();
  return (
    <div className={`text-center p-1.5 sm:p-2 rounded-lg bg-background/50 border border-border/20`}>
      <p className={`text-xs sm:text-sm font-bold ${color}`}>{value}</p>
      <p className="text-[8px] sm:text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Component — Auto-shows logged-in player + Search for others
   ═══════════════════════════════════════════════════════════════ */
export function MyTournamentCard() {
  const { division, playerAuth } = useAppStore();
  const dt = useDivisionTheme();
  const inputRef = useRef<HTMLInputElement>(null);

  // Manual search state
  const [searchName, setSearchName] = useState('');
  const [manualSubmittedName, setManualSubmittedName] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [showAllMatches, setShowAllMatches] = useState(false);

  // Detect logged-in player
  const isLoggedIn = playerAuth.isAuthenticated && !!playerAuth.account;
  const playerGamertag = isLoggedIn ? playerAuth.account!.player.gamertag : null;
  const playerDivision = isLoggedIn ? (playerAuth.account!.player.division === 'male' ? 'male' as const : 'female' as const) : null;
  const playerStats = isLoggedIn ? playerAuth.account!.player : null;

  // Use the player's division when logged in, otherwise use store division
  const effectiveDivision = (isLoggedIn && playerDivision) ? playerDivision : (division === 'female' ? 'female' as const : 'male' as const);

  /* ─── Auto query for logged-in player (derived, no setState in effect) ─── */
  const { data: autoData, isLoading: autoLoading } = useQuery({
    queryKey: ['my-tournament-status', playerGamertag, effectiveDivision],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/my-status?name=${encodeURIComponent(playerGamertag!)}&division=${effectiveDivision}&gamertag=${encodeURIComponent(playerGamertag!)}`);
      if (!res.ok) throw new Error('Gagal mengambil data');
      return res.json();
    },
    enabled: isLoggedIn && !!playerGamertag,
    refetchInterval: 300000,
    staleTime: 30000,
  });

  /* ─── Manual search query (for modal, different key to avoid cache collision) ─── */
  const { data: manualData, isLoading: manualLoading, error: manualError } = useQuery({
    queryKey: ['my-tournament-status-search', manualSubmittedName, effectiveDivision],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/my-status?name=${encodeURIComponent(manualSubmittedName)}&division=${effectiveDivision}&gamertag=${encodeURIComponent(manualSubmittedName)}`);
      if (!res.ok) throw new Error('Gagal mengambil data');
      return res.json();
    },
    enabled: !!manualSubmittedName && manualSubmittedName !== playerGamertag,
    refetchInterval: false,
  });

  const handleSearch = () => {
    if (!searchName.trim()) return;
    setManualSubmittedName(searchName.trim());
    setShowAllMatches(false);
    setModalOpen(true);
  };

  const handleModalClose = (open: boolean) => {
    if (!open) {
      setModalOpen(false);
    }
  };

  /* ─── RENDER: Inline status for logged-in player (auto-shown) ─── */
  const renderLoggedInStatus = () => {
    if (!isLoggedIn || !playerStats) return null;

    if (autoLoading && !autoData) {
      return (
        <div className={`rounded-xl border ${dt.borderSubtle} p-4`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-9 h-9 rounded-full ${dt.iconBg} animate-pulse`} />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-24 rounded bg-muted/30 animate-pulse" />
              <div className="h-2 w-32 rounded bg-muted/20 animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-muted/20 animate-pulse" />
            ))}
          </div>
        </div>
      );
    }

    const data = autoData;
    const hasTournament = data?.found && data?.hasActiveTournament;
    const hasTeam = hasTournament && data?.myTeam;

    // Base player card — always shown for logged-in user
    return (
      <div className="space-y-2.5">
        {/* Player Info Header */}
        <div className={`rounded-xl border p-3 sm:p-4 ${hasTeam ? (data.isChampion ? 'border-yellow-500/40 bg-yellow-500/5' : data.isEliminated ? 'border-red-500/20 bg-red-500/5' : `${dt.borderSubtle} ${dt.bgSubtle}`) : 'border-border/30'}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${dt.iconBg}`}>
              <span className={`text-xs font-bold ${dt.neonText}`}>{playerStats.gamertag.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{playerStats.gamertag}</p>
              <p className="text-[10px] text-muted-foreground">
                {playerStats.name}{playerStats.city ? ` • ${playerStats.city}` : ''}
              </p>
            </div>
            {hasTeam ? (
              data.isChampion ? (
                <Badge className="bg-yellow-500/15 text-yellow-500 border-0 text-[9px]"><Crown className="w-3 h-3 mr-0.5" /> Juara!</Badge>
              ) : data.isEliminated ? (
                <Badge className="bg-red-500/15 text-red-400 border-0 text-[9px]"><XCircle className="w-3 h-3 mr-0.5" /> Out</Badge>
              ) : (
                <Badge className="bg-green-500/15 text-green-400 border-0 text-[9px]"><Play className="w-3 h-3 mr-0.5" /> Aktif</Badge>
              )
            ) : (
              <Badge className={`text-[9px] border-0 ${playerStats.division === 'male' ? 'bg-idm-male/15 text-idm-male' : 'bg-idm-female/15 text-idm-female'}`}>
                {playerStats.division === 'male' ? '♂ Cowo' : '♀ Cewe'}
              </Badge>
            )}
          </div>

          {/* Stats Row — PTS, W, L, MVP, Streak */}
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2 mb-3">
            <StatPill label="PTS" value={playerStats.points} color={dt.neonText} />
            <StatPill label="W" value={playerStats.totalWins} color="text-green-400" />
            <StatPill label="L" value={Math.max(0, playerStats.matches - playerStats.totalWins)} color="text-red-400" />
            <StatPill label="MVP" value={playerStats.totalMvp} color="text-yellow-500" />
            <StatPill label="Streak" value={playerStats.streak} color="text-orange-400" />
          </div>

          {/* Team + Tournament info when in a team */}
          {hasTeam && (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {data.isChampion && <Crown className="w-4 h-4 text-yellow-500" />}
                  <span className={`text-sm font-bold ${data.isChampion ? 'text-yellow-500' : data.isEliminated ? 'text-red-400' : dt.neonText}`}>
                    {data.myTeam.name}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {data.myTeam.teammates.map((t: Teammate) => (
                  <div key={t.id} className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] ${
                    t.isMe
                      ? `bg-gradient-to-r ${effectiveDivision === 'male' ? 'from-idm-male/20 to-idm-male/5' : 'from-idm-female/20 to-idm-female/5'} border ${effectiveDivision === 'male' ? 'border-idm-male/30' : 'border-idm-female/30'}`
                      : 'bg-muted/20'
                  }`}>
                    <span className={t.isMe ? 'font-bold' : ''}>{t.gamertag}</span>
                    {t.isMe && <span className="text-[8px] opacity-60">(kamu)</span>}
                  </div>
                ))}
              </div>
              <div className={`px-3 py-2 rounded-lg ${dt.bgSubtle} border ${dt.borderSubtle}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground">{data.tournament.name} • Week {data.tournament.weekNumber}</span>
                  <Badge className={`${dt.casinoBadge} text-[9px]`}>{data.tournament.format?.replace('_', ' ').toUpperCase()}</Badge>
                </div>
                <TournamentProgress status={data.tournament.status} />
              </div>
            </>
          )}

          {/* No active tournament or not in team */}
          {!hasTournament && data?.found && (
            <div className="text-center mt-2">
              <Clock className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
              <p className="text-[11px] font-semibold">Belum Ada Turnamen Aktif</p>
              <p className="text-[10px] text-muted-foreground">{data.message}</p>
            </div>
          )}
          {hasTournament && !hasTeam && (
            <div className="mt-2">
              <div className={`p-2.5 rounded-lg ${dt.bgSubtle} border ${dt.borderSubtle} mb-2`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold">{data.tournament.name}</span>
                  <Badge className={`${dt.casinoBadge} text-[9px]`}>W{data.tournament.weekNumber}</Badge>
                </div>
                <TournamentProgress status={data.tournament.status} />
              </div>
              <div className="text-center">
                <Shield className={`w-5 h-5 ${dt.neonText} mx-auto mb-1 opacity-50`} />
                <p className="text-[11px] font-semibold">
                  {data.tournament.isCompleted ? 'Turnamen Selesai' :
                   data.tournament.status === 'registration' ? 'Pendaftaran Dibuka' :
                   data.tournament.status === 'approval' ? 'Menunggu Persetujuan' :
                   'Belum Masuk Tim'}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {data.tournament.isCompleted ? 'Cek hasilnya di Bracket.' :
                   data.tournament.status === 'approval' ? (data.participationStatus === 'registered' ? 'Pendaftaran menunggu persetujuan.' : data.participationStatus === 'approved' ? 'Disetujui! Tim akan dibentuk.' : data.message) :
                   data.message}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Live / Next / Eliminated / Champion cards */}
        {hasTeam && (
          <>
            {data.liveMatch && (
              <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <Zap className="w-3 h-3 text-red-500 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-red-500">LIVE SEKARANG!</h3>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                  <span className="text-xs font-bold">{data.myTeam.name}</span>
                  <span className="text-sm font-bold tabular-nums text-red-400">
                    {data.liveMatch.myScore ?? 0} - {data.liveMatch.opponentScore ?? 0}
                  </span>
                  <span className="text-xs font-bold">{data.liveMatch.opponent.name}</span>
                </div>
              </div>
            )}

            {data.nextMatch && !data.isEliminated && !data.liveMatch && (
              <div className={`p-3 rounded-xl border ${dt.borderSubtle} ${dt.bgSubtle}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${dt.iconBg}`}>
                    <Swords className={`w-3 h-3 ${dt.neonText}`} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold">Lawan Selanjutnya</h3>
                    <p className="text-[10px] text-muted-foreground">
                      {getRoundLabel(data.nextMatch.round, Math.max(...(data.myMatches || []).map((m: MatchInfo) => m.round), 1))}
                    </p>
                  </div>
                </div>
                <div className={`p-2.5 rounded-lg border ${dt.borderSubtle}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{data.nextOpponent?.name || 'TBD'}</span>
                    <Badge className={`${dt.casinoBadge} text-[9px]`}>Lawan</Badge>
                  </div>
                  {data.nextOpponent?.players?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {data.nextOpponent.players.map((p: OpponentPlayer) => (
                        <div key={p.id} className="px-1.5 py-0.5 rounded-full bg-muted/30 text-[9px]">{p.gamertag}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {data.isEliminated && !data.isChampion && (
              <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/5">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <div>
                    <h3 className="text-xs font-bold text-red-400">Tim Tereliminasi</h3>
                    <p className="text-[10px] text-muted-foreground">{data.eliminationInfo || 'Tim gugur dari bracket'}</p>
                  </div>
                </div>
              </div>
            )}

            {data.isChampion && (
              <div className="p-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 text-center">
                <Trophy className="w-6 h-6 text-yellow-500 mx-auto mb-1" />
                <h3 className="text-xs font-bold text-yellow-500">Selamat, Juara!</h3>
                <p className="text-[10px] text-muted-foreground">{data.myTeam.name} menang!</p>
              </div>
            )}

            {/* Match History — compact */}
            {data.myMatches?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`w-4 h-4 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
                    <Music className={`w-2.5 h-2.5 ${dt.neonText}`} />
                  </div>
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider">Riwayat</h3>
                  <Badge className={`${dt.casinoBadge} ml-auto text-[9px]`}>{data.completedMatchCount} Main</Badge>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                  {(showAllMatches ? data.myMatches : data.myMatches.slice(0, 4)).map((m: MatchInfo) => {
                    const isLive = m.status === 'live';
                    const totalRounds = Math.max(...data.myMatches.map((mm: MatchInfo) => mm.round), 1);
                    return (
                      <div key={m.id} className={`p-2 rounded-lg border ${
                        isLive ? 'border-red-500/30' :
                        m.won ? `border-green-500/20 ${dt.bgSubtle}` :
                        m.lost ? 'border-red-500/10' :
                        'border-border/20'
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] font-semibold text-muted-foreground">{getRoundLabel(m.round, totalRounds)}</span>
                          <div className="flex items-center gap-1">
                            {isLive && <Badge className="bg-red-500/15 text-red-500 border-0 text-[7px] animate-pulse">LIVE</Badge>}
                            {m.won && <Badge className="bg-green-500/15 text-green-400 border-0 text-[7px]">W</Badge>}
                            {m.lost && <Badge className="bg-red-500/15 text-red-400 border-0 text-[7px]">L</Badge>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-semibold flex-1 ${m.won ? 'text-green-400' : ''}`}>{data.myTeam.name}</span>
                          <span className={`text-xs font-bold tabular-nums ${m.won ? 'text-green-400' : m.lost ? 'text-red-400' : ''}`}>
                            {m.myScore !== null && m.opponentScore !== null ? `${m.myScore}-${m.opponentScore}` : 'VS'}
                          </span>
                          <span className={`text-[10px] font-semibold flex-1 text-right ${m.lost ? 'text-red-400' : ''}`}>{m.opponent.name}</span>
                        </div>
                        {m.mvpPlayer && (
                          <div className="flex items-center gap-1 mt-1">
                            <Crown className="w-2 h-2 text-yellow-500" />
                            <span className="text-[8px] text-yellow-500 font-medium">MVP: {m.mvpPlayer.gamertag}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {data.myMatches.length > 4 && (
                    <button onClick={() => setShowAllMatches(!showAllMatches)} className="w-full py-1 text-[9px] text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 transition-colors">
                      {showAllMatches ? <>Tutup <ChevronUp className="w-2.5 h-2.5" /></> : <>Lihat semua ({data.myMatches.length}) <ChevronDown className="w-2.5 h-2.5" /></>}
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  /* ─── RENDER: Modal content for manual search ─── */
  const renderModalContent = () => {
    if (manualLoading) {
      return (
        <div className="py-10 text-center">
          <div className="animate-spin-slow inline-block mb-3">
            <Swords className={`w-8 h-8 ${dt.neonText}`} />
          </div>
          <p className="text-sm text-muted-foreground">Mencari data turnamen...</p>
        </div>
      );
    }

    if (manualError) {
      return (
        <div className="text-center py-8">
          <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-red-400 mb-1">Gagal Memuat Data</h3>
          <p className="text-xs text-muted-foreground mb-3">Terjadi kesalahan saat mencari. Coba lagi.</p>
          <Button size="sm" variant="outline" onClick={() => { setManualSubmittedName(''); setSearchName(''); setModalOpen(false); }}>Tutup</Button>
        </div>
      );
    }

    const data = manualData;

    if (!data?.found) {
      return (
        <div className="text-center py-8">
          <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-red-400 mb-1">Tidak Ditemukan</h3>
          <p className="text-xs text-muted-foreground mb-1">{data?.message || 'Nama tidak ditemukan dalam database'}</p>
          <p className="text-[10px] text-muted-foreground/60 mt-2">Pastikan nama atau nickname sudah benar. Coba ketik nama lain.</p>
        </div>
      );
    }

    if (!data.hasActiveTournament) {
      return (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${dt.iconBg}`}>
              <Users className={`w-5 h-5 ${dt.neonText}`} />
            </div>
            <div>
              <p className="text-sm font-bold">{data.player.gamertag}</p>
              <p className="text-[10px] text-muted-foreground">{data.player.name} • {data.player.city}</p>
            </div>
          </div>
          <div className="text-center py-6">
            <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-base font-bold mb-1">Belum Ada Turnamen Aktif</h3>
            <p className="text-xs text-muted-foreground">{data.message}</p>
          </div>
        </div>
      );
    }

    if (!data.myTeam) {
      return (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${dt.iconBg}`}>
              <Users className={`w-5 h-5 ${dt.neonText}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{data.player.gamertag}</p>
              <p className="text-[10px] text-muted-foreground">{data.player.name} • {data.player.city}</p>
            </div>
          </div>
          <div className={`p-3 sm:p-4 rounded-lg ${dt.bgSubtle} border ${dt.borderSubtle} mb-4`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold">{data.tournament.name}</span>
              <Badge className={`${dt.casinoBadge} text-[9px]`}>Week {data.tournament.weekNumber}</Badge>
            </div>
            <TournamentProgress status={data.tournament.status} />
          </div>
          <div className="text-center py-3">
            <Shield className={`w-8 h-8 ${dt.neonText} mx-auto mb-2 opacity-50`} />
            <h3 className="text-sm font-bold mb-1">
              {data.tournament.isCompleted ? 'Turnamen Sudah Selesai' :
               data.tournament.status === 'registration' ? 'Pendaftaran Belum Dibuka' :
               data.tournament.status === 'approval' ? 'Menunggu Persetujuan' :
               'Belum Masuk Tim'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {data.tournament.isCompleted ? 'Turnamen ini sudah selesai. Cek hasilnya di tab League.' :
               data.tournament.status === 'registration' ? 'Tournament sedang dalam fase pendaftaran.' :
               data.tournament.status === 'approval' ? (data.participationStatus === 'registered' ? 'Pendaftaran kamu sedang menunggu persetujuan admin.' : data.participationStatus === 'approved' ? 'Kamu sudah disetujui! Tim akan segera dibentuk.' : data.message) :
               data.message}
            </p>
          </div>
        </div>
      );
    }

    /* ─── FULL RESULTS: Player Has a Team (modal) ─── */
    const tournament = data.tournament;
    const myTeam = data.myTeam;
    const myMatches = data.myMatches || [];
    const liveMatch = data.liveMatch;
    const nextMatch = data.nextMatch;
    const nextOpponent = data.nextOpponent;
    const totalRounds = Math.max(...myMatches.map((m: MatchInfo) => m.round), 1);

    return (
      <div className="space-y-3">
        {/* Player + Team Header */}
        <div className={`p-3 sm:p-4 rounded-xl border ${data.isChampion ? 'border-yellow-500/40 bg-yellow-500/5' : data.isEliminated ? 'border-red-500/20 bg-red-500/5' : `${dt.borderSubtle} ${dt.bgSubtle}`}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${dt.iconBg}`}>
              <Users className={`w-4.5 h-4.5 ${dt.neonText}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{data.player.gamertag}</p>
              <p className="text-[10px] text-muted-foreground">{data.player.name} • {data.player.city}</p>
            </div>
          </div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {data.isChampion && <Crown className="w-4 h-4 text-yellow-500" />}
              <span className={`text-sm font-bold ${data.isChampion ? 'text-yellow-500' : data.isEliminated ? 'text-red-400' : dt.neonText}`}>
                {myTeam.name}
              </span>
            </div>
            {data.isChampion ? (
              <Badge className="bg-yellow-500/15 text-yellow-500 border-0 text-[9px]"><Crown className="w-3 h-3 mr-0.5" /> Juara!</Badge>
            ) : data.isEliminated ? (
              <Badge className="bg-red-500/15 text-red-400 border-0 text-[9px]"><XCircle className="w-3 h-3 mr-0.5" /> Tereliminasi</Badge>
            ) : (
              <Badge className="bg-green-500/15 text-green-400 border-0 text-[9px]"><Play className="w-3 h-3 mr-0.5" /> Masih Bermain</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {myTeam.teammates.map((t: Teammate) => (
              <div key={t.id} className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] ${
                t.isMe
                  ? `bg-gradient-to-r ${effectiveDivision === 'male' ? 'from-idm-male/20 to-idm-male/5' : 'from-idm-female/20 to-idm-female/5'} border ${effectiveDivision === 'male' ? 'border-idm-male/30' : 'border-idm-female/30'}`
                  : `${dt.bgSubtle}`
              }`}>
                <span className={t.isMe ? 'font-bold' : ''}>{t.gamertag}</span>
                {t.isMe && <span className="text-[8px] opacity-60">(kamu)</span>}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/20">
            <span className="text-[10px] text-muted-foreground">
              Rekor: <span className="text-green-400 font-bold">{data.matchRecord.wins}W</span>
              <span className="mx-0.5">-</span>
              <span className="text-red-400 font-bold">{data.matchRecord.losses}L</span>
              {data.matchRecord.draws > 0 && <><span className="mx-0.5">-</span><span className="text-yellow-400 font-bold">{data.matchRecord.draws}D</span></>}
            </span>
            <span className="text-[10px] text-muted-foreground">
              Kekuatan: <span className="font-bold">{myTeam.power}</span>
            </span>
          </div>
        </div>

        {/* Tournament Info Footer */}
        <div className={`px-3 py-2.5 rounded-lg ${dt.bgSubtle} border ${dt.borderSubtle}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold text-muted-foreground">{tournament.name} • Week {tournament.weekNumber}</span>
            <Badge className={`${dt.casinoBadge} text-[9px]`}>{tournament.format?.replace('_', ' ').toUpperCase()}</Badge>
          </div>
          <TournamentProgress status={tournament.status} />
        </div>

        {/* Status Cards */}
        {liveMatch && (
          <div className="p-3 sm:p-4 rounded-xl border border-red-500/30 bg-red-500/5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-red-500 animate-pulse" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-red-500">LIVE SEKARANG!</h3>
                <p className="text-[10px] text-muted-foreground">{getRoundLabel(liveMatch.round, totalRounds)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <span className="text-xs font-bold">{myTeam.name}</span>
              <span className="text-sm font-bold tabular-nums text-red-400">
                {liveMatch.myScore ?? 0} - {liveMatch.opponentScore ?? 0}
              </span>
              <span className="text-xs font-bold">{liveMatch.opponent.name}</span>
            </div>
          </div>
        )}

        {nextMatch && !data.isEliminated && !liveMatch && (
          <div className={`p-3 sm:p-4 rounded-xl border ${dt.borderSubtle} ${dt.bgSubtle}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${dt.iconBg}`}>
                <Swords className={`w-3.5 h-3.5 ${dt.neonText}`} />
              </div>
              <div>
                <h3 className="text-xs font-bold">Lawan Selanjutnya</h3>
                <p className="text-[10px] text-muted-foreground">{getRoundLabel(nextMatch.round, totalRounds)} • {nextMatch.format || 'BO3'}</p>
              </div>
            </div>
            <div className={`p-3 rounded-xl border ${dt.borderSubtle}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold">{nextOpponent?.name || 'TBD'}</span>
                <Badge className={`${dt.casinoBadge} text-[9px]`}>Lawan</Badge>
              </div>
              {nextOpponent?.players?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {nextOpponent.players.map((p: OpponentPlayer) => (
                    <div key={p.id} className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted/30 text-[10px]">
                      <span>{p.gamertag}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {data.isEliminated && !data.isChampion && (
          <div className="p-3 sm:p-4 rounded-xl border border-red-500/20 bg-red-500/5">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-400 shrink-0" />
              <div>
                <h3 className="text-xs font-bold text-red-400">Tim Kamu Tereliminasi</h3>
                <p className="text-[10px] text-muted-foreground">{data.eliminationInfo || 'Tim kamu telah gugur dari bracket'}</p>
              </div>
            </div>
          </div>
        )}

        {data.isChampion && (
          <div className="p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5 text-center">
            <div className="animate-pulse-scale inline-block mb-2">
              <Trophy className="w-8 h-8 text-yellow-500" />
            </div>
            <h3 className="text-sm font-bold text-yellow-500 mb-1">Selamat, Juara!</h3>
            <p className="text-xs text-muted-foreground">{myTeam.name} memenangkan tournament ini!</p>
            {tournament.prizePool > 0 && <p className="text-xs text-yellow-500 font-bold mt-1">Hadiah: Rp {tournament.prizePool.toLocaleString('id-ID')}</p>}
          </div>
        )}

        {/* Match History */}
        {myMatches.length > 0 && (
          <div>
            <div className={`flex items-center gap-2.5 mb-2`}>
              <div className={`w-5 h-5 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
                <Music className={`w-3 h-3 ${dt.neonText}`} />
              </div>
              <h3 className="text-xs font-semibold uppercase tracking-wider">Riwayat Pertandingan</h3>
              <Badge className={`${dt.casinoBadge} ml-auto text-[9px]`}>{data.completedMatchCount} Main</Badge>
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
              {(showAllMatches ? myMatches : myMatches.slice(0, 5)).map((m: MatchInfo) => {
                const isLive = m.status === 'live';
                return (
                  <div key={m.id} className={`p-2.5 sm:p-3 rounded-lg border ${
                    isLive ? 'border-red-500/30' :
                    m.won ? `border-green-500/20 ${dt.bgSubtle}` :
                    m.lost ? 'border-red-500/10' :
                    'border-border/20'
                  }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-semibold text-muted-foreground">{getRoundLabel(m.round, totalRounds)}</span>
                      <div className="flex items-center gap-1.5">
                        {isLive && <Badge className="bg-red-500/15 text-red-500 border-0 text-[8px] animate-pulse">LIVE</Badge>}
                        {m.won && <Badge className="bg-green-500/15 text-green-400 border-0 text-[8px]">Menang</Badge>}
                        {m.lost && <Badge className="bg-red-500/15 text-red-400 border-0 text-[8px]">Kalah</Badge>}
                        {m.isDraw && <Badge className="bg-yellow-500/15 text-yellow-400 border-0 text-[8px]">Seri</Badge>}
                        {m.format && <Badge className={`${dt.casinoBadge} text-[8px]`}>{m.format}</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold flex-1 ${m.won ? 'text-green-400' : ''}`}>{myTeam.name}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {m.myScore !== null && m.opponentScore !== null ? (
                          <>
                            <span className={`text-sm font-bold tabular-nums ${m.won ? 'text-green-400' : m.lost ? 'text-red-400' : ''}`}>{m.myScore}</span>
                            <span className="text-[10px] text-muted-foreground">-</span>
                            <span className={`text-sm font-bold tabular-nums ${m.lost ? 'text-red-400' : m.won ? 'text-green-400' : ''}`}>{m.opponentScore}</span>
                          </>
                        ) : (
                          <span className="text-[10px] text-muted-foreground px-2 py-0.5 rounded bg-muted/50">VS</span>
                        )}
                      </div>
                      <span className={`text-xs font-semibold flex-1 text-right ${m.lost ? 'text-red-400' : ''}`}>{m.opponent.name}</span>
                    </div>
                    {m.mvpPlayer && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <Crown className="w-2.5 h-2.5 text-yellow-500" />
                        <span className="text-[9px] text-yellow-500 font-medium">MVP: {m.mvpPlayer.gamertag}</span>
                      </div>
                    )}
                  </div>
                );
              })}
              {myMatches.length > 5 && (
                <button onClick={() => setShowAllMatches(!showAllMatches)} className="w-full py-1.5 text-[10px] text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 transition-colors">
                  {showAllMatches ? <>Tutup <ChevronUp className="w-3 h-3" /></> : <>Lihat semua ({myMatches.length}) <ChevronDown className="w-3 h-3" /></>}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════
     RENDER: Main — Auto status for logged-in + Search for others
     ═══════════════════════════════════════════════════════════════ */
  return (
    <>
      {/* ── Logged-in Player Status (auto-shown inline) ── */}
      {isLoggedIn && renderLoggedInStatus()}

      {/* ── Search Input Bar (always visible) ── */}
      <div className={`rounded-xl border border-border/30 p-4 relative z-10 ${isLoggedIn ? 'mt-2.5' : ''}`}>
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${dt.iconBg}`}>
            <Target className={`w-5 h-5 ${dt.neonText}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-gradient-fury">Cari Turnamen Kamu</h3>
            <p className="text-[10px] text-muted-foreground">
              {isLoggedIn ? 'Status kamu sudah tampil di atas. Cari pemain lain:' : 'Ketik nama atau nickname lalu tekan Enter / Cari'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              ref={inputRef}
              placeholder={isLoggedIn ? "Cari pemain lain..." : "Contoh: montiel, Afroki..."}
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}
              className="pl-9 h-11 text-sm bg-background border-2 border-idm-gold/30 focus:border-idm-gold placeholder:text-muted-foreground/60 rounded-lg"
              maxLength={30}
              autoComplete="off"
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={!searchName.trim()}
            className={`h-11 px-4 text-sm font-bold gap-1.5 shrink-0 ${effectiveDivision === 'male' ? 'bg-idm-male hover:bg-idm-male/90 text-white' : 'bg-idm-female hover:bg-idm-female/90 text-white'}`}
          >
            <Search className="w-4 h-4" />
            Cari
          </Button>
        </div>
      </div>

      {/* ── Result Modal (for manual search only) ── */}
      <Dialog open={modalOpen} onOpenChange={handleModalClose}>
        <DialogContent showCloseButton={false} className="sm:max-w-lg p-0 overflow-hidden border-border/50 bg-background max-h-[85vh] flex flex-col">
          {/* Accessible title - visually hidden */}
          <DialogHeader className="sr-only">
            <DialogTitle>Info Turnamen</DialogTitle>
            <DialogDescription>Hasil pencarian turnamen untuk {manualSubmittedName}</DialogDescription>
          </DialogHeader>

          {/* Modal Header */}
          <div className={`relative h-16 bg-gradient-to-br ${effectiveDivision === 'male' ? 'from-idm-male via-idm-male/80 to-idm-male-light/60' : 'from-idm-female via-idm-female/80 to-idm-female-light/60'} overflow-hidden shrink-0`}>
            <div className="absolute inset-0 bg-black/10" />
            <div className="relative z-10 flex items-center justify-between h-full px-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <Target className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Info Turnamen</h2>
                  <p className="text-[10px] text-white/70">Hasil untuk &quot;{manualSubmittedName}&quot;</p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                aria-label="Tutup"
                className="w-8 h-8 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center hover:bg-black/40 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Modal Body — scrollable */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
            {renderModalContent()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
