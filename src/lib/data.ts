// src/lib/data.ts
type SymbolRow = { symbol: string; provider: string };

export async function fetchPricesForSymbols(
  symbols: SymbolRow[],
  lookbackDays: number
) {
  // TODO: implement real fetch + writes to symbol_metrics_daily
  // For now, no-op so the build succeeds.
  return { ok: true, count: symbols.length, lookbackDays };
}

export async function fetchFearGreed() {
  // TODO: replace with real API call and persistence
  return { reading: 55, source: "placeholder" };
}
