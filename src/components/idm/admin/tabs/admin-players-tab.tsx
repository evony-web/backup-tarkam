'use client';

import Image from 'next/image';
import { AvatarMedia } from '@/components/ui/avatar-media';
import {
  X, Clock, MapPin, Phone, Camera, Pencil, Trash2, Search, Plus, Flame, ChevronDown, Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TierBadge } from '../../tier-badge';
import { getAvatarUrl } from '@/lib/utils';
import { UseMutationResult } from '@tanstack/react-query';

interface ConfirmDialogState {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
}

interface AdminPlayersTabProps {
  pendingRegistrations: any[];
  approveRegistration: UseMutationResult<any, Error, { playerId: string; tier: string }, unknown>;
  rejectRegistration: UseMutationResult<any, Error, string, unknown>;
  filteredPlayers: any[];
  searchPlayer: string;
  setSearchPlayer: (v: string) => void;
  openNewPlayerForm: () => void;
  openEditPlayerForm: (player: any) => void;
  openAvatarPicker: (playerId: string) => void;
  updateTier: UseMutationResult<any, Error, { playerId: string; tier: string }, unknown>;
  deletePlayer: UseMutationResult<any, Error, string, unknown>;
  setConfirmDialog: (state: ConfirmDialogState) => void;
  dt: ReturnType<typeof import('@/hooks/use-division-theme')['useDivisionTheme']>;
  // Pagination props
  totalPlayers: number;
  hasMorePlayers: boolean;
  isLoadingMorePlayers: boolean;
  onLoadMorePlayers: () => void;
}

export function AdminPlayersTab({
  pendingRegistrations,
  approveRegistration,
  rejectRegistration,
  filteredPlayers,
  searchPlayer,
  setSearchPlayer,
  openNewPlayerForm,
  openEditPlayerForm,
  openAvatarPicker,
  updateTier,
  deletePlayer,
  setConfirmDialog,
  dt,
  totalPlayers,
  hasMorePlayers,
  isLoadingMorePlayers,
  onLoadMorePlayers,
}: AdminPlayersTabProps) {
  return (
    <div className="space-y-3">
      {/* Pending Registrations */}
      {pendingRegistrations?.length > 0 && (
        <Card className="border-yellow-500/20 bg-yellow-500/5">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-yellow-500">
              <Clock className="w-4 h-4" /> Pendaftaran Menunggu Persetujuan ({pendingRegistrations.length})
            </h3>
            <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
              {pendingRegistrations.map((p: { id: string; name: string; gamertag: string; division: string; city: string; phone: string | null; joki: string | null; createdAt: string }, index) => (
                <div key={p.id} className="p-4 sm:p-5 rounded-2xl bg-card border border-yellow-500/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold">{p.name}</p>
                        <Badge className={`text-[9px] border-0 ${p.division === 'male' ? 'bg-idm-male/10 text-idm-male' : 'bg-idm-female/10 text-idm-female'}`}>
                          {p.division === 'male' ? '🕺 Cowo' : '💃 Cewe'}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{p.city || '-'}</span>
                        {p.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{p.phone}</span>}
                        {p.joki && <span className="flex items-center gap-1">🎮 Joki: {p.joki}</span>}
                        <span>Nickname: <span className="font-medium text-foreground">{p.gamertag}</span></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Select onValueChange={(tier) => setConfirmDialog({
                        open: true,
                        title: 'Setujui Pendaftaran?',
                        description: `Setujui "${p.name}" sebagai tier ${tier} di division ${p.division}.`,
                        onConfirm: () => approveRegistration.mutate({ playerId: p.id, tier })
                      })}>
                        <SelectTrigger className="w-20 h-7 text-[10px]"><SelectValue placeholder="Setujui" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="S">Sebagai S</SelectItem>
                          <SelectItem value="A">Sebagai A</SelectItem>
                          <SelectItem value="B">Sebagai B</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 touch-icon text-red-500 hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => setConfirmDialog({
                          open: true,
                          title: 'Tolak Pendaftaran?',
                          description: `Tolak pendaftaran "${p.name}". Player akan ditandai sebagai rejected.`,
                          onConfirm: () => rejectRegistration.mutate(p.id)
                        })}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Player Management Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari pemain..."
            value={searchPlayer}
            onChange={(e) => setSearchPlayer(e.target.value)}
            className="pl-9 bg-muted/30 border-border/50 focus:border-idm-gold-warm/30 focus:bg-muted/50 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground shrink-0">{filteredPlayers.length}/{totalPlayers}</span>
          <Button onClick={openNewPlayerForm} size="sm" className="shrink-0 text-[11px] h-8 sm:h-9">
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" /> <span className="hidden xs:inline">Tambah </span>Player
          </Button>
        </div>
      </div>

      {/* Player list */}
      <div className="space-y-1 sm:space-y-1.5 max-h-[560px] overflow-y-auto custom-scrollbar">
        {filteredPlayers.map((p: {
          id: string;
          gamertag: string;
          name: string;
          avatar?: string | null;
          tier: string;
          division: string;
          points: number;
          totalWins: number;
          streak: number;
          totalMvp: number;
          matches: number;
          isActive: boolean;
          city: string;
          phone: string | null;
          joki: string | null;
          clubMembers?: Array<{ profile: { id: string; name: string; logo?: string | null } }>;
        }, index) => {
          const avatarSrc = getAvatarUrl(p.gamertag, p.division as 'male' | 'female', p.avatar);
          return (
          <div key={p.id} className={`flex items-center justify-between p-3 sm:p-4 rounded-2xl bg-card border border-border/50 ${dt.casinoGlow} transition-colors hover:border-border/80`}
          >
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <div className="relative group shrink-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden">
                  <AvatarMedia src={avatarSrc} alt={p.gamertag} width={40} height={40} className="w-full h-full" />
                </div>
                <button
                  className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => openAvatarPicker(p.id)}
                  title="Ganti avatar"
                >
                  <Camera className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                  <p className="text-xs sm:text-sm font-medium truncate">{p.gamertag}</p>
                  <Badge className={`text-[8px] sm:text-[9px] border-0 ${p.division === 'male' ? 'bg-idm-male/10 text-idm-male' : 'bg-idm-female/10 text-idm-female'}`}>
                    {p.division === 'male' ? '🕺' : '💃'}
                  </Badge>
                  <TierBadge tier={p.tier} />
                </div>
                <div className="flex flex-wrap items-center gap-x-1 sm:gap-x-2 gap-y-0.5 text-[9px] sm:text-[10px] text-muted-foreground">
                  <span className="font-medium text-foreground truncate max-w-[80px] sm:max-w-none">{p.name}</span>
                  {p.city && <><span className="hidden sm:inline">•</span><span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{p.city}</span></>}
                  <span className="hidden sm:inline">•</span>
                  <span>{p.points}pts</span>
                  <span>•</span>
                  <span>{p.totalWins}W</span>
                  <span className="hidden sm:inline">•</span>
                  <span className="hidden sm:inline">{p.totalMvp} MVP</span>
                  {p.streak > 1 && <span className="text-orange-400 flex items-center gap-0.5"><Flame className="w-2.5 h-2.5 sm:w-3 sm:h-3" />{p.streak}</span>}
                  {p.clubMembers?.[0]?.profile && (
                    <Badge className="text-[8px] sm:text-[9px] border-0 bg-muted text-muted-foreground truncate max-w-[60px] sm:max-w-none">{p.clubMembers[0].profile.name}</Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <Select value={p.tier} onValueChange={(tier) => updateTier.mutate({ playerId: p.id, tier })}>
                <SelectTrigger className="w-12 sm:w-14 h-7 text-[10px] sm:text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="S">S</SelectItem>
                  <SelectItem value="A">A</SelectItem>
                  <SelectItem value="B">B</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 touch-icon text-blue-500 hover:text-blue-400 hover:bg-blue-500/10"
                onClick={() => openEditPlayerForm(p)}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 touch-icon text-red-500 hover:text-red-400 hover:bg-red-500/10"
                onClick={() => setConfirmDialog({
                  open: true,
                  title: 'Hapus Player?',
                  description: `Hapus "${p.name}" (@${p.gamertag}). Player akan dinonaktifkan, tapi bisa mendaftar kembali.`,
                  onConfirm: () => deletePlayer.mutate(p.id)
                })}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          );
        })}
      </div>

      {/* Load More Button */}
      {hasMorePlayers && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5"
            onClick={onLoadMorePlayers}
            disabled={isLoadingMorePlayers}
          >
            {isLoadingMorePlayers ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
            {isLoadingMorePlayers ? 'Memuat...' : `Load More (${totalPlayers - filteredPlayers.length} tersisa)`}
          </Button>
        </div>
      )}
    </div>
  );
}
