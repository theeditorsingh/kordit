import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { listWorkspacesForUser, uniqueWorkspaceSlug, validWorkspaceName } from '@/lib/workspace';

async function currentUserId() {
  return (await getServerSession(authOptions))?.user?.id ?? null;
}

/** The signed-in user's workspaces. Read-only: listing never creates a workspace. */
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json({ workspaces: await listWorkspacesForUser(userId) });
  } catch (error) {
    console.error('Unable to load workspaces', error);
    return NextResponse.json({ error: 'Workspaces are temporarily unavailable' }, { status: 503 });
  }
}

/** Create a workspace; the creator becomes its Owner. */
export async function POST(request: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name = validWorkspaceName(body?.name);
  if (!name) return NextResponse.json({ error: 'Workspace name must be 1-60 characters' }, { status: 400 });

  const workspace = await prisma.workspace.create({
    data: {
      name,
      slug: await uniqueWorkspaceSlug(name),
      ownerId: userId,
      members: { create: { userId, role: 'Owner' } },
    },
  });
  return NextResponse.json({
    workspace: {
      id: workspace.id, name: workspace.name, slug: workspace.slug, role: 'Owner',
      memberCount: 1, boardCount: 0, createdAt: workspace.createdAt.toISOString(),
    },
  }, { status: 201 });
}
