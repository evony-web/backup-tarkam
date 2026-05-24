'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users, Music, Calendar, Trophy, Gamepad2, Shield,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BracketView } from '../bracket-view';
import { ClubLogoImage } from '../club-logo-image';
import { MatchDetailModal } from '../match-detail-modal';
import { SectionCard, MatchRow } from './shared';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import type { StatsData } from '@/types/stats';

interface MatchesTabProps {
  data: StatsData;
  recentMatches: StatsData['recentMatches'];
  upcomingMatches: StatsData['upcomingMatches'];
  matchesByWeek: Record<number, StatsData['recentMatches']>;
  upcomingByWeek: Record<number, StatsData['upcomingMatches']>;
  clubs?: StatsData['clubs'];
}

/* ─── Club Schedule Match Row — shows opponent & result from selected club's POV ─── */
function ClubMatchRow({ week, opponent, score1, score2, isHome, result, opponentLogo }: {
  week: number;
  opponent: string;
  score1: number | null;
  score2: number | null;
  isHome: boolean;
  result: string | null;
  opponentLogo?: string | null;
}) {
  const dt = useDivisionTheme();
  const isCompleted = result === 'win' || result === 'loss';
  const isUpcoming = result === 'upcoming';
  const myScore = isHome ? score1 : score2;
  const oppScore = isHome ? score2 : score1;

  return (
    <div className={`group flex items-stretch rounded-lg overflow-hidden ${dt.bgSubtle} ${dt.borderSubtle} border transition-all hover:shadow-sm`}>
      {/* Week indicator */}
      <div className={`w-10 shrink-0 flex items-center justify-center ${dt.bg} border-r ${dt.borderSubtle}`}>
        <span className={`text-[9px] font-bold ${dt.neonText}`}>W{week}</span>
      </div>
      {/* Match info */}
      <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2">
        <div className="shrink-0">
          <ClubLogoImage clubName={opponent} dbLogo={opponentLogo} alt={opponent} width={24} height={24} className="rounded-sm" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate">{isHome ? 'Home' : 'Away'} vs {opponent}</p>
          {isCompleted && myScore !== null && oppScore !== null ? (
            <p className="text-[10px] text-muted-foreground">
              <span className={result === 'win' ? 'text-green-500 font-bold' : 'text-red-500 font-bold'}>{myScore}</span>
              <span className="text-muted-foreground"> - </span>
              <span className={result === 'loss' ? 'text-green-500 font-bold' : 'text-red-500 font-bold'}>{oppScore}</span>
            </p>
          ) : isUpcoming ? (
            <p className="text-[10px] text-muted-foreground">Belum dimainkan</p>
          ) : null}
        </div>
      </div>
      {/* Result badge */}
      <div className="w-20 shrink-0 flex items-center justify-center border-l border-transparent">
        {result === 'win' ? (
          <Badge className="bg-green-500/10 text-green-500 text-[9px] border-0">✅ Menang</Badge>
        ) : result === 'loss' ? (
          <Badge className="bg-red-500/10 text-red-500 text-[9px] border-0">❌ Kalah</Badge>
        ) : isUpcoming ? (
          <Badge className="bg-yellow-500/10 text-yellow-500 text-[9px] border-0">Akan Datang</Badge>
        ) : (
          <Badge className={`${dt.casinoBadge} text-[9px]`}>VS</Badge>
        )}
      </div>
    </div>
  );
}

export function MatchesTab({ data, recentMatches, upcomingMatches, matchesByWeek, upcomingByWeek, clubs }: MatchesTabProps) {
  const dt = useDivisionTheme();

  const [bracketTypeManual, setBracketTypeManual] = useState<string | null>(null);
  const [selectedClubId, setSelectedClubId] = useState<string>('all');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [matchPreview, setMatchPreview] = useState<any>(null);
  // Auto-detect from tournament format, but allow manual override
  const tournamentFormat = data.activeTournament?.format;
  const bracketType = bracketTypeManual || tournamentFormat || 'swiss';

  const t = data.activeTournament;

  // Fetch club schedule when a specific club is selected
  const { data: clubScheduleData, isLoading: clubScheduleLoading } = useQuery({
    queryKey: ['club-schedule', selectedClubId, data.season?.id],
    queryFn: async () => {
      const res = await fetch(`/api/league-matches/club?clubId=${selectedClubId}${data.season?.id ? `&seasonId=${data.season.id}` : ''}`);
      return res.json();
    },
    enabled: selectedClubId !== 'all',
    staleTime: 30000,
  });

  // Group club schedule matches by week
  const clubMatchesByWeek = useMemo(() => {
    if (!clubScheduleData?.matches) return { completed: {} as Record<number, any[]>, upcoming: {} as Record<number, any[]> };
    const completed: Record<number, any[]> = {};
    const upcoming: Record<number, any[]> = {};
    for (const m of clubScheduleData.matches) {
      const bucket = (m.result === 'upcoming' || m.status === 'upcoming') ? upcoming : completed;
      if (!bucket[m.week]) bucket[m.week] = [];
      bucket[m.week].push(m);
    }
    return { completed, upcoming };
  }, [clubScheduleData]);

  const isClubSelected = selectedClubId !== 'all';

  return (
    <div className="space-y-4" style={{ contain: 'layout style' }}>

      {/* Bracket View — with type selector */}
      <div className="stagger-item-subtle stagger-d0">
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
                { value: 'swiss', label: '🇨🇭 Swiss', icon: Trophy },
                { value: 'single_elimination', label: 'Elim. Langsung', icon: Music },
                { value: 'group_stage', label: 'Fase Grup', icon: Users },
                { value: 'round_robin', label: 'Round Robin', icon: Calendar },
              ].map(bt => (
                <button
                  key={bt.value}
                  onClick={() => setBracketTypeManual(bt.value)}
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
      </div>

      {/* ═══ Club Filter — Filter matches by club ═══ */}
      {clubs && clubs.length > 0 && (
        <div className="stagger-item-subtle stagger-d1">
          <div className={`flex items-center gap-3 p-4 sm:p-5 rounded-2xl ${dt.bgSubtle} border ${dt.borderSubtle}`}>
            <div className={`w-5 h-5 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
              <Shield className={`w-3 h-3 ${dt.neonText}`} />
            </div>
            <span className="text-xs font-semibold shrink-0">Filter Club</span>
            <div className="flex-1 min-w-0">
              <Select value={selectedClubId} onValueChange={setSelectedClubId}>
                <SelectTrigger className={`w-full h-8 text-xs ${dt.bgSubtle} border ${dt.borderSubtle}`}>
                  <SelectValue placeholder="Semua Club" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Club</SelectItem>
                  {clubs.map(club => (
                    <SelectItem key={club.id} value={club.id}>
                      <div className="flex items-center gap-2">
                        <ClubLogoImage clubName={club.name} dbLogo={club.logo} alt={club.name} width={16} height={16} className="rounded-sm" />
                        <span>{club.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isClubSelected && clubScheduleData?.club && (
              <div className="flex items-center gap-1.5 shrink-0">
                <ClubLogoImage clubName={clubScheduleData.club.name} dbLogo={clubScheduleData.club.logo} alt={clubScheduleData.club.name} width={20} height={20} className="rounded-sm" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Conditional rendering: Club-filtered view vs All matches view ═══ */}
      {isClubSelected ? (
        /* ─── Club-specific schedule view ─── */
        <>
          {clubScheduleLoading ? (
            <div className={`p-6 rounded-2xl ${dt.bgSubtle} border ${dt.borderSubtle} text-center`}>
              <div className="animate-pulse space-y-2">
                <div className="h-4 w-24 bg-muted/20 rounded mx-auto" />
                <div className="h-8 w-full bg-muted/10 rounded" />
                <div className="h-8 w-full bg-muted/10 rounded" />
              </div>
            </div>
          ) : clubScheduleData?.matches?.length > 0 ? (
            <>
              {/* Completed club matches */}
              {Object.keys(clubMatchesByWeek.completed).length > 0 && (
                <div className="stagger-item-subtle stagger-d1">
                  <SectionCard title="Hasil Match" icon={Trophy} badge={`${clubScheduleData.matches.filter((m: { result: string }) => m.result === 'win' || m.result === 'loss').length} Match`}>
                    <div className="space-y-3">
                      {Object.entries(clubMatchesByWeek.completed)
                        .sort(([a], [b]) => Number(b) - Number(a))
                        .map(([week, matches]) => (
                          <div key={week}>
                            <div className="flex items-center gap-3 mb-2">
                              <div className={`px-2.5 py-1 rounded-md ${dt.bg} ${dt.text} text-[10px] font-bold uppercase tracking-wider`}>
                                Week {week}
                              </div>
                              <div className={`flex-1 h-px ${dt.borderSubtle}`} />
                            </div>
                            <div className="space-y-2">
                              {matches.map((m: { id: string; week: number; score1: number | null; score2: number | null; isHome: boolean; opponent: { name: string; logo?: string | null }; result: string; status?: string; format?: string }) => (
                                <div
                                  key={m.id}
                                  className="cursor-pointer"
                                  onClick={() => {
                                    setSelectedMatchId(m.id);
                                    setMatchPreview({
                                      club1Name: m.isHome ? (clubScheduleData?.club?.name || 'Home') : m.opponent.name,
                                      club2Name: m.isHome ? m.opponent.name : (clubScheduleData?.club?.name || 'Away'),
                                      score1: m.score1,
                                      score2: m.score2,
                                      week: m.week,
                                      status: m.result === 'win' || m.result === 'loss' ? 'completed' : 'upcoming',
                                      format: m.format || 'BO3',
                                    });
                                  }}
                                >
                                  <ClubMatchRow
                                    week={m.week}
                                    opponent={m.opponent.name}
                                    score1={m.score1}
                                    score2={m.score2}
                                    isHome={m.isHome}
                                    result={m.result}
                                    opponentLogo={m.opponent.logo}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  </SectionCard>
                </div>
              )}

              {/* Upcoming club matches */}
              {Object.keys(clubMatchesByWeek.upcoming).length > 0 && (
                <div className="stagger-item-subtle stagger-d2">
                  <SectionCard title="Akan Datang" icon={Calendar} badge="JADWAL">
                    <div className="space-y-3">
                      {Object.entries(clubMatchesByWeek.upcoming)
                        .sort(([a], [b]) => Number(a) - Number(b))
                        .map(([week, matches]) => (
                          <div key={week}>
                            <div className="flex items-center gap-3 mb-2">
                              <div className={`px-2.5 py-1 rounded-md ${dt.bg} ${dt.text} text-[10px] font-bold uppercase tracking-wider`}>
                                Week {week}
                              </div>
                              <div className={`flex-1 h-px ${dt.borderSubtle}`} />
                            </div>
                            <div className="space-y-2">
                              {matches.map((m: { id: string; week: number; score1: number | null; score2: number | null; isHome: boolean; opponent: { name: string; logo?: string | null }; result: string; status?: string; format?: string }) => (
                                <div
                                  key={m.id}
                                  className="cursor-pointer"
                                  onClick={() => {
                                    setSelectedMatchId(m.id);
                                    setMatchPreview({
                                      club1Name: m.isHome ? (clubScheduleData?.club?.name || 'Home') : m.opponent.name,
                                      club2Name: m.isHome ? m.opponent.name : (clubScheduleData?.club?.name || 'Away'),
                                      score1: null,
                                      score2: null,
                                      week: m.week,
                                      status: 'upcoming',
                                      format: m.format || 'BO3',
                                    });
                                  }}
                                >
                                  <ClubMatchRow
                                    week={m.week}
                                    opponent={m.opponent.name}
                                    score1={m.score1}
                                    score2={m.score2}
                                    isHome={m.isHome}
                                    result={m.result}
                                    opponentLogo={m.opponent.logo}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  </SectionCard>
                </div>
              )}
            </>
          ) : (
            <div className="stagger-item-subtle stagger-d2">
              <div className={`p-8 rounded-2xl ${dt.bgSubtle} ${dt.border} text-center`}>
                <Gamepad2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Belum ada match untuk club ini</p>
              </div>
            </div>
          )}
        </>
      ) : (
        /* ─── All clubs view (original) ─── */
        <>
          {/* Completed Matches — grouped by week (Toornament match list style) */}
          {Object.keys(matchesByWeek).length > 0 && (
            <div className="stagger-item-subtle stagger-d1">
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
                            <div
                              key={m.id}
                              className="cursor-pointer"
                              onClick={() => {
                                setSelectedMatchId(m.id);
                                setMatchPreview({
                                  club1Name: m.club1.name,
                                  club2Name: m.club2.name,
                                  score1: m.score1,
                                  score2: m.score2,
                                  week: Number(week),
                                  status: 'completed',
                                  format: 'BO3',
                                });
                              }}
                            >
                              <MatchRow
                                club1={m.club1.name}
                                club2={m.club2.name}
                                score1={m.score1}
                                score2={m.score2}
                                status="completed"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </SectionCard>
            </div>
          )}

          {/* Upcoming Matches — grouped by week */}
          {Object.keys(upcomingByWeek).length > 0 && (
            <div className="stagger-item-subtle stagger-d2">
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
                            <div
                              key={m.id}
                              className="cursor-pointer"
                              onClick={() => {
                                setSelectedMatchId(m.id);
                                setMatchPreview({
                                  club1Name: m.club1.name,
                                  club2Name: m.club2.name,
                                  score1: null,
                                  score2: null,
                                  week: Number(week),
                                  status: 'upcoming',
                                  format: 'BO3',
                                });
                              }}
                            >
                              <MatchRow
                                club1={m.club1.name}
                                club2={m.club2.name}
                                score1={0}
                                score2={0}
                                status="upcoming"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </SectionCard>
            </div>
          )}

          {Object.keys(matchesByWeek).length === 0 && Object.keys(upcomingByWeek).length === 0 && (
            <div className="stagger-item-subtle stagger-d3">
              <div className={`p-8 rounded-2xl ${dt.bgSubtle} ${dt.border} text-center`}>
                <Gamepad2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Belum ada match</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Match Detail Modal */}
      <MatchDetailModal
        matchId={selectedMatchId}
        onClose={() => { setSelectedMatchId(null); setMatchPreview(null); }}
        preview={matchPreview ?? undefined}
      />
    </div>
  );
}
