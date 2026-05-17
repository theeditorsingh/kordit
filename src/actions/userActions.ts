'use server';

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

async function getAuthUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user;
}

export interface UpdateProfileInput {
  name?: string;
  username?: string;
  image?: string;
}

export async function updateProfileAction(input: UpdateProfileInput) {
  const user = await getAuthUser();

  const { name, username, image } = input;

  // Validate username uniqueness if provided
  if (username !== undefined) {
    const trimmed = username.trim();
    if (!/^[a-z0-9_-]{3,32}$/.test(trimmed)) {
      throw new Error("Username must be 3–32 characters: lowercase letters, numbers, _ or -");
    }
    const existing = await prisma.user.findUnique({ where: { username: trimmed } });
    if (existing && existing.id !== user.id) {
      throw new Error("This username is already taken");
    }
  }

  const data: Record<string, any> = {};
  if (name !== undefined) data.name = name.trim().slice(0, 100);
  if (username !== undefined) data.username = username.trim();
  if (image !== undefined) data.image = image.trim() || null;

  if (Object.keys(data).length === 0) return;

  await prisma.user.update({ where: { id: user.id }, data });
  revalidatePath('/');
}

export async function changePasswordAction(currentPassword: string, newPassword: string) {
  const user = await getAuthUser();

  if (!newPassword || newPassword.length < 8) {
    throw new Error("New password must be at least 8 characters");
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) throw new Error("User not found");

  // If the account has a password, verify the current one first
  if (dbUser.password) {
    const valid = await bcrypt.compare(currentPassword, dbUser.password);
    if (!valid) throw new Error("Current password is incorrect");
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
}

export async function deleteAccountAction(confirmText: string) {
  const user = await getAuthUser();
  if (confirmText !== 'DELETE') throw new Error("Please type DELETE to confirm");

  // Delete user — cascade handles boards, cards, members, activities
  await prisma.user.delete({ where: { id: user.id } });
  revalidatePath('/');
}

export async function getCurrentUserAction() {
  const user = await getAuthUser();
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      image: true,
      workspaceRole: true,
      _count: {
        select: {
          ownedBoards: true,
          comments: true,
        }
      }
    }
  });
  return dbUser;
}
