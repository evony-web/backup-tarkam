// @ts-nocheck
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  try {
    const user = await getSession(request);

    if (!user) {
      return Response.json(
        { success: false, error: 'Not authenticated' },
        { headers,  status: 401 }
      );
    }

    return Response.json({
      success: true,
      data: user
    }, { headers });
  } catch (error) {
    console.error('Get user error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { headers,  status: 500 }
    );
  }
}
