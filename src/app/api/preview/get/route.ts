// src/app/api/preview/get/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  try {
    const rows = await query<{
      provider: string;
      provider_display?: string;
      profile: string;
      rows: any;
      grade_base: number | null;
      grade_adjusted: number | null;
    }>(
      `select provider, profile, rows,
              coalesce((rows->>'provider_display')::text, null) as provider_display,
              grade_base, grade_adjusted
         from previews
        where id = $1`,
      [id]
    );

    if (!rows?.length) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    const r = rows[0];
    const payload = {
      ok: true,
      provider: r.provider,
      provider_display: (r as any).provider_display || null,
      profile: r.profile,
      rows: Array.isArray(r.rows) ? r.rows : [],
      grade_base: r.grade_base ?? null,
      grade_adjusted: r.grade_adjusted ?? null,
    };
    return NextResponse.json(payload);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "DB error" }, { status: 500 });
  }
}
