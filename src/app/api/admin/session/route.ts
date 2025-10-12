// src/app/api/admin/session/route.ts
import { NextResponse, NextRequest } from "next/server";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

/** Helper: cookie options */
function cookieOpts(req: NextRequest) {
  const isProd = process.env.NODE_ENV === "production";
  // If you ONLY use https://www.gradeyour401k.com, you can keep domain undefined,
  // but if you hop between apex and www, set a dot-domain to share cookies:
  const domain =
    isProd ? ".gradeyour401k.com" : undefined; // change if your canonical host differs
  return {
    httpOnly: true as const,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    domain,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token || token !== ADMIN_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set("admin_session", "ok", {
      ...cookieOpts(req),
      maxAge: 60 * 60 * 12, // 12 hours
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_session", "", {
    ...cookieOpts(req),
    expires: new Date(0), // clear cookie
  });
  return res;
}
