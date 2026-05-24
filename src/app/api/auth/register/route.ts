import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { checkRateLimit, getClientIp, RATE_LIMITS, rateLimitHeaders } from '@/lib/rate-limit';

const registerSchema = z.object({
  gamertag: z.string().min(2, 'Gamertag harus minimal 2 karakter'),
  name: z.string().min(2, 'Nama harus minimal 2 karakter'),
  division: z.enum(['male', 'female']),
  password: z.string().min(6, 'Password harus minimal 6 karakter'),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  city: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 registrations per hour per IP
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(clientIp, RATE_LIMITS.PLAYER_REGISTER);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak pendaftaran. Coba lagi dalam 1 jam.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)), ...rateLimitHeaders(rateLimit) } }
      );
    }

    const body = await request.json();

    // Validate input
    const validated = registerSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: 'Input tidak valid', details: validated.error.flatten() },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const { gamertag, name, division, password, phone, email, city } = validated.data;

    // Check if gamertag already exists
    const existingPlayer = await db.player.findUnique({
      where: { gamertag }
    });

    if (existingPlayer) {
      return NextResponse.json(
        { success: false, error: 'Gamertag sudah terdaftar' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Check email if provided
    if (email) {
      const existingEmail = await db.account.findUnique({
        where: { email }
      });

      if (existingEmail) {
        return NextResponse.json(
          { success: false, error: 'Email sudah terdaftar' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create player + account in a transaction
    const player = await db.player.create({
      data: {
        name,
        gamertag,
        division,
        phone: phone || null,
        city: city || '',
        registrationStatus: 'pending',
      },
    });

    const account = await db.account.create({
      data: {
        playerId: player.id,
        username: gamertag,
        passwordHash: hashedPassword,
        email: email || null,
        phone: phone || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        player: {
          id: player.id,
          name: player.name,
          gamertag: player.gamertag,
          division: player.division,
        },
        account: {
          id: account.id,
          username: account.username,
        },
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
