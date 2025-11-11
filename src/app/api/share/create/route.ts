import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { customAlphabet } from "nanoid";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// short, URL-safe, no confusing chars
const nanoid = customAlphabet("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz", 8);

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
      as_of_date,     // "YYYY-MM-DD"
      utm_source = null,
      utm_medium = null,
      utm_campaign = null,
    } = body || {};

    if (!provider || !profile || !grade || !as_of_date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const id = nanoid();

    await pool.query(
      `INSERT INTO public.report_shares
       (id, provider, profile, grade, model_name, sentiment, as_of_date, utm_source, utm_medium, utm_campaign)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, provider, profile, grade, model_name, sentiment, as_of_date, utm_source, utm_medium, utm_campaign]
    );

    return NextResponse.json({ id });
  } catch (err) {
    console.error("[share/create] error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
