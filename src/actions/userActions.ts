'use server';

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { isReservedUsername } from '@/utils/reservedUsernames';
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { decode, encode } from "next-auth/jwt";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // NextAuth's default JWT session lifetime

/**
 * After a password change every other session is revoked (sessionVersion bump).
 * This re-issues the current browser's session cookie with the new version so the
 * person who made the change stays signed in.
 */
async function refreshCurrentSessionVersion(sessionVersion: number) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return;
  const secure = (process.env.NEXTAUTH_URL ?? "").startsWith("https://");
  const name = `${secure ? "__Secure-" : ""}next-auth.session-token`;
  const store = await cookies();
  const current = store.get(name)?.value;
  if (!current) return;
  const token = await decode({ token: current, secret });
  if (!token) return;
  const value = await encode({ token: { ...token, sessionVersion, checkedAt: Date.now() }, secret, maxAge: SESSION_MAX_AGE });
  store.set(name, value, { httpOnly: true, sameSite: "lax", path: "/", secure, maxAge: SESSION_MAX_AGE });
}

// How long after a magic-link sign-in the current password may be skipped
const EMAIL_REAUTH_WINDOW_MS = 15 * 60 * 1000;

function hasRecentEmailAuth(user: { emailAuthAt?: number | null }) {
  return !!user.emailAuthAt && Date.now() - user.emailAuthAt < EMAIL_REAUTH_WINDOW_MS;
}

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
    // Reserved names clash with app routes; someone who already has one may keep it
    if (!(existing && existing.id === user.id) && isReservedUsername(trimmed)) {
      throw new Error("That username is reserved. Please choose another.");
    }
  }

  const data: Record<string, any> = {};
  if (name !== undefined) {
    if (typeof name !== 'string' || /[\u0000-\u001f\u007f<>]/.test(name)) throw new Error("Name contains characters that aren't allowed");
    data.name = name.trim().slice(0, 100);
  }
  if (username !== undefined) data.username = username.trim();
  if (image !== undefined) {
    // Avatars are shown to other members, so only accept a plain https URL
    const url = typeof image === 'string' ? image.trim() : '';
    if (url && (url.length > 500 || !/^https:\/\/[^\s"'()<>\\]+$/.test(url))) {
      throw new Error("Avatar must be an https:// image URL");
    }
    data.image = url || null;
  }

  if (Object.keys(data).length === 0) return;

  await prisma.user.update({ where: { id: user.id }, data });
  revalidatePath('/');
}

export async function changePasswordAction(currentPassword: string, newPassword: string) {
  const user = await getAuthUser();

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    throw new Error("New password must be at least 8 characters");
  }
  if (newPassword.length > 72) {
    // bcrypt ignores everything past 72 bytes
    throw new Error("New password must be at most 72 characters");
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) throw new Error("User not found");

  // If the account has a password, verify the current one first,
  // unless the user just signed in through a magic link (password reset).
  if (dbUser.password && !hasRecentEmailAuth(user)) {
    const valid = typeof currentPassword === 'string' && await bcrypt.compare(currentPassword, dbUser.password);
    if (!valid) throw new Error("Current password is incorrect");
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  // Bumping sessionVersion signs out every other session (stolen cookies included)
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed, sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
  await refreshCurrentSessionVersion(updated.sessionVersion);
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
      password: true,
      workspaceRole: true,
      _count: {
        select: {
          ownedBoards: true,
          comments: true,
        }
      }
    }
  });
  if (!dbUser) return null;
  // Return hasPassword flag (never expose actual hash to client)
  const { password, ...rest } = dbUser;
  // A fresh magic-link sign-in counts as "no password to confirm" for the UI
  return { ...rest, hasPassword: !!password && !hasRecentEmailAuth(user) };
}
