import { prisma } from "@/lib/prisma";
import { memberInclude } from "@/lib/boardQuery";

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
    // Core board loading must not depend on optional workspace features.
    // Workspace setup runs only when Team workspace is opened.
    select: {
      id: true,
      title: true,
      slug: true,
      color: true,
      visibility: true,
      background: true,
      backgroundType: true,
      labelColors: true,
      isArchived: true,
      isFavorite: true,
      createdAt: true,
      updatedAt: true,
      ownerId: true,
      workspaceId: true,
      columns: { orderBy: { order: 'asc' } },
      cards: { orderBy: { order: 'asc' } },
      members: memberInclude,
      owner: { select: { username: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return boards.map((board) => ({
    ...board,
    isFavorite: board.members.some((m) => m.userId === userId && m.isFavorite),
    members: board.members.map(({ isFavorite: _isFavorite, ...member }) => member),
  }));
}
