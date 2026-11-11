import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

function dayKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const userId = (await getServerSession(authOptions))?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const requested = Number(request.nextUrl.searchParams.get('days') ?? 30);
  const days = requested === 7 || requested === 90 ? requested : 30;
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - days + 1);

  const memberships = await prisma.member.findMany({ where: { userId }, select: { boardId: true } });
  const boardIds = memberships.map((membership) => membership.boardId);
  if (!boardIds.length) return NextResponse.json({ days, series: [], totals: { boards: 0, created: 0, moved: 0, completed: 0, overdue: 0, completionRate: 0 }, boards: [] });

  const [boards, cards, activity] = await Promise.all([
    prisma.board.findMany({ where: { id: { in: boardIds }, isArchived: false }, select: { id: true, title: true, createdAt: true } }),
    prisma.card.findMany({
      where: { boardId: { in: boardIds } },
      select: { id: true, boardId: true, createdAt: true, completedAt: true, dueDate: true, assigneeIds: true },
    }),
    prisma.activity.findMany({
      where: { boardId: { in: boardIds }, createdAt: { gte: since }, action: { in: ['card_created', 'card_moved'] } },
      select: { action: true, createdAt: true },
      take: 20000,
    }),
  ]);

  const buckets = new Map<string, { day: string; created: number; moved: number; completed: number }>();
  for (let index = 0; index < days; index++) {
    const date = new Date(since);
    date.setUTCDate(since.getUTCDate() + index);
    const day = dayKey(date);
    buckets.set(day, { day, created: 0, moved: 0, completed: 0 });
  }
  for (const event of activity) {
    const bucket = buckets.get(dayKey(event.createdAt));
    if (!bucket) continue;
    if (event.action === 'card_created') bucket.created++;
    if (event.action === 'card_moved') bucket.moved++;
  }
  for (const card of cards) {
    if (card.completedAt && card.completedAt >= since) {
      const bucket = buckets.get(dayKey(card.completedAt));
      if (bucket) bucket.completed++;
    }
  }

  const now = new Date();
  const completed = cards.filter((card) => !!card.completedAt).length;
  const overdue = cards.filter((card) => card.dueDate && card.dueDate < now && !card.completedAt).length;
  const perBoard = boards.map((board) => {
    const boardCards = cards.filter((card) => card.boardId === board.id);
    const done = boardCards.filter((card) => !!card.completedAt).length;
    return {
      id: board.id,
      title: board.title,
      total: boardCards.length,
      completed: done,
      overdue: boardCards.filter((card) => card.dueDate && card.dueDate < now && !card.completedAt).length,
      rate: boardCards.length ? Math.round(done / boardCards.length * 100) : 0,
    };
  }).sort((a, b) => b.rate - a.rate || b.total - a.total);

  const series = [...buckets.values()];
  return NextResponse.json({
    days,
    series,
    totals: {
      boards: boards.length,
      created: series.reduce((sum, row) => sum + row.created, 0),
      moved: series.reduce((sum, row) => sum + row.moved, 0),
      completed: series.reduce((sum, row) => sum + row.completed, 0),
      overdue,
      completionRate: cards.length ? Math.round(completed / cards.length * 100) : 0,
    },
    boards: perBoard,
  });
}
