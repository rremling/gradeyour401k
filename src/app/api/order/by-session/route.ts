// /src/app/api/orders/by-session/route.ts
import { NextRequest, NextResponse } from "next/server";
import { sql } from "../../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }

  try {
    const r = await sql(
      `SELECT id, email, plan_key, status, preview_id, stripe_session_id, created_at, next_due_1
       FROM public.orders
       WHERE stripe_session_id = $1
       LIMIT 1`,
      [sessionId]
    );

    const order = r.rows?.[0];
    if (!order) {
      return NextResponse.json(
        { error: "Order not found for session_id" },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, order });
  } catch (err: any) {
    console.error("[orders/by-session] DB error:", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
