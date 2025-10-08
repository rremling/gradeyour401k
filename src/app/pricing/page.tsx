// src/app/pricing/page.tsx
"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";

export default function PricingPage() {
  const [isLoading, setIsLoading] = useState<"one_time" | "annual" | null>(null);
  const [riaAccepted, setRiaAccepted] = useState(false);
  const [promo, setPromo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const riaRef = useRef<HTMLDivElement | null>(null);

  async function handleBuy(planKey: "one_time" | "annual") {
    setError(null);
    if (!riaAccepted) {
      riaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    try {
      setIsLoading(planKey);
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planKey,
          promo: promo.trim() || undefined, // optional coupon text
        }),
      });
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url as string;
      } else {
        setError(data?.error || "Checkout failed. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to start checkout. Please try again.");
    } finally {
      setIsLoading(null);
    }
  }

  const buyDisabled = useMemo(() => !riaAccepted || isLoading !== null, [riaAccepted, isLoading]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 space-y-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-3xl font-bold">Choose Your Plan</h1>
        <p className="text-gray-600 max-w-2xl">
          Instantly grade your 401(k) allocation and receive a personalized PDF report with
          provider-specific fund analysis and market-cycle context. Not sure yet?
        </p>

        {/* Link to get a grade first */}
        <Link
          href="/grade/new"
          className="inline-flex items-center rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
        >
          Get your grade first →
        </Link>
      </div>

      {/* Optional promo code */}
      <div className="mx-auto max-w-md w-full">
        <label className="block text-sm font-medium mb-1">Promo code (optional)</label>
        <input
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          placeholder="Enter code"
          value={promo}
          onChange={(e) => setPromo(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          If valid, your discount will be applied at checkout.
        </p>
      </div>

      {error && (
        <div className="mx-auto max-w-md w-full">
          <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-8 mt-4">
        {/* ONE-TIME */}
        <div className="rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all bg-white">
          <h2 className="text-2xl font-semibold mb-2">One-Time Report</h2>
          <p className="text-gray-500 mb-4">Perfect for a single, in-depth grade.</p>
          <div className="text-4xl font-bold mb-4">$79</div>
          <ul className="text-sm text-gray-600 space-y-2 mb-6">
            <li>✅ Instant grade & detailed PDF</li>
            <li>✅ Provider-specific fund analysis</li>
            <li>✅ Market-cycle overlay insights</li>
            <li>✅ Secure email delivery</li>
          </ul>
          <button
            disabled={buyDisabled}
            onClick={() => handleBuy("one_time")}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white py-3 font-medium transition disabled:opacity-60 disabled:hover:bg-blue-600"
          >
            {isLoading === "one_time" ? "Redirecting…" : "Buy One-Time Report"}
          </button>
        </div>

        {/* ANNUAL */}
        <div className="rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all bg-white">
          <h2 className="text-2xl font-semibold mb-2">Annual Plan</h2>
          <p className="text-gray-500 mb-4">For proactive investors who want updates.</p>
          <div className="text-4xl font-bold mb-4">$199/yr</div>
          <ul className="text-sm text-gray-600 space-y-2 mb-6">
            <li>✅ Everything in the One-Time plan</li>
            <li>✅ Three additional quarterly updates</li>
            <li>✅ Market regime monitoring</li>
            <li>✅ Priority email support</li>
          </ul>
          <button
            disabled={buyDisabled}
            onClick={() => handleBuy("annual")}
            className="w-full rounded-lg bg-green-600 hover:bg-green-700 text-white py-3 font-medium transition disabled:opacity-60 disabled:hover:bg-green-600"
          >
            {isLoading === "annual" ? "Redirecting…" : "Buy Annual Plan"}
          </button>
        </div>
      </div>

      {/* RIA Agreement acknowledgment */}
      <div ref={riaRef} className="mt-2 rounded-lg border border-gray-200 p-4 bg-white">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={riaAccepted}
            onChange={(e) => setRiaAccepted(e.target.checked)}
          />
          <span>
            I have read and agree to the{" "}
            <a href="/legal/ria" className="text-blue-600 hover:underline">
              Registered Investment Advisory Agreement
            </a>
            .
          </span>
        </label>
        {!riaAccepted && (
          <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1 inline-block">
            Please check this box to enable checkout.
          </p>
        )}
      </div>
    </main>
  );
}
