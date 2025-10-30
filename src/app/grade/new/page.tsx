// (File 2) src/app/grade/new/page.tsx
"use client";

import { Suspense } from "react";
import { useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Trash2 } from "lucide-react";

type InvestorProfile = "Growth" | "Balanced" | "Conservative";
type Holding = { symbol: string; weight: number | "" };

// ---- Provider display names ----
const PROVIDER_DISPLAY: Record<string, string> = {
  fidelity: "Fidelity",
  vanguard: "Vanguard",
  schwab: "Charles Schwab",
  invesco: "Invesco",
  blackrock: "BlackRock / iShares",
  "state-street": "State Street / SPDR",
  voya: "Voya",
  other: "Other",
};

// ---- Provider ticker catalogs ----
const PROVIDER_FUNDS: Record<string, string[]> = {
  fidelity: [
    "FFGCX","FSELX","FSPHX","FBIOX","FSDAX","FSPTX","FSAVX","FPHAX","FEMKX","FCOM",
    "FNARX","FSLG","FSUTX","FIDSX","FBANK","FXAIX","FDIS","FSPCX","FIDU","FSENX",
    "FMAT","FSTA","FTEC","FUTY","FDLSX","FHLC","FENY","FNCL","FREL","FBND","FCOR",
    "FVAL","FQAL","FDMO","FDRR","FDLO","FIDI","FIVA","FLRG","FBCG","FBCV","FDVV",
  ],
  vanguard: [
    "VOO","VFIAX","VTI","VTSAX","VXF","VXUS","VTIAX","VWO","BND","VBTLX","VGSH","VGIT",
    "VTIP","VNQ","VPU","VDE","VHT","VGT","VFH","VCR","VDC","VIS","VAW","VOX","VTV",
    "VUG","VB","VBR","VO","VOE","VOT","VBK","VEA","BSV","BIV","BLV","BNDX","VGLT",
    "VNQI","VIG","VYM","VTEB","VT","VUSB","VIGI","VYMI",
  ],
  schwab: [
    "SCHB","SCHX","SCHG","SCHV","SCHA","SCHM","SCHF","SCHE","SCHC","SCHZ","SCHP",
    "SCHO","SCHR","SCHQ","SCHI","SCHJ","SCHD","SCHH","SCCR","SMBS","SCUS",
  ],
  "state-street": [
    "SPY","SPLG","SPMD","SPSM","SPYG","SPYV","XLK","XLF","XLV","XLE","XLC","XLY",
    "XLRE","XLI","XLB","XLU","XBI","SPHD","SPIP","SPHY","STOT","TOTL","OBND","SRLN",
    "PRIV","MDY","DIA",
  ],
  blackrock: [
    "IVV","ITOT","IEMG","IEFA","IEUR","IJH","IJR","AGG","IUSB","IUSG","IUSV","ILTB",
    "IMTB","IXUS","IWB","IVE","IVW","IWD","DVY","DIVB","USRT","IAGG","IYC","IYK","IYE",
    "IXJ",
  ],
  invesco: [
    "QQQ","QQQM","SPHQ","SPMO","RSP","XLG","PBUS","SPLV","BKLN","RWL","PRF","PSCT",
    "SPHD","XMMO","XMVM","XMHQ","SPHB","PSR","CSD",
  ],
  voya: [
    "IIFIX","IOSIX","IIGZX","IPIRX","IPLXX","IVMXX","IIVGX","IPIMX","IPLIX","IPMIX","IPSIX",
    "ISDIX","IDXGX","ISEIX","IDXLX","ISJIX","ISKIX","IBRIX","IPIIX","IEOHX","IPEIX",
    "ILBPX","IIMOX","IRMIX","IRGMX","IVCSX","IVSOX","ISZIX","ISNGX","ISQIX","ISNLX",
    "ISRIX","ISNQX","IISNX","VISPX","VIQIX","VSICX","VSIPX","VSQIX","VSSIX","IAVIX",
    "ISGJX","ICGIX","ISWIX","IAGIX","INGIX","IRGIX","IVRIX",
  ],
  other: [],
};

/** ─────────────────────────────────────────────────────────────────
 *  FUND_LABELS: starter set (safe fallbacks if not found).
 *  Add more tickers anytime; unknown tickers show just the symbol.
 *  ───────────────────────────────────────────────────────────────── */
const FUND_LABELS: Record<string, string> = {
  // Common extras
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
  FSLG:  "Fidelity® (label TBD)",
  FIDSX: "Fidelity® (label TBD)",
  FBANK: "Fidelity® (label TBD)",
  FDLSX: "Fidelity® (label TBD)",

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
  VGSH:  "Vanguard Short-Term Treasury ETF",
  VGIT:  "Vanguard Intermediate-Term Treasury ETF",
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
  BNDX:  "Vanguard Total Intl Bond ETF",
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
  SCHI:  "Schwab 5-10 Year Corp Bond ETF",
  SCHJ:  "Schwab 1-5 Year Corp Bond ETF",
  SCHD:  "Schwab U.S. Dividend Equity ETF",
  SCHH:  "Schwab U.S. REIT ETF",
  SCCR:  "Schwab (label TBD)",
  SMBS:  "Schwab (label TBD)",
  SCUS:  "Schwab (label TBD)",

  // State Street / SPDR (subset)
  SPY:   "SPDR S&P 500 ETF Trust",
  SPLG:  "SPDR Portfolio S&P 500 ETF",
  SPMD:  "SPDR Portfolio Mid Cap ETF",
  SPSM:  "SPDR Portfolio Small Cap ETF",
  SPYG:  "SPDR Portfolio S&P 500 Growth ETF",
  SPYV:  "SPDR Portfolio S&P 500 Value ETF",
  XLK:   "Technology Select Sector SPDR",
  XLF:   "Financial Select Sector SPDR",
  XLV:   "Health Care Select Sector SPDR",
  XLE:   "Energy Select Sector SPDR",
  XLC:   "Communication Services Select Sector SPDR",
  XLY:   "Consumer Discretionary Select Sector SPDR",
  XLRE:  "Real Estate Select Sector SPDR",
  XLI:   "Industrial Select Sector SPDR",
  XLB:   "Materials Select Sector SPDR",
  XLU:   "Utilities Select Sector SPDR",
  XBI:   "SPDR S&P Biotech ETF",
  SPHD:  "Invesco S&P 500 High Dividend Low Volatility ETF",
  SPIP:  "SPDR Portfolio TIPS ETF",
  SPHY:  "SPDR Portfolio High Yield Bond ETF",
  STOT:  "SPDR DoubleLine Short Term Total Return",
  TOTL:  "SPDR DoubleLine Total Return",
  OBND:  "SPDR Loomis Sayles Opportunistic Bond",
  SRLN:  "SPDR Blackstone Senior Loan ETF",
  PRIV:  "SPDR (label TBD)",
  MDY:   "SPDR S&P MidCap 400 ETF Trust",
  DIA:   "SPDR Dow Jones Industrial Average ETF Trust",

  // BlackRock / iShares (subset)
  IVV:   "iShares Core S&P 500 ETF",
  ITOT:  "iShares Core S&P Total U.S. Stock Market ETF",
  IEMG:  "iShares Core MSCI Emerging Markets ETF",
  IEFA:  "iShares Core MSCI EAFE ETF",
  IEUR:  "iShares Core MSCI Europe ETF",
  IJH:   "iShares Core S&P Mid-Cap ETF",
  IJR:   "iShares Core S&P Small-Cap ETF",
  AGG:   "iShares Core U.S. Aggregate Bond ETF",
  IUSB:  "iShares Core Total USD Bond Market ETF",
  IUSG:  "iShares Core S&P U.S. Growth ETF",
  IUSV:  "iShares Core S&P U.S. Value ETF",
  ILTB:  "iShares Core Long-Term U.S. Bond ETF",
  IMTB:  "iShares Core 5-10 Year USD Bond ETF",
  IXUS:  "iShares Core MSCI Total International Stock ETF",
  IWB:   "iShares Russell 1000 ETF",
  IVE:   "iShares S&P 500 Value ETF",
  IVW:   "iShares S&P 500 Growth ETF",
  IWD:   "iShares Russell 1000 Value ETF",
  DVY:   "iShares Select Dividend ETF",
  DIVB:  "iShares U.S. Dividend and Buyback ETF",
  USRT:  "iShares Core U.S. REIT ETF",
  IAGG:  "iShares Core Intl Aggregate Bond ETF",
  IYC:   "iShares U.S. Consumer Discretionary ETF",
  IYK:   "iShares U.S. Consumer Staples ETF",
  IYE:   "iShares U.S. Energy ETF",
  IXJ:   "iShares Global Healthcare ETF",

  // Invesco (subset)
  QQQ:   "Invesco QQQ Trust",
  QQQM:  "Invesco NASDAQ-100 ETF",
  SPHQ:  "Invesco S&P 500 Quality ETF",
  SPMO:  "Invesco S&P 500 Momentum ETF",
  RSP:   "Invesco S&P 500 Equal Weight ETF",
  XLG:   "Invesco S&P 500 Top 50 ETF",
  PBUS:  "Invesco PureBeta MSCI USA ETF",
  SPLV:  "Invesco S&P 500 Low Volatility ETF",
  BKLN:  "Invesco Senior Loan ETF",
  RWL:   "Invesco S&P 500 Revenue ETF",
  PRF:   "Invesco FTSE RAFI US 1000 ETF",
  PSCT:  "Invesco S&P SmallCap Info Tech ETF",
  SPHD:  "Invesco S&P 500 High Dividend Low Volatility ETF",
  XMMO:  "Invesco S&P MidCap Momentum ETF",
  XMVM:  "Invesco S&P MidCap Value w/ Momentum ETF",
  XMHQ:  "Invesco S&P MidCap Quality ETF",
  SPHB:  "Invesco S&P 500 High Beta ETF",
  PSR:   "Invesco Active U.S. Real Estate ETF",
  CSD:   "Invesco Spin-Off ETF",
};

// Prefer “TICKER — Name”, fall back to just ticker if unknown
function labelFor(t: string): string {
  const sym = (t || "").toUpperCase().trim();
  const name = FUND_LABELS[sym];
  return name ? `${sym} — ${name}` : sym;
}

function NewLineHint({ symbol }: { symbol: string }) {
  const name = FUND_LABELS[(symbol || "").toUpperCase()];
  if (!name) return null;
  return (
    <div className="col-span-12 -mt-2 text-xs text-gray-500">
      {name}
    </div>
  );
}

// ---- Stepper (mobile-friendly) ----
function Stepper({ current = 1 }: { current?: 1 | 2 | 3 | 4 }) {
  const steps = [
    { n: 1, label: "Get Grade" },
    { n: 2, label: "Review" },
    { n: 3, label: "Purchase" },
    { n: 4, label: "Report Sent" },
  ] as const;

  return (
    <div className="w-full mb-6">
      {/* Compact on mobile */}
      <ol className="flex sm:hidden items-end justify-between gap-2">
        {steps.map((s) => {
          const isActive = s.n === current;
          const isComplete = s.n < current;
          return (
            <li key={s.n} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <div
                className={[
                  "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold",
                  isActive
                    ? "border-blue-600 bg-blue-600 text-white"
                    : isComplete
                    ? "border-blue-600 text-blue-600"
                    : "border-gray-300 text-gray-600",
                ].join(" ")}
              >
                {s.n}
              </div>
              <div
                className={[
                  "text-[10px] leading-tight text-center truncate max-w-[5.5rem]",
                  isActive ? "font-semibold text-blue-700" : "text-gray-700",
                ].join(" ")}
              >
                {s.label}
              </div>
            </li>
          );
        })}
      </ol>
      {/* Full labels with horizontal scroll if needed */}
      <div className="hidden sm:block">
        <div className="-mx-3 overflow-x-auto overscroll-x-contain">
          <ol className="flex items-center gap-3 flex-nowrap px-3">
            {steps.map((s, idx) => {
              const isActive = s.n === current;
              const isComplete = s.n < current;
              return (
                <li key={s.n} className="flex items-center gap-3 shrink-0">
                  <div
                    className={[
                      "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold",
                      isActive
                        ? "border-blue-600 bg-blue-600 text-white"
                        : isComplete
                        ? "border-blue-600 text-blue-600"
                        : "border-gray-300 text-gray-600",
                    ].join(" ")}
                  >
                    {s.n}
                  </div>
                  <span
                    className={[
                      "whitespace-nowrap",
                      isActive ? "font-semibold text-blue-700" : "text-gray-700",
                    ].join(" ")}
                  >
                    {s.label}
                  </span>
                  {idx < steps.length - 1 && (
                    <div
                      className={[
                        "mx-2 h-px w-10 md:w-16",
                        isComplete ? "bg-blue-600" : "bg-gray-300",
                      ].join(" ")}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}

/** 
 * Split into wrapper + inner to satisfy Next’s requirement:
 * any use of useSearchParams() must live under a <Suspense> boundary.
 */
export default function NewGradePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl p-6 space-y-6">
          <Stepper current={1} />
          <h1 className="text-2xl font-bold">Get your grade</h1>
          <div className="rounded border bg-white p-4 text-sm text-gray-600">
            Loading…
          </div>
        </main>
      }
    >
      <NewGradePageInner />
    </Suspense>
  );
}

function NewGradePageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const previewId = (search.get("previewId") || "").trim();

  // ---- State ----
  const [provider, setProvider] = useState("fidelity");
  const [profile, setProfile] = useState<InvestorProfile>("Growth");
  const [rows, setRows] = useState<Holding[]>([
    { symbol: "FSKAX", weight: 60 },
    { symbol: "FXNAX", weight: 40 },
  ]);

  // ✅ HYDRATE FROM previewId (server) OR localStorage (fallback)
  useEffect(() => {
    let cancelled = false;

    async function hydrateFromPreview(id: string) {
      try {
        const res = await fetch(`/api/preview/${encodeURIComponent(id)}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
    });
        if (!res.ok) throw new Error("not ok");
        const data = await res.json();

        const nextProvider = String(data?.provider || data?.provider_display || "fidelity");
        const nextProfile = (String(data?.profile || "Growth") as InvestorProfile);
        const nextRows: Holding[] = Array.isArray(data?.rows)
          ? data.rows.map((r: any) => ({
              symbol: String(r?.symbol || "").toUpperCase(),
              weight: Number(r?.weight || 0),
            }))
          : [];

        if (!cancelled && nextRows.length) {
          setProvider(nextProvider);
          setProfile(nextProfile);
          setRows(nextRows);
        }
      } catch {
        // Optional localStorage fallback (id already stored as gy4k_preview_id after save)
        try {
          const lastId = localStorage.getItem("gy4k_preview_id") || "";
          if (lastId !== id) return;
          // If you later store a snapshot, you can restore it here.
        } catch {}
      }
    }

    if (previewId) hydrateFromPreview(previewId);
    return () => {
      cancelled = true;
    };
  }, [previewId]);

  // Provider fund list (toggle)
  const [showCatalog, setShowCatalog] = useState(false);

  // When provider === "other", show union of all provider tickers (deduped)
  const allFunds = useMemo(() => {
    const merged = Object.entries(PROVIDER_FUNDS)
      .filter(([key]) => key !== "other")
      .flatMap(([, arr]) => arr);
    return Array.from(new Set(merged));
  }, []);

  const providerList = useMemo(
    () => (provider === "other" ? allFunds : (PROVIDER_FUNDS[provider] || [])),
    [provider, allFunds]
  );

  const [selectedFromList, setSelectedFromList] = useState<string>("");

  // Derived for autocomplete
  const datalistId = `symbols-${provider}`;
  const providerLabels = useMemo(
    () => providerList.map((t) => ({ t, label: labelFor(t) })),
    [providerList]
  );

  // Totals / validation
  const total = useMemo(
    () => rows.reduce((s, r) => s + (r.weight === "" ? 0 : Number(r.weight)), 0),
    [rows]
  );
  const canSubmit = provider && Math.abs(total - 100) < 0.1;

  // ---- Row helpers ----
  function addRow() {
    setRows((r) => [...r, { symbol: "", weight: "" }]);
  }
  function addSymbol(sym: string) {
    const symbol = sym.toUpperCase().trim();
    if (!symbol) return;
    if (rows.some((r) => r.symbol.toUpperCase() === symbol)) return;
    setRows((r) => [...r, { symbol, weight: "" }]);
  }
  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }
  function updateRow(i: number, key: keyof Holding, v: string) {
    setRows((r) =>
      r.map((row, idx) =>
        idx === i
          ? {
              ...row,
              [key]: key === "weight" ? (v === "" ? "" : Number(v)) : v.toUpperCase(),
            }
          : row
      )
    );
  }

  // ---- Grade logic ----
  function computeGrade(profileInput: InvestorProfile, totalWeight: number): number {
    const base =
      profileInput === "Growth" ? 4.3 : profileInput === "Balanced" ? 3.8 : 3.3;
    const penalty = Math.min(1, Math.abs(100 - totalWeight) / 100);
    return Math.max(1, Math.min(5, Math.round((base - penalty) * 2) / 2));
  }

  // ---- Save preview → results ----
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function savePreviewAndGo(args: {
    provider: string;
    profile: string;
    rows: { symbol: string; weight: number }[];
    gradeBase: number;
    gradeAdjusted: number;
  }) {
    setSaveError(null);
    setSaving(true);
    try {
      const provider_display =
        PROVIDER_DISPLAY[args.provider] ||
        args.provider.replace(/\b\w/g, (c) => c.toUpperCase());

      const res = await fetch("/api/preview/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: args.provider,
          provider_display,
          profile: args.profile,
          rows: args.rows,
          grade_base: args.gradeBase,
          grade_adjusted: args.gradeAdjusted,
        }),
      });

      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || !data?.id) throw new Error(data?.error || "Could not save preview");

      const id = String(data.id);
      if (typeof window !== "undefined") localStorage.setItem("gy4k_preview_id", id);
      router.push(`/grade/results?previewId=${encodeURIComponent(id)}`);
    } catch (e: any) {
      setSaveError(e?.message || "Failed to save preview");
    } finally {
      setSaving(false);
    }
  }

  async function onPreviewClick() {
    const cleanRows = rows
      .map((r) => ({
        symbol: String(r.symbol || "").toUpperCase().trim(),
        weight: r.weight === "" ? 0 : Number(r.weight),
      }))
      .filter((r) => r.symbol);

    const base = computeGrade(profile, total);
    await savePreviewAndGo({
      provider,
      profile,
      rows: cleanRows,
      gradeBase: base,
      gradeAdjusted: base,
    });
  }

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <Stepper current={1} />

      <h1 className="text-2xl font-bold">Get your grade</h1>

      {/* 1) Provider */}
      <section className="space-y-2">
        <label className="text-sm font-medium">1) Select your provider</label>
        <select
          className="w-full border rounded-md p-2"
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value);
            setSelectedFromList("");
          }}
        >
          <option value="fidelity">Fidelity</option>
          <option value="vanguard">Vanguard</option>
          <option value="schwab">Charles Schwab</option>
          <option value="voya">Voya</option>
          <option value="other">Other</option>
        </select>
      </section>

      {/* 2) Profile */}
      <section className="space-y-2">
        <label className="text-sm font-medium">2) Your investor profile</label>
        <select
          className="w-full border rounded-md p-2"
          value={profile}
          onChange={(e) => setProfile(e.target.value as InvestorProfile)}
        >
          <option value="Growth">Growth</option>
          <option value="Balanced">Balanced</option>
          <option value="Conservative">Conservative</option>
        </select>
      </section>

      {/* 3) Holdings */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">3) Enter your current holdings</div>
          <button
            type="button"
            className="text-sm underline text-blue-700"
            onClick={() => setShowCatalog((s) => !s)}
            aria-expanded={showCatalog}
          >
            {showCatalog ? "Hide fund list" : "Add from provider list"}
          </button>
        </div>

        {showCatalog && (
          <div className="rounded-lg border p-3 bg-white space-y-3">
            <div className="flex items-center gap-2">
              <select
                className="border rounded-md p-2 flex-1"
                value={selectedFromList}
                onChange={(e) => setSelectedFromList(e.target.value)}
              >
                <option value="">Choose a fund…</option>
                {providerList.map((t) => (
                  <option key={t} value={t} title={labelFor(t)}>
                    {labelFor(t)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="border rounded-md px-3 py-2 hover:bg-gray-50"
                onClick={() => {
                  if (selectedFromList) addSymbol(selectedFromList);
                }}
              >
                Add
              </button>
            </div>
          </div>
        )}

        {/* Datalist for symbol autocomplete */}
        <datalist id={datalistId}>
          {providerLabels.map(({ t, label }) => (
            <option key={t} value={t} label={label} />
          ))}
        </datalist>

        {/* Holdings table */}
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-12 gap-3">
            <input
              className="col-span-7 border rounded-md p-2"
              placeholder="Symbol (e.g., FSKAX)"
              value={row.symbol}
              onChange={(e) => updateRow(i, "symbol", e.target.value)}
              list={datalistId}
            />
            <input
              type="number"
              step="0.1"
              className="col-span-3 border rounded-md p-2"
              placeholder="Weight %"
              value={row.weight === "" ? "" : row.weight}
              onChange={(e) => updateRow(i, "weight", e.target.value)}
            />
            {/* Red X that morphs to a trash can on hover */}
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="col-span-2 border rounded-md flex items-center justify-center px-3 py-2 text-red-600 hover:bg-red-50 group transition relative"
              title="Remove holding"
            >
              <span className="transition group-hover:opacity-0">✕</span>
              <Trash2
                size={16}
                className="absolute opacity-0 group-hover:opacity-100 transition text-red-600"
              />
            </button>

            {/* Tiny description hint (only if known) */}
            <NewLineHint symbol={row.symbol} />
          </div>
        ))}

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={addRow}
            className="border rounded-md px-3 py-2 hover:bg-gray-50"
          >
            Add holding
          </button>
          <div
            className={[
              "text-sm",
              Math.abs(total - 100) < 0.1 ? "text-gray-600" : "text-red-600",
            ].join(" ")}
          >
            Total: {total.toFixed(1)}%
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onPreviewClick}
          disabled={saving || !canSubmit}
          className="rounded-lg px-5 py-3 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Preview grade"}
        </button>
        {!canSubmit && (
          <p className="mt-2 text-xs text-gray-500">
            Choose a provider and make sure weights sum to 100%.
          </p>
        )}
        {saveError && <p className="mt-2 text-sm text-red-600">{saveError}</p>}
      </div>
    </main>
  );
}
