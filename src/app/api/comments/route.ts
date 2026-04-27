import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { NextResponse, NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cardId = request.nextUrl.searchParams.get('cardId');
  const boardId = request.nextUrl.searchParams.get('boardId');
  if (!cardId || !boardId) {
    return NextResponse.json({ error: "cardId and boardId required" }, { status: 400 });
  }

  const member = await prisma.member.findUnique({
    where: { boardId_userId: { boardId, userId: session.user.id } }
  });
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (card?.boardId !== boardId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const comments = await prisma.comment.findMany({
    where: { cardId },
    include: {
      user: { select: { name: true, username: true, image: true } }
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(comments);
}
