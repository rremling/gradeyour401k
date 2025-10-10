// src/app/grade/new/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type InvestorProfile = "Aggressive Growth" | "Growth" | "Balanced";
type Holding = { symbol: string; weight: number | "" };

// -------- Provider display names (stored in DB/PDF) --------
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

// -------- UI: top stepper --------
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

export default function NewGradePage() {
  const router = useRouter();

  // -------- State --------
  const [provider, setProvider] = useState("fidelity");
  const [profile, setProfile] = useState<InvestorProfile>("Growth");
  const [rows, setRows] = useState<Holding[]>([
    { symbol: "FSKAX", weight: 60 },
    { symbol: "FXNAX", weight: 40 },
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

  // Totals / validation (treat empty weight as 0)
  const total = useMemo(
    () =>
      rows.reduce((s, r) => s + (r.weight === "" ? 0 : (Number(r.weight) || 0)), 0),
    [rows]
  );
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
              [key]:
                key === "weight"
                  ? v === "" ? "" : Number(v)
                  : v.toUpperCase(),
            }
          : row
      )
    );
  }

  // -------- Grade logic (preview-only) --------
  function computeGrade(profileInput: InvestorProfile, totalWeight: number): number {
    const base =
      profileInput === "Aggressive Growth" ? 4.5 : profileInput === "Balanced" ? 3.8 : 4.1;
    const penalty = Math.min(1, Math.abs(100 - totalWeight) / 100);
    const grade = Math.max(1, Math.min(5, Math.round((base - penalty) * 2) / 2));
    return grade;
  }

  // -------- Save preview → go to results --------
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function onPreviewClick() {
    setSaveError(null);
    setSaving(true);
    try {
      const provider_display =
        PROVIDER_DISPLAY[provider] ||
        provider.replace(/\b\w/g, (c) => c.toUpperCase());

      const cleanRows = rows
        .map((r) => ({
          symbol: String(r.symbol || "").toUpperCase().trim(),
          weight:
            r.weight === "" ? 0 : Number.isFinite(Number(r.weight)) ? Number(r.weight) : 0,
        }))
        .filter((r) => r.symbol);

      const base = computeGrade(profile, total);
      const adjusted = base;

      const res = await fetch("/api/preview/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          provider_display,
          profile,
          rows: cleanRows,
          grade_base: base,
          grade_adjusted: adjusted,
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
              onChange={(e) => setProfile(e.target.value as InvestorProfile)}
            >
              <option value="Aggressive Growth">Aggressive Growth</option>
              <option value="Growth">Growth</option>
              <option value="Balanced">Balanced</option>
            </select>
          </div>

          {/* Add from provider list (toggle) */}
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

          {/* Predictive suggestions for symbol input */}
          <datalist id="provider-funds-list">
            {(PROVIDER_FUNDS[provider] || []).map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>

          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-12 gap-3">
              <input
                className="col-span-7 border rounded-md p-2"
                placeholder="Symbol (e.g., FSKAX)"
                list="provider-funds-list"
                value={row.symbol}
                onChange={(e) => updateRow(i, "symbol", e.target.value)}
              />
              <input
                type="number"
                step="0.1"
                className="col-span-3 border rounded-md p-2"
                placeholder="Weight %"
                value={row.weight === "" ? "" : Number(row.weight)}
                onChange={(e) => updateRow(i, "weight", e.target.value)}
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
