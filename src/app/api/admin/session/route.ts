// src/app/api/admin/session/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// GET -> session status
export async function GET() {
  const has = Boolean(cookies().get("admin_session")?.value);
  return NextResponse.json({ authenticated: has, ok: true });
}

// POST -> login
export async function POST(req: Request) {
  const { token } = await req.json().catch(() => ({}));
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  cookies().set("admin_session", "ok", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return NextResponse.json({ ok: true, message: "Logged in" });
}

// DELETE -> logout
export async function DELETE() {
  cookies().set("admin_session", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return NextResponse.json({ ok: true, message: "Logged out" });
}
