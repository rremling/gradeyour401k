// src/app/api/order/finalize/route.ts
import { NextRequest, NextResponse } from "next/server";
import { sql } from "../../../../lib/db"; // adjust if your db import differs

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = String(body.session_id || "").trim();

    if (!sessionId) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    // Fetch order by Stripe session id
    // Expected orders columns: email, preview_id, stripe_session_id
    const r = await sql(
      `SELECT email, preview_id
       FROM public.orders
       WHERE stripe_session_id = $1
       LIMIT 1`,
      [sessionId]
    );

    const row = r.rows?.[0];
    if (!row || !row.email || !row.preview_id) {
      return NextResponse.json(
        { error: "Order not found or missing email/preview_id" },
        { status: 404 }
      );
    }

    const email = String(row.email);
    const previewId = String(row.preview_id);

    // Call your existing PDF+email route (server-to-server)
    // Prefer an absolute URL so this works in Vercel serverless
    const base =
      process.env.NEXT_PUBLIC_SITE_URL ??
      // Fallback to URL from the incoming request
      new URL(req.url).origin;

    const resp = await fetch(`${base}/api/report/generate-and-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // this route expects both fields:
      body: JSON.stringify({ email, previewId }),
      // Ensure we don't cache this server-to-server call
      cache: "no-store",
    });

    const data = await resp.json().catch(() => ({} as any));
    if (!resp.ok || !data?.ok) {
      return NextResponse.json(
        { error: data?.error || "Failed to generate/send report" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, email, previewId });
  } catch (err: any) {
    console.error("[order/finalize] error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal error" },
      { status: 500 }
    );
  }
}
