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
  rows: unknown; // JSONB or text
  grade_base: number | null;
  grade_adjusted: number | null;
};

export async function GET(req: NextRequest) {
  const id = (req.nextUrl.searchParams.get("id") || "").trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  }

  try {
    const result = await query<PreviewRow>(
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
      [id] // ← bind $1 properly
    );

    const r = result.rows?.[0];
    if (!r) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    // Safely normalize "rows" → array of { symbol, weight }
    let parsedRows: Array<{ symbol: string; weight: number }> = [];
    try {
      let raw: unknown = r.rows;

      // If the column came back as a JSON string, parse it.
      if (typeof raw === "string") {
        raw = JSON.parse(raw);
      }

      if (Array.isArray(raw)) {
        parsedRows = raw
          .filter((it) => it && typeof it === "object")
          .map((it: any) => ({
            symbol: String(it?.symbol || "").toUpperCase(),
            weight: Number(it?.weight ?? 0),
          }))
          .filter((it) => it.symbol && Number.isFinite(it.weight));
      } else {
        parsedRows = [];
      }
    } catch {
      parsedRows = [];
    }

    return NextResponse.json(
      {
        ok: true,
        id: r.id,
        provider: r.provider || null,
        provider_display: r.provider_display || null,
        profile: r.profile || null,
        rows: parsedRows,
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
