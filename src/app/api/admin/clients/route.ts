// src/app/api/admin/clients/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    // --- Auth ---
    if (!cookies().get("admin_session")?.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // --- DB ---
    const url = process.env.DATABASE_URL;
    if (!url) return NextResponse.json({ clients: [], _error: "Missing DATABASE_URL" });
    const sql = neon(url);

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("search") || "").trim();
    const limitRaw = Number(searchParams.get("limit"));
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 1000) : 200;

    const baseCte = /* sql */ `
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
          (o.last_advisor_review_at::date) AS last_advisor_review_at_row, -- keep original if needed
          o.client_notes,
          o.plan_key,
          o.created_at,
          o.updated_at,
          o.stripe_customer_id,
          p.id::text AS latest_preview_id,
          p.created_at AS latest_preview_created_at,
          ROW_NUMBER() OVER (
            PARTITION BY o.email
            ORDER BY (o.plan_key = 'annual') DESC, o.created_at DESC
          ) AS rn
        FROM public.orders o
        LEFT JOIN public.previews p ON p.id = o.preview_id
        /**WHERE_CLAUSE**/
      )
      SELECT
        r.email,
        r.provider,
        r.profile,
        r.planned_retirement_year,
        r.employer,
        r.income_band,
        r.state,
        r.comms_pref,
        r.client_notes,
        r.plan_key,
        r.created_at,
        r.updated_at,
        r.stripe_customer_id,
        r.latest_preview_id,
        r.latest_preview_created_at,
        s.last_statement_uploaded_at,
        x.latest_review_date::date AS last_advisor_review_at,
        x.best_full_name
      FROM ranked r
      LEFT JOIN LATERAL (
        SELECT MAX(uploaded_at) AS last_statement_uploaded_at
        FROM public.statements st
        WHERE st.email = r.email
      ) s ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          MAX(o2.last_advisor_review_at) AS latest_review_date,
          (
            SELECT o3.full_name
            FROM public.orders o3
            WHERE o3.email = r.email
              AND COALESCE(NULLIF(TRIM(o3.full_name), ''), NULL) IS NOT NULL
            ORDER BY (o3.plan_key = 'annual') DESC,
                     o3.updated_at DESC NULLS LAST,
                     o3.created_at DESC
            LIMIT 1
          ) AS best_full_name
        FROM public.orders o2
        WHERE o2.email = r.email
      ) x ON TRUE
      WHERE r.rn = 1
      ORDER BY r.email ASC
      LIMIT ${limit};
    `;

    const rows: any[] = q
      ? await sql(baseCte.replace("/**WHERE_CLAUSE**/", `WHERE o.email ILIKE ${"%" + q + "%"}`) as any)
      : await sql(baseCte.replace("/**WHERE_CLAUSE**/", "") as any);

    const clients = rows.map((r) => ({
      email: r.email,
      provider: r.provider ?? null,
      profile: r.profile ?? null,
      planned_retirement_year: r.planned_retirement_year ?? null,
      employer: r.employer ?? null,
      income_band: r.income_band ?? null,
      state: r.state ?? null,
      comms_pref: r.comms_pref ?? null,
      last_advisor_review_at: r.last_advisor_review_at ?? null, // fixed: greatest non-NULL across orders
      client_notes: r.client_notes ?? null,
      stripe_customer_id: r.stripe_customer_id ?? null,
      latest_preview_id: r.latest_preview_id ?? null,
      latest_preview_created_at: r.latest_preview_created_at ?? null,
      last_statement_uploaded_at: r.last_statement_uploaded_at ?? null,
      full_name: r.best_full_name ?? null, // NEW
    }));

    return NextResponse.json({ clients });
  } catch (err: any) {
    console.error("GET /api/admin/clients error:", err);
    return NextResponse.json(
      { clients: [], _error: err?.code || err?.message || "DB error" },
      { status: 200 }
    );
  }
}
