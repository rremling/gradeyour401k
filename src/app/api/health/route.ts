// src/app/api/cron/health/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Health probe for daily model pipeline.
 *
 * Auth:
 *   Requires Authorization: Bearer <CRON_SECRET>
 *
 * Query params (optional):
 *   ?asof=YYYY-MM-DD   -> override the date (defaults to today's date in UTC)
 *   ?limit=20          -> max unknown symbols returned
 */
export async function GET(req: NextRequest) {
  // --- Auth ---
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  const auth = req.headers.get("authorization") || "";
  if (!process.env.CRON_SECRET || auth !== expected) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const asof = (url.searchParams.get("asof") || new Date().toISOString().slice(0, 10)).trim();
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 50)));

  try {
    // 1) Counts by provider/profile for the given asof
    const countsQ = `
      SELECT s.provider, s.profile, COUNT(l.*) AS lines
      FROM public.model_snapshots s
      JOIN public.model_snapshot_lines l ON l.snapshot_id = s.snapshot_id
      WHERE s.asof_date = $1
      GROUP BY s.provider, s.profile
      ORDER BY s.provider, s.profile
    `;
    const countsRes = await query(countsQ, [asof]);
    const counts = (countsRes.rows || []).map(r => ({
      provider: r.provider,
      profile: r.profile,
      lines: Number(r.lines) || 0,
    }));

    // 2) Unknown symbols present in today's snapshots (i.e., not in symbols table)
    const unknownQ = `
      SELECT DISTINCT l.symbol
      FROM public.model_snapshot_lines l
      JOIN public.model_snapshots s ON s.snapshot_id = l.snapshot_id
      LEFT JOIN public.symbols sym ON sym.symbol = l.symbol
      WHERE s.asof_date = $1
        AND sym.symbol IS NULL
      ORDER BY l.symbol
      LIMIT $2
    `;
    const unknownRes = await query(unknownQ, [asof, limit]);
    const unknown_symbols = (unknownRes.rows || []).map(r => r.symbol);

    // 3) Last cron runs (if available)
    let cron_recent: Array<{ job_name: string; ran_at: string }> = [];
    try {
      const cronRes = await query(
        `SELECT job_name, ran_at
           FROM public.cron_log
           ORDER BY ran_at DESC
           LIMIT 10`
      );
      cron_recent = (cronRes.rows || []).map(r => ({
        job_name: r.job_name,
        ran_at: r.ran_at instanceof Date ? r.ran_at.toISOString() : String(r.ran_at),
      }));
    } catch {
      // table may not exist; ignore
    }

    // Convenience: pick latest timestamps for our two jobs
    const pickLatest = (name: string) =>
      cron_recent.find(r => r.job_name === name)?.ran_at || null;

    const cron_summary = {
      rebuild_models_last: pickLatest("rebuild-models"),
      report_cron_last: pickLatest("report-cron"),
    };

    // 4) Most recent fear/greed (if you persist it; otherwise null)
    let fear_greed_recent: { asof_date: string; reading: number } | null = null;
    try {
      const fg = await query(
        `SELECT asof_date, reading
           FROM public.fear_greed
           ORDER BY asof_date DESC
           LIMIT 1`
      );
      if (fg.rows && fg.rows[0]) {
        const row = fg.rows[0];
        fear_greed_recent = {
          asof_date:
            row.asof_date instanceof Date ? row.asof_date.toISOString().slice(0, 10) : String(row.asof_date),
          reading: Number(row.reading),
        };
      }
    } catch {
      // table may not exist or you rely on live API; ignore
    }

    // 5) Basic summary / flags
    const expectedProviders = ["Fidelity", "Vanguard", "Schwab", "Voya", "Other"];
    const expectedProfiles = ["Growth", "Balanced", "Conservative"];
    const matrix = new Map<string, number>();
    counts.forEach(c => matrix.set(`${c.provider}::${c.profile}`, c.lines));

    const missingCombos: Array<{ provider: string; profile: string }> = [];
    for (const p of expectedProviders) {
      for (const pr of expectedProfiles) {
        if (!matrix.has(`${p}::${pr}`)) {
          missingCombos.push({ provider: p, profile: pr });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      asof,
      counts,                 // lines per provider/profile
      missing_combos: missingCombos, // combos with no snapshot for this date
      unknown_symbols,        // symbols used in models but not in symbols table
      cron_recent,            // last ~10 cron runs (if cron_log exists)
      cron_summary,           // quick view of the two main jobs
      fear_greed_recent,      // last stored reading if present
    });
  } catch (e: any) {
    console.error("[cron/health] error:", e?.message || e);
    return NextResponse.json({ ok: false, error: e?.message || "error" }, { status: 500 });
  }
}
