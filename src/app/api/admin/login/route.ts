import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
  if (!ADMIN_TOKEN) {
    return NextResponse.json({ error: "Server not configured (ADMIN_TOKEN missing)" }, { status: 500 });
  }

  const { token } = await req.json().catch(() => ({ token: "" }));
  if (!token || token !== ADMIN_TOKEN) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  // Set a simple session cookie. For production you could sign a JWT.
  res.cookies.set("admin_session", "ok", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });
  return res;
}
