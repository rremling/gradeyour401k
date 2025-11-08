  const rows: Row[] = [];
  const byProvider: Record<string, Row[]> = {};

  for (const s of symbols) {
    const series = tsMap[s.symbol] || [];

    // Helper to push a row both to rows and byProvider
    const pushRow = (r: Row) => {
      rows.push(r);
      (byProvider[r.provider] ||= []).push(r);
    };

    if (!series.length) {
      // No data series: still include a null-metrics row so it participates in scoring
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

    // Ensure ascending dates
    series.sort((a, b) => (a.date < b.date ? -1 : 1));
    const idx = series.findIndex((b) => b.date === asof);
    if (idx < 0) {
      // Missing asof point: still include a null-metrics row
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

    // 21d realized volatility (non-annualized)
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
