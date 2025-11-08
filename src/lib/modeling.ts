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
  bondCoreShare: 0.70,   // 70% of bond bucket in core
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
  let { rows: symbols } = await query<SymbolRow>(
    `SELECT symbol, provider, asset_class, style, is_active, expense_ratio
     FROM symbols
     WHERE provider = $1 AND is_active = true`,
    [provider]
  );

  // If provider has nothing (e.g., "Other" or not yet seeded), try a tiny generic fallback
  if (!symbols.length && provider === "Other") {
    const g = await query<SymbolRow>(
      `SELECT symbol, provider, asset_class, style, is_active, expense_ratio
         FROM symbols
        WHERE is_active = true
          AND symbol = ANY($1::text[])`,
      [[ "SPY", "ITOT", "VXUS", "AGG", "BND", "FXNAX", "FBND", "BIL", "SGOV", "SPAXX" ]]
    );
    if (g.rows?.length) symbols = g.rows;
  }

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

  // 4) Pick core sleeves (best-effort detection)
  const core = pickCore(symbols);

  // 5) Rank satellites by score within asset classes (and keep per-asset lists)
  const ranked = rankCandidates(symbols, scoreMap);

  // ── NEW: promote best candidates to Core if Core is missing ─────────────
  const promotedCore = promoteFallbackCore(core, ranked);

  // 6) Assemble weights with caps and targets
  const draft = assembleWithCaps({
    targets: t,
    core: promotedCore,
    satellites: makeSatelliteList(ranked), // unified satellite list
  });

  // 7) Enforce distinct-count bounds and normalize one last time
  let lines = draft.lines;
  if (lines.length < CAPS.minDistinct) {
    const missing = CAPS.minDistinct - lines.length;
    const extras = ranked.eqTop
      .concat(ranked.bondTop)
      .filter((s) => !lines.find((l) => l.symbol === s.symbol))
      .slice(0, Math.max(0, missing))
      .map<Line>((s) => ({ symbol: s.symbol, weight: 0.0001, role: "Satellite" }));
    lines = normalizeWeights([...lines, ...extras]);
  }
  if (lines.length > CAPS.maxDistinct) {
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

/** Try to detect broad “core” holdings by style or known tickers. */
function pickCore(symbols: SymbolRow[]) {
  // Heuristic matchers by style text
  const has = (predicate: (s: SymbolRow) => boolean) => symbols.find(predicate);

  // Equity core
  const usTotal =
    findByStyle(symbols, ["US Total", "US Broad", "US Large Cap", "S&P 500"]) ||
    findBySymbol(symbols, ["FSKAX", "ITOT", "SPY", "IVV", "VOO", "SCHB", "SCHX", "IWB", "FXAIX"]);

  const intlTotal =
    findByStyle(symbols, ["International Total", "International (Developed + EM)", "International Developed", "International"]) ||
    findBySymbol(symbols, ["VXUS", "VEA", "IXUS", "SCHF", "IEFA", "IEMG"]);

  // Bond core (Aggregate)
  const bondTotal =
    findByStyle(symbols, ["US Aggregate", "Aggregate Bond"]) ||
    findBySymbol(symbols, ["AGG", "BND", "SCHZ", "FXNAX", "FBND", "IUSB"]);

  // TIPs + Short as satellites (may also be used as fallback core if no Agg)
  const tips = findByStyle(symbols, ["TIPS"]) ||
               findBySymbol(symbols, ["VTIP", "SCHP", "SPIP"]);
  const shortBond = findByStyle(symbols, ["Short-Term Investment Grade", "Short Treasury", "Short-Term"]) ||
                    findBySymbol(symbols, ["VGSH", "SCHO", "BSV"]);

  // Cash proxy
  const cash =
    findBySymbol(symbols, ["SPAXX", "BIL", "SGOV"]) ||
    symbols.find((s) => s.asset_class === "Cash");

  return {
    equity: compact([usTotal, intlTotal]),
    bond: compact([bondTotal]),
    bondSatellites: compact([tips, shortBond]),
    cash: cash ? [cash] : [],
  };
}

/** Rank candidates and keep top slices for equity and bonds separately. */
function rankCandidates(symbols: SymbolRow[], scoreMap: Map<string, number>) {
  const eqRanked = symbols
    .filter((s) => s.asset_class === "Equity")
    .map((s) => ({ ...s, score: scoreMap.get(s.symbol) ?? -999 }))
    .sort((a, b) => (b.score - a.score) || cmpFee(a, b));

  const bondRanked = symbols
    .filter((s) => s.asset_class === "Bond")
    .map((s) => ({ ...s, score: scoreMap.get(s.symbol) ?? -999 }))
    .sort((a, b) => (b.score - a.score) || cmpFee(a, b));

  const eqTop = eqRanked.slice(0, 6);
  const bondTop = bondRanked.slice(0, 4);

  return { eqRanked, bondRanked, eqTop, bondTop };
}

/** If core detection failed (common for VOYA/OTHER), promote best-scoring candidates to core. */
function promoteFallbackCore(
  core: ReturnType<typeof pickCore>,
  ranked: ReturnType<typeof rankCandidates>
) {
  const next = { ...core };

  // Equity: ensure at least one (ideally two) core sleeves
  if (next.equity.length === 0) {
    // Promote top 2 equities (diversification)
    const candidates = ranked.eqTop.slice(0, 2);
    next.equity = candidates.map((c) => ({ symbol: c.symbol, provider: c.provider, asset_class: c.asset_class, style: c.style, is_active: true, expense_ratio: c.expense_ratio }));
  } else if (next.equity.length === 1 && ranked.eqTop.length > 0) {
    // Try adding an international tilt if the sole core looks like US
    const intl = ranked.eqTop.find((c) => /(intl|international|ex[-\s]?us|world ex)/i.test(c.style || "")) ||
                 ranked.eqTop.find((c) => ["VXUS", "IXUS", "VEA", "SCHF", "IEFA"].includes(c.symbol));
    if (intl && !next.equity.find((e) => e.symbol === intl.symbol)) {
      next.equity.push({ symbol: intl.symbol, provider: intl.provider, asset_class: intl.asset_class, style: intl.style, is_active: true, expense_ratio: intl.expense_ratio });
    }
  }

  // Bond: ensure at least one core sleeve
  if (next.bond.length === 0) {
    const candidate = ranked.bondTop[0];
    if (candidate) {
      next.bond = [{ symbol: candidate.symbol, provider: candidate.provider, asset_class: candidate.asset_class, style: candidate.style, is_active: true, expense_ratio: candidate.expense_ratio }];
    } else if (core.bondSatellites.length > 0) {
      // fallback to TIPs/short as “core”
      next.bond = [core.bondSatellites[0]];
    }
  }

  // Cash stays as-is; if none, we’ll simply allocate cashTarget=0 or skip it.

  return next;
}

/** Convert per-asset tops into a single satellite list for allocation step. */
function makeSatelliteList(ranked: ReturnType<typeof rankCandidates>) {
  const all = ranked.eqTop.concat(ranked.bondTop);
  const uniq = dedupeBy(all, (s) => s.symbol);
  return uniq.map((s) => ({ symbol: s.symbol, role: "Satellite" as const }));
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
    lines.push({ symbol: usCore.symbol,  weight: equityCoreShare * usShare,  role: "Core" });
    lines.push({ symbol: intlCore.symbol, weight: equityCoreShare * intlShare, role: "Core" });
  } else if (usCore) {
    lines.push({ symbol: usCore.symbol, weight: equityCoreShare, role: "Core" });
  } else if (intlCore) {
    lines.push({ symbol: intlCore.symbol, weight: equityCoreShare, role: "Core" });
  }

  allocateSatellites(lines, satellites, equitySatShare, "Equity");

  // 3) Bond core and satellites
  const bondTarget = clamp(1 - sumWeights(lines), 0, 1); // whatever remains should be bond
  const bondCoreShare = bondTarget * CORE_SPLIT.bondCoreShare;
  const bondSatShare = bondTarget - bondCoreShare;

  if (core.bond.length) {
    lines.push({ symbol: core.bond[0].symbol, weight: bondCoreShare, role: "Core" });
  } else if (core.bondSatellites.length) {
    const fallback = core.bondSatellites[0];
    lines.push({ symbol: fallback.symbol, weight: bondCoreShare, role: "Core" });
  }

  allocateSatellites(lines, satellites, bondSatShare, "Bond");

  // 4) Cap enforcement and normalization
  const capped = applyCaps(lines, CAPS.maxLine);
  const finalLines = normalizeWeights(capped);

  return { lines: finalLines };
}

/* ───────────────────── Weight utilities ───────────────────── */

function allocateSatellites(
  lines: Line[],
  sats: { symbol: string; role: "Satellite" }[],
  bucket: number,
  _hint: "Equity" | "Bond"
) {
  if (bucket <= 0 || !sats.length) return;
  const add: Line[] = [];
  const per = Math.max(CAPS.minLine, Math.min(CAPS.maxLine, bucket / Math.min(sats.length, 6)));
  let remaining = bucket;

  for (const s of sats) {
    if (remaining <= 0) break;
    if (lines.find((l) => l.symbol === s.symbol)) continue; // skip duplicates already in Core
    const w = Math.min(per, remaining);
    if (w >= CAPS.minLine * 0.75) {
      add.push({ symbol: s.symbol, weight: w, role: "Satellite" });
      remaining -= w;
    }
    if (add.length + lines.length >= CAPS.maxDistinct) break;
  }

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
  const fallbackIdx =
    bigIdx >= 0 ? bigIdx : lines.findIndex((_, i, arr) => true && i === maxIndex(arr.map((x) => x.weight)));
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

// simple dedupe helper
function dedupeBy<T>(arr: T[], key: (t: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}
