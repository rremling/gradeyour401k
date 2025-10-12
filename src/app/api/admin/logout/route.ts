import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    [
      `admin_session=`,
      `Path=/`,
      `HttpOnly`,
      `Secure`,
      `SameSite=Lax`,
      `Max-Age=0`,
    ].join("; ")
  );
  return res;
}
