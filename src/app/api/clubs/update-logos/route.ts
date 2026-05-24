import { db, neonUpdateMany, isPostgreSQL } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { withDbRetry } from '@/lib/db-resilience';
import { getSafeErrorMessage } from '@/lib/api-error';
import { NextResponse } from 'next/server';

/**
 * POST /api/clubs/update-logos
 *
 * Sync club logos from Cloudinary into the database.
 * Now updates ClubProfile instead of Club (logos are persistent identity).
 *
 * Body format (optional):
 * { "logos": [{ "name": "MAXIMOUS", "logo": "https://..." }] }
 */
export async function POST(request: Request) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    // Try to read logos from request body first
    let logos: Array<{ name: string; logo: string }>;

    try {
      const body = await request.json();
      if (body?.logos && Array.isArray(body.logos) && body.logos.length > 0) {
        logos = body.logos;
      } else {
        logos = getDefaultLogos();
      }
    } catch {
      // No body or invalid JSON — use built-in mapping
      logos = getDefaultLogos();
    }

    const updatedProfiles: Array<{ name: string; updated: boolean; count: number }> = [];

    for (const clubData of logos) {
      // Update ClubProfile by name (persistent identity)
      // Neon workaround: updateMany() doesn't work with PrismaNeonHttp
      let result: { count: number };
      if (isPostgreSQL) {
        const updateCount = await neonUpdateMany('ClubProfile',
          [{ column: 'name', operator: '=', value: clubData.name }],
          { logo: clubData.logo },
        );
        result = { count: updateCount };
      } else {
        result = await db.clubProfile.updateMany({
          where: { name: clubData.name },
          data: { logo: clubData.logo },
        });
      }

      updatedProfiles.push({
        name: clubData.name,
        updated: result.count > 0,
        count: result.count,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updatedProfiles.filter(c => c.updated).length}/${logos.length} club profile logos`,
      updatedProfiles,
    });
  } catch (e: unknown) {
    const error = e as Error;
    console.error('Update club logos error:', error);
    return NextResponse.json({ error: getSafeErrorMessage(e) }, { status: 500 });
  }
}

/**
 * Default logo mapping from Cloudinary.
 * These go into ClubProfile now (one logo per club, not per division).
 */
function getDefaultLogos(): Array<{ name: string; logo: string }> {
  return [
    { name: 'ALQA', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722484/idm/logos/xm73kzny0klrncflhxfj.jpg' },
    { name: 'AVENUE', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722508/idm/logos/j8zw91uiulijp8gf8ugg.webp' },
    { name: 'CROWN', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722530/idm/logos/o1ujmjazgv1nxdpjzkew.webp' },
    { name: 'EUPHORIC', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722372/idm/logos/cdstmpd99aetv3xvbwu0.webp' },
    { name: 'GYMSHARK', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775839600/idm/logos/fymwsgztdv0egvjite2o.webp' },
    { name: 'JASMINE', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722472/idm/logos/zxikdnl6ycqx4hkfmpwi.jpg' },
    { name: 'MAXIMOUS', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722381/idm/logos/shcq5q4air1xkpqnz1hi.jpg' },
    { name: 'MYSTERY', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722423/idm/logos/gdvdqo4ul8filhyv2zrz.jpg' },
    { name: 'ORPHIC', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722393/idm/logos/d1jroavrbfs7uwm8mx0t.jpg' },
    { name: 'PARANOID', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722406/idm/logos/iwd3khpecy8yo1mx94js.webp' },
    { name: 'Plat R', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775748244/idm/logos/aydxk3fnrdkcmqh48aoi.jpg' },
    { name: 'PSALM', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722357/idm/logos/agyc2zkbafrvf1kjrc0b.jpg' },
    { name: 'QUEEN', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775839657/idm/logos/gzfny3tfdkxircyyxaxu.jpg' },
    { name: 'RESTART', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722457/idm/logos/kdtgjq5sdecmfjtflude.jpg' },
    { name: 'RNB', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722517/idm/logos/migrego3avfcr0pganyq.jpg' },
    { name: 'SALVADOR', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722437/idm/logos/ofcqjompuuqcmmqfoziu.webp' },
    { name: 'SECRETS', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722381/idm/logos/shcq5q4air1xkpqnz1hi.jpg' },
    { name: 'SENSEI', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775839508/idm/logos/r41d6jqucjorjnh1scro.jpg' },
    { name: 'SOUTHERN', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775839645/idm/logos/upuq4u9bccaihdnh6llb.jpg' },
    { name: 'TOGETHER', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722484/idm/logos/xm73kzny0klrncflhxfj.jpg' },
    { name: 'YAKUZA', logo: 'https://res.cloudinary.com/dagoryri5/image/upload/v1775722530/idm/logos/o1ujmjazgv1nxdpjzkew.webp' },
  ];
}
