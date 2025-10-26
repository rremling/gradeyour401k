import { NextRequest, NextResponse } from "next/server";
import { verifyAccountToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const claims = await verifyAccountToken(token);
  if (!claims) {
    return NextResponse.redirect(new URL("/account?error=invalid_link", req.url));
  }

  const res = NextResponse.redirect(new URL("/account", req.url));
  res.cookies.set("acct", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 30, // 30 minutes
  });
  return res;
}
