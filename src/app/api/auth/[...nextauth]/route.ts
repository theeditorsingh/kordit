import NextAuth, { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import EmailProvider from "next-auth/providers/email";

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    EmailProvider({
      from: "onboarding@resend.dev",
      async sendVerificationRequest({ identifier, url, provider }) {
        try {
          await resend.emails.send({
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
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
