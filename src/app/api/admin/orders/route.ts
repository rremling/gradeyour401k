// src/app/api/admin/orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return unauthorized();
  const token = auth.slice(7); // after "Bearer "
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) return unauthorized();

  const sql = `
    SELECT id, email, plan_key, status, preview_id, stripe_session_id, created_at, next_due_1
    FROM public.orders
    ORDER BY created_at DESC
    LIMIT 100
  `;
  const rows = (await pool.query(sql)).rows;
  return NextResponse.json({ ok: true, rows });
}
