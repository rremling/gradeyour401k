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

// localStorage key we’ll use to store the user’s latest graded inputs
const LS_KEY = "gy4k:lastSubmission";

async function savePreview(data: PreviewPayload): Promise<string> {
  const res = await fetch("/api/preview/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to save preview");
  const json = await res.json();
  return json.previewId as string;
}

async function startCheckout(planKey: "one_time" | "annual", previewId: string) {
  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planKey, previewId }),
  });
  if (!res.ok) throw new Error("Failed to start checkout");
  const json = await res.json();
  if (!json.url) throw new Error("No checkout URL");
  window.location.href = json.url as string;
}

export default function PricingPage() {
  const [loading, setLoading] = useState<"one" | "annual" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const purchase = useCallback(
    async (planKey: "one_time" | "annual") => {
      try {
        setError(null);
        setLoading(planKey);

        // 1) Try to load a recent graded submission from localStorage
        // This is set by your /grade/new or /grade/results page when they click “Preview grade”
        let data: PreviewPayload | null = null;
        try {
          const raw = localStorage.getItem(LS_KEY);
          if (raw) data = JSON.parse(raw);
        } catch {
          data = null;
        }

        // 2) If not found, create a placeholder preview
        // This lets users "buy first" and finish later
        if (!data) {
          data = {
            provider: "",
            profile: "Growth",
            rows: [],
            grade_base: 0,
            grade_adjusted: 0,
          };
        }

        // 3) Save preview (real or placeholder) to DB → get previewId
        const previewId = await savePreview(data);

        // 4) Create a Stripe Checkout session with planKey + previewId
        await startCheckout(planKey, previewId);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || "Something went wrong starting checkout.");
        setLoading(null);
      }
    },
    []
  );

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-8">
      <h1 className="text-3xl font-bold">Get Your Full PDF Report</h1>
      <p className="text-gray-600">
        Buy now or grade first — either way works. If you purchase first, we’ll send you to finish your inputs after checkout.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-lg border p-6">
          <h2 className="text-xl font-semibold">One-Time Report</h2>
          <p className="text-sm text-gray-600 mt-1">One detailed PDF, delivered to your email.</p>
          <div className="mt-5">
            <button
              onClick={() => purchase("one_time")}
              disabled={loading !== null}
              className={`w-full rounded-lg px-4 py-2 text-white ${
                loading === "one" ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {loading === "one" ? "Starting..." : "Buy One-Time"}
            </button>
          </div>
        </div>

        <div className="rounded-lg border p-6">
          <h2 className="text-xl font-semibold">Annual Plan</h2>
          <p className="text-sm text-gray-600 mt-1">Initial PDF + 3 updates over the next 12 months.</p>
          <div className="mt-5">
            <button
              onClick={() => purchase("annual")}
              disabled={loading !== null}
              className={`w-full rounded-lg px-4 py-2 text-white ${
                loading === "annual" ? "bg-emerald-400" : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {loading === "annual" ? "Starting..." : "Buy Annual"}
            </button>
          </div>
        </div>
      </div>

      <div className="text-sm text-gray-600">
        Prefer to grade first?{" "}
        <Link href="/grade/new" className="text-blue-600 underline">
          Start here
        </Link>
        .
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 text-red-700 p-3 text-sm">
          {error}
        </div>
      )}
    </main>
  );
}
