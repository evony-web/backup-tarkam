import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Division } from "@/lib/store"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Deterministic hash from string for procedural generation
 */
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Cloudinary base URL for fallback images
 */
const CLOUDINARY_BASE = 'https://res.cloudinary.com/dagoryri5/image/upload';

/**
 * Get avatar URL - uses database avatar if available, otherwise Cloudinary fallback
 * Returns a Cloudinary URL as fallback (e.g. idm/fallback/avatars/avatar-male-1)
 */
export function getAvatarUrl(gamertag: string, division: 'male' | 'female', dbAvatar?: string | null): string {
  // Priority: 1) Database avatar field, 2) Cloudinary fallback
  if (dbAvatar) return dbAvatar;
  const index = (hashString(gamertag) % 3) + 1;
  // Return clean URL without transforms — let the Cloudinary loader inject correct width at render time
  return `${CLOUDINARY_BASE}/idm/fallback/avatars/avatar-${division}-${index}`;
}

/**
 * Club logo mapping — returns Cloudinary URL for AI-generated club logo image
 * Falls back to a generic club logo if name not found
 */
const CLUB_LOGO_MAP: Record<string, string> = {
  'Neon Blaze': `${CLOUDINARY_BASE}/idm/fallback/clubs/neon-blaze`,
  'Phantom Step': `${CLOUDINARY_BASE}/idm/fallback/clubs/phantom-step`,
  'Rhythm Force': `${CLOUDINARY_BASE}/idm/fallback/clubs/rhythm-force`,
  'Crystal Wave': `${CLOUDINARY_BASE}/idm/fallback/clubs/crystal-wave`,
  'Shadow Dance': `${CLOUDINARY_BASE}/idm/fallback/clubs/shadow-dance`,
  'Thunder Beat': `${CLOUDINARY_BASE}/idm/fallback/clubs/thunder-beat`,
  'Velvet Groove': `${CLOUDINARY_BASE}/idm/fallback/clubs/velvet-groove`,
  'Star Rise': `${CLOUDINARY_BASE}/idm/fallback/clubs/star-rise`,
  'Lunar Flow': `${CLOUDINARY_BASE}/idm/fallback/clubs/lunar-flow`,
  // Winner teams from demo data
  'Team Rhythm': `${CLOUDINARY_BASE}/idm/fallback/clubs/rhythm-force`,
  'Team Flow': `${CLOUDINARY_BASE}/idm/fallback/clubs/lunar-flow`,
  'Team Grace': `${CLOUDINARY_BASE}/idm/fallback/clubs/crystal-wave`,
  'Team Velvet': `${CLOUDINARY_BASE}/idm/fallback/clubs/velvet-groove`,
};

export function getClubLogoUrl(clubName: string, dbLogo?: string | null): string {
  // Priority: 1) Database logo field, 2) Mapping, 3) Cloudinary fallback
  if (dbLogo) return dbLogo;
  return CLUB_LOGO_MAP[clubName] || `${CLOUDINARY_BASE}/idm/fallback/clubs/neon-blaze`;
}

/**
 * Get tier-based avatar URL (Cloudinary) — used by dashboard components
 * Returns a Cloudinary URL for tier-based fallback avatars
 * @param division - "male" or "female"
 * @param tier - "S", "A", or "B"
 */
export function getTierAvatarUrl(division: 'male' | 'female', tier: string): string {
  const tierLower = tier.toLowerCase();
  // Return clean URL without transforms — let the Cloudinary loader inject correct width at render time
  return `${CLOUDINARY_BASE}/idm/fallback/avatars/avatar-${division}-${tierLower}`;
}

/**
 * Format number as IDR currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
}

/**
 * Format number as short IDR currency (e.g. "Rp 50K", "Rp 1.5M")
 */
export function formatCurrencyShort(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `Rp ${(amount / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (amount >= 1_000_000) {
    return `Rp ${(amount / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (amount >= 1_000) {
    return `Rp ${(amount / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return `Rp ${amount}`;
}

/**
 * Normalize division string to strict "male" or "female"
 * Handles "M", "F", "male", "female", "semua" (defaults to "male")
 */
export function toStrictDivision(division: string | Division): 'male' | 'female' {
  if (!division) return 'male';
  const lower = division.toLowerCase().trim();
  if (lower === 'female' || lower === 'f') return 'female';
  return 'male'; // "male", "m", "semua", or any other value defaults to male
}

/**
 * Format club info as string
 * Handles string, object with name property, or null/undefined
 */
export function clubToString(club: string | { id: string; name: string; logo?: string | null } | null | undefined): string {
  if (!club) return '';
  if (typeof club === 'string') return club;
  return club.name || '';
}

/**
 * WIB (UTC+7) offset in milliseconds
 */
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * WIB timezone identifier for Intl formatting
 */
const WIB_TIMEZONE = 'Asia/Jakarta';

/**
 * Convert datetime-local input (WIB) to UTC Date for database storage
 * Admin inputs time in WIB, we subtract 7 hours to store as UTC
 * Example: "2026-05-07T20:30" (WIB) → 2026-05-07T13:30:00.000Z (UTC)
 */
export function wibToUTC(datetimeLocal: string): Date {
  const d = new Date(datetimeLocal);
  return new Date(d.getTime() - WIB_OFFSET_MS);
}

/**
 * Parse a stored UTC date string and return a Date object.
 * IMPORTANT: The returned Date represents the true UTC time in the DB.
 * Do NOT use getHours()/getMinutes()/toLocaleDateString() directly on this Date
 * for display purposes — those methods use the browser's local timezone.
 * Instead, use formatWIBTime(), formatWIBDate(), formatWIBDateTime() which
 * format in Asia/Jakarta (WIB) timezone regardless of browser timezone.
 * For countdown/timer calculations, use .getTime() directly (epoch ms is correct).
 */
export function parseWIBDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
}

/**
 * Parse date string as WIB timezone (UTC+7)
 * @deprecated Use parseWIBDate instead — this is now an alias
 */
export const parseWitaDate = parseWIBDate;

/**
 * Format a Date to "HH:MM WIB" string using Asia/Jakarta timezone
 * This works correctly regardless of the browser's local timezone.
 */
export function formatWIBTime(date: Date): string {
  const parts = new Intl.DateTimeFormat('id-ID', {
    timeZone: WIB_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find(p => p.type === 'hour')?.value ?? '00';
  const minute = parts.find(p => p.type === 'minute')?.value ?? '00';
  return `${hour}:${minute} WIB`;
}

/**
 * Format a Date to Indonesian locale date string using Asia/Jakarta timezone
 * This works correctly regardless of the browser's local timezone.
 */
export function formatWIBDate(date: Date): string {
  return date.toLocaleDateString('id-ID', {
    timeZone: WIB_TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Format a Date to short date string (e.g., "13 Mei 2026") using Asia/Jakarta timezone
 */
export function formatWIBDateShort(date: Date): string {
  return date.toLocaleDateString('id-ID', {
    timeZone: WIB_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format a Date to weekday + short date (e.g., "Rab, 13 Mei") using Asia/Jakarta timezone
 */
export function formatWIBWeekdayShort(date: Date): string {
  return date.toLocaleDateString('id-ID', {
    timeZone: WIB_TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Format a Date to numeric date (e.g., "13/05/2026") using Asia/Jakarta timezone
 */
export function formatWIBDateNumeric(date: Date): string {
  const parts = new Intl.DateTimeFormat('id-ID', {
    timeZone: WIB_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);
  const day = parts.find(p => p.type === 'day')?.value ?? '00';
  const month = parts.find(p => p.type === 'month')?.value ?? '00';
  const year = parts.find(p => p.type === 'year')?.value ?? '0000';
  return `${day}/${month}/${year}`;
}

/**
 * Get the day of week in Indonesian using Asia/Jakarta timezone
 */
export function getWIBDayOfWeek(date: Date): string {
  const HARI_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const jakartaStr = date.toLocaleDateString('en-US', { timeZone: WIB_TIMEZONE, weekday: 'short' });
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return HARI_ID[dayMap[jakartaStr] ?? 0];
}

/**
 * Format a Date to full date + time string using Asia/Jakarta timezone
 */
export function formatWIBDateTime(date: Date): string {
  return `${formatWIBDate(date)}, ${formatWIBTime(date)}`;
}

/**
 * Convert a UTC Date back to datetime-local string for form inputs,
 * formatted in Asia/Jakarta (WIB) timezone.
 * This ensures the input field shows the correct WIB time regardless of browser timezone.
 */
export function wibToDatetimeLocal(date: Date): string {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: WIB_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const year = parts.find(p => p.type === 'year')?.value ?? '0000';
  const month = parts.find(p => p.type === 'month')?.value ?? '00';
  const day = parts.find(p => p.type === 'day')?.value ?? '00';
  const hour = parts.find(p => p.type === 'hour')?.value ?? '00';
  const minute = parts.find(p => p.type === 'minute')?.value ?? '00';
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/**
 * Convert hex color to rgba string
 * @param hex - Hex color string like "#FF2D78" or "FF2D78"
 * @param alpha - Alpha value: 0-1 for float, or 0-255 for integer (will be divided by 255)
 */
export function hexToRgba(hex: string, alpha: number): string {
  // Remove # prefix if present
  const cleanHex = hex.replace(/^#/, '');

  // Parse hex color
  let r: number, g: number, b: number;
  if (cleanHex.length === 3) {
    r = parseInt(cleanHex[0] + cleanHex[0], 16);
    g = parseInt(cleanHex[1] + cleanHex[1], 16);
    b = parseInt(cleanHex[2] + cleanHex[2], 16);
  } else {
    r = parseInt(cleanHex.substring(0, 2), 16);
    g = parseInt(cleanHex.substring(2, 4), 16);
    b = parseInt(cleanHex.substring(4, 6), 16);
  }

  // Normalize alpha: if > 1, treat as 0-255 scale
  const normalizedAlpha = alpha > 1 ? alpha / 255 : alpha;

  return `rgba(${r}, ${g}, ${b}, ${normalizedAlpha})`;
}

/**
 * Check if a URL is a Cloudinary URL
 */
export function isCloudinaryUrl(url: string): boolean {
  return url.includes('cloudinary.com') || url.includes('res.cloudinary.com');
}

/**
 * Check if a URL is a video URL (mp4, webm, mov, etc.)
 * Supports both direct file extensions and Cloudinary /video/upload/ paths
 */
export function isVideoUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  // Cloudinary video upload path
  if (lower.includes('/video/upload/')) return true;
  // Direct video file extensions (with or without query params)
  if (/\.(mp4|webm|mov|avi|mkv|m4v|ogg)(\?.*)?$/i.test(lower)) return true;
  // Cloudinary video format transformation (e.g. f_mp4)
  if (lower.includes('f_mp4') || lower.includes('f_webm')) return true;
  return false;
}

/**
 * Get optimized Cloudinary video URL for avatar usage
 * For videos, we return the mp4 format with auto quality
 * Cloudinary can transform videos just like images
 */
export function getOptimizedVideoUrl(url: string): string {
  if (!url) return '';
  if (!isCloudinaryUrl(url)) return url;

  // If it's already a /video/upload/ URL, inject video optimizations
  const videoMarker = '/video/upload/';
  const videoIndex = url.indexOf(videoMarker);
  if (videoIndex !== -1) {
    const before = url.substring(0, videoIndex + videoMarker.length);
    const after = url.substring(videoIndex + videoMarker.length);
    // If already has transforms, return as-is
    if (after.startsWith('f_') || after.startsWith('q_') || after.startsWith('w_')) return url;
    return `${before}f_mp4,q_auto:good,w_600,c_fill/${after}`;
  }

  // If it's an /image/upload/ URL but we want video, convert to video delivery
  const imageMarker = '/image/upload/';
  const imageIndex = url.indexOf(imageMarker);
  if (imageIndex !== -1) {
    // This is an image URL — don't convert, return as-is
    return url;
  }

  return url;
}

/**
 * Get a video poster/thumbnail URL from a Cloudinary video URL
 * Cloudinary can generate a JPEG thumbnail from video using the video delivery path
 * with f_jpg transformation — this is the official Cloudinary method for video thumbnails.
 */
export function getVideoPosterUrl(url: string): string {
  if (!url) return '';
  if (!isCloudinaryUrl(url)) return '';

  const videoMarker = '/video/upload/';
  const videoIndex = url.indexOf(videoMarker);
  if (videoIndex !== -1) {
    const before = url.substring(0, videoIndex + videoMarker.length);
    const after = url.substring(videoIndex + videoMarker.length);
    if (after.startsWith('f_') || after.startsWith('q_') || after.startsWith('w_')) {
      return `${before}f_jpg,q_auto,so_0/${after}`;
    }
    return `${before}f_jpg,q_auto,so_0/${after}`;
  }

  // If it's not a /video/upload/ URL, no poster can be generated
  return '';
}

/**
 * Check if a club logo URL is a placeholder (data URI / SVG)
 */
export function isClubLogoPlaceholder(url: string): boolean {
  return url.startsWith('data:');
}

/**
 * Optimize a Cloudinary URL by injecting transformation parameters
 * Injects f_auto,q_auto:good,w_*,c_limit directly into the URL
 */
export function getOptimizedCloudinaryUrl(url: string, width: number = 200): string {
  if (!url || !isCloudinaryUrl(url)) return url || '';

  // If URL already has transformations (e.g., /image/upload/v1234/...),
  // inject transformations after /upload/
  const uploadMarker = '/image/upload/';
  const uploadIndex = url.indexOf(uploadMarker);

  if (uploadIndex === -1) {
    // Try /video/upload/ or other patterns
    const otherUpload = url.indexOf('/upload/');
    if (otherUpload === -1) return url;
    const before = url.substring(0, otherUpload + '/upload/'.length);
    const after = url.substring(otherUpload + '/upload/'.length);
    return `${before}f_auto,q_auto:good,w_${width},c_limit/${after}`;
  }

  const before = url.substring(0, uploadIndex + uploadMarker.length);
  const after = url.substring(uploadIndex + uploadMarker.length);

  // If there are already transformations (not starting with v followed by digits),
  // we might need to handle differently, but for simplicity, prepend our transforms
  return `${before}f_auto,q_auto:good,w_${width},c_limit/${after}`;
}

/**
 * CDN image mapping — maps local image paths to Cloudinary public IDs
 * Used by cdnImage() to convert local paths to optimized Cloudinary URLs
 */
const CDN_IMAGE_MAP: Record<string, string> = {
  // Banner / decorative images
  '/images/hero-banner.png': 'idm/static/hero-banner',
  '/images/male-division.png': 'idm/static/male-division',
  '/images/female-division.png': 'idm/static/female-division',
  '/images/champions-podium.png': 'idm/static/champions-podium',
  '/images/match-versus.png': 'idm/static/match-versus',
  '/images/match-spotlight.png': 'idm/static/match-spotlight',
  '/images/club-banner-1.png': 'idm/static/club-banner-1',
  '/images/player-banner-2.png': 'idm/static/player-banner-2',
  '/images/mvp-highlight.png': 'idm/static/mvp-highlight',
  '/images/tournament-arena.png': 'idm/static/tournament-arena',
  '/images/sawer-live.png': 'idm/static/sawer-live',
  '/images/bracket-tree.png': 'idm/static/bracket-tree',
  '/images/season-progress.png': 'idm/static/season-progress',
  '/images/leaderboard-bg.png': 'idm/static/leaderboard-bg',
  '/images/stats-overview.png': 'idm/static/stats-overview',
  '/images/activity-timeline.png': 'idm/static/activity-timeline',
  '/images/donation-bg.png': 'idm/static/donation-bg',
  // Gallery images
  '/gallery/tournament-stage.png': 'idm/static/gallery/tournament-stage',
  '/gallery/dance-battle.png': 'idm/static/gallery/dance-battle',
  '/gallery/bracket-display.png': 'idm/static/gallery/bracket-display',
  '/gallery/champion-celebration.png': 'idm/static/gallery/champion-celebration',
  '/gallery/community-meetup.png': 'idm/static/gallery/community-meetup',
  '/gallery/dance-performance.png': 'idm/static/gallery/dance-performance',
  '/gallery/mvp-portrait.png': 'idm/static/gallery/mvp-portrait',
  '/gallery/prize-donation.png': 'idm/static/gallery/prize-donation',
  '/gallery/streamer-setup.png': 'idm/static/gallery/streamer-setup',
  '/gallery/team-huddle.png': 'idm/static/gallery/team-huddle',
  '/gallery/award-ceremony.png': 'idm/static/gallery/award-ceremony',
  '/gallery/behind-scene.png': 'idm/static/gallery/behind-scene',
  // Background images
  '/bg-male.jpg': 'idm/static/bg-male',
  '/bg-female.jpg': 'idm/static/bg-female',
  '/bg-section.jpg': 'idm/static/bg-section',
  '/bg-default.jpg': 'idm/static/bg-default',
  '/bg-mobiledefault.jpg': 'idm/static/bg-mobiledefault',
  '/arena-bg.png': 'idm/static/arena-bg',
  '/champion-banner.png': 'idm/static/champion-banner',
  '/idm-hero.png': 'idm/static/idm-hero',
};

/**
 * Map local image paths to Cloudinary CDN URLs
 * Converts /images/..., /gallery/..., /bg-*.jpg, etc. to optimized Cloudinary URLs
 * @param localPath - Local image path (e.g. "/images/hero-banner.png")
 * @param width - Image width for Cloudinary optimization (default: 800)
 */
export function cdnImage(localPath: string, width: number = 800): string {
  if (!localPath) return '';
  // Already a Cloudinary URL — return as-is
  if (localPath.includes('cloudinary.com')) return localPath;
  // Data URIs — return as-is
  if (localPath.startsWith('data:')) return localPath;
  // External URLs — return as-is
  if (localPath.startsWith('http')) return localPath;

  const cloudinaryId = CDN_IMAGE_MAP[localPath];
  if (cloudinaryId) {
    return `${CLOUDINARY_BASE}/f_auto,q_auto:good,w_${width},c_limit/${cloudinaryId}`;
  }

  // Fallback: try to construct from the path
  const clean = localPath.replace(/^\//, '').replace(/\.(png|jpg|jpeg|webp|gif|svg)$/i, '');
  return `${CLOUDINARY_BASE}/f_auto,q_auto:good,w_${width},c_limit/${clean}`;
}

/**
 * Format TARKAM season name with number
 * e.g. formatTarkamSeasonName("Tarkam", 1) → "TARKAM Season 1"
 */
export function formatTarkamSeasonName(name: string, number?: number | string): string {
  if (!number && !name) return '';
  if (!number) return name;
  const seasonNum = typeof number === 'string' ? number : String(number);
  if (!name) return `Season ${seasonNum}`;
  return `${name} S${seasonNum}`;
}
