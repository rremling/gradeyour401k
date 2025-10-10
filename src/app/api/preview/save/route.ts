// src/app/api/preview/save/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { provider, provider_display, profile, rows, grade_base, grade_adjusted } = await req.json();

    if (typeof provider !== "string" || typeof profile !== "string" || !Array.isArray(rows)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    await query(`
      create table if not exists previews (
        id uuid primary key,
        created_at timestamptz not null default now(),
        provider text not null,
        profile text not null,
        rows jsonb not null,
        grade_base numeric,
        grade_adjusted numeric
      )
    `);

    const id = crypto.randomUUID?.() || Math.random().toString(36).slice(2);

    // store provider_display inside rows as metadata too (for older readers)
    const payloadRows = Array.isArray(rows) ? rows : [];
    const rowsWithMeta = [
      { _meta: { provider_display: provider_display || null } },
      ...payloadRows,
    ];

    await query(
      `insert into previews (id, provider, profile, rows, grade_base, grade_adjusted)
       values ($1, $2, $3, $4, $5, $6)`,
      [id, provider, profile, JSON.stringify(rowsWithMeta), grade_base ?? null, grade_adjusted ?? null]
    );

    return NextResponse.json({ ok: true, id });
  } catch (e: any) {
    console.error("[preview/save] error:", e?.message || e);
    return NextResponse.json({ error: "Failed to save preview" }, { status: 500 });
  }
}
