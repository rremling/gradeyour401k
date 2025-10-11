import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (token !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await pool.query(`
      SELECT id, email, plan_key, status, preview_id, stripe_session_id, created_at
      FROM public.orders
      ORDER BY created_at DESC
    `);

    return NextResponse.json({ orders: result.rows });
  } catch (err: any) {
    console.error("[admin/orders/api] DB error:", err.message);
    return NextResponse.json(
      { error: "Database query failed" },
      { status: 500 }
    );
  }
}
