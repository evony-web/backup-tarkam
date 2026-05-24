import type { ImageLoader } from 'next/image';

const cloudinaryLoader: ImageLoader = ({ src, width, quality }) => {
  // ★ Video URLs — return as-is (Next.js Image can't render videos,
  // but the AvatarMedia component handles video separately via <video> tag)
  if (src.includes('/video/upload/')) {
    return src;
  }

  // ★ Cloudinary: inject f_auto + q_auto + width + c_limit
  // Sebelum: .../upload/v123/cms/backgrounds/photo.jpg  (2-5MB raw)
  // Sesudah: .../upload/f_auto,q_auto:good,w_1920,c_limit/v123/cms/backgrounds/photo.jpg (50-200KB)
  // Cap width at 1920px — prevents loading 3840px+ images on high-DPI displays
  // c_limit = only resize if original is larger than specified width (never upscale)

  if (src.includes('res.cloudinary.com')) {
    // ★ If URL already has Cloudinary transformation params (from getOptimizedCloudinaryUrl),
    // the image is already optimized — return as-is without re-processing.
    // This prevents "loader does not implement width" warning and double-transformation.
    if (src.includes('/image/upload/f_') || src.includes('/image/upload/q_')) {
      return src;
    }
    const optimizedWidth = Math.min(width, 1920);
    return src.replace(
      '/image/upload/',
      `/image/upload/f_auto,q_auto:good,w_${optimizedWidth},c_limit/`
    );
  }

  // ★ YouTube thumbnails — YouTube CDN already optimizes, return as-is
  // Both img.youtube.com and i.ytimg.com serve YouTube thumbnails
  if (src.includes('img.youtube.com') || src.includes('i.ytimg.com')) {
    return src;
  }

  // ★ Local images (/logo1.webp, dll) — add width query param for cache busting
  // This satisfies Next.js loader width requirement while keeping local images simple
  if (src.startsWith('/')) {
    const separator = src.includes('?') ? '&' : '?';
    return `${src}${separator}w=${Math.min(width, 1920)}`;
  }

  // ★ Fallback: return as-is for any other external URLs
  return src;
};

export default cloudinaryLoader;
