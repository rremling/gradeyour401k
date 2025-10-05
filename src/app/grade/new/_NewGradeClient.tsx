"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type InvestorProfile = "Aggressive Growth" | "Growth" | "Balanced";
type Holding = { symbol: string; weight: number | "" }; // <-- allow empty while editing

const LS_KEY = "gy4k_form_v1";

function parseRowsParam(raw: string | null): Holding[] | null {
  if (!raw) return null;
  try {
    const arr = JSON.parse(decodeURIComponent(raw));
    if (Array.isArray(arr)) {
      return arr
        .filter((r) => r && typeof r.symbol === "string")
        .map((r) => ({
          symbol: String(r.symbol).toUpperCase(),
          // accept "", number-like, or default to ""
          weight:
            r.weight === "" || r.weight === null || r.weight === undefined
              ? ""
              : Number(r.weight) || 0,
        }));
    }
  } catch {}
  return null;
}

export default function NewGradeClient() {
  const router = useRouter();
  const q = useSearchParams();

  const [provider, setProvider] = useState("");
  const [profile, setProfile] = useState<InvestorProfile>("Growth");
  const [rows, setRows] = useState<Holding[]>([
    { symbol: "FSKAX", weight: 40 },
    { symbol: "FXNAX", weight: 20 },
  ]);

  // Restore from URL first, then localStorage
  useEffect(() => {
    const qpProvider = q.get("provider");
    const qpProfile = q.get("profile") as InvestorProfile | null;
    const qpRows = parseRowsParam(q.get("rows"));

    if (qpProvider) setProvider(qpProvider);
    if (qpProfile === "Aggressive Growth" || qpProfile === "Growth" || qpProfile === "Balanced") {
      setProfile(qpProfile);
    }
    if (qpRows && qpRows.length) {
      setRows(qpRows);
      return;
    }
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          provider?: string;
          profile?: InvestorProfile;
          rows?: Holding[];
        };
        if (parsed.provider) setProvider(parsed.provider);
        if (parsed.profile) setProfile(parsed.profile);
        if (parsed.rows && parsed.rows.length) setRows(parsed.rows);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save draft
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ provider, profile, rows }));
    } catch {}
  }, [provider, profile, rows]);

  // Treat empty weights as 0 for totals
  const total = useMemo<number>(
    () =>
      rows.reduce<number>(
        (s, r) => s + (typeof r.weight === "number" ? r.weight : 0),
        0
      ),
    [rows]
  );

  const allWeightsFilled = rows.every((r) => r.weight !== "");
  const canSubmit = provider.length > 0 && allWeightsFilled && Math.abs(total - 100) < 0.1;

  function addRow() {
    setRows((r) => [...r, { symbol: "", weight: "" }]); // start empty
  }

  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  function updateRow(i: number, key: keyof Holding, v: string) {
    setRows((r) =>
      r.map((row, idx) => {
        if (idx !== i) return row;
        if (key === "weight") {
          // allow empty string while typing; strip non-numeric chars
          const cleaned = v.replace(/[^0-9.]/g, "");
          if (cleaned === "") return { ...row, weight: "" };
          // handle cases like ".", "00.", "1."
          const asNumber = Number(cleaned);
          return { ...row, weight: isNaN(asNumber) ? "" : asNumber };
        } else {
          return { ...row, symbol: v.toUpperCase() };
        }
      })
    );
  }

  function computeGrade(p: InvestorProfile, totalWeight: number): number {
    const base = p === "Aggressive Growth" ? 4.5 : p === "Balanced" ? 3.8 : 4.1;
    const penalty = Math.min(1, Math.abs(100 - totalWeight) / 100);
    return Math.max(1, Math.min(5, Math.round((base - penalty) * 2) / 2));
  }

  function submit() {
    const grade = computeGrade(profile, total);
    const rowsParam = encodeURIComponent(JSON.stringify(rows));
    const params = new URLSearchParams({
      provider,
      profile,
      grade: grade.toFixed(1),
      rows: rowsParam,
    });
    router.push(`/grade/results?${params.toString()}`);
  }

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Get your grade</h1>

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
          <option value="voya">Voya</option>
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
              inputMode="decimal"
              pattern="[0-9]*\.?[0-9]*"
              type="text" // use text so we can keep "" and intermediate values like "."
              className="col-span-3 border rounded-md p-2"
              placeholder="Weight %"
              value={row.weight === "" ? "" : String(row.weight)}
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
          onClick={submit}
          disabled={!canSubmit}
          className={`rounded-lg px-5 py-3 text-white ${
            canSubmit ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 cursor-not-allowed"
          }`}
        >
          Preview grade
        </button>
        {!canSubmit && (
          <p className="mt-2 text-xs text-gray-500">
            Choose a provider and make sure all weights are filled and sum to 100%.
          </p>
        )}
      </div>
    </main>
  );
}
