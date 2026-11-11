import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

const defaults = {
  assignments: true,
  comments: true,
  mentions: true,
  invitations: true,
  dueSoon: true,
  browser: true,
  email: false,
};

async function userId() {
  return (await getServerSession(authOptions))?.user?.id ?? null;
}

export async function GET() {
  const id = await userId();
  if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const preferences = await prisma.notificationPreference.findUnique({ where: { userId: id } });
    return NextResponse.json(preferences ?? defaults);
  } catch (error) {
    console.error('Unable to load notification preferences', error);
    return NextResponse.json({ error: 'Notification settings are temporarily unavailable' }, { status: 503 });
  }
}

export async function PUT(request: NextRequest) {
  const id = await userId();
  if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const input = await request.json().catch(() => ({}));
  const data = Object.fromEntries(
    Object.keys(defaults)
      .filter((key) => typeof input[key] === 'boolean')
      .map((key) => [key, input[key]]),
  );
  try {
    const preferences = await prisma.notificationPreference.upsert({
      where: { userId: id },
      create: { userId: id, ...defaults, ...data },
      update: data,
    });
    return NextResponse.json(preferences);
  } catch (error) {
    console.error('Unable to save notification preferences', error);
    return NextResponse.json({ error: 'Notification settings could not be saved' }, { status: 503 });
  }
}
