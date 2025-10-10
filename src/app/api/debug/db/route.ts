// src/app/api/debug/db/route.ts
import { sql } from "../../../../lib/db";

export const runtime = "nodejs";

function j(status: number, data: any) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET() {
  try {
    const r = await sql("SELECT now() as now");
    return j(200, { ok: true, now: r.rows?.[0]?.now });
  } catch (e: any) {
    return j(500, { ok: false, error: String(e?.message || e) });
  }
}
