/**
 * Client-side image compression utility.
 * Reduces image file size before base64 encoding to avoid
 * Vercel's 4.5MB serverless function body limit.
 */

interface CompressOptions {
  /** Maximum width in pixels (default: 1920) */
  maxWidth?: number;
  /** Maximum height in pixels (default: 1920) */
  maxHeight?: number;
  /** JPEG quality 0-1 (default: 0.8) */
  quality?: number;
  /** Target output format (default: 'image/webp' for better compression) */
  mimeType?: string;
  /** Maximum output file size in bytes before base64 (default: 3MB — safe for Vercel) */
  maxOutputBytes?: number;
}

const DEFAULT_OPTIONS: Required<CompressOptions> = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.8,
  mimeType: 'image/webp',
  maxOutputBytes: 3 * 1024 * 1024, // 3MB — base64 ≈ 4MB, safely under Vercel 4.5MB limit
};

/**
 * Compress an image File/Blob using canvas.
 * Returns a base64 data URL string.
 */
export async function compressImage(
  file: File | Blob,
  options: CompressOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Calculate target dimensions while maintaining aspect ratio
      let { width, height } = img;
      if (width > opts.maxWidth || height > opts.maxHeight) {
        const ratio = Math.min(opts.maxWidth / width, opts.maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // Draw to canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      // High quality downscaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Try with target quality first, reduce if still too large
      let quality = opts.quality;
      let dataUrl = canvas.toDataURL(opts.mimeType, quality);

      // If still too large, reduce quality progressively
      while (dataUrl.length > opts.maxOutputBytes * 1.37 && quality > 0.1) {
        // base64 is ~37% larger than binary
        quality -= 0.1;
        dataUrl = canvas.toDataURL(opts.mimeType, quality);
      }

      // If still too large after quality reduction, try JPEG as fallback
      if (dataUrl.length > opts.maxOutputBytes * 1.37 && opts.mimeType !== 'image/jpeg') {
        quality = opts.quality;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > opts.maxOutputBytes * 1.37 && quality > 0.1) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
      }

      // Last resort: further reduce dimensions
      if (dataUrl.length > opts.maxOutputBytes * 1.37) {
        const scaleFactor = Math.sqrt((opts.maxOutputBytes * 1.37) / dataUrl.length);
        canvas.width = Math.round(width * scaleFactor);
        canvas.height = Math.round(height * scaleFactor);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        dataUrl = canvas.toDataURL('image/jpeg', 0.6);
      }

      resolve(dataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for compression'));
    };

    img.src = url;
  });
}

/**
 * Check if a file needs compression (is an image and exceeds size threshold)
 */
export function shouldCompress(file: File, thresholdBytes: number = 1.5 * 1024 * 1024): boolean {
  return file.type.startsWith('image/') && file.size > thresholdBytes;
}
