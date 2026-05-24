import { db, neonDeleteMany, isPostgreSQL } from '@/lib/db';
import { requireSuperAdmin, verifyAdmin } from '@/lib/api-auth';
import { getSafeErrorMessage } from '@/lib/api-error';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get('force') === 'true';

  // Allow unauthenticated seeding only when database is empty AND no admin exists
  // If force=true OR database has data AND admin exists, require super admin auth
  const seasonCount = await db.season.count();
  const adminCount = await db.admin.count();
  const dbIsEmpty = seasonCount === 0;
  const noAdmin = adminCount === 0;

  if (!dbIsEmpty || (force && !noAdmin)) {
    // Database has data or force mode with existing admin — require super admin auth
    const authResult = await requireSuperAdmin(request);
    if (authResult instanceof NextResponse) return authResult;
  }

  if (!force && !dbIsEmpty) {
    return NextResponse.json({ success: true, message: 'Database already has seasons — seeding skipped' });
  }

  try {
    // Clear existing data (respect foreign key order)
    // Neon workaround: deleteMany() may not work with PrismaNeonHttp
    if (isPostgreSQL) {
      await neonDeleteMany('MarketplaceItem', []);
      await neonDeleteMany('PlayerAchievement', []);
      await neonDeleteMany('PlayerPoint', []);
      await neonDeleteMany('TeamPlayer', []);
      await neonDeleteMany('Match', []);
      await neonDeleteMany('Team', []);
      await neonDeleteMany('Participation', []);
      await neonDeleteMany('TournamentPrize', []);
      await neonDeleteMany('Donation', []);
      await neonDeleteMany('ClubMember', []);
      await neonDeleteMany('Club', []);
      await neonDeleteMany('ClubProfile', []);
      await neonDeleteMany('Tournament', []);
      await neonDeleteMany('Player', []);
      await neonDeleteMany('Season', []);
    } else {
      await db.marketplaceItem.deleteMany();
      await db.playerAchievement.deleteMany();
      await db.playerPoint.deleteMany();
      await db.teamPlayer.deleteMany();
      await db.match.deleteMany();
      await db.team.deleteMany();
      await db.participation.deleteMany();
      await db.tournamentPrize.deleteMany();
      await db.donation.deleteMany();
      await db.clubMember.deleteMany();
      await db.club.deleteMany();
      await db.clubProfile.deleteMany();
      await db.tournament.deleteMany();
      await db.player.deleteMany();
      await db.season.deleteMany();
    }

    // ======== SEASONS ========
    const maleSeason = await db.season.create({
      data: {
        name: 'IDM League Season 1 - Cowo',
        number: 1,
        division: 'male',
        status: 'active',
        startDate: new Date('2025-01-06'),
      },
    });

    const femaleSeason = await db.season.create({
      data: {
        name: 'IDM League Season 1 - Cewe',
        number: 1,
        division: 'female',
        status: 'completed',
        startDate: new Date('2025-01-06'),
      },
    });

    const s2Female = await db.season.create({
      data: {
        name: 'Season 2 - Cewe',
        number: 2,
        division: 'female',
        status: 'active',
        startDate: new Date('2025-04-01'),
      },
    });

    // ======== MALE PLAYERS (with accumulated points from tarkam) ========
    const maleData = [
      { gamertag: 'AbdnZ', club: 'MAXIMOUS', points: 0, totalWins: 0, totalMvp: 0, streak: 0, maxStreak: 0, matches: 0, tier: 'B' },
      { gamertag: 'afi', club: 'MAXIMOUS', points: 0, totalWins: 0, totalMvp: 0, streak: 0, maxStreak: 0, matches: 0, tier: 'B' },
      { gamertag: 'Afroki', club: 'SOUTHERN', points: 50, totalWins: 2, totalMvp: 0, streak: 0, maxStreak: 2, matches: 4, tier: 'B' },
      { gamertag: 'Airuen', club: 'AVENUE', points: 30, totalWins: 1, totalMvp: 0, streak: 0, maxStreak: 1, matches: 3, tier: 'B' },
      { gamertag: 'Armors', club: 'SOUTHERN', points: 50, totalWins: 2, totalMvp: 0, streak: 0, maxStreak: 2, matches: 4, tier: 'B' },
      { gamertag: 'astro', club: 'MAXIMOUS', points: 30, totalWins: 1, totalMvp: 0, streak: 0, maxStreak: 1, matches: 3, tier: 'B' },
      { gamertag: 'Bambang', club: 'MAXIMOUS', points: 50, totalWins: 2, totalMvp: 0, streak: 0, maxStreak: 2, matches: 4, tier: 'B' },
      { gamertag: 'Boby', club: 'MAXIMOUS', points: 50, totalWins: 2, totalMvp: 0, streak: 0, maxStreak: 2, matches: 4, tier: 'B' },
      { gamertag: 'CARAOSEL', club: 'ORPHIC', points: 5, totalWins: 0, totalMvp: 0, streak: 0, maxStreak: 0, matches: 1, tier: 'B' },
      { gamertag: 'cepz', club: 'SALVADOR', points: 5, totalWins: 0, totalMvp: 0, streak: 0, maxStreak: 0, matches: 1, tier: 'B' },
      { gamertag: 'chand', club: 'MAXIMOUS', points: 50, totalWins: 2, totalMvp: 0, streak: 0, maxStreak: 2, matches: 4, tier: 'B' },
      { gamertag: 'chikoo', club: 'SENSEI', points: 0, totalWins: 0, totalMvp: 0, streak: 0, maxStreak: 0, matches: 0, tier: 'B' },
      { gamertag: 'Chrollo', club: 'EUPHORIC', points: 0, totalWins: 0, totalMvp: 0, streak: 0, maxStreak: 0, matches: 0, tier: 'B' },
      { gamertag: 'DUUL', club: 'PARANOID', points: 70, totalWins: 3, totalMvp: 0, streak: 0, maxStreak: 3, matches: 5, tier: 'A' },
      { gamertag: 'Dylee', club: 'SENSEI', points: 0, totalWins: 0, totalMvp: 0, streak: 0, maxStreak: 0, matches: 0, tier: 'B' },
      { gamertag: 'Earth', club: 'MAXIMOUS', points: 50, totalWins: 2, totalMvp: 0, streak: 0, maxStreak: 2, matches: 4, tier: 'B' },
      { gamertag: 'fyy', club: 'GYMSHARK', points: 0, totalWins: 0, totalMvp: 0, streak: 0, maxStreak: 0, matches: 0, tier: 'B' },
      { gamertag: 'Georgie', club: 'ALQA', points: 0, totalWins: 0, totalMvp: 0, streak: 0, maxStreak: 0, matches: 0, tier: 'B' },
      { gamertag: 'ipinnn', club: 'GYMSHARK', points: 30, totalWins: 1, totalMvp: 0, streak: 0, maxStreak: 1, matches: 3, tier: 'B' },
      { gamertag: 'Jave', club: 'RESTART', points: 50, totalWins: 2, totalMvp: 0, streak: 0, maxStreak: 2, matches: 4, tier: 'B' },
      { gamertag: 'janskie', club: 'SOUTHERN', points: 50, totalWins: 2, totalMvp: 0, streak: 0, maxStreak: 2, matches: 4, tier: 'B' },
      { gamertag: 'jugger', club: 'GYMSHARK', points: 50, totalWins: 2, totalMvp: 1, streak: 0, maxStreak: 2, matches: 4, tier: 'B' },
      { gamertag: 'justice', club: 'EUPHORIC', points: 0, totalWins: 0, totalMvp: 0, streak: 0, maxStreak: 0, matches: 0, tier: 'B' },
      { gamertag: 'Kageno', club: 'AVENUE', points: 30, totalWins: 1, totalMvp: 0, streak: 0, maxStreak: 1, matches: 3, tier: 'B' },
      { gamertag: 'KIERAN', club: 'MAXIMOUS', points: 50, totalWins: 2, totalMvp: 0, streak: 0, maxStreak: 2, matches: 4, tier: 'B' },
      { gamertag: 'KIRA', club: 'SOUTHERN', points: 50, totalWins: 2, totalMvp: 0, streak: 0, maxStreak: 2, matches: 4, tier: 'B' },
      { gamertag: 'Life', club: 'SALVADOR', points: 15, totalWins: 0, totalMvp: 0, streak: 0, maxStreak: 0, matches: 2, tier: 'B' },
      { gamertag: 'marimo', club: 'SECRETS', points: 30, totalWins: 1, totalMvp: 0, streak: 0, maxStreak: 1, matches: 3, tier: 'B' },
      { gamertag: 'montiel', club: 'PARANOID', points: 70, totalWins: 3, totalMvp: 0, streak: 0, maxStreak: 3, matches: 5, tier: 'A' },
      { gamertag: 'Oura', club: 'SALVADOR', points: 15, totalWins: 0, totalMvp: 0, streak: 0, maxStreak: 0, matches: 2, tier: 'B' },
      { gamertag: 'Ren', club: 'MAXIMOUS', points: 50, totalWins: 2, totalMvp: 0, streak: 0, maxStreak: 2, matches: 4, tier: 'B' },
      { gamertag: 'RIVALDO', club: 'EUPHORIC', points: 10, totalWins: 0, totalMvp: 0, streak: 0, maxStreak: 0, matches: 1, tier: 'B' },
      { gamertag: 'RONALD', club: 'MAXIMOUS', points: 50, totalWins: 2, totalMvp: 0, streak: 0, maxStreak: 2, matches: 4, tier: 'B' },
      { gamertag: 'rusel', club: 'GYMSHARK', points: 55, totalWins: 2, totalMvp: 1, streak: 2, maxStreak: 2, matches: 4, tier: 'B' },
      { gamertag: 'sheraid', club: 'MAXIMOUS', points: 50, totalWins: 2, totalMvp: 0, streak: 0, maxStreak: 2, matches: 4, tier: 'B' },
      { gamertag: 'sting', club: 'MAXIMOUS', points: 50, totalWins: 2, totalMvp: 0, streak: 0, maxStreak: 2, matches: 4, tier: 'B' },
      { gamertag: 'tazos', club: 'GYMSHARK', points: 50, totalWins: 2, totalMvp: 0, streak: 0, maxStreak: 2, matches: 4, tier: 'B' },
      { gamertag: 'tonsky', club: 'MAXIMOUS', points: 50, totalWins: 2, totalMvp: 0, streak: 0, maxStreak: 2, matches: 4, tier: 'B' },
      { gamertag: 'Vankless', club: 'SOUTHERN', points: 45, totalWins: 1, totalMvp: 0, streak: 0, maxStreak: 1, matches: 3, tier: 'B' },
      { gamertag: 'VBBOY', club: 'AVENUE', points: 30, totalWins: 1, totalMvp: 0, streak: 0, maxStreak: 1, matches: 3, tier: 'B' },
      { gamertag: 'VICKY', club: 'MAXIMOUS', points: 50, totalWins: 2, totalMvp: 0, streak: 0, maxStreak: 2, matches: 4, tier: 'B' },
      { gamertag: 'Vriskey_', club: 'EUPHORIC', points: 0, totalWins: 0, totalMvp: 0, streak: 0, maxStreak: 0, matches: 0, tier: 'B' },
      { gamertag: 'WHYSON', club: 'RESTART', points: 50, totalWins: 2, totalMvp: 0, streak: 0, maxStreak: 2, matches: 4, tier: 'B' },
      { gamertag: 'XIAOPEI', club: 'CROWN', points: 5, totalWins: 0, totalMvp: 0, streak: 0, maxStreak: 0, matches: 1, tier: 'B' },
      { gamertag: 'yay', club: 'MAXIMOUS', points: 50, totalWins: 2, totalMvp: 0, streak: 0, maxStreak: 2, matches: 4, tier: 'B' },
      { gamertag: 'ziafu', club: 'MYSTERY', points: 5, totalWins: 0, totalMvp: 0, streak: 0, maxStreak: 0, matches: 1, tier: 'B' },
      { gamertag: 'ZABYER', club: 'JASMINE', points: 20, totalWins: 0, totalMvp: 0, streak: 0, maxStreak: 0, matches: 2, tier: 'B' },
      { gamertag: 'zmz', club: 'ALQA', points: 0, totalWins: 0, totalMvp: 0, streak: 0, maxStreak: 0, matches: 0, tier: 'B' },
      { gamertag: 'ZORO', club: 'PARANOID', points: 75, totalWins: 3, totalMvp: 1, streak: 3, maxStreak: 3, matches: 5, tier: 'A' },
      { gamertag: 'zico', club: 'EUPHORIC', points: 0, totalWins: 0, totalMvp: 0, streak: 0, maxStreak: 0, matches: 0, tier: 'B' },
    ];

    // ======== FEMALE PLAYERS (with accumulated points from tarkam) ========
    const femaleData = [
      { gamertag: 'Afrona', club: 'SOUTHERN', points: 50, totalWins: 2, totalMvp: 0, streak: 0, maxStreak: 2, matches: 4, tier: 'B' },
      { gamertag: 'AiTan', club: 'PARANOID', points: 70, totalWins: 3, totalMvp: 0, streak: 0, maxStreak: 3, matches: 5, tier: 'A' },
      { gamertag: 'arcalya', club: 'SOUTHERN', points: 50, totalWins: 2, totalMvp: 0, streak: 0, maxStreak: 2, matches: 4, tier: 'B' },
      { gamertag: 'cami', club: 'MAXIMOUS', points: 135, totalWins: 5, totalMvp: 2, streak: 5, maxStreak: 5, matches: 7, tier: 'S' },
      { gamertag: 'cheeyaqq', club: 'SECRETS', points: 30, totalWins: 1, totalMvp: 0, streak: 0, maxStreak: 1, matches: 3, tier: 'B' },
      { gamertag: 'ciki_w', club: 'TOGETHER', points: 30, totalWins: 1, totalMvp: 0, streak: 0, maxStreak: 1, matches: 3, tier: 'B' },
      { gamertag: 'damncil', club: 'EUPHORIC', points: 70, totalWins: 3, totalMvp: 0, streak: 0, maxStreak: 3, matches: 5, tier: 'A' },
      { gamertag: 'dysa', club: 'RESTART', points: 50, totalWins: 2, totalMvp: 0, streak: 0, maxStreak: 2, matches: 4, tier: 'B' },
      { gamertag: 'Elvareca', club: 'EUPHORIC', points: 85, totalWins: 3, totalMvp: 1, streak: 3, maxStreak: 3, matches: 5, tier: 'A' },
      { gamertag: 'evony', club: 'GYMSHARK', points: 95, totalWins: 4, totalMvp: 1, streak: 4, maxStreak: 4, matches: 6, tier: 'S' },
      { gamertag: 'Eive', club: 'PSALM', points: 35, totalWins: 1, totalMvp: 0, streak: 0, maxStreak: 1, matches: 3, tier: 'B' },
      { gamertag: 'Indy', club: 'MAXIMOUS', points: 95, totalWins: 4, totalMvp: 1, streak: 4, maxStreak: 4, matches: 6, tier: 'S' },
      { gamertag: 'irazz', club: 'PARANOID', points: 70, totalWins: 3, totalMvp: 0, streak: 0, maxStreak: 3, matches: 5, tier: 'A' },
      { gamertag: 'kacee', club: 'MAXIMOUS', points: 135, totalWins: 5, totalMvp: 2, streak: 5, maxStreak: 5, matches: 7, tier: 'S' },
      { gamertag: 'Liz', club: 'SOUTHERN', points: 50, totalWins: 2, totalMvp: 0, streak: 0, maxStreak: 2, matches: 4, tier: 'B' },
      { gamertag: 'meatry', club: 'YAKUZA', points: 30, totalWins: 1, totalMvp: 0, streak: 0, maxStreak: 1, matches: 3, tier: 'B' },
      { gamertag: 'mishelle', club: 'PARANOID', points: 70, totalWins: 3, totalMvp: 0, streak: 0, maxStreak: 3, matches: 5, tier: 'A' },
      { gamertag: 'moy', club: 'YAKUZA', points: 30, totalWins: 1, totalMvp: 0, streak: 0, maxStreak: 1, matches: 3, tier: 'B' },
      { gamertag: 'reptil', club: 'SOUTHERN', points: 50, totalWins: 2, totalMvp: 0, streak: 0, maxStreak: 2, matches: 4, tier: 'B' },
      { gamertag: 's_melin', club: 'Plat R', points: 35, totalWins: 1, totalMvp: 0, streak: 0, maxStreak: 1, matches: 3, tier: 'B' },
      { gamertag: 'skylin', club: 'EUPHORIC', points: 60, totalWins: 2, totalMvp: 0, streak: 0, maxStreak: 2, matches: 4, tier: 'B' },
      { gamertag: 'Veronicc', club: 'PARANOID', points: 70, totalWins: 3, totalMvp: 0, streak: 0, maxStreak: 3, matches: 5, tier: 'A' },
      { gamertag: 'Vion', club: 'QUEEN', points: 90, totalWins: 4, totalMvp: 0, streak: 4, maxStreak: 4, matches: 6, tier: 'S' },
      { gamertag: 'weywey', club: 'RNB', points: 30, totalWins: 1, totalMvp: 0, streak: 0, maxStreak: 1, matches: 3, tier: 'B' },
      { gamertag: 'yaaay', club: 'YAKUZA', points: 30, totalWins: 1, totalMvp: 0, streak: 0, maxStreak: 1, matches: 3, tier: 'B' },
      { gamertag: 'yoonabi', club: 'PARANOID', points: 70, totalWins: 3, totalMvp: 0, streak: 0, maxStreak: 3, matches: 5, tier: 'A' },
    ];

    // ======== CREATE PLAYERS ========
    const malePlayers: Record<string, string> = {};
    for (const p of maleData) {
      const player = await db.player.create({
        data: {
          name: p.gamertag,
          gamertag: p.gamertag,
          division: 'male',
          tier: p.tier,
          points: p.points,
          totalWins: p.totalWins,
          totalMvp: p.totalMvp,
          streak: p.streak,
          maxStreak: p.maxStreak,
          matches: p.matches,
          isActive: true,
          city: '',
          registrationStatus: 'approved',
        },
      });
      malePlayers[p.gamertag] = player.id;
    }

    const femalePlayers: Record<string, string> = {};
    for (const p of femaleData) {
      const player = await db.player.create({
        data: {
          name: p.gamertag,
          gamertag: p.gamertag,
          division: 'female',
          tier: p.tier,
          points: p.points,
          totalWins: p.totalWins,
          totalMvp: p.totalMvp,
          streak: p.streak,
          maxStreak: p.maxStreak,
          matches: p.matches,
          isActive: true,
          city: '',
          registrationStatus: 'approved',
        },
      });
      femalePlayers[p.gamertag] = player.id;
    }

    // ======== CLUB LOGOS (from Cloudinary) ========
    const clubLogos: Record<string, string> = {
      'ALQA': 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722484/idm/logos/xm73kzny0klrncflhxfj.jpg',
      'AVENUE': 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722508/idm/logos/j8zw91uiulijp8gf8ugg.webp',
      'CROWN': 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722530/idm/logos/o1ujmjazgv1nxdpjzkew.webp',
      'EUPHORIC': 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722372/idm/logos/cdstmpd99aetv3xvbwu0.webp',
      'GYMSHARK': 'https://res.cloudinary.com/dagoryri5/image/upload/v1775839600/idm/logos/fymwsgztdv0egvjite2o.webp',
      'JASMINE': 'https://res.cloudinary.com/dagoryri5/image/upload/v1775714050/logo_nvzi1a.png',
      'MAXIMOUS': 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722447/idm/logos/ewl70fqyehvdhefxq76h.webp',
      'MYSTERY': 'https://res.cloudinary.com/dagoryri5/image/upload/v1775714050/logo_nvzi1a.png',
      'ORPHIC': 'https://res.cloudinary.com/dagoryri5/image/upload/v1775992653/logo1_tzieua.png',
      'PARANOID': 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722406/idm/logos/iwd3khpecy8yo1mx94js.webp',
      'PSALM': 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722357/idm/logos/agyc2zkbafrvf1kjrc0b.jpg',
      'Plat R': 'https://res.cloudinary.com/dagoryri5/image/upload/v1775748244/idm/logos/aydxk3fnrdkcmqh48aoi.jpg',
      'QUEEN': 'https://res.cloudinary.com/dagoryri5/image/upload/v1775839657/idm/logos/gzfny3tfdkxircyyxaxu.jpg',
      'RESTART': 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722457/idm/logos/kdtgjq5sdecmfjtflude.jpg',
      'RNB': 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722517/idm/logos/migrego3avfcr0pganyq.jpg',
      'SALVADOR': 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722472/idm/logos/zxikdnl6ycqx4hkfmpwi.jpg',
      'SECRETS': 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722381/idm/logos/shcq5q4air1xkpqnz1hi.jpg',
      'SENSEI': 'https://res.cloudinary.com/dagoryri5/image/upload/v1775714050/logo_nvzi1a.png',
      'SOUTHERN': 'https://res.cloudinary.com/dagoryri5/image/upload/v1775839645/idm/logos/upuq4u9bccaihdnh6llb.jpg',
      'TOGETHER': 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722484/idm/logos/xm73kzny0klrncflhxfj.jpg',
      'YAKUZA': 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722530/idm/logos/o1ujmjazgv1nxdpjzkew.webp',
    };

    // ======== CLUB PROFILES (persistent) — one per unique club name ========
    const allClubNames = [...new Set([...maleData.map(p => p.club), ...femaleData.map(p => p.club)])].sort((a, b) => a.localeCompare(b));
    const clubProfiles: Record<string, string> = {};

    for (const name of allClubNames) {
      const profile = await db.clubProfile.create({
        data: {
          name,
          logo: clubLogos[name] || null,
        },
      });
      clubProfiles[name] = profile.id;
    }

    // ======== CLUB SEASON ENTRIES (per season + division) ========
    const maleClubNames = [...new Set(maleData.map(p => p.club))].sort();
    const femaleClubNames = [...new Set(femaleData.map(p => p.club))].sort();

    const maleClubEntries: Record<string, string> = {};
    for (const name of maleClubNames) {
      const entry = await db.club.create({
        data: {
          profileId: clubProfiles[name],
          division: 'male',
          seasonId: maleSeason.id,
          wins: 0,
          losses: 0,
          points: 0,
          gameDiff: 0,
        },
      });
      maleClubEntries[name] = entry.id;
    }

    const femaleClubEntries: Record<string, string> = {};
    for (const name of femaleClubNames) {
      const entry = await db.club.create({
        data: {
          profileId: clubProfiles[name],
          division: 'female',
          seasonId: femaleSeason.id,
          wins: 0,
          losses: 0,
          points: 0,
          gameDiff: 0,
        },
      });
      femaleClubEntries[name] = entry.id;
    }

    // Season 2 female entries (empty stats, no members yet)
    for (const name of femaleClubNames) {
      await db.club.create({
        data: {
          profileId: clubProfiles[name],
          division: 'female',
          seasonId: s2Female.id,
          wins: 0,
          losses: 0,
          points: 0,
          gameDiff: 0,
        },
      });
    }

    // ======== CLUB MEMBERSHIPS (persistent — linked to ClubProfile) ========
    // First player in each club becomes captain
    const maleClubFirstPlayer: Record<string, boolean> = {};
    for (const p of maleData) {
      const isFirst = !maleClubFirstPlayer[p.club];
      maleClubFirstPlayer[p.club] = true;
      await db.clubMember.create({
        data: {
          profileId: clubProfiles[p.club],
          playerId: malePlayers[p.gamertag],
          role: isFirst ? 'captain' : 'member',
        },
      });
    }

    const femaleClubFirstPlayer: Record<string, boolean> = {};
    for (const p of femaleData) {
      const isFirst = !femaleClubFirstPlayer[p.club];
      femaleClubFirstPlayer[p.club] = true;
      await db.clubMember.create({
        data: {
          profileId: clubProfiles[p.club],
          playerId: femalePlayers[p.gamertag],
          role: isFirst ? 'captain' : 'member',
        },
      });
    }

    // Champion is NOT auto-set — admin must manually set champion via Admin Panel > Season

    return NextResponse.json({
      success: true,
      message: 'Database seeded with new schema (ClubProfile + Club season entries + persistent ClubMember)',
      stats: {
        malePlayers: maleData.length,
        femalePlayers: femaleData.length,
        clubProfiles: allClubNames.length,
        maleSeasonEntries: maleClubNames.length,
        femaleSeasonEntries: femaleClubNames.length,
        totalMembers: maleData.length + femaleData.length,
      },
    });
  } catch (e: unknown) {
    const error = e as Error;
    console.error('Seed error:', error);
    return NextResponse.json({ error: getSafeErrorMessage(e) }, { status: 500 });
  }
}
