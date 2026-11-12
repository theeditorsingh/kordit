import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { isReservedUsername } from '@/utils/reservedUsernames';
import bcrypt from "bcryptjs";

// Same rule as updateProfileAction, so both paths produce the same kind of username
const USERNAME = /^[a-z0-9_-]{3,32}$/;

/**
 * One-time account setup: pick a username and, optionally, a first password.
 * Once a username exists this endpoint is closed. Changing the password afterwards
 * goes through changePasswordAction, which asks for the current one.
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const username = body?.username;
    const password = body?.password;

    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, username: true, password: true },
    });
    if (!dbUser) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    if (dbUser.username) {
      return new NextResponse("Onboarding is already complete", { status: 409 });
    }

    if (!username || typeof username !== "string") {
      return new NextResponse("Username is required", { status: 400 });
    }

    const trimmedUsername = username.trim().toLowerCase();
    if (!USERNAME.test(trimmedUsername)) {
      return new NextResponse("Username must be 3–32 characters: lowercase letters, numbers, _ or -", { status: 400 });
    }
    if (isReservedUsername(trimmedUsername)) {
      return new NextResponse("That username is reserved. Please choose another.", { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { username: trimmedUsername },
      select: { id: true },
    });
    if (existingUser && existingUser.id !== dbUser.id) {
      return new NextResponse("Username is already taken", { status: 400 });
    }

    const updateData: { username: string; password?: string } = { username: trimmedUsername };

    if (password !== undefined && password !== null && password !== "") {
      if (typeof password !== "string" || password.length < 8) {
        return new NextResponse("Password must be at least 8 characters", { status: 400 });
      }
      if (password.length > 72) {
        return new NextResponse("Password must be at most 72 characters", { status: 400 });
      }
      // Only a first password can be set here; replacing one needs the current password
      if (dbUser.password) {
        return new NextResponse("A password is already set. Change it from your profile.", { status: 409 });
      }
      updateData.password = await bcrypt.hash(password, 12);
    }

    await prisma.user.update({
      where: { id: dbUser.id },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ONBOARDING_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
