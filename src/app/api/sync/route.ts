import { db, neonUpdateMany, isPostgreSQL } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/api-auth';
import { withDbRetry } from '@/lib/db-resilience';
import { getSafeErrorMessage } from '@/lib/api-error';
import { NextResponse } from 'next/server';

/**
 * POST /api/sync
 *
 * Sync endpoint to push data from local SQLite to Neon PostgreSQL.
 * Syncs: club logos, player avatars, season champion data, banner images.
 *
 * Body format (optional — uses built-in defaults if not provided):
 * {
 *   "clubLogos": [{ "name": "MAXIMOUS", "logo": "https://..." }],
 *   "playerAvatars": [{ "gamertag": "Bambang", "avatar": "https://..." }],
 *   "seasonChampions": [{ "seasonName": "...", "championClubName": "MAXIMOUS" }],
 *   "clubBanners": [{ "name": "MAXIMOUS", "bannerImage": "https://..." }]
 * }
 *
 * IMPORTANT: This syncs FROM the database the server is connected to.
 * When called on Vercel (Neon), it updates Neon data with the payload provided.
 * When called locally (SQLite), it reads SQLite data and can be used to generate a payload.
 */
export async function POST(request: Request) {
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    let body: {
      clubLogos?: Array<{ name: string; division?: string; logo: string }>;
      playerAvatars?: Array<{ gamertag: string; avatar: string }>;
      seasonChampions?: Array<{ seasonName: string; championClubName: string; championSquad?: string }>;
      clubBanners?: Array<{ name: string; division?: string; bannerImage: string }>;
    } = {};

    try {
      body = await request.json();
    } catch {
      // No body — use defaults
    }

    const results = {
      clubLogos: { total: 0, updated: 0, details: [] as Array<{ name: string; count: number }> },
      playerAvatars: { total: 0, updated: 0, details: [] as Array<{ gamertag: string; count: number }> },
      seasonChampions: { total: 0, updated: 0, details: [] as Array<{ seasonName: string; success: boolean }> },
      clubBanners: { total: 0, updated: 0, details: [] as Array<{ name: string; count: number }> },
    };

    // ── 1. Sync Club Logos (on ClubProfile) ──
    const clubLogos = body.clubLogos?.length ? body.clubLogos : getDefaultClubLogos();
    results.clubLogos.total = clubLogos.length;

    for (const clubData of clubLogos) {
      // ClubProfile has unique name, update logo there
      // Neon workaround: updateMany() doesn't work with PrismaNeonHttp
      let result: { count: number };
      if (isPostgreSQL) {
        const updateCount = await neonUpdateMany('ClubProfile',
          [{ column: 'name', operator: '=', value: clubData.name }],
          { logo: clubData.logo },
        );
        result = { count: updateCount };
      } else {
        result = await withDbRetry(() => db.clubProfile.updateMany({
          where: { name: clubData.name },
          data: { logo: clubData.logo },
        }));
      }

      results.clubLogos.details.push({
        name: clubData.name,
        count: result.count,
      });
      if (result.count > 0) results.clubLogos.updated++;
    }

    // ── 2. Sync Club Banners (on ClubProfile) ──
    const clubBanners = body.clubBanners?.length ? body.clubBanners : getDefaultClubBanners();
    results.clubBanners.total = clubBanners.length;

    for (const clubData of clubBanners) {
      // Neon workaround: updateMany() doesn't work with PrismaNeonHttp
      let bannerResult: { count: number };
      if (isPostgreSQL) {
        const updateCount = await neonUpdateMany('ClubProfile',
          [{ column: 'name', operator: '=', value: clubData.name }],
          { bannerImage: clubData.bannerImage },
        );
        bannerResult = { count: updateCount };
      } else {
        bannerResult = await withDbRetry(() => db.clubProfile.updateMany({
          where: { name: clubData.name },
          data: { bannerImage: clubData.bannerImage },
        }));
      }

      results.clubBanners.details.push({
        name: clubData.name,
        count: bannerResult.count,
      });
      if (bannerResult.count > 0) results.clubBanners.updated++;
    }

    // ── 3. Sync Player Avatars ──
    const playerAvatars = body.playerAvatars?.length ? body.playerAvatars : getDefaultPlayerAvatars();
    results.playerAvatars.total = playerAvatars.length;

    for (const playerData of playerAvatars) {
      // Neon workaround: updateMany() doesn't work with PrismaNeonHttp
      let avatarResult: { count: number };
      if (isPostgreSQL) {
        const updateCount = await neonUpdateMany('Player',
          [{ column: 'gamertag', operator: '=', value: playerData.gamertag }],
          { avatar: playerData.avatar },
        );
        avatarResult = { count: updateCount };
      } else {
        avatarResult = await withDbRetry(() => db.player.updateMany({
          where: { gamertag: playerData.gamertag },
          data: { avatar: playerData.avatar },
        }));
      }

      results.playerAvatars.details.push({
        gamertag: playerData.gamertag,
        count: avatarResult.count,
      });
      if (avatarResult.count > 0) results.playerAvatars.updated++;
    }

    // ── 4. Sync Season Champion Club (Tarkam: skip, no club champions) ──
    const seasonChampions = body.seasonChampions?.length ? body.seasonChampions : [];
    results.seasonChampions.total = seasonChampions.length;

    for (const champData of seasonChampions) {
      // Tarkam: No club champion sync needed
      results.seasonChampions.details.push({
        seasonName: champData.seasonName,
        success: false,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Sync completed',
      results,
    });
  } catch (e: unknown) {
    const error = e as Error;
    console.error('[/api/sync] Error:', error);
    return NextResponse.json({ error: getSafeErrorMessage(e) }, { status: 500 });
  }
}

/**
 * GET /api/sync — Export current database data as a sync payload.
 * This reads from whichever database the server is connected to.
 * Useful for generating a sync payload from SQLite to push to Neon.
 */
export async function GET(request: Request) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    // Read from ClubProfile (persistent model with name, logo, bannerImage)
    const clubProfiles = await withDbRetry(() => db.clubProfile.findMany({
      select: { name: true, logo: true, bannerImage: true },
    }));

    const players = await withDbRetry(() => db.player.findMany({
      where: { avatar: { not: null }, isActive: true },
      select: { gamertag: true, avatar: true },
    }));

    const seasons = await withDbRetry(() => db.season.findMany({
      select: { name: true, championPlayerId: true, championSquad: true, championPlayer: { select: { gamertag: true } } },
    }));

    const clubLogos = clubProfiles
      .filter(c => c.logo)
      .map(c => ({ name: c.name, logo: c.logo! }));

    const clubBanners = clubProfiles
      .filter(c => c.bannerImage)
      .map(c => ({ name: c.name, bannerImage: c.bannerImage! }));

    const playerAvatars = players.map(p => ({ gamertag: p.gamertag, avatar: p.avatar! }));

    const seasonChampions = seasons
      .filter(s => s.championPlayer)
      .map(s => ({
        seasonName: s.name,
        championClubName: s.championPlayer!.gamertag,
        championSquad: s.championSquad || undefined,
      }));

    return NextResponse.json({
      clubLogos,
      clubBanners,
      playerAvatars,
      seasonChampions,
      _meta: {
        totalClubProfiles: clubProfiles.length,
        totalLogos: clubLogos.length,
        totalBanners: clubBanners.length,
        totalAvatars: playerAvatars.length,
        totalChampions: seasonChampions.length,
      },
    }, { headers });
  } catch (e: unknown) {
    const error = e as Error;
    console.error('[/api/sync GET] Error:', error);
    return NextResponse.json({ error: getSafeErrorMessage(e) }, { headers,  status: 500 });
  }
}

// ── Default sync data (from SQLite as of latest dump) ──
// These are used when no body is provided in the POST request.
// Keep these updated when logos change in the sandbox.

function getDefaultClubLogos(): Array<{ name: string; division: string; logo: string }> {
  return [
    { name: 'ALQA', division: 'male', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722484/idm/logos/xm73kzny0klrncflhxfj.jpg' },
    { name: 'AVENUE', division: 'male', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722508/idm/logos/j8zw91uiulijp8gf8ugg.webp' },
    { name: 'CROWN', division: 'male', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722530/idm/logos/o1ujmjazgv1nxdpjzkew.webp' },
    { name: 'EUPHORIC', division: 'male', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722393/idm/logos/d1jroavrbfs7uwm8mx0t.jpg' },
    { name: 'GYMSHARK', division: 'male', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1776529296/gymshark_ucdx0m.jpg' },
    { name: 'JASMINE', division: 'male', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775714050/logo_nvzi1a.png' },
    { name: 'MAXIMOUS', division: 'male', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722381/idm/logos/shcq5q4air1xkpqnz1hi.jpg' },
    { name: 'MYSTERY', division: 'male', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775714050/logo_nvzi1a.png' },
    { name: 'ORPHIC', division: 'male', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775992653/logo1_tzieua.png' },
    { name: 'PARANOID', division: 'male', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722372/idm/logos/cdstmpd99aetv3xvbwu0.webp' },
    { name: 'RESTART', division: 'male', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722406/idm/logos/iwd3khpecy8yo1mx94js.webp' },
    { name: 'SALVADOR', division: 'male', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722472/idm/logos/zxikdnl6ycqx4hkfmpwi.jpg' },
    { name: 'SECRETS', division: 'male', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775992653/logo1_tzieua.png' },
    { name: 'SENSEI', division: 'male', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775714050/logo_nvzi1a.png' },
    { name: 'SOUTHERN', division: 'male', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775748244/idm/logos/aydxk3fnrdkcmqh48aoi.jpg' },
    { name: 'EUPHORIC', division: 'female', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722372/idm/logos/cdstmpd99aetv3xvbwu0.webp' },
    { name: 'GYMSHARK', division: 'female', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775839600/idm/logos/fymwsgztdv0egvjite2o.webp' },
    { name: 'MAXIMOUS', division: 'female', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722447/idm/logos/ewl70fqyehvdhefxq76h.webp' },
    { name: 'PARANOID', division: 'female', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722406/idm/logos/iwd3khpecy8yo1mx94js.webp' },
    { name: 'Plat R', division: 'female', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775748244/idm/logos/aydxk3fnrdkcmqh48aoi.jpg' },
    { name: 'PSALM', division: 'female', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722357/idm/logos/agyc2zkbafrvf1kjrc0b.jpg' },
    { name: 'QUEEN', division: 'female', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775839657/idm/logos/gzfny3tfdkxircyyxaxu.jpg' },
    { name: 'RESTART', division: 'female', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722457/idm/logos/kdtgjq5sdecmfjtflude.jpg' },
    { name: 'RNB', division: 'female', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722517/idm/logos/migrego3avfcr0pganyq.jpg' },
    { name: 'SECRETS', division: 'female', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722381/idm/logos/shcq5q4air1xkpqnz1hi.jpg' },
    { name: 'SOUTHERN', division: 'female', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775839645/idm/logos/upuq4u9bccaihdnh6llb.jpg' },
    { name: 'TOGETHER', division: 'female', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722484/idm/logos/xm73kzny0klrncflhxfj.jpg' },
    { name: 'YAKUZA', division: 'female', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722530/idm/logos/o1ujmjazgv1nxdpjzkew.webp' },
  ];
}

function getDefaultClubBanners(): Array<{ name: string; division: string; bannerImage: string }> {
  return []; // No banners yet — will be populated when admin uploads banners
}

function getDefaultPlayerAvatars(): Array<{ gamertag: string; avatar: string }> {
  return [
    { gamertag: 'Bambang', avatar: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775739753/idm/avatars/h5u2udboaznqgs3yw8f2.webp' },
  ];
}

function getDefaultSeasonChampions(): Array<{ seasonName: string; championClubName: string; championSquad?: string }> {
  return [];
}
