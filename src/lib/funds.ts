// src/lib/funds.ts

/** Starter label map — expand freely. Unknown tickers will fall back to just the symbol. */
export const FUND_LABELS: Record<string, string> = {
  // Common
  FSKAX: "Fidelity® Total Market Index",
  FXNAX: "Fidelity® U.S. Bond Index",

  // Fidelity (subset)
  FFGCX: "Fidelity® Global Commodity Stock",
  FSELX: "Fidelity® Select Semiconductors",
  FSPHX: "Fidelity® Select Health Care",
  FBIOX: "Fidelity® Select Biotechnology",
  FSDAX: "Fidelity® Select Materials",
  FSPTX: "Fidelity® Select Technology",
  FSAVX: "Fidelity® Select Automotive",
  FPHAX: "Fidelity® Select Pharmaceuticals",
  FEMKX: "Fidelity® Emerging Markets",
  FCOM:  "Fidelity® MSCI Communication Services ETF",
  FNARX: "Fidelity® Select Natural Resources",
  FSUTX: "Fidelity® Select Utilities",
  FXAIX: "Fidelity® 500 Index",
  FDIS:  "Fidelity® MSCI Consumer Discretionary ETF",
  FSPCX: "Fidelity® Select Insurance",
  FIDU:  "Fidelity® MSCI Industrials ETF",
  FSENX: "Fidelity® Select Energy",
  FMAT:  "Fidelity® MSCI Materials ETF",
  FSTA:  "Fidelity® MSCI Consumer Staples ETF",
  FTEC:  "Fidelity® MSCI Information Technology ETF",
  FUTY:  "Fidelity® MSCI Utilities ETF",
  FHLC:  "Fidelity® MSCI Health Care ETF",
  FENY:  "Fidelity® MSCI Energy ETF",
  FNCL:  "Fidelity® MSCI Financials ETF",
  FREL:  "Fidelity® MSCI Real Estate ETF",
  FBND:  "Fidelity® Total Bond ETF",
  FCOR:  "Fidelity® Corporate Bond ETF",
  FVAL:  "Fidelity® Value Factor ETF",
  FQAL:  "Fidelity® Quality Factor ETF",
  FDMO:  "Fidelity® Momentum Factor ETF",
  FDRR:  "Fidelity® Dividend for Rising Rates ETF",
  FDLO:  "Fidelity® Low Volatility Factor ETF",
  FIDI:  "Fidelity® Intl High Dividend ETF",
  FIVA:  "Fidelity® Intl Value Factor ETF",
  FLRG:  "Fidelity® U.S. Multifactor ETF",
  FBCG:  "Fidelity® Blue Chip Growth ETF",
  FBCV:  "Fidelity® Blue Chip Value ETF",
  FDVV:  "Fidelity® High Dividend ETF",
  FDCPX: "Fidelity® Select Tech Hardware Portfolio",
  SPAXX: "Fidelity® Government Money Market Fund",

  // Vanguard (subset)
  VOO:   "Vanguard S&P 500 ETF",
  VFIAX: "Vanguard 500 Index Fund Admiral",
  VTI:   "Vanguard Total Stock Market ETF",
  VTSAX: "Vanguard Total Stock Market Index Admiral",
  VXUS:  "Vanguard Total International Stock ETF",
  VTIAX: "Vanguard Total Intl Stock Index Admiral",
  VWO:   "Vanguard FTSE Emerging Markets ETF",
  BND:   "Vanguard Total Bond Market ETF",
  VNQ:   "Vanguard Real Estate ETF",
  VIG:   "Vanguard Dividend Appreciation ETF",
  VYM:   "Vanguard High Dividend Yield ETF",
  VPU:   "Vanguard Utilities ETF",
  VDE:   "Vanguard Energy ETF",
  VGT:   "Vanguard Information Technology ETF",

  // Schwab (subset)
  SCHB:  "Schwab U.S. Broad Market ETF",
  SCHX:  "Schwab U.S. Large-Cap ETF",
  SCHG:  "Schwab U.S. Large-Cap Growth ETF",
  SCHV:  "Schwab U.S. Large-Cap Value ETF",
  SCHZ:  "Schwab U.S. Aggregate Bond ETF",
  SCHD:  "Schwab U.S. Dividend Equity ETF",

  // State Street / SPDR (subset)
  SPY:   "SPDR S&P 500 ETF Trust",
  SPLG:  "SPDR Portfolio S&P 500 ETF",
  SPMD:  "SPDR Portfolio Mid Cap ETF",
  SPSM:  "SPDR Portfolio Small Cap ETF",
  XLK:   "Technology Select Sector SPDR",
  XLF:   "Financial Select Sector SPDR",
  XLV:   "Health Care Select Sector SPDR",
  XLU:   "Utilities Select Sector SPDR",
  XLY:   "Consumer Discretionary Select Sector SPDR",

  // iShares / BlackRock (subset)
  IVV:   "iShares Core S&P 500 ETF",
  ITOT:  "iShares Core S&P Total U.S. Stock Market ETF",
  AGG:   "iShares Core U.S. Aggregate Bond ETF",
  IXUS:  "iShares Core MSCI Total International Stock ETF",

  // Invesco (subset)
  QQQ:   "Invesco QQQ Trust",
  QQQM:  "Invesco NASDAQ-100 ETF",
  SPLV:  "Invesco S&P 500 Low Volatility ETF",
};

function normalizeSymbol(raw: string): string {
  // Uppercase, trim, collapse spaces. You can extend this if you encounter odd share-class suffixes.
  return (raw || "").toUpperCase().trim().replace(/\s+/g, "");
}

/** Returns "TICKER — Name" if known, else just "TICKER". */
export function labelFor(symRaw: string): string {
  const sym = normalizeSymbol(symRaw);
  const name = FUND_LABELS[sym];
  return name ? `${sym} — ${name}` : sym;
}
