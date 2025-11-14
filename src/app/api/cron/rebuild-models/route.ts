// src/app/api/cron/rebuild-models/route.ts
import { NextResponse } from "next/server";
import { buildProviderProfileModel } from "@/lib/modeling";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

function todayISO(): string {
  // YYYY-MM-DD (UTC)
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  try {
    // 1) As-of date: just use "today" for now
    const asof = todayISO();

    // 2) Build 12 models (4 providers × 3 profiles)
    const providers = ["Fidelity", "Vanguard", "Schwab", "Voya"] as const;
    const profiles = ["Growth", "Balanced", "Conservative"] as const;

    for (const provider of providers) {
      for (const profile of profiles) {
        const snapshot = await buildProviderProfileModel({ asof, provider, profile });

        // ── model_snapshots: UPDATE-then-INSERT (no ON CONFLICT required)
        {
          const existing: any = await query(
            `SELECT 1 FROM model_snapshots WHERE snapshot_id = $1 LIMIT 1`,
            [snapshot.id]
          );

          const exists =
            Array.isArray((existing as any)?.rows)
              ? (existing as any).rows.length > 0
              : Array.isArray(existing)
              ? existing.length > 0
              : false;

          if (exists) {
            await query(
              `UPDATE model_snapshots
                 SET asof_date = $2,
                     provider  = $3,
                     profile   = $4,
                     is_approved = true,
                     notes     = $5
               WHERE snapshot_id = $1`,
              [snapshot.id, asof, provider, profile, snapshot.notes || null]
            );
          } else {
            await query(
              `INSERT INTO model_snapshots
                 (snapshot_id, asof_date, provider, profile, is_approved, notes)
               VALUES ($1, $2, $3, $4, true, $5)`,
              [snapshot.id, asof, provider, profile, snapshot.notes || null]
            );
          }
        }

        // ── model_snapshot_lines: upsert per (PK) row, concurrency-safe
        if (snapshot.lines && snapshot.lines.length) {
          for (let i = 0; i < snapshot.lines.length; i++) {
            const ln = snapshot.lines[i];
            await query(
              `INSERT INTO model_snapshot_lines (snapshot_id, rank, symbol, weight, role)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT ON CONSTRAINT model_snapshot_lines_pkey
               DO UPDATE SET
                 symbol = EXCLUDED.symbol,
                 weight = EXCLUDED.weight,
                 role   = EXCLUDED.role`,
              [snapshot.id, i + 1, ln.symbol, ln.weight, ln.role]
            );
          }
        }
      }
    }

    return NextResponse.json({ ok: true, asof });
  } catch (e: any) {
    console.error("[cron/rebuild-models] error:", e?.message || e);
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
