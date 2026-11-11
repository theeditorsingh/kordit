import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string | null;
      /** ms timestamp of the last magic-link sign-in, null for password sign-in */
      emailAuthAt?: number | null;
    } & DefaultSession["user"];
  }
}

