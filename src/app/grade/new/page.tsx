// src/app/grade/new/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PROVIDER_DISPLAY,
  PROVIDER_TICKERS,
  ProviderKey,
  normalizeProviderKey,
} from "@/lib/providerMeta";

type InvestorProfile = "Aggressive Growth" | "Growth" | "Balanced";
type Holding = { symbol: string; weight: number | "" };

const STORAGE_KEY = "gy4k_form_v1";

export default function GradeNewPage() {
  const router = useRouter();

  const [provider, setProvider] = useState<ProviderKey>("fidelity");
  const [profile, setProfile] = useState<InvestorProfile>("Growth");
  const [rows, setRows] = useState<Holding[]>([
    { symbol: "FSKAX", weight: 40 },
    { symbol: "FXNAX", weight: 20 },
  ]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Load saved draft
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.provider) setProvider(normalizeProviderKey(parsed.provider));
      if (parsed?.profile) setProfile(parsed.profile);
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
    } catch {}
  }, []);

  // Save draft on change
  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = {
      provider,
      profile,
      rows,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [provider, profile, rows]);

  const total = useMemo(() => {
    return rows.reduce((sum, r) => sum + (typeof r.weight === "number" ? r.weight : 0), 0);
  }, [rows]);

  const canSubmit = provider !== "other" ? Math.abs(total - 100) < 0.1 && !saving : Math.abs(total - 100) < 0.1 && !saving;

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
        } else {
          return { ...row, symbol: v.toUpperCase() };
        }
      })
    );
  }

  function computeGrade(profileInput: InvestorProfile, totalWeight: number): number {
    const base = profileInput === "Aggressive Growth" ? 4.5 : profileInput === "Balanced" ? 3.8 : 4.1;
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
  }): Promise<string> {
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
        .filter((r) => r.symbol.trim() !== "" && r.weight !== "" && !Number.isNaN(Number(r.weight)))
        .map((r) => ({ symbol: r.symbol.trim().toUpperCase(), weight: Number(r.weight) }));

      const grade = computeGrade(profile, total);
      const previewId = await savePreview({
        provider,
        provider_display: PROVIDER_DISPLAY[provider],
        profile,
        rows: cleanRows,
        grade_base: grade,
        grade_adjusted: grade,
      });

      const qs = new URLSearchParams({
        provider: PROVIDER_DISPLAY[provider],
        profile,
        grade: grade.toFixed(1),
        previewId,
      });
      // Keep draft so they can edit later
      router.push(`/grade/result?${qs.toString()}`);
    } catch (e: any) {
      setErr(e?.message || "Could not save your grade. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const providerList = PROVIDER_TICKERS[provider];

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Get your grade</h1>

      {err && <div className="rounded border border-red-200 bg-red-50 p-3 text-red-700 text-sm">{err}</div>}

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
        <div className="text-sm font-medium">3) Enter your current holdings</div>

        {/* Provider tickers helper (optional) */}
        {providerList.length > 0 && (
          <div className="rounded-md border p-3 text-sm">
            <div className="font-medium mb-1">
              {PROVIDER_DISPLAY[provider]} popular tickers
            </div>
            <div className="flex flex-wrap gap-2">
              {providerList.slice(0, 30).map((t) => (
                <button
                  key={t}
                  type="button"
                  className="rounded border px-2 py-1 hover:bg-gray-50"
                  title={`Insert ${t}`}
                  onClick={() =>
                    setRows((r) => {
                      // Add if not present; else do nothing
                      if (r.some((row) => row.symbol === t)) return r;
                      return [...r, { symbol: t, weight: "" }];
                    })
                  }
                >
                  {t}
                </button>
              ))}
            </div>
            {providerList.length > 30 && (
              <p className="text-xs text-gray-500 mt-2">
                Showing 30; you can still type others manually.
              </p>
            )}
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
