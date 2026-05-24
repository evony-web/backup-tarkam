import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { requireAdmin } from '@/lib/api-auth';

// Configure Cloudinary SDK
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * POST /api/cloudinary/sign-upload
 * Generate a signed upload payload for Cloudinary direct (client-side) upload.
 * This bypasses Vercel's serverless function body size limit (4.5MB on Hobby).
 * Requires admin auth.
 *
 * Body: { folder?: string, publicId?: string, resourceType?: 'image' | 'video' }
 * Returns: { apiKey, timestamp, signature, folder, publicId?, cloudName, resourceType }
 */
export async function POST(request: NextRequest) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  // Auth check — require admin
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return NextResponse.json(
        { error: 'Cloudinary not configured' },
        { headers, status: 500 }
      );
    }

    const body = await request.json();
    const { folder, publicId, resourceType } = body;

    const timestamp = Math.round(Date.now() / 1000);

    // Build parameters to sign
    const paramsToSign: Record<string, string> = {
      timestamp: timestamp.toString(),
      folder: folder || 'general',
    };

    if (publicId) {
      paramsToSign.public_id = publicId;
    }

    // Generate signature
    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET
    );

    return NextResponse.json({
      apiKey: process.env.CLOUDINARY_API_KEY,
      timestamp,
      signature,
      folder: paramsToSign.folder,
      publicId: publicId || undefined,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      resourceType: resourceType || 'image',
    }, { headers });
  } catch (error: unknown) {
    console.error('[Cloudinary Sign Upload] Error:', error);
    const message = error instanceof Error ? error.message : 'Gagal membuat signature';
    return NextResponse.json(
      { error: message },
      { headers, status: 500 }
    );
  }
}
