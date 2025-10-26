// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // --- ADMIN (unchanged) ---
  if (pathname === "/admin/login") return NextResponse.next();
  if (pathname.startsWith("/admin")) {
    const hasSession = req.cookies.get("admin_session")?.value === "ok";
    if (!hasSession) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("returnTo", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // --- ACCOUNT (optional hard protection for specific APIs) ---
  // Allow magic-link endpoints without cookie (so users can sign in)
  if (pathname.startsWith("/api/account/magic-link") || pathname.startsWith("/api/account/verify")) {
    return NextResponse.next();
  }

  // Require "acct" cookie for sensitive account actions
  if (pathname === "/api/portal" || pathname === "/api/account/logout") {
    const hasAcct = Boolean(req.cookies.get("acct")?.value);
    if (!hasAcct) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Do not block /account page itself; it shows the email sign-in form if no cookie
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    // Optional account protections:
    "/api/portal",
    "/api/account/logout",
    "/api/account/magic-link",
    "/api/account/verify",
  ],
};
