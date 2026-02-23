import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get("session_token")?.value;
  if (!sessionToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const userRole = request.cookies.get("user_role")?.value;
  if (userRole === "reviewer") {
    const isReviewPage = /^\/p\/[^/]+\/review/.test(pathname);
    const isReviewerPage = pathname === "/reviewer";
    const isApiRoute = pathname.startsWith("/api/");
    const isLogout = pathname === "/api/auth/logout";

    if (!isApiRoute && !isReviewPage && !isReviewerPage) {
      return NextResponse.redirect(new URL("/reviewer", request.url));
    }

    if (isLogout) {
      return NextResponse.next();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
