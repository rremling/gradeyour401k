// src/app/api/order/by-session/route.ts
import { NextRequest, NextResponse } from "next/server";
import { sql } from "../../../../lib/db"; // adjust if your db import differs

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = String(searchParams.get("session_id") || "").trim();
    if (!sessionId) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    // orders columns assumed: email, preview_id, stripe_session_id
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

    return NextResponse.json({
      ok: true,
      email: row.email as string,
      previewId: String(row.preview_id),
    });
  } catch (err: any) {
    console.error("[order/by-session] error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal error" },
      { status: 500 }
    );
  }
}
