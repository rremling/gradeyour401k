// src/app/api/preview/[id]/route.ts
import { sql } from "../../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function j(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: { id?: string } }
) {
  const id = (params?.id || "").trim();
  if (!id) return j(400, { ok: false, error: "Missing id" });

  try {
    // Cast id to text so it works for bigint/uuid/string
    const res = await sql(
      `SELECT
         id::text AS id,
         provider,
         provider_display,
         profile,
         "rows",
         grade_base,
         grade_adjusted
       FROM public.previews
       WHERE id::text = $1
       LIMIT 1`,
      [id]
    );

    const row = res.rows?.[0];
    if (!row) return j(404, { ok: false, error: "Not found" });

    // Normalize rows to an array of { symbol, weight }
    let parsedRows: Array<{ symbol: string; weight: number }> = [];
    try {
      const raw = row.rows;
      if (Array.isArray(raw)) {
        parsedRows = raw as any;
      } else if (typeof raw === "string") {
        parsedRows = JSON.parse(raw) || [];
      } else if (raw && typeof raw === "object" && Array.isArray(raw as any)) {
        parsedRows = raw as any;
      }
    } catch {
      parsedRows = [];
    }

    return j(200, {
      ok: true,
      id: row.id,
      provider: row.provider ?? null,
      provider_display: row.provider_display ?? null,
      profile: row.profile ?? null,
      rows: parsedRows,
      grade_base: row.grade_base ?? null,
      grade_adjusted: row.grade_adjusted ?? null,
    });
  } catch (e: any) {
    return j(500, { ok: false, error: "DB error", detail: String(e?.message || e) });
  }
}
