// src/app/api/admin/clients/update/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    if (!cookies().get("admin_session")?.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = process.env.DATABASE_URL;
    if (!url) return NextResponse.json({ ok: false, error: "Missing DATABASE_URL" });
    const sql = neon(url);

    const body = await req.json().catch(() => ({}));
    const {
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
      full_name, // NEW
    } = body || {};

    if (!email || typeof email !== "string") {
      return NextResponse.json({ ok: false, error: "Missing email" }, { status: 400 });
    }

    // Update the latest order row (annual precedence, newest created_at)
    const rows: any[] = await sql/*sql*/`
      WITH target AS (
        SELECT id
        FROM public.orders
        WHERE email = ${email}
        ORDER BY (plan_key = 'annual') DESC, created_at DESC
        LIMIT 1
      )
      UPDATE public.orders o
      SET
        provider = ${provider ?? null},
        profile  = ${profile ?? null},
        planned_retirement_year = ${planned_retirement_year ?? null},
        employer = ${employer ?? null},
        income_band = ${income_band ?? null},
        state = ${state ?? null},
        comms_pref = ${comms_pref ?? null},
        client_notes = ${client_notes ?? null},
        full_name = ${full_name ? String(full_name).trim() : null}, -- NEW
        last_advisor_review_at = ${last_advisor_review_at ?? null}::timestamptz,
        updated_at = NOW()
      FROM target
      WHERE o.id = target.id
      RETURNING o.id;
    `;

    const updated = Array.isArray(rows) && rows.length > 0;
    if (!updated) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("POST /api/admin/clients/update error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "DB error" }, { status: 500 });
  }
}
