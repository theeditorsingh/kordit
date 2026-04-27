import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const boardId = searchParams.get('boardId');
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = 50;
  const skip = (page - 1) * limit;

  if (!boardId) {
    return NextResponse.json({ error: 'boardId is required' }, { status: 400 });
  }

  // Verify user is an Admin or Owner on this board
  const member = await prisma.member.findUnique({
    where: { boardId_userId: { boardId, userId: session.user.id } },
  });
  if (!member || member.role === 'Member' || member.role === 'Guest') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: { actorId: { not: undefined } },
      include: {
        actor: { select: { name: true, username: true, image: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count(),
  ]);

  return NextResponse.json({ logs, total, page, pages: Math.ceil(total / limit) });
}
