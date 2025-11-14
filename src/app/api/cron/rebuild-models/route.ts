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
    // 1) Try to refresh metrics + Fear/Greed via lib/data, but don't fail if missing
    let asof = todayISO();
    try {
      const dataMod: any = await import("@/lib/data");
      const runPipeline =
        dataMod?.runDailyMetricsPipeline ||
        dataMod?.default?.runDailyMetricsPipeline;

      if (typeof runPipeline === "function") {
        const metrics = await runPipeline();
        // accept YYYY-MM-DD or full ISO
        const raw = metrics?.asof || metrics?.as_of || metrics?.date || todayISO();
        asof = String(raw).slice(0, 10);
      } else {
        console.warn(
          "[rebuild-models] runDailyMetricsPipeline not found; using fallback asof",
        );
      }
    } catch (e: any) {
      console.warn(
        "[rebuild-models] dynamic import of lib/data failed; using fallback asof:",
        e?.message || e,
      );
    }

    // 2) Build 12 models (4 providers × 3 profiles)
    const providers = ["Fidelity", "Vanguard", "Schwab", "Voya"] as const;
    const profiles = ["Growth", "Balanced", "Conservative"] as const;

    for (const provider of providers) {
      for (const profile of profiles) {
        const snapshot = await buildProviderProfileModel({ asof, provider, profile });

        // ── Find or create the header row for (asof, provider, profile) ──
        // We DO NOT rely on a (asof_date, provider, profile) unique index.
        // 1) Try to reuse an existing snapshot_id for this trio (so lines can be replaced cleanly)
        const existing = await query(
          `SELECT snapshot_id
             FROM model_snapshots
            WHERE asof_date = $1 AND provider = $2 AND profile = $3
            LIMIT 1`,
          [asof, provider, profile]
        );

        let snapId: string;

        if (Array.isArray((existing as any)?.rows) && (existing as any).rows.length) {
          // Reuse the existing snapshot_id for today/provider/profile
          snapId = (existing as any).rows[0].snapshot_id;
          // Keep header current (approved + latest notes)
          await query(
            `UPDATE model_snapshots
                SET is_approved = true,
                    notes = $2
              WHERE snapshot_id = $1`,
            [snapId, snapshot.notes || null]
          );
        } else {
          // No header yet for this trio today — insert one using the model's suggested id
          // Upsert on PK snapshot_id in case the id already exists for any reason
          const inserted = await query(
            `INSERT INTO model_snapshots (snapshot_id, asof_date, provider, profile, is_approved, notes)
             VALUES ($1, $2, $3, $4, true, $5)
             ON CONFLICT (snapshot_id)
             DO UPDATE SET asof_date = EXCLUDED.asof_date,
                           provider  = EXCLUDED.provider,
                           profile   = EXCLUDED.profile,
                           is_approved = true,
                           notes = EXCLUDED.notes
             RETURNING snapshot_id`,
            [snapshot.id, asof, provider, profile, snapshot.notes || null]
          );
          snapId = (inserted as any).rows[0].snapshot_id;
        }

        // ── Replace lines for this snapshot_id ──
        await query(`DELETE FROM model_snapshot_lines WHERE snapshot_id = $1`, [snapId]);

        if (snapshot.lines && snapshot.lines.length) {
          for (let i = 0; i < snapshot.lines.length; i++) {
            const ln = snapshot.lines[i];
            await query(
              `INSERT INTO model_snapshot_lines (snapshot_id, rank, symbol, weight, role)
               VALUES ($1, $2, $3, $4, $5)`,
              [snapId, i + 1, ln.symbol, ln.weight, ln.role]
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
      { status: 500 },
    );
  }
}
