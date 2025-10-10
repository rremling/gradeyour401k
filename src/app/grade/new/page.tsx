// src/app/grade/new/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type InvestorProfile = "Aggressive Growth" | "Growth" | "Balanced";
type Holding = { symbol: string; weight: number | "" };

export default function GradeNewPage() {
  const router = useRouter();

  // UI state
  const [provider, setProvider] = useState<string>("");
  const [profile, setProfile] = useState<InvestorProfile>("Growth");
  const [rows, setRows] = useState<Holding[]>([
    { symbol: "FSKAX", weight: 40 },
    { symbol: "FXNAX", weight: 20 },
  ]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Compute total (treat "" as 0)
  const total = useMemo(() => {
    return rows.reduce((sum, r) => sum + (typeof r.weight === "number" ? r.weight : 0), 0);
  }, [rows]);

  const canSubmit = provider.length > 0 && Math.abs(total - 100) < 0.1 && !saving;

  // helpers
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
          // Allow empty while typing; coerce to number only if non-empty
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
    provider: string;
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
    // Persist only in the browser
    if (typeof window !== "undefined") {
      localStorage.setItem("gy4k_preview_id", data.id as string);
    }
    return data.id as string;
  }

  async function onSubmit() {
    try {
      setErr(null);
      setSaving(true);

      // Normalize rows (drop empties, coerce numbers)
      const cleanRows = rows
        .filter((r) => r.symbol.trim() !== "" && r.weight !== "" && !Number.isNaN(Number(r.weight)))
        .map((r) => ({ symbol: r.symbol.trim().toUpperCase(), weight: Number(r.weight) }));

      const grade = computeGrade(profile, total);

      const previewId = await savePreview({
        provider,
        profile,
        rows: cleanRows,
        grade_base: grade,
        grade_adjusted: grade, // you’ll adjust with market overlay later
      });

      const qs = new URLSearchParams({
        provider,
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

  // If you had a client-side crash earlier from SSR/CSR, this guard helps ensure it's client-only
  useEffect(() => {
    // no-op: ensures we're rendering fully on client
  }, []);

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Get your grade</h1>

      {err && <div className="rounded border border-red-200 bg-red-50 p-3 text-red-700 text-sm">{err}</div>}

      <section className="space-y-2">
        <label className="text-sm font-medium">1) Select your provider</label>
        <select
          className="w-full border rounded-md p-2"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
        >
          <option value="">Choose…</option>
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
