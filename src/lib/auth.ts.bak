import crypto from 'crypto';
import { db } from './db';

// Force recompile - debug token issue
const SESSION_SECRET = process.env.SESSION_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    console.warn('⚠ SECURITY: Using default SESSION_SECRET in production! Set SESSION_SECRET env variable.');
  }
  return 'idm-league-secret-key-change-in-production';
})();

// Password utilities using Node.js crypto (replaces bcryptjs for Turbopack compatibility)
function hashPasswordSync(password: string, salt: string): string {
  const key = crypto.scryptSync(password, salt, 64);
  return salt + ':' + key.toString('hex');
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  return hashPasswordSync(password, salt);
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  // Support both old bcrypt hashes and new scrypt hashes
  if (storedHash.startsWith('$2')) {
    // Legacy bcrypt hash - use simple comparison as fallback
    // In production, you should migrate these hashes
    try {
      const bcrypt = await import('bcryptjs');
      return bcrypt.compare(password, storedHash);
    } catch {
      return false;
    }
  }
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const key = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), key);
}

// Session token utilities using HMAC signing
export function createSessionToken(adminId: string, role: string): string {
  const payload = `${adminId}:${role}:${Date.now()}`;
  const signature = sign(payload);
  return `${payload}:${signature}`;
}

export function verifySessionToken(token: string): { adminId: string; role: string } | null {
  try {
    console.log('verifySessionToken: Token received:', token?.substring(0, 50) + '...');
    const parts = token.split(':');
    console.log('verifySessionToken: Parts count:', parts.length);
    if (parts.length !== 4) {
      console.log('verifySessionToken: Invalid parts length, expected 4');
      return null;
    }
    const [adminId, role, timestamp, signature] = parts;
    const payload = `${adminId}:${role}:${timestamp}`;
    const expectedSignature = sign(payload);
    console.log('verifySessionToken: Signature check:', { provided: signature, expected: expectedSignature, match: signature === expectedSignature });
    if (signature !== expectedSignature) {
      console.log('verifySessionToken: Signature mismatch!');
      return null;
    }

    // Check token age (7 days max)
    const tokenAge = Date.now() - parseInt(timestamp);
    const maxAge = 7 * 24 * 60 * 60 * 1000;
    console.log('verifySessionToken: Token age:', tokenAge, 'ms, max:', maxAge, 'ms, expired:', tokenAge > maxAge);
    if (tokenAge > maxAge) return null;

    console.log('verifySessionToken: SUCCESS for adminId:', adminId);
    return { adminId, role };
  } catch (error) {
    console.error('verifySessionToken error:', error);
    return null;
  }
}

function sign(data: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('hex').slice(0, 32);
}

// Database operations
export async function getAdminByUsername(username: string) {
  return db.admin.findUnique({ where: { username } });
}

export async function getAdminById(id: string) {
  return db.admin.findUnique({ where: { id } });
}

export async function createAdmin(username: string, password: string, role: string = 'admin') {
  const passwordHash = await hashPassword(password);
  return db.admin.create({
    data: { username, passwordHash, role },
  });
}

export async function authenticateAdmin(username: string, password: string) {
  const admin = await getAdminByUsername(username);
  if (!admin) return null;

  const isValid = await verifyPassword(password, admin.passwordHash);
  if (!isValid) return null;

  return { id: admin.id, username: admin.username, role: admin.role };
}

// Cookie-based session parsing
const SESSION_COOKIE_NAME = 'idm-admin-session';

export function getSessionFromCookies(cookieHeader: string | null): { username: string; role: string } | null {
  if (!cookieHeader) return null;

  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [key, ...val] = c.trim().split('=');
      return [key, val.join('=')];
    })
  );

  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;

  const decodedToken = decodeURIComponent(token);
  const result = verifySessionToken(decodedToken);
  if (!result) return null;

  // Return username and role from the token (adminId is used as identifier)
  return { username: result.adminId, role: result.role };
}
