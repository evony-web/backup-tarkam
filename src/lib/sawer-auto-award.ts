import { db } from '@/lib/db';
import { getSawerTier } from './skin-utils';

/**
 * Auto-award or upgrade sawer skin when a donation is approved.
 * Calculates total weekly sawer for the donor and awards the appropriate tier.
 * Also updates sawerBadgeTier on Account if the new tier is higher.
 */
export async function autoAwardSawerSkin(donorName: string): Promise<void> {
  // 1. Find the player account by gamertag matching donorName
  const player = await db.player.findFirst({
    where: { gamertag: { equals: donorName, mode: 'insensitive' } as any },
    include: { account: true },
  }) as any;

  if (!player?.account) return; // No account linked, skip auto-award

  const accountId = player.account.id;

  // 2. Calculate total approved weekly sawer this week for this donor
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
  startOfWeek.setHours(0, 0, 0, 0);

  const weeklyDonations = await db.donation.findMany({
    where: {
      donorName: { equals: donorName, mode: 'insensitive' } as any,
      type: 'weekly',
      status: 'approved',
      createdAt: { gte: startOfWeek },
    },
  });

  const totalWeeklySawer = weeklyDonations.reduce((sum, d) => sum + d.amount, 0);

  // 3. Determine tier
  const tierType = getSawerTier(totalWeeklySawer);
  if (!tierType) return; // Below 10K threshold, no skin

  // 4. Find the skin
  const skin = await db.skin.findUnique({ where: { type: tierType } });
  if (!skin) return;

  // 5. Remove any existing lower-tier sawer skins for this account this week
  const sawerTypes = ['sawer_bronze', 'sawer_silver', 'sawer_gold', 'sawer_diamond'];
  const existingSawerSkins = await db.playerSkin.findMany({
    where: {
      accountId,
      skin: { type: { in: sawerTypes } },
    },
  });

  for (const existing of existingSawerSkins) {
    // If same tier already active, just extend expiry
    if (existing.skinId === skin.id) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      await db.playerSkin.update({
        where: { id: existing.id },
        data: { expiresAt, reason: `Sawer ${totalWeeklySawer >= 1000 ? `${totalWeeklySawer / 1000}K` : totalWeeklySawer} — auto-upgrade` },
      });
      // Update sawerBadgeTier
      await updateSawerBadgeTier(accountId, tierType);
      return;
    }
    // Remove lower tier
    await db.playerSkin.delete({ where: { id: existing.id } });
  }

  // 6. Award the new tier skin
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await db.playerSkin.create({
    data: {
      accountId,
      skinId: skin.id,
      reason: `Sawer ${totalWeeklySawer >= 1000 ? `${totalWeeklySawer / 1000}K` : totalWeeklySawer} — auto-award`,
      expiresAt,
    },
  });

  // 7. Update sawerBadgeTier
  await updateSawerBadgeTier(accountId, tierType);
}

async function updateSawerBadgeTier(accountId: string, tierType: string): Promise<void> {
  const tierRank: Record<string, number> = {
    none: 0,
    sawer_bronze: 1,
    bronze: 1,
    sawer_silver: 2,
    silver: 2,
    sawer_gold: 3,
    gold: 3,
    sawer_diamond: 4,
    diamond: 4,
  };

  const account = await db.account.findUnique({ where: { id: accountId } });
  if (!account) return;

  const currentRank = tierRank[(account as any).sawerBadgeTier] ?? 0;
  const newRank = tierRank[tierType] ?? 0;

  if (newRank > currentRank) {
    // Map back to simple tier name
    const simpleTier = tierType.replace('sawer_', '');
    await db.account.update({
      where: { id: accountId },
      data: { sawerBadgeTier: simpleTier },
    });
  }
}
