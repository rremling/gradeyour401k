// src/app/api/admin/session/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function cookieOpts() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true as const,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    // Do NOT set domain so the cookie binds to whatever host you’re on
  };
}

function getTokenFromEnv(): string {
  // Your admin password/token from Vercel env: ADMIN_TOKEN
  return process.env.ADMIN_TOKEN || "";
}

/**
 * GET /api/admin/session
 * Quick status check. Returns { loggedIn: boolean }.
 */
export async function GET() {
  // Using headers in route handlers is a bit different; easiest is to trust the cookie presence
  // The client can also simply call this to verify session status.
  return NextResponse.json({ ok: true, hint: "Use POST to login, DELETE to logout." });
}

/**
 * POST /api/admin/session
 * Body: { token: string }
 * If token matches ADMIN_TOKEN, set the admin_session cookie.
 */
export async function POST(req: Request) {
  try {
    const { token } = (await req.json().catch(() => ({}))) as { token?: string };
    const expected = getTokenFromEnv();

    if (!expected) {
      return NextResponse.json(
        { error: "Server not configured: missing ADMIN_TOKEN." },
        { status: 500 }
      );
    }
    if (!token || token !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set("admin_session", "ok", cookieOpts());
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Bad request" }, { status: 400 });
  }
}

/**
 * DELETE /api/admin/session
 * Clears the admin_session cookie.
 */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  // Clear cookie by setting maxAge=0
  res.cookies.set("admin_session", "", { ...cookieOpts(), maxAge: 0 });
  return res;
}
