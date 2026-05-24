'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  Plus, Play, Users, Zap, Crown, Loader2, Trash2,
  UserPlus, Check, X, Trophy, Gift, Star, ArrowRight, RefreshCw,
  Heart, MapPin, Pencil, Calendar, ChevronLeft, Undo2, RotateCcw,
  AlertTriangle, ShieldCheck, ShieldX, Info, ChevronDown, ChevronUp
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { TierBadge } from './tier-badge';
import { StatusBadge } from './status-badge';
import { TeamSpinReveal } from './team-spin-reveal';
import { BracketView } from './bracket-view';
import { useState, useMemo, useCallback, memo } from 'react';
import { toast } from 'sonner';
import { formatCurrency, parseWIBDate, wibToDatetimeLocal, formatWIBDateShort, formatWIBTime } from '@/lib/utils';

import type { DivisionTheme } from '@/hooks/use-division-theme';

// ===== Safe JSON response parser — handles empty/malformed responses =====
async function safeParseJSON<T = Record<string, unknown>>(r: Response): Promise<T> {
  const text = await r.text();
  if (!text) throw new Error(r.ok ? 'Server mengembalikan respons kosong' : `Error ${r.status}: Server mengembalikan respons kosong`);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(r.ok ? 'Gagal memproses respons server' : `Error ${r.status}: Gagal memproses respons server`);
  }
}

async function apiFetch(url: string, options: RequestInit): Promise<Record<string, unknown>> {
  const r = await fetch(url, options);
  if (!r.ok) {
    const d = await safeParseJSON(r);
    throw new Error((d as Record<string, unknown>).error as string || 'Terjadi kesalahan');
  }
  return safeParseJSON(r);
}

interface TournamentManagerProps {
  division: string;
  dt: DivisionTheme;
  stats: { season?: { id: string; division?: string } } | null;
  setConfirmDialog: (d: { open: boolean; title: string; description: string; onConfirm: () => void }) => void;
}

const STEPS = [
  { key: 'setup', label: 'Setup', icon: '⚙️', desc: 'Buat tournament' },
  { key: 'registration', label: 'Registrasi', icon: '📋', desc: 'Daftarkan pemain' },
  { key: 'approval', label: 'Persetujuan', icon: '⏳', desc: 'Set tier & setujui' },
  { key: 'team_generation', label: 'Buat Tim', icon: '👥', desc: 'Generate tim S+A+B' },
  { key: 'bracket_generation', label: 'Bracket', icon: '🏆', desc: 'Buat bracket match' },
  { key: 'main_event', label: 'Main Event', icon: '🎮', desc: 'Pertandingan berjalan' },
  { key: 'finalization', label: 'Finalisasi', icon: '🏆', desc: 'Pilih MVP & hadiah' },
  { key: 'completed', label: 'Selesai', icon: '🎉', desc: 'Tournament selesai' },
];

const FORMAT_LABELS: Record<string, string> = {
  swiss: '🇨🇭 Swiss + Playoff',
  single_elimination: 'Single Elimination',
  group_stage: 'Group Stage + Playoff',
  upper_semi: '🏆 Upper Semi (Double Elim)',
};

const BRACKET_LABELS: Record<string, string> = {
  upper: '🏆 Upper Bracket',
  lower: '🔽 Lower Bracket',
  grand_final: '👑 Grand Final',
  group: 'Group Stage',
  swiss: '🇨🇭 Swiss',
};

const TIER_COLORS: Record<string, { bg: string; bar: string; text: string; icon: string }> = {
  S: { bg: 'bg-red-500/10', bar: 'bg-red-500', text: 'text-red-500', icon: '🔥' },
  A: { bg: 'bg-yellow-500/10', bar: 'bg-yellow-500', text: 'text-yellow-500', icon: '⚡' },
  B: { bg: 'bg-blue-500/10', bar: 'bg-blue-500', text: 'text-blue-500', icon: '🛡️' },
};

/* ─── Step Guide — extracted as React.memo for performance ─── */
const StepGuide = memo(function StepGuide({ status }: { status: string }) {
  const [guideCollapsed, setGuideCollapsed] = useState(false);

  if (status === 'completed') return null;

  const guides: Record<string, { icon: string; title: string; steps: string[]; tip?: string }> = {
    setup: { icon: '⚙️', title: 'Setup Tournament', steps: ['Tournament sudah dibuat', 'Klik "Buka Registrasi" untuk mulai mendaftarkan pemain'], tip: 'Pastikan season sudah aktif sebelum membuat tournament.' },
    registration: { icon: '📋', title: 'Manajemen Peserta', steps: ['Daftarkan pemain dari pool yang tersedia', 'Atur tier setiap pemain (S/A/B) sesuai skill level', 'Klik ✓ untuk menyetujui, ✗ untuk menolak', 'Pastikan tier S = A = B (jumlah seimbang)', 'Klik "Generate Tim" jika tier sudah seimbang'], tip: 'Anda bisa approve pemain satu per satu tanpa harus menunggu semua mendaftar.' },
    approval: { icon: '📋', title: 'Manajemen Peserta', steps: ['Daftarkan pemain dari pool yang tersedia', 'Atur tier setiap pemain (S/A/B) sesuai skill level', 'Klik ✓ untuk menyetujui, ✗ untuk menolak', 'Pastikan tier S = A = B (jumlah seimbang)', 'Klik "Generate Tim" jika tier sudah seimbang'], tip: 'Anda bisa approve pemain satu per satu tanpa harus menunggu semua mendaftar.' },
    team_generation: { icon: '👥', title: 'Tim Terbentuk', steps: ['Tim sudah dibuat secara random (1S+1A+1B)', 'Cek komposisi tim', 'Klik "Generate Bracket" untuk melanjutkan'], tip: 'Tim dinamai berdasarkan pemain Tier S.' },
    bracket_generation: { icon: '🏆', title: 'Bracket Siap', steps: ['Bracket pertandingan sudah dibuat', 'Cek jadwal match', 'Klik "Mulai Event!" untuk memulai pertandingan'], tip: 'Format bracket mengikuti pengaturan tournament.' },
    main_event: { icon: '🎮', title: 'Event Berlangsung', steps: ['Start match yang siap dimainkan', 'Submit skor setelah pertandingan selesai', 'Tunggu semua match selesai', 'Lanjut ke finalisasi'], tip: 'Gunakan "Undo" jika ada kesalahan input skor.' },
    finalization: { icon: '🏆', title: 'Finalisasi', steps: ['Cek distribusi hadiah', 'Pilih MVP tournament', 'Klik "Finalisasi Tournament" untuk menyelesaikan'], tip: 'Setelah finalisasi, hadiah akan didistribusikan otomatis.' },
  };
  const guide = guides[status];
  if (!guide) return null;

  return (
    <div className="p-4 rounded-lg bg-idm-gold-warm/5 border border-idm-gold-warm/20">
      <div
        className="flex items-center gap-2 cursor-pointer select-none"
        onClick={() => setGuideCollapsed(c => !c)}
      >
        <span className="text-xl">{guide.icon}</span>
        <h4 className="text-sm font-bold text-idm-gold-warm">{guide.title}</h4>
        {guideCollapsed
          ? <ChevronDown className="w-3.5 h-3.5 text-idm-gold-warm/50 ml-auto" />
          : <ChevronUp className="w-3.5 h-3.5 text-idm-gold-warm/50 ml-auto" />}
      </div>
      {!guideCollapsed && (
        <>
          <ol className="space-y-1 ml-7 mt-2">
            {guide.steps.map((s, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="text-idm-gold-warm/50 font-mono text-xs mt-0.5">{i + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          {guide.tip && (
            <p className="text-sm text-idm-gold-warm/60 mt-2 ml-7 flex items-start gap-1">
              <span>💡</span> <span>{guide.tip}</span>
            </p>
          )}
        </>
      )}
    </div>
  );
});

// Status-based visual styling for tournament cards
const STATUS_STYLE: Record<string, { border: string; bar: string; bg: string; icon: string }> = {
  setup:            { border: 'border-muted/40',           bar: 'bg-muted',                     bg: '',                                    icon: '⚙️' },
  registration:     { border: 'border-green-500/30',       bar: 'bg-green-500',                  bg: 'bg-green-500/5',                      icon: '🟢' },
  approval:         { border: 'border-yellow-500/30',      bar: 'bg-yellow-500',                 bg: 'bg-yellow-500/5',                     icon: '⏳' },
  team_generation:  { border: 'border-blue-500/30',        bar: 'bg-blue-500',                   bg: 'bg-blue-500/5',                       icon: '👥' },
  bracket_generation: { border: 'border-blue-500/30',      bar: 'bg-blue-500',                   bg: 'bg-blue-500/5',                       icon: '🏆' },
  main_event:       { border: 'border-red-500/40',         bar: 'bg-red-500',                    bg: 'bg-red-500/5',                        icon: '🔴' },
  scoring:          { border: 'border-yellow-500/30',      bar: 'bg-yellow-500',                 bg: 'bg-yellow-500/5',                     icon: '📊' },
  finalization:     { border: 'border-purple-500/30',      bar: 'bg-purple-500',                 bg: 'bg-purple-500/5',                     icon: '🏆' },
  completed:        { border: 'border-idm-gold-warm/30',   bar: 'bg-idm-gold-warm',              bg: 'bg-idm-gold-warm/5',                  icon: '🎉' },
};

// Quick action label per status — shown as primary button on each card
const NEXT_ACTION: Record<string, { label: string; icon: string; color: string }> = {
  setup:              { label: 'Buka Registrasi',   icon: '📋', color: 'text-green-400 hover:bg-green-500/10' },
  registration:       { label: 'Kelola Peserta',      icon: '✓',  color: 'text-yellow-400 hover:bg-yellow-500/10' },
  approval:           { label: 'Kelola Peserta',      icon: '✓',  color: 'text-yellow-400 hover:bg-yellow-500/10' },
  team_generation:    { label: 'Generate Bracket',   icon: '🏆', color: 'text-blue-400 hover:bg-blue-500/10' },
  bracket_generation: { label: 'Mulai Event!',       icon: '🎮', color: 'text-red-400 hover:bg-red-500/10' },
  main_event:         { label: 'Submit Skor',        icon: '📊', color: 'text-red-400 hover:bg-red-500/10' },
  scoring:            { label: 'Finalisasi',         icon: '🏆', color: 'text-purple-400 hover:bg-purple-500/10' },
  finalization:       { label: 'Selesaikan',         icon: '✅', color: 'text-idm-gold-warm hover:bg-idm-gold-warm/10' },
  completed:          { label: 'Lihat Hasil',        icon: '🎉', color: 'text-idm-gold-warm hover:bg-idm-gold-warm/10' },
};

// Sort priority — lower number = shown first
const STATUS_SORT: Record<string, number> = {
  main_event: 0,
  scoring: 1,
  finalization: 2,
  bracket_generation: 3,
  team_generation: 4,
  approval: 5,
  registration: 6,
  setup: 7,
  completed: 8,
};

/* ─── Reusable Admin Match Card with scoring controls ─── */
function AdminMatchCard({ m, labelOverride, selected, getTeamName, scoreInputs, setScoreInputs, scoreMutation, startMatchMutation, undoScoreMutation, setConfirmDialog }: {
  m: any;
  labelOverride?: string;
  selected: any;
  getTeamName: (id: string | null) => string;
  scoreInputs: Record<string, { s1: string; s2: string }>;
  setScoreInputs: React.Dispatch<React.SetStateAction<Record<string, { s1: string; s2: string }>>>;
  scoreMutation: any;
  startMatchMutation: any;
  undoScoreMutation: any;
  setConfirmDialog: React.Dispatch<React.SetStateAction<any>>;
}) {
  const hasScore = m.score1 !== null && m.score2 !== null;
  const isLive = m.status === 'live' || m.status === 'main_event';
  const isCompleted = m.status === 'completed';
  const isReady = m.status === 'ready';
  const isPending = m.status === 'pending';

  // Label logic
  const label = labelOverride || m.groupLabel || '';
  const isGrandFinal = label === 'Final';
  const is3rd = label === '3rd';
  const isSF = label === 'SF1' || label === 'SF2';
  const matchLabel = label === 'SF1' ? 'Semi Final 1' : label === 'SF2' ? 'Semi Final 2' : label === 'Final' ? '🏆 Grand Final' : label === '3rd' ? '🥉 3rd Place' : '';

  return (
    <div className={`p-2.5 rounded-lg border text-xs transition-all ${
      isLive ? 'bg-red-500/5 border-red-500/20' :
      isCompleted ? 'bg-muted/30 border-border/20' :
      isReady ? 'bg-green-500/5 border-green-500/20' :
      isGrandFinal ? 'bg-idm-gold-warm/5 border-idm-gold-warm/25' :
      is3rd ? 'bg-orange-500/5 border-orange-500/15' :
      'bg-muted/20 border-border/10'
    }`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          {matchLabel ? (
            <Badge className={`text-xs border-0 ${
              isGrandFinal ? 'bg-idm-gold-warm/15 text-idm-gold-warm' :
              is3rd ? 'bg-orange-500/10 text-orange-400' :
              isSF ? 'bg-idm-gold-warm/10 text-idm-gold-warm' :
              'bg-muted/50'
            }`}>{matchLabel}</Badge>
          ) : (
            <Badge className="text-xs border-0 bg-muted/50">R{m.round}M{m.matchNumber}</Badge>
          )}
          <Badge className="text-xs border-0 bg-muted/50">{m.format}</Badge>
          {isLive && <Badge className="text-xs border-0 bg-red-500/10 text-red-500">🔴 LIVE</Badge>}
          {isCompleted && <Badge className="text-xs border-0 bg-green-500/10 text-green-500">✅ Selesai</Badge>}
          {isReady && <Badge className="text-xs border-0 bg-green-500/10 text-green-500">Siap</Badge>}
          {isPending && <Badge className="text-xs border-0 bg-muted/50 text-muted-foreground">Menunggu</Badge>}
        </div>
        {m.winner && <span className="text-idm-gold-warm font-semibold">👑 {m.winner.name}</span>}
      </div>

      <div className="flex items-center gap-2">
        <div className={`flex-1 ${m.winnerId === m.team1Id ? 'font-bold text-idm-gold-warm' : ''}`}>
          {getTeamName(m.team1Id)}
          {m.team1 && <span className="text-xs text-muted-foreground ml-1">({m.team1.teamPlayers?.map((tp: any) => tp.player.gamertag).join(', ')})</span>}
        </div>
        {hasScore ? (
          <span className="font-mono font-bold">{m.score1} - {m.score2}</span>
        ) : <span className="text-muted-foreground">vs</span>}
        <div className={`flex-1 text-right ${m.winnerId === m.team2Id ? 'font-bold text-idm-gold-warm' : ''}`}>
          {getTeamName(m.team2Id)}
          {m.team2 && <span className="text-xs text-muted-foreground ml-1">({m.team2.teamPlayers?.map((tp: any) => tp.player.gamertag).join(', ')})</span>}
        </div>
      </div>

      {m.mvpPlayer && <p className="text-xs text-idm-gold-warm mt-1">⭐ MVP: {m.mvpPlayer.gamertag}</p>}

      {/* Undo button for completed matches */}
      {selected.status === 'main_event' && isCompleted && m.team1Id && m.team2Id && (
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/10">
          <Button size="sm" variant="outline" className="text-sm h-8 text-orange-400 border-orange-400/30 hover:bg-orange-400/10"
            disabled={undoScoreMutation.isPending}
            onClick={() => {
              setConfirmDialog({
                open: true, title: 'Undo Skor?',
                description: `Batalkan skor ${getTeamName(m.team1Id)} ${m.score1} - ${m.score2} ${getTeamName(m.team2Id)}? Stats pemain akan dikembalikan.`,
                onConfirm: () => undoScoreMutation.mutate({ tournamentId: selected.id, matchId: m.id })
              });
            }}>
            {undoScoreMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Undo2 className="w-3 h-3 mr-1" />} Undo
          </Button>
        </div>
      )}

      {/* Actions for live/pending matches */}
      {selected.status === 'main_event' && m.team1Id && m.team2Id && !isCompleted && (
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/10">
          {(isReady || isPending) && (
            <Button size="sm" className="text-sm h-8 bg-green-600 hover:bg-green-700 text-white"
              disabled={startMatchMutation.isPending}
              onClick={() => startMatchMutation.mutate({ tournamentId: selected.id, matchId: m.id })}>
              <Play className="w-3 h-3 mr-1" /> Start
            </Button>
          )}
          {isLive && (
            <>
              <Input type="number" min={0} step="any" placeholder={getTeamName(m.team1Id)} className="w-16 h-8 text-sm"
                value={scoreInputs[m.id]?.s1 ?? ''}
                onChange={e => setScoreInputs(prev => ({ ...prev, [m.id]: { ...prev[m.id], s1: e.target.value, s2: prev[m.id]?.s2 ?? '' } }))} />
              <span className="text-xs text-muted-foreground">vs</span>
              <Input type="number" min={0} step="any" placeholder={getTeamName(m.team2Id)} className="w-16 h-8 text-sm"
                value={scoreInputs[m.id]?.s2 ?? ''}
                onChange={e => setScoreInputs(prev => ({ ...prev, [m.id]: { ...prev[m.id], s2: e.target.value, s1: prev[m.id]?.s1 ?? '' } }))} />
              <Button size="sm" className="text-sm h-8 bg-idm-gold-warm hover:bg-idm-gold-warm/80 text-black"
                disabled={scoreInputs[m.id]?.s1 == null || scoreInputs[m.id]?.s1 === '' || scoreInputs[m.id]?.s2 == null || scoreInputs[m.id]?.s2 === '' || scoreMutation.isPending}
                onClick={() => {
                  const s1 = parseInt(scoreInputs[m.id].s1);
                  const s2 = parseInt(scoreInputs[m.id].s2);
                  if (isNaN(s1) || isNaN(s2)) { toast.error('Skor harus berupa angka!'); return; }
                  if (s1 < 0 || s2 < 0) { toast.error('Skor tidak boleh negatif!'); return; }
                  const isGroupBracket = m.bracket === 'group';
                  if (s1 === s2 && !isGroupBracket) { toast.error('Skor tidak boleh seri di bracket eliminasi!'); return; }
                  setConfirmDialog({
                    open: true, title: 'Konfirmasi Skor?',
                    description: `${getTeamName(m.team1Id)} ${s1} - ${s2} ${getTeamName(m.team2Id)}${s1 === s2 ? ' (Seri)' : ''}`,
                    onConfirm: () => scoreMutation.mutate({ tournamentId: selected.id, matchId: m.id, score1: s1, score2: s2 })
                  });
                }}>
                {scoreMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />} Submit
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function TournamentManager({ division, dt, stats, setConfirmDialog }: TournamentManagerProps) {
  const qc = useQueryClient();
  const seasonId = stats?.season?.id;
  const seasonDivision = stats?.season?.division || 'male';

  // State
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newForm, setNewForm] = useState({
    name: '', weekNumber: '', format: 'swiss',
    defaultMatchFormat: 'BO1', prizePool: '', bpm: '', location: 'Online',
    scheduledAt: ''
  });
  const [searchPlayer, setSearchPlayer] = useState('');
  const [tierOverrides, setTierOverrides] = useState<Record<string, string>>({});
  const [prizes, setPrizes] = useState<{ label: string; position: number; prizeAmount: number; recipientCount: number; isMvp?: boolean }[]>([
    { label: 'Juara 1', position: 1, prizeAmount: 0, recipientCount: 3, isMvp: false },
    { label: 'Juara 2', position: 2, prizeAmount: 0, recipientCount: 3, isMvp: false },
    { label: 'Juara 3', position: 3, prizeAmount: 0, recipientCount: 3, isMvp: false },
    { label: 'MVP', position: 4, prizeAmount: 0, recipientCount: 1, isMvp: true },
  ]);
  const [tournamentFilter, setTournamentFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [approvalStep, setApprovalStep] = useState<'approve' | 'prize'>('approve');
  const [showPrizeConfig, setShowPrizeConfig] = useState(false);
  const [manualPrizePool, setManualPrizePool] = useState<string>('');
  const [registrationFee, setRegistrationFee] = useState<string>('20000');
  const [totalSawerInput, setTotalSawerInput] = useState<string>('');
  const [wantsManualPrize, setWantsManualPrize] = useState(false);
  const [selectedMvp, setSelectedMvp] = useState<string>('');
  const [scoreInputs, setScoreInputs] = useState<Record<string, { s1: string; s2: string }>>({});
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState<{
    id: string; name: string; weekNumber: string; format: string;
    defaultMatchFormat: string; prizePool: string; bpm: string;
    location: string; scheduledAt: string;
  }>({ id: '', name: '', weekNumber: '', format: 'swiss', defaultMatchFormat: 'BO1', prizePool: '', bpm: '', location: '', scheduledAt: '' });

  // Spin reveal state for team generation
  const [spinRevealData, setSpinRevealData] = useState<{
    spinRevealOrder: { teamIndex: number; teamName: string; tier: string; player: { id: string; gamertag: string; tier: string; points: number }; allPlayersInTier: { id: string; gamertag: string; tier: string; points: number }[] }[];
    teamCount: number;
  } | null>(null);

  // Queries
  const { data: tournaments } = useQuery({
    queryKey: ['admin-tournaments', seasonId],
    queryFn: async () => {
      if (!seasonId) return [];
      const r = await fetch(`/api/tournaments?seasonId=${seasonId}`, { credentials: 'include' });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as Record<string, unknown>).error as string || 'Gagal memuat turnamen'); }
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!seasonId,
  });

  const { data: selected } = useQuery({
    queryKey: ['admin-tournament', selectedId],
    queryFn: async () => {
      if (!selectedId) return null;
      const r = await fetch(`/api/tournaments/${selectedId}`, { credentials: 'include' });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as Record<string, unknown>).error as string || 'Gagal memuat detail turnamen'); }
      return r.json();
    },
    enabled: !!selectedId,
  });

  const { data: players } = useQuery({
    queryKey: ['admin-players', division],
    queryFn: async () => {
      const r = await fetch(`/api/players?division=${division}`, { credentials: 'include' });
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: tournamentDonations } = useQuery({
    queryKey: ['admin-tournament-donations', selectedId],
    queryFn: async () => {
      if (!selectedId) return { total: { amount: 0, count: 0 }, donations: [] };
      const r = await fetch(`/api/donations?status=approved&limit=100`, { credentials: 'include' });
      if (!r.ok) return { total: { amount: 0, count: 0 }, donations: [] };
      return r.json();
    },
    enabled: !!selectedId,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return apiFetch('/api/tournaments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-tournaments', seasonId] }); toast.success('Tournament berhasil dibuat!'); setNewForm({ name: '', weekNumber: '', format: 'swiss', defaultMatchFormat: 'BO1', prizePool: '', bpm: '128', location: 'Online', scheduledAt: '' }); setShowCreateForm(false); },
    onError: (e: Error) => { toast.error(e.message); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      return apiFetch(`/api/tournaments/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-tournaments', seasonId] }); qc.invalidateQueries({ queryKey: ['admin-tournament', selectedId] }); toast.success('Status diperbarui!'); },
  });

  const registerMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { playerId?: string; playerIds?: string[] } }) => {
      return apiFetch(`/api/tournaments/${id}/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['admin-tournament', selectedId] }); toast.success(`${res.registered} player terdaftar!`); },
    onError: (e: Error) => { toast.error(e.message); },
  });

  const unregisterMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { playerId?: string; playerIds?: string[] } }) => {
      return apiFetch(`/api/tournaments/${id}/register`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['admin-tournament', selectedId] }); toast.success(`${res.removed} player dibatalkan pendaftarannya.`); },
    onError: (e: Error) => { toast.error(e.message); },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      return apiFetch(`/api/tournaments/${id}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-tournament', selectedId] }); toast.success('Player disetujui!'); },
  });

  // Unapprove mutation — rollback approval to "registered"
  const unapproveMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { playerId?: string; playerIds?: string[]; unapproveAll?: boolean } }) => {
      return apiFetch(`/api/tournaments/${id}/approve`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['admin-tournament', selectedId] });
      toast.success(data?.message || 'Persetujuan berhasil dibatalkan!');
    },
    onError: (e: Error) => { toast.error(e.message); },
  });

  const generateTeamsMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiFetch(`/api/tournaments/${id}/generate-teams`, { method: 'POST', credentials: 'include' });
    },
    onSuccess: (data) => {
      // Only invalidate detail — list doesn't change on team generation
      qc.invalidateQueries({ queryKey: ['admin-tournament', selectedId] });
      if (Array.isArray(data.spinRevealOrder) && data.spinRevealOrder.length > 0) {
        setSpinRevealData({ spinRevealOrder: data.spinRevealOrder as Array<{ teamIndex: number; teamName: string; tier: string; player: { id: string; gamertag: string; tier: string; points: number }; allPlayersInTier: Array<{ id: string; gamertag: string; tier: string; points: number }> }>, teamCount: data.teamCount as number });
      } else {
        toast.success('Tim berhasil di-generate!');
      }
    },
    onError: (e: Error) => { toast.error(e.message); },
  });

  const generateBracketMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiFetch(`/api/tournaments/${id}/generate-bracket`, { method: 'POST', credentials: 'include' });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-tournaments', seasonId] }); qc.invalidateQueries({ queryKey: ['admin-tournament', selectedId] }); toast.success('Bracket berhasil di-generate!'); },
    onError: (e: Error) => { toast.error(e.message); },
  });

  const startMatchMutation = useMutation({
    mutationFn: async ({ tournamentId, matchId }: { tournamentId: string; matchId: string }) => {
      return apiFetch(`/api/tournaments/${tournamentId}/start-match`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ matchId }),
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-tournament', selectedId] }); toast.success('Match dimulai!'); },
    onError: (e: Error) => { toast.error(e.message); },
  });

  const scoreMutation = useMutation({
    mutationFn: async ({ tournamentId, matchId, score1, score2 }: { tournamentId: string; matchId: string; score1: number; score2: number }) => {
      return apiFetch(`/api/tournaments/${tournamentId}/score`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ matchId, score1, score2 }),
      });
    },
    onSuccess: () => {
      // Invalidate both detail and list (tournament status may change)
      qc.invalidateQueries({ queryKey: ['admin-tournament', selectedId] });
      qc.invalidateQueries({ queryKey: ['admin-tournaments', seasonId] });
      setScoreInputs({});
      toast.success('Skor berhasil disubmit!');
    },
    onError: (e: Error) => { toast.error(`Gagal submit skor: ${e.message}`); },
  });

  const undoScoreMutation = useMutation({
    mutationFn: async ({ tournamentId, matchId }: { tournamentId: string; matchId: string }) => {
      return apiFetch(`/api/tournaments/${tournamentId}/score`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ matchId }),
      });
    },
    onSuccess: () => {
      // Undo score doesn't change tournament list — only invalidate detail
      qc.invalidateQueries({ queryKey: ['admin-tournament', selectedId] });
      toast.success('Skor berhasil di-undo!');
    },
    onError: (e: Error) => { toast.error(e.message); },
  });

  const finalizeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      return apiFetch(`/api/tournaments/${id}/finalize`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-tournaments', seasonId] }); qc.invalidateQueries({ queryKey: ['admin-tournament', selectedId] }); toast.success('Tournament berhasil difinalisasi! 🎉'); },
    onError: (e: Error) => { toast.error(e.message); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiFetch(`/api/tournaments/${id}`, { method: 'DELETE', credentials: 'include' });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-tournaments', seasonId] }); qc.invalidateQueries({ queryKey: ['admin-tournament', selectedId] }); setSelectedId(null); toast.success('Tournament berhasil dihapus!'); },
    onError: (e: Error) => { toast.error(e.message); },
  });

  const openEditDialog = (t: { id: string; name: string; weekNumber: number; format: string; defaultMatchFormat: string; prizePool: number; bpm?: number | null; location?: string | null; scheduledAt?: string | null }) => {
    setEditForm({
      id: t.id,
      name: t.name,
      weekNumber: String(t.weekNumber),
      format: t.format,
      defaultMatchFormat: t.defaultMatchFormat || 'BO1',
      prizePool: String(t.prizePool || 0),
      bpm: String(t.bpm ?? ''),
      location: t.location || '',
      scheduledAt: t.scheduledAt ? (() => { const d = parseWIBDate(t.scheduledAt); return d ? wibToDatetimeLocal(d) : ''; })() : '',
    });
    setEditDialogOpen(true);
  };

  const editMutation = useMutation({
    mutationFn: async (data: { id: string } & Record<string, unknown>) => {
      const { id, ...rest } = data;
      return apiFetch(`/api/tournaments/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(rest),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-tournaments', seasonId] });
      qc.invalidateQueries({ queryKey: ['admin-tournament', selectedId] });
      setEditDialogOpen(false);
      toast.success('Tournament berhasil diperbarui!');
    },
    onError: (e: Error) => { toast.error(e.message); },
  });

  // Derived data
  const currentStepIdx = STEPS.findIndex(s => s.key === selected?.status);
  const registeredIds = new Set((Array.isArray(selected?.participations) ? selected.participations : []).map((p: { playerId: string }) => p.playerId));
  const unregistered = (Array.isArray(players) ? players : []).filter((p: { id: string; registrationStatus?: string }) => !registeredIds.has(p.id) && p.registrationStatus === 'approved');
  const filteredUnregistered =
    unregistered.filter((p: { gamertag: string; name: string }) =>
      p.gamertag.toLowerCase().includes(searchPlayer.toLowerCase()) || p.name.toLowerCase().includes(searchPlayer.toLowerCase())
    );

  const pendingApprovals = (Array.isArray(selected?.participations) ? selected.participations : []).filter((p: { status: string }) => p.status === 'registered');
  const approvedParticipations = (Array.isArray(selected?.participations) ? selected.participations : []).filter((p: { status: string }) => ['approved', 'assigned'].includes(p.status));

  // Tier distribution — counts from BOTH pending (with tierOverride preview) AND already approved
  const tierDist = useMemo(() => {
    const dist = { S: 0, A: 0, B: 0 };
    for (const p of pendingApprovals) {
      const t = tierOverrides[p.playerId] || p.player?.tier || 'B';
      dist[t as keyof typeof dist]++;
    }
    for (const p of approvedParticipations) {
      const t = p.tierOverride || p.player?.tier || 'B';
      dist[t as keyof typeof dist]++;
    }
    return dist;
  }, [pendingApprovals, approvedParticipations, tierOverrides]);

  // Tier balance validation — S=A=B required for team generation
  const isTierBalanced = tierDist.S > 0 && tierDist.S === tierDist.A && tierDist.A === tierDist.B;
  const tierMaxCount = Math.max(tierDist.S, tierDist.A, tierDist.B);
  const tierBalanceDeficit = useMemo(() => ({
    S: tierMaxCount - tierDist.S,
    A: tierMaxCount - tierDist.A,
    B: tierMaxCount - tierDist.B,
  }), [tierDist, tierMaxCount]);

  const approvedSawer = useMemo(() => {
    const donations = tournamentDonations?.donations;
    if (!Array.isArray(donations)) return 0;
    return donations
      .filter((d: { tournamentId: string | null }) =>
        d.tournamentId === selectedId
      )
      .reduce((sum: number, d: { amount: number }) => sum + d.amount, 0);
  }, [tournamentDonations, selectedId]);

  const basePrizePoolRef = useMemo(() => {
    const fee = parseInt(registrationFee) || 0;
    return approvedParticipations.length * fee;
  }, [approvedParticipations.length, registrationFee]);

  const effectiveSawer = useMemo(() => {
    // If admin manually input total sawer, use that; otherwise use auto-calculated approvedSawer
    return totalSawerInput ? (parseInt(totalSawerInput) || 0) : approvedSawer;
  }, [totalSawerInput, approvedSawer]);

  const referencePrizePool = useMemo(() => {
    return basePrizePoolRef + effectiveSawer;
  }, [basePrizePoolRef, effectiveSawer]);

  const matchesByBracket = (() => {
    if (!Array.isArray(selected?.matches)) return {};
    const grouped: Record<string, typeof selected.matches> = {};
    for (const m of selected.matches) {
      const key = m.bracket || 'upper';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(m);
    }
    return grouped;
  })();

  // Sorted & filtered tournament list
  const sortedFilteredTournaments = useMemo(() => {
    if (!Array.isArray(tournaments)) return [];
    let list = [...tournaments];
    // Filter
    if (tournamentFilter === 'active') list = list.filter((t: { status: string }) => t.status !== 'completed');
    if (tournamentFilter === 'completed') list = list.filter((t: { status: string }) => t.status === 'completed');
    // Sort: by status priority, then by weekNumber desc
    list.sort((a: { status: string; weekNumber: number }, b: { status: string; weekNumber: number }) => {
      const pa = STATUS_SORT[a.status] ?? 9;
      const pb = STATUS_SORT[b.status] ?? 9;
      if (pa !== pb) return pa - pb;
      return b.weekNumber - a.weekNumber;
    });
    return list;
  }, [tournaments, tournamentFilter]);

  const nextMatch = (() => {
    if (!Array.isArray(selected?.matches)) return null;
    return selected.matches.find((m: { status: string; team1Id: string | null; team2Id: string | null }) =>
      (m.status === 'ready' || m.status === 'pending') && m.team1Id && m.team2Id
    );
  })();

  const getTeamName = (teamId: string | null) => {
    if (!teamId || !selected?.teams) return 'TBD';
    const team = selected.teams.find((t: { id: string }) => t.id === teamId);
    return team?.name || 'TBD';
  };

  // Reset state when selectedId changes
  const [prevSelectedId, setPrevSelectedId] = useState<string | null>(selectedId);
  if (prevSelectedId !== selectedId) {
    setPrevSelectedId(selectedId);
    setApprovalStep('approve');
    setShowPrizeConfig(false);
    setWantsManualPrize(false);
    setManualPrizePool('');
    setRegistrationFee('20000');
    setTotalSawerInput('');
  }

  // Initialize prizes and prize pool from selected tournament
  const [prizesInitializedFor, setPrizesInitializedFor] = useState<string | null>(null);
  if (selected?.id && selected.id !== prizesInitializedFor) {
    setPrizesInitializedFor(selected.id);
    if (selected.prizePool && selected.prizePool > 0) {
      setManualPrizePool(String(selected.prizePool));
    } else {
      // Pre-fill with calculated reference value
      setManualPrizePool(String(referencePrizePool));
    }
    if (selected.prizes && selected.prizes.length > 0) {
      setPrizes(selected.prizes.map((p: { label: string; position: number; prizeAmount: number; recipientCount: number; isMvp?: boolean }) => ({
        label: p.label,
        position: p.position,
        prizeAmount: p.prizeAmount,
        recipientCount: p.recipientCount,
        isMvp: p.isMvp,
      })));
      setWantsManualPrize(true);
      setShowPrizeConfig(true);
    }
  }

  const handleSpinComplete = useCallback(() => {
    setSpinRevealData(null);
    toast.success('Tim berhasil di-generate! 🎉');
  }, []);

  // Check if bulk approve would create tier imbalance
  const wouldBulkApproveBreakBalance = useMemo(() => {
    if (pendingApprovals.length === 0) return false;
    // Simulate: what would tierDist look like if we approve all pending?
    const simDist = { S: 0, A: 0, B: 0 };
    // All pending get their tierOverride or current tier
    for (const p of pendingApprovals) {
      const t = tierOverrides[p.playerId] || p.player?.tier || 'B';
      simDist[t as keyof typeof simDist]++;
    }
    // Add existing approved
    for (const p of approvedParticipations) {
      const t = p.tierOverride || p.player?.tier || 'B';
      simDist[t as keyof typeof simDist]++;
    }
    return !(simDist.S > 0 && simDist.S === simDist.A && simDist.A === simDist.B);
  }, [pendingApprovals, approvedParticipations, tierOverrides]);

  return (
    <div className="space-y-5">
      {/* ===== CREATE TOURNAMENT ===== */}
      {!showCreateForm ? (
        <Button className={`${dt.casinoCard} ${dt.casinoGlow} w-full h-12`}
          onClick={() => setShowCreateForm(true)}>
          <Plus className={`w-4 h-4 mr-2 ${dt.neonText}`} /> Buat Tournament Baru
        </Button>
      ) : (
      <Card className={dt.casinoCard}>
        <div className={dt.casinoBar} />
        <CardContent className="p-4 relative z-10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Plus className={`w-4 h-4 ${dt.neonText}`} /> Buat Tournament Baru
            </h3>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setShowCreateForm(false)}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Input placeholder="Nama Tournament" value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} />
            <Input placeholder="Week #" type="number" value={newForm.weekNumber} onChange={e => setNewForm(f => ({ ...f, weekNumber: e.target.value }))} />
            <Select value={newForm.format} onValueChange={v => setNewForm(f => ({ ...f, format: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="swiss">🇨🇭 Swiss + Playoff</SelectItem>
                <SelectItem value="single_elimination">Single Elimination</SelectItem>
                <SelectItem value="group_stage">Group Stage + Playoff</SelectItem>
                <SelectItem value="upper_semi">🏆 Upper Semi (Double Elim)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={newForm.defaultMatchFormat} onValueChange={v => setNewForm(f => ({ ...f, defaultMatchFormat: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BO1">BO1</SelectItem>
                <SelectItem value="BO3">BO3</SelectItem>
                <SelectItem value="BO5">BO5</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="BPM (contoh: 128 atau Random 120-140)" value={newForm.bpm} onChange={e => setNewForm(f => ({ ...f, bpm: e.target.value }))} />
            <Input placeholder="Lokasi" value={newForm.location} onChange={e => setNewForm(f => ({ ...f, location: e.target.value }))} />
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground shrink-0">Jadwal (WIB)</span>
              <Input type="datetime-local" value={newForm.scheduledAt} onChange={e => setNewForm(f => ({ ...f, scheduledAt: e.target.value }))} className="h-9 text-sm" />
            </div>
            <Button size="sm" disabled={!newForm.name || !newForm.weekNumber || !seasonId || createMutation.isPending}
              title={!seasonId ? 'Buat season terlebih dahulu' : !newForm.name ? 'Masukkan nama tournament' : !newForm.weekNumber ? 'Masukkan nomor week' : 'Buat tournament'}
              onClick={() => createMutation.mutate({
                name: newForm.name, weekNumber: parseInt(newForm.weekNumber), division: seasonDivision, seasonId,
                format: newForm.format, defaultMatchFormat: newForm.defaultMatchFormat,
                prizePool: 0, bpm: newForm.bpm || undefined,
                location: newForm.location || 'Online',
                scheduledAt: newForm.scheduledAt || undefined,
              })}>
              {createMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />} Buat
            </Button>
          </div>
          {!seasonId ? (
            <div className="flex items-center gap-2 mt-2 p-3 rounded-lg bg-red-500/10 border border-border">
              <span className="text-xs">⚠️</span>
              <p className="text-[11px] text-red-400 font-medium">Buat season terlebih dahulu di tab <strong>"Season"</strong> sebelum membuat tournament.</p>
            </div>
          ) : !newForm.name || !newForm.weekNumber ? (
            <p className="text-sm text-muted-foreground mt-2">Isi <strong>Nama Tournament</strong> dan <strong>Week #</strong> untuk mengaktifkan tombol Buat.</p>
          ) : null}
        </CardContent>
      </Card>
      )}

      {/* ===== TOURNAMENT LIST ===== */}
      {/* Filter tabs */}
      {tournaments && tournaments.length > 0 && (
        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/30">
          {(['all', 'active', 'completed'] as const).map(f => (
            <button key={f} onClick={() => setTournamentFilter(f)}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors duration-150 ${
                tournamentFilter === f
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}>
              {f === 'all' ? `Semua (${tournaments.length})`
                : f === 'active' ? `Aktif (${tournaments.filter((t: { status: string }) => t.status !== 'completed').length})`
                : `Selesai (${tournaments.filter((t: { status: string }) => t.status === 'completed').length})`}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {tournaments?.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">Belum ada tournament. Buat yang pertama!</p>
        )}
        {sortedFilteredTournaments.length === 0 && (tournaments?.length ?? 0) > 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">Tidak ada tournament untuk filter ini.</p>
        )}
        {sortedFilteredTournaments.map((t: { id: string; name: string; weekNumber: number; status: string; format: string; defaultMatchFormat: string; prizePool: number; bpm?: number; location?: string; scheduledAt?: string; _count?: { teams: number; participations: number; matches: number } }) => {
          const ss = STATUS_STYLE[t.status] || STATUS_STYLE.setup;
          const na = NEXT_ACTION[t.status] || NEXT_ACTION.setup;
          const isLive = t.status === 'main_event';
          const stepIdx = STEPS.findIndex(s => s.key === t.status);
          const stepPct = Math.round(((stepIdx + 1) / STEPS.length) * 100);
          return (
          <div key={t.id}>
            <Card className={`${dt.casinoCard} ${ss.bg} ${ss.border} cursor-pointer transition-colors duration-150 ${selectedId === t.id ? `ring-1 ring-idm-gold-warm` : ''}`}
              onClick={() => setSelectedId(selectedId === t.id ? null : t.id)}>
              <div className={`${ss.bar} h-1 transition-colors duration-300`} />
              <CardContent className="p-4 sm:p-6 relative z-10">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate">{t.name}</p>
                      {isLive && <span className="flex h-2 w-2 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" /></span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <StatusBadge status={t.status} />
                      <Badge className="text-xs border-0 bg-idm-gold-warm/10 text-idm-gold-warm">{FORMAT_LABELS[t.format] || t.format}</Badge>
                      <span className="text-sm text-muted-foreground">Week {t.weekNumber}</span>
                      <span className="text-sm text-muted-foreground">{formatCurrency(t.prizePool)}</span>
                      {t.bpm && <span className="text-sm text-muted-foreground flex items-center gap-1"><Heart className="w-2.5 h-2.5 text-red-400" />{t.bpm} BPM</span>}
                      {t.location && <span className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="w-2.5 h-2.5" />{t.location}</span>}
                      {t.scheduledAt && <span className="text-sm text-muted-foreground flex items-center gap-1"><Calendar className="w-2.5 h-2.5" />{(() => { const d = parseWIBDate(t.scheduledAt); return d ? `${formatWIBDateShort(d)}, ${formatWIBTime(d)}` : ''; })()}</span>}
                      {t._count && <>
                        <span className="text-xs text-muted-foreground">{t._count.teams} tim</span>
                        <span className="text-xs text-muted-foreground">{t._count.participations} pemain</span>
                      </>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                    {/* Quick Action Button */}
                    <Button size="sm" variant="ghost"
                      className={`h-8 px-2 text-sm font-medium ${na.color}`}
                      onClick={() => setSelectedId(t.id)}
                      title={na.label}>
                      <span className="mr-1">{na.icon}</span>{na.label}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-idm-gold-warm hover:text-idm-gold-warm/80 hover:bg-idm-gold-warm/10"
                      onClick={() => openEditDialog(t)} title="Edit Tournament">
                      <Pencil className="w-3 h-3" />
                    </Button>
                    {t.status !== 'completed' && (
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => setConfirmDialog({
                          open: true, title: 'Hapus Tournament?',
                          description: `Tournament "${t.name}" dan semua data terkait akan dihapus permanen. Stats pemain akan dikembalikan.`,
                          onConfirm: () => deleteMutation.mutate(t.id)
                        })} title="Hapus Tournament">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
                {/* Mini step progress bar */}
                <div className="mt-2.5 flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-[width,colors] duration-300 ${ss.bar}`} style={{ width: `${stepPct}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{stepIdx + 1}/{STEPS.length}</span>
                </div>
              </CardContent>
            </Card>
          </div>
          );
        })}
      </div>

      {/* ===== SELECTED TOURNAMENT DETAIL ===== */}
      {/* On desktop: hidden when spin is active (spin replaces it inline) */}
      {/* On mobile: hidden when spin is active (spin overlay covers it) */}
      {selected && !spinRevealData && (
        <Card className={`${dt.casinoCard} border-border`}>
          <div className={dt.casinoBar} />
          <CardContent className="p-4 relative z-10 space-y-4">
            {/* Header + Step Progress */}
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-semibold">{selected.name}</h3>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {selected.bpm && <span className="text-sm text-muted-foreground flex items-center gap-1"><Heart className="w-2.5 h-2.5 text-red-400" />{selected.bpm} BPM</span>}
                  {selected.location && <span className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="w-2.5 h-2.5" />{selected.location}</span>}
                  <span className="text-sm text-muted-foreground">{formatCurrency(parseInt(manualPrizePool) || selected.prizePool || 0)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="text-xs border-0 bg-idm-gold-warm/10 text-idm-gold-warm">{FORMAT_LABELS[selected.format] || selected.format}</Badge>
                <StatusBadge status={selected.status} />
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-idm-gold-warm hover:text-idm-gold-warm/80 hover:bg-idm-gold-warm/10"
                  onClick={() => openEditDialog(selected)} title="Edit Tournament">
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                {selected.status !== 'completed' && (
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                    onClick={() => setConfirmDialog({
                      open: true, title: 'Hapus Tournament?',
                      description: `Tournament "${selected.name}" dan semua data terkait akan dihapus permanen. Stats pemain akan dikembalikan.`,
                      onConfirm: () => deleteMutation.mutate(selected.id)
                    })} title="Hapus Tournament">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Step Wizard — Desktop */}
            <div className="hidden sm:flex items-stretch gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
              {STEPS.map((step, i) => {
                const isCompleted = i < currentStepIdx;
                const isCurrent = i === currentStepIdx;
                const isClickable = isCompleted;
                return (
                  <div key={step.key} className="flex items-center shrink-0">
                    <div
                      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all min-w-[80px] sm:min-w-[96px]
                        ${isClickable ? 'bg-green-500/10 border border-green-500/20 cursor-pointer hover:bg-green-500/20 hover:border-green-500/40' :
                          isCurrent ? 'bg-idm-gold-warm/15 border-2 border-idm-gold-warm/40' :
                          'bg-muted/30 border border-border/10 opacity-50'}`}
                      onClick={() => {
                        if (!isClickable || !selected) return;
                        // Determine what data will be affected
                        const affected: string[] = [];
                        if (i < STEPS.findIndex(s => s.key === 'team_generation') && currentStepIdx >= STEPS.findIndex(s => s.key === 'team_generation')) {
                          affected.push('Tim akan dihapus');
                        }
                        if (i < STEPS.findIndex(s => s.key === 'bracket_generation') && currentStepIdx >= STEPS.findIndex(s => s.key === 'bracket_generation')) {
                          affected.push('Bracket/pertandingan akan dihapus');
                        }
                        if (i < STEPS.findIndex(s => s.key === 'finalization') && currentStepIdx >= STEPS.findIndex(s => s.key === 'finalization')) {
                          affected.push('Distribusi hadiah & poin akan dibatalkan');
                        }
                        const warnText = affected.length > 0
                          ? `\n\n⚠️ Peringatan:\n${affected.map(a => `• ${a}`).join('\n')}`
                          : '';
                        setConfirmDialog({
                          open: true,
                          title: `Kembali ke "${step.label}"?`,
                          description: `Tournament akan dikembalikan ke fase "${step.label}".${warnText}`,
                          onConfirm: () => updateMutation.mutate({ id: selected.id, data: { status: step.key, _revert: true } }),
                        });
                      }}
                    >
                      <span className="text-lg sm:text-xl leading-none">
                        {isCompleted ? '✅' : step.icon}
                      </span>
                      <span className={`text-xs sm:text-sm font-semibold leading-tight text-center
                        ${isCompleted ? 'text-green-500' : isCurrent ? 'text-idm-gold-warm' : 'text-muted-foreground'}`}>
                        {step.label}
                      </span>
                      <span className={`text-xs sm:text-xs leading-tight text-center hidden sm:block
                        ${isCompleted ? 'text-green-400/70' : isCurrent ? 'text-idm-gold-warm/70' : 'text-muted-foreground/50'}`}>
                        {step.desc}
                      </span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <ArrowRight className={`w-3.5 h-3.5 mx-1 shrink-0 self-center
                        ${i < currentStepIdx ? 'text-green-500/40' : 'text-muted-foreground/20'}`} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Step Wizard — Mobile (compact 3-column) */}
            {currentStepIdx >= 0 && (
              <div className="flex sm:hidden items-center gap-2 py-2">
                {currentStepIdx > 0 && (
                  <div
                    className="flex-1 flex flex-col items-center gap-1 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 cursor-pointer hover:bg-green-500/20 hover:border-green-500/40 transition-all"
                    onClick={() => {
                      if (!selected) return;
                      const step = STEPS[currentStepIdx - 1];
                      const affected: string[] = [];
                      const prevIdx = currentStepIdx - 1;
                      if (prevIdx < STEPS.findIndex(s => s.key === 'team_generation') && currentStepIdx >= STEPS.findIndex(s => s.key === 'team_generation')) {
                        affected.push('Tim akan dihapus');
                      }
                      if (prevIdx < STEPS.findIndex(s => s.key === 'bracket_generation') && currentStepIdx >= STEPS.findIndex(s => s.key === 'bracket_generation')) {
                        affected.push('Bracket/pertandingan akan dihapus');
                      }
                      if (prevIdx < STEPS.findIndex(s => s.key === 'finalization') && currentStepIdx >= STEPS.findIndex(s => s.key === 'finalization')) {
                        affected.push('Distribusi hadiah & poin akan dibatalkan');
                      }
                      const warnText = affected.length > 0
                        ? `\n\n⚠️ Peringatan:\n${affected.map(a => `• ${a}`).join('\n')}`
                        : '';
                      setConfirmDialog({
                        open: true,
                        title: `Kembali ke "${step.label}"?`,
                        description: `Tournament akan dikembalikan ke fase "${step.label}".${warnText}`,
                        onConfirm: () => updateMutation.mutate({ id: selected.id, data: { status: step.key, _revert: true } }),
                      });
                    }}
                  >
                    <span className="text-base leading-none">✅</span>
                    <span className="text-xs font-semibold text-green-500">{STEPS[currentStepIdx - 1].label}</span>
                  </div>
                )}
                <div className="flex-1 flex flex-col items-center gap-1 py-1.5 rounded-lg bg-idm-gold-warm/15 border-2 border-idm-gold-warm/40">
                  <span className="text-base leading-none">{STEPS[currentStepIdx].icon}</span>
                  <span className="text-xs font-semibold text-idm-gold-warm">{STEPS[currentStepIdx].label}</span>
                </div>
                {currentStepIdx < STEPS.length - 1 && (
                  <div className="flex-1 flex flex-col items-center gap-1 py-1.5 rounded-lg bg-muted/30 border border-border/10 opacity-50">
                    <span className="text-base leading-none">{STEPS[currentStepIdx + 1].icon}</span>
                    <span className="text-xs font-semibold text-muted-foreground">{STEPS[currentStepIdx + 1].label}</span>
                  </div>
                )}
              </div>
            )}

            {/* Current Step Guide */}
            <StepGuide status={selected.status} />

            <Separator />

            {/* ===== REGISTRATION + APPROVAL PHASE (Combined) ===== */}
            {(selected.status === 'setup' || selected.status === 'registration' || selected.status === 'approval') && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-blue-500 flex items-center gap-1.5">Manajemen Peserta</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Daftarkan, setujui, dan atur tier pemain. ✓ = Setujui, ✗ = Tolak</p>
                  </div>
                  {selected.status === 'setup' && (
                    <Button size="default" className="text-sm h-9 bg-blue-600 hover:bg-blue-700 text-white px-4"
                      onClick={() => updateMutation.mutate({ id: selected.id, data: { status: 'registration' } })}>
                      <ArrowRight className="w-4 h-4 mr-1.5" /> Buka Registrasi
                    </Button>
                  )}
                </div>

                {(selected.status === 'registration' || selected.status === 'approval') && (
                  <>
                    {/* ── SECTION 1: PESERTA MENUNGGU PERSETUJUAN (with ✓/✗) ── */}
                    {pendingApprovals.length > 0 && (
                      <div className="border border-border">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-yellow-400" />
                            <p className="text-sm font-semibold text-yellow-400">Menunggu Persetujuan</p>
                            <Badge className="text-xs border-0 bg-yellow-500/20 text-yellow-400">{pendingApprovals.length}</Badge>
                          </div>
                          <Button size="sm" variant="outline" className="text-xs h-8"
                            disabled={approveMutation.isPending}
                            onClick={() => {
                              if (wouldBulkApproveBreakBalance) {
                                setConfirmDialog({
                                  open: true, title: '⚠️ Tier Akan Tidak Seimbang!',
                                  description: `Jika Anda menyetujui semua pemain sekarang, tier tidak akan seimbang. Lanjutkan? (Anda bisa batalkan persetujuan nanti)`,
                                  onConfirm: () => approveMutation.mutate({
                                    id: selected.id,
                                    data: {
                                      approvals: pendingApprovals.map((p: { playerId: string; player: { tier: string } }) => ({
                                        playerId: p.playerId, tier: tierOverrides[p.playerId] || p.player.tier, approve: true
                                      }))
                                    }
                                  })
                                });
                              } else {
                                approveMutation.mutate({
                                  id: selected.id,
                                  data: {
                                    approvals: pendingApprovals.map((p: { playerId: string; player: { tier: string } }) => ({
                                      playerId: p.playerId, tier: tierOverrides[p.playerId] || p.player.tier, approve: true
                                    }))
                                  }
                                });
                              }
                            }}>
                            {approveMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                            Setujui Semua
                          </Button>
                        </div>

                        <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar">
                          {pendingApprovals.map((p: { id: string; playerId: string; player: { id: string; gamertag: string; tier: string; points: number } }) => {
                            const effectiveTier = tierOverrides[p.playerId] || p.player.tier;
                            const tc = TIER_COLORS[effectiveTier] || TIER_COLORS.B;
                            return (
                              <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-yellow-500/10">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-sm flex-shrink-0">{tc.icon}</span>
                                  <TierBadge tier={effectiveTier} />
                                  <span className="text-xs font-medium truncate">{p.player.gamertag}</span>
                                  <span className="text-xs text-muted-foreground flex-shrink-0">({p.player.tier}) {p.player.points}pts</span>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <Select value={tierOverrides[p.playerId] || p.player.tier}
                                    onValueChange={v => setTierOverrides(prev => ({ ...prev, [p.playerId]: v }))}>
                                    <SelectTrigger className="w-14 h-8 text-[11px]"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="S">🔥 S</SelectItem>
                                      <SelectItem value="A">⚡ A</SelectItem>
                                      <SelectItem value="B">🛡️ B</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-green-500 hover:text-green-400 hover:bg-green-500/10"
                                    onClick={() => approveMutation.mutate({
                                      id: selected.id,
                                      data: { playerId: p.playerId, tier: tierOverrides[p.playerId] || p.player.tier, approve: true }
                                    })} title="Setujui">
                                    <Check className="w-4 h-4" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                    onClick={() => {
                                      approveMutation.mutate({ id: selected.id, data: { playerId: p.playerId, approve: false } });
                                    }} title="Tolak">
                                    <X className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* ── SECTION 2: PESERTA DISETUJUI ── */}
                    {approvedParticipations.length > 0 && (
                      <div className="border border-border">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-green-400" />
                            <p className="text-sm font-semibold text-green-400">Peserta Disetujui</p>
                            <Badge className="text-xs border-0 bg-green-500/20 text-green-400">{approvedParticipations.length}</Badge>
                          </div>
                          <Button size="sm" variant="outline"
                            className="text-sm h-8 text-orange-500 border-orange-500/30 hover:bg-orange-500/10"
                            disabled={unapproveMutation.isPending}
                            onClick={() => setConfirmDialog({
                              open: true, title: 'Batalkan Semua Persetujuan?',
                              description: `Semua ${approvedParticipations.length} pemain yang sudah disetujui akan dikembalikan ke status "Menunggu".`,
                              onConfirm: () => unapproveMutation.mutate({ id: selected.id, data: { unapproveAll: true } })
                            })}>
                            {unapproveMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                            Batalkan Semua
                          </Button>
                        </div>

                        <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                          {approvedParticipations.map((p: { id: string; playerId: string; tierOverride?: string | null; player: { id: string; gamertag: string; tier: string; points: number } }) => {
                            const effectiveTier = p.tierOverride || p.player?.tier || 'B';
                            const tc = TIER_COLORS[effectiveTier] || TIER_COLORS.B;
                            return (
                              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-background/50">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-sm flex-shrink-0">{tc.icon}</span>
                                  <TierBadge tier={effectiveTier} />
                                  <span className="text-xs font-medium truncate">{p.player?.gamertag}</span>
                                  {p.tierOverride && p.tierOverride !== p.player?.tier && (
                                    <span className="text-xs text-muted-foreground">(asal: {p.player?.tier})</span>
                                  )}
                                </div>
                                <Button size="sm" variant="ghost" className="h-8 text-sm text-orange-500 hover:text-orange-400 hover:bg-orange-500/10"
                                  disabled={unapproveMutation.isPending}
                                  onClick={() => unapproveMutation.mutate({ id: selected.id, data: { playerId: p.playerId } })}>
                                  <RotateCcw className="w-3 h-3 mr-0.5" /> Batalkan
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* ── SECTION 3: TIER BALANCE DASHBOARD ── */}
                    {(pendingApprovals.length > 0 || approvedParticipations.length > 0) && (
                      <div className={`p-4 rounded-lg border-2 transition-colors duration-150
                        ${isTierBalanced ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-bold flex items-center gap-2">
                            {isTierBalanced ? (
                              <><ShieldCheck className="w-4 h-4 text-green-500" /> Tier Seimbang!</>
                            ) : (
                              <><AlertTriangle className="w-4 h-4 text-red-500" /> Tier Tidak Seimbang</>
                            )}
                          </p>
                          {isTierBalanced ? (
                            <Badge className="text-xs border-0 bg-green-500/15 text-green-500 px-2 py-1">🎯 {tierDist.S} tim bisa dibuat</Badge>
                          ) : (
                            <Badge className="text-xs border-0 bg-red-500/15 text-red-500 px-2 py-1">🚫 Generate Tim dinonaktifkan</Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          {(['S', 'A', 'B'] as const).map(tier => {
                            const count = tierDist[tier];
                            const maxCount = Math.max(tierDist.S, tierDist.A, tierDist.B, 1);
                            const pct = Math.round((count / maxCount) * 100);
                            const tc = TIER_COLORS[tier];
                            const deficit = tierMaxCount - count;
                            return (
                              <div key={tier} className={`p-2.5 rounded-lg ${tc.bg} border border-current/10`}>
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className={`text-xs font-bold flex items-center gap-1 ${tc.text}`}>
                                    <span>{tc.icon}</span> {tier}
                                  </span>
                                  <span className={`text-lg font-black ${tc.text}`}>{count}</span>
                                </div>
                                <div className={`h-2 rounded-full ${tc.bg} overflow-hidden`}>
                                  <div className={`h-full rounded-full ${tc.bar} transition-[width,colors] duration-300`} style={{ width: `${pct}%` }} />
                                </div>
                                {!isTierBalanced && deficit > 0 && (
                                  <p className="text-sm text-red-400 mt-1 font-medium">Kurang {deficit}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* ── SECTION 4: GENERATE TIM ── */}
                    {approvedParticipations.length > 0 && (
                      <div className="space-y-2">
                        <Button size="lg" className={`text-sm h-11 px-5 w-full sm:w-auto ${isTierBalanced ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-muted/50 text-muted-foreground cursor-not-allowed'}`}
                          disabled={!isTierBalanced || generateTeamsMutation.isPending}
                          onClick={() => setConfirmDialog({
                            open: true, title: 'Generate Tim?',
                            description: `${approvedParticipations.length} player akan dibagi menjadi ${tierDist.S} tim (1S+1A+1B).`,
                            onConfirm: async () => {
                              const pool = parseInt(manualPrizePool) || 0;
                              if (pool > 0 || (wantsManualPrize && prizes.some(p => p.prizeAmount > 0))) {
                                await fetch(`/api/tournaments/${selected.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                                  body: JSON.stringify({
                                    prizePool: pool,
                                    prizes: wantsManualPrize ? prizes.filter(p => p.label && p.prizeAmount > 0).map(p => ({
                                      ...p,
                                      recipientCount: p.isMvp || p.label.toLowerCase().includes('mvp') ? 1 : 3
                                    })) : []
                                  })
                                });
                              }
                              generateTeamsMutation.mutate(selected.id);
                            }
                          })}>
                          {generateTeamsMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}
                          Generate Tim ({tierDist.S} tim)
                        </Button>
                        {!isTierBalanced && (
                          <p className="text-sm text-red-400/80">Tier harus seimbang (S=A=B) untuk generate tim. Kurang: {tierMaxCount - tierDist.S}S, {tierMaxCount - tierDist.A}A, {tierMaxCount - tierDist.B}B</p>
                        )}
                      </div>
                    )}

                    {/* ── SECTION 5: POOL PEMAIN TERSEDIA ── */}
                    <div className="rounded-lg border border-border/30 bg-muted/10 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <UserPlus className="w-4 h-4 text-muted-foreground" />
                          <p className="text-sm font-medium text-muted-foreground">Pool Pemain Tersedia</p>
                          <Badge variant="outline" className="text-xs">{unregistered.length}</Badge>
                        </div>
                        <Button size="sm" variant="outline" className="h-8 text-sm"
                          disabled={unregistered.length === 0 || registerMutation.isPending}
                          onClick={() => setConfirmDialog({
                            open: true, title: 'Daftarkan Semua Player?',
                            description: `${unregistered.length} player akan didaftarkan ke tournament ini.`,
                            onConfirm: () => registerMutation.mutate({
                              id: selected.id,
                              data: { playerIds: unregistered.map((p: { id: string }) => p.id) }
                            })
                          })}>
                          {registerMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <UserPlus className="w-3 h-3 mr-1" />}
                          Daftarkan Semua
                        </Button>
                      </div>

                      <Input placeholder="🔍 Cari player..." value={searchPlayer} onChange={e => setSearchPlayer(e.target.value)} className="h-9 text-xs" />

                      <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                        {filteredUnregistered.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">{searchPlayer ? 'Tidak ditemukan' : 'Semua pemain sudah terdaftar'}</p>
                        )}
                        {filteredUnregistered.slice(0, 20).map((p: { id: string; gamertag: string; name: string; tier: string; points: number }) => (
                          <div key={p.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/40 transition-colors">
                            <div className="flex items-center gap-2">
                              <TierBadge tier={p.tier} />
                              <span className="text-xs font-medium">{p.gamertag}</span>
                              <span className="text-xs text-muted-foreground">{p.points}pts</span>
                            </div>
                            <Button size="sm" variant="ghost" className={`h-8 text-xs ${dt.neonText}`}
                              onClick={() => registerMutation.mutate({ id: selected.id, data: { playerId: p.id } })}>
                              <Plus className="w-3.5 h-3.5 mr-1" /> Daftar
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ── Empty state when no participants ── */}
                    {pendingApprovals.length === 0 && approvedParticipations.length === 0 && (
                      <div className="py-6 text-center">
                        <p className="text-xs text-muted-foreground">Belum ada peserta terdaftar</p>
                        <p className="text-sm text-muted-foreground/70 mt-1">Tambahkan pemain dari pool di atas</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ===== APPROVAL PHASE — Now merged into registration phase above ===== */}
            {false && selected.status === 'approval' && (
              <div className="space-y-5">
                {/* Step indicator — bigger and clearer */}
                <div className="flex items-center gap-3">
                  <button
                    className={`flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold transition-colors duration-150
                      ${approvalStep === 'approve'
                        ? 'bg-yellow-500/15 text-yellow-500 border-2 border-yellow-500/30'
                        : 'bg-muted/30 text-muted-foreground border border-border/10 hover:bg-muted/50'}`}
                    onClick={() => setApprovalStep('approve')}>
                    <span className="text-base">⏳</span> Persetujuan
                  </button>
                  <ArrowRight className="w-4 h-4 text-muted-foreground/30" />
                  <button
                    className={`flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold transition-colors duration-150
                      ${approvalStep === 'prize'
                        ? 'bg-idm-gold-warm/15 text-idm-gold-warm border-2 border-idm-gold-warm/30'
                        : 'bg-muted/30 text-muted-foreground border border-border/10 hover:bg-muted/50'}`}
                    onClick={() => setApprovalStep('prize')}>
                    <span className="text-base">💰</span> Hadiah
                  </button>
                  {approvedParticipations.length > 0 && (
                    <Badge className="text-xs border-0 bg-green-500/10 text-green-500 ml-auto px-3 py-1.5">✅ {approvedParticipations.length} disetujui</Badge>
                  )}
                </div>

                {/* ===== STEP 1: APPROVE PARTICIPANTS ===== */}
                {approvalStep === 'approve' && (
                  <>
                    <p className="text-base font-semibold text-yellow-500 flex items-center gap-2">⏳ Fase Persetujuan — Set Tier & Setujui Pemain</p>
                    <p className="text-sm text-muted-foreground">Atur tier setiap pemain (S/A/B), lalu setujui. Tier harus seimbang (S=A=B) untuk generate tim.</p>

                    {/* ===== TIER BALANCE STATUS — BIG & PROMINENT ===== */}
                    <div className={`p-5 rounded-lg border-2 transition-colors duration-150
                      ${isTierBalanced
                        ? 'bg-green-500/5 border-green-500/30'
                        : 'bg-red-500/5 border-red-500/30'}`}>
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-base font-bold flex items-center gap-2">
                          {isTierBalanced ? (
                            <><ShieldCheck className="w-5 h-5 text-green-500" /> Tier Seimbang!</>
                          ) : (
                            <><AlertTriangle className="w-5 h-5 text-red-500" /> Tier Tidak Seimbang</>
                          )}
                        </p>
                        {isTierBalanced ? (
                          <Badge className="text-sm border-0 bg-green-500/15 text-green-500 px-3 py-1.5">🎯 {tierDist.S} tim bisa dibuat</Badge>
                        ) : (
                          <Badge className="text-sm border-0 bg-red-500/15 text-red-500 px-3 py-1.5">🚫 Generate Tim dinonaktifkan</Badge>
                        )}
                      </div>

                      {/* Visual tier bars */}
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        {(['S', 'A', 'B'] as const).map(tier => {
                          const count = tierDist[tier];
                          const maxCount = Math.max(tierDist.S, tierDist.A, tierDist.B, 1);
                          const pct = Math.round((count / maxCount) * 100);
                          const tc = TIER_COLORS[tier];
                          const deficit = tierMaxCount - count;
                          return (
                            <div key={tier} className={`p-3 rounded-lg ${tc.bg} border border-current/10`}>
                              <div className="flex items-center justify-between mb-2">
                                <span className={`text-sm font-bold flex items-center gap-1.5 ${tc.text}`}>
                                  <span className="text-lg">{tc.icon}</span> Tier {tier}
                                </span>
                                <span className={`text-2xl font-black ${tc.text}`}>{count}</span>
                              </div>
                              <div className={`h-2.5 rounded-full ${tc.bg} overflow-hidden`}>
                                <div className={`h-full rounded-full ${tc.bar} transition-[width,colors] duration-300`} style={{ width: `${pct}%` }} />
                              </div>
                              {!isTierBalanced && deficit > 0 && (
                                <p className="text-[11px] text-red-400 mt-1.5 font-medium">Kurang {deficit} pemain</p>
                              )}
                              {isTierBalanced && (
                                <p className="text-[11px] text-green-500 mt-1.5 font-medium">✓ Seimbang</p>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {!isTierBalanced && (
                        <div className="p-4 rounded-lg bg-red-500/10 border border-border">
                          <p className="text-sm text-red-400 font-bold flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" /> Tier harus seimbang (S = A = B) untuk generate tim
                          </p>
                          <p className="text-xs text-red-400/70 mt-1">
                            Butuh tambahan: {tierMaxCount - tierDist.S}S, {tierMaxCount - tierDist.A}A, {tierMaxCount - tierDist.B}B
                            — atau ubah tier pemain yang sudah ada, atau batalkan persetujuan yang salah tier
                          </p>
                        </div>
                      )}

                      {isTierBalanced && (
                        <div className="p-4 rounded-lg bg-green-500/10 border border-border">
                          <p className="text-sm text-green-500 font-bold flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4" /> Siap generate {tierDist.S} tim! Setiap tim = 1S + 1A + 1B
                          </p>
                        </div>
                      )}
                    </div>

                    {/* ===== ALREADY APPROVED PLAYERS (with unapprove) ===== */}
                    {approvedParticipations.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-green-500 flex items-center gap-1.5">
                            ✅ Disetujui ({approvedParticipations.length})
                          </p>
                          <div className="flex gap-2">
                            {/* Unapprove All button */}
                            <Button size="sm" variant="outline"
                              className="text-xs h-8 text-orange-500 border-orange-500/30 hover:bg-orange-500/10"
                              disabled={unapproveMutation.isPending}
                              onClick={() => setConfirmDialog({
                                open: true,
                                title: 'Batalkan Semua Persetujuan?',
                                description: `Semua ${approvedParticipations.length} pemain yang sudah disetujui akan dikembalikan ke status "Terdaftar". Tier override juga akan dihapus. Ini memungkinkan Anda mengatur ulang tier untuk menyeimbangkan.`,
                                onConfirm: () => unapproveMutation.mutate({ id: selected.id, data: { unapproveAll: true } })
                              })}>
                              {unapproveMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                              Batalkan Semua
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                          {approvedParticipations.map((p: { id: string; playerId: string; tierOverride?: string | null; player: { id: string; gamertag: string; tier: string; points: number } }) => {
                            const effectiveTier = p.tierOverride || p.player?.tier || 'B';
                            const tc = TIER_COLORS[effectiveTier] || TIER_COLORS.B;
                            return (
                              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                                <div className="flex items-center gap-2.5">
                                  <span className="text-sm">{tc.icon}</span>
                                  <TierBadge tier={effectiveTier} />
                                  <span className="text-sm font-medium">{p.player?.gamertag}</span>
                                  {p.tierOverride && p.tierOverride !== p.player?.tier && (
                                    <span className="text-xs text-muted-foreground">(asal: {p.player?.tier})</span>
                                  )}
                                  <span className="text-xs text-muted-foreground">{p.player?.points}pts</span>
                                </div>
                                <Button size="sm" variant="ghost"
                                  className="h-8 text-xs text-orange-500 hover:text-orange-400 hover:bg-orange-500/10"
                                  disabled={unapproveMutation.isPending}
                                  onClick={() => setConfirmDialog({
                                    open: true,
                                    title: 'Batalkan Persetujuan?',
                                    description: `${p.player?.gamertag} akan dikembalikan ke status "Terdaftar". Anda bisa mengatur ulang tier-nya.`,
                                    onConfirm: () => unapproveMutation.mutate({ id: selected.id, data: { playerId: p.playerId } })
                                  })}>
                                  <RotateCcw className="w-3 h-3 mr-1" /> Batalkan
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <Separator />

                    {/* ===== PENDING APPROVALS (with tier override) ===== */}
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-yellow-500 flex items-center gap-1.5">
                        ⏳ Menunggu Persetujuan ({pendingApprovals.length})
                      </p>

                      {pendingApprovals.length === 0 ? (
                        <div className="border border-border">
                          <p className="text-sm text-green-500 font-medium">✅ Semua pemain sudah disetujui!</p>
                          {!isTierBalanced && (
                            <p className="text-xs text-orange-400 mt-2">
                              ⚠️ Tapi tier belum seimbang. Gunakan <strong>"Batalkan"</strong> di pemain yang salah tier, ubah tier-nya, lalu setujui lagi.
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar">
                          {pendingApprovals.map((p: { id: string; playerId: string; player: { id: string; gamertag: string; tier: string; points: number } }) => {
                            const effectiveTier = tierOverrides[p.playerId] || p.player.tier;
                            const tc = TIER_COLORS[effectiveTier] || TIER_COLORS.B;
                            return (
                              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
                                <div className="flex items-center gap-2.5">
                                  <span className="text-sm">{tc.icon}</span>
                                  <TierBadge tier={effectiveTier} />
                                  <span className="text-sm font-medium">{p.player.gamertag}</span>
                                  <span className="text-xs text-muted-foreground">({p.player.tier}) {p.player.points}pts</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Select value={tierOverrides[p.playerId] || p.player.tier}
                                    onValueChange={v => setTierOverrides(prev => ({ ...prev, [p.playerId]: v }))}>
                                    <SelectTrigger className="w-16 h-8 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="S">🔥 S</SelectItem>
                                      <SelectItem value="A">⚡ A</SelectItem>
                                      <SelectItem value="B">🛡️ B</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Button size="sm" variant="ghost" className="h-8 text-xs text-green-500 hover:text-green-400 hover:bg-green-500/10"
                                    onClick={() => approveMutation.mutate({
                                      id: selected.id,
                                      data: { playerId: p.playerId, tier: tierOverrides[p.playerId] || p.player.tier, approve: true }
                                    })}>
                                    <Check className="w-4 h-4 mr-1" /> Setujui
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* ===== BULK APPROVE — with tier balance warning ===== */}
                    {pendingApprovals.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <Button size="default" variant="outline" className="text-sm h-10 px-5"
                            disabled={approveMutation.isPending}
                            onClick={() => {
                              if (wouldBulkApproveBreakBalance) {
                                setConfirmDialog({
                                  open: true,
                                  title: '⚠️ Tier Akan Tidak Seimbang!',
                                  description: `Jika Anda menyetujui semua pemain sekarang, tier tidak akan seimbang (S≠A≠B). Anda tidak bisa generate tim sampai tier seimbang. Lanjutkan? (Anda bisa batalkan persetujuan nanti)`,
                                  onConfirm: () => approveMutation.mutate({
                                    id: selected.id,
                                    data: {
                                      approvals: pendingApprovals.map((p: { playerId: string; player: { tier: string } }) => ({
                                        playerId: p.playerId,
                                        tier: tierOverrides[p.playerId] || p.player.tier,
                                        approve: true
                                      }))
                                    }
                                  })
                                });
                              } else {
                                approveMutation.mutate({
                                  id: selected.id,
                                  data: {
                                    approvals: pendingApprovals.map((p: { playerId: string; player: { tier: string } }) => ({
                                      playerId: p.playerId,
                                      tier: tierOverrides[p.playerId] || p.player.tier,
                                      approve: true
                                    }))
                                  }
                                });
                              }
                            }}>
                            {approveMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Check className="w-4 h-4 mr-1.5" />}
                            Setujui Semua ({pendingApprovals.length})
                          </Button>
                        </div>

                        {wouldBulkApproveBreakBalance && (
                          <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-border">
                            <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
                            <p className="text-xs text-yellow-500 font-medium">
                              Menyetujui semua pemain akan menyebabkan tier tidak seimbang. Sebaiknya atur tier dulu sebelum approve, atau approve satu per satu per tier.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ===== GENERATE TIM — only when tier balanced ===== */}
                    {approvedParticipations.length > 0 && (
                      <div className="space-y-3 pt-2 border-t border-border/20">
                        <Button size="lg" className={`text-base h-12 px-6 w-full sm:w-auto ${isTierBalanced ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-muted/50 text-muted-foreground cursor-not-allowed'}`}
                          disabled={!isTierBalanced || generateTeamsMutation.isPending}
                          onClick={() => setConfirmDialog({
                            open: true, title: 'Generate Tim?',
                            description: `${approvedParticipations.length} player akan dibagi menjadi ${tierDist.S} tim (1S+1A+1B).`,
                            onConfirm: async () => {
                              const pool = parseInt(manualPrizePool) || 0;
                              if (pool > 0 || (wantsManualPrize && prizes.some(p => p.prizeAmount > 0))) {
                                await fetch(`/api/tournaments/${selected.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                                  body: JSON.stringify({
                                    prizePool: pool,
                                    prizes: wantsManualPrize ? prizes.filter(p => p.label && p.prizeAmount > 0).map(p => ({
                                      ...p,
                                      recipientCount: p.isMvp || p.label.toLowerCase().includes('mvp') ? 1 : 3
                                    })) : []
                                  })
                                });
                              }
                              generateTeamsMutation.mutate(selected.id);
                            }
                          })}>
                          {generateTeamsMutation.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Users className="w-5 h-5 mr-2" />}
                          Generate Tim ({tierDist.S} tim)
                        </Button>
                        {!isTierBalanced && (
                          <div className="flex items-center gap-2 p-4 rounded-lg bg-red-500/5 border border-border">
                            <ShieldX className="w-5 h-5 text-red-500 shrink-0" />
                            <div>
                              <p className="text-sm text-red-400 font-bold">Tier harus seimbang (S=A=B) untuk generate tim</p>
                              <p className="text-xs text-red-400/70 mt-0.5">
                                Butuh: S={tierDist.S}, A={tierDist.A}, B={tierDist.B} → Kurang {tierMaxCount - tierDist.S}S, {tierMaxCount - tierDist.A}A, {tierMaxCount - tierDist.B}B
                              </p>
                              <p className="text-xs text-orange-400/80 mt-1">
                                Tips: Batalkan persetujuan pemain di tier yang kelebihan, ubah tier-nya, lalu setujui lagi.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Next step to prize */}
                    {approvedParticipations.length > 0 && (
                      <div className="space-y-1.5">
                        <Button size="default" className="text-sm h-9 bg-idm-gold-warm hover:bg-idm-gold-warm/80 text-black px-4"
                          onClick={() => setApprovalStep('prize')}>
                          Lanjut ke Hadiah →
                        </Button>
                        {!isTierBalanced && (
                          <p className="text-sm text-yellow-500/80">Anda bisa lanjut ke hadiah sambil menunggu tier seimbang.</p>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* ===== STEP 2: PRIZE DISTRIBUTION ===== */}
                {approvalStep === 'prize' && (
                  <>
                    <p className="text-base font-semibold text-idm-gold-warm flex items-center gap-2">Pembagian Hadiah</p>
                    <p className="text-sm text-muted-foreground">Atur prize pool dan pembagian hadiah untuk pemenang.</p>

                    {/* Prize Pool Calculator */}
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs font-semibold">Rp. Pendaftaran Peserta (per orang)</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">Rp</span>
                          <Input
                            type="number"
                            placeholder="20000"
                            value={registrationFee}
                            onChange={e => setRegistrationFee(e.target.value)}
                            className="h-8 text-xs flex-1"
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{approvedParticipations.length} peserta × Rp {parseInt(registrationFee || '0').toLocaleString('id-ID')} = {formatCurrency(basePrizePoolRef)}</p>
                      </div>
                      <div>
                        <Label className="text-xs font-semibold">Rp. Total Sawer (week ini)</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">Rp</span>
                          <Input
                            type="number"
                            placeholder={String(approvedSawer)}
                            value={totalSawerInput}
                            onChange={e => setTotalSawerInput(e.target.value)}
                            className="h-8 text-xs flex-1"
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{totalSawerInput ? 'Input manual' : `Otomatis dari donasi: ${formatCurrency(approvedSawer)}`}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-idm-gold-warm/5 border border-idm-gold-warm/20">
                        <div className="flex justify-between text-xs font-semibold text-idm-gold-warm">
                          <span>Total Prize Pool:</span>
                          <span>{formatCurrency(referencePrizePool)}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {approvedParticipations.length} × Rp {parseInt(registrationFee || '0').toLocaleString('id-ID')} + {formatCurrency(effectiveSawer)} sawer
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs font-semibold">Total Prize Pool (override)</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">Rp</span>
                          <Input
                            type="number"
                            placeholder={String(referencePrizePool)}
                            value={manualPrizePool}
                            onChange={e => setManualPrizePool(e.target.value)}
                            className="h-8 text-xs flex-1"
                          />
                          {manualPrizePool && parseInt(manualPrizePool) !== referencePrizePool && (
                            <span className={`text-sm font-medium ${parseInt(manualPrizePool) > referencePrizePool ? 'text-green-500' : 'text-red-500'}`}>
                              {parseInt(manualPrizePool) > referencePrizePool ? '+' : ''}{formatCurrency(parseInt(manualPrizePool) - referencePrizePool)} dari referensi
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Otomatis terisi dari hitungan sistem. Ubah jika perlu penyesuaian manual.</p>
                      </div>
                    </div>

                    {/* Manual prize distribution toggle */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="manualPrize"
                        checked={wantsManualPrize}
                        onChange={e => {
                          setWantsManualPrize(e.target.checked);
                          setShowPrizeConfig(e.target.checked);
                        }}
                        className="rounded border-muted-foreground/30"
                      />
                      <label htmlFor="manualPrize" className="text-xs font-medium cursor-pointer">
                        Saya ingin atur pembagian hadiah manual
                      </label>
                    </div>

                    {/* Prize inputs */}
                    {showPrizeConfig && wantsManualPrize && (
                      <div className="space-y-2 pt-2 border-t border-border/20">
                        <p className="text-sm text-muted-foreground">
                          Pembagian Hadiah — Juara 1/2/3: Rp / 1000 / 3 = pts/org | MVP: Rp / 1000 / 1 = pts
                        </p>
                        {prizes.map((prize, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <Input placeholder="Label" value={prize.label} className="h-8 text-sm flex-1"
                              onChange={e => setPrizes(prev => prev.map((p, j) => j === i ? { ...p, label: e.target.value, isMvp: e.target.value.toLowerCase().includes('mvp') } : p))} />
                            <Input placeholder="Hadiah (Rp)" type="number" value={prize.prizeAmount || ''} className="h-8 text-sm w-28"
                              onChange={e => setPrizes(prev => prev.map((p, j) => j === i ? { ...p, prizeAmount: parseInt(e.target.value) || 0 } : p))} />
                            <span className="text-xs text-muted-foreground w-12 text-center">
                              {prize.isMvp || prize.label.toLowerCase().includes('mvp') ? '÷ 1' : '÷ 3'}
                            </span>
                            <span className="text-xs font-medium text-idm-gold-warm w-16">
                              = {Math.floor((prize.prizeAmount / 1000) / (prize.isMvp || prize.label.toLowerCase().includes('mvp') ? 1 : 3))} pts{prize.isMvp || prize.label.toLowerCase().includes('mvp') ? '' : '/org'}
                            </span>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 touch-icon text-red-500"
                              onClick={() => setPrizes(prev => prev.filter((_, j) => j !== i))}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                        <Button size="sm" variant="outline" className="text-sm h-8"
                          onClick={() => setPrizes(prev => [...prev, { label: '', position: prev.length + 1, prizeAmount: 0, recipientCount: 3, isMvp: false }])}>
                          <Plus className="w-3 h-3 mr-1" /> Tambah Hadiah
                        </Button>

                        {/* Prize Distribution Summary */}
                        {(() => {
                          const totalUsed = prizes.reduce((sum, p) => sum + p.prizeAmount, 0);
                          const effectivePool = parseInt(manualPrizePool) || referencePrizePool;
                          return (
                            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 text-sm">
                              <span>Total Terpakai:</span>
                              <span className={totalUsed === effectivePool ? 'text-green-500 font-semibold' : totalUsed > effectivePool ? 'text-red-500' : 'text-yellow-500'}>
                                {formatCurrency(totalUsed)} / {formatCurrency(effectivePool)}
                                {totalUsed !== effectivePool && (
                                  <span className="ml-1">
                                    ({totalUsed > effectivePool ? 'kelebihan' : 'kurang'} {formatCurrency(Math.abs(totalUsed - effectivePool))})
                                  </span>
                                )}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Generate Tim — from prize step too */}
                    {approvedParticipations.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-border/20">
                        <Button size="lg" className={`text-base h-12 px-6 w-full sm:w-auto ${isTierBalanced ? 'bg-idm-gold-warm hover:bg-idm-gold-warm/80 text-black' : 'bg-muted/50 text-muted-foreground cursor-not-allowed'}`}
                          disabled={!isTierBalanced || generateTeamsMutation.isPending}
                          onClick={() => setConfirmDialog({
                            open: true, title: 'Generate Tim?',
                            description: `${approvedParticipations.length} player akan dibagi menjadi ${tierDist.S} tim (1S+1A+1B). Hadiah akan disimpan.`,
                            onConfirm: async () => {
                              const pool = parseInt(manualPrizePool) || referencePrizePool;
                              await fetch(`/api/tournaments/${selected.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                                body: JSON.stringify({
                                  prizePool: pool,
                                  prizes: wantsManualPrize ? prizes.filter(p => p.label && p.prizeAmount > 0).map(p => ({
                                    ...p,
                                    recipientCount: p.isMvp || p.label.toLowerCase().includes('mvp') ? 1 : 3
                                  })) : []
                                })
                              });
                              generateTeamsMutation.mutate(selected.id);
                            }
                          })}>
                          {generateTeamsMutation.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Users className="w-5 h-5 mr-2" />}
                          Generate Tim ({tierDist.S} tim)
                        </Button>
                        {!isTierBalanced && (
                          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/5 border border-border">
                            <ShieldX className="w-4 h-4 text-red-500 shrink-0" />
                            <p className="text-xs text-red-400 font-medium">Tier harus seimbang (S=A=B) untuk generate tim. Kembali ke tab Persetujuan untuk memperbaiki.</p>
                          </div>
                        )}
                      </div>
                    )}

                    <Button size="default" variant="ghost" className="text-xs h-9"
                      onClick={() => setApprovalStep('approve')}>
                      <ChevronLeft className="w-4 h-4 mr-1.5" /> Kembali ke Persetujuan
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* ===== TEAM GENERATION ===== */}
            {(selected.status === 'team_generation' || (selected.status === 'approval' && selected.teams?.length > 0)) && selected.teams?.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-base font-semibold text-green-500 flex items-center gap-2">✅ Tim ({selected.teams.length})</p>
                  {selected.status === 'team_generation' && (
                    <Button size="sm" variant="outline" className="text-xs h-8"
                      disabled={generateTeamsMutation.isPending}
                      onClick={() => setConfirmDialog({
                        open: true, title: 'Re-generate Tim?',
                        description: 'Tim yang ada akan dihapus dan dibuat ulang secara random.',
                        onConfirm: () => generateTeamsMutation.mutate(selected.id)
                      })}>
                      <RefreshCw className="w-3 h-3 mr-1" /> Re-generate
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selected.teams.map((t: { id: string; name: string; power: number; isWinner: boolean; rank: number | null; teamPlayers: { player: { gamertag: string; tier: string; points: number } }[] }) => (
                    <div key={t.id} className={`p-3 rounded-lg text-sm ${t.isWinner ? 'bg-idm-gold-warm/5 border border-border' : t.rank ? 'bg-muted/50 border border-border/30' : 'bg-muted/30'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">{t.name} {t.isWinner && '👑'} {t.rank === 2 && '🥈'} {t.rank === 3 && '🥉'}</span>
                        <span className={dt.neonText}>⚡ {t.power}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {t.teamPlayers.map((tp: any) => (
                          <span key={tp.player.gamertag} className="flex items-center gap-1 px-2 py-0.5 rounded bg-muted/50 text-xs">
                            <TierBadge tier={tp.tier || tp.player.tier}  /> {tp.player.gamertag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {selected.status === 'team_generation' && (
                  <Button size="default" className="text-sm h-9 bg-idm-gold-warm hover:bg-idm-gold-warm/80 text-black px-4"
                    onClick={() => setConfirmDialog({
                      open: true, title: 'Generate Bracket?',
                      description: `Bracket akan di-generate untuk ${selected.teams.length} tim dengan format ${FORMAT_LABELS[selected.format]}.`,
                      onConfirm: () => generateBracketMutation.mutate(selected.id)
                    })}>
                    <Zap className="w-4 h-4 mr-1.5" /> Generate Bracket
                  </Button>
                )}
              </div>
            )}

            {/* ===== PRIZE EDITING (available in later phases, except finalization which has its own) ===== */}
            {['team_generation', 'bracket_generation', 'main_event'].includes(selected.status) && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold flex items-center gap-1.5">
                    <Gift className="w-4 h-4 text-idm-gold-warm" /> Pembagian Hadiah
                  </p>
                  <Button size="sm" variant="ghost" className="text-sm h-8"
                    onClick={() => setShowPrizeConfig(!showPrizeConfig)}>
                    {showPrizeConfig ? 'Sembunyikan' : 'Edit Hadiah'}
                  </Button>
                </div>
                <div className="p-2.5 rounded-lg bg-idm-gold-warm/5 border border-border text-sm">
                  <p className="font-semibold text-idm-gold-warm mb-1">Info Prize Pool (Referensi)</p>
                  <div className="flex justify-between"><span>Dari Pendaftaran:</span><span>{approvedParticipations.length} × Rp {parseInt(registrationFee || '0').toLocaleString('id-ID')} = {formatCurrency(basePrizePoolRef)}</span></div>
                  <div className="flex justify-between"><span>Dari Sawer:</span><span>{formatCurrency(effectiveSawer)}</span></div>
                  <div className="flex justify-between font-semibold text-idm-gold-warm border-t border-idm-gold-warm/10 pt-1 mt-1"><span>Total Referensi:</span><span>{formatCurrency(referencePrizePool)}</span></div>
                  {selected.prizePool > 0 && selected.prizePool !== referencePrizePool && (
                    <div className="flex justify-between mt-1 pt-1 border-t border-idm-gold-warm/10">
                      <span>Prize Pool Aktif:</span>
                      <span className="font-semibold">{formatCurrency(selected.prizePool)}</span>
                    </div>
                  )}
                </div>
                {showPrizeConfig && (
                  <div className="space-y-2 pt-2 border-t border-border/20">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold">Rp. Pendaftaran Peserta (per orang)</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Rp</span>
                        <Input
                          type="number"
                          placeholder="20000"
                          value={registrationFee}
                          onChange={e => setRegistrationFee(e.target.value)}
                          className="h-8 text-sm flex-1"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">{approvedParticipations.length} peserta × Rp {parseInt(registrationFee || '0').toLocaleString('id-ID')} = {formatCurrency(basePrizePoolRef)}</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold">Rp. Total Sawer (week ini)</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Rp</span>
                        <Input
                          type="number"
                          placeholder={String(approvedSawer)}
                          value={totalSawerInput}
                          onChange={e => setTotalSawerInput(e.target.value)}
                          className="h-8 text-sm flex-1"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">{totalSawerInput ? 'Input manual' : `Otomatis dari donasi: ${formatCurrency(approvedSawer)}`}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-idm-gold-warm/5 border border-idm-gold-warm/20">
                      <div className="flex justify-between text-xs font-semibold text-idm-gold-warm">
                        <span>Total Prize Pool:</span>
                        <span>{formatCurrency(referencePrizePool)}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {approvedParticipations.length} × Rp {parseInt(registrationFee || '0').toLocaleString('id-ID')} + {formatCurrency(effectiveSawer)} sawer
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold">Total Prize Pool (override)</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Rp</span>
                        <Input
                          type="number"
                          placeholder={String(referencePrizePool)}
                          value={manualPrizePool}
                          onChange={e => setManualPrizePool(e.target.value)}
                          className="h-8 text-sm flex-1"
                        />
                        {manualPrizePool && parseInt(manualPrizePool) !== referencePrizePool && (
                          <span className={`text-xs font-medium ${parseInt(manualPrizePool) > referencePrizePool ? 'text-green-500' : 'text-red-500'}`}>
                            {parseInt(manualPrizePool) > referencePrizePool ? '+' : ''}{formatCurrency(parseInt(manualPrizePool) - referencePrizePool)} dari referensi
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">Otomatis terisi dari hitungan sistem. Ubah jika perlu penyesuaian manual.</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="manualPrizeLater"
                        checked={wantsManualPrize}
                        onChange={e => {
                          setWantsManualPrize(e.target.checked);
                          if (!e.target.checked) setShowPrizeConfig(false);
                        }}
                        className="rounded border-muted-foreground/30"
                      />
                      <label htmlFor="manualPrizeLater" className="text-sm font-medium cursor-pointer">
                        Saya ingin atur pembagian hadiah manual
                      </label>
                    </div>

                    {wantsManualPrize && (
                      <>
                        <p className="text-sm text-muted-foreground">
                          Pembagian Hadiah — Juara 1/2/3: Rp / 1000 / 3 = pts/org | MVP: Rp / 1000 / 1 = pts
                        </p>
                        {prizes.map((prize, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <Input placeholder="Label" value={prize.label} className="h-8 text-sm flex-1"
                              onChange={e => setPrizes(prev => prev.map((p, j) => j === i ? { ...p, label: e.target.value, isMvp: e.target.value.toLowerCase().includes('mvp') } : p))} />
                            <Input placeholder="Hadiah (Rp)" type="number" value={prize.prizeAmount || ''} className="h-8 text-sm w-28"
                              onChange={e => setPrizes(prev => prev.map((p, j) => j === i ? { ...p, prizeAmount: parseInt(e.target.value) || 0 } : p))} />
                            <span className="text-xs text-muted-foreground w-12 text-center">
                              {prize.isMvp || prize.label.toLowerCase().includes('mvp') ? '÷ 1' : '÷ 3'}
                            </span>
                            <span className="text-xs font-medium text-idm-gold-warm w-16">
                              = {Math.floor((prize.prizeAmount / 1000) / (prize.isMvp || prize.label.toLowerCase().includes('mvp') ? 1 : 3))} pts{prize.isMvp || prize.label.toLowerCase().includes('mvp') ? '' : '/org'}
                            </span>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 touch-icon text-red-500"
                              onClick={() => setPrizes(prev => prev.filter((_, j) => j !== i))}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="text-sm h-8"
                            onClick={() => setPrizes(prev => [...prev, { label: '', position: prev.length + 1, prizeAmount: 0, recipientCount: 3, isMvp: false }])}>
                            <Plus className="w-3 h-3 mr-1" /> Tambah Hadiah
                          </Button>
                          <Button size="sm" variant="outline" className="text-sm h-8 text-idm-gold-warm"
                            disabled={updateMutation.isPending}
                            onClick={async () => {
                              const pool = parseInt(manualPrizePool) || referencePrizePool;
                              await fetch(`/api/tournaments/${selected.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                                body: JSON.stringify({
                                  prizePool: pool,
                                  prizes: prizes.filter(p => p.label && p.prizeAmount > 0).map(p => ({
                                    ...p,
                                    recipientCount: p.isMvp || p.label.toLowerCase().includes('mvp') ? 1 : 3
                                  }))
                                })
                              });
                              qc.invalidateQueries({ queryKey: ['admin-tournament', selectedId] });
                              toast.success('Hadiah berhasil disimpan!');
                            }}>
                            {updateMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                            Simpan Hadiah
                          </Button>
                        </div>
                        {(() => {
                          const totalUsed = prizes.reduce((sum, p) => sum + p.prizeAmount, 0);
                          const effectivePool = parseInt(manualPrizePool) || referencePrizePool;
                          return (
                            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 text-sm">
                              <span>Total Terpakai:</span>
                              <span className={totalUsed === effectivePool ? 'text-green-500 font-semibold' : totalUsed > effectivePool ? 'text-red-500' : 'text-yellow-500'}>
                                {formatCurrency(totalUsed)} / {formatCurrency(effectivePool)}
                                {totalUsed !== effectivePool && (
                                  <span className="ml-1">
                                    ({totalUsed > effectivePool ? 'kelebihan' : 'kurang'} {formatCurrency(Math.abs(totalUsed - effectivePool))})
                                  </span>
                                )}
                              </span>
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ===== BRACKET / MATCHES ===== */}
            {(selected.status === 'bracket_generation' || selected.status === 'main_event' || selected.status === 'finalization') && selected.matches?.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-purple-500 flex items-center gap-1.5">🏆 Bracket & Pertandingan</p>
                  {selected.status === 'bracket_generation' && (
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" className="text-sm h-8"
                        disabled={generateBracketMutation.isPending}
                        onClick={() => setConfirmDialog({
                          open: true, title: 'Re-generate Bracket?',
                          description: 'Semua match akan dihapus dan dibuat ulang.',
                          onConfirm: () => generateBracketMutation.mutate(selected.id)
                        })}>
                        <RefreshCw className="w-3 h-3 mr-1" /> Re-generate
                      </Button>
                      <Button size="default" className="text-sm h-9 bg-idm-gold-warm hover:bg-idm-gold-warm/80 text-black px-4"
                        onClick={() => updateMutation.mutate({ id: selected.id, data: { status: 'main_event' } })}>
                        <Play className="w-4 h-4 mr-1.5" /> Mulai Event!
                      </Button>
                    </div>
                  )}
                </div>

                {nextMatch && selected.status === 'main_event' && (
                  <div className="p-3 rounded-lg bg-idm-gold-warm/5 border border-border">
                    <p className="text-sm text-idm-gold-warm font-semibold">Match Selanjutnya: {getTeamName(nextMatch.team1Id)} vs {getTeamName(nextMatch.team2Id)}</p>
                  </div>
                )}

                {/* Auto-advance prompt when all playable matches are completed in main_event */}
                {selected.status === 'main_event' && selected.matches?.length > 0 && (() => {
                  const playableMatches = (Array.isArray(selected.matches) ? selected.matches : []).filter((m: { team1Id: string | null; team2Id: string | null; status: string }) => m.team1Id && m.team2Id);
                  const completedPlayable = playableMatches.filter((m: { status: string }) => m.status === 'completed');
                  const hasIncomplete = playableMatches.some((m: { status: string }) => m.status !== 'completed');
                  if (!hasIncomplete && completedPlayable.length > 0) {
                    return (
                      <div className="p-3 rounded-lg bg-green-500/5 border border-border">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-green-400">✅ Semua match selesai!</p>
                            <p className="text-xs text-muted-foreground">{completedPlayable.length} pertandingan telah diselesaikan</p>
                          </div>
                          <Button size="sm" className="text-sm h-8 bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => updateMutation.mutate({ id: selected.id, data: { status: 'finalization' } })}>
                            <ArrowRight className="w-3 h-3 mr-1" /> Lanjut ke Finalisasi
                          </Button>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* ── All formats now use BracketView with admin mode ── */}
                {selected.format === 'single_elimination' ? (
                  /* ── Single Elimination: bracket visual with admin mode ── */
                  <BracketView
                    matches={selected.matches.map((m: any) => ({
                      id: m.id,
                      score1: m.score1,
                      score2: m.score2,
                      status: m.status,
                      team1: m.team1 ? { id: m.team1.id, name: m.team1.name } : null,
                      team2: m.team2 ? { id: m.team2.id, name: m.team2.name } : null,
                      mvpPlayer: m.mvpPlayer ? { id: m.mvpPlayer.id, name: m.mvpPlayer.name, gamertag: m.mvpPlayer.gamertag } : null,
                      round: m.round ?? 1,
                      matchNumber: m.matchNumber,
                      bracket: m.bracket,
                      groupLabel: m.groupLabel,
                      winnerId: m.winnerId,
                      format: m.format,
                      team1Players: m.team1?.teamPlayers?.map((tp: any) => tp.player.gamertag).join(', '),
                      team2Players: m.team2?.teamPlayers?.map((tp: any) => tp.player.gamertag).join(', '),
                    }))}
                    bracketType="single_elimination"
                    mode="admin"
                    adminProps={{
                      tournamentId: selected.id,
                      tournamentStatus: selected.status,
                      getTeamName,
                      scoreInputs,
                      setScoreInputs,
                      scoreMutation,
                      startMatchMutation,
                      undoScoreMutation,
                      setConfirmDialog,
                    }}
                  />
                ) : selected.format === 'upper_semi' ? (
                  /* ── Upper Semi (Double Elimination): bracket visual with admin mode ── */
                  <BracketView
                    matches={selected.matches.map((m: any) => ({
                      id: m.id,
                      score1: m.score1,
                      score2: m.score2,
                      status: m.status,
                      team1: m.team1 ? { id: m.team1.id, name: m.team1.name } : null,
                      team2: m.team2 ? { id: m.team2.id, name: m.team2.name } : null,
                      mvpPlayer: m.mvpPlayer ? { id: m.mvpPlayer.id, name: m.mvpPlayer.name, gamertag: m.mvpPlayer.gamertag } : null,
                      round: m.round ?? 1,
                      matchNumber: m.matchNumber,
                      bracket: m.bracket,
                      groupLabel: m.groupLabel,
                      winnerId: m.winnerId,
                      format: m.format,
                      team1Players: m.team1?.teamPlayers?.map((tp: any) => tp.player.gamertag).join(', '),
                      team2Players: m.team2?.teamPlayers?.map((tp: any) => tp.player.gamertag).join(', '),
                    }))}
                    bracketType="upper_semi"
                    mode="admin"
                    adminProps={{
                      tournamentId: selected.id,
                      tournamentStatus: selected.status,
                      getTeamName,
                      scoreInputs,
                      setScoreInputs,
                      scoreMutation,
                      startMatchMutation,
                      undoScoreMutation,
                      setConfirmDialog,
                    }}
                  />
                ) : selected.format === 'group_stage' ? (
                  /* ── Group Stage: BracketView with standings + playoff visual + admin mode ── */
                  <BracketView
                    matches={selected.matches.map((m: any) => ({
                      id: m.id,
                      score1: m.score1,
                      score2: m.score2,
                      status: m.status,
                      team1: m.team1 ? { id: m.team1.id, name: m.team1.name } : null,
                      team2: m.team2 ? { id: m.team2.id, name: m.team2.name } : null,
                      mvpPlayer: m.mvpPlayer ? { id: m.mvpPlayer.id, name: m.mvpPlayer.name, gamertag: m.mvpPlayer.gamertag } : null,
                      round: m.round ?? 1,
                      matchNumber: m.matchNumber,
                      bracket: m.bracket,
                      groupLabel: m.groupLabel,
                      winnerId: m.winnerId,
                      format: m.format,
                      team1Players: m.team1?.teamPlayers?.map((tp: any) => tp.player.gamertag).join(', '),
                      team2Players: m.team2?.teamPlayers?.map((tp: any) => tp.player.gamertag).join(', '),
                    }))}
                    bracketType="group_stage"
                    mode="admin"
                    adminProps={{
                      tournamentId: selected.id,
                      tournamentStatus: selected.status,
                      getTeamName,
                      scoreInputs,
                      setScoreInputs,
                      scoreMutation,
                      startMatchMutation,
                      undoScoreMutation,
                      setConfirmDialog,
                    }}
                  />
                ) : selected.format === 'swiss' ? (
                  /* ── Swiss: BracketView with standings + playoff visual + admin mode ── */
                  <BracketView
                    matches={selected.matches.map((m: any) => ({
                      id: m.id,
                      score1: m.score1,
                      score2: m.score2,
                      status: m.status,
                      team1: m.team1 ? { id: m.team1.id, name: m.team1.name } : null,
                      team2: m.team2 ? { id: m.team2.id, name: m.team2.name } : null,
                      mvpPlayer: m.mvpPlayer ? { id: m.mvpPlayer.id, name: m.mvpPlayer.name, gamertag: m.mvpPlayer.gamertag } : null,
                      round: m.round ?? 1,
                      matchNumber: m.matchNumber,
                      bracket: m.bracket,
                      groupLabel: m.groupLabel,
                      winnerId: m.winnerId,
                      format: m.format,
                      team1Players: m.team1?.teamPlayers?.map((tp: any) => tp.player.gamertag).join(', '),
                      team2Players: m.team2?.teamPlayers?.map((tp: any) => tp.player.gamertag).join(', '),
                    }))}
                    bracketType="swiss"
                    mode="admin"
                    adminProps={{
                      tournamentId: selected.id,
                      tournamentStatus: selected.status,
                      getTeamName,
                      scoreInputs,
                      setScoreInputs,
                      scoreMutation,
                      startMatchMutation,
                      undoScoreMutation,
                      setConfirmDialog,
                    }}
                  />
                ) : (
                  /* ── Other formats: original flat rendering ── */
                  Object.entries(matchesByBracket).map(([bracket, matches]) => {
                    const sortedMatches = [...matches].sort((a: { round: number; matchNumber: number }, b: { round: number; matchNumber: number }) => a.round - b.round || a.matchNumber - b.matchNumber);
                    const realMatches = sortedMatches.filter((m: { team1Id: string | null; team2Id: string | null; status: string }) => m.team1Id && m.team2Id);
                    const byeMatches = sortedMatches.filter((m: { team1Id: string | null; team2Id: string | null; status: string }) => !m.team1Id || !m.team2Id);

                    const getByeTeamName = (m: { team1Id: string | null; team2Id: string | null; team1: { name: string } | null; team2: { name: string } | null }) => {
                      if (m.team1Id && m.team1) return m.team1.name;
                      if (m.team2Id && m.team2) return m.team2.name;
                      return 'TBD';
                    };

                    return (
                    <div key={bracket}>
                      <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">{BRACKET_LABELS[bracket] || bracket}</p>
                      <div className="space-y-1.5">
                        {realMatches.map((m: any) => (
                          <AdminMatchCard key={m.id} m={m} selected={selected} getTeamName={getTeamName}
                            scoreInputs={scoreInputs} setScoreInputs={setScoreInputs}
                            scoreMutation={scoreMutation} startMatchMutation={startMatchMutation}
                            undoScoreMutation={undoScoreMutation} setConfirmDialog={setConfirmDialog} />
                        ))}

                        {byeMatches.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border/10">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Badge className="text-xs border-0 bg-amber-500/10 text-amber-500 font-bold">BYE</Badge>
                              <span className="text-xs text-muted-foreground">Tim berikut mendapat bye:</span>
                            </div>
                            {byeMatches.map((m: any) => (
                              <div key={m.id} className="px-2 py-1 rounded border border-amber-500/15 bg-amber-500/5 text-xs opacity-70 flex items-center gap-1.5 mb-1">
                                <Badge className="text-xs border-0 bg-amber-500/10 text-amber-500">BYE</Badge>
                                <span className="text-muted-foreground">{getByeTeamName(m)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })
                )}

                <p className="text-sm text-muted-foreground text-center">
                  {Array.isArray(selected.matches) && selected.matches.filter((m: { status: string }) => m.status === 'completed').length} / {selected.matches?.length ?? 0} match selesai
                </p>
              </div>
            )}

            {/* ===== FINALIZATION ===== */}
            {selected.status === 'finalization' && (
              <div className="space-y-4">
                <p className="text-base font-semibold text-idm-gold-warm flex items-center gap-2">🏆 Fase Finalisasi — Pilih MVP & Konfirmasi</p>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground">Pembagian Hadiah</p>
                    <Button size="sm" variant="ghost" className="h-8 text-sm text-idm-gold-warm hover:bg-idm-gold-warm/10"
                      onClick={() => setShowPrizeConfig(!showPrizeConfig)}>
                      {showPrizeConfig ? 'Sembunyikan' : '✏️ Edit Hadiah'}
                    </Button>
                  </div>
                  {selected.prizes?.length > 0 ? (
                    selected.prizes.map((p: { id: string; label: string; prizeAmount: number; pointsPerPlayer: number; recipientCount: number }) => (
                      <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 text-xs">
                        <span className="font-medium">{p.label}</span>
                        <span className="text-idm-gold-warm">
                          {formatCurrency(p.prizeAmount)} → {p.pointsPerPlayer} pts{p.recipientCount > 1 ? `/org × ${p.recipientCount}` : ''}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 rounded-lg bg-yellow-500/10 border border-border">
                      <p className="text-xs text-yellow-500 font-medium">⚠️ Belum ada pembagian hadiah</p>
                      <p className="text-sm text-muted-foreground mt-0.5">Klik "Edit Hadiah" untuk mengatur, atau langsung finalisasi tanpa hadiah.</p>
                    </div>
                  )}

                  {showPrizeConfig && (
                    <div className="space-y-2 p-3 rounded-lg bg-muted/20 border border-border/10">
                      <div>
                        <Label className="text-sm font-semibold">Rp. Pendaftaran Peserta (per orang)</Label>
                        <Input type="number" className="h-8 text-xs mt-1"
                          placeholder="20000"
                          value={registrationFee}
                          onChange={e => setRegistrationFee(e.target.value)} />
                        <p className="text-[11px] text-muted-foreground mt-0.5">{approvedParticipations.length} peserta × Rp {parseInt(registrationFee || '0').toLocaleString('id-ID')} = {formatCurrency(basePrizePoolRef)}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-semibold">Rp. Total Sawer (week ini)</Label>
                        <Input type="number" className="h-8 text-xs mt-1"
                          placeholder={String(approvedSawer)}
                          value={totalSawerInput}
                          onChange={e => setTotalSawerInput(e.target.value)} />
                        <p className="text-[11px] text-muted-foreground mt-0.5">{totalSawerInput ? 'Input manual' : `Otomatis dari donasi: ${formatCurrency(approvedSawer)}`}</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-idm-gold-warm/5 border border-idm-gold-warm/20">
                        <div className="flex justify-between text-xs font-semibold text-idm-gold-warm">
                          <span>Total Prize Pool:</span>
                          <span>{formatCurrency(referencePrizePool)}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {approvedParticipations.length} × Rp {parseInt(registrationFee || '0').toLocaleString('id-ID')} + {formatCurrency(effectiveSawer)} sawer
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-semibold">Total Prize Pool (override)</Label>
                        <Input type="number" className="h-8 text-xs mt-1"
                          placeholder={String(referencePrizePool)}
                          value={manualPrizePool}
                          onChange={e => setManualPrizePool(e.target.value)} />
                        <p className="text-[11px] text-muted-foreground mt-0.5">Otomatis terisi dari hitungan sistem. Ubah jika perlu penyesuaian manual.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="manualPrizeFinal"
                          checked={wantsManualPrize}
                          onChange={e => { setWantsManualPrize(e.target.checked); if (!e.target.checked) setShowPrizeConfig(false); }}
                          className="rounded" />
                        <label htmlFor="manualPrizeFinal" className="text-sm font-medium cursor-pointer">Atur pembagian hadiah manual</label>
                      </div>
                      {wantsManualPrize && (
                        <div className="space-y-1.5">
                          {prizes.map((prize, i) => (
                            <div key={i} className="flex items-center gap-1.5">
                              <Input placeholder="Label" value={prize.label} className="h-8 text-sm flex-1"
                                onChange={e => setPrizes(prev => prev.map((p, j) => j === i ? { ...p, label: e.target.value, isMvp: e.target.value.toLowerCase().includes('mvp') } : p))} />
                              <Input placeholder="Hadiah (Rp)" type="number" value={prize.prizeAmount || ''} className="h-8 text-sm w-28"
                                onChange={e => setPrizes(prev => prev.map((p, j) => j === i ? { ...p, prizeAmount: parseInt(e.target.value) || 0 } : p))} />
                              <span className="text-xs text-muted-foreground w-14">
                                {prize.isMvp || prize.label.toLowerCase().includes('mvp') ? '÷ 1' : '÷ 3'}
                              </span>
                              <span className="text-xs text-idm-gold-warm w-20">
                                = {Math.floor((prize.prizeAmount / 1000) / (prize.isMvp || prize.label.toLowerCase().includes('mvp') ? 1 : 3))} pts{prize.isMvp || prize.label.toLowerCase().includes('mvp') ? '' : '/org'}
                              </span>
                              <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-red-400 hover:text-red-300"
                                onClick={() => setPrizes(prev => prev.filter((_, j) => j !== i))}>
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                          <Button size="sm" variant="outline" className="h-8 text-sm w-full"
                            onClick={() => setPrizes(prev => [...prev, { label: '', position: prev.length + 1, prizeAmount: 0, recipientCount: 3, isMvp: false }])}>
                            <Plus className="w-3 h-3 mr-1" /> Tambah Hadiah
                          </Button>
                          <Button size="sm" className="h-8 text-sm w-full bg-idm-gold-warm hover:bg-idm-gold-warm/80 text-black"
                            disabled={updateMutation.isPending}
                            onClick={() => {
                              const pool = parseInt(manualPrizePool) || referencePrizePool;
                              updateMutation.mutate({
                                id: selected.id,
                                data: {
                                  prizePool: pool,
                                  prizes: prizes.filter(p => p.label && p.prizeAmount > 0).map(p => ({
                                    label: p.label,
                                    position: p.isMvp || p.label.toLowerCase().includes('mvp') ? 99 : p.position,
                                    prizeAmount: p.prizeAmount,
                                    recipientCount: p.isMvp || p.label.toLowerCase().includes('mvp') ? 1 : 3,
                                  })),
                                },
                              });
                            }}>
                            {updateMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                            Simpan Hadiah
                          </Button>
                          {(() => {
                            const totalUsed = prizes.reduce((sum, p) => sum + p.prizeAmount, 0);
                            const effectivePool = parseInt(manualPrizePool) || referencePrizePool;
                            return (
                              <div className={`text-sm p-3 rounded-lg ${totalUsed > effectivePool ? 'bg-red-500/10 text-red-400' : totalUsed === effectivePool ? 'bg-green-500/10 text-green-400' : 'bg-muted/30 text-muted-foreground'}`}>
                                <div className="flex justify-between"><span>Total Hadiah:</span><span>{formatCurrency(totalUsed)}</span></div>
                                <div className="flex justify-between"><span>Prize Pool:</span><span>{formatCurrency(effectivePool)}</span></div>
                                <div className="flex justify-between font-semibold border-t border-current/10 pt-1 mt-1">
                                  <span>Sisa:</span><span>{formatCurrency(effectivePool - totalUsed)}</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Pilih MVP Tournament</p>
                  <Select value={selectedMvp} onValueChange={setSelectedMvp}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Pilih MVP..." /></SelectTrigger>
                    <SelectContent>
                      {selected.participations?.map((p: { playerId: string; pointsEarned: number; player: { id: string; gamertag: string } }) => (
                        <SelectItem key={p.playerId} value={p.playerId}>
                          {p.player.gamertag} ({p.pointsEarned}pts)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button size="default" className="text-sm h-10 bg-idm-gold-warm hover:bg-idm-gold-warm/80 text-black w-full px-4"
                  disabled={finalizeMutation.isPending}
                  onClick={() => setConfirmDialog({
                    open: true, title: 'Finalisasi Tournament?',
                    description: 'Hadiah akan didistribusikan ke pemain. Tournament akan ditandai selesai. Tindakan ini tidak dapat dibatalkan.',
                    onConfirm: () => finalizeMutation.mutate({
                      id: selected.id,
                      data: { mvpPlayerId: selectedMvp || undefined }
                    })
                  })}>
                  {finalizeMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Crown className="w-4 h-4 mr-1.5" />}
                  Finalisasi Tournament
                </Button>
              </div>
            )}

            {/* ===== COMPLETED ===== */}
            {selected.status === 'completed' && (
              <div className="space-y-4">
                <p className="text-base font-semibold text-green-500 flex items-center gap-2">🎉 Tournament Selesai!</p>

                {Array.isArray(selected.teams) && selected.teams.filter((t: { rank: number | null }) => t.rank).sort((a: { rank: number }, b: { rank: number }) => (a.rank || 99) - (b.rank || 99)).map((t: { id: string; name: string; rank: number | null; isWinner: boolean; teamPlayers: { player: { gamertag: string; tier: string } }[] }) => (
                  <div key={t.id} className={`p-3 rounded-lg border ${t.rank === 1 ? 'bg-idm-gold-warm/5 border-idm-gold-warm/20' : t.rank === 2 ? 'bg-gray-500/5 border-gray-500/20' : 'bg-orange-500/5 border-orange-500/20'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{t.rank === 1 ? '🥇' : t.rank === 2 ? '🥈' : '🥉'}</span>
                      <div>
                        <p className="text-xs font-semibold">{t.name}</p>
                        <div className="flex gap-1 mt-0.5">
                          {t.teamPlayers.map((tp: any) => (
                            <span key={tp.player.gamertag} className="flex items-center gap-1 text-xs">
                              <TierBadge tier={tp.tier || tp.player.tier}  /> {tp.player.gamertag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {selected.matches?.map((m: { mvpPlayer: { gamertag: string } | null }) => m.mvpPlayer).filter(Boolean).length > 0 && (
                  <div className="p-3 rounded-lg bg-idm-gold-warm/5 border border-idm-gold-warm/20">
                    <p className="text-sm text-idm-gold-warm">⭐ MVP: {selected.matches.find((m: { mvpPlayer: { gamertag: string } | null }) => m.mvpPlayer)?.mvpPlayer?.gamertag}</p>
                  </div>
                )}

                {selected.prizes?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Distribusi Hadiah:</p>
                    {selected.prizes.map((p: { id: string; label: string; prizeAmount: number; pointsPerPlayer: number; recipientCount: number }) => (
                      <div key={p.id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/30">
                        <span>{p.label}</span>
                        <span>{formatCurrency(p.prizeAmount)} → {p.pointsPerPlayer} pts/org × {p.recipientCount} penerima</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Poin yang Didapat:</p>
                  <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-0.5">
                    {selected.participations?.sort((a: { pointsEarned: number }, b: { pointsEarned: number }) => b.pointsEarned - a.pointsEarned).map((p: { id: string; playerId: string; pointsEarned: number; isMvp: boolean; isWinner: boolean; player: { gamertag: string } }) => (
                      <div key={p.id} className="flex items-center justify-between text-xs p-1 rounded bg-muted/20">
                        <span>{p.player.gamertag} {p.isMvp && '⭐'} {p.isWinner && '👑'}</span>
                        <span className="font-mono">{p.pointsEarned} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ===== EDIT TOURNAMENT DIALOG ===== */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-idm-gold-warm" />
              Edit Tournament
            </DialogTitle>
            <DialogDescription>
              Ubah informasi tournament seperti nama, format, jadwal, dan lokasi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nama Tournament</Label>
                <Input
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Nama Tournament"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Week #</Label>
                <Input
                  type="number"
                  value={editForm.weekNumber}
                  onChange={e => setEditForm(f => ({ ...f, weekNumber: e.target.value }))}
                  placeholder="Week #"
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Format</Label>
                <Select value={editForm.format} onValueChange={v => setEditForm(f => ({ ...f, format: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="swiss">🇨🇭 Swiss + Playoff</SelectItem>
                    <SelectItem value="single_elimination">Single Elimination</SelectItem>
                    <SelectItem value="group_stage">Group Stage + Playoff</SelectItem>
                    <SelectItem value="upper_semi">🏆 Upper Semi (Double Elim)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Match Format</Label>
                <Select value={editForm.defaultMatchFormat} onValueChange={v => setEditForm(f => ({ ...f, defaultMatchFormat: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BO1">BO1</SelectItem>
                    <SelectItem value="BO3">BO3</SelectItem>
                    <SelectItem value="BO5">BO5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Base Prize Pool (tanpa sawer)</Label>
                <Input
                  type="number"
                  value={editForm.prizePool}
                  onChange={e => setEditForm(f => ({ ...f, prizePool: e.target.value }))}
                  placeholder="Prize Pool dasar"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">BPM</Label>
                <Input
                  value={editForm.bpm}
                  onChange={e => setEditForm(f => ({ ...f, bpm: e.target.value }))}
                  placeholder="BPM (contoh: 128 atau Random 120-140)"
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><MapPin className="w-3 h-3" /> Lokasi</Label>
              <Input
                value={editForm.location}
                onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))}
                placeholder="Lokasi (contoh: Online, GOR XYZ)"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Calendar className="w-3 h-3" /> Jadwal (WIB)</Label>
              <Input
                type="datetime-local"
                value={editForm.scheduledAt}
                onChange={e => setEditForm(f => ({ ...f, scheduledAt: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>
            <div className="p-3 rounded-lg bg-muted/30 text-sm text-muted-foreground">
              <p>Perubahan format dan jadwal akan langsung berlaku. Untuk tournament yang sudah berjalan, perubahan hanya mempengaruhi informasi tampilan.</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(false)} className="text-xs">
              Batal
            </Button>
            <Button
              size="sm"
              disabled={!editForm.name || editMutation.isPending}
              onClick={() => editMutation.mutate({
                id: editForm.id,
                name: editForm.name,
                weekNumber: parseInt(editForm.weekNumber) || undefined,
                format: editForm.format,
                defaultMatchFormat: editForm.defaultMatchFormat,
                prizePool: parseInt(editForm.prizePool) || 0,
                bpm: editForm.bpm || undefined,
                location: editForm.location,
                scheduledAt: editForm.scheduledAt || undefined,
              })}
              className="text-xs bg-idm-gold-warm hover:bg-idm-gold-warm/80 text-black"
            >
              {editMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== SPIN REVEAL ANIMATION ===== */}
      {spinRevealData && (
        <TeamSpinReveal
          spinRevealOrder={spinRevealData.spinRevealOrder}
          teamCount={spinRevealData.teamCount}
          onComplete={handleSpinComplete}
          division={division}
          tournamentId={selectedId || ''}
        />
      )}
    </div>
  );
}
