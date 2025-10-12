// src/app/api/admin/orders/route.ts
import { NextResponse } from "next/server";
import { Pool } from "pg";
import { ADMIN_TOKEN } from "@/lib/admin";

const DATABASE_URL = process.env.DATABASE_URL || "";
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(req: Request) {
  // Validate admin token from Authorization header
  const auth = req.headers.get("authorization") || "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!ADMIN_TOKEN || provided !== ADMIN_TOKEN) {
    return unauthorized();
  }

  const sql = `
    SELECT id::text, email, plan_key, status, preview_id,
           stripe_session_id, created_at, next_due_1
    FROM public.orders
    ORDER BY created_at DESC
    LIMIT 200
  `;
  try {
    const res = await pool.query(sql);
    return NextResponse.json({ ok: true, orders: res.rows });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "DB error" },
      { status: 500 }
    );
  }
}
