// src/app/api/share/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { customAlphabet } from "nanoid";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// short, URL-safe, no confusing chars
const nanoid = customAlphabet("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz", 8);

// Helper: clamp to [1,5] and round to half-star, return "4.0" style string
function normalizeHalfStar(grade: unknown): string {
  const n = Number(grade);
  if (!Number.isFinite(n)) throw new Error("Invalid grade");
  const half = Math.round(Math.min(5, Math.max(1, n)) * 2) / 2;
  return half.toFixed(1); // "4.0", "4.5", etc.
}

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // ✅ Only redacted fields here — do NOT accept name, email, balances, etc.
    const {
      provider,
      profile,
      grade,
      model_name = null,
      sentiment = null,
      as_of_date, // "YYYY-MM-DD"
      utm_source = null,
      utm_medium = null,
      utm_campaign = null,
    } = body || {};

    if (!provider || !profile || grade == null || !as_of_date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Normalize + sanitize
    const provider_s = String(provider).trim();
    const profile_s = String(profile).trim();
    const as_of_s = String(as_of_date).slice(0, 10); // keep YYYY-MM-DD
    let grade_s: string;
    try {
      grade_s = normalizeHalfStar(grade);
    } catch {
      return NextResponse.json({ error: "Invalid grade" }, { status: 400 });
    }

    const id = nanoid();

    await pool.query(
      `INSERT INTO public.report_shares
         (id, provider, profile, grade, model_name, sentiment, as_of_date, utm_source, utm_medium, utm_campaign)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, provider_s, profile_s, grade_s, model_name, sentiment, as_of_s, utm_source, utm_medium, utm_campaign]
    );

    return NextResponse.json({ id });
  } catch (err) {
    console.error("[share/create] error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
