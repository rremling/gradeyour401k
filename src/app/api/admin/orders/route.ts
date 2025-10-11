// src/app/api/admin/orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  // Accept token from header OR from query param (?token=) to simplify debugging
  const headerAuth = req.headers.get("authorization");
  const headerToken = headerAuth?.startsWith("Bearer ")
    ? headerAuth.slice("Bearer ".length)
    : null;
  const qpToken = url.searchParams.get("token");
  const token = headerToken || qpToken;

  const adminPassword = process.env.ADMIN_PASSWORD || "";

  if (!adminPassword) {
    return NextResponse.json(
      { error: "Server misconfigured: ADMIN_PASSWORD not set" },
      { status: 500 }
    );
  }

  if (!token || token !== adminPassword) {
    return NextResponse.json(
      { error: "Unauthorized: bad or missing token" },
      { status: 401 }
    );
  }

  try {
    const result = await pool.query(
      `
      SELECT id, email, plan_key, status, preview_id, stripe_session_id, created_at
      FROM public.orders
      ORDER BY created_at DESC
      LIMIT 500
    `
    );

    return NextResponse.json({ orders: result.rows });
  } catch (err: any) {
    console.error("[admin/orders/api] DB error:", err?.message || err);
    return NextResponse.json(
      { error: "Database query failed" },
      { status: 500 }
    );
  }
}
