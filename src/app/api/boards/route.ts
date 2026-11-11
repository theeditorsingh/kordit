import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { boardInclude } from "@/lib/boardQuery";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const boards = await prisma.board.findMany({
    where: {
      members: { some: { userId: session.user.id } },
      isArchived: false,
    },
    include: boardInclude,
    orderBy: { createdAt: 'asc' }
  });

  return NextResponse.json(boards);
}
