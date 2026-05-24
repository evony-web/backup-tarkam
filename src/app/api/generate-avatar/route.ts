import ZAI from 'z-ai-web-dev-sdk';
import { getSafeErrorMessage } from '@/lib/api-error';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { name, division } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Name required' }, { status: 400 });
    }

    const zai = await ZAI.create();

    const stylePrompt = division === 'female'
      ? 'Stylized realism female dance competitor avatar, soft elegant features, warm tone with pink and purple accents, smooth shading, cinematic lighting, professional dance portrait, clean background, high quality'
      : 'Stylized realism male dance competitor avatar, strong confident features, cool tone with blue and cyan accents, cinematic lighting, professional dance portrait, clean background, high quality';

    const response = await zai.images.generations.create({
      prompt: `${stylePrompt}, dancer tag name "${name}"`,
      size: '864x1152',
    });

    const imageBase64 = response.data[0].base64;

    return NextResponse.json({
      success: true,
      avatar: `data:image/png;base64,${imageBase64}`,
    });
  } catch (e: unknown) {
    const error = e as Error;
    console.error('Avatar generation error:', error);
    return NextResponse.json({ error: getSafeErrorMessage(e) }, { status: 500 });
  }
}
