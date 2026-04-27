import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { username, password } = await req.json();

    if (!username || typeof username !== "string") {
      return new NextResponse("Username is required", { status: 400 });
    }

    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3 || trimmedUsername.length > 30) {
      return new NextResponse("Username must be between 3 and 30 characters", { status: 400 });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      return new NextResponse("Username can only contain letters, numbers, and underscores", { status: 400 });
    }

    // Check if username is already taken
    const existingUser = await prisma.user.findUnique({
      where: { username: trimmedUsername },
    });

    if (existingUser && existingUser.id !== session.user.id) {
      return new NextResponse("Username is already taken", { status: 400 });
    }

    const updateData: { username: string; password?: string } = { username: trimmedUsername };

    if (password && typeof password === "string") {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateData.password = hashedPassword;
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ONBOARDING_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
