// src/lib/funds.ts

/** Starter label map — expand freely. Unknown tickers will fall back to just the symbol. */
export const FUND_LABELS: Record<string, string> = {
  // Common / Core
  FSKAX: "Fidelity® Total Market Index",
  FXNAX: "Fidelity® U.S. Bond Index",

  // Fidelity (expanded subset)
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
  FUTY: "Fidelity® MSCI Utilities ETF",
  FHLC:  "Fidelity® MSCI Health Care ETF",
  FENY:  "Fidelity® MSCI Energy ETF",
  FNCL: "Fidelity® MSCI Financials ETF",
  FREL: "Fidelity® MSCI Real Estate ETF",
  FBND: "Fidelity® Total Bond ETF",
  FCOR: "Fidelity® Corporate Bond ETF",
  FVAL: "Fidelity® Value Factor ETF",
  FQAL: "Fidelity® Quality Factor ETF",
  FDMO: "Fidelity® Momentum Factor ETF",
  FDRR: "Fidelity® Dividend for Rising Rates ETF",
  FDLO: "Fidelity® Low Volatility Factor ETF",
  FIDI: "Fidelity® International High Dividend ETF",
  FIVA: "Fidelity® International Value Factor ETF",
  FLRG: "Fidelity® U.S. Multifactor ETF",
  FBCG: "Fidelity® Blue Chip Growth ETF",
  FBCV: "Fidelity® Blue Chip Value ETF",
  FDVV: "Fidelity® High Dividend ETF",
  FTIHX: "Fidelity® Total International Index",

  // Newly added Fidelity tickers:
  FDCPX: "Fidelity® Disruptive Communications Fund",
  SPAXX: "Fidelity® Government Money Market Fund",
  FIDSX: "Fidelity® Select Financial Services",
  FDLSX: "Fidelity® Select Leisure",

  // Voya (detailed list)
  IIFIX: "Voya Balanced Income Portfolio - Class I",            // :contentReference[oaicite:0]{index=0}
  IOSIX: "Voya Global Bond Portfolio - Class I",                  // :contentReference[oaicite:1]{index=1}
  IIGZX: "Voya Global High Dividend Low Volatility Portfolio - Class I", // :contentReference[oaicite:2]{index=2}
  IPIRX: "Voya Global Perspectives® Portfolio - Class I",          // :contentReference[oaicite:3]{index=3}
  IPLXX: "Voya Government Liquid Assets Portfolio - Class I",     // :contentReference[oaicite:4]{index=4}
  IVMXX: "Voya Government Money Market Portfolio - Class I",      // :contentReference[oaicite:5]{index=5}
  IIVGX: "Voya Growth and Income Portfolio - Class I",            // :contentReference[oaicite:6]{index=6}
  IPIMX: "Voya High Yield Portfolio - Class I",                   // :contentReference[oaicite:7]{index=7}
  IPLIX: "Voya Index Plus LargeCap Portfolio - Class I",          // :contentReference[oaicite:8]{index=8}
  IPMIX: "Voya Index Plus MidCap Portfolio - Class I",            // :contentReference[oaicite:9]{index=9}
  IPSIX: "Voya Index Plus SmallCap Portfolio - Class I",          // :contentReference[oaicite:10]{index=10}
  ISDIX: "Voya Index Solution 2025 Portfolio - Class I",           // :contentReference[oaicite:11]{index=11}
  IDXGX: "Voya Index Solution 2030 Portfolio - Class I",           // :contentReference[oaicite:12]{index=12}
  ISEIX: "Voya Index Solution 2035 Portfolio - Class I",           // :contentReference[oaicite:13]{index=13}
  IDXLX: "Voya Index Solution 2040 Portfolio - Class I",           // :contentReference[oaicite:14]{index=14}
  ISJIX: "Voya Index Solution 2045 Portfolio - Class I",           // :contentReference[oaicite:15]{index=15}
  ISKIX: "Voya Index Solution Income Portfolio - Class I",         // :contentReference[oaicite:16]{index=16}
  IBRIX: "Voya Inflation Protected Bond Plus Portfolio - Class I", // :contentReference[oaicite:17]{index=17}
  IPIIX: "Voya Intermediate Bond Portfolio - Class I",             // :contentReference[oaicite:18]{index=18}
  ILBPX: "Voya Limited Maturity Bond Portfolio - Class I",         // :contentReference[oaicite:19]{index=19}
  IIMOX: "Voya MidCap Opportunities Portfolio - Class I",          // :contentReference[oaicite:20]{index=20}
  IVCSX: "Voya Small Company Portfolio - Class I",                 // :contentReference[oaicite:21]{index=21}
  IVSOX: "Voya SmallCap Opportunities Portfolio - Class I",        // :contentReference[oaicite:22]{index=22}
  ISZIX: "Voya Solution 2025 Portfolio - Class I",                 // :contentReference[oaicite:23]{index=23}
  ISNGX: "Voya Solution 2030 Portfolio - Class I",                 // :contentReference[oaicite:24]{index=24}
  ISQIX: "Voya Solution 2035 Portfolio - Class I",                 // :contentReference[oaicite:25]{index=25}
  ISNLX: "Voya Solution 2040 Portfolio - Class I",                 // :contentReference[oaicite:26]{index=26}
  ISRIX: "Voya Solution 2045 Portfolio - Class I",                 // :contentReference[oaicite:27]{index=27}
  ISNQX: "Voya Solution 2050 Portfolio - Class I",                 // :contentReference[oaicite:28]{index=28}
  IISNX: "Voya Solution 2055 Portfolio - Class I",                 // :contentReference[oaicite:29]{index=29}
  VISPX: "Voya Solution 2060 Portfolio - Class I",                 // :contentReference[oaicite:30]{index=30}
  VIQIX: "Voya Solution 2065 Portfolio - Class I",                 // :contentReference[oaicite:31]{index=31}
  VSICX: "Voya Solution 2070 Portfolio - Class I",                 // :contentReference[oaicite:32]{index=32}
  VSSIX: "Voya Solution 2075 Portfolio - Class I",                 // :contentReference[oaicite:33]{index=33}
  IAVIX: "Voya Solution Aggressive Portfolio - Class I",          // :contentReference[oaicite:34]{index=34}
  ISGJX: "Voya Solution Balanced Portfolio - Class I",             // :contentReference[oaicite:35]{index=35}
  ICGIX: "Voya Solution Conservative Portfolio - Class I",          // :contentReference[oaicite:36]{index=36}
  ISWIX: "Voya Solution Income Portfolio - Class I",               // :contentReference[oaicite:37]{index=37}
  INGIX: "Voya U.S. Stock Index Portfolio - Class I",               // :contentReference[oaicite:38]{index=38}
  IAGIX: "Voya Solution Moderately Aggressive Portfolio - Class I", // :contentReference[oaicite:39]{index=39}
  IRGIX: "VY® CBRE Real Estate Portfolio - Class I",                // :contentReference[oaicite:40]{index=40}
  IVRIX: "VY® CBRE Global Real Estate Portfolio - Class I",        // :contentReference[oaicite:41]{index=41}

  // Vanguard (subset)
  VOO:   "Vanguard S&P 500 ETF",
  VFIAX: "Vanguard 500 Index Fund Admiral",
  VTI:   "Vanguard Total Stock Market ETF",
  VTSAX: "Vanguard Total Stock Market Index Admiral",
  VXF:   "Vanguard Extended Market ETF",
  VXUS:  "Vanguard Total International Stock ETF",
  VTIAX: "Vanguard Total Intl Stock Index Admiral",
  VWO:   "Vanguard FTSE Emerging Markets ETF",
  BND:   "Vanguard Total Bond Market ETF",
  VBTLX: "Vanguard Total Bond Market Index Admiral",
  VGSH:   "Vanguard Short-Term Treasury ETF",
  VGIT:   "Vanguard Intermediate-Term Treasury ETF",
  VTIP:  "Vanguard Short-Term TIPS ETF",
  VNQ:   "Vanguard Real Estate ETF",
  VPU:   "Vanguard Utilities ETF",
  VDE:   "Vanguard Energy ETF",
  VHT:   "Vanguard Health Care ETF",
  VGT:   "Vanguard Information Technology ETF",
  VFH:   "Vanguard Financials ETF",
  VCR:   "Vanguard Consumer Discretionary ETF",
  VDC:   "Vanguard Consumer Staples ETF",
  VIS:   "Vanguard Industrials ETF",
  VAW:   "Vanguard Materials ETF",
  VOX:   "Vanguard Communication Services ETF",
  VTV:   "Vanguard Value ETF",
  VUG:   "Vanguard Growth ETF",
  VB:    "Vanguard Small-Cap ETF",
  VBR:   "Vanguard Small-Cap Value ETF",
  VO:    "Vanguard Mid-Cap ETF",
  VOE:   "Vanguard Mid-Cap Value ETF",
  VOT:   "Vanguard Mid-Cap Growth ETF",
  VBK:   "Vanguard Small-Cap Growth ETF",
  VEA:   "Vanguard FTSE Developed Markets ETF",
  BSV:   "Vanguard Short-Term Bond ETF",
  BIV:   "Vanguard Intermediate-Term Bond ETF",
  BLV:   "Vanguard Long-Term Bond ETF",
  BNDX:  "Vanguard Total International Bond ETF",
  VGLT:  "Vanguard Long-Term Treasury ETF",
  VNQI:  "Vanguard Global ex-US Real Estate ETF",
  VIG:   "Vanguard Dividend Appreciation ETF",
  VYM:   "Vanguard High Dividend Yield ETF",
  VTEB:  "Vanguard Tax-Exempt Bond ETF",
  VT:    "Vanguard Total World Stock ETF",
  VUSB:  "Vanguard Ultra-Short Bond ETF",
  VIGI:  "Vanguard Intl Dividend Appreciation ETF",
  VYMI:  "Vanguard Intl High Dividend Yield ETF",

  // Schwab (subset)
  SCHB:  "Schwab U.S. Broad Market ETF",
  SCHX:  "Schwab U.S. Large-Cap ETF",
  SCHG:  "Schwab U.S. Large-Cap Growth ETF",
  SCHV:  "Schwab U.S. Large-Cap Value ETF",
  SCHA:  "Schwab U.S. Small-Cap ETF",
  SCHM:  "Schwab U.S. Mid-Cap ETF",
  SCHF:  "Schwab International Equity ETF",
  SCHE:  "Schwab Emerging Markets Equity ETF",
  SCHC:  "Schwab International Small-Cap Equity ETF",
  SCHZ:  "Schwab U.S. Aggregate Bond ETF",
  SCHP:  "Schwab U.S. TIPS ETF",
  SCHO:  "Schwab Short-Term U.S. Treasury ETF",
  SCHR:  "Schwab Intermediate-Term U.S. Treasury ETF",
  SCHQ:  "Schwab Long-Term U.S. Treasury ETF",
  SCHI:  "Schwab 5-10 Year Corporate Bond ETF",
  SCHJ:  "Schwab 1-5 Year Corporate Bond ETF",
  SCHD:  "Schwab U.S. Dividend Equity ETF",
  SCHH:  "Schwab U.S. REIT ETF",
  SCCR: "Schwab (label TBD)",
  SMBS: "Schwab (label TBD)",
  SCUS: "Schwab (label TBD)",

  // State Street / SPDR (subset)
  SPY:   "SPDR S&P 500 ETF Trust",
  SPLG:  "SPDR Portfolio S&P 500 ETF",
  SPMD:  "SPDR Portfolio Mid Cap ETF",
  SPSM:  "SPDR Portfolio Small Cap ETF",
  SPYG:  "SPDR Portfolio S&P 500 Growth ETF",
  SPYV: "SPDR Portfolio S&P 500 Value ETF",
  XLK:   "Technology Select Sector SPDR",
  XLF:   "Financial Select Sector SPDR",
  XLV:   "Health Care Select Sector SPDR",
  XLE:   "Energy Select Sector SPDR",
  XLC:   "Communication Services Select Sector SPDR",
  XLY:   "Consumer Discretionary Select Sector SPDR",
  XLRE: "Real Estate Select Sector SPDR",
  XLI:  "Industrial Select Sector SPDR",
  XLB:  "Materials Select Sector SPDR",
  XLU:  "Utilities Select Sector SPDR",
  XBI:  "SPDR S&P Biotech ETF",
  SPHD: "Invesco S&P 500 High Dividend Low Volatility ETF",
  SPIP: "SPDR Portfolio TIPS ETF",
  SPHY: "SPDR Portfolio High Yield Bond ETF",
  STOT: "SPDR DoubleLine Short Term Total Return",
  TOTL: "SPDR DoubleLine Total Return",
  OBND: "SPDR Loomis Sayles Opportunistic Bond",
  SRLN: "SPDR Blackstone Senior Loan ETF",
  PRIV: "SPDR (label TBD)",
  MDY:  "SPDR S&P MidCap 400 ETF Trust",
  DIA:  "SPDR Dow Jones Industrial Average ETF Trust",

  // iShares / BlackRock (subset)
  IVV:   "iShares Core S&P 500 ETF",
  ITOT:  "iShares Core S&P Total U.S. Stock Market ETF",
  IEMG:  "iShares Core MSCI Emerging Markets ETF",
  IEFA:  "iShares Core MSCI EAFE ETF",
  IEUR:  "iShares Core MSCI Europe ETF",
  IJH:   "iShares Core S&P Mid-Cap ETF",
  IJR:   "iShares Core S&P Small-Cap ETF",
  AGG:   "iShares Core U.S. Aggregate Bond ETF",
  IUSB:  "iShares Core Total USD Bond Market ETF",
  IUSG: "iShares Core S&P U.S. Growth ETF",
  IUSV: "iShares Core S&P U.S. Value ETF",
  ILTB: "iShares Core Long-Term U.S. Bond ETF",
  IMTB: "iShares Core 5-10 Year USD Bond ETF",
  IXUS: "iShares Core MSCI Total International Stock ETF",
  IWB:   "iShares Russell 1000 ETF",
  IVE:   "iShares S&P 500 Value ETF",
  IVW:   "iShares S&P 500 Growth ETF",
  IWD:   "iShares Russell 1000 Value ETF",
  DVY:   "iShares Select Dividend ETF",
  DIVB: "iShares U.S. Dividend and Buyback ETF",
  USRT: "iShares Core U.S. REIT ETF",
  IAGG: "iShares Core International Aggregate Bond ETF",
  IYC:  "iShares U.S. Consumer Discretionary ETF",
  IYK:  "iShares U.S. Consumer Staples ETF",
  IYE:  "iShares U.S. Energy ETF",
  IXJ:  "iShares Global Healthcare ETF",

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
