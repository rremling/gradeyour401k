// src/app/api/preview/get/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PreviewRow = {
  id: string;
  provider: string | null;
  provider_display: string | null;
  profile: string | null;
  rows: unknown; // could be JSONB array or text
  grade_base: number | null;
  grade_adjusted: number | null;
};

export async function GET(req: NextRequest) {
  const id = (req.nextUrl.searchParams.get("id") || "").trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  }

  try {
    // Cast id to text so this works for UUID, bigint, etc.
    const rows = await query<PreviewRow>(
      `
      SELECT
        id::text AS id,
        provider,
        provider_display,
        profile,
        "rows",
        grade_base,
        grade_adjusted
      FROM public.previews
      WHERE id::text = $1
      LIMIT 1
      `,
      [id]
    );

    if (!rows?.length) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const r = rows[0];

    // Safely normalize rows → array
    let parsedRows: Array<{ symbol: string; weight: number }> = [];
    try {
      if (Array.isArray(r.rows)) {
        parsedRows = r.rows as any;
      } else if (typeof r.rows === "string") {
        parsedRows = JSON.parse(r.rows) || [];
      } else if (r.rows && typeof r.rows === "object") {
        // In case it’s a JSON object already but not an array
        parsedRows = Array.isArray((r.rows as any)) ? (r.rows as any) : [];
      }
    } catch {
      parsedRows = [];
    }

    const payload = {
      ok: true,
      id: r.id,
      provider: r.provider || null,
      provider_display: r.provider_display || null,
      profile: r.profile || null,
      rows: parsedRows,
      grade_base: r.grade_base ?? null,
      grade_adjusted: r.grade_adjusted ?? null,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "DB error" },
      { status: 500 }
    );
  }
}
