'use client';

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, CheckCircle2, Users, Swords, Star } from 'lucide-react';
import { getDivisionTheme } from '@/hooks/use-division-theme';
import { useCommunityTheme } from '@/hooks/use-community-theme';
import { useAppStore } from '@/lib/store';
import type { StatsData } from '@/types/stats';

/* ═══════════════════════════════════════════════════════
   COMMUNITY MATCHES — Tournament status & champion history
   ═══════════════════════════════════════════════════════ */
type DivisionFilter = 'all' | 'male' | 'female';

interface CommunityMatchesProps {
  maleData?: StatsData;
  femaleData?: StatsData;
  selectedDivision?: DivisionFilter;
}

interface TournamentStatusItem {
  id: string;
  division: 'male' | 'female';
  name: string;
  week: number;
  status: string;
  teams: number;
  champion?: string;
  mvp?: string;
}

/** Map raw DB tournament status → display status */
function mapStatus(raw: string | undefined | null): 'live' | 'registration' | 'completed' | 'offseason' {
  if (!raw) return 'offseason';
  if (raw === 'main_event') return 'live';
  if (['registration', 'approval', 'team_generation', 'bracket_generation'].includes(raw)) return 'registration';
  if (raw === 'completed' || raw === 'finalization') return 'completed';
  return 'offseason';
}

/* ═══════════════════════════════════════════════════════
   EMPTY STATE — No match results yet (compact card for grid)
   ═══════════════════════════════════════════════════════ */
function MatchResultsEmptyState({ selectedDivision }: { selectedDivision: DivisionFilter }) {
  const dt = useCommunityTheme();

  return (
    <Card className={`${dt.casinoCard} overflow-hidden`}>
      <CardContent className="p-5">
        {/* Empty illustration */}
        <div className="flex flex-col items-center justify-center py-8 text-center">
          {/* Trophy arena illustration */}
          <div className="relative mb-4">
            <div className={`w-20 h-20 rounded-2xl ${dt.bgSubtle} border ${dt.borderSubtle} flex items-center justify-center`}>
              <Trophy className={`w-9 h-9 ${dt.text} opacity-30`} />
            </div>
            {/* Floating badge decorations */}
            <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-idm-gold-warm/10 border border-idm-gold-warm/15 flex items-center justify-center animate-bounce" style={{ animationDuration: '2s' }}>
              <Swords className="w-3.5 h-3.5 text-idm-gold-warm/50" />
            </div>
            <div className="absolute -bottom-1 -left-1 w-6 h-6 rounded-full bg-muted/30 border border-border/20 flex items-center justify-center animate-bounce" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }}>
              <Users className="w-3 h-3 text-muted-foreground/40" />
            </div>
          </div>

          <h4 className="text-sm font-bold text-foreground/70 mb-1">Belum Ada Hasil Pertandingan</h4>
          <p className="text-[11px] text-muted-foreground/50 max-w-[240px] leading-relaxed">
            Hasil pertandingan akan muncul setelah turnamen dimulai dan pertandingan selesai dimainkan
          </p>

          {/* Decorative match cards placeholder */}
          <div className="mt-5 flex items-center gap-3 w-full max-w-[280px]">
            <div className="flex-1 h-16 rounded-2xl border border-dashed border-border/20 bg-muted/5 flex items-center justify-center">
              <div className="flex items-center gap-1.5 opacity-30">
                <div className="w-5 h-5 rounded bg-muted/30" />
                <span className="text-[9px] text-muted-foreground">Tim A</span>
              </div>
            </div>
            <div className="shrink-0">
              <span className="text-[10px] font-bold text-muted-foreground/25">VS</span>
            </div>
            <div className="flex-1 h-16 rounded-2xl border border-dashed border-border/20 bg-muted/5 flex items-center justify-center">
              <div className="flex items-center gap-1.5 opacity-30">
                <div className="w-5 h-5 rounded bg-muted/30" />
                <span className="text-[9px] text-muted-foreground">Tim B</span>
              </div>
            </div>
          </div>

          <p className="text-[9px] text-muted-foreground/30 mt-4">
            🏆 Pilih turnamen dan daftar untuk mulai bertanding
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Compact per-division empty state card (fits in 2-col grid) ── */
function DivisionEmptyCard({ division }: { division: 'male' | 'female' }) {
  const dt = getDivisionTheme(division);
  return (
    <Card className={`${dt.casinoCard} border ${dt.borderSubtle} overflow-hidden h-full flex flex-col`}>
      <div className={dt.casinoBar} />
      <CardContent className="p-4 sm:p-6 flex-1 flex flex-col items-center justify-center text-center min-h-[180px]">
        <span className="text-2xl mb-2">{division === 'male' ? '🕺' : '💃'}</span>
        <div className={`w-14 h-14 rounded-2xl ${dt.bgSubtle} border ${dt.borderSubtle} flex items-center justify-center mb-3`}>
          <Trophy className={`w-6 h-6 ${dt.text} opacity-25`} />
        </div>
        <p className="text-xs font-semibold text-foreground/50 mb-0.5">Belum Ada Turnamen</p>
        <p className="text-[9px] text-muted-foreground/40">
          Divisi {division === 'male' ? 'Cowo' : 'Cewe'} belum memiliki data
        </p>
      </CardContent>
    </Card>
  );
}

export function CommunityMatches({ maleData, femaleData, selectedDivision = 'all' }: CommunityMatchesProps) {
  const { playerAuth } = useAppStore();
  const loggedInGamertag = playerAuth.isAuthenticated ? playerAuth.account?.player.gamertag : null;
  const loggedInDivision = playerAuth.isAuthenticated ? playerAuth.account?.player.division : null;

  const tournamentStatuses = useMemo(() => {
    const items: TournamentStatusItem[] = [];

    for (const [div, data] of [['male', maleData], ['female', femaleData]] as const) {
      if ((selectedDivision === 'all' || selectedDivision === div) && data?.activeTournament) {
        const t = data.activeTournament;
        const lastChampion = data?.weeklyChampions?.[0];
        items.push({
          id: `t-status-${div}`,
          division: div,
          name: t.name,
          week: t.weekNumber,
          status: t.status,
          teams: t.teams?.length || 0,
          champion: lastChampion?.winnerTeam?.name || undefined,
          mvp: lastChampion?.mvp?.gamertag || undefined,
        });
      }
    }

    return items;
  }, [maleData, femaleData, selectedDivision]);

  // When "Semua" is selected, track which divisions have NO data so we can show per-division empty states
  const divisionsWithNoData = useMemo(() => {
    if (selectedDivision !== 'all') return [];
    const result: ('male' | 'female')[] = [];
    if (!maleData?.activeTournament) result.push('male');
    if (!femaleData?.activeTournament) result.push('female');
    return result;
  }, [selectedDivision, maleData, femaleData]);

  // Single division selected with no data → simple empty state
  if (selectedDivision !== 'all' && tournamentStatuses.length === 0) {
    return <MatchResultsEmptyState selectedDivision={selectedDivision} />;
  }

  // "Semua" selected but BOTH divisions have no data → single empty state
  if (tournamentStatuses.length === 0 && divisionsWithNoData.length === 2) {
    return <MatchResultsEmptyState selectedDivision="all" />;
  }

  return (
    <div className={`grid gap-3 ${selectedDivision === 'all' ? 'grid-cols-1 sm:grid-cols-2 p-4 sm:p-5 rounded-2xl bg-idm-gold-warm/5 border border-idm-gold-warm/10' : 'grid-cols-1'}`}>
      {tournamentStatuses.map((t, i) => {
        const dt = getDivisionTheme(t.division);
        const displayStatus = mapStatus(t.status);
        const isLive = displayStatus === 'live';
        const isCompleted = displayStatus === 'completed';
        const isMyDivision = loggedInDivision === t.division;

        return (
          <div
            key={t.id}
            className="animate-fade-enter-sm h-full"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <Card className={`${dt.casinoCard} border ${isMyDivision ? 'border-idm-gold-warm/15 shadow-[0_0_12px_rgba(239,249,35,0.10)]' : dt.borderSubtle} overflow-hidden group hover:shadow-md transition-all duration-300 h-full flex flex-col relative`}>
              <div className={dt.casinoBar} />
              {/* "Match Kamu" indicator */}
              {isMyDivision && (
                <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-idm-gold-warm/20 border border-idm-gold-warm/30 shadow-[0_0_8px_rgba(239,249,35,0.15)]">
                  <Star className="w-2.5 h-2.5 text-idm-gold-warm" />
                  <span className="text-[7px] font-bold text-idm-gold-warm uppercase tracking-wider">Match Kamu</span>
                </div>
              )}
              <CardContent className="p-4 sm:p-6 flex-1 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{t.division === 'male' ? '🕺' : '💃'}</span>
                    <span className={`text-xs font-bold ${dt.text}`}>{t.name}</span>
                  </div>
                  <Badge className={`${
                    isLive
                      ? 'bg-red-500/15 text-red-400 border-red-500/30'
                      : isCompleted
                      ? 'bg-green-500/15 text-green-400 border-green-500/30'
                      : 'bg-idm-gold-warm/15 text-idm-gold-warm border-idm-gold-warm/30'
                  } text-[8px] border`}>
                    {isLive ? '🔴 LIVE' : isCompleted ? '✅ Selesai' : '⏳ Segera'}
                  </Badge>
                </div>

                {/* Stats row */}
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1">
                    <Trophy className="w-3 h-3" /> Week {t.week}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" /> {t.teams} Tim
                  </span>
                </div>

                {/* Spacer to push champion info to bottom */}
                <div className="flex-1" />

                {/* Last champion / MVP info */}
                {(t.champion || t.mvp) && (
                  <div className="pt-2 border-t border-border/10 space-y-1.5 mt-auto">
                    {t.champion && (
                      <div className="flex items-center gap-1.5 text-[10px]">
                        <span>👑</span>
                        <span className="text-muted-foreground">Champion:</span>
                        <span className="font-semibold truncate">{t.champion}</span>
                      </div>
                    )}
                    {t.mvp && (
                      <div className="flex items-center gap-1.5 text-[10px]">
                        <span>⭐</span>
                        <span className="text-muted-foreground">MVP:</span>
                        <span className="font-semibold truncate">{t.mvp}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
      })}
      {/* Per-division empty cards when "Semua" selected and a division has no data */}
      {divisionsWithNoData.map((div, i) => (
        <div
          key={`empty-${div}`}
          className="animate-fade-enter-sm h-full"
          style={{ animationDelay: `${(tournamentStatuses.length + i) * 80}ms` }}
        >
          <DivisionEmptyCard division={div} />
        </div>
      ))}
    </div>
  );
}
