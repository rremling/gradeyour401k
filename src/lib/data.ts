// src/lib/data.ts
import { query } from "@/lib/db";

/* ────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────── */
type SymbolRow = {
  symbol: string;
  provider: "Fidelity" | "Vanguard" | "Schwab" | "Voya" | "Other";
  asset_class: "Equity" | "Bond" | "Cash" | "Alt";
  is_active: boolean;
};

type DailyBar = { date: string; close: number };
type TSMap = Record<string, DailyBar[]>;

const AV_KEY = process.env.ALPHA_VANTAGE_API_KEY || "";
const FEAR_GREED_URL = process.env.FEAR_GREED_FEED_URL || "";

/* ────────────────────────────────────────────────────────────
   Public API used by your cron route
   ──────────────────────────────────────────────────────────── */

/**
 * Fetch N trading days for each symbol (AlphaVantage → Stooq fallback).
 * Returns a map: symbol -> array of {date, close}, sorted ASC by date.
 */
export async function fetchPricesForSymbols(
  symbols: SymbolRow[],
  lookbackDays = 220
): Promise<TSMap> {
  const active = symbols.filter((s) => s.is_active);
  const out: TSMap = {};
  // Basic rate limiting: Alpha Vantage free tier ~5 req/min. We'll do sequential AV,
  // and use Stooq fallback for failures or mutual funds not covered.
  for (const s of active) {
    const ts = await fetchSeriesForSymbol(s.symbol, lookbackDays).catch(() => null);
    if (ts && ts.length) {
      out[s.symbol] = ts;
    } else {
      console.warn(`[prices] no data for ${s.symbol}`);
      out[s.symbol] = [];
    }
    // small delay to be courteous with AV limits
    await sleep(1300);
  }
  return out;
}

/**
 * Compute metrics & scores for `asof` (defaults to latest overlapping date across series)
 * and upsert into `symbol_metrics_daily`. Returns the asof used and row count written.
 */
export async function computeAndStoreMetrics(
  symbols: SymbolRow[],
  tsMap: TSMap,
  explicitAsof?: string
): Promise<{ asof: string; written: number }> {
  // Determine common asof (latest date present in ≥70% of series), or use explicit
  const allDates = new Map<string, number>();
  for (const series of Object.values(tsMap)) {
    for (const b of series) {
      allDates.set(b.date, (allDates.get(b.date) || 0) + 1);
    }
  }
  let asof = explicitAsof || "";
  if (!asof) {
    const threshold = Math.ceil(Object.keys(tsMap).length * 0.7);
    const sorted = [...allDates.entries()]
      .filter(([, cnt]) => cnt >= threshold)
      .map(([d]) => d)
      .sort();
    asof = sorted[sorted.length - 1];
    if (!asof) {
      throw new Error("No overlapping asof date found across timeseries");
    }
  }

  // Build per-symbol metric rows
  type Row = {
    asof_date: string;
    symbol: string;
    ret_1d: number | null;
    ret_21d: number | null;
    ret_63d: number | null;
    vol_21d: number | null;
    trend_margin: number | null;
    provider: SymbolRow["provider"];
  };

  const rows: Row[] = [];
  const byProvider: Record<string, Row[]> = {};

  for (const s of symbols) {
    const series = tsMap[s.symbol] || [];
    if (!series.length) {
      rows.push({
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
    // Ensure ascending dates
    series.sort((a, b) => (a.date < b.date ? -1 : 1));
    const idx = series.findIndex((b) => b.date === asof);
    if (idx < 0) {
      rows.push({
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

    // 21d realized volatility (non-annualized): stddev of daily returns over lookback 21
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

    // 126d SMA trend margin
    const smaStart = Math.max(0, idx - 125);
    const slice = series.slice(smaStart, idx + 1).map((b) => b.close);
    const sma126 = slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : null;
    const trend_margin =
      isFinite(c0) && isFinite(sma126 || NaN) && (sma126 || 0) > 0 ? c0 / (sma126 as number) - 1 : null;

    const row: Row = {
      asof_date: asof,
      symbol: s.symbol,
      ret_1d,
      ret_21d,
      ret_63d,
      vol_21d,
      trend_margin,
      provider: s.provider,
    };
    rows.push(row);
    (byProvider[s.provider] ||= []).push(row);
  }

  // Z-score per provider for ret_1d, ret_21d, ret_63d, vol_21d, trend_margin
  const scored: { asof: string; symbol: string; ret_1d: number | null; ret_21d: number | null; ret_63d: number | null; vol_21d: number | null; trend_margin: number | null; score: number | null }[] = [];
  for (const [provider, arr] of Object.entries(byProvider)) {
    const zs = zscoreBlock(arr, ["ret_1d", "ret_21d", "ret_63d", "vol_21d", "trend_margin"] as const);
    for (const z of zs) {
      // Composite score (clamp z's to ±3 first)
      const z1d = clamp(z.ret_1d ?? 0, -3, 3);
      const z21 = clamp(z.ret_21d ?? 0, -3, 3);
      const z63 = clamp(z.ret_63d ?? 0, -3, 3);
      const zvol = clamp(z.vol_21d ?? 0, -3, 3);
      const ztrd = clamp(z.trend_margin ?? 0, -3, 3);

      const score =
        0.15 * z1d +
        0.35 * z21 +
        0.35 * z63 +
        0.10 * ztrd -
        0.15 * zvol;

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

  // Bulk upsert into symbol_metrics_daily
  const values: any[] = [];
  const chunks: string[] = [];
  scored.forEach((r, i) => {
    const base = i * 7;
    chunks.push(
      `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7})`
    );
    values.push(
      r.asof,
      r.symbol,
      toPgNullable(r.ret_1d),
      toPgNullable(r.ret_21d),
      toPgNullable(r.ret_63d),
      toPgNullable(r.vol_21d),
      toPgNullable(r.trend_margin),
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

    // Now update `score` in a second pass using a simple UPDATE with CASE (or insert into a temp, but keep simple)
    // Build a temp map in JS and update per symbol (batched).
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
        WHERE asof_date = ANY(${
          // gather distinct dates for narrower WHERE
          `ARRAY[${[...new Set(slice.map((r) => `'${r.asof}'`))].join(",")}]::date[]`
        });
      `;
      await query(sql, vals);
    }
  }

  return { asof, written };
}

/**
 * Fetch Fear/Greed reading and persist. If FEAR_GREED_FEED_URL is unset or fails,
 * we return a placeholder and do not throw (so cron continues).
 */
export async function fetchFearGreed(): Promise<{ reading: number; source: string } | null>  {
  if (!FEAR_GREED_URL) {
    console.warn("[fear_greed] FEAR_GREED_FEED_URL not set; skipping");
    return null;
  }
  try {
    const res = await fetch(FEAR_GREED_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const reading = Number(json?.value);
    if (!isFinite(reading)) throw new Error("Invalid value");
    const asof = todayUTC();

    await query(
      `INSERT INTO fear_greed_cache(asof_date, reading, source)
         VALUES ($1,$2,$3)
       ON CONFLICT (asof_date) DO UPDATE
         SET reading = EXCLUDED.reading, source = EXCLUDED.source`,
      [asof, Math.round(reading), FEAR_GREED_URL]
    );
    return { reading: Math.round(reading), source: FEAR_GREED_URL };
  } catch (e) {
    console.warn("[fear_greed] fetch failed:", (e as Error).message);
    return null;
  }
}

/* ────────────────────────────────────────────────────────────
   Helpers: fetching & math
   ──────────────────────────────────────────────────────────── */

async function fetchSeriesForSymbol(symbol: string, lookbackDays: number): Promise<DailyBar[]> {
  // Try Alpha Vantage first
  if (AV_KEY) {
    try {
      const url = new URL("https://www.alphavantage.co/query");
      url.searchParams.set("function", "TIME_SERIES_DAILY_ADJUSTED");
      url.searchParams.set("symbol", symbol);
      url.searchParams.set("outputsize", "compact"); // ~100 last days; we only need ~63-126; call twice if needed
      url.searchParams.set("apikey", AV_KEY);
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) throw new Error(`AV HTTP ${res.status}`);
      const json = await res.json();
      const series = json["Time Series (Daily)"];
      if (series && typeof series === "object") {
        const bars: DailyBar[] = Object.keys(series).map((d) => ({
          date: d,
          close: Number(series[d]["5. adjusted close"]),
        }));
        bars.sort((a, b) => (a.date < b.date ? -1 : 1));
        // If we need > 100 days, make a second call for "full" only when necessary
        if (bars.length < lookbackDays) {
          const url2 = new URL("https://www.alphavantage.co/query");
          url2.searchParams.set("function", "TIME_SERIES_DAILY_ADJUSTED");
          url2.searchParams.set("symbol", symbol);
          url2.searchParams.set("outputsize", "full");
          url2.searchParams.set("apikey", AV_KEY);
          const res2 = await fetch(url2.toString(), { cache: "no-store" });
          if (res2.ok) {
            const json2 = await res2.json();
            const series2 = json2["Time Series (Daily)"];
            if (series2) {
              const all: DailyBar[] = Object.keys(series2).map((d) => ({
                date: d,
                close: Number(series2[d]["5. adjusted close"]),
              }));
              all.sort((a, b) => (a.date < b.date ? -1 : 1));
              return lastN(all, lookbackDays);
            }
          }
        }
        return lastN(bars, lookbackDays);
      }
      throw new Error("Alpha Vantage: unexpected payload");
    } catch (e) {
      console.warn(`[prices] AV failed for ${symbol}:`, (e as Error).message);
    }
  }

  // Fallback: Stooq CSV (works for most ETFs/indices; mutual funds coverage varies)
  try {
    const stooq = `https://stooq.com/q/d/l/?s=${symbol.toLowerCase()}&i=d`;
    const res = await fetch(stooq, { cache: "no-store" });
    if (!res.ok) throw new Error(`Stooq HTTP ${res.status}`);
    const text = await res.text();
    const lines = text.trim().split("\n");
    // CSV header: Date,Open,High,Low,Close,Volume
    const bars: DailyBar[] = lines
      .slice(1)
      .map((ln) => ln.split(","))
      .filter((cols) => cols.length >= 5)
      .map((cols) => ({ date: cols[0], close: Number(cols[4]) }))
      .filter((b) => isFinite(b.close));
    bars.sort((a, b) => (a.date < b.date ? -1 : 1));
    return lastN(bars, lookbackDays);
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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
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

const toPgNullable = (x: number | null) => (isFinite(x as number) ? x : null);

/* ────────────────────────────────────────────────────────────
   Convenience orchestrator (optional)
   ──────────────────────────────────────────────────────────── */

/**
 * Full pipeline helper you can call from the cron:
 *   1) load active symbols
 *   2) fetch prices
 *   3) compute metrics & write
 *   4) fetch fear/greed & store
 */
export async function runDailyMetricsPipeline() {
  const symbols: SymbolRow[] =
    (await query<SymbolRow>(`SELECT symbol, provider, asset_class, is_active FROM symbols WHERE is_active = true`))
      .rows;

  const tsMap = await fetchPricesForSymbols(symbols, 220);
  const { asof, written } = await computeAndStoreMetrics(symbols, tsMap);
  await fetchFearGreed();

  return { asof, symbols: symbols.length, written };
}
