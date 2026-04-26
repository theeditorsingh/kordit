import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  // Protect the dashboard and any API routes we add later, except the login page
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|login).*)"],
};
