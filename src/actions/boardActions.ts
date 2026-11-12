'use server';

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceRole, grantWorkspaceAccess } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { memberInclude } from "@/lib/boardQuery";
import type { BoardOp } from "@/utils/boardOps";
import { isValidBackground, isHexColor } from "@/utils/boardBackground";
import { sanitizeColumnSettings } from "@/utils/columnSettings";
import { createNotification, createNotifications, mentionedUsernames } from "@/lib/notifications";
import { LIMITS, enforce } from "@/lib/rateLimit";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const VISIBILITIES = ['Private', 'Workspace', 'Public'];

// ── Input sanitizing ────────────────────────────────────────────────────────
// Card fields arrive straight from the client, so shape-check everything before storing it.

const MAX_CARD_TITLE = 500;
const MAX_DESCRIPTION = 20000;
const MAX_LIST_ITEMS = 50;
const SAFE_IMAGE_URL = /^https:\/\/[^\s"'()<>\\]+$/;

function cleanString(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

/** A date from client input, or null when empty. Throws on anything unparseable. */
function parseOptionalDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error("Invalid date");
  const date = new Date(value);
  if (isNaN(date.getTime())) throw new Error("Invalid date");
  return date;
}

function cleanLabels(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_LIST_ITEMS)
    .filter((l): l is Record<string, unknown> => !!l && typeof l === 'object')
    .map((l) => ({
      id: cleanString(l.id, 64),
      name: cleanString(l.name, 50),
      color: typeof l.color === 'string' && isHexColor(l.color) ? l.color : '#0052CC',
    }));
}

function cleanChecklist(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 200)
    .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
    .map((i) => ({ id: cleanString(i.id, 64), text: cleanString(i.text, 500), done: i.done === true }));
}

function cleanCoverImage(value: unknown): string {
  const url = typeof value === 'string' ? value.trim() : '';
  if (url && (url.length > 500 || !SAFE_IMAGE_URL.test(url))) throw new Error("Cover image must be an https:// URL");
  return url;
}

function cleanCoverColor(value: unknown): string {
  const color = typeof value === 'string' ? value : '';
  if (color && !isHexColor(color)) throw new Error("Invalid colour");
  return color;
}

/** Keeps only ids of people who are members of the board (no notifying strangers). */
async function boardMemberIds(boardId: string, ids: unknown): Promise<string[]> {
  if (!Array.isArray(ids)) return [];
  const wanted = [...new Set(ids.filter((id): id is string => typeof id === 'string'))].slice(0, MAX_LIST_ITEMS);
  if (!wanted.length) return [];
  const members = await prisma.member.findMany({ where: { boardId, userId: { in: wanted } }, select: { userId: true } });
  const allowed = new Set(members.map((m) => m.userId));
  return wanted.filter((id) => allowed.has(id));
}

const AUTOMATION_TRIGGERS = ['card_moved_to', 'card_created', 'checklist_completed', 'due_date_passed'];
const AUTOMATION_ACTIONS = ['move_card', 'set_priority', 'complete_checklist', 'set_due_date'];

function cleanAutomationConfig(condition: unknown, actionConfig: unknown) {
  const c = (condition && typeof condition === 'object' ? condition : {}) as Record<string, unknown>;
  const a = (actionConfig && typeof actionConfig === 'object' ? actionConfig : {}) as Record<string, unknown>;
  const cleanCondition: Record<string, string> = {};
  if (typeof c.columnId === 'string' && ID_PATTERN.test(c.columnId)) cleanCondition.columnId = c.columnId;
  const cleanAction: Record<string, string | number> = {};
  if (typeof a.targetColumnId === 'string' && ID_PATTERN.test(a.targetColumnId)) cleanAction.targetColumnId = a.targetColumnId;
  if (typeof a.priority === 'string' && PRIORITIES.includes(a.priority)) cleanAction.priority = a.priority;
  if (a.daysFromNow !== undefined) {
    const days = Math.floor(Number(a.daysFromNow));
    if (!Number.isFinite(days) || days < 0 || days > 365) throw new Error("Days must be between 0 and 365");
    cleanAction.daysFromNow = days;
  }
  return { condition: cleanCondition, actionConfig: cleanAction };
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

export async function createBoardAction(title: string, customColumns?: { title: string, color: string }[], workspaceId?: string | null) {
  const user = await getAuthUser();
  const trimmedTitle = title?.trim();
  if (!trimmedTitle || trimmedTitle.length > 200) throw new Error("Board title must be 1-200 characters");
  const slug = generateSlug(trimmedTitle);

  if (customColumns !== undefined && (!Array.isArray(customColumns) || customColumns.length > 20)) {
    throw new Error("A board can start with at most 20 columns");
  }
  const columnsToCreate = customColumns
    ? customColumns.map((col, idx) => ({
        title: cleanString(col?.title, 100).trim() || 'Untitled',
        color: typeof col?.color === 'string' && isHexColor(col.color) ? col.color : '#0052CC',
        order: idx,
      }))
    : [
        { title: 'To Do', order: 0, color: '#0052CC' },
        { title: 'In Progress', order: 1, color: '#FF991F' },
        { title: 'Review', order: 2, color: '#6554C0' },
        { title: 'Done', order: 3, color: '#36B37E' },
      ];

  // A chosen workspace must be one the user belongs to; otherwise keep the original
  // behaviour and use the user's first workspace (if any).
  if (workspaceId && !(await requireWorkspaceRole(user.id, workspaceId))) {
    throw new Error("You are not a member of this workspace");
  }
  const workspaceMembership = await prisma.workspaceMember.findFirst({
    where: workspaceId ? { userId: user.id, workspaceId } : { userId: user.id },
    select: { workspaceId: true, workspace: { select: { members: { select: { userId: true, role: true } } } } },
    orderBy: { createdAt: 'asc' },
  });
  const initialMembers = workspaceMembership
    ? workspaceMembership.workspace.members.map((member) => ({ userId: member.userId, role: member.role === 'Owner' ? 'Admin' : member.role }))
    : [{ userId: user.id, role: 'Admin' }];

  const board = await prisma.board.create({
    data: {
      title: trimmedTitle,
      slug,
      ownerId: user.id,
      workspaceId: workspaceMembership?.workspaceId,
      columns: { create: columnsToCreate },
      members: { create: initialMembers }
    },
    include: {
      columns: true,
      members: memberInclude,
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
  // Who can see the board, and which workspace holds it, are admin decisions; everything else any member may change
  const adminOnly = updates.visibility !== undefined || updates.workspaceId !== undefined;
  await verifyBoardAccess(boardId, user.id, adminOnly ? 'Admin' : undefined);

  // Moving to another workspace: the user must belong to it (null takes it out of any workspace)
  if (updates.workspaceId !== undefined) {
    if (updates.workspaceId !== null && (typeof updates.workspaceId !== 'string' || !(await requireWorkspaceRole(user.id, updates.workspaceId)))) {
      throw new Error("You are not a member of that workspace");
    }
  }
  if (updates.visibility !== undefined && !VISIBILITIES.includes(updates.visibility)) {
    throw new Error("Invalid visibility");
  }
  if (updates.title !== undefined) {
    const title = typeof updates.title === 'string' ? updates.title.trim() : '';
    if (!title || title.length > 200) throw new Error("Board title must be 1-200 characters");
    updates = { ...updates, title };
  }

  // A background is stored as CSS, so only accept the exact shapes the picker produces
  if (updates.background !== undefined || updates.backgroundType !== undefined) {
    if (!isValidBackground(updates.backgroundType, updates.background)) throw new Error("Invalid background");
  }

  // Saved label colours: a short list of hex codes
  if (updates.labelColors !== undefined) {
    const colors = updates.labelColors;
    if (!Array.isArray(colors) || colors.length > 30 || !colors.every((c: unknown) => typeof c === 'string' && isHexColor(c))) {
      throw new Error("Invalid colours");
    }
  }

  const allowedFields = ['title', 'color', 'background', 'backgroundType', 'visibility', 'labelColors', 'workspaceId'];
  const data: Record<string, any> = {};
  for (const key of allowedFields) {
    if (updates[key] !== undefined) data[key] = updates[key];
  }

  if (Object.keys(data).length > 0) {
    const board = await prisma.board.update({ where: { id: boardId }, data, select: { workspaceId: true, visibility: true } });
    // A workspace-visible board in a workspace is open to that workspace's members
    // (the same rule the Team invite flow applies). Leaving a workspace revokes no one.
    if (('workspaceId' in data || 'visibility' in data) && board.workspaceId && board.visibility === 'Workspace') {
      await grantWorkspaceAccess(board.workspaceId, boardId);
    }
    await logActivity(boardId, user.id, 'board_updated', { fields: Object.keys(data) });
  }
}

export async function toggleBoardFavoriteAction(boardId: string) {
  const user = await getAuthUser();
  // A star is personal, so it lives on the member row and guests may use it too
  const member = await prisma.member.findUnique({
    where: { boardId_userId: { boardId, userId: user.id } }
  });
  if (!member) throw new Error("Unauthorized");
  await prisma.member.update({ where: { id: member.id }, data: { isFavorite: !member.isFavorite } });
}

export async function archiveBoardAction(boardId: string) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id, 'Admin');
  await prisma.board.update({ where: { id: boardId }, data: { isArchived: true } });
  await logActivity(boardId, user.id, 'board_archived', {});
}

export async function unarchiveBoardAction(boardId: string) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id, 'Admin');
  await prisma.board.update({ where: { id: boardId }, data: { isArchived: false } });
  await logActivity(boardId, user.id, 'board_unarchived', {});
  revalidatePath('/');
}

export async function getArchivedBoardsAction() {
  const user = await getAuthUser();
  const boards = await prisma.board.findMany({
    where: {
      members: { some: { userId: user.id } },
      isArchived: true,
    },
    orderBy: { createdAt: 'desc' }
  });
  return boards;
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
      labelColors: board.labelColors as any,
      columns: {
        create: board.columns.map((col, idx) => ({
          title: col.title,
          color: col.color,
          icon: col.icon,
          wipLimit: col.wipLimit,
          settings: col.settings as any,
          order: idx,
        }))
      },
      members: { create: [{ userId: user.id, role: 'Admin' }] }
    },
    include: { columns: true, members: memberInclude }
  });

  revalidatePath('/');
  return newBoard;
}

// ── Column Actions ──────────────────────────────────────────────────────────

export async function createColumnAction(boardId: string, title: string) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id);
  const trimmedTitle = title?.trim();
  if (!trimmedTitle || trimmedTitle.length > 100) throw new Error("Column title must be 1-100 characters");

  const lastCol = await prisma.column.findFirst({
    where: { boardId },
    orderBy: { order: 'desc' }
  });

  const column = await prisma.column.create({
    data: { title: trimmedTitle, boardId, order: lastCol ? lastCol.order + 1 : 0 }
  });

  await logActivity(boardId, user.id, 'column_created', { columnTitle: trimmedTitle });
  return column;
}

export async function moveColumnAction(boardId: string, columnOrders: { id: string; order: number }[]) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id);

  const columnIds = columnOrders.map(c => c.id);
  const columns = await prisma.column.findMany({ where: { id: { in: columnIds } } });
  if (columns.some(c => c.boardId !== boardId)) throw new Error("Unauthorized");

  await prisma.$transaction(
    columnOrders.map(({ id, order }) =>
      prisma.column.update({ where: { id }, data: { order } })
    )
  );
}

export async function updateColumnAction(boardId: string, columnId: string, updates: Record<string, any>) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id);

  const column = await prisma.column.findUnique({ where: { id: columnId } });
  if (column?.boardId !== boardId) throw new Error("Unauthorized");

  const data: Record<string, any> = {};
  if (updates.title !== undefined) {
    const title = typeof updates.title === 'string' ? updates.title.trim() : '';
    if (!title || title.length > 100) throw new Error("Column title must be 1-100 characters");
    data.title = title;
  }
  if (updates.color !== undefined) {
    if (typeof updates.color !== 'string' || !isHexColor(updates.color)) throw new Error("Invalid colour");
    data.color = updates.color;
  }
  if (updates.icon !== undefined) data.icon = String(updates.icon).slice(0, 32);
  if (updates.wipLimit !== undefined) data.wipLimit = Math.max(0, Math.floor(Number(updates.wipLimit) || 0));
  if (updates.settings !== undefined) data.settings = sanitizeColumnSettings(updates.settings);

  if (Object.keys(data).length > 0) {
    await prisma.column.update({ where: { id: columnId }, data });
  }
}

export async function deleteColumnAction(boardId: string, columnId: string) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id);

  const column = await prisma.column.findUnique({ where: { id: columnId } });
  if (column?.boardId !== boardId) throw new Error("Unauthorized");

  await prisma.column.delete({ where: { id: columnId } });
  if (column) {
    await logActivity(boardId, user.id, 'column_deleted', { columnTitle: column.title });
    await logAuditEvent(user.id, 'column_deleted', columnId, { columnTitle: column.title, boardId });
  }
}

// ── Card Actions ────────────────────────────────────────────────────────────

export async function createCardAction(boardId: string, columnId: string, title: string, description: string = '', dueDate: string | null = null) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id);
  const trimmedTitle = title?.trim();
  if (!trimmedTitle || trimmedTitle.length > 500) throw new Error("Card title must be 1-500 characters");

  const column = await prisma.column.findUnique({ where: { id: columnId } });
  if (column?.boardId !== boardId) throw new Error("Unauthorized");
  // The column can give its new cards a starting priority and label
  const colSettings = sanitizeColumnSettings(column.settings);

  const lastCard = await prisma.card.findFirst({
    where: { columnId },
    orderBy: { order: 'desc' }
  });

  const card = await prisma.card.create({
    data: {
      title: trimmedTitle,
      description: cleanString(description, MAX_DESCRIPTION),
      boardId,
      columnId,
      order: lastCard ? lastCard.order + 1 : 0,
      dueDate: parseOptionalDate(dueDate),
      ...(colSettings.defaultPriority ? { priority: colSettings.defaultPriority } : {}),
      ...(colSettings.defaultLabel ? { labels: [colSettings.defaultLabel] as any } : {}),
    }
  });

  await logActivity(boardId, user.id, 'card_created', { cardTitle: trimmedTitle, columnId }, card.id);
  await runAutomations(boardId, 'card_created', { cardId: card.id, columnId });
  return card;
}

export async function moveCardAction(cardId: string, sourceColId: string, destColId: string, newOrder: number) {
  const user = await getAuthUser();

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { board: { select: { title: true } } },
  });
  if (!card) throw new Error("Card not found");
  await verifyBoardAccess(card.boardId, user.id);

  // Trust the database, not the client, for where the card currently is,
  // and make sure the destination column is on the same board.
  sourceColId = card.columnId;
  let completeOnArrival = false;
  if (destColId !== sourceColId) {
    const destColumn = await prisma.column.findUnique({ where: { id: destColId } });
    if (destColumn?.boardId !== card.boardId) throw new Error("Unauthorized");
    // Column setting: cards moved here are marked completed
    completeOnArrival = !!sanitizeColumnSettings(destColumn.settings).autoComplete && !card.completedAt;
  }

  // Move the card to its new column/position first
  if (sourceColId === destColId) {
    // Reorder within the same column
    const colCards = await prisma.card.findMany({
      where: { columnId: sourceColId },
      orderBy: { order: 'asc' },
    });

    // Remove the card from its current position and insert at newOrder
    const filtered = colCards.filter(c => c.id !== cardId);
    const movedCard = colCards.find(c => c.id === cardId)!;
    filtered.splice(newOrder, 0, movedCard);

    // Batch-update all order values in a transaction
    await prisma.$transaction(
      filtered.map((c, idx) =>
        prisma.card.update({ where: { id: c.id }, data: { order: idx } })
      )
    );
  } else {
    // Move across columns — update column assignment
    await prisma.card.update({
      where: { id: cardId },
      data: { columnId: destColId, ...(completeOnArrival ? { completedAt: new Date() } : {}) }
    });

    // Reorder source column (close the gap)
    const srcCards = await prisma.card.findMany({
      where: { columnId: sourceColId },
      orderBy: { order: 'asc' },
    });
    // Reorder destination column (insert at newOrder)
    const dstCards = await prisma.card.findMany({
      where: { columnId: destColId },
      orderBy: { order: 'asc' },
    });

    // In dst, the moved card is already there from the update above.
    // Remove it and re-insert at the desired position.
    const dstFiltered = dstCards.filter(c => c.id !== cardId);
    const movedCard = dstCards.find(c => c.id === cardId)!;
    dstFiltered.splice(newOrder, 0, movedCard);

    // Batch-update both columns in a single transaction
    await prisma.$transaction([
      ...srcCards.map((c, idx) =>
        prisma.card.update({ where: { id: c.id }, data: { order: idx } })
      ),
      ...dstFiltered.map((c, idx) =>
        prisma.card.update({ where: { id: c.id }, data: { order: idx } })
      ),
    ]);

    const sourceCol = await prisma.column.findUnique({ where: { id: sourceColId } });
    const destCol = await prisma.column.findUnique({ where: { id: destColId } });
    await logActivity(card.boardId, user.id, 'card_moved', {
      cardTitle: card.title,
      fromColumn: sourceCol?.title,
      toColumn: destCol?.title,
    }, cardId);

    await runAutomations(card.boardId, 'card_moved_to', { cardId, columnId: destColId });
  }
}

export async function updateCardAction(boardId: string, cardId: string, updates: Record<string, any>) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id);

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { board: { select: { title: true } } },
  });
  if (card?.boardId !== boardId) throw new Error("Unauthorized");

  if (!updates || typeof updates !== 'object') throw new Error("Invalid request");
  const data: Record<string, any> = {};
  if (updates.title !== undefined) {
    const title = typeof updates.title === 'string' ? updates.title.trim() : '';
    if (!title || title.length > MAX_CARD_TITLE) throw new Error("Card title must be 1-500 characters");
    data.title = title;
  }
  if (updates.description !== undefined) data.description = cleanString(updates.description, MAX_DESCRIPTION);
  if (updates.priority !== undefined) {
    if (!PRIORITIES.includes(updates.priority)) throw new Error("Invalid priority");
    data.priority = updates.priority;
  }
  if (updates.coverImage !== undefined) data.coverImage = cleanCoverImage(updates.coverImage);
  if (updates.coverColor !== undefined) data.coverColor = cleanCoverColor(updates.coverColor);

  if (updates.dueDate !== undefined) data.dueDate = parseOptionalDate(updates.dueDate);
  if (updates.reminderAt !== undefined) data.reminderAt = parseOptionalDate(updates.reminderAt);
  if (updates.completedAt !== undefined) data.completedAt = parseOptionalDate(updates.completedAt);

  if (updates.labels !== undefined) data.labels = cleanLabels(updates.labels);
  if (updates.checklist !== undefined) data.checklist = cleanChecklist(updates.checklist);
  if (updates.assigneeIds !== undefined) data.assigneeIds = await boardMemberIds(boardId, updates.assigneeIds);

  if (Object.keys(data).length > 0) {
    await prisma.card.update({ where: { id: cardId }, data });

    if (Array.isArray(data.assigneeIds)) {
      const previous = Array.isArray(card.assigneeIds) ? card.assigneeIds.filter((id): id is string => typeof id === 'string') : [];
      const added = (data.assigneeIds as string[]).filter((id) => !previous.includes(id));
      if (added.length) {
        const actor = user.name || user.email || 'A teammate';
        await createNotifications(added.map((userId) => ({
          userId,
          actorId: user.id,
          boardId,
          cardId,
          type: 'assignment',
          message: `${actor} assigned you to “${card.title}” on ${card.board.title}`,
        })));
      }
    }

    const changedFields = Object.keys(data);
    await logActivity(boardId, user.id, 'card_updated', { cardId, fields: changedFields }, cardId);

    if (data.checklist) {
      const allDone = data.checklist.length > 0 && data.checklist.every((item: { done: boolean }) => item.done);
      if (allDone) {
        await runAutomations(boardId, 'checklist_completed', { cardId });
      }
    }
  }
}

export async function deleteCardAction(boardId: string, cardId: string) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id);

  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (card?.boardId !== boardId) throw new Error("Unauthorized");

  const columnId = card.columnId;
  await prisma.card.delete({ where: { id: cardId } });

  // Reorder remaining cards in the column to close the gap
  const remaining = await prisma.card.findMany({
    where: { columnId },
    orderBy: { order: 'asc' },
  });
  if (remaining.length > 0) {
    await prisma.$transaction(
      remaining.map((c, idx) =>
        prisma.card.update({ where: { id: c.id }, data: { order: idx } })
      )
    );
  }

  if (card) {
    await logActivity(boardId, user.id, 'card_deleted', { cardTitle: card.title });
    await logAuditEvent(user.id, 'card_deleted', cardId, { cardTitle: card.title, boardId });
  }
}

export async function bulkDeleteCardsAction(boardId: string, cardIds: string[]) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id);
  if (!Array.isArray(cardIds) || cardIds.length > 1000) throw new Error("Invalid request");
  await prisma.card.deleteMany({ where: { id: { in: cardIds }, boardId } });
  await logActivity(boardId, user.id, 'cards_bulk_deleted', { count: cardIds.length });
  await logAuditEvent(user.id, 'cards_bulk_deleted', boardId, { count: cardIds.length, boardId });
}

export async function bulkMoveCardsAction(boardId: string, cardIds: string[], targetColId: string) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id);

  const targetCol = await prisma.column.findUnique({ where: { id: targetColId } });
  if (targetCol?.boardId !== boardId) throw new Error("Unauthorized");

  // Find affected source columns before moving
  const cardsToMove = await prisma.card.findMany({
    where: { id: { in: cardIds }, boardId },
  });
  const sourceColIds = [...new Set(cardsToMove.map(c => c.columnId))];

  // Column setting: cards moved here are marked completed
  if (sanitizeColumnSettings(targetCol.settings).autoComplete) {
    await prisma.card.updateMany({
      where: { id: { in: cardIds }, boardId, completedAt: null, NOT: { columnId: targetColId } },
      data: { completedAt: new Date() }
    });
  }

  await prisma.card.updateMany({
    where: { id: { in: cardIds }, boardId },
    data: { columnId: targetColId }
  });

  // Reorder all affected columns (sources + target)
  const allAffectedColIds = [...new Set([...sourceColIds, targetColId])];
  const reorderOps = [];
  for (const colId of allAffectedColIds) {
    const colCards = await prisma.card.findMany({
      where: { columnId: colId },
      orderBy: { order: 'asc' },
    });
    reorderOps.push(
      ...colCards.map((c, idx) =>
        prisma.card.update({ where: { id: c.id }, data: { order: idx } })
      )
    );
  }
  if (reorderOps.length > 0) {
    await prisma.$transaction(reorderOps);
  }
}

export async function bulkCopyCardsAction(boardId: string, cardIds: string[], targetColId: string) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id);

  const targetCol = await prisma.column.findUnique({ where: { id: targetColId } });
  if (targetCol?.boardId !== boardId) throw new Error("Unauthorized");

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
}

export async function moveCardAcrossBoardsAction(cardId: string, targetBoardId: string, targetColumnId: string) {
  const user = await getAuthUser();
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) throw new Error('Card not found');
  await verifyBoardAccess(card.boardId, user.id);
  await verifyBoardAccess(targetBoardId, user.id);
  const targetColumn = await prisma.column.findUnique({ where: { id: targetColumnId } });
  if (!targetColumn || targetColumn.boardId !== targetBoardId) throw new Error('Invalid destination column');

  const [last, targetMembers] = await Promise.all([
    prisma.card.aggregate({ where: { columnId: targetColumnId }, _max: { order: true } }),
    prisma.member.findMany({ where: { boardId: targetBoardId }, select: { userId: true } }),
  ]);
  const allowed = new Set(targetMembers.map((member) => member.userId));
  const assigneeIds = Array.isArray(card.assigneeIds) ? card.assigneeIds.filter((id): id is string => typeof id === 'string' && allowed.has(id)) : [];
  const oldBoardId = card.boardId;
  await prisma.card.update({
    where: { id: cardId },
    data: { boardId: targetBoardId, columnId: targetColumnId, assigneeIds, order: (last._max.order ?? -1) + 1 },
  });
  await logActivity(oldBoardId, user.id, 'card_moved_out', { cardTitle: card.title, targetBoardId });
  await logActivity(targetBoardId, user.id, 'card_moved_in', { cardTitle: card.title, sourceBoardId: oldBoardId }, cardId);
  revalidatePath('/');
}

export async function copyCardAcrossBoardsAction(cardId: string, targetBoardId: string, targetColumnId: string) {
  const user = await getAuthUser();
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) throw new Error('Card not found');
  await verifyBoardAccess(card.boardId, user.id);
  await verifyBoardAccess(targetBoardId, user.id);
  const targetColumn = await prisma.column.findUnique({ where: { id: targetColumnId } });
  if (!targetColumn || targetColumn.boardId !== targetBoardId) throw new Error('Invalid destination column');

  const [last, targetMembers] = await Promise.all([
    prisma.card.aggregate({ where: { columnId: targetColumnId }, _max: { order: true } }),
    prisma.member.findMany({ where: { boardId: targetBoardId }, select: { userId: true } }),
  ]);
  const allowed = new Set(targetMembers.map((member) => member.userId));
  const assigneeIds = Array.isArray(card.assigneeIds) ? card.assigneeIds.filter((id): id is string => typeof id === 'string' && allowed.has(id)) : [];
  const copy = await prisma.card.create({
    data: {
      title: `${card.title} (copy)`,
      description: card.description,
      priority: card.priority,
      dueDate: card.dueDate,
      reminderAt: card.reminderAt,
      coverImage: card.coverImage,
      coverColor: card.coverColor,
      labels: card.labels as any,
      checklist: card.checklist as any,
      assigneeIds,
      boardId: targetBoardId,
      columnId: targetColumnId,
      order: (last._max.order ?? -1) + 1,
    },
  });
  await logActivity(targetBoardId, user.id, 'card_copied_in', { cardTitle: card.title, sourceBoardId: card.boardId }, copy.id);
  revalidatePath('/');
  return copy.id;
}

// ── Undo / Redo ─────────────────────────────────────────────────────────────

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const PRIORITIES = ['none', 'urgent', 'high', 'medium', 'low'];

function assertId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) throw new Error("Invalid request");
}

/**
 * Applies the operations produced by an undo or redo (see utils/boardOps.ts).
 * Everything is checked against the board: an id either already belongs to this
 * board or does not exist yet (a deleted card/column being restored).
 * Comments on a card that was deleted and then restored are not brought back.
 */
export async function applyBoardOpsAction(boardId: string, ops: BoardOp[]) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id);
  if (!Array.isArray(ops) || ops.length === 0 || ops.length > 500) throw new Error("Invalid request");

  await prisma.$transaction(async (tx) => {
    // 1. Columns first, so restored cards have somewhere to go
    for (const op of ops) {
      if (op.type !== 'upsertColumn') continue;
      const col = op.column;
      assertId(col.id);
      const existing = await tx.column.findUnique({ where: { id: col.id } });
      if (existing && existing.boardId !== boardId) throw new Error("Unauthorized");
      const data = {
        title: String(col.title ?? '').trim().slice(0, 100) || 'Untitled',
        color: String(col.color ?? '#0052CC').slice(0, 32),
        icon: String(col.icon ?? '').slice(0, 32),
        wipLimit: Math.max(0, Math.floor(Number(col.wipLimit) || 0)),
        settings: sanitizeColumnSettings(col.settings) as any,
      };
      if (existing) await tx.column.update({ where: { id: col.id }, data });
      else await tx.column.create({ data: { id: col.id, boardId, order: Math.max(0, Number(op.index) || 0), ...data } });
    }

    // 2. Cards: restore deleted ones, or put edited fields back
    for (const op of ops) {
      if (op.type !== 'upsertCard') continue;
      const card = op.card;
      assertId(card.id);
      assertId(op.columnId);
      const column = await tx.column.findUnique({ where: { id: op.columnId } });
      if (column?.boardId !== boardId) continue; // column no longer exists
      const existing = await tx.card.findUnique({ where: { id: card.id } });
      if (existing && existing.boardId !== boardId) throw new Error("Unauthorized");
      const coverImage = typeof card.coverImage === 'string' ? card.coverImage.trim() : '';
      const coverColor = typeof card.coverColor === 'string' ? card.coverColor : '';
      const data = {
        title: String(card.title ?? '').trim().slice(0, MAX_CARD_TITLE) || 'Untitled',
        description: cleanString(card.description, MAX_DESCRIPTION),
        priority: PRIORITIES.includes(card.priority) ? card.priority : 'none',
        dueDate: parseOptionalDate(card.dueDate),
        reminderAt: parseOptionalDate(card.reminderAt),
        completedAt: parseOptionalDate(card.completedAt),
        // Undo restores old values: drop anything unsafe rather than fail the whole undo
        coverImage: coverImage.length <= 500 && SAFE_IMAGE_URL.test(coverImage) ? coverImage : '',
        coverColor: isHexColor(coverColor) ? coverColor : '',
        labels: cleanLabels(card.labels) as any,
        checklist: cleanChecklist(card.checklist) as any,
        assigneeIds: (await boardMemberIds(boardId, card.assigneeIds)) as any,
      };
      if (existing) {
        await tx.card.update({ where: { id: card.id }, data });
      } else {
        const createdAt = card.createdAt ? new Date(card.createdAt) : new Date();
        await tx.card.create({
          data: {
            id: card.id, boardId, columnId: op.columnId, order: 0, ...data,
            ...(isNaN(createdAt.getTime()) ? {} : { createdAt }),
          },
        });
      }
    }

    // 3. Removals
    for (const op of ops) {
      if (op.type === 'deleteCard') {
        assertId(op.cardId);
        await tx.card.deleteMany({ where: { id: op.cardId, boardId } });
      } else if (op.type === 'deleteColumn') {
        assertId(op.columnId);
        await tx.column.deleteMany({ where: { id: op.columnId, boardId } });
      }
    }

    // 4. Positions
    for (const op of ops) {
      if (op.type === 'setCardOrder') {
        assertId(op.columnId);
        const column = await tx.column.findUnique({ where: { id: op.columnId } });
        if (column?.boardId !== boardId || !Array.isArray(op.cardIds)) continue;
        for (let i = 0; i < op.cardIds.length; i++) {
          assertId(op.cardIds[i]);
          await tx.card.updateMany({ where: { id: op.cardIds[i], boardId }, data: { columnId: op.columnId, order: i } });
        }
      } else if (op.type === 'setColumnOrder' && Array.isArray(op.columnIds)) {
        for (let i = 0; i < op.columnIds.length; i++) {
          assertId(op.columnIds[i]);
          await tx.column.updateMany({ where: { id: op.columnIds[i], boardId }, data: { order: i } });
        }
      }
    }
  }, { timeout: 30000, maxWait: 10000 });

  await logActivity(boardId, user.id, 'undo_redo', { changes: ops.length });
}

// ── Member Actions ──────────────────────────────────────────────────────────

export async function inviteMemberAction(boardId: string, email: string, role: 'Admin' | 'Member') {
  const authUser = await getAuthUser();
  await verifyBoardAccess(boardId, authUser.id, 'Admin');

  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) throw new Error("Board not found");

  email = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error("Please enter a valid email address");
  }
  if (role !== 'Admin' && role !== 'Member') throw new Error("Invalid role");
  // Each invite sends an email, so cap how many one person can send
  await enforce(`invite:${authUser.id}`, LIMITS.invites, "Too many invites. Please try again later.");

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

    await getResend().emails.send({
      from: process.env.EMAIL_FROM || "magiclink@theeditorsingh.com",
      to: email,
      subject: `You have been invited to join the board "${board.title}"`,
      html: `<p>${escapeHtml(authUser.name || authUser.email || 'Someone')} has invited you to collaborate on the board <strong>${escapeHtml(board.title)}</strong> in Kordit.</p>
             <p>Click the link below to sign in or create an account to access the board:</p>
             <p><a href="${inviteLink}"><strong>Join Board</strong></a></p>
             <p>If you don't have an account, one has been reserved for you. Just sign in with this email!</p>`,
    });
  } catch (error) {
    console.error("Failed to send invite email", error);
    throw new Error("Failed to send invite email.");
  }

  await createNotification({
    userId: invitedUser.id,
    actorId: authUser.id,
    boardId,
    type: 'invitation',
    message: `${authUser.name || authUser.email || 'A teammate'} invited you to “${board.title}”`,
  });

  revalidatePath('/');
}

export async function removeMemberAction(boardId: string, userId: string) {
  const authUser = await getAuthUser();
  await verifyBoardAccess(boardId, authUser.id, 'Admin');

  const memberToRemove = await prisma.member.findUnique({ 
    where: { boardId_userId: { boardId, userId } } 
  });
  if (!memberToRemove) throw new Error("Member not found");

  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (board?.ownerId === userId) {
    throw new Error("Cannot remove the board owner");
  }

  await prisma.member.delete({ 
    where: { boardId_userId: { boardId, userId } } 
  });
  await logActivity(boardId, authUser.id, 'member_removed', { removedUserId: userId });
  await logAuditEvent(authUser.id, 'member_removed', boardId, { removedUserId: userId });
  revalidatePath('/');
}

// ── Comment Actions ─────────────────────────────────────────────────────────

export async function addCommentAction(boardId: string, cardId: string, content: string) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id);

  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (card?.boardId !== boardId) throw new Error("Unauthorized");

  content = typeof content === 'string' ? content.trim() : '';
  if (!content || content.length > 5000) throw new Error("Comment must be 1-5000 characters");

  const comment = await prisma.comment.create({
    data: { cardId, userId: user.id, content },
    include: { user: { select: { name: true, username: true, image: true } } }
  });

  const actor = user.name || user.email || 'A teammate';
  const assigneeIds = Array.isArray(card.assigneeIds)
    ? card.assigneeIds.filter((id): id is string => typeof id === 'string')
    : [];
  const usernames = mentionedUsernames(content);
  const mentionedMembers = usernames.length
    ? await prisma.member.findMany({
        where: { boardId, user: { username: { in: usernames, mode: 'insensitive' } } },
        select: { userId: true },
      })
    : [];
  const mentionedIds = new Set(mentionedMembers.map((member) => member.userId));
  const recipients = new Set([...assigneeIds, ...mentionedIds]);
  recipients.delete(user.id);
  await createNotifications([...recipients].map((userId) => ({
    userId,
    actorId: user.id,
    boardId,
    cardId,
    type: mentionedIds.has(userId) ? 'mention' : 'comment',
    message: mentionedIds.has(userId)
      ? `${actor} mentioned you on “${card.title}”`
      : `${actor} commented on “${card.title}”: ${content.slice(0, 90)}`,
  })));

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

  const cleanName = cleanString(name, 100).trim();
  if (!cleanName) throw new Error("Automation name is required");
  if (!AUTOMATION_TRIGGERS.includes(trigger)) throw new Error("Invalid trigger");
  if (!AUTOMATION_ACTIONS.includes(action)) throw new Error("Invalid action");
  const clean = cleanAutomationConfig(condition, actionConfig);

  const automation = await prisma.automation.create({
    data: { boardId, name: cleanName, trigger, condition: clean.condition, action, actionConfig: clean.actionConfig }
  });

  await logActivity(boardId, user.id, 'automation_created', { name, trigger, action });
  revalidatePath('/');
  return automation;
}

export async function updateAutomationAction(boardId: string, automationId: string, updates: Record<string, any>) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id, 'Admin');

  const auto = await prisma.automation.findUnique({ where: { id: automationId } });
  if (auto?.boardId !== boardId) throw new Error("Unauthorized");

  if (!updates || typeof updates !== 'object') throw new Error("Invalid request");
  const data: Record<string, any> = {};
  if (updates.name !== undefined) {
    const name = cleanString(updates.name, 100).trim();
    if (!name) throw new Error("Automation name is required");
    data.name = name;
  }
  if (updates.isActive !== undefined) data.isActive = updates.isActive === true;
  if (updates.trigger !== undefined) {
    if (!AUTOMATION_TRIGGERS.includes(updates.trigger)) throw new Error("Invalid trigger");
    data.trigger = updates.trigger;
  }
  if (updates.action !== undefined) {
    if (!AUTOMATION_ACTIONS.includes(updates.action)) throw new Error("Invalid action");
    data.action = updates.action;
  }
  if (updates.condition !== undefined || updates.actionConfig !== undefined) {
    const clean = cleanAutomationConfig(updates.condition ?? auto.condition, updates.actionConfig ?? auto.actionConfig);
    if (updates.condition !== undefined) data.condition = clean.condition;
    if (updates.actionConfig !== undefined) data.actionConfig = clean.actionConfig;
  }

  await prisma.automation.update({ where: { id: automationId }, data });
  revalidatePath('/');
}

export async function deleteAutomationAction(boardId: string, automationId: string) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id, 'Admin');

  const auto = await prisma.automation.findUnique({ where: { id: automationId } });
  if (auto?.boardId !== boardId) throw new Error("Unauthorized");

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
            // Only move within this board
            const target = await prisma.column.findUnique({ where: { id: actionConfig.targetColumnId } });
            if (target?.boardId !== boardId) break;
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


// ── Board Label Library Actions ─────────────────────────────────────────────

export async function getBoardLabelsAction(boardId: string) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id);
  return prisma.boardLabel.findMany({
    where: { boardId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function upsertBoardLabelAction(boardId: string, name: string, color: string) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id);
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) throw new Error('Label name cannot be empty');
  if (trimmed.length > 50) throw new Error('Label name must be at most 50 characters');
  if (typeof color !== 'string' || !isHexColor(color)) throw new Error('Invalid colour');
  return prisma.boardLabel.upsert({
    where: { boardId_name: { boardId, name: trimmed } },
    update: { color },
    create: { boardId, name: trimmed, color },
  });
}

export async function deleteBoardLabelAction(boardId: string, labelId: string) {
  const user = await getAuthUser();
  await verifyBoardAccess(boardId, user.id);
  // Only the entry in the board's label list goes. Cards keep their own copy of
  // the label, so nothing already on a card changes.
  await prisma.boardLabel.deleteMany({ where: { id: labelId, boardId } });
}
