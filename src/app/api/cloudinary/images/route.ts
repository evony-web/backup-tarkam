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
 * GET /api/cloudinary/images
 * Lists images from Cloudinary. Requires admin auth.
 * Query params: max_results, next_cursor, prefix, type
 */
export async function GET(request: NextRequest) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  // Auth check — require admin
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const searchParams = request.nextUrl.searchParams;
    const maxResults = Math.min(parseInt(searchParams.get('max_results') || '50'), 100);
    const nextCursor = searchParams.get('next_cursor') || undefined;
    const prefix = searchParams.get('prefix') || undefined;
    const type = searchParams.get('type') || 'upload';

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return NextResponse.json(
        { error: 'Cloudinary not configured — set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env' },
        { headers, status: 500 }
      );
    }

    // Use Cloudinary Admin API via SDK — fetch both images and videos
    const [imageResult, videoResult] = await Promise.all([
      cloudinary.api.resources({
        type: type as 'upload' | 'private' | 'authenticated',
        max_results: maxResults,
        next_cursor: nextCursor,
        prefix: prefix,
        resource_type: 'image',
      }).catch(() => ({ resources: [] })),
      cloudinary.api.resources({
        type: type as 'upload' | 'private' | 'authenticated',
        max_results: maxResults,
        next_cursor: nextCursor,
        prefix: prefix,
        resource_type: 'video',
      }).catch(() => ({ resources: [] })),
    ]);

    // Merge and transform the response
    const allResources = [...(imageResult.resources || []), ...(videoResult.resources || [])];
    const images = allResources.map((img: { public_id: string; secure_url: string; width: number; height: number; format: string; bytes: number; created_at: string; resource_type?: string; duration?: number }) => ({
      public_id: img.public_id,
      url: img.secure_url,
      width: img.width,
      height: img.height,
      format: img.format,
      bytes: img.bytes,
      created_at: img.created_at,
      resourceType: img.resource_type || 'image',
      duration: img.duration || undefined,
    }));

    return NextResponse.json({
      images,
      next_cursor: imageResult.next_cursor || videoResult.next_cursor || null,
      rate_limit_remaining: imageResult.rate_limit_remaining,
    }, { headers });
  } catch (error: unknown) {
    console.error('Cloudinary fetch error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { headers, status: 500 }
    );
  }
}

/**
 * POST /api/cloudinary/images — Get folders list from Cloudinary. Requires admin auth.
 */
export async function POST(request: NextRequest) {
  // Auth check — require admin
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'get_folders') {
      if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        return NextResponse.json({ error: 'Cloudinary not configured' }, { status: 500 });
      }

      const result = await cloudinary.api.root_folders();

      return NextResponse.json({
        folders: (result.folders || []).map((f: { name: string; path: string }) => ({
          name: f.name,
          path: f.path,
        })),
      });
    }

    // Also support sub-folders
    if (action === 'get_sub_folders') {
      const { parentFolder } = body;
      if (!parentFolder) {
        return NextResponse.json({ error: 'parentFolder required' }, { status: 400 });
      }

      const result = await cloudinary.api.sub_folders(parentFolder);
      return NextResponse.json({
        folders: (result.folders || []).map((f: { name: string; path: string }) => ({
          name: f.name,
          path: f.path,
        })),
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Cloudinary folders error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
