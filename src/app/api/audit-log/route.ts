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

  const [logsRaw, totalRes] = await Promise.all([
    prisma.$queryRaw<any[]>`
      SELECT 
        a.id, a.action, a.target, a.details, a."createdAt", a."ipAddress", a."actorId",
        json_build_object('name', u.name, 'username', u.username, 'image', u.image) as actor
      FROM "AuditLog" a
      JOIN "User" u ON a."actorId" = u.id
      WHERE a.target = ${boardId} OR a.details->>'boardId' = ${boardId}
      ORDER BY a."createdAt" DESC
      LIMIT ${limit} OFFSET ${skip}
    `,
    prisma.$queryRaw<any[]>`
      SELECT COUNT(*)::int as count
      FROM "AuditLog" a
      WHERE a.target = ${boardId} OR a.details->>'boardId' = ${boardId}
    `,
  ]);

  const total = totalRes[0]?.count || 0;
  const logs = logsRaw.map(log => ({
    ...log,
    createdAt: new Date(log.createdAt).toISOString()
  }));

  return NextResponse.json({ logs, total, page, pages: Math.ceil(total / limit) });
}
