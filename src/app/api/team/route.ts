import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { getOrCreateWorkspace, requireWorkspaceRole } from '@/lib/workspace';
import { createNotification } from '@/lib/notifications';
import { Resend } from 'resend';
import { LIMITS, consume } from '@/lib/rateLimit';

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function authUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, username: true, email: true } });
}

/**
 * The user and the workspace being managed. With a `workspaceId` the user must be a member of it;
 * without one this keeps the original behaviour (the user's first workspace, created if needed).
 */
async function context(workspaceId?: unknown) {
  const user = await authUser();
  if (!user) return null;
  if (typeof workspaceId === 'string' && workspaceId) {
    const membership = await requireWorkspaceRole(user.id, workspaceId);
    if (!membership) return { user, workspace: null, membership: null };
    return { user, workspace: membership.workspace, membership };
  }
  const workspace = await getOrCreateWorkspace(user);
  const membership = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } } });
  return { user, workspace, membership };
}

const notMember = () => NextResponse.json({ error: 'You are not a member of this workspace' }, { status: 403 });

export async function GET(request: NextRequest) {
  const ctx = await context(request.nextUrl.searchParams.get('workspaceId'));
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ctx.workspace) return notMember();
  const [members, invites] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId: ctx.workspace.id },
      include: { user: { select: { id: true, name: true, username: true, email: true, image: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    ['Owner', 'Admin'].includes(ctx.membership?.role ?? '')
      ? prisma.workspaceInvite.findMany({ where: { workspaceId: ctx.workspace.id }, orderBy: { createdAt: 'desc' } })
      : Promise.resolve([]),
  ]);
  return NextResponse.json({ workspace: ctx.workspace, role: ctx.membership?.role, members, invites });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const ctx = await context(body?.workspaceId);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ctx.workspace) return notMember();
  if (!['Owner', 'Admin'].includes(ctx.membership?.role ?? '')) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const role = body.role === 'Admin' ? 'Admin' : 'Member';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
  // Each invite can send an email, so cap how many one person can send
  if (!(await consume(`invite:${ctx.user.id}`, LIMITS.invites))) {
    return NextResponse.json({ error: 'Too many invites. Please try again later.' }, { status: 429 });
  }

  const invited = await prisma.user.findUnique({ where: { email } });
  const invite = await prisma.workspaceInvite.upsert({
    where: { workspaceId_email: { workspaceId: ctx.workspace.id, email } },
    create: { workspaceId: ctx.workspace.id, invitedById: ctx.user.id, email, role, status: invited ? 'Accepted' : 'Pending', acceptedAt: invited ? new Date() : null },
    update: { role, status: invited ? 'Accepted' : 'Pending', acceptedAt: invited ? new Date() : null },
  });

  if (invited) {
    await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: ctx.workspace.id, userId: invited.id } },
      create: { workspaceId: ctx.workspace.id, userId: invited.id, role },
      update: { role },
    });
    const boards = await prisma.board.findMany({ where: { workspaceId: ctx.workspace.id, visibility: 'Workspace' }, select: { id: true } });
    await Promise.all(boards.map((board) => prisma.member.upsert({
      where: { boardId_userId: { boardId: board.id, userId: invited.id } },
      create: { boardId: board.id, userId: invited.id, role },
      update: {},
    })));
    await createNotification({ userId: invited.id, actorId: ctx.user.id, type: 'invitation', message: `${ctx.user.name || 'A teammate'} added you to ${ctx.workspace.name}` });
  }

  if (process.env.RESEND_API_KEY) {
    const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: process.env.EMAIL_FROM || 'magiclink@theeditorsingh.com',
      to: email,
      subject: `Join ${ctx.workspace.name} on Kordit`,
      html: `<p>You have been invited to <strong>${escapeHtml(ctx.workspace.name)}</strong> on Kordit.</p><p><a href="${appUrl}/login">Open Kordit</a></p>`,
    }).catch(() => undefined);
  }
  return NextResponse.json(invite, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const ctx = await context(body?.workspaceId);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ctx.workspace) return notMember();
  if (!['Owner', 'Admin'].includes(ctx.membership?.role ?? '')) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  if (typeof body.memberId !== 'string' || !['Admin', 'Member'].includes(body.role)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const member = await prisma.workspaceMember.findFirst({ where: { id: body.memberId, workspaceId: ctx.workspace.id } });
  if (!member || member.role === 'Owner') return NextResponse.json({ error: 'Owner role cannot be changed' }, { status: 400 });
  const boards = await prisma.board.findMany({ where: { workspaceId: ctx.workspace.id, visibility: 'Workspace' }, select: { id: true } });
  await prisma.$transaction([
    prisma.workspaceMember.update({ where: { id: member.id }, data: { role: body.role } }),
    prisma.member.updateMany({ where: { userId: member.userId, boardId: { in: boards.map((board) => board.id) } }, data: { role: body.role } }),
  ]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const ctx = await context(body?.workspaceId);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ctx.workspace) return notMember();
  if (!['Owner', 'Admin'].includes(ctx.membership?.role ?? '')) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  if (typeof body.inviteId === 'string') {
    await prisma.workspaceInvite.deleteMany({ where: { id: body.inviteId, workspaceId: ctx.workspace.id } });
    return NextResponse.json({ ok: true });
  }
  if (typeof body.memberId === 'string') {
    const member = await prisma.workspaceMember.findFirst({ where: { id: body.memberId, workspaceId: ctx.workspace.id } });
    if (!member || member.role === 'Owner') return NextResponse.json({ error: 'The workspace owner cannot be removed' }, { status: 400 });
    const boards = await prisma.board.findMany({ where: { workspaceId: ctx.workspace.id, visibility: 'Workspace' }, select: { id: true, ownerId: true } });
    await prisma.$transaction([
      prisma.workspaceMember.delete({ where: { id: member.id } }),
      prisma.member.deleteMany({ where: { userId: member.userId, boardId: { in: boards.filter((board) => board.ownerId !== member.userId).map((board) => board.id) } } }),
    ]);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'Member or invite id is required' }, { status: 400 });
}
