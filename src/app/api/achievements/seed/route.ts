import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { NextResponse } from 'next/server';

// Achievement definitions - dynamic, configurable
const ACHIEVEMENTS = [
  // === TOURNAMENT PERFORMANCE ===
  {
    name: 'weekly_champion',
    displayName: 'Weekly Champion',
    description: 'Menang tournament mingguan',
    category: 'tournament',
    icon: '🏆',
    tier: 'gold',
    criteria: JSON.stringify({ type: 'wins', count: 1, consecutive: false }),
    rewardPoints: 0,
  },
  {
    name: 'back_to_back',
    displayName: 'Back-to-Back Winner',
    description: 'Menang 2 tournament berturut-turut',
    category: 'tournament',
    icon: '🔥',
    tier: 'gold',
    criteria: JSON.stringify({ type: 'wins', count: 2, consecutive: true }),
    rewardPoints: 50,
  },
  {
    name: 'hat_trick_hero',
    displayName: 'Hat-trick Hero',
    description: 'Menang 3 tournament berturut-turut',
    category: 'tournament',
    icon: '👑',
    tier: 'platinum',
    criteria: JSON.stringify({ type: 'wins', count: 3, consecutive: true }),
    rewardPoints: 100,
  },
  {
    name: 'unstoppable',
    displayName: 'Unstoppable',
    description: 'Menang 5 tournament berturut-turut',
    category: 'tournament',
    icon: '⚡',
    tier: 'diamond',
    criteria: JSON.stringify({ type: 'wins', count: 5, consecutive: true }),
    rewardPoints: 200,
  },
  {
    name: 'podium_regular',
    displayName: 'Podium Regular',
    description: 'Menang Juara 1 sebanyak 5 kali',
    category: 'tournament',
    icon: '🥉',
    tier: 'silver',
    criteria: JSON.stringify({ type: 'top3_count', count: 5 }),
    rewardPoints: 50,
  },
  {
    name: 'tournament_veteran',
    displayName: 'Tournament Veteran',
    description: 'Berpartisipasi dalam 10 tournament',
    category: 'tournament',
    icon: '🎖️',
    tier: 'bronze',
    criteria: JSON.stringify({ type: 'participations', count: 10 }),
    rewardPoints: 25,
  },

  // === MVP ACHIEVEMENTS ===
  {
    name: 'rising_star',
    displayName: 'Rising Star',
    description: 'Mendapatkan MVP 1 kali',
    category: 'mvp',
    icon: '⭐',
    tier: 'bronze',
    criteria: JSON.stringify({ type: 'mvp_count', count: 1 }),
    rewardPoints: 0,
  },
  {
    name: 'mvp_triple',
    displayName: 'MVP Triple',
    description: 'Mendapatkan MVP 3 kali',
    category: 'mvp',
    icon: '🌟',
    tier: 'silver',
    criteria: JSON.stringify({ type: 'mvp_count', count: 3 }),
    rewardPoints: 75,
  },
  {
    name: 'mvp_streak',
    displayName: 'MVP Streak',
    description: 'Mendapatkan MVP 2 minggu berturut-turut',
    category: 'mvp',
    icon: '💫',
    tier: 'gold',
    criteria: JSON.stringify({ type: 'mvp_streak', count: 2 }),
    rewardPoints: 100,
  },
  {
    name: 'mvp_master',
    displayName: 'MVP Master',
    description: 'Mendapatkan MVP 5 kali',
    category: 'mvp',
    icon: '✨',
    tier: 'platinum',
    criteria: JSON.stringify({ type: 'mvp_count', count: 5 }),
    rewardPoints: 150,
  },

  // === POINTS MILESTONES ===
  {
    name: 'points_100',
    displayName: 'First Steps',
    description: 'Mengumpulkan 100 points',
    category: 'points',
    icon: '💯',
    tier: 'bronze',
    criteria: JSON.stringify({ type: 'points', threshold: 100 }),
    rewardPoints: 0,
  },
  {
    name: 'points_500',
    displayName: 'Point Collector',
    description: 'Mengumpulkan 500 points',
    category: 'points',
    icon: '💎',
    tier: 'silver',
    criteria: JSON.stringify({ type: 'points', threshold: 500 }),
    rewardPoints: 25,
  },
  {
    name: 'points_1000',
    displayName: 'Point Master',
    description: 'Mengumpulkan 1000 points',
    category: 'points',
    icon: '🎯',
    tier: 'gold',
    criteria: JSON.stringify({ type: 'points', threshold: 1000 }),
    rewardPoints: 50,
  },
  {
    name: 'points_5000',
    displayName: 'Point Legend',
    description: 'Mengumpulkan 5000 points',
    category: 'points',
    icon: '👑',
    tier: 'platinum',
    criteria: JSON.stringify({ type: 'points', threshold: 5000 }),
    rewardPoints: 100,
  },

  // === CLUB ACHIEVEMENTS ===
  {
    name: 'club_champion',
    displayName: 'Club Champion',
    description: 'Menang tournament bersama club',
    category: 'club',
    icon: '🎭',
    tier: 'gold',
    criteria: JSON.stringify({ type: 'club_win', count: 1 }),
    rewardPoints: 25,
  },
  {
    name: 'perfect_trio',
    displayName: 'Perfect Trio',
    description: '3 member club yang sama menang di minggu yang sama',
    category: 'club',
    icon: '🤝',
    tier: 'platinum',
    criteria: JSON.stringify({ type: 'club_dominance', count: 3 }),
    rewardPoints: 150,
  },
];

export async function POST(request: Request) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    // Check if achievements already exist
    const existingCount = await db.achievement.count();

    if (existingCount > 0) {
      return NextResponse.json({
        success: true,
        message: `Achievements already seeded (${existingCount} achievements exist)`,
        skipped: true
      });
    }

    // Seed achievements
    let created = 0;
    for (const achievement of ACHIEVEMENTS) {
      await db.achievement.create({ data: achievement });
      created++;
    }

    return NextResponse.json({
      success: true,
      message: `Seeded ${created} achievements`,
      achievements: ACHIEVEMENTS.map(a => ({ name: a.name, displayName: a.displayName, category: a.category })),
    });
  } catch (e: unknown) {
    const error = e as Error;
    console.error('Achievement seed error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  try {
    const achievements = await db.achievement.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { tier: 'asc' }],
    });

    return NextResponse.json({
      count: achievements.length,
      achievements: achievements.map(a => ({
        id: a.id,
        name: a.name,
        displayName: a.displayName,
        description: a.description,
        category: a.category,
        icon: a.icon,
        tier: a.tier,
        criteria: JSON.parse(a.criteria),
        rewardPoints: a.rewardPoints,
      })),
    }, { headers });
  } catch (e: unknown) {
    const error = e as Error;
    return NextResponse.json({ error: error.message }, { headers,  status: 500 });
  }
}
