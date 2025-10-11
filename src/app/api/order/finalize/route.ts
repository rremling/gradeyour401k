// src/app/api/order/finalize/route.ts
import { NextRequest, NextResponse } from "next/server";
import { sql } from "../../../../lib/db"; // adjust if your db import differs

export async function POST(req: NextRequest) {
  try {
    // Safe parse
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const sessionId = String(body.session_id || "").trim();
    if (!sessionId) {
      return NextResponse.json({ ok: false, error: "Missing session_id" }, { status: 400 });
    }

    // Look up order by session id
    const r = await sql(
      `SELECT email, preview_id
       FROM public.orders
       WHERE stripe_session_id = $1
       LIMIT 1`,
      [sessionId]
    );

    const row = r.rows?.[0];
    if (!row) {
      return NextResponse.json(
        { ok: false, error: "Order not found for session_id" },
        { status: 404 }
      );
    }
    if (!row.email || !row.preview_id) {
      return NextResponse.json(
        { ok: false, error: "Order missing email or preview_id" },
        { status: 422 }
      );
    }

    const email = String(row.email);
    const previewId = String(row.preview_id);

    const base =
      process.env.NEXT_PUBLIC_SITE_URL ??
      new URL(req.url).origin;

    // Call your existing PDF + email route
    const resp = await fetch(`${base}/api/report/generate-and-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, previewId }),
      cache: "no-store",
    });

    const raw = await resp.text();
    let data: any = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { errorText: raw };
    }

    if (!resp.ok || !data?.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: data?.error || data?.errorText || "Failed to generate/send report",
          status: resp.status,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, email, previewId });
  } catch (err: any) {
    console.error("[order/finalize] error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal error" },
      { status: 500 }
    );
  }
}
