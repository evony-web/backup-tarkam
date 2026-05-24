import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { DEFAULT_SKIN_COLORS } from '@/lib/skin-utils';

// Default skin definitions — colorClass uses CSS color strings (not Tailwind classes)
// because the renderer uses inline styles. See skin-utils.ts for the color format spec.
const DEFAULT_SKINS = [
  // ═══ CHAMPION — Royal Gold (ONLY Juara 1) ═══
  {
    type: 'season_champion',
    displayName: 'Diamond Crown',
    description: 'Skin juara season — Diamond Blue permanen, badge tertinggi!',
    icon: '💎',
    colorClass: JSON.stringify(DEFAULT_SKIN_COLORS.season_champion),
    priority: 10,
    duration: 'permanent',
    isActive: true,
  },
  {
    type: 'champion',
    displayName: 'Gold Crown',
    description: 'Skin juara tournament mingguan — berlaku selama 1 minggu setelah menang',
    icon: '🥇',
    colorClass: JSON.stringify(DEFAULT_SKIN_COLORS.champion),
    priority: 4,
    duration: 'weekly',
    isActive: true,
  },
  {
    type: 'champion_1',
    displayName: 'Royal Gold Crown',
    description: 'Skin Juara 1 tournament mingguan — HANYA untuk pemenang Juara 1! Royal Gold eksklusif.',
    icon: '👑',
    colorClass: JSON.stringify(DEFAULT_SKIN_COLORS.champion_1),
    priority: 5,
    duration: 'weekly',
    isActive: true,
  },
  {
    type: 'champion_2',
    displayName: 'Royal Gold Crown (Inactive)',
    description: 'TIDAK AKTIF — Skin Juara 2 tidak lagi diberikan. Hanya Juara 1 mendapat skin.',
    icon: '👑',
    colorClass: JSON.stringify(DEFAULT_SKIN_COLORS.champion_2),
    priority: 4,
    duration: 'weekly',
    isActive: false,
  },
  {
    type: 'champion_3',
    displayName: 'Royal Gold Crown (Inactive)',
    description: 'TIDAK AKTIF — Skin Juara 3 tidak lagi diberikan. Hanya Juara 1 mendapat skin.',
    icon: '👑',
    colorClass: JSON.stringify(DEFAULT_SKIN_COLORS.champion_3),
    priority: 3,
    duration: 'weekly',
    isActive: false,
  },
  // ═══ SEASON CHAMPION — Diamond Blue (paling langka, 1 tim per season) ═══
  {
    type: 'season_champion',
    displayName: 'Season Champion',
    description: 'Skin juara season — Diamond Blue, hanya 1 tim per season. Paling langka!',
    icon: '💎',
    colorClass: JSON.stringify(DEFAULT_SKIN_COLORS.season_champion),
    priority: 7,
    duration: 'season',
    isActive: true,
  },
  // ═══ MVP — Platinum ═══
  {
    type: 'mvp',
    displayName: 'Platinum Star',
    description: 'Skin MVP tournament mingguan — berlaku selama 1 minggu setelah mendapat MVP',
    icon: '⭐',
    colorClass: JSON.stringify(DEFAULT_SKIN_COLORS.mvp),
    priority: 3,
    duration: 'weekly',
    isActive: true,
  },
  // ═══ SAWER — Emerald Green ═══
  {
    type: 'sawer_bronze',
    displayName: 'Emerald Sawer',
    description: 'Skin penyawer Bronze — Sawer ≥ 10K dalam seminggu. Kontributor prize pool!',
    icon: '💵',
    colorClass: JSON.stringify(DEFAULT_SKIN_COLORS.sawer_bronze),
    priority: 2,
    duration: 'weekly',
    isActive: true,
  },
  {
    type: 'sawer_silver',
    displayName: 'Emerald Sawer+',
    description: 'Skin penyawer Silver — Sawer ≥ 50K dalam seminggu. Kontributor prize pool!',
    icon: '💵',
    colorClass: JSON.stringify(DEFAULT_SKIN_COLORS.sawer_silver),
    priority: 3,
    duration: 'weekly',
    isActive: true,
  },
  {
    type: 'sawer_gold',
    displayName: 'Emerald Sawer++',
    description: 'Skin penyawer Gold — Sawer ≥ 100K dalam seminggu. Kontributor prize pool!',
    icon: '💵',
    colorClass: JSON.stringify(DEFAULT_SKIN_COLORS.sawer_gold),
    priority: 4,
    duration: 'weekly',
    isActive: true,
  },
  {
    type: 'sawer_diamond',
    displayName: 'Emerald Sawer Elite',
    description: 'Skin penyawer Diamond — Sawer ≥ 200K dalam seminggu, tier tertinggi! Kontributor prize pool!',
    icon: '💵',
    colorClass: JSON.stringify(DEFAULT_SKIN_COLORS.sawer_diamond),
    priority: 5,
    duration: 'weekly',
    isActive: true,
  },
  // ═══ DONOR — Maroon Heart (Sultan of the Week skin) ═══
  {
    type: 'donor',
    displayName: 'Maroon Heart',
    description: 'Skin Sultan of the Week — Maroon Heart ❤️, top penyawer per turnamen! Badge hati ❤️ tetap permanen setelah expire',
    icon: '❤️',
    colorClass: JSON.stringify(DEFAULT_SKIN_COLORS.donor),
    priority: 6,
    duration: 'weekly',
    isActive: true,
  },
  // ═══ SULTAN — Emerald Royal (top penyawer per season) ═══
  {
    type: 'sultan',
    displayName: 'Sultan of Season',
    description: 'Skin top penyawer season — Emerald Royal, hanya 1 pemain per season! Kontributor terbesar prize pool!',
    icon: '👑',
    colorClass: JSON.stringify(DEFAULT_SKIN_COLORS.sultan),
    priority: 8,
    duration: 'season',
    isActive: true,
  },
];

/**
 * POST /api/skins/seed
 * Seed the 4 default skins (admin auth required)
 * Uses upsert to avoid duplicates
 */
export async function POST(request: Request) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const results: Awaited<ReturnType<typeof db.skin.upsert>>[] = [];

    for (const skinData of DEFAULT_SKINS) {
      const skin = await db.skin.upsert({
        where: { type: skinData.type },
        update: {
          displayName: skinData.displayName,
          description: skinData.description,
          icon: skinData.icon,
          colorClass: skinData.colorClass,
          priority: skinData.priority,
          duration: skinData.duration,
          isActive: skinData.isActive,
        },
        create: skinData,
      });
      results.push(skin);
    }

    return NextResponse.json({
      success: true,
      message: `Seeded ${results.length} skins`,
      skins: results.map(s => ({
        id: s.id,
        type: s.type,
        displayName: s.displayName,
        icon: s.icon,
        priority: s.priority,
        duration: s.duration,
      })),
    });
  } catch (error) {
    console.error('Skin seed error:', error);
    return NextResponse.json(
      { error: 'Failed to seed skins' },
      { status: 500 }
    );
  }
}
