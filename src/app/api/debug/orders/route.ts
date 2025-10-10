// src/app/api/debug/orders/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const r = await sql(
      `SELECT id, created_at, email, amount, currency, mode, plan, session_id
       FROM public.orders
       ORDER BY created_at DESC
       LIMIT 10`
    );
    return NextResponse.json({ ok: true, rows: r.rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
