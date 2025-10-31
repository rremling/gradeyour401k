// src/app/api/admin/clients/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const DATABASE_URL = process.env.DATABASE_URL || "";
if (!DATABASE_URL) console.warn("[/api/admin/clients] Missing DATABASE_URL");

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Basic auth check: require an admin session cookie.
// Adjust the cookie name / logic to match your existing /api/admin/session.
function requireAdmin(req: NextRequest) {
  const cookie = req.cookies.get("admin_session")?.value;
  return Boolean(cookie && cookie.length > 0);
}

export async function GET(req: NextRequest) {
  try {
    // Auth
    if (!requireAdmin(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // NOTE:
    // We intentionally do NOT use any WHERE email = $1 here.
    // We want *all* distinct clients (one latest row per email),
    // preferring annual plan rows, then most recent by created_at.

    const sql = `
      WITH ranked AS (
        SELECT
          o.email,
          o.provider,
          o.profile,
          o.planned_retirement_year,
          o.employer,
          o.income_band,
          o.state,
          o.comms_pref,
          -- normalize to YYYY-MM-DD for the UI date input
          TO_CHAR(o.last_advisor_review_at, 'YYYY-MM-DD') AS last_advisor_review_at,
          o.client_notes,
          o.stripe_customer_id,
          o.preview_id::text AS latest_preview_id,
          o.full_name,
          -- rank latest per email: prefer annual, then newest created_at
          ROW_NUMBER() OVER (
            PARTITION BY o.email
            ORDER BY (o.plan_key = 'annual') DESC, o.created_at DESC
          ) AS rn
        FROM public.orders o
      )
      SELECT
        email,
        provider,
        profile,
        planned_retirement_year,
        employer,
        income_band,
        state,
        comms_pref,
        last_advisor_review_at,
        client_notes,
        stripe_customer_id,
        latest_preview_id,
        full_name,
        NULL::text AS last_statement_uploaded_at -- placeholder; join your statements table if needed
      FROM ranked
      WHERE rn = 1
      ORDER BY LOWER(email) ASC;
    `;

    const r = await pool.query(sql);
    const clients = r.rows || [];

    return NextResponse.json({ clients }, { status: 200 });
  } catch (e: any) {
    console.error("[/api/admin/clients GET] error:", e?.message || e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
