// src/app/api/preview/[id]/route.ts
import { sql } from "../../../../lib/db";

export const runtime = "nodejs";

function j(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  if (!id || !/^\d+$/.test(id)) {
    return j(400, { error: "Invalid id" });
  }

  try {
    const res = await sql(
      `SELECT id, created_at, provider, provider_display, profile, "rows", grade_base, grade_adjusted
       FROM public.previews
       WHERE id = $1`,
      [id]
    );
    const row = res.rows?.[0];
    if (!row) return j(404, { error: "Not found" });
    return j(200, { ok: true, preview: row });
  } catch (e: any) {
    return j(500, { error: "DB error", detail: String(e?.message || e) });
  }
}
