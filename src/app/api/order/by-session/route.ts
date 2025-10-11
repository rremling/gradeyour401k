// /src/app/api/orders/by-session/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db"; // if you don’t use path aliases, change to: ../../../../lib/db

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = (searchParams.get("session_id") || "").trim();

    if (!sessionId) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    // Your table/columns (per your message): orders(id, email, plan_key, status, preview_id, stripe_session_id, created_at, next_due_1)
    const result = await sql(
      `SELECT id, email, plan_key, status, preview_id, stripe_session_id, created_at, next_due_1
         FROM public.orders
        WHERE stripe_session_id = $1
        LIMIT 1`,
      [sessionId]
    );

    const row = result.rows?.[0];
    if (!row) {
      // Not found: either webhook hasn’t written it yet, or we’re querying wrong key.
      // Return 404 so the client can show a friendly “still finalizing” state.
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        ok: true,
        order: {
          id: row.id,
          email: row.email,
          plan_key: row.plan_key,
          status: row.status,
          preview_id: row.preview_id,
          session_id: row.stripe_session_id,
          created_at: row.created_at,
          next_due_1: row.next_due_1,
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[orders/by-session] error:", err);
    return NextResponse.json(
      { error: "Server error loading order" },
      { status: 500 }
    );
  }
}
