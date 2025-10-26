// (File 2) src/app/grade/new/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

export default function NewGradePage() {
  const router = useRouter();

  // ---- State ----
  const [provider, setProvider] = useState("fidelity");
  const [profile, setProfile] = useState<InvestorProfile>("Growth");
  const [rows, setRows] = useState<Holding[]>([
    { symbol: "FSKAX", weight: 60 },
    { symbol: "FXNAX", weight: 40 },
  ]);

  // Provider fund list (toggle)
  const [showCatalog, setShowCatalog] = useState(false);
  const providerList = useMemo(() => (PROVIDER_FUNDS[provider] || []), [provider]);
  const [selectedFromList, setSelectedFromList] = useState<string>("");

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
              [key]:
                key === "weight"
                  ? v === "" ? "" : Number(v)
                  : v.toUpperCase(),
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
                  <option key={t} value={t}>
                    {t}
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

        {/* Holdings table */}
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-12 gap-3">
            <input
              className="col-span-7 border rounded-md p-2"
              placeholder="Symbol (e.g., FSKAX)"
              value={row.symbol}
              onChange={(e) => updateRow(i, "symbol", e.target.value)}
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
