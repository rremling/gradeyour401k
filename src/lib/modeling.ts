// src/lib/modeling.ts
import { query } from "@/lib/db";
import { randomUUID } from "crypto";

/* ───────────────────────── Types ───────────────────────── */

export type Provider = "Fidelity" | "Vanguard" | "Schwab" | "Voya" | "Other";
export type Profile = "Growth" | "Balanced" | "Conservative";

type SymbolRow = {
  symbol: string;
  provider: Provider;
  asset_class: "Equity" | "Bond" | "Cash" | "Alt";
  style: string | null;
  is_active: boolean;
  expense_ratio: number | null;
};

type MetricRow = {
  symbol: string;
  asof_date: string;
  score: number | null;
};

type Targets = { equity: number; bond: number; cash: number };

type Line = {
  symbol: string;
  weight: number;
  role: "Core" | "Satellite";
};

type Draft = {
  id: string;
  notes?: string;
  lines: Line[];
};

/* ─────────────────── Config / Guardrails ─────────────────── */

const CAPS = {
  maxLine: 0.15, // ≤ 15% per line
  minLine: 0.05, // ≥ 5% to avoid dust
  minDistinct: 5,
  maxDistinct: 10,
};

// Equity/Bond target split between Core vs Satellites
const CORE_SPLIT = {
  equityCoreShare: 0.70, // 70% of equity bucket in core
  bondCoreShare: 0.70, // 70% of bond bucket in core
};

// Within equity core, US vs Intl split if both present
const EQUITY_US_INTL_SPLIT: [number, number] = [0.70, 0.30]; // 70/30 if both exist

/* ─────────────────────── Public API ─────────────────────── */

/**
 * Build a Provider×Profile snapshot for a given as-of date.
 * Assumes symbol_metrics_daily already has scores for `asof`.
 */
export async function buildProviderProfileModel({
  asof,
  provider,
  profile,
}: {
  asof: string;
  provider: Provider;
  profile: Profile;
}): Promise<Draft> {
  // 1) Load active symbols for provider
  const { rows: symbols } = await query<SymbolRow>(
    `SELECT symbol, provider, asset_class, style, is_active, expense_ratio
     FROM symbols
     WHERE provider = $1 AND is_active = true`,
    [provider]
  );
  if (!symbols.length) {
    return {
      id: randomUUID(),
      notes: `No active symbols for ${provider} on ${asof}`,
      lines: [],
    };
  }

  // 2) Load metrics/scores for this as-of
  const { rows: metrics } = await query<MetricRow>(
    `SELECT symbol, asof_date, score
     FROM symbol_metrics_daily
     WHERE asof_date = $1 AND symbol = ANY($2::text[])`,
    [asof, symbols.map((s) => s.symbol)]
  );

  // Map score by symbol (nulls treated as very low)
  const scoreMap = new Map<string, number>();
  for (const m of metrics) scoreMap.set(m.symbol, isFinite(m.score as number) ? (m.score as number) : -999);

  // 3) Profile targets (equity/bond/cash) from DB or default
  const t = await getTargets(profile);

  // 4) Pick core sleeves
  const core = pickCore(symbols);

  // 5) Rank satellites by score within asset classes
  const satellites = pickSatellites(symbols, scoreMap, core);

  // 6) Assemble weights with caps and targets
  const draft = assembleWithCaps({ targets: t, core, satellites });

  // 7) Enforce distinct-count bounds and normalize one last time
  let lines = draft.lines;
  if (lines.length < CAPS.minDistinct) {
    // If we don't have enough lines, try to add more satellites (tiny equal weights)
    const missing = CAPS.minDistinct - lines.length;
    const extras = satellites
      .filter((s) => !lines.find((l) => l.symbol === s.symbol))
      .slice(0, Math.max(0, missing))
      .map<Line>((s) => ({ symbol: s.symbol, weight: 0.0001, role: "Satellite" }));
    lines = normalizeWeights([...lines, ...extras]);
  }
  if (lines.length > CAPS.maxDistinct) {
    // Drop smallest until within cap
    lines = [...lines].sort((a, b) => b.weight - a.weight).slice(0, CAPS.maxDistinct);
    lines = normalizeWeights(lines);
  }

  // 8) Final min-line enforcement (push residuals to biggest core)
  lines = enforceMinLine(lines, CAPS.minLine);

  // 9) Deterministic rank order for storage (desc weight, then symbol)
  lines.sort((a, b) => (b.weight - a.weight) || (a.symbol < b.symbol ? -1 : 1));

  return {
    id: randomUUID(),
    notes: `${provider} / ${profile} model for ${asof}`,
    lines,
  };
}

/* ───────────────────── Helper functions ───────────────────── */

async function getTargets(profile: Profile): Promise<Targets> {
  const { rows } = await query<{ equity_target: number; bond_target: number; cash_target: number }>(
    `SELECT equity_target, bond_target, cash_target
     FROM model_targets WHERE profile = $1`,
    [profile]
  );
  if (!rows.length) {
    // Defaults as agreed
    switch (profile) {
      case "Growth":
        return { equity: 0.9, bond: 0.1, cash: 0 };
      case "Balanced":
        return { equity: 0.6, bond: 0.4, cash: 0 };
      case "Conservative":
        return { equity: 0.35, bond: 0.6, cash: 0.05 };
    }
  }
  const r = rows[0];
  return { equity: r.equity_target, bond: r.bond_target, cash: r.cash_target };
}

function pickCore(symbols: SymbolRow[]) {
  // Heuristic matchers by style text
  const has = (predicate: (s: SymbolRow) => boolean) => symbols.find(predicate);

  // Equity core
  const usTotal =
    findByStyle(symbols, ["US Total"]) ||
    findByStyle(symbols, ["US Broad", "US Large Cap / S&P 500"]) ||
    findBySymbol(symbols, ["FXAIX", "VTI", "VOO", "SCHB", "SCHX", "SPY", "ITOT"]);

  const intlTotal =
    findByStyle(symbols, ["International Total", "International (Developed + EM)"]) ||
    findByStyle(symbols, ["International Developed"]) ||
    findBySymbol(symbols, ["VXUS", "VEA", "IXUS", "SCHF"]);

  // Bond core
  const bondTotal =
    findByStyle(symbols, ["US Aggregate"]) ||
    findBySymbol(symbols, ["AGG", "BND", "SCHZ", "FXNAX", "FBND"]);

  // TIPs + Short as satellites (may also be used as fallback core if no Agg)
  const tips = findByStyle(symbols, ["TIPS"]);
  const shortBond = findByStyle(symbols, ["Short-Term Investment Grade", "Short Treasury"]) ||
                    findBySymbol(symbols, ["VGSH", "SCHO"]);

  // Cash proxy
  const cash =
    findBySymbol(symbols, ["BIL", "SGOV"]) ||
    symbols.find((s) => s.asset_class === "Cash");

  return {
    equity: compact([usTotal, intlTotal]),
    bond: compact([bondTotal]),
    bondSatellites: compact([tips, shortBond]),
    cash: cash ? [cash] : [],
  };
}

function pickSatellites(
  symbols: SymbolRow[],
  scoreMap: Map<string, number>,
  core: ReturnType<typeof pickCore>
) {
  const exclude = new Set<string>([
    ...core.equity.map((s) => s.symbol),
    ...core.bond.map((s) => s.symbol),
    ...core.bondSatellites.map((s) => s.symbol),
    ...core.cash.map((s) => s.symbol),
  ]);

  const eqSat = symbols
    .filter((s) => s.asset_class === "Equity" && !exclude.has(s.symbol))
    .map((s) => ({ ...s, score: scoreMap.get(s.symbol) ?? -999 }))
    .sort((a, b) => (b.score - a.score) || cmpFee(a, b));

  const bondSat = symbols
    .filter((s) => s.asset_class === "Bond" && !exclude.has(s.symbol))
    .map((s) => ({ ...s, score: scoreMap.get(s.symbol) ?? -999 }))
    .sort((a, b) => (b.score - a.score) || cmpFee(a, b));

  // Take a reasonable top slice to keep distinct-count sane
  const eqTop = eqSat.slice(0, 6);
  const bondTop = bondSat.slice(0, 4);

  return [...eqTop, ...bondTop].map((s) => ({ symbol: s.symbol, role: "Satellite" as const }));
}

function assembleWithCaps({
  targets,
  core,
  satellites,
}: {
  targets: Targets;
  core: ReturnType<typeof pickCore>;
  satellites: { symbol: string; role: "Satellite" }[];
}): { lines: Line[] } {
  const lines: Line[] = [];

  // 1) Cash bucket
  const cashTarget = clamp(targets.cash, 0, 1);
  if (cashTarget > 0 && core.cash.length) {
    lines.push({ symbol: core.cash[0].symbol, weight: cashTarget, role: "Core" });
  }

  // 2) Equity core and satellites
  const equityTarget = clamp(targets.equity, 0, 1 - sumWeights(lines));
  const equityCoreShare = equityTarget * CORE_SPLIT.equityCoreShare;
  const equitySatShare = equityTarget - equityCoreShare;

  const [usCore, intlCore] = core.equity;
  if (usCore && intlCore) {
    const [usShare, intlShare] = EQUITY_US_INTL_SPLIT;
    lines.push({ symbol: usCore.symbol, weight: equityCoreShare * usShare, role: "Core" });
    lines.push({ symbol: intlCore.symbol, weight: equityCoreShare * intlShare, role: "Core" });
  } else if (usCore) {
    lines.push({ symbol: usCore.symbol, weight: equityCoreShare, role: "Core" });
  } else if (intlCore) {
    lines.push({ symbol: intlCore.symbol, weight: equityCoreShare, role: "Core" });
  }

  // Equity satellites: take top N equity satellites
  const eqSat = satellites.filter((s) => true); // already mixed; equity first in pickSatellites
  allocateSatellites(lines, eqSat, equitySatShare);

  // 3) Bond core and satellites
  const bondTarget = clamp(1 - sumWeights(lines), 0, 1); // whatever remains should be bond
  const bondCoreShare = bondTarget * CORE_SPLIT.bondCoreShare;
  const bondSatShare = bondTarget - bondCoreShare;

  if (core.bond.length) {
    lines.push({ symbol: core.bond[0].symbol, weight: bondCoreShare, role: "Core" });
  } else {
    // Fallback: use short duration or tips as "core" if no aggregate exists
    const fallback = core.bondSatellites[0];
    if (fallback) lines.push({ symbol: fallback.symbol, weight: bondCoreShare, role: "Core" });
  }

  // Bond satellites: prefer TIPs then short
  const bondSat = core.bondSatellites.map((s) => ({ symbol: s.symbol, role: "Satellite" as const }));
  allocateSatellites(lines, bondSat, bondSatShare);

  // 4) Cap enforcement and normalization
  const capped = applyCaps(lines, CAPS.maxLine);
  const finalLines = normalizeWeights(capped);

  return { lines: finalLines };
}

/* ───────────────────── Weight utilities ───────────────────── */

function allocateSatellites(lines: Line[], sats: { symbol: string; role: "Satellite" }[], bucket: number) {
  if (bucket <= 0 || !sats.length) return;
  const add: Line[] = [];
  const per = Math.max(CAPS.minLine, Math.min(CAPS.maxLine, bucket / Math.min(sats.length, 6)));
  let remaining = bucket;

  for (const s of sats) {
    if (remaining <= 0) break;
    const w = Math.min(per, remaining);
    if (w >= CAPS.minLine * 0.75) { // allow a tiny dip during assembly; we'll fix with enforceMinLine
      add.push({ symbol: s.symbol, weight: w, role: "Satellite" });
      remaining -= w;
    }
    if (add.length + lines.length >= CAPS.maxDistinct) break;
  }

  // Merge with existing (sum if duplicate)
  for (const a of add) {
    const i = lines.findIndex((l) => l.symbol === a.symbol);
    if (i >= 0) lines[i].weight += a.weight;
    else lines.push(a);
  }
}

function applyCaps(lines: Line[], maxLine: number): Line[] {
  const capped = lines.map((l) => ({ ...l, weight: Math.min(l.weight, maxLine) }));
  // Redistribute any shaved amount to the largest Core line
  const shaved = sumWeights(lines) - sumWeights(capped);
  if (shaved > 0) {
    const coreIdx = capped.findIndex((l) => l.role === "Core");
    if (coreIdx >= 0) capped[coreIdx].weight += shaved;
  }
  return capped;
}

function enforceMinLine(lines: Line[], minLine: number): Line[] {
  // Any line below minLine is dropped and its weight goes to the largest Core (or largest line)
  const bigIdx = lines.findIndex((l) => l.role === "Core");
  const fallbackIdx = bigIdx >= 0 ? bigIdx : lines.findIndex((_, i, arr) => true && i === maxIndex(arr.map((x) => x.weight)));
  let keep: Line[] = [];
  let residual = 0;
  for (const l of lines) {
    if (l.weight < minLine && lines.length > 1) residual += l.weight;
    else keep.push(l);
  }
  if (residual > 0 && keep.length) {
    const idx = fallbackIdx >= 0 && fallbackIdx < keep.length ? fallbackIdx : 0;
    keep[idx].weight += residual;
  }
  return normalizeWeights(keep);
}

function normalizeWeights(lines: Line[]): Line[] {
  const total = sumWeights(lines);
  if (total <= 0) return lines;
  return lines.map((l) => ({ ...l, weight: round4(l.weight / total) }));
}

const sumWeights = (lines: Line[]) => lines.reduce((a, b) => a + (b.weight || 0), 0);
const round4 = (x: number) => Math.round(x * 10000) / 10000;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const maxIndex = (xs: number[]) => xs.reduce((bi, x, i, arr) => (x > arr[bi] ? i : bi), 0);

/* ───────────────────── Symbol helpers ───────────────────── */

function findBySymbol(list: SymbolRow[], symbols: string[]) {
  return list.find((s) => symbols.includes(s.symbol));
}
function findByStyle(list: SymbolRow[], needles: string[]) {
  const n = needles.map((x) => x.toLowerCase());
  return list.find((s) => (s.style || "").toLowerCase() && n.some((k) => (s.style || "").toLowerCase().includes(k)));
}
const compact = <T,>(xs: (T | undefined | null)[]) => xs.filter(Boolean) as T[];
const cmpFee = (a: SymbolRow, b: SymbolRow) => (num(a.expense_ratio) - num(b.expense_ratio));
const num = (x: number | null) => (isFinite(x as number) ? (x as number) : 9e9);
