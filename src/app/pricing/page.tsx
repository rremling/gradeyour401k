// src/app/grade/new/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PROVIDER_DISPLAY,
  PROVIDER_TICKERS,
  ProviderKey,
} from "@/lib/providerMeta";

type InvestorProfile = "Aggressive Growth" | "Growth" | "Balanced";
type Holding = { symbol: string; weight: number | "" };

const FORM_STORAGE = "gy4k_form_v1";

// ---- Stepper (1:Get Grade, 2:Review, 3:Purchase, 4:Report Sent) ----
function Stepper({ current = 1 }: { current?: 1 | 2 | 3 | 4 }) {
  const steps = [
    { n: 1, label: "Get Grade" },
    { n: 2, label: "Review" },
    { n: 3, label: "Purchase" },
    { n: 4, label: "Report Sent" },
  ] as const;

  return (
    <div className="w-full">
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

export default function GradeNewPage() {
  const router = useRouter();

  // Core form state
  const [provider, setProvider] = useState<ProviderKey>("fidelity");
  const [profile, setProfile] = useState<InvestorProfile>("Growth");
  const [rows, setRows] = useState<Holding[]>([
    { symbol: "FSKAX", weight: 40 },
    { symbol: "FXNAX", weight: 20 },
  ]);

  // UI helpers
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Hidden dropdown state
  const [showAddList, setShowAddList] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<string>("");

  // Load draft once
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(FORM_STORAGE);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.provider) setProvider(parsed.provider as ProviderKey);
      if (parsed?.profile) setProfile(parsed.profile as InvestorProfile);
      if (Array.isArray(parsed?.rows) && parsed.rows.length) {
        setRows(
          parsed.rows.map((r: any) => ({
            symbol: String(r.symbol || "").toUpperCase(),
            weight:
              r.weight === "" || r.weight === null || Number.isNaN(Number(r.weight))
                ? ""
                : Number(r.weight),
          }))
        );
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist draft on change
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(
      FORM_STORAGE,
      JSON.stringify({ provider, profile, rows })
    );
  }, [provider, profile, rows]);

  const total = useMemo(
    () => rows.reduce((sum, r) => sum + (typeof r.weight === "number" ? r.weight : 0), 0),
    [rows]
  );

  const canSubmit = provider.length > 0 && Math.abs(total - 100) < 0.1 && !saving;

  // Row ops
  function addRow() {
    setRows((r) => [...r, { symbol: "", weight: "" }]);
  }
  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }
  function updateRow(i: number, key: keyof Holding, v: string) {
    setRows((r) =>
      r.map((row, idx) => {
        if (idx !== i) return row;
        if (key === "weight") {
          const trimmed = v.trim();
          return { ...row, weight: trimmed === "" ? "" : Number(trimmed) };
        }
        return { ...row, symbol: v.toUpperCase() };
      })
    );
  }

  // Add from hidden dropdown
  function addSelectedTicker() {
    const t = selectedTicker.trim().toUpperCase();
    if (!t) return;
    setRows((r) => {
      if (r.some((row) => row.symbol === t)) return r;
      return [...r, { symbol: t, weight: "" }];
    });
  }

  // Simple grade until final model logic
  function computeGrade(profileInput: InvestorProfile, totalWeight: number): number {
    const base =
      profileInput === "Aggressive Growth" ? 4.5 : profileInput === "Balanced" ? 3.8 : 4.1;
    const penalty = Math.min(1, Math.abs(100 - totalWeight) / 100);
    return Math.max(1, Math.min(5, Math.round((base - penalty) * 2) / 2));
  }

  async function savePreview(payload: {
    provider: ProviderKey;
    provider_display: string;
    profile: InvestorProfile;
    rows: { symbol: string; weight: number }[];
    grade_base: number;
    grade_adjusted: number;
  }) {
    const res = await fetch("/api/preview/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data?.id) throw new Error(data?.error || "Failed to save preview");
    if (typeof window !== "undefined") {
      localStorage.setItem("gy4k_preview_id", data.id as string);
    }
    return data.id as string;
  }

  async function onSubmit() {
    try {
      setErr(null);
      setSaving(true);

      const cleanRows = rows
        .filter((r) => {
          const sym = r.symbol?.trim() || "";
          const wt = r.weight;
          const hasWeight = wt !== "" && !Number.isNaN(Number(wt));
          return sym !== "" && hasWeight;
        })
        .map((r) => ({
          symbol: r.symbol.trim().toUpperCase(),
          weight: Number(r.weight),
        }));

      const grade = computeGrade(profile, total);

      const previewId = await savePreview({
        provider,
        provider_display: PROVIDER_DISPLAY[provider],
        profile,
        rows: cleanRows,
        grade_base: grade,
        grade_adjusted: grade, // later: market overlay
      });

      const qs = new URLSearchParams({
        provider: PROVIDER_DISPLAY[provider],
        profile,
        grade: grade.toFixed(1),
        previewId,
      });
      router.push(`/grade/result?${qs.toString()}`);
    } catch (e: any) {
      setErr(e?.message || "Could not save your grade. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const providerTickers = PROVIDER_TICKERS[provider];

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      {/* Progress / flow */}
      <Stepper current={1} />

      <h1 className="text-2xl font-bold">Get your grade</h1>

      {err && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
          {err}
        </div>
      )}

      <section className="space-y-2">
        <label className="text-sm font-medium">1) Select your provider</label>
        <select
          className="w-full border rounded-md p-2"
          value={provider}
          onChange={(e) => setProvider(e.target.value as ProviderKey)}
        >
          <option value="fidelity">Fidelity</option>
          <option value="vanguard">Vanguard</option>
          <option value="schwab">Charles Schwab</option>
          <option value="invesco">Invesco</option>
          <option value="blackrock">BlackRock / iShares</option>
          <option value="statestreet">State Street / SPDR</option>
          <option value="voya">Voya</option>
          <option value="other">Other provider</option>
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
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">3) Enter your current holdings</div>
          {/* Toggleable provider list */}
          <button
            type="button"
            className="text-sm underline hover:no-underline"
            onClick={() => setShowAddList((s) => !s)}
          >
            {showAddList ? "Hide provider list" : `Add from ${PROVIDER_DISPLAY[provider]} list`}
          </button>
        </div>

        {/* Hidden dropdown when not in use */}
        {showAddList && providerTickers.length > 0 && (
          <div className="rounded-md border p-3 flex gap-2 items-center bg-white">
            <select
              className="border rounded-md p-2 w-full md:w-80"
              value={selectedTicker}
              onChange={(e) => setSelectedTicker(e.target.value)}
            >
              <option value="">Select a ticker</option>
              {providerTickers.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="border rounded-md px-3 py-2 hover:bg-gray-50"
              onClick={addSelectedTicker}
              disabled={!selectedTicker}
            >
              Add
            </button>
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
              inputMode="decimal"
              className="col-span-3 border rounded-md p-2"
              placeholder="Weight %"
              value={row.weight}
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
          onClick={onSubmit}
          disabled={!canSubmit}
          className={`rounded-lg px-5 py-3 text-white ${
            canSubmit ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 cursor-not-allowed"
          }`}
        >
          {saving ? "Saving…" : "Preview grade"}
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
