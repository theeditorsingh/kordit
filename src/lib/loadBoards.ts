import { prisma } from "@/lib/prisma";
import { boardInclude } from "@/lib/boardQuery";

/**
 * All non-archived boards a user is a member of, shaped for the client.
 * `isFavorite` is the user's own star (stored on their Member row), and other
 * members' stars are stripped before anything is sent to the browser.
 */
export async function loadBoardsForUser(userId: string) {
  const boards = await prisma.board.findMany({
    where: {
      members: { some: { userId } },
      isArchived: false,
    },
    include: boardInclude,
    orderBy: { createdAt: 'asc' },
  });

  return boards.map((board) => ({
    ...board,
    isFavorite: board.members.some((m) => m.userId === userId && m.isFavorite),
    members: board.members.map(({ isFavorite: _isFavorite, ...member }) => member),
  }));
}
