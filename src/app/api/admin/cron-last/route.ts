// src/app/api/admin/cron-last/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const job = url.searchParams.get("job") || "rebuild-models";
  const r = await query(
    `SELECT job_name, ran_at
       FROM cron_log
      WHERE job_name = $1
      ORDER BY ran_at DESC
      LIMIT 1`,
    [job]
  );
  const row = Array.isArray(r?.rows) ? r.rows[0] : r?.[0];
  return NextResponse.json({
    ok: true,
    job,
    ran_at: row?.ran_at || null,
  });
}
