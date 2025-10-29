// src/app/api/admin/clients/update/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

// Enumerations kept in sync with Account page
const PROVIDERS = new Set(["Fidelity", "Vanguard", "Schwab", "Voya", "Other"]);
const PROFILES = new Set(["Growth", "Balanced", "Conservative"]);
const INCOME_BANDS = new Set(["<75k", "75-150k", "150-300k", "300-600k", "600k+"]);
const US_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DC","DE","FL","GA","HI","IA","ID","IL","IN","KS","KY",
  "LA","MA","MD","ME","MI","MN","MO","MS","MT","NC","ND","NE","NH","NJ","NM","NV","NY","OH",
  "OK","OR","PA","RI","SC","SD","TN","TX","UT","VA","VT","WA","WI","WV","WY",
]);
const COMMS_PREFS = new Set(["email", "phone_email"]);

function nullIfEmpty(v: any) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  return v;
}

export async function POST(req: Request) {
  try {
    // --- Auth ---
    if (!cookies().get("admin_session")?.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // --- DB ---
    const url = process.env.DATABASE_URL;
    if (!url) return NextResponse.json({ ok: false, error: "Missing DATABASE_URL" }, { status: 500 });
    const sql = neon(url);

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ ok: false, error: "Email required" }, { status: 400 });
    }

    // Normalize inputs (empty string -> null). Undefined means "do not change".
    const provider = body.provider !== undefined ? String(body.provider || "").trim() : undefined;
    const profile = body.profile !== undefined ? String(body.profile || "").trim() : undefined;
    const planned_retirement_year =
      body.planned_retirement_year !== undefined && body.planned_retirement_year !== null && String(body.planned_retirement_year).trim() !== ""
        ? Number(body.planned_retirement_year)
        : (body.planned_retirement_year === "" ? null : undefined);

    const employer = nullIfEmpty(body.employer);
    const income_band = body.income_band !== undefined ? nullIfEmpty(String(body.income_band)) : undefined;
    const state = body.state !== undefined ? nullIfEmpty(String(body.state)) : undefined;
    const comms_pref = body.comms_pref !== undefined ? nullIfEmpty(String(body.comms_pref)) : undefined;
    const client_notes = body.client_notes !== undefined ? nullIfEmpty(String(body.client_notes)) : undefined;

    // last_advisor_review_at: expect "YYYY-MM-DD" or null/empty
    let last_advisor_review_at = body.last_advisor_review_at;
    if (last_advisor_review_at !== undefined) {
      if (!last_advisor_review_at) {
        last_advisor_review_at = null;
      } else {
        const s = String(last_advisor_review_at);
        // very light validation
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
          return NextResponse.json({ ok: false, error: "Invalid last_advisor_review_at (YYYY-MM-DD expected)" }, { status: 400 });
        }
      }
    }

    // Validate enums if provided
    if (provider !== undefined && provider !== "" && !PROVIDERS.has(provider)) {
      return NextResponse.json({ ok: false, error: "Invalid provider" }, { status: 400 });
    }
    if (profile !== undefined && profile !== "" && !PROFILES.has(profile)) {
      return NextResponse.json({ ok: false, error: "Invalid profile" }, { status: 400 });
    }
    if (income_band !== undefined && income_band !== null && income_band !== "" && !INCOME_BANDS.has(income_band)) {
      return NextResponse.json({ ok: false, error: "Invalid income_band" }, { status: 400 });
    }
    if (state !== undefined && state !== null && state !== "" && !US_STATES.has(state)) {
      return NextResponse.json({ ok: false, error: "Invalid state" }, { status: 400 });
    }
    if (comms_pref !== undefined && comms_pref !== null && comms_pref !== "" && !COMMS_PREFS.has(comms_pref)) {
      return NextResponse.json({ ok: false, error: "Invalid comms_pref" }, { status: 400 });
    }
    if (planned_retirement_year !== undefined && planned_retirement_year !== null) {
      const thisYear = new Date().getFullYear();
      if (!Number.isInteger(planned_retirement_year) || planned_retirement_year < thisYear || planned_retirement_year > thisYear + 60) {
        return NextResponse.json({ ok: false, error: "Invalid planned_retirement_year" }, { status: 400 });
      }
    }

    // Build update using COALESCE so unspecified fields remain unchanged.
    // For strings: null clears; empty string treated above as null.
    // Target is the *latest* row for this email (annual > created_at desc)
    const rows: any[] = await sql/*sql*/`
      WITH target AS (
        SELECT id
          FROM public.orders
         WHERE email = ${email}
         ORDER BY (plan_key = 'annual') DESC, created_at DESC
         LIMIT 1
      )
      UPDATE public.orders AS o
         SET provider = COALESCE(${provider ?? undefined}, o.provider),
             profile  = COALESCE(${profile ?? undefined},  o.profile),
             planned_retirement_year = COALESCE(${planned_retirement_year as any}, o.planned_retirement_year),
             employer = COALESCE(${employer as any}, o.employer),
             income_band = COALESCE(${income_band as any}, o.income_band),
             state = COALESCE(${state as any}, o.state),
             comms_pref = COALESCE(${comms_pref as any}, o.comms_pref),
             client_notes = COALESCE(${client_notes as any}, o.client_notes),
             last_advisor_review_at = COALESCE(${last_advisor_review_at as any}, o.last_advisor_review_at),
             updated_at = NOW()
        FROM target
       WHERE o.id = target.id
      RETURNING
        o.email,
        o.provider,
        o.profile,
        o.planned_retirement_year,
        o.employer,
        o.income_band,
        o.state,
        o.comms_pref,
        (o.last_advisor_review_at::date) AS last_advisor_review_at,
        o.client_notes
    `;

    const updated = rows?.[0];
    if (!updated) {
      return NextResponse.json({ ok: false, error: "No order found to update for this email" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, client: updated });
  } catch (err: any) {
    console.error("POST /api/admin/clients/update error:", err);
    return NextResponse.json(
      { ok: false, error: err?.code || err?.message || "DB error" },
      { status: 200 }
    );
  }
}
