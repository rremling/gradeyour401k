// src/lib/models-client.ts
import { query } from "@/lib/db";

type ModelLine = {
  rank: number;
  symbol: string;
  weight: number;
  role: string | null;
};

export type LatestModel = {
  asof: string;
  lines: ModelLine[];
  notes: string | null;
  fear_greed: { asof_date: string; reading: number } | null;
};

/**
 * Fetch the latest approved model for a given provider/profile,
 * PLUS the latest Fear & Greed reading from Neon (fear_greed_cache).
 */
export async function fetchLatestModel(
  provider: string,
  profile: string
): Promise<LatestModel | null> {
  // 1) Latest approved model snapshot for this provider/profile
  const headerRes: any = await query(
    `
    SELECT snapshot_id, asof_date, provider, profile, notes
      FROM model_snapshots
     WHERE provider = $1
       AND profile  = $2
       AND is_approved = true
     ORDER BY asof_date DESC
     LIMIT 1;
    `,
    [provider, profile]
  );

  const header = headerRes?.rows?.[0];
  if (!header) {
    return null;
  }

  // 2) Lines for that snapshot
  const linesRes: any = await query(
    `
    SELECT rank, symbol, weight, role
      FROM model_snapshot_lines
     WHERE snapshot_id = $1
     ORDER BY rank ASC;
    `,
    [header.snapshot_id]
  );

  const lines: ModelLine[] = (linesRes?.rows || []).map((r: any) => ({
    rank: Number(r.rank),
    symbol: String(r.symbol || "").toUpperCase().trim(),
    weight: Number(r.weight) || 0,
    role: r.role ?? null,
  }));

  // 3) Latest Fear & Greed reading from Neon
  //    (If your column name is "value" instead of "reading", change it below.)
  const fgRes: any = await query(
    `
    SELECT asof_date, reading
      FROM fear_greed_cache
     ORDER BY asof_date DESC
     LIMIT 1;
    `
  );

  const fgRow = fgRes?.rows?.[0];
  const fear_greed = fgRow
    ? {
        asof_date:
          fgRow.asof_date instanceof Date
            ? fgRow.asof_date.toISOString().slice(0, 10)
            : String(fgRow.asof_date).slice(0, 10),
        reading: Number(fgRow.reading),
      }
    : null;

  const asof =
    header.asof_date instanceof Date
      ? header.asof_date.toISOString().slice(0, 10)
      : String(header.asof_date).slice(0, 10);

  return {
    asof,
    lines,
    notes: header.notes ?? null,
    fear_greed,
  };
}
