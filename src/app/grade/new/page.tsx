// src/app/grade/new/page.tsx
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PROVIDERS,
  HOLDINGS_MAP,
  LABELS,
  validateSymbol,
  computeGrade,
  type ProviderKey,
  type InvestorProfile,
} from "@/lib/gy4k";

type Row = { symbol: string; weight: string }; // keep weight as string to allow empty
const LS_KEY = "gy4k:lastSubmission";

const ORDERED_PROVIDERS: ProviderKey[] = [
  "fidelity",
  "vanguard",
  "schwab",
  "invesco",
  "blackrock",
  "statestreet",
  "voya",
  "other",
];

function providerLabel(key: ProviderKey) {
  return PROVIDERS.find((p) => p.key === key)?.label || key;
}

export default function NewGradePage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-3xl p-6">Loading…</main>}>
      <NewGradeInner />
    </Suspense>
  );
}

function NewGradeInner() {
  const router = useRouter();
  const params = useSearchParams();

  // Seed from results
  const seedProviderLabel = (params.get("provider") || "").toLowerCase();
  const seedProfile = (params.get("profile") as InvestorProfile) || "Growth";
  const seedRows = (() => {
    const raw = params.get("rows");
    if (!raw) return null;
    try {
      const parsed = JSON.parse(decodeURIComponent(raw));
      if (Array.isArray(parsed)) {
        return parsed.map((r: any) => ({
          symbol: String(r.symbol || "").toUpperCase(),
          weight: r.weight === 0 || r.weight === "0" ? "0" : String(r.weight || ""),
        })) as Row[];
      }
    } catch {}
    return null;
  })();

  const [provider, setProvider] = useState<ProviderKey>(() => {
    const found = PROVIDERS.find((p) => p.label.toLowerCase() === seedProviderLabel)?.key as ProviderKey | undefined;
    return found ?? "fidelity";
  });
  const [profile, setProfile] = useState<InvestorProfile>(seedProfile);
  const [rows, setRows] = useState<Row[]>(
    seedRows ?? [
      { symbol: "", weight: "" },
      { symbol: "", weight: "" },
    ]
  );

  const curated = HOLDINGS_MAP[provider] || [];

  const total = useMemo(() => {
    return rows.reduce((s, r) => s + (r.weight.trim() === "" ? 0 : Number(r.weight) || 0), 0);
  }, [rows]);

  const canSubmit = provider !== "" && Math.abs(total - 100) < 0.1;

  function addRow() {
    setRows((r) => [...r, { symbol: "", weight: "" }]);
  }
  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }
  function updateRow(i: number, key: "symbol" | "weight", v: string) {
    setRows((r) =>
      r.map((row, idx) =>
        idx === i
          ? key === "symbol"
            ? { ...row, symbol: v.toUpperCase() }
            : { ...row, weight: v }
          : row
      )
    );
  }

  function CuratedOptions() {
    return (
      <>
        <option value="">— Select from list —</option>
        {curated.map((tkr) => (
          <option key={tkr} value={tkr}>
            {tkr} {LABELS[tkr] ? `— ${LABELS[tkr]}` : ""}
          </option>
        ))}
      </>
    );
  }

  const validity = rows.map((r) => ({
    symbol: r.symbol,
    weight: r.weight,
    status: validateSymbol(provider, r.symbol),
    label: LABELS[r.symbol] || "",
  }));

  function previewGrade() {
    const cleanRows = rows
      .filter((r) => r.symbol.trim() !== "" && r.weight.trim() !== "")
      .map((r) => ({ symbol: r.symbol.toUpperCase(), weight: Number(r.weight) || 0 }));

    const gradeBase = computeGrade(profile, total);
    const payloadForLocalStorage = {
      provider: providerLabel(provider),
      profile,
      rows: cleanRows,
      grade_base: gradeBase,
      grade_adjusted: gradeBase, // penalties applied on results page
    };

    try {
      localStorage.setItem(LS_KEY, JSON.stringify(payloadForLocalStorage));
    } catch {}

    const qp = new URLSearchParams({
      provider: providerLabel(provider),
      profile,
      rows: encodeURIComponent(JSON.stringify(cleanRows)),
    }).toString();

    router.push(`/grade/results?${qp}`);
  }

  useEffect(() => {
    if (seedRows) return;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved?.provider && saved?.rows) {
        const k = (PROVIDERS.find((p) => p.label === saved.provider)?.key as ProviderKey) || provider;
        setProvider(k);
        setProfile(saved.profile || "Growth");
        setRows(
          (saved.rows as { symbol: string; weight: number }[]).map((r) => ({
            symbol: r.symbol.toUpperCase(),
            weight: String(r.weight),
          }))
        );
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      {/* Stepper */}
      <div className="flex items-center justify-between text-sm">
        {[
          { n: 1, label: "Provider" },
          { n: 2, label: "Profile" },
          { n: 3, label: "Holdings" },
          { n: 4, label: "Preview" },
        ].map((s, idx) => (
          <div key={s.n} className="flex-1 flex items-center">
            <div className="flex items-center gap-2">
              <span className="inline-flex justify-center items-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs">
                {s.n}
              </span>
              <span className="font-medium">{s.label}</span>
            </div>
            {idx < 3 && <div className="flex-1 h-px bg-gray-200 mx-2" />}
          </div>
        ))}
      </div>

      <h1 className="text-2xl font-bold">Get your grade</h1>

      <section className="space-y-2">
        <label className="text-sm font-medium">1) Select your provider</label>
        <select
          className="w-full border rounded-md p-2"
          value={provider}
          onChange={(e) => setProvider(e.target.value as ProviderKey)}
        >
          {ORDERED_PROVIDERS.map((k) => (
            <option key={k} value={k}>
              {providerLabel(k)}
            </option>
          ))}
        </select>
      </section>

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

      <section className="space-y-4">
        <div className="text-sm font-medium">3) Enter your current holdings</div>

        {rows.map((row, i) => {
          const status = validity[i]?.status;
          const label = validity[i]?.label;
          return (
            <div key={i} className="grid grid-cols-12 gap-3">
              <div className="col-span-7">
                <div className="flex gap-2">
                  <select
                    className="border rounded-md p-2 flex-1"
                    value={HOLDINGS_MAP[provider].includes(row.symbol) ? row.symbol : ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "") return;
                      updateRow(i, "symbol", v);
                    }}
                  >
                    <option value="">— Select from list —</option>
                    {HOLDINGS_MAP[provider].map((tkr) => (
                      <option key={tkr} value={tkr}>
                        {tkr} {LABELS[tkr] ? `— ${LABELS[tkr]}` : ""}
                      </option>
                    ))}
                  </select>
                  <input
                    className={`border rounded-md p-2 flex-1 ${status === "invalid" ? "border-red-400" : ""}`}
                    placeholder="Or type (e.g., VTI)"
                    value={row.symbol}
                    onChange={(e) => updateRow(i, "symbol", e.target.value)}
                    title={label ? `${row.symbol} — ${label}` : row.symbol}
                  />
                </div>
              </div>

              <input
                type="text"
                inputMode="decimal"
                className="col-span-3 border rounded-md p-2"
                placeholder="Weight %"
                value={row.weight}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d.]/g, "");
                  updateRow(i, "weight", v);
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
          );
        })}

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={addRow}
            className="border rounded-md px-3 py-2 hover:bg-gray-50"
          >
            Add holding
          </button>
          <div className="text-sm text-gray-600">Total: {total.toFixed(1)}%</div>
        </div>
      </section>

      <div className="pt-2">
        <button
          type="button"
          onClick={previewGrade}
          disabled={!canSubmit}
          className={`rounded-lg px-5 py-3 text-white ${
            canSubmit ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 cursor-not-allowed"
          }`}
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
