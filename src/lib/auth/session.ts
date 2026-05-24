/**
 * Session management module
 * 
 * This app uses cookie-based HMAC-signed session tokens, NOT database sessions.
 * Admin sessions: idm-admin-session cookie
 * Player sessions: idm-player-session cookie
 * 
 * The functions below are kept as stubs for API compatibility.
 * Actual session logic is in @/lib/auth/index.ts (verifySessionToken, verifyPlayerSessionToken)
 */

import { cookies } from 'next/headers'
import { verifySessionToken, verifyPlayerSessionToken, getAdminById } from './index'
import { db } from '@/lib/db'

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

/**
 * Get the current admin session token from cookies
 */
export async function getAdminSessionToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get('idm-admin-session')?.value || null
}

/**
 * Get the current player session token from cookies
 */
export async function getPlayerSessionToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get('idm-player-session')?.value || null
}

/**
 * Get the current admin from session
 */
export async function getCurrentAdmin(): Promise<{ id: string; username: string; role: string } | null> {
  const token = await getAdminSessionToken()
  if (!token) return null
  
  const session = verifySessionToken(token)
  if (!session) return null
  
  const admin = await getAdminById(session.adminId)
  if (!admin) return null
  
  return { id: admin.id, username: admin.username, role: admin.role }
}

/**
 * Get the current player from session
 */
export async function getCurrentPlayer(): Promise<{ id: string; gamertag: string; division: string } | null> {
  const token = await getPlayerSessionToken()
  if (!token) return null
  
  const session = verifyPlayerSessionToken(token)
  if (!session) return null
  
  const account = await db.account.findUnique({
    where: { id: session.accountId },
    include: { player: true },
  })
  
  if (!account?.player) return null
  
  return { id: account.player.id, gamertag: account.player.gamertag, division: account.player.division }
}

// Stubs for compatibility — these do nothing since we use cookie-based sessions
export const generateToken = () => ''
export const createSession = async () => ''
export const validateSession = async () => null
export const destroySession = async () => {}
export const getSessionToken = getAdminSessionToken
export const setSessionCookie = async () => {}
export const clearSessionCookie = async () => {}
export const refreshSession = async () => true
export const cleanupExpiredSessions = async () => 0
export const deleteAllUserSessions = async () => 0
export const getUserSessions = async () => []
