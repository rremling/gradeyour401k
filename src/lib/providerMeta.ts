// src/lib/providerMeta.ts
export type ProviderKey =
  | "fidelity"
  | "vanguard"
  | "schwab"
  | "invesco"
  | "blackrock"
  | "statestreet"
  | "voya"
  | "other";

export const PROVIDER_DISPLAY: Record<ProviderKey, string> = {
  fidelity: "Fidelity",
  vanguard: "Vanguard",
  schwab: "Charles Schwab",
  invesco: "Invesco",
  blackrock: "BlackRock / iShares",
  statestreet: "State Street / SPDR",
  voya: "Voya",
  other: "Other provider",
};

export function normalizeProviderKey(v: string): ProviderKey {
  const s = v.toLowerCase().trim();
  if (s.includes("fidelity")) return "fidelity";
  if (s.includes("vanguard")) return "vanguard";
  if (s.includes("schwab")) return "schwab";
  if (s.includes("invesco")) return "invesco";
  if (s.includes("blackrock") || s.includes("ishares")) return "blackrock";
  if (s.includes("state") || s.includes("spdr")) return "statestreet";
  if (s.includes("voya")) return "voya";
  return "other";
}

export const PROVIDER_TICKERS: Record<ProviderKey, string[]> = {
  fidelity: [
    "FFGCX","FSELX","FSPHX","FBIOX","FSDAX","FSPTX","FSAVX","FPHAX","FEMKX","FCOM",
    "FNARX","FSLG","FSUTX","FIDSX","FBANK","FXAIX","FDIS","FSPCX","FIDU","FSENX",
    "FMAT","FSTA","FTEC","FUTY","FDLSX","FHLC","FENY","FNCL","FREL","FBND","FCOR",
    "FVAL","FQAL","FDMO","FDRR","FDLO","FIDI","FIVA","FLRG","FBCG","FBCV","FDVV"
  ],
  vanguard: [
    "VOO","VFIAX","VTI","VTSAX","VXF","VXUS","VTIAX","VWO","BND","VBTLX","VGSH","VGIT","VTIP",
    "VNQ","VPU","VDE","VHT","VGT","VFH","VCR","VDC","VIS","VAW","VOX","VTV","VUG","VB","VBR",
    "VO","VOE","VOT","VBK","VEA","BSV","BIV","BLV","BNDX","VGLT","VNQI","VIG","VYM","VTEB","VT",
    "VUSB","VIGI","VYMI"
  ],
  schwab: [
    "SCHB","SCHX","SCHG","SCHV","SCHA","SCHM","SCHF","SCHE","SCHC","SCHZ","SCHP","SCHO","SCHR",
    "SCHQ","SCHI","SCHJ","SCHD","SCHH","SCCR","SMBS","SCUS"
  ],
  statestreet: [
    "SPY","SPLG","SPMD","SPSM","SPYG","SPYV","XLK","XLF","XLV","XLE","XLC","XLY","XLRE","XLI",
    "XLB","XLU","XBI","SPHD","SPIP","SPHY","STOT","TOTL","OBND","SRLN","PRIV","MDY","DIA"
  ],
  blackrock: [
    "IVV","ITOT","IEMG","IEFA","IEUR","IJH","IJR","AGG","IUSB","IUSG","IUSV","ILTB","IMTB",
    "IXUS","IWB","IVE","IVW","IWD","DVY","DIVB","USRT","IAGG","IYC","IYK","IYE","IXJ"
  ],
  invesco: [
    "QQQ","QQQM","SPHQ","SPMO","RSP","XLG","PBUS","SPLV","BKLN","RWL","PRF","PSCT","SPHD",
    "XMMO","XMVM","XMHQ","SPHB","PSR","CSD"
  ],
  voya: [
    "IIFIX","IOSIX","IIGZX","IPIRX","IPLXX","IVMXX","IIVGX","IPIMX","IPLIX","IPMIX","IPSIX","ISDIX",
    "IDXGX","ISEIX","IDXLX","ISJIX","ISKIX","IBRIX","IPIIX","IEOHX","IPEIX","ILBPX","IIMOX","IRMIX",
    "IRGMX","IVCSX","IVSOX","ISZIX","ISNGX","ISQIX","ISNLX","ISRIX","ISNQX","IISNX","VISPX","VIQIX",
    "VSICX","VSIPX","VSQIX","VSSIX","IAVIX","ISGJX","ICGIX","ISWIX","IAGIX","INGIX","IRGIX","IVRIX"
  ],
  other: [],
};
