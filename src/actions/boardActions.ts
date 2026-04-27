'use server';

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

async function getAuthUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user;
}

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') + '-' + Math.random().toString(36).substring(2, 6);
}

async function verifyBoardAccess(boardId: string, userId: string, requiredRole?: string) {
  const member = await prisma.member.findUnique({
    where: { boardId_userId: { boardId, userId } }
  });
  if (!member) throw new Error("Unauthorized");
  // Guests are read-only — block all write mutations
  if (member.role === 'Guest') throw new Error("Guests have read-only access");
  if (requiredRole && member.role !== requiredRole) throw new Error(`Requires ${requiredRole} role`);
  return member;
}

async function logActivity(boardId: string, userId: string, action: string, details: Record<string, any> = {}, cardId?: string) {
  await prisma.activity.create({
    data: { boardId, userId, action, details, cardId }
  });
}

// Persist sensitive actions to the AuditLog table (admin-visible)
async function logAuditEvent(actorId: string, action: string, target: string, details: Record<string, any> = {}) {
  try {
    await prisma.auditLog.create({
      data: { actorId, action, target, details }
    });
  } catch {
    // Non-fatal — audit logging should never break the main operation
  }
}

// ── Board Actions ───────────────────────────────────────────────────────────

export async function createBoardAction(title: string, customColumns?: { title: string, color: string }[]) {
  const user = await getAuthUser();
  const slug = generateSlug(title);

  const columnsToCreate = customColumns
    ? customColumns.map((col, idx) => ({ title: col.title, color: col.color, order: idx }))
    : [
        { title: 'To Do', order: 0, color: '#0052CC' },
        { title: 'In Progress', order: 1, color: '#FF991F' },
        { title: 'Review', order: 2, color: '#6554C0' },
        { title: 'Done', order: 3, color: '#36B37E' },
      ];

  const board = await prisma.board.create({
    data: {
      title,
      slug,
      ownerId: user.id,
      columns: { create: columnsToCreate },
      members: { create: [{ userId: user.id, role: 'Admin' }] }
    },
    include: {
      columns: true,
      members: { include: { user: true } },
    }
  });

  await logActivity(board.id, user.id, 'board_created', { boardTitle: title });
  revalidatePath('/');
  return board;
}

export async function deleteBoardAction(boardId: string) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id, 'Admin');
  await prisma.board.delete({ where: { id: boardId } });
  await logAuditEvent(user.id, 'board_deleted', boardId, { boardId });
  revalidatePath('/');
}

export async function updateBoardAction(boardId: string, updates: Record<string, any>) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id);

  const allowedFields = ['title', 'color', 'background', 'backgroundType', 'visibility', 'categoryId'];
  const data: Record<string, any> = {};
  for (const key of allowedFields) {
    if (updates[key] !== undefined) data[key] = updates[key];
  }

  if (Object.keys(data).length > 0) {
    await prisma.board.update({ where: { id: boardId }, data });
    await logActivity(boardId, user.id, 'board_updated', { fields: Object.keys(data) });
  }
  revalidatePath('/');
}

export async function toggleBoardFavoriteAction(boardId: string) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id);
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) throw new Error("Board not found");
  await prisma.board.update({ where: { id: boardId }, data: { isFavorite: !board.isFavorite } });
  revalidatePath('/');
}

export async function archiveBoardAction(boardId: string) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id, 'Admin');
  await prisma.board.update({ where: { id: boardId }, data: { isArchived: true } });
  await logActivity(boardId, user.id, 'board_archived', {});
  revalidatePath('/');
}

export async function saveBoardAsTemplateAction(boardId: string) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id);

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: { columns: { orderBy: { order: 'asc' } } }
  });
  if (!board) throw new Error("Board not found");

  const slug = generateSlug(board.title + ' copy');
  const newBoard = await prisma.board.create({
    data: {
      title: board.title + ' (Template Copy)',
      slug,
      color: board.color,
      ownerId: user.id,
      background: board.background,
      backgroundType: board.backgroundType,
      columns: {
        create: board.columns.map((col, idx) => ({
          title: col.title,
          color: col.color,
          icon: col.icon,
          wipLimit: col.wipLimit,
          order: idx,
        }))
      },
      members: { create: [{ userId: user.id, role: 'Admin' }] }
    },
    include: { columns: true, members: { include: { user: true } } }
  });

  revalidatePath('/');
  return newBoard;
}

// ── Column Actions ──────────────────────────────────────────────────────────

export async function createColumnAction(boardId: string, title: string) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id);

  const lastCol = await prisma.column.findFirst({
    where: { boardId },
    orderBy: { order: 'desc' }
  });

  const column = await prisma.column.create({
    data: { title, boardId, order: lastCol ? lastCol.order + 1 : 0 }
  });

  await logActivity(boardId, user.id, 'column_created', { columnTitle: title });
  revalidatePath('/');
  return column;
}

export async function moveColumnAction(boardId: string, columnOrders: { id: string; order: number }[]) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id);

  await prisma.$transaction(
    columnOrders.map(({ id, order }) =>
      prisma.column.update({ where: { id }, data: { order } })
    )
  );
  revalidatePath('/');
}

export async function updateColumnAction(boardId: string, columnId: string, updates: Record<string, any>) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id);

  const allowedFields = ['title', 'color', 'icon', 'wipLimit'];
  const data: Record<string, any> = {};
  for (const key of allowedFields) {
    if (updates[key] !== undefined) data[key] = updates[key];
  }

  if (Object.keys(data).length > 0) {
    await prisma.column.update({ where: { id: columnId }, data });
  }
  revalidatePath('/');
}

export async function deleteColumnAction(boardId: string, columnId: string) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id);

  const column = await prisma.column.findUnique({ where: { id: columnId } });
  await prisma.column.delete({ where: { id: columnId } });
  if (column) {
    await logActivity(boardId, user.id, 'column_deleted', { columnTitle: column.title });
    await logAuditEvent(user.id, 'column_deleted', columnId, { columnTitle: column.title, boardId });
  }
  revalidatePath('/');
}

// ── Card Actions ────────────────────────────────────────────────────────────

export async function createCardAction(boardId: string, columnId: string, title: string, description: string = '', dueDate: string | null = null) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id);

  const lastCard = await prisma.card.findFirst({
    where: { columnId },
    orderBy: { order: 'desc' }
  });

  const card = await prisma.card.create({
    data: {
      title,
      description,
      boardId,
      columnId,
      order: lastCard ? lastCard.order + 1 : 0,
      dueDate: dueDate ? new Date(dueDate) : null,
    }
  });

  await logActivity(boardId, user.id, 'card_created', { cardTitle: title, columnId }, card.id);
  await runAutomations(boardId, 'card_created', { cardId: card.id, columnId });
  revalidatePath('/');
  return card;
}

export async function moveCardAction(cardId: string, sourceColId: string, destColId: string, newOrder: number) {
  const user = await getAuthUser();

  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) throw new Error("Card not found");
  await verifyBoardAccess(card.boardId, user.id);

  if (sourceColId === destColId) {
    await prisma.card.update({
      where: { id: cardId },
      data: { order: newOrder }
    });
  } else {
    await prisma.card.update({
      where: { id: cardId },
      data: { columnId: destColId, order: newOrder }
    });

    const sourceCol = await prisma.column.findUnique({ where: { id: sourceColId } });
    const destCol = await prisma.column.findUnique({ where: { id: destColId } });
    await logActivity(card.boardId, user.id, 'card_moved', {
      cardTitle: card.title,
      fromColumn: sourceCol?.title,
      toColumn: destCol?.title,
    }, cardId);

    await runAutomations(card.boardId, 'card_moved_to', { cardId, columnId: destColId });
  }

  revalidatePath('/');
}

export async function updateCardAction(boardId: string, cardId: string, updates: Record<string, any>) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id);

  const data: Record<string, any> = {};
  const directFields = ['title', 'description', 'priority', 'coverImage', 'coverColor', 'timeSpent', 'isRecurring', 'recurringRule'];
  for (const key of directFields) {
    if (updates[key] !== undefined) data[key] = updates[key];
  }

  if (updates.dueDate !== undefined) {
    data.dueDate = updates.dueDate ? new Date(updates.dueDate) : null;
  }
  if (updates.timerStarted !== undefined) {
    data.timerStarted = updates.timerStarted ? new Date(updates.timerStarted) : null;
  }

  const jsonFields = ['labels', 'checklist', 'assigneeIds', 'blockedBy'];
  for (const key of jsonFields) {
    if (updates[key] !== undefined) data[key] = updates[key];
  }

  if (Object.keys(data).length > 0) {
    await prisma.card.update({ where: { id: cardId }, data });

    const changedFields = Object.keys(data);
    await logActivity(boardId, user.id, 'card_updated', { cardId, fields: changedFields }, cardId);

    if (updates.checklist) {
      const allDone = updates.checklist.length > 0 && updates.checklist.every((item: any) => item.done);
      if (allDone) {
        await runAutomations(boardId, 'checklist_completed', { cardId });
      }
    }
  }
  revalidatePath('/');
}

export async function deleteCardAction(boardId: string, cardId: string) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id);

  const card = await prisma.card.findUnique({ where: { id: cardId } });
  await prisma.card.delete({ where: { id: cardId } });
  if (card) {
    await logActivity(boardId, user.id, 'card_deleted', { cardTitle: card.title });
    await logAuditEvent(user.id, 'card_deleted', cardId, { cardTitle: card.title, boardId });
  }
  revalidatePath('/');
}

export async function bulkDeleteCardsAction(boardId: string, cardIds: string[]) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id);
  await prisma.card.deleteMany({ where: { id: { in: cardIds }, boardId } });
  await logActivity(boardId, user.id, 'cards_bulk_deleted', { count: cardIds.length });
  await logAuditEvent(user.id, 'cards_bulk_deleted', boardId, { count: cardIds.length, boardId });
  revalidatePath('/');
}

export async function bulkMoveCardsAction(boardId: string, cardIds: string[], targetColId: string) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id);
  await prisma.card.updateMany({
    where: { id: { in: cardIds }, boardId },
    data: { columnId: targetColId }
  });
  revalidatePath('/');
}

export async function bulkCopyCardsAction(boardId: string, cardIds: string[], targetColId: string) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id);

  const cardsToCopy = await prisma.card.findMany({
    where: { id: { in: cardIds }, boardId }
  });

  const newCardsData = cardsToCopy.map(c => ({
    title: c.title,
    description: c.description,
    boardId: c.boardId,
    columnId: targetColId,
    order: c.order,
    priority: c.priority,
    labels: c.labels as any,
    checklist: c.checklist as any,
    dueDate: c.dueDate,
    assigneeIds: c.assigneeIds ? (c.assigneeIds as any) : [],
    coverImage: c.coverImage,
    coverColor: c.coverColor,
  }));

  if (newCardsData.length > 0) {
    await prisma.card.createMany({ data: newCardsData });
  }
  revalidatePath('/');
}

// ── Member Actions ──────────────────────────────────────────────────────────

export async function inviteMemberAction(boardId: string, email: string, role: 'Admin' | 'Member') {
  const authUser = await getAuthUser();
  await verifyBoardAccess(boardId, authUser.id, 'Admin');

  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) throw new Error("Board not found");

  let invitedUser = await prisma.user.findUnique({ where: { email } });

  if (!invitedUser) {
    invitedUser = await prisma.user.create({
      data: {
        email,
        name: email.split('@')[0],
        username: email.split('@')[0] + '_' + Math.random().toString(36).substring(2, 8),
      }
    });
  }

  try {
    await prisma.member.create({
      data: { boardId, userId: invitedUser.id, role }
    });
  } catch (e) {
    console.error("User is already a member", e);
  }

  await logActivity(boardId, authUser.id, 'member_invited', { email, role });
  await logAuditEvent(authUser.id, 'member_invited', boardId, { email, role });

  try {
    const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const inviteLink = `${appUrl}/login`;

    await resend.emails.send({
      from: "magiclink@theeditorsingh.com",
      to: email,
      subject: `You have been invited to join the board "${board.title}"`,
      html: `<p>${authUser.name || authUser.email} has invited you to collaborate on the board <strong>${board.title}</strong> in Kordit.</p>
             <p>Click the link below to sign in or create an account to access the board:</p>
             <p><a href="${inviteLink}"><strong>Join Board</strong></a></p>
             <p>If you don't have an account, one has been reserved for you. Just sign in with this email!</p>`,
    });
  } catch (error) {
    console.error("Failed to send invite email", error);
    throw new Error("Failed to send invite email.");
  }

  revalidatePath('/');
}

// ── Comment Actions ─────────────────────────────────────────────────────────

export async function addCommentAction(boardId: string, cardId: string, content: string) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id);

  const comment = await prisma.comment.create({
    data: { cardId, userId: user.id, content },
    include: { user: { select: { name: true, username: true, image: true } } }
  });

  await logActivity(boardId, user.id, 'comment_added', { cardId, preview: content.substring(0, 50) }, cardId);
  revalidatePath('/');
  return comment;
}

export async function deleteCommentAction(boardId: string, commentId: string) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id);

  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment || comment.userId !== user.id) throw new Error("Unauthorized");

  await prisma.comment.delete({ where: { id: commentId } });
  revalidatePath('/');
}

// ── Automation Actions ──────────────────────────────────────────────────────

export async function createAutomationAction(
  boardId: string,
  name: string,
  trigger: string,
  condition: Record<string, any>,
  action: string,
  actionConfig: Record<string, any>
) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id, 'Admin');

  const automation = await prisma.automation.create({
    data: { boardId, name, trigger, condition, action, actionConfig }
  });

  await logActivity(boardId, user.id, 'automation_created', { name, trigger, action });
  revalidatePath('/');
  return automation;
}

export async function updateAutomationAction(boardId: string, automationId: string, updates: Record<string, any>) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id, 'Admin');

  const allowedFields = ['name', 'isActive', 'trigger', 'condition', 'action', 'actionConfig'];
  const data: Record<string, any> = {};
  for (const key of allowedFields) {
    if (updates[key] !== undefined) data[key] = updates[key];
  }

  await prisma.automation.update({ where: { id: automationId }, data });
  revalidatePath('/');
}

export async function deleteAutomationAction(boardId: string, automationId: string) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id, 'Admin');
  await prisma.automation.delete({ where: { id: automationId } });
  revalidatePath('/');
}

// ── Automation Engine ───────────────────────────────────────────────────────

async function runAutomations(boardId: string, triggerType: string, context: Record<string, any>) {
  try {
    const automations = await prisma.automation.findMany({
      where: { boardId, trigger: triggerType, isActive: true }
    });

    for (const auto of automations) {
      const condition = auto.condition as Record<string, any>;
      const actionConfig = auto.actionConfig as Record<string, any>;

      // Check condition
      if (triggerType === 'card_moved_to' && condition.columnId && condition.columnId !== context.columnId) {
        continue;
      }

      // Execute action
      switch (auto.action) {
        case 'move_card': {
          if (actionConfig.targetColumnId && context.cardId) {
            await prisma.card.update({
              where: { id: context.cardId },
              data: { columnId: actionConfig.targetColumnId }
            });
          }
          break;
        }
        case 'set_priority': {
          if (actionConfig.priority && context.cardId) {
            await prisma.card.update({
              where: { id: context.cardId },
              data: { priority: actionConfig.priority }
            });
          }
          break;
        }
        case 'complete_checklist': {
          if (context.cardId) {
            const card = await prisma.card.findUnique({ where: { id: context.cardId } });
            if (card) {
              const checklist = (card.checklist as any[]).map(item => ({ ...item, done: true }));
              await prisma.card.update({
                where: { id: context.cardId },
                data: { checklist }
              });
            }
          }
          break;
        }
        case 'set_due_date': {
          if (actionConfig.daysFromNow !== undefined && context.cardId) {
            const date = new Date();
            date.setDate(date.getDate() + actionConfig.daysFromNow);
            await prisma.card.update({
              where: { id: context.cardId },
              data: { dueDate: date }
            });
          }
          break;
        }
      }
    }
  } catch (e) {
    console.error("Automation execution error:", e);
  }
}

// ── Board Category Actions ──────────────────────────────────────────────────

export async function createBoardCategoryAction(name: string, color: string = '#0052CC') {
  const user = await getAuthUser();
  const category = await prisma.boardCategory.create({
    data: { name, color, userId: user.id }
  });
  return category;
}

export async function deleteBoardCategoryAction(categoryId: string) {
  const user = await getAuthUser();
  await prisma.boardCategory.delete({ where: { id: categoryId } });
  revalidatePath('/');
}
