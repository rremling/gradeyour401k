// src/app/api/cron/rebuild-models/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { fetchPricesForSymbols, fetchFearGreed } from "@/lib/data";
import { buildProviderProfileModel } from "@/lib/modeling";

export const dynamic = "force-dynamic";

export async function GET() {
  const asof = new Date().toISOString().slice(0,10); // YYYY-MM-DD
  const providers = ['Fidelity','Vanguard','Schwab','Voya','Other'] as const;
  const profiles  = ['Growth','Balanced','Conservative'] as const;

  // 1) Universe
  const symbols = await query(/* sql */`SELECT * FROM symbols WHERE is_active = true`);

  // 2) Prices & metrics
  await fetchPricesForSymbols(symbols, /* lookbackDays= */ 220);
  await query(/* sql */`
    -- compute metrics in SQL or via Node and bulk-insert into symbol_metrics_daily
  `);

  // 3) Sentiment
  const fearGreed = await fetchFearGreed();
  await query(`INSERT INTO fear_greed_cache(asof_date,reading,source) VALUES ($1,$2,$3)
               ON CONFLICT (asof_date) DO UPDATE SET reading=EXCLUDED.reading, source=EXCLUDED.source`,
              [asof, fearGreed.reading, fearGreed.source]);

  // 4) Build all 15 models
  for (const provider of providers) {
    for (const profile of profiles) {
      const snapshot = await buildProviderProfileModel({ asof, provider, profile });
      // insert snapshot + lines
      await query(`INSERT INTO model_snapshots(snapshot_id,asof_date,provider,profile,is_approved,notes)
                   VALUES ($1,$2,$3,$4,true,$5)`, [snapshot.id, asof, provider, profile, snapshot.notes]);
      await query.batch(snapshot.lines.map((ln, i) => ({
        text: `INSERT INTO model_snapshot_lines(snapshot_id,rank,symbol,weight,role) VALUES ($1,$2,$3,$4,$5)`,
        values: [snapshot.id, i+1, ln.symbol, ln.weight, ln.role]
      })));
    }
  }

  return NextResponse.json({ ok: true, date: asof });
}
