import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
  if (!ADMIN_TOKEN) {
    return NextResponse.json({ error: "Server missing ADMIN_TOKEN" }, { status: 500 });
  }

  let token = "";
  try {
    const body = await req.json();
    token = String(body?.token || "");
  } catch {
    // allow header fallback
  }

  // Also allow Authorization: Bearer ...
  if (!token) {
    const auth = req.headers.get("authorization") || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) token = m[1];
  }

  if (!token || token !== ADMIN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Set an httpOnly cookie so middleware can see it
  const res = NextResponse.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    [
      `admin_session=ok`,
      `Path=/`,
      `HttpOnly`,
      `Secure`,
      `SameSite=Lax`,
      `Max-Age=${60 * 60 * 24}`, // 1 day
    ].join("; ")
  );
  return res;
}
