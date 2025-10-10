"use client";

import Link from "next/link";
import { useState } from "react";

// Reusable stepper
function Stepper({ current = 3 }: { current?: 1 | 2 | 3 | 4 }) {
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

export default function PricingPage() {
  const [promoCode, setPromoCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(plan: "onetime" | "annual") {
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          promoCode: promoCode.trim().toUpperCase(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.url) throw new Error(data?.error || "Checkout failed");
      window.location.href = data.url;
    } catch (e: any) {
      setError(e?.message || "Checkout failed");
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-8">
      <Stepper current={3} />

      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Choose your report option</h1>
        <p className="text-gray-600">
          Get your personalized 401(k) grade and detailed improvement guidance.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* One-time */}
        <div className="border rounded-lg bg-white p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">One-time Report</h2>
              <span className="text-lg font-bold text-blue-600">$79</span>
            </div>
            <ul className="list-disc list-inside text-gray-700 text-sm space-y-2">
              <li>Personalized 401(k) score and ranking</li>
              <li>Performance and diversification analysis</li>
              <li>Tax-efficiency & fee evaluation</li>
              <li>PDF report delivered instantly via email</li>
            </ul>
          </div>
          <div className="pt-4">
            <button
              onClick={() => startCheckout("onetime")}
              className="w-full rounded-lg bg-blue-600 text-white py-2 hover:bg-blue-700 transition"
            >
              Buy One-Time Report
            </button>
          </div>
        </div>

        {/* Annual */}
        <div className="border rounded-lg bg-white p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Annual Plan</h2>
              <span className="text-lg font-bold text-blue-600">$199/yr</span>
            </div>
            <ul className="list-disc list-inside text-gray-700 text-sm space-y-2">
              <li>Everything in One-time Report</li>
              <li>Quarterly portfolio re-grade updates</li>
              <li>Market cycle trend overlay</li>
              <li>Priority email support</li>
            </ul>
          </div>
          <div className="pt-4">
            <button
              onClick={() => startCheckout("annual")}
              className="w-full rounded-lg bg-blue-600 text-white py-2 hover:bg-blue-700 transition"
            >
              Subscribe to Annual Plan
            </button>
          </div>
        </div>
      </div>

      {/* Promo code */}
      <div className="max-w-md mx-auto text-center space-y-3 pt-8">
        <label className="block text-sm font-medium text-gray-700">
          Have a promo code?
        </label>
        <div className="flex justify-center gap-2">
          <input
            type="text"
            placeholder="PROMO2025"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            className="border rounded-md p-2 text-center w-40 uppercase"
          />
          <button
            onClick={() => setPromoCode(promoCode.trim().toUpperCase())}
            className="border rounded-md px-3 py-2 text-sm hover:bg-gray-50"
          >
            Apply
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Discounts automatically apply at checkout.
        </p>
      </div>

      {/* Agreement */}
      <div className="text-center text-sm text-gray-600 pt-6">
        By purchasing, you agree to our{" "}
        <Link href="/legal/ria" className="underline text-blue-600">
          RIA Agreement
        </Link>{" "}
        and acknowledge that this analysis is for informational purposes only.
      </div>

      {/* Link to get grade */}
      <div className="text-center pt-4">
        <Link
          href="/grade/new"
          className="text-blue-600 underline hover:no-underline"
        >
          Haven’t received your grade yet? Get your grade first →
        </Link>
      </div>
    </main>
  );
}
