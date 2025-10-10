// src/app/grade/new/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type InvestorProfile = "Aggressive Growth" | "Growth" | "Balanced";
type Holding = { symbol: string; weight: number };

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

export default function NewGradePage() {
  const router = useRouter();

  // ——— Your existing state (adjust defaults as you like) ———
  const [provider, setProvider] = useState("fidelity");
  const [profile, setProfile] = useState<InvestorProfile>("Growth");
  const [rows, setRows] = useState<Holding[]>([
    { symbol: "FSKAX", weight: 60 },
    { symbol: "FXNAX", weight: 40 },
  ]);

  const total = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.weight) || 0), 0),
    [rows]
  );

  const canSubmit = provider && Math.abs(total - 100) < 0.1;

  function addRow() {
    setRows((r) => [...r, { symbol: "", weight: 0 }]);
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
              [key]: key === "weight" ? Number(v) : v.toUpperCase(),
            }
          : row
      )
    );
  }

  // ——— Save + navigate helpers ———
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function computeGrade(profileInput: InvestorProfile, totalWeight: number): number {
    const base =
      profileInput === "Aggressive Growth" ? 4.5 : profileInput === "Balanced" ? 3.8 : 4.1;
    const penalty = Math.min(1, Math.abs(100 - totalWeight) / 100);
    const grade = Math.max(1, Math.min(5, Math.round((base - penalty) * 2) / 2));
    return grade;
  }

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
      .map((r) => ({
        symbol: String(r.symbol || "").toUpperCase().trim(),
        weight: Number(r.weight),
      }))
      .filter((r) => r.symbol && !Number.isNaN(r.weight));

    const base = computeGrade(profile, total);
    const adjusted = base;

    await savePreviewAndGo({
      provider,
      profile,
      rows: cleanRows,
      gradeBase: base,
      gradeAdjusted: adjusted,
    });
  }

  // ——— UI (keep your existing layout; this is minimal) ———
  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Get your grade</h1>

      <section>
        <label className="text-sm font-medium">1) Provider</label>
        <select
          className="w-full border rounded-md p-2 mt-1"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
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
      </section>

      <section>
        <label className="text-sm font-medium">2) Profile</label>
        <select
          className="w-full border rounded-md p-2 mt-1"
          value={profile}
          onChange={(e) => setProfile(e.target.value as InvestorProfile)}
        >
          <option>Aggressive Growth</option>
          <option>Growth</option>
          <option>Balanced</option>
        </select>
      </section>

      <section className="space-y-3">
        <div className="text-sm font-medium">3) Holdings</div>
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
              value={Number.isFinite(row.weight) ? row.weight : ""}
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
        {saveError && (
          <p className="mt-2 text-sm text-red-600">{saveError}</p>
        )}
      </div>
    </main>
  );
}
