import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function isAuthorized(req: Request): boolean {
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const headerToken = m ? m[1] : "";

  // Accept either the cookie set by /api/admin/session, or a matching Bearer token
  const cookie = req.headers.get("cookie") || "";
  const hasCookie = /(?:^|;\s*)admin_session=ok(?:;|$)/.test(cookie);

  return hasCookie || (!!ADMIN_TOKEN && headerToken === ADMIN_TOKEN);
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // latest first
  const sql = `
    SELECT id, email, plan_key, status, preview_id, stripe_session_id, created_at, next_due_1
    FROM public.orders
    ORDER BY created_at DESC
    LIMIT 200
  `;
  const result = await pool.query(sql);
  return NextResponse.json({ ok: true, orders: result.rows });
}
