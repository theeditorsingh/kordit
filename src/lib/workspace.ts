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

export const WORKSPACE_ROLES = ['Owner', 'Admin', 'Member'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export function validWorkspaceName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/\s+/g, ' ');
  return name.length >= 1 && name.length <= 60 ? name : null;
}

/** A unique, URL-safe slug for a workspace name. */
export async function uniqueWorkspaceSlug(name: string) {
  const base = safeSlug(name);
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const taken = await prisma.workspace.findUnique({ where: { slug }, select: { id: true } });
    if (!taken) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Workspaces the user belongs to (read-only: never creates one). */
export async function listWorkspacesForUser(userId: string) {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: {
      role: true,
      workspace: {
        select: {
          id: true, name: true, slug: true, createdAt: true,
          _count: { select: { members: true, boards: { where: { isArchived: false } } } },
        },
      },
    },
  });
  return memberships.map(({ role, workspace }) => ({
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    role,
    memberCount: workspace._count.members,
    boardCount: workspace._count.boards,
    createdAt: workspace.createdAt.toISOString(),
  }));
}

/** The user's membership in a workspace, or null. With `roles`, also requires one of them. */
export async function requireWorkspaceRole(userId: string, workspaceId: string, roles?: readonly string[]) {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    include: { workspace: true },
  });
  if (!membership) return null;
  if (roles && !roles.includes(membership.role)) return null;
  return membership;
}

/** Gives a workspace's members access to a board (board role mirrors their workspace role). */
export async function grantWorkspaceAccess(workspaceId: string, boardId: string) {
  const members = await prisma.workspaceMember.findMany({ where: { workspaceId }, select: { userId: true, role: true } });
  await Promise.all(members.map((member) => prisma.member.upsert({
    where: { boardId_userId: { boardId, userId: member.userId } },
    create: { boardId, userId: member.userId, role: member.role === 'Owner' ? 'Admin' : member.role },
    update: {},
  })));
}
