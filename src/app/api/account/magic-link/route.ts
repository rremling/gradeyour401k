import { NextRequest, NextResponse } from "next/server";
import { signAccountToken } from "@/lib/auth";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const EMAIL_FROM = process.env.EMAIL_FROM || "reports@gradeyour401k.kenaiinvest.com";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function sendViaResend(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Resend failed (${res.status}): ${txt || res.statusText}`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }
    const token = await signAccountToken(email, 30);
    const link = `${BASE_URL}/api/account/verify?token=${encodeURIComponent(token)}`;

    const html = `
      <div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5;color:#111">
        <h2>Sign in to GradeYour401k</h2>
        <p>Click the button below to access your account page.</p>
        <p style="margin:20px 0;">
          <a href="${link}" style="display:inline-block;padding:12px 18px;background:#0b59c7;color:#fff;border-radius:10px;text-decoration:none;font-weight:600">
            Open My Account
          </a>
        </p>
        <p style="font-size:12px;color:#666">This link expires in 30 minutes.</p>
      </div>
    `;
    await sendViaResend(email, "Your GradeYour401k Sign-In Link", html);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "error" }, { status: 500 });
  }
}
