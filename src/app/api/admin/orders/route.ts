// src/app/api/admin/orders/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db"; // keep your working import

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cookie = (req as any).headers?.get("cookie") || "";
  const has = /(?:^|;\s*)admin_session=ok(?:;|$)/.test(cookie);
  if (!has) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const r = await sql(
      `SELECT id, email, plan_key, status, preview_id, stripe_session_id, created_at, next_due_1
       FROM public.orders
       ORDER BY created_at DESC
       LIMIT 100`
    );
    return NextResponse.json({ orders: r.rows ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "DB error" }, { status: 500 });
  }
}
