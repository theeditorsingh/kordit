import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

async function currentUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [notifications, preferences, memberships] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: {
        actor: { select: { name: true, username: true, image: true } },
        board: { select: { title: true, slug: true, owner: { select: { username: true } } } },
        card: { select: { title: true } },
      },
    }),
    prisma.notificationPreference.findUnique({ where: { userId } }),
    prisma.member.findMany({ where: { userId }, select: { boardId: true } }),
  ]);

  let dueSoon: Array<{ id: string; title: string; dueDate: Date; board: { title: string; slug: string; owner: { username: string | null } } }> = [];
  if (preferences?.dueSoon !== false && memberships.length) {
    const now = new Date();
    const twoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const cards = await prisma.card.findMany({
      where: {
        boardId: { in: memberships.map((membership) => membership.boardId) },
        dueDate: { not: null, lte: twoDays },
        completedAt: null,
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        assigneeIds: true,
        board: { select: { title: true, slug: true, owner: { select: { username: true } } } },
      },
      orderBy: { dueDate: 'asc' },
      take: 100,
    });
    dueSoon = cards
      .filter((card) => Array.isArray(card.assigneeIds) && card.assigneeIds.includes(userId) && card.dueDate)
      .map((card) => ({ id: card.id, title: card.title, dueDate: card.dueDate!, board: card.board }))
      .slice(0, 20);
  }

  return NextResponse.json({ notifications, dueSoon });
}

export async function PATCH(request: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (body.all === true) {
    await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  } else if (typeof body.id === 'string') {
    await prisma.notification.updateMany({ where: { id: body.id, userId }, data: { isRead: true } });
  } else {
    return NextResponse.json({ error: 'Notification id is required' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
