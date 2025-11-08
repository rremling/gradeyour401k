// src/app/api/cron/rebuild-models/route.ts
import { NextResponse } from "next/server";
import { runDailyMetricsPipeline } from "@/lib/data";
import { buildProviderProfileModel } from "@/lib/modeling";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1) Refresh metrics + Fear/Greed first
    const metrics = await runDailyMetricsPipeline();
    const asof = metrics.asof;

    // 2) Build 15 models (5 providers × 3 profiles)
    const providers = ["Fidelity", "Vanguard", "Schwab", "Voya", "Other"] as const;
    const profiles  = ["Growth", "Balanced", "Conservative"] as const;

    for (const provider of providers) {
      for (const profile of profiles) {
        const snapshot = await buildProviderProfileModel({ asof, provider, profile });

        // TEMP: debug one model build
        if (provider === "Fidelity" && profile === "Balanced") {
          console.log("[rebuild-models] DRAFT", {
            asof,
            provider,
            profile,
            count: snapshot.lines?.length ?? 0,
            lines: snapshot.lines,
          });
        }

        // Header row
        await query(
          `INSERT INTO model_snapshots (snapshot_id, asof_date, provider, profile, is_approved, notes)
           VALUES ($1, $2, $3, $4, true, $5)
           ON CONFLICT DO NOTHING`,
          [snapshot.id, asof, provider, profile, snapshot.notes || null]
        );

        // Lines (ranked holdings). Use a simple loop—reliable across drivers.
        if (snapshot.lines && snapshot.lines.length) {
          for (let i = 0; i < snapshot.lines.length; i++) {
            const ln = snapshot.lines[i];
            await query(
              `INSERT INTO model_snapshot_lines (snapshot_id, rank, symbol, weight, role)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT DO NOTHING`,
              [snapshot.id, i + 1, ln.symbol, ln.weight, ln.role]
            );
          }
        }
      }
    }

    return NextResponse.json({ ok: true, metrics });
  } catch (e: any) {
    console.error("[cron/rebuild-models] error:", e?.message || e);
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
