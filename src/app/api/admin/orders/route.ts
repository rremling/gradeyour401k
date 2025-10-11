import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Middleware already guards, but double-check cookie in API too:
  const cookie = (req.headers.get("cookie") || "");
  const hasSession = /(?:^|;\s*)admin_session=ok(?:;|$)/.test(cookie);
  if (!hasSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const q = `
      SELECT id, email, plan_key, status, preview_id, stripe_session_id, created_at, next_due_1
      FROM public.orders
      ORDER BY created_at DESC
      LIMIT 200
    `;
    const { rows } = await pool.query(q);
    return NextResponse.json({ ok: true, orders: rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "DB error" }, { status: 500 });
  }
}
