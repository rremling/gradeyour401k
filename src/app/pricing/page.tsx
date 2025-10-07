// src/app/pricing/page.tsx
"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

type InvestorProfile = "Aggressive Growth" | "Growth" | "Balanced";
type Holding = { symbol: string; weight: number };

type PreviewPayload = {
  provider: string;
  profile: InvestorProfile;
  rows: Holding[];
  grade_base: number;
  grade_adjusted: number;
};

const LS_KEY = "gy4k:lastSubmission";

// Optional: display prices via public envs, or hardcode
const DISPLAY_ONE_TIME = process.env.NEXT_PUBLIC_PRICE_ONE_TIME || "$49";
const DISPLAY_ANNUAL   = process.env.NEXT_PUBLIC_PRICE_ANNUAL   || "$149/yr";

async function savePreview(data: PreviewPayload): Promise<string> {
  const res = await fetch("/api/preview/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Save preview failed (${res.status}): ${body}`);
  }
  const json = await res.json();
  return json.previewId as string;
}

async function startCheckout(planKey: "one_time" | "annual", previewId: string) {
  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planKey, previewId }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Checkout failed (${res.status}): ${body}`);
  }
  const json = await res.json();
  if (!json.url) throw new Error("No checkout URL returned");
  window.location.href = json.url as string;
}

export default function PricingPage() {
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState<"one" | "annual" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const purchase = useCallback(async (planKey: "one_time" | "annual") => {
    try {
      setError(null);
      if (!agree) {
        setError("Please agree to the RIA Agreement before continuing.");
        return;
      }
      setLoading(planKey);

      // Try to use the latest graded inputs from localStorage
      let data: PreviewPayload | null = null;
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) data = JSON.parse(raw);
      } catch {
        data = null;
      }

      // If they haven't graded yet, create a placeholder preview
      if (!data) {
        data = {
          provider: "",
          profile: "Growth",
          rows: [],
          grade_base: 0,
          grade_adjusted: 0,
        };
      }

      const previewId = await savePreview(data);
      await startCheckout(planKey, previewId);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Something went wrong starting checkout.");
      setLoading(null);
    }
  }, [agree]);

  return (
    <main className="mx-auto max-w-5xl p-6 md:p-10 space-y-10">
      <header className="text-center space-y-3">
        <h1 className="text-3xl md:text-4xl font-bold">Get your full PDF report</h1>
        <p className="text-gray-600">
          Clear, model-driven guidance based on your 401(k) provider, investor profile, and the current market trend.
        </p>
        <div className="text-sm text-gray-500">
          Haven’t graded yet? <Link href="/grade/new" className="text-blue-600 underline">Start here</Link>.
        </div>
      </header>

      {/* Plans */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* One-time */}
        <div className="rounded-2xl border shadow-sm p-6 md:p-8 flex flex-col">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">One-Time Report</h2>
            <div className="text-3xl font-bold">{DISPLAY_ONE_TIME}</div>
          </div>
          <p className="text-gray-600 mt-2">Best for a single deep-dive and quick reallocation.</p>
          <ul className="mt-5 space-y-2 text-sm">
            <li>• Personalized allocation vs. model comparison</li>
            <li>• Invalid/mixed ticker checks and penalties explained</li>
            <li>• Market-cycle overlay (SPY 30/50/100/200-day SMA)</li>
            <li>• Actionable “increase / reduce” guidance (in PDF)</li>
            <li>• Shareable grade badge</li>
          </ul>
          <button
            onClick={() => purchase("one_time")}
            disabled={loading !== null}
            className={`mt-6 rounded-lg px-5 py-3 text-white ${
              loading === "one" ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading === "one" ? "Starting checkout…" : "Buy One-Time"}
          </button>
        </div>

        {/* Annual */}
        <div className="rounded-2xl border shadow-sm p-6 md:p-8 flex flex-col relative">
          <span className="absolute -top-3 right-6 bg-emerald-600 text-white text-xs px-2 py-1 rounded-full">
            Most Popular
          </span>
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">Annual Plan</h2>
            <div className="text-3xl font-bold">{DISPLAY_ANNUAL}</div>
          </div>
          <p className="text-gray-600 mt-2">Initial report + 3 updates over the next 12 months.</p>
          <ul className="mt-5 space-y-2 text-sm">
            <li>• Everything in One-Time</li>
            <li>• 3 scheduled regrades (quarterly)</li>
            <li>• Email reminders and fresh PDF each update</li>
            <li>• Priority support</li>
          </ul>
          <button
            onClick={() => purchase("annual")}
            disabled={loading !== null}
            className={`mt-6 rounded-lg px-5 py-3 text-white ${
              loading === "annual" ? "bg-emerald-400" : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {loading === "annual" ? "Starting checkout…" : "Buy Annual"}
          </button>
        </div>
      </section>

      {/* Agreement + Errors */}
      <section className="space-y-3">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="mt-1"
          />
          <span>
            I agree to the{" "}
            <Link href="/legal/ria" className="text-blue-600 underline" target="_blank">
              RIA Agreement
            </Link>
            .
          </span>
        </label>

        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 text-red-700 p-3 text-sm">
            {error}
          </div>
        )}
      </section>

      {/* Footer */}
      <section className="text-sm text-gray-600 space-y-2">
        <p>
          You can buy first or grade first. If you purchase first, we’ll guide you to finish your inputs on the success page.
        </p>
        <p>
          Detailed “increase / reduce” guidance and market-cycle insights are included in the paid PDF report.
        </p>
      </section>
    </main>
  );
}
