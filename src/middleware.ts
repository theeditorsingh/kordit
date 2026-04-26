import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const isAuth = !!token;
    const isAuthPage = req.nextUrl.pathname.startsWith("/login");
    const isOnboardingPage = req.nextUrl.pathname.startsWith("/onboarding");

    if (isAuthPage) {
      if (isAuth) {
        return NextResponse.redirect(new URL("/", req.url));
      }
      return null;
    }

    if (!isAuth) {
      let from = req.nextUrl.pathname;
      if (req.nextUrl.search) {
        from += req.nextUrl.search;
      }

      return NextResponse.redirect(
        new URL(`/login?from=${encodeURIComponent(from)}`, req.url)
      );
    }

    // Force onboarding if they don't have a username
    if (!token.username && !isOnboardingPage) {
      return NextResponse.redirect(new URL("/onboarding", req.url));
    }

    // Don't let them back to onboarding if they already have a username
    if (token.username && isOnboardingPage) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  },
  {
    callbacks: {
      authorized() {
        // This is a work-around for handling redirect on auth pages.
        // We return true here so that the middleware function above
        // is always called.
        return true;
      },
    },
  }
);

export const config = {
  // Protect all routes except API, static files, and images
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
