'use client';

import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/lib/store';
// Note: motion.div removed — replaced with CSS animations
import {
  Music, Users, Crown, Trophy, ChevronRight, Calendar, MapPin, Heart,
  Swords, Clock, Zap, Gift
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from './status-badge';
import { DonationModal } from './donation-modal';
import { useState } from 'react';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { formatCurrency, parseWitaDate, formatWIBDateShort } from '@/lib/utils';
// container/item removed — replaced with CSS stagger-item classes

interface Tournament {
  id: string; name: string; weekNumber: number; division: string; status: string;
  prizePool: number; bpm: string | null; location: string; scheduledAt: string | null;
  teams: { id: string; name: string; isWinner: boolean; power: number;
    teamPlayers: { player: { id: string; name: string; gamertag: string; tier: string; points: number } }[]
  }[];
  matches: { id: string; score1: number | null; score2: number | null; status: string; round: number;
    team1: { id: string; name: string } | null; team2: { id: string; name: string } | null;
    mvpPlayer: { id: string; name: string; gamertag: string } | null
  }[];
  participations: { id: string; status: string; pointsEarned: number; isMvp: boolean; isWinner: boolean;
    player: { id: string; name: string; gamertag: string; tier: string; points: number }
  }[];
  donations: { id: string; donorName: string; amount: number }[];
  _count?: { teams: number; participations: number; matches: number };
}

export function TournamentView() {
  const { division } = useAppStore();
  const dt = useDivisionTheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [donationOpen, setDonationOpen] = useState(false);
  const [donationTournamentId, setDonationTournamentId] = useState<string | null>(null);

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

  const { data: tournaments } = useQuery<Tournament[]>({
    queryKey: ['tournaments', division],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments?division=${division}`);
      return res.json();
    },
  });

  const { data: selected } = useQuery<Tournament>({
    queryKey: ['tournament', selectedId],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${selectedId}`);
      return res.json();
    },
    enabled: !!selectedId,
  });

  // Tournament List View
  if (!selectedId) {
    const hasTournaments = tournaments && tournaments.length > 0;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Music className={`w-5 h-5 ${dt.neonText}`} />
          <h2 className="text-lg font-bold text-gradient-fury">Tournament Mingguan</h2>
        </div>

        {!hasTournaments ? (
          <div className="stagger-item-subtle">
            <div className={`rounded-2xl ${dt.casinoCard} overflow-hidden`}>
              <div className={dt.casinoBar} />
              <div className="p-8 sm:p-12">
                <div className="flex flex-col items-center text-center">
                  {/* Animated icon */}
                  <div
                    className="stagger-item-subtle relative mb-6"
                  >
                    <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${division === 'male' ? 'from-idm-male/20 to-idm-male-light/10' : 'from-idm-female/20 to-idm-female-light/10'} ${dt.border} flex items-center justify-center`}>
                      <Trophy className={`w-8 h-8 ${dt.neonText}`} />
                    </div>
                    {/* Floating dots */}
                    <div
                      className={`animate-bob-fade absolute -top-1 -right-1 w-3 h-3 rounded-full ${division === 'male' ? 'bg-idm-male' : 'bg-idm-female'} opacity-70`}
                    />
                  </div>

                  <h3 className={`text-xl font-bold ${dt.neonGradient} mb-2`}>Belum Ada Tournament</h3>
                  <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
                    Belum ada tournament yang dibuat untuk divisi {division === 'male' ? 'Cowo' : 'Cewe'} saat ini.
                    Tournament mingguan akan muncul di sini begitu admin membuatnya.
                  </p>

                  {/* What to expect */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg">
                    {[
                      { icon: Crown, label: 'Bracket System', desc: 'Eliminasi langsung setiap minggu' },
                      { icon: Music, label: 'Match Inti', desc: 'Pertandingan BO3/BO5' },
                      { icon: Trophy, label: 'Juara Pekanan', desc: 'Pemenang tiap week' },
                    ].map((step, i) => (
                      <div key={i} className={`p-4 sm:p-5 rounded-2xl ${dt.bgSubtle} ${dt.border} text-center`}>
                        <step.icon className={`w-5 h-5 mx-auto mb-1.5 ${dt.neonText}`} />
                        <p className="text-xs font-semibold">{step.label}</p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">{step.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tournaments.map((t, index) => {
            const teamCount = t._count?.teams || 0;
            const matchCount = t._count?.matches || 0;
            const winnerTeam = t.teams?.find(tm => tm.isWinner);
            const isCompleted = t.status === 'completed';
            return (
              <div key={t.id} className="stagger-item" style={{ animationDelay: `${index * 50}ms` }}>
                <Card
                  className={`${dt.casinoCard} ${dt.casinoGlow} casino-shimmer card-lift cursor-pointer ${t.status === 'main_event' ? dt.neonPulse : ''}`}
                  onClick={() => setSelectedId(t.id)}
                >
                  <div className={dt.casinoBar} />
                  <CardContent className="p-4 relative z-10">
                    {/* Top: Week + Division + Status */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[10px] ${dt.neonText} font-semibold uppercase tracking-wider`}>Week {t.weekNumber}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${t.division === 'male' ? 'bg-cyan-500/15 text-cyan-400' : 'bg-purple-500/15 text-purple-400'}`}>{t.division === 'male' ? '♂ Cowo' : '♀ Cewe'}</span>
                        </div>
                        <p className="text-sm font-bold truncate">{t.name}</p>
                      </div>
                      <StatusBadge status={t.status} />
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-3">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="w-3 h-3 shrink-0" />
                        <span>{t._count?.participations || 0} Peserta</span>
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Trophy className="w-3 h-3 shrink-0" />
                        <span>{formatCurrency(t.prizePool)}</span>
                      </span>
                      {teamCount > 0 && (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Swords className="w-3 h-3 shrink-0" />
                          <span>{teamCount} Tim</span>
                        </span>
                      )}
                      {matchCount > 0 && (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Zap className="w-3 h-3 shrink-0" />
                          <span>{matchCount} Match</span>
                        </span>
                      )}
                      {t.bpm && (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Heart className="w-3 h-3 shrink-0 text-red-400" />
                          <span>{t.bpm} BPM</span>
                        </span>
                      )}
                      {t.location && (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span>{t.location}</span>
                        </span>
                      )}
                      {t.scheduledAt && (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>{parseWitaDate(t.scheduledAt) ? formatWIBDateShort(parseWitaDate(t.scheduledAt)!) : ''}</span>
                        </span>
                      )}
                    </div>

                    {/* Winner Banner */}
                    {isCompleted && winnerTeam && (
                      <div className={`mt-3 flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${dt.bgSubtle} border ${dt.borderSubtle}`}>
                        <Crown className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                        <span className="text-[11px] font-semibold truncate">{winnerTeam.name}</span>
                        <Trophy className="w-3 h-3 text-idm-gold-warm shrink-0 ml-auto" />
                      </div>
                    )}

                    {/* Sawer Button + Bottom arrow */}
                    <div className="flex items-center justify-between mt-2.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDonationTournamentId(t.id); setDonationOpen(true); }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-gradient-to-r from-idm-gold-warm to-[#e8d5a3] text-black hover:opacity-90 transition-opacity cursor-pointer"
                      >
                        <Gift className="w-3 h-3" />
                        Sawer
                      </button>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
        )}
      </div>
    );
  }

  // Tournament Detail View — Read-only
  return (
    <div className="space-y-4">
      <button onClick={() => setSelectedId(null)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
        ← Kembali ke tournament
      </button>

      {selected && (
        <>
          {/* Header — Info only, no action buttons */}
          <div className="stagger-item-subtle stagger-d0">
            <Card className={`${dt.casinoCard} ${dt.cornerAccent} overflow-hidden`}>
              <div className={dt.casinoBar} />
              <CardContent className="p-0 relative z-10">
                <div className="relative p-4 casino-img-overlay">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className={`text-[10px] ${dt.neonText} font-semibold uppercase tracking-wider mb-1`}>Week {selected.weekNumber}</p>
                      <h2 className={`text-xl font-bold ${dt.neonGradient}`}>{selected.name}</h2>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        {selected.location && (
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {selected.location}</span>
                        )}
                        {selected.bpm && (
                          <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-red-400" /> {selected.bpm} BPM</span>
                        )}
                        {selected.scheduledAt && (
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {parseWitaDate(selected.scheduledAt) ? formatWIBDateShort(parseWitaDate(selected.scheduledAt)!) : ''}</span>
                        )}
                        {selected.prizePool > 0 && (
                          <span className="flex items-center gap-1"><Trophy className="w-3 h-3 text-idm-gold-warm" /> {formatCurrency(selected.prizePool)}</span>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={selected.status} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Registered Players — Read-only list */}
            <div className="stagger-item-subtle stagger-d1">
              <Card className={`${dt.casinoCard} h-full`}>
                <div className={dt.casinoBar} />
                <CardContent className="p-0 relative z-10">
                  <div className={`flex items-center gap-2.5 px-4 py-3 border-b ${dt.borderSubtle}`}>
                    <div className={`w-5 h-5 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
                      <Users className={`w-3 h-3 ${dt.neonText}`} />
                    </div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider">Players Terdaftar</h3>
                    <Badge className={`${dt.casinoBadge} ml-auto text-[9px]`}>{selected.participations?.length || 0}</Badge>
                  </div>
                  <div className="p-2 max-h-64 overflow-y-auto custom-scrollbar">
                    {selected.participations?.length > 0 ? selected.participations.map(p => (
                      <div key={p.id} className={`flex items-center justify-between px-2 py-2 rounded-lg ${dt.hoverBgSubtle} transition-colors border-b ${dt.borderSubtle} last:border-0`}>
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-full ${dt.iconBg} flex items-center justify-center text-[10px] font-bold ${dt.neonText}`}>
                            {p.player.gamertag.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-medium">{p.player.gamertag}</p>
                            <p className="text-[10px] text-muted-foreground">{p.player.points} pts</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {p.isMvp && <Crown className="w-3 h-3 text-yellow-500" />}
                          {p.isWinner && <Trophy className="w-3 h-3 text-idm-gold-warm" />}
                        </div>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground text-center py-8">Belum ada peserta</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Teams — Read-only list */}
            <div className="stagger-item-subtle stagger-d2">
              <Card className={`${dt.casinoCard} h-full`}>
                <div className={dt.casinoBar} />
                <CardContent className="p-0 relative z-10">
                  <div className={`flex items-center gap-2.5 px-4 py-3 border-b ${dt.borderSubtle}`}>
                    <div className={`w-5 h-5 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
                      <Music className={`w-3 h-3 ${dt.neonText}`} />
                    </div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider">Tim</h3>
                    <Badge className={`${dt.casinoBadge} ml-auto text-[9px]`}>{selected.teams?.length || 0}</Badge>
                  </div>
                  <div className="p-2 max-h-64 overflow-y-auto custom-scrollbar">
                    {selected.teams?.length > 0 ? (
                      selected.teams.map(t => (
                        <div key={t.id} className={`p-2.5 rounded-lg mb-1.5 border ${dt.borderSubtle} ${t.isWinner ? dt.bgSubtle : ''}`}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-semibold">{t.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-muted-foreground">Kekuatan: {t.power}</span>
                              {t.isWinner && <Crown className="w-3 h-3 text-yellow-500" />}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {t.teamPlayers.map((tp: any) => (
                              <div key={tp.player.id} className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full ${dt.bgSubtle} text-[10px]`}>
                                <span>{tp.player.gamertag}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">Tim belum di-generate</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Hasil Pertandingan — Simple match results list */}
          {selected.matches?.length > 0 && (
            <div className="stagger-item-subtle stagger-d3">
              <Card className={`${dt.casinoCard} overflow-hidden`}>
                <div className={dt.casinoBar} />
                <CardContent className="p-0 relative z-10">
                  <div className={`flex items-center gap-2.5 px-4 py-3 border-b ${dt.borderSubtle}`}>
                    <div className={`w-5 h-5 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
                      <Swords className={`w-3 h-3 ${dt.neonText}`} />
                    </div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider">Hasil Pertandingan</h3>
                    <Badge className={`${dt.casinoBadge} ml-auto text-[9px]`}>{selected.matches.length} Match</Badge>
                  </div>

                  <div className="p-2 max-h-80 overflow-y-auto custom-scrollbar">
                    {Object.entries(
                      selected.matches.reduce((acc, m) => {
                        if (!acc[m.round]) acc[m.round] = [];
                        acc[m.round].push(m);
                        return acc;
                      }, {} as Record<number, typeof selected.matches>)
                    ).map(([round, matches], roundIdx) => {
                      const totalRounds = Object.keys(selected.matches.reduce((acc, m) => { acc[m.round] = true; return acc; }, {} as Record<number, boolean>)).length;
                      const roundFromEnd = totalRounds - roundIdx;
                      const roundLabel = roundFromEnd === 1 ? 'Final' : roundFromEnd === 2 ? 'Semi Final' : roundFromEnd === 3 ? 'Perempat Final' : `Babak ${round}`;
                      return (
                      <div key={round} className="mb-3 last:mb-0">
                        {/* Round header */}
                        <div className={`inline-block mb-2 px-2.5 py-1 rounded-md ${dt.bg} ${dt.text} text-[10px] font-bold uppercase tracking-wider`}>
                          {roundLabel}
                        </div>

                        {matches.map((m) => {
                          const hasScore = m.score1 !== null && m.score2 !== null;
                          const winner1 = hasScore && m.score1! > m.score2!;
                          const winner2 = hasScore && m.score2! > m.score1!;
                          const isLive = m.status === 'live';
                          const isUpcoming = !hasScore && !isLive;
                          return (
                            <div key={m.id} className={`flex items-center gap-2 mb-1.5 last:mb-0 px-3 py-2.5 rounded-lg border ${dt.borderSubtle} ${dt.hoverBgSubtle} transition-colors ${isLive ? 'border-red-500/30' : ''}`}>
                              {/* Team 1 */}
                              <div className={`flex items-center gap-1.5 flex-1 min-w-0 ${winner1 ? '' : winner2 ? 'opacity-50' : ''}`}>
                                {winner1 && <span className={`${dt.neonText} text-xs`}>▸</span>}
                                <span className={`text-xs font-semibold truncate ${winner1 ? dt.neonText : 'text-foreground/90'}`}>{(m.team1?.name || 'TBD')}</span>
                              </div>

                              {/* Score / VS */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                {isLive ? (
                                  <span className="text-[10px] font-bold text-red-500 live-dot px-1.5 py-0.5 rounded bg-red-500/10">LIVE</span>
                                ) : isUpcoming ? (
                                  <span className="text-[10px] font-bold text-muted-foreground px-2 py-0.5 rounded bg-muted/50">VS</span>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <span className={`text-sm font-bold tabular-nums ${winner1 ? dt.neonText : 'text-muted-foreground'}`}>{m.score1}</span>
                                    <span className="text-[10px] text-muted-foreground">-</span>
                                    <span className={`text-sm font-bold tabular-nums ${winner2 ? dt.neonText : 'text-muted-foreground'}`}>{m.score2}</span>
                                  </div>
                                )}
                              </div>

                              {/* Team 2 */}
                              <div className={`flex items-center gap-1.5 flex-1 min-w-0 justify-end ${winner2 ? '' : winner1 ? 'opacity-50' : ''}`}>
                                <span className={`text-xs font-semibold truncate ${winner2 ? dt.neonText : 'text-foreground/90'}`}>{(m.team2?.name || 'TBD')}</span>
                                {winner2 && <span className={`${dt.neonText} text-xs`}>◂</span>}
                              </div>

                              {/* MVP indicator */}
                              {m.mvpPlayer && (
                                <div className="flex items-center gap-1 shrink-0 ml-1">
                                  <Crown className="w-3 h-3 text-yellow-500" />
                                  <span className="text-[9px] text-yellow-500 font-semibold hidden sm:inline">{m.mvpPlayer.gamertag}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );})}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Donation Modal */}
      <DonationModal
        open={donationOpen}
        onOpenChange={setDonationOpen}
        defaultType="weekly"
        cmsSettings={cms || {}}
      />
    </div>
  );
}
