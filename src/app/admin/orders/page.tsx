import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const DATABASE_URL = process.env.DATABASE_URL!;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN!;

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace("Bearer ", "").trim();
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const r = await pool.query(
      `SELECT id, email, plan_key, status, preview_id, stripe_session_id, created_at
         FROM public.orders
        ORDER BY created_at DESC
        LIMIT 50`
    );
    return NextResponse.json({ ok: true, orders: r.rows });
  } catch (e: any) {
    console.error("[admin/orders] error:", e);
    return NextResponse.json({ error: e.message || "query failed" }, { status: 500 });
  }
}
