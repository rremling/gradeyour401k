// src/app/api/preview/get/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DbRow = {
  id: string;
  provider: string | null;
  provider_display: string | null;
  profile: string | null;
  rows_text: string | null;      // <-- text, never raw JSONB
  grade_base: number | null;
  grade_adjusted: number | null;
  created_at?: string | null;
};

export async function GET(req: NextRequest) {
  const id = (req.nextUrl.searchParams.get("id") || "").trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  }

  try {
    // Force JSONB -> TEXT so we control parsing and return a plain JS array
    const rows = await query<DbRow>(
      `
      SELECT
        id::text         AS id,
        provider,
        provider_display,
        profile,
        ("rows")::text   AS rows_text,
        grade_base,
        grade_adjusted,
        created_at
      FROM public.previews
      WHERE id::text = $1
      LIMIT 1
      `,
      [id]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const r = rows[0];

    // Parse safely into a *real array* of {symbol, weight}
    let parsed: Array<{ symbol: string; weight: number }> = [];
    try {
      const raw = r.rows_text ? JSON.parse(r.rows_text) : null;
      if (Array.isArray(raw)) {
        parsed = raw
          .filter((x: any) => x && typeof x.symbol === "string")
          .map((x: any) => ({
            symbol: String(x.symbol).toUpperCase().trim(),
            weight: Number(x.weight ?? 0),
          }))
          .filter((x) => Number.isFinite(x.weight));
      }
    } catch {
      parsed = [];
    }

    return NextResponse.json(
      {
        ok: true,
        id: r.id,
        provider: r.provider || null,
        provider_display: r.provider_display || null,
        profile: r.profile || null,
        rows: parsed, // <-- guaranteed array
        grade_base: r.grade_base ?? null,
        grade_adjusted: r.grade_adjusted ?? null,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "DB error" },
      { status: 500 }
    );
  }
}
