import { prisma } from '@/lib/prisma';

function safeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 42) || 'workspace';
}

export async function getOrCreateWorkspace(user: { id: string; name?: string | null; username?: string | null; email?: string | null }) {
  const existing = await prisma.workspaceMember.findFirst({
    where: { userId: user.id },
    include: { workspace: true },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) return existing.workspace;

  if (user.email) {
    const invite = await prisma.workspaceInvite.findFirst({
      where: { email: user.email.toLowerCase(), status: 'Pending' },
      include: { workspace: true },
      orderBy: { createdAt: 'asc' },
    });
    if (invite) {
      const boards = await prisma.board.findMany({ where: { workspaceId: invite.workspaceId, visibility: 'Workspace' }, select: { id: true } });
      await prisma.$transaction([
        prisma.workspaceMember.create({ data: { workspaceId: invite.workspaceId, userId: user.id, role: invite.role } }),
        prisma.workspaceInvite.update({ where: { id: invite.id }, data: { status: 'Accepted', acceptedAt: new Date() } }),
        ...boards.map((board) => prisma.member.upsert({
          where: { boardId_userId: { boardId: board.id, userId: user.id } },
          create: { boardId: board.id, userId: user.id, role: invite.role },
          update: {},
        })),
      ]);
      return invite.workspace;
    }
  }

  const base = safeSlug(user.username || user.name || user.email?.split('@')[0] || 'workspace');
  const ownedBoards = await prisma.board.findMany({
    where: { ownerId: user.id },
    select: { members: { select: { userId: true, role: true } } },
  });
  const roles = new Map<string, string>([[user.id, 'Owner']]);
  for (const board of ownedBoards) {
    for (const member of board.members) {
      if (member.userId === user.id) continue;
      const current = roles.get(member.userId);
      if (!current || member.role === 'Admin') roles.set(member.userId, member.role === 'Guest' ? 'Member' : member.role);
    }
  }
  const workspace = await prisma.workspace.create({
    data: {
      name: `${user.name || user.username || 'My'} Workspace`,
      slug: `${base}-${Math.random().toString(36).slice(2, 7)}`,
      ownerId: user.id,
      members: { create: [...roles].map(([userId, role]) => ({ userId, role })) },
    },
  });
  await prisma.board.updateMany({ where: { ownerId: user.id, workspaceId: null }, data: { workspaceId: workspace.id } });
  return workspace;
}
