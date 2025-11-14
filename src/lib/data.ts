// src/lib/data.ts
import { query } from "@/lib/db";

/* ────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────── */
type Provider = "Fidelity" | "Vanguard" | "Schwab" | "Voya" | "Other";
type AssetClass = "Equity" | "Bond" | "Cash" | "Alt";

type SymbolRow = {
  symbol: string;
  provider: Provider;
  asset_class: AssetClass;
  is_active: boolean;
};

type DailyBar = { date: string; close: number };
type TSMap = Record<string, DailyBar[]>;

const FEAR_GREED_URL = process.env.FEAR_GREED_FEED_URL || "";

/* ────────────────────────────────────────────────────────────
   Public API used by your cron route
   ──────────────────────────────────────────────────────────── */

export async function fetchPricesForSymbols(
  symbols: SymbolRow[],
  lookbackDays = 220
): Promise<TSMap> {
  const active = symbols.filter((s) => s.is_active);
  const out: TSMap = {};
  for (const s of active) {
    const ts = await fetchSeriesForSymbol(s.symbol, lookbackDays).catch(() => null);
    if (ts && ts.length) out[s.symbol] = ts;
    else {
      console.warn(`[prices] no data for ${s.symbol}`);
      out[s.symbol] = [];
    }
  }
  return out;
}

export async function computeAndStoreMetrics(
  symbols: SymbolRow[],
  tsMap: TSMap,
  explicitAsof?: string
): Promise<{ asof: string; written: number }> {
  const nonEmpty = Object.values(tsMap).filter((arr) => arr.length > 0);
  if (!nonEmpty.length) throw new Error("No price series available for any symbol");

  let asof = explicitAsof || "";
  if (!asof) {
    const counts = new Map<string, number>();
    for (const series of nonEmpty) {
      for (const b of series) counts.set(b.date, (counts.get(b.date) || 0) + 1);
    }
    const threshold = Math.ceil(nonEmpty.length * 0.7);
    const consensus = [...counts.entries()]
      .filter(([, cnt]) => cnt >= threshold)
      .map(([d]) => d)
      .sort();
    if (consensus.length) asof = consensus[consensus.length - 1];
    else {
      const latestPerSeries = nonEmpty.map((s) => s[s.length - 1].date).sort();
      asof = latestPerSeries[latestPerSeries.length - 1];
    }
  }
  if (!asof) asof = priorBusinessDayUTC();

  type Row = {
    asof_date: string;
    symbol: string;
    ret_1d: number | null;
    ret_21d: number | null;
    ret_63d: number | null;
    vol_21d: number | null;
    trend_margin: number | null;
    provider: Provider;
  };

  const rows: Row[] = [];
  const byProvider: Record<string, Row[]> = {};
  const pushRow = (r: Row) => {
    rows.push(r);
    (byProvider[r.provider] ||= []).push(r);
  };

  for (const s of symbols) {
    const series = tsMap[s.symbol] || [];
    if (!series.length) {
      pushRow({
        asof_date: asof,
        symbol: s.symbol,
        ret_1d: null,
        ret_21d: null,
        ret_63d: null,
        vol_21d: null,
        trend_margin: null,
        provider: s.provider,
      });
      continue;
    }
    series.sort((a, b) => (a.date < b.date ? -1 : 1));
    const idx = series.findIndex((b) => b.date === asof);
    if (idx < 0) {
      pushRow({
        asof_date: asof,
        symbol: s.symbol,
        ret_1d: null,
        ret_21d: null,
        ret_63d: null,
        vol_21d: null,
        trend_margin: null,
        provider: s.provider,
      });
      continue;
    }

    const c0 = series[idx]?.close;
    const c1 = series[idx - 1]?.close;
    const c21 = series[idx - 21]?.close;
    const c63 = series[idx - 63]?.close;

    const ret_1d = safeRet(c1, c0);
    const ret_21d = safeRet(c21, c0);
    const ret_63d = safeRet(c63, c0);

    const windowStart = Math.max(0, idx - 21);
    const rets: number[] = [];
    for (let i = windowStart + 1; i <= idx; i++) {
      const prev = series[i - 1]?.close;
      const curr = series[i]?.close;
      if (isFinite(prev) && isFinite(curr) && prev > 0) {
        rets.push((curr - prev) / prev);
      }
    }
    const vol_21d = rets.length >= 2 ? stddev(rets) : null;

    const smaStart = Math.max(0, idx - 125);
    const slice = series.slice(smaStart, idx + 1).map((b) => b.close);
    const sma126 = slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : null;
    const trend_margin =
      isFinite(c0) && isFinite(sma126 || NaN) && (sma126 || 0) > 0 ? c0 / (sma126 as number) - 1 : null;

    pushRow({
      asof_date: asof,
      symbol: s.symbol,
      ret_1d,
      ret_21d,
      ret_63d,
      vol_21d,
      trend_margin,
      provider: s.provider,
    });
  }

  const scored: {
    asof: string;
    symbol: string;
    ret_1d: number | null;
    ret_21d: number | null;
    ret_63d: number | null;
    vol_21d: number | null;
    trend_margin: number | null;
    score: number | null;
  }[] = [];

  for (const [, arr] of Object.entries(byProvider)) {
    const zs = zscoreBlock(arr, ["ret_1d", "ret_21d", "ret_63d", "vol_21d", "trend_margin"] as const);
    for (const z of zs) {
      const z1d = clamp(z.ret_1d ?? 0, -3, 3);
      const z21 = clamp(z.ret_21d ?? 0, -3, 3);
      const z63 = clamp(z.ret_63d ?? 0, -3, 3);
      const zvol = clamp(z.vol_21d ?? 0, -3, 3);
      const ztrd = clamp(z.trend_margin ?? 0, -3, 3);

      const score = 0.15 * z1d + 0.35 * z21 + 0.35 * z63 + 0.1 * ztrd - 0.15 * zvol;

      scored.push({
        asof,
        symbol: z.symbol,
        ret_1d: findBySymbol(arr, z.symbol)?.ret_1d ?? null,
        ret_21d: findBySymbol(arr, z.symbol)?.ret_21d ?? null,
        ret_63d: findBySymbol(arr, z.symbol)?.ret_63d ?? null,
        vol_21d: findBySymbol(arr, z.symbol)?.vol_21d ?? null,
        trend_margin: findBySymbol(arr, z.symbol)?.trend_margin ?? null,
        score,
      });
    }
  }

  const values: any[] = [];
  const chunks: string[] = [];
  scored.forEach((r, i) => {
    const base = i * 7;
    chunks.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7})`);
    values.push(
      r.asof,
      r.symbol,
      toPgNullable(r.ret_1d),
      toPgNullable(r.ret_21d),
      toPgNullable(r.ret_63d),
      toPgNullable(r.vol_21d),
      toPgNullable(r.trend_margin)
    );
  });

  let written = 0;
  if (chunks.length) {
    const text = `
      INSERT INTO symbol_metrics_daily
        (asof_date, symbol, ret_1d, ret_21d, ret_63d, vol_21d, trend_margin)
      VALUES
        ${chunks.join(",")}
      ON CONFLICT (asof_date, symbol) DO UPDATE SET
        ret_1d = EXCLUDED.ret_1d,
        ret_21d = EXCLUDED.ret_21d,
        ret_63d = EXCLUDED.ret_63d,
        vol_21d = EXCLUDED.vol_21d,
        trend_margin = EXCLUDED.trend_margin
    `;
    await query(text, values);
    written = scored.length;

    const batchSize = 100;
    for (let i = 0; i < scored.length; i += batchSize) {
      const slice = scored.slice(i, i + batchSize);
      const vals: any[] = [];
      const cases: string[] = [];
      slice.forEach((r, j) => {
        vals.push(r.asof, r.symbol, r.score);
        cases.push(`(asof_date = $${3 * j + 1} AND symbol = $${3 * j + 2}) THEN $${3 * j + 3}`);
      });
      const sql = `
        UPDATE symbol_metrics_daily
        SET score = CASE
          ${cases.map((c) => `WHEN ${c}`).join(" ")}
          ELSE score
        END
        WHERE asof_date = ANY(${`ARRAY[${[...new Set(slice.map((r) => `'${r.asof}'`))].join(",")}]::date[]`});
      `;
      await query(sql, vals);
    }
  }

  const nonNullCount = scored.filter((r) => r.ret_21d !== null || r.ret_63d !== null).length;
  const coverage = nonNullCount / (symbols.length || 1);
  console.log(
    `[metrics] ${nonNullCount}/${symbols.length} symbols have data for ${asof} (coverage=${(
      coverage * 100
    ).toFixed(1)}%)`
  );

  return { asof, written };
}

export async function fetchFearGreed(): Promise<{ reading: number; source: string } | null> {
  if (!FEAR_GREED_URL) {
    console.warn("[fear_greed] FEAR_GREED_FEED_URL not set; skipping");
    return null;
  }
  try {
    const res = await fetch(FEAR_GREED_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    let value: number | null = null;
    let srcDateIso: string | null = null;

    if (typeof json?.value !== "undefined") {
      value = Number(json.value);
    } else if (Array.isArray(json?.data) && json.data.length > 0) {
      const first = json.data[0];
      value = Number(first?.value);
      const ts = Number(first?.timestamp);
      if (Number.isFinite(ts)) srcDateIso = new Date(ts * 1000).toISOString().slice(0, 10);
    }

    if (!Number.isFinite(value)) throw new Error("Invalid value");

    const asof = srcDateIso || todayUTC();
    const reading = Math.max(0, Math.min(100, Math.round(value as number)));

    await query(
      `INSERT INTO fear_greed_cache(asof_date, reading, source)
       VALUES ($1,$2,$3)
       ON CONFLICT (asof_date) DO UPDATE
         SET reading = EXCLUDED.reading, source = EXCLUDED.source`,
      [asof, reading, FEAR_GREED_URL]
    );
    console.log(`[fear_greed] cached ${reading} for ${asof}`);
    return { reading, source: FEAR_GREED_URL };
  } catch (e) {
    console.warn("[fear_greed] fetch failed:", (e as Error).message);
    return null;
  }
}

/**
 * Run your daily metrics pipeline:
 * - Fetch latest Fear & Greed and cache it in fear_greed_cache
 * - Return { asof, reading } based on the latest row in that table
 *
 * This is what /api/cron/rebuild-models calls.
 */
export async function runDailyMetricsPipeline(): Promise<{
  asof: string;
  reading: number | null;
}> {
  // 1) Try to fetch and cache the latest Fear & Greed reading
  let reading: number | null = null;
  try {
    const fg = await fetchFearGreed();
    if (fg) reading = fg.reading;
  } catch (e) {
    console.warn("[runDailyMetricsPipeline] fetchFearGreed failed:", (e as Error).message);
  }

  // 2) Look up the most recent row in fear_greed_cache to get asof + reading
  let asof = todayUTC();
  try {
    const res: any = await query(
      `SELECT asof_date, reading
         FROM fear_greed_cache
        ORDER BY asof_date DESC
        LIMIT 1`
    );

    const row = Array.isArray(res?.rows) ? res.rows[0] : Array.isArray(res) ? res[0] : null;
    if (row?.asof_date) {
      asof = String(row.asof_date).slice(0, 10);
      if (reading === null && row.reading != null) {
        reading = Number(row.reading);
      }
    }
  } catch (e) {
    console.warn("[runDailyMetricsPipeline] failed to read fear_greed_cache:", (e as Error).message);
  }

  return { asof, reading };
}

/* ────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────── */

async function fetchSeriesForSymbol(symbol: string, lookbackDays: number): Promise<DailyBar[]> {
  try {
    const stooqSym = `${symbol.toLowerCase()}.us`;
    const stooq = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSym)}&i=d`;
    const res = await fetch(stooq, { cache: "no-store" });
    if (!res.ok) throw new Error(`Stooq HTTP ${res.status}`);
    const text = await res.text();
    const lines = text.trim().split("\n");
    if (lines.length > 1 && lines[0].toLowerCase().startsWith("date,")) {
      const bars: DailyBar[] = lines
        .slice(1)
        .map((ln) => ln.split(","))
        .filter((cols) => cols.length >= 5)
        .map((cols) => ({ date: cols[0], close: Number(cols[4]) }))
        .filter((b) => isFinite(b.close));
      bars.sort((a, b) => (a.date < b.date ? -1 : 1));
      if (bars.length) return lastN(bars, lookbackDays);
    } else {
      console.warn(`[prices] Stooq returned no rows for ${symbol}.us`);
    }
  } catch (e) {
    console.warn(`[prices] Stooq failed for ${symbol}:`, (e as Error).message);
  }
  return [];
}

function zscoreBlock<T extends { symbol: string }>(
  rows: (T & Record<string, number | null>)[],
  keys: readonly (keyof T | string)[]
) {
  const stats: Record<string, { mean: number; sd: number }> = {};
  for (const k of keys) {
    const vals = rows.map((r) => Number(r[k as string])).filter((v) => isFinite(v));
    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const sd =
      vals.length > 1
        ? Math.sqrt(vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (vals.length - 1))
        : 1;
    stats[k as string] = { mean, sd: sd || 1 };
  }
  return rows.map((r) => {
    const z: any = { symbol: r.symbol };
    for (const k of keys) {
      const v = Number(r[k as string]);
      const { mean, sd } = stats[k as string];
      z[k as string] = isFinite(v) ? (v - mean) / sd : null;
    }
    return z;
  });
}

function findBySymbol<T extends { symbol: string }>(arr: T[], sym: string) {
  return arr.find((x) => x.symbol === sym);
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const lastN = <T,>(arr: T[], n: number) => arr.slice(Math.max(0, arr.length - n));
const stddev = (xs: number[]) => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1 || 1);
  return Math.sqrt(v);
};
const safeRet = (prev?: number, curr?: number) =>
  isFinite(prev || NaN) && isFinite(curr || NaN) && (prev as number) > 0 ? (curr! - prev!) / prev! : null;

const todayUTC = () => {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

function priorBusinessDayUTC(ref = new Date()): string {
  const d = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()));
  const dow = d.getUTCDay(); // 0 Sun .. 6 Sat
  if (dow === 0) d.setUTCDate(d.getUTCDate() - 2);
  else if (dow === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

const toPgNullable = (x: number | null) => (isFinite(x as number) ? x : null);
