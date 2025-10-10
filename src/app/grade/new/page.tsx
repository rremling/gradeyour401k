// src/app/grade/new/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type InvestorProfile = "Aggressive Growth" | "Growth" | "Balanced";
type Holding = { symbol: string; weight: number | "" };

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

const PROVIDER_FUNDS: Record<string, string[]> = {
  fidelity: ["FXAIX", "FSKAX", "FNILX"],
  vanguard: ["VTI", "VOO", "VTSAX"],
  schwab: ["SCHB", "SCHX", "SCHD"],
  invesco: ["QQQ", "QQQM", "SPHQ"],
  blackrock: ["IVV", "ITOT", "AGG"],
  "state-street": ["SPY", "SPLG", "XLK"],
  voya: ["IIFIX", "IOSIX"],
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
                className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold ${
                  isActive
                    ? "border-blue-600 bg-blue-600 text-white"
                    : isComplete
                    ? "border-blue-600 text-blue-600"
                    : "border-gray-300 text-gray-600"
                }`}
              >
                {s.n}
              </div>
              <span
                className={`whitespace-nowrap ${
                  isActive ? "font-semibold text-blue-700" : "text-gray-700"
                }`}
              >
                {s.label}
              </span>
              {idx < steps.length - 1 && (
                <div
                  className={`mx-2 h-px w-10 md:w-16 ${
                    isComplete ? "bg-blue-600" : "bg-gray-300"
                  }`}
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

  const [provider, setProvider] = useState("fidelity");
  const [profile, setProfile] = useState<InvestorProfile>("Growth");
  const [rows, setRows] = useState<Holding[]>([
    { symbol: "FSKAX", weight: 60 },
    { symbol: "FXNAX", weight: 40 },
  ]);

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

  // fix weight empty = no crash
  const total = useMemo(
    () => rows.reduce((s, r) => s + (r.weight === "" ? 0 : Number(r.weight)), 0),
    [rows]
  );
  const canSubmit = provider && Math.abs(total - 100) < 0.1;

  function addRow() {
    setRows((r) => [...r, { symbol: "", weight: "" }]);
  }
  function addSymbol(sym: string) {
    const s = sym.toUpperCase().trim();
    if (!s || rows.some((r) => r.symbol === s)) return;
    setRows((r) => [...r, { symbol: s, weight: "" }]);
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

  async function onPreviewClick() {
    const cleanRows = rows
      .map((r) => ({
        symbol: r.symbol.toUpperCase().trim(),
        weight: r.weight === "" ? 0 : Number(r.weight),
      }))
      .filter((r) => r.symbol);

    const res = await fetch("/api/preview/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        profile,
        rows: cleanRows,
        grade_base: 4,
        grade_adjusted: 4,
      }),
    });

    const data = await res.json();
    if (data?.id) router.push(`/grade/results?previewId=${data.id}`);
  }

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <Stepper current={1} />

      <h1 className="text-2xl font-bold">Get your grade</h1>

      {/* Provider */}
      <section className="space-y-2">
        <label className="text-sm font-medium">1) Select your provider</label>
        <select
          className="w-full border rounded-md p-2"
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value);
            setCatalogSearch("");
            setSelectedFromList("");
          }}
        >
          {Object.keys(PROVIDER_DISPLAY).map((k) => (
            <option key={k} value={k}>
              {PROVIDER_DISPLAY[k]}
            </option>
          ))}
        </select>
      </section>

      {/* Profile */}
      <section className="space-y-2">
        <label className="text-sm font-medium">2) Your investor profile</label>
        <select
          className="w-full border rounded-md p-2"
          value={profile}
          onChange={(e) => setProfile(e.target.value as InvestorProfile)}
        >
          <option value="Aggressive Growth">Aggressive Growth</option>
          <option value="Growth">Growth</option>
          <option value="Balanced">Balanced</option>
        </select>
      </section>

      {/* Holdings */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">3) Enter your current holdings</div>
          <button
            type="button"
            className="text-sm underline text-blue-700"
            onClick={() => setShowCatalog((s) => !s)}
          >
            {showCatalog ? "Hide" : "Add from provider list"}
          </button>
        </div>

        {showCatalog && (
          <div className="rounded-lg border p-3 bg-white space-y-3">
            <div className="flex gap-2">
              <input
                className="border rounded-md p-2 flex-1"
                placeholder={`Search ${PROVIDER_DISPLAY[provider]}`}
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
              />
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
              Don’t see it? You can type any symbol below.
            </p>
          </div>
        )}

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
            <button
              type="button"
              className="col-span-2 border rounded-md px-3 py-2 hover:bg-gray-50"
              onClick={() => removeRow(i)}
            >
              Remove
            </button>
          </div>
        ))}

        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={addRow}
            className="border rounded-md px-3 py-2 hover:bg-gray-50"
          >
            Add holding
          </button>
          <div
            className={`text-sm ${
              Math.abs(total - 100) < 0.1 ? "text-gray-600" : "text-red-600"
            }`}
          >
            Total: {total.toFixed(1)}%
          </div>
        </div>
      </section>

      <div className="pt-2">
        <button
          type="button"
          onClick={onPreviewClick}
          disabled={!canSubmit}
          className="rounded-lg px-5 py-3 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          Preview grade
        </button>
        {!canSubmit && (
          <p className="mt-2 text-xs text-gray-500">
            Choose a provider and make sure weights sum to 100%.
          </p>
        )}
      </div>
    </main>
  );
}
