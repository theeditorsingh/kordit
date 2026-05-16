import NextAuth, { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    EmailProvider({
      from: "magiclink@theeditorsingh.com",
      async sendVerificationRequest({ identifier, url, provider }) {
        try {
          await getResend().emails.send({
            from: provider.from as string,
            to: identifier,
            subject: "Sign in to Kordit",
            html: `<p>Click the link below to sign in to your Kordit account:</p>
                   <p><a href="${url}"><strong>Sign in to Kordit</strong></a></p>
                   <p>If you didn't request this email, you can safely ignore it.</p>`,
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
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) {
          throw new Error("Missing identifier or password");
        }

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: credentials.identifier },
              { username: credentials.identifier },
            ],
          },
        });

        if (!user || !user.password) {
          throw new Error("Invalid credentials");
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);

        if (!isValid) {
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
    async jwt({ token, user, trigger, session }) {
      if (trigger === "update" && session?.username) {
        token.username = session.username;
      }
      
      if (user) {
        token.id = user.id;
        // User object from authorize or email provider
        const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
        token.username = dbUser?.username || null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = (token.id || token.sub) as string;
        session.user.username = token.username as string | null;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
