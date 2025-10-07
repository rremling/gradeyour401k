// src/app/api/debug/db/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await query<{ now: string }>("select now()::text as now");
    return NextResponse.json({ ok: true, now: rows[0]?.now || null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
