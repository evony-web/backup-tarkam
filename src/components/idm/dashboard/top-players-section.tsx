'use client';

import React, { useState } from 'react';

import {
  Users, Trophy, Crown, Award, TrendingUp, Flame, BarChart3,
  Heart, Gem, Banknote,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PlayerCard } from '../player-card';
import { WeekNavigator } from '../week-navigator';
import { AnimatedEmptyState } from '../ui/animated-empty-state';
import { Card } from '@/components/ui/card';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { useAppStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';
import { getSawerTier } from '@/lib/skin-utils';
import type { StatsData } from '@/types/stats';

interface TopPlayersSectionProps {
  data: StatsData;
  division: 'male' | 'female';
  setSelectedPlayer: (player: any) => void;
}

export function TopPlayersSection({ data, division, setSelectedPlayer }: TopPlayersSectionProps) {
  const dt = useDivisionTheme();
  const playerAuth = useAppStore(s => s.playerAuth);

  const skinMap = data?.skinMap || {};
  const loggedInPlayerId = playerAuth.isAuthenticated && playerAuth.account ? playerAuth.account.player.id : null;
  const loggedInSkins = playerAuth.isAuthenticated && playerAuth.account ? playerAuth.account.skins : undefined;

  const [topPlayerTab, setTopPlayerTab] = useState<'top3' | 'sultan' | 'champion' | 'mvp'>('top3');
  const [selectedChampionWeek, setSelectedChampionWeek] = useState<number>(1);
  const [selectedMvpWeek, setSelectedMvpWeek] = useState<number>(1);
  const [selectedSultanWeek, setSelectedSultanWeek] = useState<number>(1);

  return (
    <div className="stagger-item-subtle stagger-d1">
      <Card className={`${dt.casinoCard} overflow-hidden relative`}>
        <div className={dt.casinoBar} />
        {/* Desktop: decorative blur orb */}
        <div className={`hidden lg:block absolute top-8 right-8 w-32 h-32 rounded-full blur-3xl ${dt.bg} opacity-20 pointer-events-none`} />
        <div className={`flex items-center gap-2.5 px-3 lg:px-6 py-3 border-b ${dt.borderSubtle}`}>
          <div className={`w-5 h-5 lg:w-6 lg:h-6 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
            <Crown className={`w-3 h-3 lg:w-3.5 lg:h-3.5 ${dt.neonText}`} />
          </div>
          <h3 className="text-xs lg:text-sm font-semibold uppercase tracking-wider">Top Players</h3>
          <Badge className={`hidden sm:inline-flex ${dt.casinoBadge} ml-auto text-[9px]`}>SEASON BEST</Badge>
        </div>
        {/* Sub-tabs — scrollable on mobile */}
        <div className={`flex items-center gap-1 px-3 lg:px-6 py-2 border-b ${dt.borderSubtle} overflow-x-auto`} role="tablist" aria-label="Top players views">
          <button
            role="tab"
            aria-selected={topPlayerTab === 'top3'}
            onClick={() => setTopPlayerTab('top3')}
            className={`compact-dot relative px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              topPlayerTab === 'top3'
                ? `border-current ${dt.text}`
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Trophy className="w-3 h-3 mr-1 inline" />
            Top 3
          </button>
          <button
            role="tab"
            aria-selected={topPlayerTab === 'sultan'}
            onClick={() => setTopPlayerTab('sultan')}
            className={`compact-dot relative px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              topPlayerTab === 'sultan'
                ? `border-current ${dt.text}`
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Gem className="w-3 h-3 mr-1 inline" />
            Sultan
          </button>
          <button
            role="tab"
            aria-selected={topPlayerTab === 'champion'}
            onClick={() => setTopPlayerTab('champion')}
            className={`compact-dot relative px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              topPlayerTab === 'champion'
                ? `border-current ${dt.text}`
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Crown className="w-3 h-3 mr-1 inline" />
            Juara
          </button>
          <button
            role="tab"
            aria-selected={topPlayerTab === 'mvp'}
            onClick={() => setTopPlayerTab('mvp')}
            className={`compact-dot relative px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              topPlayerTab === 'mvp'
                ? `border-current ${dt.text}`
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Award className="w-3 h-3 mr-1 inline" />
            MVP
          </button>
        </div>
        <div className="p-4 lg:p-6">
          {/* Top 3 Tab */}
          {topPlayerTab === 'top3' && (
            <>
              {data.topPlayers?.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {data.topPlayers.slice(0, 3).map((p, idx) => (
                    <div key={p.id}>
                      <PlayerCard
                        gamertag={p.gamertag}
                        avatar={p.avatar}
                        points={p.points}
                        totalWins={p.totalWins}
                        totalMvp={p.totalMvp}
                        streak={p.streak}
                        rank={idx + 1}
                        isMvp={p.totalMvp > 0 && idx === 0}
                        club={p.club}
                        skins={skinMap[p.id] || (p.id === loggedInPlayerId ? loggedInSkins : undefined)}
                        onClick={() => setSelectedPlayer(p)}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <AnimatedEmptyState
                  icon={Users}
                  message="Belum ada peserta terdaftar"
                  hint="Peserta akan muncul setelah pendaftaran"
                />
              )}
            </>
          )}

          {/* Sultan of the Week Tab — Top Penyawer per Tournament */}
          {topPlayerTab === 'sultan' && (
            <>
              {data.sultanOfWeekly?.length > 0 ? (
                (() => {
                  const sultanWeeks = data.sultanOfWeekly.map(s => s.weekNumber);
                  const totalWeeks = data.seasonProgress?.totalWeeks || 10;
                  const selectedSultan = data.sultanOfWeekly.find(s => s.weekNumber === selectedSultanWeek) || data.sultanOfWeekly[data.sultanOfWeekly.length - 1];
                  const sultanPlayer = selectedSultan.player;
                  const sawerTier = sultanPlayer ? getSawerTier(selectedSultan.totalAmount) : null;

                  return (
                    <div className="space-y-3">
                      {/* Sultan banner */}
                      <div className={`flex items-center gap-3 p-4 sm:p-5 rounded-2xl ${dt.bgSubtle} ${dt.border}`}>
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-green-800 flex items-center justify-center shadow-lg shrink-0">
                          <Gem className="w-5 h-5 text-emerald-200" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-emerald-400 truncate">
                            {sultanPlayer?.gamertag || selectedSultan.donorName}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Week {selectedSultan.weekNumber} • {formatCurrency(selectedSultan.totalAmount)}
                          </p>
                        </div>
                        <Badge className="bg-emerald-500/15 text-emerald-400 border-0 text-[9px]">
                          👑 SULTAN
                        </Badge>
                      </div>

                      {/* Player Card + Donation Stats */}
                      <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        {sultanPlayer ? (
                          <div>
                            <PlayerCard
                              gamertag={sultanPlayer.gamertag}
                              avatar={sultanPlayer.avatar}
                              points={sultanPlayer.points}
                              totalWins={sultanPlayer.totalWins}
                              totalMvp={sultanPlayer.totalMvp}
                              streak={sultanPlayer.streak}
                              rank={1}
                              skins={skinMap[sultanPlayer.id]}
                              onClick={() => setSelectedPlayer({
                                ...sultanPlayer,
                                name: sultanPlayer.gamertag,
                                maxStreak: 0,
                                club: sultanPlayer.club,
                                division: sultanPlayer.division,
                                matches: 0,
                              })}
                            />
                          </div>
                        ) : (
                          /* Anonymous donor — show placeholder card */
                          <div className={`flex flex-col items-center justify-center p-3 rounded-2xl ${dt.bgSubtle} ${dt.border} aspect-[3/4]`}>
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-600 to-green-800 flex items-center justify-center mb-2">
                              <Banknote className="w-6 h-6 text-emerald-200" />
                            </div>
                            <p className="text-[10px] font-bold text-emerald-400 text-center truncate max-w-full">
                              {selectedSultan.donorName}
                            </p>
                          </div>
                        )}

                        {/* Donation Stats Breakdown */}
                        <div className={`col-span-2 flex flex-col justify-center gap-2 p-3 rounded-2xl ${dt.bgSubtle} ${dt.border}`}>
                          <div className="flex items-center gap-2">
                            <Heart className="w-4 h-4 text-emerald-400" />
                            <span className="text-sm font-bold text-emerald-400">
                              {formatCurrency(selectedSultan.totalAmount)}
                            </span>
                            <span className="text-[9px] text-muted-foreground">TOTAL SAWER</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className={`p-3 sm:p-4 rounded-lg ${dt.bgSubtle} ${dt.borderSubtle} text-center`}>
                              <p className={`text-sm font-bold text-emerald-400`}>
                                {selectedSultan.donationCount}x
                              </p>
                              <p className="text-[9px] text-muted-foreground">Saweran</p>
                            </div>
                            <div className={`p-3 sm:p-4 rounded-lg ${dt.bgSubtle} ${dt.borderSubtle} text-center`}>
                              {sawerTier ? (
                                <>
                                  <p className={`text-sm font-bold text-emerald-400`}>
                                    {sawerTier.replace('sawer_', '').charAt(0).toUpperCase() + sawerTier.replace('sawer_', '').slice(1)}
                                  </p>
                                  <p className="text-[9px] text-muted-foreground">Skin Tier</p>
                                </>
                              ) : (
                                <>
                                  <p className={`text-sm font-bold text-muted-foreground`}>—</p>
                                  <p className="text-[9px] text-muted-foreground">Skin Tier</p>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Week Navigator */}
                      <WeekNavigator
                        totalWeeks={totalWeeks}
                        completedWeeks={sultanWeeks}
                        selectedWeek={selectedSultanWeek}
                        onWeekChange={setSelectedSultanWeek}
                        accent="#43A047"
                        accentLight="#66BB6A"
                        size="xs"
                      />
                    </div>
                  );
                })()
              ) : (
                <div className={`p-6 rounded-2xl ${dt.bgSubtle} ${dt.border} text-center`}>
                  <Gem className={`w-8 h-8 mx-auto mb-2 opacity-30 text-emerald-500`} />
                  <p className="text-sm text-muted-foreground">Belum ada Sultan of the Week</p>
                  <p className="text-[10px] text-muted-foreground/80 mt-1">Penyawer terbanyak setiap minggu akan muncul di sini</p>
                </div>
              )}
            </>
          )}

          {/* Juara Pekan Ini Tab */}
          {topPlayerTab === 'champion' && (
            <>
              {data.weeklyChampions?.length > 0 ? (
                (() => {
                  const completedWeeks = data.weeklyChampions.map(c => c.weekNumber);
                  const totalWeeks = data.seasonProgress?.totalWeeks || 10;
                  const selected = data.weeklyChampions.find(c => c.weekNumber === selectedChampionWeek) || data.weeklyChampions[data.weeklyChampions.length - 1];
                  const winnerTeam = selected.winnerTeam;
                  const championPlayers = winnerTeam?.players || [];
                  return (
                    <div className="space-y-3">
                      {/* Team banner */}
                      <div className={`flex items-center gap-3 p-4 sm:p-5 rounded-2xl ${dt.bgSubtle} ${dt.border}`}>
                        <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center shadow-lg shrink-0`}>
                          <Crown className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-yellow-400 truncate">{winnerTeam?.name || 'TBD'}</p>
                          <p className="text-[10px] text-muted-foreground">Week {selected.weekNumber} Champion • {selected.tournamentName}</p>
                        </div>
                        <Badge className="bg-yellow-500/15 text-yellow-500 border-0 text-[9px]">🏆 JUARA</Badge>
                      </div>
                      {/* Players — all equal champions, no rank differentiation */}
                      {championPlayers.length > 0 ? (
                        <div className="grid grid-cols-3 gap-2 sm:gap-3">
                          {championPlayers.map((p) => (
                            <div key={p.id}>
                              <PlayerCard
                                gamertag={p.gamertag}
                                avatar={p.avatar}
                                points={p.points}
                                totalWins={p.totalWins}
                                totalMvp={p.totalMvp}
                                streak={p.streak}
                                rank={1}
                                isMvp={selected.mvp?.id === p.id}
                                skins={skinMap[p.id]}
                                onClick={() => setSelectedPlayer({
                                  ...p,
                                  name: p.gamertag,
                                  maxStreak: 0,
                                  club: undefined,
                                  division: division,
                                })}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className={`p-6 rounded-2xl ${dt.bgSubtle} ${dt.border} text-center`}>
                          <p className="text-sm text-muted-foreground">Belum ada data week ini</p>
                        </div>
                      )}
                      {/* Week Navigator */}
                      <WeekNavigator
                        totalWeeks={totalWeeks}
                        completedWeeks={completedWeeks}
                        selectedWeek={selectedChampionWeek}
                        onWeekChange={setSelectedChampionWeek}
                        accent="#EFF923"
                        accentLight="#F9CB25"
                        size="xs"
                      />
                    </div>
                  );
                })()
              ) : (
                <div className={`p-6 rounded-2xl ${dt.bgSubtle} ${dt.border} text-center`}>
                  <Crown className={`w-8 h-8 mx-auto mb-2 opacity-30 text-yellow-500`} />
                  <p className="text-sm text-muted-foreground">Belum ada juara pekan ini</p>
                  <p className="text-[10px] text-muted-foreground/80 mt-1">Juara akan muncul setelah turnamen selesai</p>
                </div>
              )}
            </>
          )}

          {/* MVP Tab */}
          {topPlayerTab === 'mvp' && (
            <>
              {data.mvpHallOfFame?.length > 0 ? (
                (() => {
                  const mvpWeeks = data.mvpHallOfFame.map(m => m.weekNumber);
                  const totalWeeks = data.seasonProgress?.totalWeeks || 10;
                  const selectedMvp = data.mvpHallOfFame.find(m => m.weekNumber === selectedMvpWeek) || data.mvpHallOfFame[data.mvpHallOfFame.length - 1];
                  return (
                    <div className="space-y-3">
                      {/* Week label */}
                      <div className={`flex items-center gap-2 px-1`}>
                        <div className={`w-5 h-5 rounded bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center shrink-0`}>
                          <Award className="w-3 h-3 text-white" />
                        </div>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Week {selectedMvp.weekNumber}</span>
                        <span className="text-[9px] text-muted-foreground/80 truncate">{selectedMvp.tournamentName}</span>
                      </div>
                      {/* MVP Player Card + Stats */}
                      <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        <div>
                          <PlayerCard
                              gamertag={selectedMvp.gamertag}
                              avatar={selectedMvp.avatar}
                              points={selectedMvp.points}
                              totalWins={selectedMvp.totalWins}
                              totalMvp={selectedMvp.totalMvp}
                              streak={selectedMvp.streak}
                              rank={1}
                              isMvp={true}
                              skins={skinMap[selectedMvp.id]}
                              onClick={() => setSelectedPlayer({
                                ...selectedMvp,
                                name: selectedMvp.gamertag,
                                maxStreak: 0,
                                club: undefined,
                                division: division,
                                matches: 0,
                              })}
                            />
                        </div>
                        {/* MVP stats highlight */}
                        <div className={`col-span-2 flex flex-col justify-center gap-2 p-3 rounded-2xl ${dt.bgSubtle} ${dt.border}`}>
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
                        accent="#EFF923"
                        accentLight="#F9CB25"
                        size="xs"
                      />
                    </div>
                  );
                })()
              ) : (
                <div className={`p-6 rounded-2xl ${dt.bgSubtle} ${dt.border} text-center`}>
                  <Award className={`w-8 h-8 mx-auto mb-2 opacity-30 text-yellow-500`} />
                  <p className="text-sm text-muted-foreground">Belum ada MVP</p>
                  <p className="text-[10px] text-muted-foreground/80 mt-1">MVP akan ditampilkan setelah turnamen selesai dan ditentukan oleh admin</p>
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
