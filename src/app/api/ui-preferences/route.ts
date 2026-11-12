import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

const themes = new Set(['light', 'dark']);

async function currentUserId() {
  return (await getServerSession(authOptions))?.user?.id ?? null;
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const preference = await prisma.uiPreference.findUnique({ where: { userId } });
    return NextResponse.json({ preference });
  } catch (error) {
    console.error('Unable to load UI preferences', error);
    return NextResponse.json({ error: 'UI preferences are temporarily unavailable' }, { status: 503 });
  }
}

export async function PUT(request: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const input = await request.json().catch(() => null) as { theme?: unknown } | null;
  if (!input || !themes.has(String(input.theme))) {
    return NextResponse.json({ error: 'Invalid UI preference' }, { status: 400 });
  }

  const theme = String(input.theme);
  // Only the Kordit style exists now
  const appearance = 'kordit';

  try {
    const preference = await prisma.uiPreference.upsert({
      where: { userId },
      create: { userId, theme, appearance },
      update: { theme, appearance },
    });
    return NextResponse.json({ preference });
  } catch (error) {
    console.error('Unable to save UI preferences', error);
    return NextResponse.json({ error: 'UI preferences could not be saved' }, { status: 503 });
  }
}
