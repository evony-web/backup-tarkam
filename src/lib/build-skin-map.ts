// ═══════════════════════════════════════════════════════════
// BUILD SKIN MAP — Shared utility for skinMap construction
// ═══════════════════════════════════════════════════════════
// Used by both the SSR landing data fetcher and the /api/stats
// route to build the skinMap consistently, eliminating skin
// flash on page refresh when SSR provides pre-populated skinMap.

import { db } from '@/lib/db';
import { DEFAULT_SKIN_COLORS } from '@/lib/skin-utils';
import type { PlayerSkinInfo } from '@/types/stats';

interface BuildSkinMapParams {
  playerIds: string[];
  allSeasons: Array<{ id: string; status: string; championPlayerId: string | null; sultanPlayerId?: string | null; name: string; number?: number }>;
  completedTournaments: Array<{
    teams: Array<{
      teamPlayers: Array<{ player: { id: string } }>;
    }>;
    participations: Array<{
      isMvp: boolean;
      player: { id: string };
    }>;
    name: string;
  }>;
}

export async function buildSkinMap(params: BuildSkinMapParams): Promise<Record<string, PlayerSkinInfo[]>> {
  const { playerIds, allSeasons, completedTournaments } = params;

  if (playerIds.length === 0) return {};

  // 1. Fetch explicit PlayerSkin records (awarded skins) + donor badge counts — parallel
  const [activePlayerSkins, donorBadgeAccounts] = await Promise.all([
    db.playerSkin.findMany({
      where: {
        account: { player: { id: { in: playerIds } } },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        skin: { select: { type: true, displayName: true, icon: true, colorClass: true, priority: true, duration: true } },
        account: { select: { player: { select: { id: true } }, donorBadgeCount: true } },
      },
    }),
    db.account.findMany({
      where: { player: { id: { in: playerIds } }, donorBadgeCount: { gt: 0 } },
      select: { player: { select: { id: true } }, donorBadgeCount: true },
    }),
  ]);

  // Build donorBadgeMap
  const donorBadgeMap: Record<string, number> = {};
  for (const acc of donorBadgeAccounts) {
    donorBadgeMap[acc.player.id] = acc.donorBadgeCount;
  }

  // Build skinMap
  const skinMap: Record<string, PlayerSkinInfo[]> = {};

  // Helper: add a derived skin (skip if type already present)
  function addDerivedSkin(
    pid: string,
    type: string,
    icon: string,
    displayName: string,
    colorClass: string,
    priority: number,
    duration: string,
    reason: string
  ) {
    if (!skinMap[pid]) skinMap[pid] = [];
    if (skinMap[pid].some(s => s.type === type)) return;
    skinMap[pid].push({ type, icon, displayName, colorClass, priority, duration, reason, expiresAt: null });
  }

  // Stage 1: Add explicit PlayerSkin records
  for (const ps of activePlayerSkins) {
    const pid = ps.account.player.id;
    if (!skinMap[pid]) skinMap[pid] = [];
    skinMap[pid].push({
      type: ps.skin.type,
      icon: ps.skin.icon,
      displayName: ps.skin.displayName,
      colorClass: ps.skin.colorClass,
      priority: ps.skin.priority,
      duration: ps.skin.duration,
      reason: ps.reason,
      expiresAt: ps.expiresAt ? ps.expiresAt.toISOString() : null,
      donorBadgeCount: ps.account.donorBadgeCount,
    });
  }

  // Stage 2: Donor badge virtual entries
  for (const [pid, count] of Object.entries(donorBadgeMap)) {
    if (!skinMap[pid]) skinMap[pid] = [];
    const hasActiveDonorSkin = skinMap[pid].some(s => s.type === 'donor');
    if (!hasActiveDonorSkin) {
      skinMap[pid].push({
        type: 'donor_badge',
        icon: '❤️',
        displayName: count >= 5 ? 'Heart Badge ★' : 'Heart Badge',
        colorClass: '{"frame":"#fb7185","name":"#fb7185|#ef4444|#f472b6","badge":"rgba(244,63,94,0.2)|#fda4af","border":"#f43f5e|#ef4444|#f472b6","glow":"rgba(244,63,94,0.35)"}',
        priority: 0,
        duration: 'permanent',
        reason: `${count}x donasi`,
        expiresAt: null,
        donorBadgeCount: count,
      });
    } else {
      const donorSkin = skinMap[pid].find(s => s.type === 'donor');
      if (donorSkin) donorSkin.donorBadgeCount = count;
    }
  }

  // Stage 3: Season champion virtual entries
  const SEASON_CHAMPION_COLORS = JSON.stringify(DEFAULT_SKIN_COLORS.season_champion);
  for (const s of allSeasons) {
    if (s.status === 'completed' && s.championPlayerId) {
      addDerivedSkin(s.championPlayerId, 'season_champion', '💎', 'Season Champion', SEASON_CHAMPION_COLORS, 7, 'season', `Season Champion ${s.name}`);
    }
  }

  // Stage 4: Weekly champion virtual entries
  // Skip if player already has a rank-specific champion skin (champion_1/2/3) from DB
  const CHAMPION_COLORS = JSON.stringify(DEFAULT_SKIN_COLORS.champion);
  const CHAMPION_VARIANTS = ['champion', 'champion_1', 'champion_2', 'champion_3'];
  for (const t of completedTournaments) {
    for (const winnerTeam of t.teams) {
      for (const tp of winnerTeam.teamPlayers) {
        // Check if player already has any champion variant — avoid duplicate badges
        const hasChampionSkin = skinMap[tp.player.id]?.some(s => CHAMPION_VARIANTS.includes(s.type));
        if (!hasChampionSkin) {
          addDerivedSkin(tp.player.id, 'champion', '🥇', 'Gold Crown', CHAMPION_COLORS, 4, 'weekly', `Juara ${t.name}`);
        }
      }
    }
  }

  // Stage 5: MVP virtual entries
  const MVP_COLORS = JSON.stringify(DEFAULT_SKIN_COLORS.mvp);
  for (const t of completedTournaments) {
    for (const p of t.participations) {
      if (p.isMvp) {
        addDerivedSkin(p.player.id, 'mvp', '⭐', 'Platinum Star', MVP_COLORS, 3, 'weekly', `MVP ${t.name}`);
      }
    }
  }

  // Stage 6: Sultan of Season virtual entries — top penyawer per completed season
  const SULTAN_COLORS = JSON.stringify(DEFAULT_SKIN_COLORS.sultan);
  for (const s of allSeasons) {
    if (s.status === 'completed' && s.sultanPlayerId) {
      const seasonLabel = s.number ? `Season ${s.number}` : s.name;
      addDerivedSkin(s.sultanPlayerId, 'sultan', '👑', 'Sultan of Season', SULTAN_COLORS, 8, 'season', `Sultan of ${seasonLabel}`);
    }
  }

  return skinMap;
}
