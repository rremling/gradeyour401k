// src/lib/gy4k.ts
export type ProviderKey =
  | "fidelity"
  | "vanguard"
  | "schwab"
  | "invesco"
  | "blackrock"
  | "statestreet"
  | "voya"
  | "other";

export type InvestorProfile = "Aggressive Growth" | "Growth" | "Balanced";

/* ----------------------------------------------------
   Provider fund lists (abridged versions for brevity)
---------------------------------------------------- */
export const HOLDINGS_MAP: Record<ProviderKey, string[]> = {
  fidelity: [
    "FFGCX","FSELX","FSPHX","FBIOX","FSDAX","FSPTX","FSAVX","FPHAX","FEMKX","FCOM",
    "FNARX","FSLG","FSUTX","FIDSX","FBANK","FXAIX","FDIS","FSPCX","FIDU","FSENX",
    "FMAT","FSTA","FTEC","FUTY","FDLSX","FHLC","FENY","FNCL","FREL","FBND","FCOR",
    "FVAL","FQAL","FDMO","FDRR","FDLO","FIDI","FIVA","FLRG","FBCG","FBCV","FDVV"
  ],
  vanguard: [
    "VOO","VFIAX","VTI","VTSAX","VXF","VXUS","VTIAX","VWO","BND","VBTLX","VGSH",
    "VGIT","VTIP","VNQ","VPU","VDE","VHT","VGT","VFH","VCR","VDC","VIS","VAW",
    "VOX","VTV","VUG","VB","VBR","VO","VOE","VOT","VBK","VEA","BIV","BLV","BNDX",
    "VGLT","VNQI","VIG","VYM","VT","VUSB","VIGI","VYMI"
  ],
  schwab: [
    "SCHB","SCHX","SCHG","SCHV","SCHA","SCHM","SCHF","SCHE","SCHC","SCHZ","SCHP",
    "SCHO","SCHR","SCHQ","SCHI","SCHJ","SCHD","SCHH","SCCR","SMBS","SCUS"
  ],
  statestreet: [
    "SPY","SPLG","SPMD","SPSM","SPYG","SPYV","XLK","XLF","XLV","XLE","XLC","XLY",
    "XLRE","XLI","XLB","XLU","XBI","SPHD","SPIP","SPHY","STOT","TOTL","OBND",
    "SRLN","PRIV","MDY","DIA"
  ],
  blackrock: [
    "IVV","ITOT","IEMG","IEFA","IEUR","IJH","IJR","AGG","IUSB","IUSG","IUSV","ILTB",
    "IMTB","IXUS","IWB","IVE","IVW","IWD","DVY","DIVB","USRT","IAGG","IYC","IYK",
    "IYE","IXJ"
  ],
  invesco: [
    "QQQ","QQQM","SPHQ","SPMO","RSP","XLG","PBUS","SPLV","BKLN","RWL","PRF","PSCT",
    "SPHD","XMMO","XMVM","XMHQ","SPHB","PSR","CSD"
  ],
  voya: [
    "IIFIX","IOSIX","IIGZX","IPIRX","IPLXX","IVMXX","IIVGX","IPIMX","IPLIX","IPMIX",
    "IPSIX","ISDIX","IDXGX","ISEIX","IDXLX","ISJIX","ISKIX","IBRIX","IPIIX","IEOHX",
    "IPEIX","ILBPX","IIMOX","IRMIX","IRGMX","IVCSX","IVSOX","ISZIX","ISNGX","ISQIX",
    "ISNLX","ISRIX","ISNQX","IISNX","VISPX","VIQIX","VSICX","VSIPX","VSQIX","VSSIX",
    "IAVIX","ISGJX","ICGIX","ISWIX","IAGIX","INGIX","IRGIX","IVRIX"
  ],
  other: []
};

/* ----------------------------------------------------
   Provider labels
---------------------------------------------------- */
export const PROVIDERS = [
  { key: "fidelity", label: "Fidelity" },
  { key: "vanguard", label: "Vanguard" },
  { key: "schwab", label: "Charles Schwab" },
  { key: "invesco", label: "Invesco" },
  { key: "blackrock", label: "Blackrock / iShares" },
  { key: "statestreet", label: "State Street / SPDR" },
  { key: "voya", label: "Voya / Other Provider" },
  { key: "other", label: "Other / Unknown" }
];

/* ----------------------------------------------------
   Label map for tooltips
---------------------------------------------------- */
export const LABELS: Record<string, string> = {
  FSKAX: "Fidelity Total Market Index Fund",
  FXNAX: "Fidelity U.S. Bond Index Fund",
  VTI: "Vanguard Total Stock Market ETF",
  VOO: "Vanguard S&P 500 ETF",
  BND: "Vanguard Total Bond Market ETF",
  SPY: "SPDR S&P 500 ETF Trust"
};

/* ----------------------------------------------------
   Validation & helpers
---------------------------------------------------- */
export function validateSymbol(provider: ProviderKey, symbol: string):
  | "inList"
  | "custom"
  | "invalid" {
  if (!symbol) return "invalid";
  const s = symbol.toUpperCase();
  if (HOLDINGS_MAP[provider]?.includes(s)) return "inList";
  // Check if it's valid in *any* provider
  const existsElsewhere = Object.values(HOLDINGS_MAP).some((list) => list.includes(s));
  return existsElsewhere ? "custom" : "invalid";
}

export function labelFor(symbol: string): string {
  return LABELS[symbol.toUpperCase()] || "";
}

/* ----------------------------------------------------
   Grading logic
---------------------------------------------------- */
export function computeGrade(profile: InvestorProfile, totalWeight: number): number {
  const base = profile === "Aggressive Growth"
    ? 4.5
    : profile === "Balanced"
    ? 3.8
    : 4.1;
  const penalty = Math.min(1, Math.abs(100 - totalWeight) / 100);
  return Math.max(1, Math.min(5, Math.round((base - penalty) * 2) / 2));
}

/* ----------------------------------------------------
   Diff / analysis helpers
---------------------------------------------------- */
export function diffAgainstModel(profile: InvestorProfile, holdings: { symbol: string; weight: number }[]) {
  const total = holdings.reduce((s, r) => s + (Number(r.weight) || 0), 0);
  const avg = total > 0 ? total / holdings.length : 0;
  return {
    total,
    avg,
    note:
      profile === "Aggressive Growth"
        ? "Higher allocation to equities recommended."
        : profile === "Balanced"
        ? "Consider moderate mix of stock and bond index funds."
        : "Standard growth allocation."
  };
}

/* ----------------------------------------------------
   Market cycle stub (future upgrade)
---------------------------------------------------- */
export async function getMarketCycleTrend(): Promise<
  "bull" | "bear" | "neutral"
> {
  // Placeholder — in production you’d call AlphaVantage or Polygon here.
  // Example:
  // const res = await fetch(`https://api.example.com/sma?symbol=SPY&apikey=${process.env.ALPHA_KEY}`)
  // const data = await res.json()
  // return data.sma200 > data.price ? "bear" : "bull"
  return "neutral";
}
