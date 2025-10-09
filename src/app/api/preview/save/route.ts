import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { provider, profile, rows, grade_base, grade_adjusted } = await req.json();

    // basic validation
    if (typeof provider !== "string" || typeof profile !== "string" || !Array.isArray(rows)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // create table if needed (no-op if exists)
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
    await query(
      `insert into previews (id, provider, profile, rows, grade_base, grade_adjusted)
       values ($1, $2, $3, $4, $5, $6)`,
      [id, provider, profile, JSON.stringify(rows), grade_base ?? null, grade_adjusted ?? null]
    );

    return NextResponse.json({ ok: true, id });
  } catch (e: any) {
    console.error("[preview/save] error:", e?.message || e);
    return NextResponse.json({ error: "Failed to save preview" }, { status: 500 });
  }
}
