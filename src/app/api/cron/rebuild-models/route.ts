// src/app/api/cron/rebuild-models/route.ts
import { NextResponse } from "next/server";
import { runDailyMetricsPipeline } from "@/lib/data";
import { buildProviderProfileModel } from "@/lib/modeling"; // your existing builder
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1) Metrics + Fear/Greed
    const metrics = await runDailyMetricsPipeline();

    // 2) Build the 15 models for this asof (provider×profile)
    const providers = ["Fidelity","Vanguard","Schwab","Voya","Other"] as const;
    const profiles  = ["Growth","Balanced","Conservative"] as const;
    const asof = metrics.asof;

    for (const provider of providers) {
      for (const profile of profiles) {
        const snapshot = await buildProviderProfileModel({ asof, provider, profile });
        await query(
          `INSERT INTO model_snapshots(snapshot_id, asof_date, provider, profile, is_approved, notes)
           VALUES ($1,$2,$3,$4,true,$5)
           ON CONFLICT DO NOTHING`,
          [snapshot.id, asof, provider, profile, snapshot.notes || null]
        );
        if (snapshot.lines?.length) {
          await query.batch(
            snapshot.lines.map((ln: any, i: number) => ({
              text: `INSERT INTO model_snapshot_lines(snapshot_id,rank,symbol,weight,role)
                     VALUES ($1,$2,$3,$4,$5)
                     ON CONFLICT DO NOTHING`,
              values: [snapshot.id, i + 1, ln.symbol, ln.weight, ln.role],
            }))
          );
        }
      }
    }

    return NextResponse.json({ ok: true, metrics });
  } catch (e) {
    console.error("[cron/rebuild-models] error:", (e as Error).message);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
