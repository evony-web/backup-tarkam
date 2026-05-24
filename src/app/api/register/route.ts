import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, RATE_LIMITS, rateLimitHeaders } from '@/lib/rate-limit';
import { validateInput, registerSchema } from '@/lib/validation';
import { hashPassword, createPlayerSessionToken } from '@/lib/auth';

// Helper to mask phone numbers in public responses (show only last 4 digits)
function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return '****';
  return '****' + digits.slice(-4);
}

/**
 * Deep-sanitize a response object: mask phone numbers in any
 * 'similarPlayers' or 'similar' arrays to protect user privacy.
 */
function sanitizeResponse<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  const result = { ...obj as Record<string, unknown> };

  // Mask phone in similarPlayers arrays
  for (const key of ['similarPlayers', 'similar']) {
    if (Array.isArray(result[key])) {
      result[key] = (result[key] as Array<Record<string, unknown>>).map(p => {
        if (p && typeof p === 'object' && 'phone' in p) {
          return { ...p, phone: maskPhone(typeof p.phone === 'string' ? p.phone : null) };
        }
        return p;
      });
    }
  }

  return result as T;
}

/**
 * Create a sanitized JSON response — automatically masks phone numbers
 * in similarPlayers/similar arrays to protect user privacy.
 */
function sanitizedJson(data: Record<string, unknown>, init?: ResponseInit): NextResponse {
  return NextResponse.json(sanitizeResponse(data), init);
}

// Helper to calculate Levenshtein distance for typo detection
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Check if names are too similar
function areNamesSimilar(name1: string, name2: string): boolean {
  const n1 = name1.toLowerCase().trim();
  const n2 = name2.toLowerCase().trim();

  if (n1 === n2) return true;

  if (n1.includes(n2) || n2.includes(n1)) {
    const lengthDiff = Math.abs(n1.length - n2.length);
    if (lengthDiff <= 2) return true;
  }

  const distance = levenshteinDistance(n1, n2);
  const maxLen = Math.max(n1.length, n2.length);
  const similarityRatio = 1 - distance / maxLen;

  if (similarityRatio >= 0.8 && maxLen >= 3) return true;

  return false;
}

function normalizePhone(phone: string | null): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  // Normalize Indonesian phone numbers to international format (628xx)
  // 0812... → 62812..., +62812... → 62812...
  // This matches waNumber format so phone = waNumber always
  if (digits.startsWith('0') && digits.length >= 10) {
    digits = '62' + digits.slice(1);
  }
  return digits;
}

function normalizeCity(city: string): string {
  return city.toLowerCase().trim();
}

interface DuplicateCheck {
  isBlocked: boolean;
  isHighRisk: boolean;
  canReRegister: boolean;       // True for both approved+active (daftar ulang turnamen) and rejected/inactive (daftar ulang penuh)
  isApprovedPlayer: boolean;    // True if the matching player is approved+active (just create participation, don't reset)
  alreadyInTournament: boolean; // True if already has participation in active tournament
  reRegisterPlayerId: string | null;
  similarPlayers: Array<{
    id: string;
    name: string;
    gamertag: string;
    division: string;
    city: string;
    phone: string | null;
    registrationStatus: string;
    isActive: boolean;
    matchType: 'exact_name' | 'similar_name' | 'phone_match';
    matchDetails: {
      nameMatch: boolean;
      cityMatch: boolean;
      phoneMatch: boolean;
      nameDifferent: boolean;
    };
  }>;
  message: string;
}

function checkDuplicates(
  name: string,
  city: string,
  phone: string | null,
  division: string,
  existingPlayers: Array<{ id: string; name: string; gamertag: string; division: string; city: string; phone: string | null; registrationStatus: string; isActive: boolean }>,
  activeTournamentParticipations: Array<{ playerId: string; tournamentId: string; status: string }> = []
): DuplicateCheck {
  const normalizedName = name.toLowerCase().trim();
  const normalizedCity = normalizeCity(city);
  const normalizedPhone = normalizePhone(phone);

  const similarPlayers: DuplicateCheck['similarPlayers'] = [];

  // ====== PASS 1: Check name-based duplicates ======
  for (const player of existingPlayers) {
    const playerNameLower = player.name.toLowerCase().trim();
    const playerCityLower = normalizeCity(player.city);
    const playerPhoneNorm = normalizePhone(player.phone);

    const nameMatch = playerNameLower === normalizedName;
    const nameSimilar = areNamesSimilar(name, player.name);

    if (!nameMatch && !nameSimilar) continue;

    const cityMatch = playerCityLower === normalizedCity;
    const phoneMatch = !!(normalizedPhone && playerPhoneNorm && playerPhoneNorm.length >= 8 && normalizedPhone.length >= 8 && (
      normalizedPhone === playerPhoneNorm ||
      normalizedPhone.endsWith(playerPhoneNorm.slice(-8)) ||
      playerPhoneNorm.endsWith(normalizedPhone.slice(-8))
    ));

    const matchType = nameMatch ? 'exact_name' : 'similar_name';

    similarPlayers.push({
      id: player.id,
      name: player.name,
      gamertag: player.gamertag,
      division: player.division,
      city: player.city,
      phone: player.phone,
      registrationStatus: player.registrationStatus,
      isActive: player.isActive,
      matchType,
      matchDetails: {
        nameMatch,
        cityMatch,
        phoneMatch,
        nameDifferent: false,
      },
    });
  }

  // ====== PASS 2: Check phone-based duplicates ======
  if (normalizedPhone) {
    for (const player of existingPlayers) {
      const playerPhoneNorm = normalizePhone(player.phone);
      const playerCityLower = normalizeCity(player.city);

      if (!playerPhoneNorm) continue;

      const phoneMatch = normalizedPhone === playerPhoneNorm ||
        (playerPhoneNorm.length >= 8 && normalizedPhone.length >= 8 && (
          normalizedPhone.endsWith(playerPhoneNorm.slice(-8)) ||
          playerPhoneNorm.endsWith(normalizedPhone.slice(-8))
        ));

      if (!phoneMatch) continue;

      const alreadyAdded = similarPlayers.some(p => p.id === player.id);
      if (alreadyAdded) continue;

      const cityMatch = playerCityLower === normalizedCity;

      similarPlayers.push({
        id: player.id,
        name: player.name,
        gamertag: player.gamertag,
        division: player.division,
        city: player.city,
        phone: player.phone,
        registrationStatus: player.registrationStatus,
        isActive: player.isActive,
        matchType: 'phone_match',
        matchDetails: {
          nameMatch: false,
          cityMatch,
          phoneMatch: true,
          nameDifferent: true,
        },
      });
    }
  }

  // ====== Determine risk level and message ======

  const exactNamePlayer = similarPlayers.find(p => p.matchDetails.nameMatch);

  if (exactNamePlayer) {
    const exactNamePhoneNorm = normalizePhone(exactNamePlayer.phone);

    // ====== PHONE SECURITY CHECK: Verify phone ownership ======
    // Prevent hijacking: someone using another person's name with a different phone

    // 1. If DB has phone AND input phone differs → BLOCK (hijacking attempt)
    if (exactNamePhoneNorm && normalizedPhone &&
        exactNamePhoneNorm.length >= 8 && normalizedPhone.length >= 8 &&
        exactNamePhoneNorm !== normalizedPhone &&
        !normalizedPhone.endsWith(exactNamePhoneNorm.slice(-8)) &&
        !exactNamePhoneNorm.endsWith(normalizedPhone.slice(-8))) {
      return {
        isBlocked: true,
        isHighRisk: true,
        canReRegister: false,
        isApprovedPlayer: false,
        alreadyInTournament: false,
        reRegisterPlayerId: null,
        similarPlayers: [exactNamePlayer],
        message: `Nama "${name}" sudah terdaftar dengan nomor WhatsApp yang berbeda. Jika ini akun Anda, hubungi admin. Jika bukan, gunakan nama lain.`,
      };
    }

    // 2. Check if input phone is used by ANOTHER player (not the name-matched one)
    if (normalizedPhone && normalizedPhone.length >= 8) {
      const phoneUsedByOther = existingPlayers.find(p => {
        if (p.id === exactNamePlayer.id) return false; // Skip the name-matched player
        const pNorm = normalizePhone(p.phone);
        if (!pNorm || pNorm.length < 8) return false;
        return normalizedPhone === pNorm ||
          normalizedPhone.endsWith(pNorm.slice(-8)) ||
          pNorm.endsWith(normalizedPhone.slice(-8));
      });

      if (phoneUsedByOther) {
        return {
          isBlocked: true,
          isHighRisk: true,
          canReRegister: false,
          isApprovedPlayer: false,
          alreadyInTournament: false,
          reRegisterPlayerId: null,
          similarPlayers: [exactNamePlayer, {
            id: phoneUsedByOther.id,
            name: phoneUsedByOther.name,
            gamertag: phoneUsedByOther.gamertag,
            division: phoneUsedByOther.division,
            city: phoneUsedByOther.city,
            phone: phoneUsedByOther.phone,
            registrationStatus: phoneUsedByOther.registrationStatus,
            isActive: phoneUsedByOther.isActive,
            matchType: 'phone_match' as const,
            matchDetails: {
              nameMatch: false,
              cityMatch: normalizeCity(phoneUsedByOther.city) === normalizedCity,
              phoneMatch: true,
              nameDifferent: true,
            },
          }],
          message: `Nomor WhatsApp ini sudah digunakan oleh "${phoneUsedByOther.name}". Satu nomor WhatsApp hanya untuk satu peserta.`,
        };
      }
    }

    // 3. If DB phone is empty → input phone will fill it in (safe, proceed)
    // 4. If DB phone matches input → normal re-registration (proceed)

    // Check if already registered in active tournament
    const existingParticipation = activeTournamentParticipations.find(
      p => p.playerId === exactNamePlayer.id
    );

    if (existingParticipation) {
      return {
        isBlocked: true,
        isHighRisk: true,
        canReRegister: false,
        isApprovedPlayer: false,
        alreadyInTournament: true,
        reRegisterPlayerId: null,
        similarPlayers: [exactNamePlayer],
        message: `Nama "${name}" sudah terdaftar di turnamen minggu ini (status: ${existingParticipation.status}). Tidak perlu mendaftar lagi.`,
      };
    }

    // Rejected or inactive — full re-registration (reset player data)
    if (exactNamePlayer.registrationStatus === 'rejected' || !exactNamePlayer.isActive) {
      return {
        isBlocked: false,
        isHighRisk: false,
        canReRegister: true,
        isApprovedPlayer: false,
        alreadyInTournament: false,
        reRegisterPlayerId: exactNamePlayer.id,
        similarPlayers: [exactNamePlayer],
        message: `Nama "${name}" sudah terdaftar sebelumnya tapi ditolak/nonaktif. Anda bisa mendaftar untuk masuk antrian persetujuan admin.`,
      };
    }

    // Pending — already in queue, block
    if (exactNamePlayer.registrationStatus === 'pending') {
      return {
        isBlocked: true,
        isHighRisk: true,
        canReRegister: false,
        isApprovedPlayer: false,
        alreadyInTournament: false,
        reRegisterPlayerId: null,
        similarPlayers: [exactNamePlayer],
        message: `Pendaftaran diblokir! Nama "${name}" sudah dalam antrian persetujuan admin (nickname: "${exactNamePlayer.gamertag}"). Silakan tunggu admin menyetujui pendaftaran Anda.`,
      };
    }

    // Approved and active — daftar ulang for tournament (just create participation, don't reset player)
    return {
      isBlocked: false,
      isHighRisk: false,
      canReRegister: true,
      isApprovedPlayer: true,
      alreadyInTournament: false,
      reRegisterPlayerId: exactNamePlayer.id,
      similarPlayers: [exactNamePlayer],
      message: `Nama "${name}" sudah terdaftar sebagai peserta aktif (nickname: "${exactNamePlayer.gamertag}"). Klik "Daftar" untuk mendaftar di turnamen minggu ini.`,
    };
  }

  const phoneMatchPlayer = similarPlayers.find(p => p.matchDetails.phoneMatch);

  if (phoneMatchPlayer) {
    // Phone match with DIFFERENT name — BLOCK (same WA = same person, can't register as different person)
    if (phoneMatchPlayer.matchDetails.nameDifferent) {
      // Check if already registered in active tournament
      const existingParticipation = activeTournamentParticipations.find(
        p => p.playerId === phoneMatchPlayer.id
      );

      if (existingParticipation) {
        return {
          isBlocked: true,
          isHighRisk: true,
          canReRegister: false,
          isApprovedPlayer: false,
          alreadyInTournament: true,
          reRegisterPlayerId: null,
          similarPlayers: [phoneMatchPlayer],
          message: `Nomor WhatsApp ini sudah terdaftar di turnamen minggu ini atas nama "${phoneMatchPlayer.name}" (status: ${existingParticipation.status}). Satu nomor WhatsApp hanya untuk satu peserta.`,
        };
      }

      if (phoneMatchPlayer.registrationStatus === 'pending') {
        return {
          isBlocked: true,
          isHighRisk: true,
          canReRegister: false,
          isApprovedPlayer: false,
          alreadyInTournament: false,
          reRegisterPlayerId: null,
          similarPlayers: [phoneMatchPlayer],
          message: `Pendaftaran diblokir! Nomor WhatsApp ini sudah dalam antrian persetujuan admin atas nama "${phoneMatchPlayer.name}". Satu nomor WhatsApp hanya untuk satu peserta.`,
        };
      }

      // Active/approved/rejected — all blocked if name is different
      return {
        isBlocked: true,
        isHighRisk: true,
        canReRegister: false,
        isApprovedPlayer: false,
        alreadyInTournament: false,
        reRegisterPlayerId: null,
        similarPlayers: [phoneMatchPlayer],
        message: `Nomor WhatsApp ini sudah terdaftar atas nama "${phoneMatchPlayer.name}" (nickname: "${phoneMatchPlayer.gamertag}"). Satu nomor WhatsApp hanya untuk satu peserta. Hubungi admin jika ada kendala.`,
      };
    }

    // Phone match with SAME name — allow re-register
    // Check if already registered in active tournament
    const existingParticipation = activeTournamentParticipations.find(
      p => p.playerId === phoneMatchPlayer.id
    );

    if (existingParticipation) {
      return {
        isBlocked: true,
        isHighRisk: true,
        canReRegister: false,
        isApprovedPlayer: false,
        alreadyInTournament: true,
        reRegisterPlayerId: null,
        similarPlayers: [phoneMatchPlayer],
        message: `Nomor WhatsApp ini sudah terdaftar di turnamen minggu ini atas nama "${phoneMatchPlayer.name}" (status: ${existingParticipation.status}).`,
      };
    }

    if (phoneMatchPlayer.registrationStatus === 'rejected' || !phoneMatchPlayer.isActive) {
      return {
        isBlocked: false,
        isHighRisk: false,
        canReRegister: true,
        isApprovedPlayer: false,
        alreadyInTournament: false,
        reRegisterPlayerId: phoneMatchPlayer.id,
        similarPlayers: [phoneMatchPlayer],
        message: `Nomor WhatsApp ini sudah terdaftar sebelumnya dengan nama "${phoneMatchPlayer.name}" tapi ditolak/nonaktif. Anda bisa mendaftar.`,
      };
    }

    if (phoneMatchPlayer.registrationStatus === 'pending') {
      return {
        isBlocked: true,
        isHighRisk: true,
        canReRegister: false,
        isApprovedPlayer: false,
        alreadyInTournament: false,
        reRegisterPlayerId: null,
        similarPlayers: [phoneMatchPlayer],
        message: `Pendaftaran diblokir! Nomor WhatsApp ini sudah dalam antrian persetujuan admin atas nama "${phoneMatchPlayer.name}".`,
      };
    }

    // Approved and active — daftar ulang for tournament
    return {
      isBlocked: false,
      isHighRisk: false,
      canReRegister: true,
      isApprovedPlayer: true,
      alreadyInTournament: false,
      reRegisterPlayerId: phoneMatchPlayer.id,
      similarPlayers: [phoneMatchPlayer],
      message: `Nomor WhatsApp ini sudah terdaftar atas nama "${phoneMatchPlayer.name}" (nickname: "${phoneMatchPlayer.gamertag}"). Klik "Daftar" untuk mendaftar di turnamen minggu ini.`,
    };
  }

  // Similar name only — warning
  if (similarPlayers.length > 0) {
    return {
      isBlocked: false,
      isHighRisk: false,
      canReRegister: false,
      isApprovedPlayer: false,
      alreadyInTournament: false,
      reRegisterPlayerId: null,
      similarPlayers,
      message: `Terdapat nama yang mirip: ${similarPlayers.map(p => p.name).join(', ')}. Yakin nama ini berbeda?`,
    };
  }

  return {
    isBlocked: false,
    isHighRisk: false,
    canReRegister: false,
    isApprovedPlayer: false,
    alreadyInTournament: false,
    reRegisterPlayerId: null,
    similarPlayers: [],
    message: '',
  };
}

// Find the active tournament that's accepting registrations for a division
async function findActiveTournament(division: string) {
  // Find the latest season for this division
  const season = await db.season.findFirst({
    where: { division, status: 'active' },
    orderBy: { startDate: 'desc' },
  });

  if (!season) return null;

  // Find a tournament in registration or setup phase for this season
  const tournament = await db.tournament.findFirst({
    where: {
      seasonId: season.id,
      status: { in: ['setup', 'registration', 'approval'] },
    },
    orderBy: { weekNumber: 'desc' },
  });

  return tournament;
}

// Find the latest tournament in the active season regardless of phase
// Used for checking if a player already has participation in ANY tournament
async function findLatestTournament(division: string) {
  const season = await db.season.findFirst({
    where: { division, status: 'active' },
    orderBy: { startDate: 'desc' },
  });

  if (!season) return null;

  const tournament = await db.tournament.findFirst({
    where: { seasonId: season.id },
    orderBy: { weekNumber: 'desc' },
  });

  return tournament;
}

// Helper to create participation for a player in an active tournament
async function createParticipationForTournament(playerId: string, division: string) {
  const activeTournament = await findActiveTournament(division);
  if (!activeTournament) return { tournament: null, participation: null, error: null };

  // Check if already registered in this tournament
  const existingParticipation = await db.participation.findUnique({
    where: { playerId_tournamentId: { playerId, tournamentId: activeTournament.id } },
  });

  if (existingParticipation) {
    return {
      tournament: activeTournament,
      participation: null,
      error: `Anda sudah terdaftar di ${activeTournament.name} (status: ${existingParticipation.status}).`,
    };
  }

  const participation = await db.participation.create({
    data: {
      playerId,
      tournamentId: activeTournament.id,
      status: 'registered',
      pointsEarned: 0,
    },
  });

  // Update tournament status from setup to registration if needed
  if (activeTournament.status === 'setup') {
    await db.tournament.update({
      where: { id: activeTournament.id },
      data: { status: 'registration' },
    });
  }

  // Trigger Pusher real-time event so marquee updates instantly
  try {
    const { getPusher, PUSHER_CHANNELS, PUSHER_EVENTS } = await import('@/lib/pusher');
    const pusher = getPusher();
    if (pusher) {
      await pusher.trigger(PUSHER_CHANNELS.FEED, PUSHER_EVENTS.FEED_UPDATED, {
        type: 'tournament_signup',
        timestamp: new Date().toISOString(),
      });
    }
  } catch {
    // Pusher not available — graceful fallback (marquee will update on next poll)
  }

  return { tournament: activeTournament, participation, error: null };
}

// GET - Check for duplicate names (for real-time validation)
export async function GET(request: Request) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  // Rate limit: 30 duplicate checks per minute per IP
  const clientIp = getClientIp(request);
  const rateLimit = checkRateLimit(clientIp, { windowMs: 60 * 1000, maxRequests: 30, prefix: 'register-check' });
  Object.entries(rateLimitHeaders(rateLimit)).forEach(([k, v]) => headers.set(k, v));
  if (!rateLimit.allowed) {
    return sanitizedJson(
      { error: 'Terlalu banyak pengecekan. Tunggu sebentar.' },
      { status: 429, headers: { ...Object.fromEntries(headers.entries()), 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');
  const city = searchParams.get('city');
  const phone = searchParams.get('phone');
  const division = searchParams.get('division');

  if (!name || !name.trim()) {
    return sanitizedJson({ exists: false, similar: [], isBlocked: false }, { headers });
  }

  // ★ Include inactive players so soft-deleted users can re-register
  const allPlayers = await db.player.findMany({
    where: {
      ...(division && { division }),
    },
    select: {
      id: true,
      name: true,
      gamertag: true,
      division: true,
      city: true,
      phone: true,
      registrationStatus: true,
      isActive: true,
    },
  });

  // Also fetch tournament participations for same-tournament duplicate check
  let activeTournamentParticipations: Array<{ playerId: string; tournamentId: string; status: string }> = [];
  if (division) {
    // Check both active (accepting registration) and latest (any phase) tournaments
    const activeTournament = await findActiveTournament(division);
    const latestTournament = await findLatestTournament(division);
    const tournamentIds: string[] = [];
    if (activeTournament) tournamentIds.push(activeTournament.id);
    if (latestTournament && !tournamentIds.includes(latestTournament.id)) tournamentIds.push(latestTournament.id);
    if (tournamentIds.length > 0) {
      activeTournamentParticipations = await db.participation.findMany({
        where: { tournamentId: { in: tournamentIds } },
        select: { playerId: true, tournamentId: true, status: true },
      });
    }
  }

  const result = checkDuplicates(name, city || '', phone, division || '', allPlayers, activeTournamentParticipations);

  return sanitizedJson({
    exists: result.similarPlayers.length > 0,
    similar: result.similarPlayers,
    isBlocked: result.isBlocked,
    isHighRisk: result.isHighRisk,
    canReRegister: result.canReRegister,
    isApprovedPlayer: result.isApprovedPlayer,
    alreadyInTournament: result.alreadyInTournament,
    reRegisterPlayerId: result.reRegisterPlayerId,
    message: result.message,
  }, { headers });
}

export async function POST(request: Request) {
  try {
    // Rate limit: 5 registrations per 15 minutes per IP
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(clientIp, RATE_LIMITS.PLAYER_REGISTER);
    if (!rateLimit.allowed) {
      return sanitizedJson(
        { error: 'Terlalu banyak pendaftaran. Coba lagi dalam 15 menit.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)), ...rateLimitHeaders(rateLimit) } }
      );
    }

    const body = await request.json();

    // Validate input with Zod
    const validation = validateInput(registerSchema, body);
    if (!validation.success) {
      return sanitizedJson({ error: validation.error }, { status: 400 });
    }

    const { name, joki, phone, city, clubId, clubProfileId, division, force, reRegister, reRegisterPlayerId, isApprovedPlayer, password } = validation.data;
    // Support both clubId (legacy, Club entry ID) and clubProfileId (new, ClubProfile ID)
    // If clubId is provided (legacy), resolve it to profileId; otherwise use clubProfileId directly
    let resolvedProfileId = clubProfileId || null;
    if (!resolvedProfileId && clubId) {
      const club = await db.club.findUnique({ where: { id: clubId }, select: { profileId: true } });
      if (club) resolvedProfileId = club.profileId;
    }

    const trimmedName = name.trim();
    const trimmedCity = city.trim();
    const trimmedPhone = phone.trim();

    // ====== RE-REGISTRATION FLOW ======
    // Handles two cases:
    // 1. Approved+active player → isApprovedPlayer=true → just create participation (don't reset player)
    // 2. Rejected/inactive player → isApprovedPlayer=false → reset player data + create participation
    if (reRegister && reRegisterPlayerId) {
      const existingPlayer = await db.player.findUnique({
        where: { id: reRegisterPlayerId },
      });

      if (!existingPlayer) {
        return sanitizedJson({ error: 'Player tidak ditemukan' }, { status: 404 });
      }

      if (isApprovedPlayer) {
        // ====== APPROVED PLAYER: Daftar ulang turnamen ======
        // Just create participation, don't change player status
        if (existingPlayer.registrationStatus !== 'approved' || !existingPlayer.isActive) {
          return sanitizedJson({ error: 'Player belum disetujui. Hubungi admin.' }, { status: 400 });
        }

        // SECURITY: If player has a phone in DB, verify it matches input (prevent hijacking)
        const dbPhoneNorm = normalizePhone(existingPlayer.phone);
        const inputPhoneNorm = normalizePhone(trimmedPhone);
        if (dbPhoneNorm && inputPhoneNorm &&
            dbPhoneNorm.length >= 8 && inputPhoneNorm.length >= 8 &&
            dbPhoneNorm !== inputPhoneNorm &&
            !inputPhoneNorm.endsWith(dbPhoneNorm.slice(-8)) &&
            !dbPhoneNorm.endsWith(inputPhoneNorm.slice(-8))) {
          return sanitizedJson({
            error: `Nama "${existingPlayer.name}" sudah terdaftar dengan nomor WhatsApp yang berbeda. Jika ini akun Anda, hubungi admin. Jika bukan, gunakan nama lain.`,
          }, { status: 409 });
        }

        // If player's phone is empty, fill it in with the input phone
        if (!existingPlayer.phone && trimmedPhone) {
          await db.player.update({
            where: { id: existingPlayer.id },
            data: { phone: normalizePhone(trimmedPhone) || trimmedPhone },
          });
        }

        const { tournament, participation, error } = await createParticipationForTournament(existingPlayer.id, division);

        if (error) {
          return sanitizedJson({ error }, { status: 400 });
        }

        if (!tournament || !participation) {
          return sanitizedJson({
            success: true,
            message: 'Data Anda sudah terverifikasi. Namun tidak ada turnamen yang sedang menerima pendaftaran saat ini.',
            player: {
              id: existingPlayer.id,
              name: existingPlayer.name,
              gamertag: existingPlayer.gamertag,
              division: existingPlayer.division,
              city: existingPlayer.city,
            },
            isReRegistration: true,
            isApprovedReRegister: true,
            tournament: null,
          }, { status: 200 });
        }

        return sanitizedJson({
          success: true,
          message: `Berhasil mendaftar di ${tournament.name}! Menunggu persetujuan admin untuk menentukan tier Anda.`,
          player: {
            id: existingPlayer.id,
            name: existingPlayer.name,
            gamertag: existingPlayer.gamertag,
            division: existingPlayer.division,
            city: existingPlayer.city,
          },
          isReRegistration: true,
          isApprovedReRegister: true,
          tournament: { id: tournament.id, name: tournament.name, weekNumber: tournament.weekNumber },
          participation: { id: participation.id, status: participation.status },
        }, { status: 200 });
      } else {
        // ====== REJECTED/INACTIVE PLAYER: Full re-registration ======
        // Reset player data + create participation
        if (resolvedProfileId) {
          const profile = await db.clubProfile.findUnique({ where: { id: resolvedProfileId } });
          if (!profile) {
            return sanitizedJson({ error: 'Club tidak ditemukan' }, { status: 400 });
          }
        }

        // SECURITY: If player has a phone in DB, verify it matches input (prevent hijacking)
        // Exception: if DB phone is empty, allow fill-in
        const dbPhoneNorm = normalizePhone(existingPlayer.phone);
        const inputPhoneNorm = normalizePhone(trimmedPhone);
        if (dbPhoneNorm && inputPhoneNorm &&
            dbPhoneNorm.length >= 8 && inputPhoneNorm.length >= 8 &&
            dbPhoneNorm !== inputPhoneNorm &&
            !inputPhoneNorm.endsWith(dbPhoneNorm.slice(-8)) &&
            !dbPhoneNorm.endsWith(inputPhoneNorm.slice(-8))) {
          return sanitizedJson({
            error: `Nama "${existingPlayer.name}" sudah terdaftar dengan nomor WhatsApp yang berbeda. Jika ini akun Anda, hubungi admin. Jika bukan, gunakan nama lain.`,
          }, { status: 409 });
        }

        // Use normalized phone for storage (or existing phone if input matches it)
        const phoneToStoreForReReg = inputPhoneNorm || normalizePhone(trimmedPhone) || trimmedPhone;

        const updatedPlayer = await db.player.update({
          where: { id: reRegisterPlayerId },
          data: {
            name: trimmedName,
            city: trimmedCity,
            phone: phoneToStoreForReReg,
            joki: joki?.trim() || null,
            division,
            registrationStatus: 'pending',
            isActive: true,
            tier: 'B',
          },
        });

        // Also sign up for active tournament if exists
        const { tournament, participation, error } = await createParticipationForTournament(updatedPlayer.id, division);

        if (resolvedProfileId) {
          const existingMembership = await db.clubMember.findFirst({
            where: { playerId: updatedPlayer.id, leftAt: null },
          });
          if (existingMembership) {
            await db.clubMember.update({
              where: { id: existingMembership.id },
              data: { profileId: resolvedProfileId },
            });
          } else {
            await db.clubMember.create({
              data: { profileId: resolvedProfileId, playerId: updatedPlayer.id, role: 'member' },
            });
          }
        }

        const tournamentMsg = tournament
          ? ` Anda juga otomatis terdaftar di ${tournament.name}.`
          : '';

        if (error && tournament) {
          // Player was updated but already in tournament
          return sanitizedJson({
            success: true,
            message: `Pendaftaran berhasil!${tournamentMsg} Menunggu persetujuan admin.`,
            player: {
              id: updatedPlayer.id,
              name: updatedPlayer.name,
              gamertag: updatedPlayer.gamertag,
              division: updatedPlayer.division,
              city: updatedPlayer.city,
              registrationStatus: updatedPlayer.registrationStatus,
            },
            isReRegistration: true,
            isApprovedReRegister: false,
            tournament: { id: tournament.id, name: tournament.name },
          }, { status: 200 });
        }

        return sanitizedJson({
          success: true,
          message: tournament
            ? `Pendaftaran berhasil!${tournamentMsg} Menunggu persetujuan admin.`
            : 'Pendaftaran berhasil! Menunggu persetujuan admin.',
          player: {
            id: updatedPlayer.id,
            name: updatedPlayer.name,
            gamertag: updatedPlayer.gamertag,
            division: updatedPlayer.division,
            city: updatedPlayer.city,
            registrationStatus: updatedPlayer.registrationStatus,
          },
          isReRegistration: true,
          isApprovedReRegister: false,
          tournament: tournament ? { id: tournament.id, name: tournament.name } : null,
        }, { status: 200 });
      }
    }

    // ====== NORMAL REGISTRATION FLOW ======
    // Check if registration is open (tournament exists and accepting registrations)
    const activeTournament = await findActiveTournament(division);
    if (!activeTournament) {
      return sanitizedJson({
        error: 'Pendaftaran belum dibuka. Belum ada turnamen yang menerima pendaftaran saat ini. Hubungi admin untuk informasi lebih lanjut.',
        registrationClosed: true,
      }, { status: 400 });
    }

    // Fetch players from ALL divisions for phone duplicate check,
    // but primarily from same division for name-based checks
    const existingPlayers = await db.player.findMany({
      select: {
        id: true, name: true, gamertag: true, division: true,
        city: true, phone: true, registrationStatus: true, isActive: true,
      },
    });

    // Also fetch tournament participations for same-tournament check
    let activeTournamentParticipations: Array<{ playerId: string; tournamentId: string; status: string }> = [];
    const preCheckActive = await findActiveTournament(division);
    const preCheckLatest = await findLatestTournament(division);
    const preCheckIds: string[] = [];
    if (preCheckActive) preCheckIds.push(preCheckActive.id);
    if (preCheckLatest && !preCheckIds.includes(preCheckLatest.id)) preCheckIds.push(preCheckLatest.id);
    if (preCheckIds.length > 0) {
      activeTournamentParticipations = await db.participation.findMany({
        where: { tournamentId: { in: preCheckIds } },
        select: { playerId: true, tournamentId: true, status: true },
      });
    }

    const duplicateCheck = checkDuplicates(trimmedName, trimmedCity, trimmedPhone, division, existingPlayers, activeTournamentParticipations);

    if (duplicateCheck.isBlocked) {
      return sanitizedJson({
        blocked: true,
        error: duplicateCheck.message,
        alreadyInTournament: duplicateCheck.alreadyInTournament,
        similarPlayers: duplicateCheck.similarPlayers,
      }, { status: 409 });
    }

    // If can re-register (approved player or rejected/inactive), return the option
    if (duplicateCheck.canReRegister) {
      return sanitizedJson({
        canReRegister: true,
        isApprovedPlayer: duplicateCheck.isApprovedPlayer,
        isHighRisk: duplicateCheck.isHighRisk,
        reRegisterPlayerId: duplicateCheck.reRegisterPlayerId,
        message: duplicateCheck.message,
        similarPlayers: duplicateCheck.similarPlayers,
      }, { status: 200 });
    }

    // If similar names exist and force is not set, return warning
    if (duplicateCheck.similarPlayers.length > 0 && !force) {
      return sanitizedJson({
        warning: true,
        isHighRisk: duplicateCheck.isHighRisk,
        message: duplicateCheck.message,
        similarPlayers: duplicateCheck.similarPlayers,
      }, { status: 200 });
    }

    // ====== FINAL SAFEGUARD: Direct DB phone uniqueness check ======
    // This catches any edge cases the in-memory check might miss
    const normalizedInputPhone = normalizePhone(trimmedPhone);
    if (normalizedInputPhone && normalizedInputPhone.length >= 8) {
      // Manually check all players with phones for a match (since we need normalized comparison)
      const allPlayersWithPhone = await db.player.findMany({
        where: { phone: { not: null } },
        select: { id: true, name: true, gamertag: true, division: true, city: true, phone: true, registrationStatus: true, isActive: true },
      });

      for (const p of allPlayersWithPhone) {
        const pNorm = normalizePhone(p.phone);
        if (pNorm === normalizedInputPhone ||
          (pNorm.length >= 8 && normalizedInputPhone.length >= 8 &&
            (normalizedInputPhone.endsWith(pNorm.slice(-8)) || pNorm.endsWith(normalizedInputPhone.slice(-8)))
          )
        ) {
          // Check if this is the same person (same name) or different person
          const sameName = p.name.toLowerCase().trim() === trimmedName.toLowerCase().trim();

          if (sameName) {
            // Same name + same phone = re-registration attempt
            const existingParticipation = activeTournamentParticipations.find(tp => tp.playerId === p.id);

            if (existingParticipation) {
              return sanitizedJson({
                blocked: true,
                error: `Nomor WhatsApp ini sudah terdaftar di turnamen minggu ini atas nama "${p.name}" (status: ${existingParticipation.status}).`,
                alreadyInTournament: true,
                similarPlayers: [{
                  id: p.id, name: p.name, gamertag: p.gamertag, division: p.division,
                  city: p.city, phone: p.phone, registrationStatus: p.registrationStatus, isActive: p.isActive,
                  matchType: 'phone_match' as const,
                  matchDetails: { nameMatch: true, cityMatch: p.city.toLowerCase().trim() === trimmedCity.toLowerCase().trim(), phoneMatch: true, nameDifferent: false },
                }],
              }, { status: 409 });
            }

            if (p.registrationStatus === 'pending') {
              return sanitizedJson({
                blocked: true,
                error: `Pendaftaran diblokir! Nomor WhatsApp ini sudah dalam antrian persetujuan admin atas nama "${p.name}".`,
                alreadyInTournament: false,
                similarPlayers: [{
                  id: p.id, name: p.name, gamertag: p.gamertag, division: p.division,
                  city: p.city, phone: p.phone, registrationStatus: p.registrationStatus, isActive: p.isActive,
                  matchType: 'phone_match' as const,
                  matchDetails: { nameMatch: true, cityMatch: p.city.toLowerCase().trim() === trimmedCity.toLowerCase().trim(), phoneMatch: true, nameDifferent: false },
                }],
              }, { status: 409 });
            }

            if (p.registrationStatus === 'rejected' || !p.isActive) {
              return sanitizedJson({
                canReRegister: true,
                isApprovedPlayer: false,
                isHighRisk: false,
                reRegisterPlayerId: p.id,
                message: `Nomor WhatsApp ini sudah terdaftar dengan nama "${p.name}" tapi ditolak/nonaktif. Anda bisa mendaftar.`,
                similarPlayers: [{
                  id: p.id, name: p.name, gamertag: p.gamertag, division: p.division,
                  city: p.city, phone: p.phone, registrationStatus: p.registrationStatus, isActive: p.isActive,
                  matchType: 'phone_match' as const,
                  matchDetails: { nameMatch: true, cityMatch: p.city.toLowerCase().trim() === trimmedCity.toLowerCase().trim(), phoneMatch: true, nameDifferent: false },
                }],
              }, { status: 200 });
            }

            // Approved and active — daftar ulang
            return sanitizedJson({
              canReRegister: true,
              isApprovedPlayer: true,
              isHighRisk: false,
              reRegisterPlayerId: p.id,
              message: `Nomor WhatsApp ini sudah terdaftar atas nama "${p.name}" (nickname: "${p.gamertag}"). Klik "Daftar" untuk mendaftar di turnamen minggu ini.`,
              similarPlayers: [{
                id: p.id, name: p.name, gamertag: p.gamertag, division: p.division,
                city: p.city, phone: p.phone, registrationStatus: p.registrationStatus, isActive: p.isActive,
                matchType: 'phone_match' as const,
                matchDetails: { nameMatch: true, cityMatch: p.city.toLowerCase().trim() === trimmedCity.toLowerCase().trim(), phoneMatch: true, nameDifferent: false },
              }],
            }, { status: 200 });
          } else {
            // Different name + same phone = BLOCKED (one phone = one person)
            const existingParticipation = activeTournamentParticipations.find(tp => tp.playerId === p.id);

            if (existingParticipation) {
              return sanitizedJson({
                blocked: true,
                error: `Nomor WhatsApp ini sudah terdaftar di turnamen minggu ini atas nama "${p.name}" (status: ${existingParticipation.status}). Satu nomor WhatsApp hanya untuk satu peserta.`,
                alreadyInTournament: true,
                similarPlayers: [{
                  id: p.id, name: p.name, gamertag: p.gamertag, division: p.division,
                  city: p.city, phone: p.phone, registrationStatus: p.registrationStatus, isActive: p.isActive,
                  matchType: 'phone_match' as const,
                  matchDetails: { nameMatch: false, cityMatch: p.city.toLowerCase().trim() === trimmedCity.toLowerCase().trim(), phoneMatch: true, nameDifferent: true },
                }],
              }, { status: 409 });
            }

            if (p.registrationStatus === 'pending') {
              return sanitizedJson({
                blocked: true,
                error: `Pendaftaran diblokir! Nomor WhatsApp ini sudah dalam antrian persetujuan admin atas nama "${p.name}". Satu nomor WhatsApp hanya untuk satu peserta.`,
                alreadyInTournament: false,
                similarPlayers: [{
                  id: p.id, name: p.name, gamertag: p.gamertag, division: p.division,
                  city: p.city, phone: p.phone, registrationStatus: p.registrationStatus, isActive: p.isActive,
                  matchType: 'phone_match' as const,
                  matchDetails: { nameMatch: false, cityMatch: p.city.toLowerCase().trim() === trimmedCity.toLowerCase().trim(), phoneMatch: true, nameDifferent: true },
                }],
              }, { status: 409 });
            }

            // Any active/approved/rejected — all blocked if name is different
            return sanitizedJson({
              blocked: true,
              error: `Nomor WhatsApp ini sudah terdaftar atas nama "${p.name}" (nickname: "${p.gamertag}"). Satu nomor WhatsApp hanya untuk satu peserta. Hubungi admin jika ada kendala.`,
              alreadyInTournament: false,
              similarPlayers: [{
                id: p.id, name: p.name, gamertag: p.gamertag, division: p.division,
                city: p.city, phone: p.phone, registrationStatus: p.registrationStatus, isActive: p.isActive,
                matchType: 'phone_match' as const,
                matchDetails: { nameMatch: false, cityMatch: p.city.toLowerCase().trim() === trimmedCity.toLowerCase().trim(), phoneMatch: true, nameDifferent: true },
              }],
            }, { status: 409 });
          }
        }
      }
    }

    // Generate unique gamertag from name
    const baseTag = trimmedName.replace(/\s+/g, '');
    let gamertag = baseTag;
    let counter = 1;

    while (true) {
      const existing = await db.player.findUnique({ where: { gamertag } });
      if (!existing) break;
      counter++;
      gamertag = `${baseTag}${counter}`;
    }

    if (resolvedProfileId) {
      const profile = await db.clubProfile.findUnique({ where: { id: resolvedProfileId } });
      if (!profile) {
        return sanitizedJson({ error: 'Club tidak ditemukan' }, { status: 400 });
      }
    }

    // Normalize phone before storing (ensure consistent format)
    const phoneToStore = normalizePhone(trimmedPhone) || trimmedPhone;

    // Create player with pending registration status
    const player = await db.player.create({
      data: {
        name: trimmedName,
        gamertag,
        division,
        tier: 'B',
        city: trimmedCity,
        joki: joki?.trim() || null,
        phone: phoneToStore,
        registrationStatus: 'pending',
        isActive: true,
      },
    });

    // Also auto-sign up for active tournament if exists
    const { tournament, participation, error: tournamentError } = await createParticipationForTournament(player.id, division);

    if (resolvedProfileId) {
      await db.clubMember.create({
        data: { profileId: resolvedProfileId, playerId: player.id, role: 'member' },
      });
    }

    // ====== UNIFIED REGISTRATION: Create Account if password provided ======
    let accountCreated = false;
    if (password) {
      // Check if player already has an account
      const existingAccount = await db.account.findUnique({
        where: { playerId: player.id },
      });
      if (!existingAccount) {
        const passwordHash = await hashPassword(password);
        const account = await db.account.create({
          data: {
            playerId: player.id,
            username: player.gamertag,
            passwordHash,
            phone: player.phone,
          },
        });
        accountCreated = true;

        // Set session cookie for auto-login
        const token = createPlayerSessionToken(account.id, account.playerId);
        const sanitizedData = sanitizeResponse({
          success: true,
          message: tournament
            ? `Pendaftaran berhasil! Anda juga otomatis terdaftar di ${tournament.name}. Menunggu persetujuan admin.`
            : 'Pendaftaran berhasil! Menunggu persetujuan admin.',
          player: {
            id: player.id,
            name: player.name,
            gamertag: player.gamertag,
            division: player.division,
            city: player.city,
            registrationStatus: player.registrationStatus,
          },
          tournament: tournament ? { id: tournament.id, name: tournament.name } : null,
          accountCreated: true,
        });
        const response = NextResponse.json(sanitizedData, { status: 201 });
        response.cookies.set('idm-player-session', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60,
          path: '/',
        });
        return response;
      }
    }

    return sanitizedJson({
      success: true,
      message: tournament
        ? `Pendaftaran berhasil! Anda juga otomatis terdaftar di ${tournament.name}. Menunggu persetujuan admin.`
        : 'Pendaftaran berhasil! Menunggu persetujuan admin.',
      player: {
        id: player.id,
        name: player.name,
        gamertag: player.gamertag,
        division: player.division,
        city: player.city,
        registrationStatus: player.registrationStatus,
      },
      tournament: tournament ? { id: tournament.id, name: tournament.name } : null,
      accountCreated,
    }, { status: 201 });
  } catch (e: unknown) {
    const error = e as Error;
    console.error('Registration error:', error);
    return sanitizedJson({ error: 'Gagal mendaftar. Silakan coba lagi.' }, { status: 500 });
  }
}
