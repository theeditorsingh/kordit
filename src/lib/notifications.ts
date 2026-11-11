import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export type NotificationKind = 'assignment' | 'comment' | 'mention' | 'invitation';

const preferenceField: Record<NotificationKind, 'assignments' | 'comments' | 'mentions' | 'invitations'> = {
  assignment: 'assignments',
  comment: 'comments',
  mention: 'mentions',
  invitation: 'invitations',
};

type CreateNotificationInput = {
  userId: string;
  actorId?: string;
  boardId?: string;
  cardId?: string;
  type: NotificationKind;
  message: string;
  metadata?: Record<string, unknown>;
};

export async function createNotification(input: CreateNotificationInput) {
  if (input.actorId && input.actorId === input.userId) return null;

  const preference = await prisma.notificationPreference.findUnique({
    where: { userId: input.userId },
  });
  const field = preferenceField[input.type];
  if (preference && !preference[field]) return null;

  return prisma.notification.create({
    data: {
      userId: input.userId,
      actorId: input.actorId,
      boardId: input.boardId,
      cardId: input.cardId,
      type: input.type,
      message: input.message.slice(0, 500),
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}

export async function createNotifications(inputs: CreateNotificationInput[]) {
  await Promise.all(inputs.map((input) => createNotification(input)));
}

export function mentionedUsernames(content: string) {
  return [...new Set(
    Array.from(content.matchAll(/(^|\s)@([a-zA-Z0-9_]{2,40})\b/g), (match) => match[2].toLowerCase()),
  )];
}
