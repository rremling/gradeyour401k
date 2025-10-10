// src/app/grade/new/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type InvestorProfile = "Aggressive Growth" | "Growth" | "Balanced";

// Store weight as STRING for smooth typing (empty allowed)
type Holding = { symbol: string; weight: string };

// -------- Provider display names --------
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

// -------- Provider ticker catalogs --------
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

// -------- Stepper --------
function Stepper({ current = 1 }: { current?: 1 | 2 | 3 | 4 }) {
  const steps = [
    { n: 1, label: "Get Grade" },
    { n: 2, label: "Review" },
    { n: 3, label: "Purchase" },
    { n: 4, label: "Report Sent" },
  ] as const;

  return (
    <div className="w-full mb-6">
      <ol className="flex items-center gap-3 text-sm">
        {steps.map((s, idx) => {
          const isActive = s.n === current;
          const isComplete = s.n < current;
          return (
            <li key={s.n} className="flex items-center gap-3">
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
  );
}

// -------- Grade + reasons --------
function computeGradeAndReasons(
  provider: string,
  profile: InvestorProfile,
  rows: Holding[]
) {
  // parse weights safely
  const weights = rows.map((r) => {
    const n = parseFloat((r.weight || "").trim());
    return Number.isFinite(n) ? n : 0;
  });

  const total = weights.reduce((s, n) => s + n, 0);
  const catalog = new Set((PROVIDER_FUNDS[provider] || []).map((t) => t.toUpperCase()));
  const outside = rows.filter(
    (r) => r.symbol && !catalog.has(r.symbol.toUpperCase())
  );
  const hasOutside = outside.length > 0;

  // base by profile
  let base = profile === "Aggressive Growth" ? 4.5 : profile === "Balanced" ? 3.8 : 4.1;
  const reasons: string[] = [];

  // penalty: not summing ~100
  const off = Math.abs(100 - total);
  if (off > 0.25) {
    const p = Math.min(1, off / 100);
    base -= p; // at most -1.0
    reasons.push(`Weights sum to ${total.toFixed(1)}% (target 100%).`);
  }

  // penalty: holdings outside selected provider catalog (advisory)
  if (hasOutside && provider !== "other") {
    base -= 0.3;
    reasons.push(
      `Some symbols aren’t typical of ${PROVIDER_DISPLAY[provider]} 401(k) menus (review in full report).`
    );
  }

  // penalty: concentration (largest position >60%)
  const maxWt = Math.max(0, ...weights);
  if (maxWt > 60) {
    base -= 0.2;
    reasons.push(`High concentration: top position is ${maxWt.toFixed(1)}%.`);
  }

  // clamp + half-star rounding
  const score = Math.max(1, Math.min(5, Math.round(base * 2) / 2));
  return { score, reasons, total };
}

export default function NewGradePage() {
  const router = useRouter();

  // -------- State --------
  const [provider, setProvider] = useState("fidelity");
  const [profile, setProfile] = useState<InvestorProfile>("Growth");
  const [rows, setRows] = useState<Holding[]>([
    { symbol: "FSKAX", weight: "60" },
    { symbol: "FXNAX", weight: "40" },
  ]);

  // Add-from-list UI
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const providerList = useMemo(
    () =>
      (PROVIDER_FUNDS[provider] || []).filter((t) =>
        t.toUpperCase().includes(catalogSearch.toUpperCase())
      ),
    [provider, catalogSearch]
  );
  const [selectedFromList, setSelectedFromList] = useState<string>("");

  // Totals / validation
  const total = useMemo(() => {
    return rows.reduce((s, r) => {
      const n = parseFloat((r.weight || "").trim());
      return s + (Number.isFinite(n) ? n : 0);
    }, 0);
  }, [rows]);
  const canSubmit = provider && Math.abs(total - 100) < 0.1;

  // -------- Row helpers --------
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
              [key]: key === "symbol" ? v.toUpperCase() : v, // keep weight as raw string
            }
          : row
      )
    );
  }

  // -------- Live grade preview --------
  const { score, reasons } = useMemo(
    () => computeGradeAndReasons(provider, profile, rows),
    [provider, profile, rows]
  );

  // -------- Save preview → go to results --------
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
      if (!res.ok || !data?.id) {
        throw new Error(data?.error || "Could not save preview");
      }

      const id = String(data.id);
      if (typeof window !== "undefined") {
        localStorage.setItem("gy4k_preview_id", id);
      }
      router.push(`/grade/results?previewId=${encodeURIComponent(id)}`);
    } catch (e: any) {
      setSaveError(e?.message || "Failed to save preview");
    } finally {
      setSaving(false);
    }
  }

  async function onPreviewClick() {
    const cleanRows = rows
      .map((r) => {
        const n = parseFloat((r.weight || "").trim());
        return {
          symbol: String(r.symbol || "").toUpperCase().trim(),
          weight: Number.isFinite(n) ? n : 0,
        };
      })
      .filter((r) => r.symbol);

    // For now adjusted == score; paid model can overlay market regime, etc.
    await savePreviewAndGo({
      provider,
      profile,
      rows: cleanRows,
      gradeBase: score,
      gradeAdjusted: score,
    });
  }

  // -------- UI --------
  return (
    <main className="mx-auto max-w-4xl p-6 space-y-8">
      <Stepper current={1} />

      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Grade your current 401(k)</h1>
        <p className="text-gray-600">
          Pick your provider, choose your investor profile, and enter holdings. We’ll give you an instant star grade and key notes.
        </p>
      </header>

      {/* Inputs */}
      <section className="grid md:grid-cols-2 gap-6">
        {/* Provider & Profile */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Provider</label>
            <select
              className="w-full border rounded-md p-2 mt-1"
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                setCatalogSearch("");
                setSelectedFromList("");
              }}
            >
              <option value="fidelity">Fidelity</option>
              <option value="vanguard">Vanguard</option>
              <option value="schwab">Charles Schwab</option>
              <option value="invesco">Invesco</option>
              <option value="blackrock">BlackRock / iShares</option>
              <option value="state-street">State Street / SPDR</option>
              <option value="voya">Voya</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Investor profile</label>
            <select
              className="w-full border rounded-md p-2 mt-1"
              value={profile}
              onChange={(e) => {
                setProfile(e.target.value as InvestorProfile);
              }}
            >
              <option value="Aggressive Growth">Aggressive Growth</option>
              <option value="Growth">Growth</option>
              <option value="Balanced">Balanced</option>
            </select>
          </div>

          {/* Add from provider list (collapsible) */}
          <div>
            <button
              type="button"
              onClick={() => setShowCatalog((s) => !s)}
              className="text-sm underline text-blue-700"
              aria-expanded={showCatalog}
            >
              {showCatalog ? "Hide provider fund list" : "Add from provider fund list"}
            </button>

            {showCatalog && (
              <div className="mt-2 rounded-lg border p-3 bg-white space-y-3">
                <input
                  className="border rounded-md p-2 w-full"
                  placeholder={`Search ${PROVIDER_DISPLAY[provider] || "Provider"} tickers…`}
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                />
                <div className="flex gap-2">
                  <select
                    className="border rounded-md p-2 flex-1"
                    value={selectedFromList}
                    onChange={(e) => setSelectedFromList(e.target.value)}
                  >
                    <option value="">Choose a fund…</option>
                    {providerList.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="border rounded-md px-3 py-2 hover:bg-gray-50"
                    onClick={() => selectedFromList && addSymbol(selectedFromList)}
                  >
                    Add
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Don’t see it? You can still type any symbol below.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Holdings table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Holdings</div>
            <button
              type="button"
              onClick={addRow}
              className="border rounded-md px-3 py-2 hover:bg-gray-50 text-sm"
            >
              Add holding
            </button>
          </div>

          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-12 gap-3">
              <input
                className="col-span-7 border rounded-md p-2"
                placeholder="Symbol (e.g., FSKAX)"
                value={row.symbol}
                onChange={(e) => updateRow(i, "symbol", e.target.value)}
              />
              <input
                type="text"
                inputMode="decimal"
                className="col-span-3 border rounded-md p-2"
                placeholder="Weight %"
                value={row.weight}
                onChange={(e) => {
                  // Allow only digits, dot, empty
                  const v = e.target.value;
                  if (/^\d*\.?\d*$/.test(v) || v === "") {
                    updateRow(i, "weight", v);
                  }
                }}
              />
              <button
                type="button"
                className="col-span-2 border rounded-md px-3 py-2 hover:bg-gray-50"
                onClick={() => removeRow(i)}
              >
                Remove
              </button>
            </div>
          ))}

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

      {/* Current holdings summary */}
      <section className="rounded-lg border p-4 bg-white">
        <h2 className="font-semibold">Current Holdings</h2>
        {rows.filter((r) => r.symbol.trim() !== "").length === 0 ? (
          <p className="text-sm text-gray-600 mt-2">No holdings entered yet.</p>
        ) : (
          <ul className="mt-2 text-sm text-gray-800 space-y-1">
            {rows
              .filter((r) => r.symbol.trim() !== "")
              .map((r, idx) => {
                const n = parseFloat((r.weight || "").trim());
                const wt = Number.isFinite(n) ? n : 0;
                return (
                  <li key={`${r.symbol}-${idx}`} className="flex justify-between">
                    <span className="font-mono">{r.symbol.toUpperCase()}</span>
                    <span>{wt.toFixed(1)}%</span>
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      {/* Grade preview & reasons */}
      <section className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-lg border p-5 bg-white space-y-2">
          <h3 className="font-semibold">Your preliminary grade</h3>
          <div className="text-4xl">⭐ {score.toFixed(1)} / 5</div>
          <p className="text-xs text-gray-500">
            This is a preview grade. The full report refines this with market cycle and model comparisons.
          </p>
        </div>

        <div className="rounded-lg border p-5 bg-white">
          <h3 className="font-semibold">Why you received this grade</h3>
          {reasons.length === 0 ? (
            <p className="text-sm text-gray-600 mt-2">
              Looks balanced for your selected profile. The full report can still reveal fees, overlaps, and optimization opportunities.
            </p>
          ) : (
            <ul className="list-disc list-inside text-sm text-gray-800 mt-2 space-y-1">
              {reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Why buy / what's included */}
      <section className="rounded-lg border p-5 bg-white">
        <h3 className="font-semibold">Why purchase the full report?</h3>
        <ul className="list-disc list-inside text-sm text-gray-800 mt-2 space-y-1">
          <li>Model comparison against curated ETF allocations that match your profile.</li>
          <li>Market cycle overlay (SPY 30/50/100/200-day SMA) to tilt risk sensibly.</li>
          <li>Concrete “increase / decrease / replace” guidance and reallocation roadmap.</li>
          <li>PDF delivered to your inbox + shareable star grade.</li>
          <li>Fee and diversification diagnostics; sector and factor exposure view.</li>
          <li>Annual plan includes 3 additional updates across the year.</li>
        </ul>
        <div className="mt-4">
          <a
            href="/pricing"
            className="inline-block rounded-lg bg-blue-600 text-white px-5 py-2 hover:bg-blue-700"
          >
            See pricing & buy report
          </a>
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
