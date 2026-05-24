/**
 * WA Bot Status API
 * GET /api/wa-bot
 *
 * Proxies status info from the WA bot mini-service (port 3004)
 * Falls back to "not running" if bot is offline
 */

import { NextRequest, NextResponse } from 'next/server'
import http from 'http'

// Helper: fetch using Node.js http module (avoids Next.js fetch caching issues)
function httpGet(url: string): Promise<{ ok: boolean; status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 5000 }, (res) => {
      let data = ''
      res.on('data', (chunk) => data += chunk)
      res.on('end', () => {
        try {
          resolve({ ok: res.statusCode === 200, status: res.statusCode || 0, data: JSON.parse(data) })
        } catch {
          resolve({ ok: false, status: res.statusCode || 0, data: null })
        }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
  })
}

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
  // Try direct connection to WA bot mini-service
  try {
    const result = await httpGet('http://127.0.0.1:3004/status')

    if (result.ok) {
      return NextResponse.json(result.data)
    }
  } catch {}

  // Fallback: try health endpoint
  try {
    const result = await httpGet('http://127.0.0.1:3004/health')

    if (result.ok) {
      // Bot is alive but /status might not work yet
      return NextResponse.json({
        ...result.data,
        waStatus: 'connecting',
        message: 'WA Bot service is starting up...',
      })
    }
  } catch {}

  return NextResponse.json({
    service: 'idm-wa-bot',
    waStatus: 'offline',
    message: 'WA Bot service is not running. Start it with: cd mini-services/wa-bot && bun run dev',
    commands: [
      { cmd: 'p help', desc: 'Bantuan & daftar command', usage: 'p help' },
      { cmd: 'p daftar', desc: 'Daftar peserta turnamen', usage: 'p daftar <nickname> <M/F> [nama] [club]' },
      { cmd: 'p info', desc: 'Cek status registrasi', usage: 'p info' },
      { cmd: 'p batal', desc: 'Batalkan registrasi', usage: 'p batal' },
      { cmd: 'p ranking', desc: 'Top 10 leaderboard', usage: 'p ranking [M/F]' },
      { cmd: 'p status', desc: 'Cek stats pemain', usage: 'p status [nickname]' },
      { cmd: 'p recap', desc: 'Recap turnamen', usage: 'p recap [M/F]' },
      { cmd: 'p next', desc: 'Match selanjutnya', usage: 'p next [nickname]' },
      { cmd: 'p live', desc: 'Match sedang berlangsung', usage: 'p live [M/F]' },
      { cmd: 'p botinfo', desc: 'Info bot', usage: 'p botinfo' },
      { cmd: 'p result', desc: 'Admin: Input hasil match', usage: 'p result <matchId> <skor1>-<skor2>' },
      { cmd: 'p mvp', desc: 'Admin: Set MVP', usage: 'p mvp <matchId> <nickname>' },
      { cmd: 'p start', desc: 'Admin: Mulai turnamen', usage: 'p start <tournamentId>' },
      { cmd: 'p end', desc: 'Admin: Akhiri turnamen', usage: 'p end <tournamentId>' },
      { cmd: 'p broadcast', desc: 'Admin: Broadcast pesan', usage: 'p broadcast <pesan>' },
      { cmd: 'p ban', desc: 'Admin: Ban player', usage: 'p ban <gamertag>' },
      { cmd: 'p unban', desc: 'Admin: Unban player', usage: 'p unban <gamertag>' },
      { cmd: 'p cekgrup', desc: 'Admin: Info grup', usage: 'p cekgrup' },
    ],
  }, { status: 503 })
}
