import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { requireWorkspaceRole, validWorkspaceName } from '@/lib/workspace';

type Params = { params: Promise<{ id: string }> };

async function currentUserId() {
  return (await getServerSession(authOptions))?.user?.id ?? null;
}

/** Rename a workspace (Owner or Admin). */
export async function PATCH(request: NextRequest, { params }: Params) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!(await requireWorkspaceRole(userId, id, ['Owner', 'Admin']))) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const name = validWorkspaceName(body?.name);
  if (!name) return NextResponse.json({ error: 'Workspace name must be 1-60 characters' }, { status: 400 });
  const workspace = await prisma.workspace.update({ where: { id }, data: { name }, select: { id: true, name: true, slug: true } });
  return NextResponse.json({ workspace });
}

/**
 * Delete a workspace (Owner only). Its boards are kept: `Board.workspaceId` is set to
 * null by the relation, and everyone who was a board member keeps their access.
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!(await requireWorkspaceRole(userId, id, ['Owner']))) {
    return NextResponse.json({ error: 'Only the workspace owner can delete it' }, { status: 403 });
  }
  await prisma.workspace.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
