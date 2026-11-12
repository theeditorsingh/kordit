import NextAuth, { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getPasswordResetEmailHtml, getSignInEmailHtml } from "@/lib/emailTemplates";

import { Resend } from "resend";
import { LIMITS, clientIp, consume, isBlocked } from "@/lib/rateLimit";

// How often a signed-in token is re-checked against the database (revocation latency)
const SESSION_RECHECK_MS = 5 * 60 * 1000;

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    EmailProvider({
      from: process.env.EMAIL_FROM || "magiclink@theeditorsingh.com",
      maxAge: 30 * 60, // 30 minutes
      async sendVerificationRequest({ identifier, url, provider }) {
        // Stop the sign-in form being used to flood an inbox
        if (!(await consume(`magic:${identifier.toLowerCase()}`, LIMITS.magicLinkEmail))) {
          throw new Error("Too many sign-in emails requested. Please wait a few minutes and try again.");
        }
        try {
          const dbUser = await prisma.user.findUnique({ where: { email: identifier } });
          const userName = dbUser?.name || 'there';

          // Check if this is a password reset or a regular sign-in
          // The callbackUrl is embedded in the NextAuth verification URL
          const parsedUrl = new URL(url);
          const callbackUrl = parsedUrl.searchParams.get('callbackUrl') || '';
          const isPasswordReset = callbackUrl.includes('reset=true');

          const subject = isPasswordReset ? 'Reset your password' : 'Sign in to Kordit';
          const html = isPasswordReset
            ? getPasswordResetEmailHtml({ url, userName })
            : getSignInEmailHtml({ url, userName });

          await getResend().emails.send({
            from: provider.from as string,
            to: identifier,
            subject,
            html,
          });
        } catch (error) {
          console.error("Failed to send verification email", error);
          throw new Error("Failed to send verification email.");
        }
      },
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Email or Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.identifier || !credentials?.password) {
          throw new Error("Missing identifier or password");
        }

        // Brute-force protection: failed attempts are counted per account and per IP
        const identifierKey = `login:id:${credentials.identifier.trim().toLowerCase()}`;
        const ipKey = `login:ip:${clientIp(req?.headers)}`;
        if (await isBlocked(identifierKey, LIMITS.loginIdentifier) || await isBlocked(ipKey, LIMITS.loginIp)) {
          throw new Error("Too many sign-in attempts. Please wait 15 minutes and try again.");
        }
        const recordFailure = () => Promise.all([
          consume(identifierKey, LIMITS.loginIdentifier),
          consume(ipKey, LIMITS.loginIp),
        ]);

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: credentials.identifier },
              { username: credentials.identifier },
            ],
          },
        });

        if (!user || !user.password) {
          await recordFailure();
          throw new Error("Invalid credentials");
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);

        if (!isValid) {
          await recordFailure();
          throw new Error("Invalid credentials");
        }

        return user;
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, account, trigger }) {
      // Remember when the user last proved ownership of their inbox.
      // Used to allow setting a new password without the old one.
      if (account) {
        token.emailAuthAt = account.provider === "email" ? Date.now() : null;
      }

      if (user) {
        token.id = user.id;
        // User object from authorize or email provider
        const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { username: true, sessionVersion: true } });
        token.username = dbUser?.username || null;
        token.sessionVersion = dbUser?.sessionVersion ?? 0;
        token.checkedAt = Date.now();
        return token;
      }

      const userId = (token.id || token.sub) as string | undefined;
      if (!userId) return token;

      // Re-check the account periodically (and whenever the client asks for an update):
      // a deleted account or a changed password ends every other session.
      const due = trigger === "update" || !token.checkedAt || Date.now() - (token.checkedAt as number) > SESSION_RECHECK_MS;
      if (due) {
        const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { username: true, sessionVersion: true } });
        if (!dbUser || dbUser.sessionVersion !== ((token.sessionVersion as number | undefined) ?? 0)) {
          return {} as typeof token; // signs the session out
        }
        // The username always comes from the database, never from the client's update() payload
        token.username = dbUser.username;
        token.checkedAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = (token.id || token.sub) as string;
        session.user.username = token.username as string | null;
        session.user.emailAuthAt = (token.emailAuthAt as number | null) ?? null;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
