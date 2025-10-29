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

    // Use window function to pick the most recent row per email
    // Priority: annual plan first, then most recent created_at
    // Cast last_advisor_review_at to date for easy <input type="date" /> binding
    const rows: any[] = q
      ? await sql/*sql*/`
        WITH ranked AS (
          SELECT
            email,
            provider,
            profile,
            planned_retirement_year,
            employer,
            income_band,
            state,
            comms_pref,
            (last_advisor_review_at::date) AS last_advisor_review_at,
            client_notes,
            plan_key,
            created_at,
            ROW_NUMBER() OVER (
              PARTITION BY email
              ORDER BY (plan_key = 'annual') DESC, created_at DESC
            ) AS rn
          FROM public.orders
          WHERE email ILIKE ${"%" + q + "%"}
        )
        SELECT *
        FROM ranked
        WHERE rn = 1
        ORDER BY email ASC
        LIMIT ${limit}
      `
      : await sql/*sql*/`
        WITH ranked AS (
          SELECT
            email,
            provider,
            profile,
            planned_retirement_year,
            employer,
            income_band,
            state,
            comms_pref,
            (last_advisor_review_at::date) AS last_advisor_review_at,
            client_notes,
            plan_key,
            created_at,
            ROW_NUMBER() OVER (
              PARTITION BY email
              ORDER BY (plan_key = 'annual') DESC, created_at DESC
            ) AS rn
          FROM public.orders
        )
        SELECT *
        FROM ranked
        WHERE rn = 1
        ORDER BY email ASC
        LIMIT ${limit}
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
      last_advisor_review_at: r.last_advisor_review_at ?? null, // YYYY-MM-DD from ::date
      client_notes: r.client_notes ?? null,
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
