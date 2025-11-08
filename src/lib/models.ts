// src/lib/models.ts
import { query } from "@/lib/db";

export type Provider = "Fidelity" | "Vanguard" | "Schwab" | "Voya" | "Other";
export type Profile  = "Growth" | "Balanced" | "Conservative";

export type ModelLine = {
  rank: number;
  symbol: string;
  weight: number;
  role: string | null;
};

export type ModelSnapshot = {
  snapshot_id: string;
  asof_date: string;   // YYYY-MM-DD
  provider: Provider;
  profile: Profile;
  is_approved: boolean;
  notes: string | null;
  lines: ModelLine[];
};

export async function getLatestApprovedModel(
  provider: Provider,
  profile: Profile
): Promise<ModelSnapshot | null> {
  const head = await query<{ snapshot_id: string; asof_date: string; notes: string | null }>(
    `
    SELECT s.snapshot_id, s.asof_date, s.notes
    FROM model_snapshots s
    WHERE s.provider = $1 AND s.profile = $2 AND s.is_approved = true
    ORDER BY s.asof_date DESC
    LIMIT 1
    `,
    [provider, profile]
  );
  if (head.rows.length === 0) return null;

  const { snapshot_id, asof_date, notes } = head.rows[0];

  const lines = await query<ModelLine>(
    `
    SELECT rank, symbol, weight, role
    FROM model_snapshot_lines
    WHERE snapshot_id = $1
    ORDER BY rank ASC
    `,
    [snapshot_id]
  );

  return {
    snapshot_id,
    asof_date,
    provider,
    profile,
    is_approved: true,
    notes,
    lines: lines.rows,
  };
}

export async function getLatestFearGreed(): Promise<{ asof_date: string; reading: number } | null> {
  const fg = await query<{ asof_date: string; reading: number }>(
    `
    SELECT asof_date, reading
    FROM fear_greed_cache
    ORDER BY asof_date DESC
    LIMIT 1
    `
  );
  return fg.rows[0] ?? null;
}
