// src/lib/market.ts
// Fetch SPY daily closes from Alpha Vantage and compute SMAs.
// Caches in-memory for 15 minutes per server instance.

type Bars = { date: string; close: number }[];

let last: { at: number; regime: string } | null = null;

function sma(values: number[], n: number) {
  if (values.length < n) return null;
  const sum = values.slice(0, n).reduce((a, b) => a + b, 0);
  return sum / n;
}

function classify(close: number, s30?: number | null, s50?: number | null, s100?: number | null, s200?: number | null) {
  // Simple rules: above > bull, mixed > neutral, below < bear.
  const aboveCount = [s30, s50, s100, s200].filter((s) => s && close > (s as number)).length;
  if (aboveCount >= 3) return "Bull (SPY above majority of SMAs)";
  if (aboveCount <= 1) return "Bear (SPY below majority of SMAs)";
  return "Neutral (mixed SMA signals)";
}

export async function getMarketRegime(): Promise<string> {
  // 15-minute memory cache
  const now = Date.now();
  if (last && now - last.at < 15 * 60 * 1000) return last.regime;

  const key = process.env.ALPHA_VANTAGE_API_KEY;
  if (!key) {
    const fallback = "Trend: Neutral (no API key)";
    last = { at: now, regime: fallback };
    return fallback;
  }

  // Use "TIME_SERIES_DAILY_ADJUSTED" and parse latest 260+ days.
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=SPY&outputsize=full&apikey=${key}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const fallback = "Trend: Neutral (fetch error)";
    last = { at: now, regime: fallback };
    return fallback;
  }
  const data = await res.json() as any;
  const series = data["Time Series (Daily)"];
  if (!series) {
    const fallback = "Trend: Neutral (no series)";
    last = { at: now, regime: fallback };
    return fallback;
  }

  // To compute SMAs correctly, sort by date DESC and take closes
  const bars: Bars = Object.keys(series)
    .sort((a, b) => (a < b ? 1 : -1))
    .map((d) => ({ date: d, close: Number(series[d]["5. adjusted close"]) || Number(series[d]["4. close"]) }));

  if (!bars.length) {
    const fallback = "Trend: Neutral (empty)";
    last = { at: now, regime: fallback };
    return fallback;
  }

  // Current close is the most recent bar
  const close = bars[0].close;

  // Build a values array of closes in reverse chronological order
  const values = bars.map((b) => b.close);
  const s30 = sma(values, 30);
  const s50 = sma(values, 50);
  const s100 = sma(values, 100);
  const s200 = sma(values, 200);

  const label = classify(close, s30, s50, s100, s200);
  const pretty =
    `Market Cycle: ${label} — Close: ${close.toFixed(2)} | ` +
    `SMA30 ${s30 ? s30.toFixed(2) : "n/a"} • SMA50 ${s50 ? s50.toFixed(2) : "n/a"} • ` +
    `SMA100 ${s100 ? s100.toFixed(2) : "n/a"} • SMA200 ${s200 ? s200.toFixed(2) : "n/a"}`;

  last = { at: now, regime: pretty };
  return pretty;
}
