import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, createPlayerSessionToken } from '@/lib/auth';
import { checkRateLimit, getClientIp, RATE_LIMITS, rateLimitHeaders } from '@/lib/rate-limit';
import { createPlayerAuditLog } from '@/lib/audit';

const PLAYER_SESSION_COOKIE = 'idm-player-session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

/**
 * Normalize Indonesian phone numbers to local format (08xx).
 * +62812... or 62812... → 0812...
 */
function normalizePhone(phone: string | null): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('62') && digits.length >= 10) {
    digits = '0' + digits.slice(2);
  }
  return digits;
}

/**
 * Check if two phone numbers match (considering normalization and last-8-digit suffix matching).
 */
function phonesMatch(phone1: string, phone2: string): boolean {
  const norm1 = normalizePhone(phone1);
  const norm2 = normalizePhone(phone2);
  if (!norm1 || !norm2) return false;
  if (norm1 === norm2) return true;
  if (norm1.length >= 8 && norm2.length >= 8) {
    if (norm1.endsWith(norm2.slice(-8)) || norm2.endsWith(norm1.slice(-8))) return true;
  }
  return false;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 registrations per hour per IP
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(clientIp, RATE_LIMITS.PLAYER_REGISTER);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Terlalu banyak pendaftaran. Coba lagi dalam 1 jam.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)), ...rateLimitHeaders(rateLimit) } }
      );
    }

    const body = await request.json();
    const { isFullRegistration } = body;

    // ============================================================
    // FULL REGISTRATION FLOW — Create Player + Account together
    // ============================================================
    if (isFullRegistration) {
      const { name, phone, city, division, password, joki, clubProfileId, email } = body;

      // 1. Validate all required fields
      if (!name || !name.trim()) {
        return NextResponse.json(
          { error: 'Nama harus diisi' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      if (!phone || !phone.trim()) {
        return NextResponse.json(
          { error: 'Nomor WhatsApp harus diisi' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      if (!city || !city.trim()) {
        return NextResponse.json(
          { error: 'Kota harus diisi' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      if (!division) {
        return NextResponse.json(
          { error: 'Divisi harus diisi' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      if (division !== 'male' && division !== 'female') {
        return NextResponse.json(
          { error: 'Divisi harus "male" atau "female"' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      if (!password) {
        return NextResponse.json(
          { error: 'Password harus diisi' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      if (password.length < 6) {
        return NextResponse.json(
          { error: 'Password minimal 6 karakter' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      // 2. Normalize phone number
      const normalizedPhone = normalizePhone(phone.trim());
      if (!normalizedPhone || normalizedPhone.length < 10) {
        return NextResponse.json(
          { error: 'Nomor WhatsApp tidak valid' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      const trimmedName = name.trim();
      const trimmedCity = city.trim();

      // 3. Check if WhatsApp number already exists in Player table
      //    Check both `phone` field and `waNumber` field
      const existingPlayerByPhone = await db.player.findFirst({
        where: {
          OR: [
            { phone: normalizedPhone },
            { waNumber: normalizedPhone },
          ],
        },
      });

      if (existingPlayerByPhone) {
        // Phone is already used — check if it's the same person (name matches)
        const samePerson = existingPlayerByPhone.name.toLowerCase().trim() === trimmedName.toLowerCase().trim();

        if (samePerson) {
          // Same person — reactivate if inactive, then create Account
          // ★ If player was soft-deleted (isActive: false), reactivate them first
          if (!existingPlayerByPhone.isActive) {
            await db.player.update({
              where: { id: existingPlayerByPhone.id },
              data: {
                isActive: true,
                registrationStatus: 'pending',
                name: trimmedName,
                city: trimmedCity,
                phone: normalizedPhone,
                waNumber: normalizedPhone,
                division,
              },
            });
          }

          // Check if player already has an account
          const existingAccount = await db.account.findUnique({
            where: { playerId: existingPlayerByPhone.id },
          });

          if (existingAccount) {
            // ★ If they already have an account but player was inactive, just reactivate and let them login
            return NextResponse.json(
              { error: 'Pemain ini sudah memiliki akun. Silakan login dengan nickname dan password Anda.' },
              { status: 409, headers: { 'Cache-Control': 'no-store' } }
            );
          }

          // Check if username (gamertag) is taken as account username
          const existingUsername = await db.account.findUnique({
            where: { username: existingPlayerByPhone.gamertag },
          });

          if (existingUsername) {
            return NextResponse.json(
              { error: 'Username sudah digunakan. Hubungi admin.' },
              { status: 409, headers: { 'Cache-Control': 'no-store' } }
            );
          }

          // Check email uniqueness if provided
          if (email) {
            const existingEmail = await db.account.findUnique({
              where: { email },
            });
            if (existingEmail) {
              return NextResponse.json(
                { error: 'Email sudah terdaftar.' },
                { status: 409, headers: { 'Cache-Control': 'no-store' } }
              );
            }
          }

          // Create account for the existing player
          const passwordHash = await hashPassword(password);
          const account = await db.account.create({
            data: {
              playerId: existingPlayerByPhone.id,
              username: existingPlayerByPhone.gamertag,
              passwordHash,
              email: email || null,
              phone: normalizedPhone,
            },
            include: {
              player: {
                select: {
                  id: true,
                  gamertag: true,
                  name: true,
                  division: true,
                  tier: true,
                  avatar: true,
                  points: true,
                  totalWins: true,
                  totalMvp: true,
                  matches: true,
                  streak: true,
                  city: true,
                  registrationStatus: true,
                },
              },
            },
          });

          // Auto-login: create player session token and set cookie
          const token = createPlayerSessionToken(account.id, account.playerId);

          const isPending = account.player.registrationStatus === 'pending';
          const response = NextResponse.json({
            success: true,
            message: isPending
              ? 'Akun berhasil dibuat! Pendaftaran Anda sedang menunggu persetujuan admin.'
              : 'Akun berhasil dibuat!',
            account: {
              id: account.id,
              username: account.username,
              skins: [],
              player: account.player,
            },
            isPendingApproval: isPending,
          }, { status: 201, headers: { 'Cache-Control': 'no-store' } });

          response.cookies.set(PLAYER_SESSION_COOKIE, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: SESSION_MAX_AGE,
            path: '/',
          });

          // ★ Audit log: player register (account for existing player)
          void createPlayerAuditLog({
            playerId: existingPlayerByPhone.id,
            playerName: existingPlayerByPhone.gamertag,
            action: 'register',
            entity: 'player_auth',
            details: `Account registration for existing player: ${existingPlayerByPhone.gamertag}`,
          });

          return response;
        } else {
          // Different person — phone conflict
          return NextResponse.json(
            { error: 'Nomor WhatsApp sudah digunakan' },
            { status: 409, headers: { 'Cache-Control': 'no-store' } }
          );
        }
      }

      // Also check phones with suffix matching for existing players
      const allPlayersWithPhone = await db.player.findMany({
        where: {
          OR: [
            { phone: { not: null } },
            { waNumber: { not: null } },
          ],
        },
        select: {
          id: true,
          name: true,
          gamertag: true,
          phone: true,
          waNumber: true,
        },
      });

      for (const p of allPlayersWithPhone) {
        const pNorm = normalizePhone(p.phone) || normalizePhone(p.waNumber);
        if (pNorm && phonesMatch(normalizedPhone, pNorm)) {
          // Found a phone match — check if same person
          const samePerson = p.name.toLowerCase().trim() === trimmedName.toLowerCase().trim();
          if (!samePerson) {
            return NextResponse.json(
              { error: 'Nomor WhatsApp sudah digunakan' },
              { status: 409, headers: { 'Cache-Control': 'no-store' } }
            );
          }
          // If same person, they would have been caught by the query above already
          // (since we check by phone field), but handle just in case
          const existingAccount = await db.account.findUnique({
            where: { playerId: p.id },
          });

          if (existingAccount) {
            return NextResponse.json(
              { error: 'Pemain ini sudah memiliki akun. Silakan login.' },
              { status: 409, headers: { 'Cache-Control': 'no-store' } }
            );
          }

          // Fall through — this same-name player will be handled by the gamertag check below
          break;
        }
      }

      // 4. Check if gamertag (name) already exists
      const existingPlayerByGamertag = await db.player.findUnique({
        where: { gamertag: trimmedName },
      });

      if (existingPlayerByGamertag) {
        // Check if it's the same person (phone matches)
        const dbPhoneNorm = normalizePhone(existingPlayerByGamertag.phone) || normalizePhone(existingPlayerByGamertag.waNumber);
        const phoneMatches = dbPhoneNorm && phonesMatch(normalizedPhone, dbPhoneNorm);

        if (phoneMatches) {
          // Same person — reactivate if inactive, then create Account
          // ★ If player was soft-deleted (isActive: false), reactivate them first
          if (!existingPlayerByGamertag.isActive) {
            await db.player.update({
              where: { id: existingPlayerByGamertag.id },
              data: {
                isActive: true,
                registrationStatus: 'pending',
                name: trimmedName,
                city: trimmedCity,
                phone: normalizedPhone,
                waNumber: normalizedPhone,
                division,
              },
            });
          }

          // Check if player already has an account
          const existingAccount = await db.account.findUnique({
            where: { playerId: existingPlayerByGamertag.id },
          });

          if (existingAccount) {
            return NextResponse.json(
              { error: 'Pemain ini sudah memiliki akun. Silakan login dengan nickname dan password Anda.' },
              { status: 409, headers: { 'Cache-Control': 'no-store' } }
            );
          }

          // Check if username is taken as account username
          const existingUsername = await db.account.findUnique({
            where: { username: existingPlayerByGamertag.gamertag },
          });

          if (existingUsername) {
            return NextResponse.json(
              { error: 'Username sudah digunakan. Hubungi admin.' },
              { status: 409, headers: { 'Cache-Control': 'no-store' } }
            );
          }

          // Check email uniqueness if provided
          if (email) {
            const existingEmail = await db.account.findUnique({
              where: { email },
            });
            if (existingEmail) {
              return NextResponse.json(
                { error: 'Email sudah terdaftar.' },
                { status: 409, headers: { 'Cache-Control': 'no-store' } }
              );
            }
          }

          // Create account for the existing player
          const passwordHash = await hashPassword(password);
          const account = await db.account.create({
            data: {
              playerId: existingPlayerByGamertag.id,
              username: existingPlayerByGamertag.gamertag,
              passwordHash,
              email: email || null,
              phone: normalizedPhone,
            },
            include: {
              player: {
                select: {
                  id: true,
                  gamertag: true,
                  name: true,
                  division: true,
                  tier: true,
                  avatar: true,
                  points: true,
                  totalWins: true,
                  totalMvp: true,
                  matches: true,
                  streak: true,
                  city: true,
                  registrationStatus: true,
                },
              },
            },
          });

          const token = createPlayerSessionToken(account.id, account.playerId);

          const isPending = account.player.registrationStatus === 'pending';
          const response = NextResponse.json({
            success: true,
            message: isPending
              ? 'Akun berhasil dibuat! Pendaftaran Anda sedang menunggu persetujuan admin.'
              : 'Akun berhasil dibuat!',
            account: {
              id: account.id,
              username: account.username,
              skins: [],
              player: account.player,
            },
            isPendingApproval: isPending,
          }, { status: 201, headers: { 'Cache-Control': 'no-store' } });

          response.cookies.set(PLAYER_SESSION_COOKIE, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: SESSION_MAX_AGE,
            path: '/',
          });

          // ★ Audit log: player register (account for existing gamertag match)
          void createPlayerAuditLog({
            playerId: existingPlayerByGamertag.id,
            playerName: existingPlayerByGamertag.gamertag,
            action: 'register',
            entity: 'player_auth',
            details: `Account registration for existing player (gamertag match): ${existingPlayerByGamertag.gamertag}`,
          });

          return response;
        } else {
          // Different person with same gamertag — conflict
          return NextResponse.json(
            { error: `Nickname "${trimmedName}" sudah digunakan oleh pemain lain. Gunakan nama lain.` },
            { status: 409, headers: { 'Cache-Control': 'no-store' } }
          );
        }
      }

      // Check email uniqueness if provided
      if (email) {
        const existingEmail = await db.account.findUnique({
          where: { email },
        });
        if (existingEmail) {
          return NextResponse.json(
            { error: 'Email sudah terdaftar.' },
            { status: 409, headers: { 'Cache-Control': 'no-store' } }
          );
        }
      }

      // Check if username (gamertag) is taken as account username
      const existingUsername = await db.account.findUnique({
        where: { username: trimmedName },
      });

      if (existingUsername) {
        return NextResponse.json(
          { error: 'Username sudah digunakan. Hubungi admin.' },
          { status: 409, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      // 5. Create Player with pending registration status
      const player = await db.player.create({
        data: {
          name: trimmedName,
          gamertag: trimmedName,
          division,
          phone: normalizedPhone,
          waNumber: normalizedPhone,
          city: trimmedCity,
          joki: joki?.trim() || null,
          tier: 'B',
          registrationStatus: 'pending',
          isActive: true,
        },
      });

      // 6. Create Account linked to the new Player
      const passwordHash = await hashPassword(password);
      const account = await db.account.create({
        data: {
          playerId: player.id,
          username: player.gamertag,
          passwordHash,
          email: email || null,
          phone: normalizedPhone,
        },
        include: {
          player: {
            select: {
              id: true,
              gamertag: true,
              name: true,
              division: true,
              tier: true,
              avatar: true,
              points: true,
              totalWins: true,
              totalMvp: true,
              matches: true,
              streak: true,
              city: true,
              registrationStatus: true,
            },
          },
        },
      });

      // 7. If clubProfileId is provided, create ClubMember
      if (clubProfileId) {
        const profile = await db.clubProfile.findUnique({
          where: { id: clubProfileId },
        });

        if (profile) {
          await db.clubMember.create({
            data: {
              profileId: clubProfileId,
              playerId: player.id,
              role: 'member',
            },
          });
        }
      }

      // 8. Set player session cookie (auto-login)
      const token = createPlayerSessionToken(account.id, account.playerId);

      const response = NextResponse.json({
        success: true,
        message: 'Pendaftaran berhasil! Akun Anda sedang menunggu persetujuan admin sebelum bisa tampil di leaderboard.',
        account: {
          id: account.id,
          username: account.username,
          skins: [],
          player: account.player,
        },
        isPendingApproval: true,
      }, { status: 201, headers: { 'Cache-Control': 'no-store' } });

      response.cookies.set(PLAYER_SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_MAX_AGE,
        path: '/',
      });

      // ★ Audit log: new player full registration
      void createPlayerAuditLog({
        playerId: player.id,
        playerName: player.gamertag,
        action: 'register',
        entity: 'player_auth',
        details: `New player registration: ${player.gamertag} (${division})`,
      });

      return response;
    }

    // ============================================================
    // EXISTING FLOW — Create Account for an EXISTING Player
    // ============================================================
    const { gamertag, password, email, phone } = body;

    if (!gamertag || !password) {
      return NextResponse.json(
        { error: 'Nickname dan password harus diisi' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password minimal 6 karakter' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Find the player by gamertag
    const player = await db.player.findUnique({
      where: { gamertag },
    });

    if (!player) {
      return NextResponse.json(
        { error: 'Nickname tidak ditemukan. Pastikan kamu sudah terdaftar sebagai pemain.' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Check if player already has an account
    const existingAccount = await db.account.findUnique({
      where: { playerId: player.id },
    });

    if (existingAccount) {
      return NextResponse.json(
        { error: 'Pemain ini sudah memiliki akun. Silakan login.' },
        { status: 409, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Check if username (gamertag) is taken as account username
    const existingUsername = await db.account.findUnique({
      where: { username: gamertag },
    });

    if (existingUsername) {
      return NextResponse.json(
        { error: 'Username sudah digunakan. Hubungi admin.' },
        { status: 409, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Check email uniqueness if provided
    if (email) {
      const existingEmail = await db.account.findUnique({
        where: { email },
      });
      if (existingEmail) {
        return NextResponse.json(
          { error: 'Email sudah terdaftar.' },
          { status: 409, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    }

    // Create the account
    const passwordHash = await hashPassword(password);
    const account = await db.account.create({
      data: {
        playerId: player.id,
        username: gamertag,
        passwordHash,
        email: email || null,
        phone: phone || player.phone || null,
      },
      include: {
        player: {
          select: {
            id: true,
            gamertag: true,
            name: true,
            division: true,
            tier: true,
            avatar: true,
            points: true,
            totalWins: true,
            totalMvp: true,
            matches: true,
            streak: true,
            city: true,
          },
        },
      },
    });

    // Auto-login: create player session token and set cookie
    const token = createPlayerSessionToken(account.id, account.playerId);

    const response = NextResponse.json({
      success: true,
      message: 'Akun berhasil dibuat!',
      account: {
        id: account.id,
        username: account.username,
        skins: [], // New accounts have no skins
        player: account.player,
      },
    }, { status: 201, headers: { 'Cache-Control': 'no-store' } });

    // Set httpOnly cookie for player session (auto-login)
    response.cookies.set(PLAYER_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE,
      path: '/',
    });

    // ★ Audit log: existing player account registration
    void createPlayerAuditLog({
      playerId: player.id,
      playerName: player.gamertag,
      action: 'register',
      entity: 'player_auth',
      details: `Account registration for existing player: ${player.gamertag}`,
    });

    return response;
  } catch (error) {
    console.error('Account registration error:', error);

    // Handle Prisma unique constraint violations
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as { code: string; meta?: { target?: string[] } };
      if (prismaError.code === 'P2002') {
        const target = prismaError.meta?.target?.[0];
        if (target === 'waNumber') {
          return NextResponse.json(
            { error: 'Nomor WhatsApp sudah digunakan' },
            { status: 409, headers: { 'Cache-Control': 'no-store' } }
          );
        }
        if (target === 'gamertag') {
          return NextResponse.json(
            { error: 'Nickname sudah digunakan' },
            { status: 409, headers: { 'Cache-Control': 'no-store' } }
          );
        }
        return NextResponse.json(
          { error: 'Data sudah digunakan' },
          { status: 409, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    }

    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
