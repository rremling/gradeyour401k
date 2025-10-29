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
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 1000)
      : 200;

    const rows: any[] = q
      ? await sql/*sql*/`
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
            (o.last_advisor_review_at::date) AS last_advisor_review_at,
            o.client_notes,
            o.plan_key,
            o.created_at,
            o.stripe_customer_id,
            p.id::text AS latest_preview_id,
            p.created_at AS latest_preview_created_at,
            ROW_NUMBER() OVER (
              PARTITION BY o.email
              ORDER BY (o.plan_key = 'annual') DESC, o.created_at DESC
            ) AS rn
          FROM public.orders o
          LEFT JOIN public.previews p ON p.id = o.preview_id
          WHERE o.email ILIKE ${"%" + q + "%"}
        )
        SELECT *
        FROM ranked
        WHERE rn = 1
        ORDER BY email ASC
        LIMIT ${limit};
      `
      : await sql/*sql*/`
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
            (o.last_advisor_review_at::date) AS last_advisor_review_at,
            o.client_notes,
            o.plan_key,
            o.created_at,
            o.stripe_customer_id,
            p.id::text AS latest_preview_id,
            p.created_at AS latest_preview_created_at,
            ROW_NUMBER() OVER (
              PARTITION BY o.email
              ORDER BY (o.plan_key = 'annual') DESC, o.created_at DESC
            ) AS rn
          FROM public.orders o
          LEFT JOIN public.previews p ON p.id = o.preview_id
        )
        SELECT *
        FROM ranked
        WHERE rn = 1
        ORDER BY email ASC
        LIMIT ${limit};
      `;

    const clients = rows.map((r) => ({
      email: r.email,
      provider: r.provider ?? null,
      profile: r.profile ?? null,
      planned_retirement_year: r.planned_retirement_year ?? null,
      employer: r.employer ?? null,
      income_band: r.income_band ?? null,
      state: r.state ?? null,
      comms_pref: r.comms_pref ?? null,
      last_advisor_review_at: r.last_advisor_review_at ?? null,
      client_notes: r.client_notes ?? null,
      stripe_customer_id: r.stripe_customer_id ?? null,
      latest_preview_id: r.latest_preview_id ?? null,
      latest_preview_created_at: r.latest_preview_created_at ?? null,
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
