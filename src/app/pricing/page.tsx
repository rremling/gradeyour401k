// src/app/pricing/page.tsx
"use client";

import { useState } from "react";

export default function PricingPage() {
  const [isLoading, setIsLoading] = useState<"one_time" | "annual" | null>(
    null
  );

  async function handleBuy(planKey: "one_time" | "annual") {
    try {
      setIsLoading(planKey);
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(`Checkout failed: ${data.error || "unknown error"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to start checkout");
    } finally {
      setIsLoading(null);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 space-y-8">
      <h1 className="text-3xl font-bold text-center">Choose Your Plan</h1>
      <p className="text-center text-gray-600 max-w-2xl mx-auto">
        Instantly grade your 401(k) allocation and receive a personalized PDF
        report with actionable insights, market-cycle context, and provider-specific
        fund analysis.
      </p>

      <div className="grid sm:grid-cols-2 gap-8 mt-8">
        {/* --- ONE-TIME PLAN --- */}
        <div className="rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all bg-white">
          <h2 className="text-2xl font-semibold mb-2">One-Time Report</h2>
          <p className="text-gray-500 mb-4">Perfect for a single, in-depth grade.</p>
          <div className="text-4xl font-bold mb-4">$79</div>
          <ul className="text-sm text-gray-600 space-y-2 mb-6">
            <li>✅ Instant grade & detailed report</li>
            <li>✅ Provider-specific fund analysis</li>
            <li>✅ Market-cycle overlay insights</li>
            <li>✅ Secure email delivery of PDF</li>
          </ul>
          <button
            disabled={isLoading === "one_time"}
            onClick={() => handleBuy("one_time")}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white py-3 font-medium transition disabled:opacity-60"
          >
            {isLoading === "one_time" ? "Redirecting…" : "Buy One-Time Report"}
          </button>
        </div>

        {/* --- ANNUAL PLAN --- */}
        <div className="rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all bg-white">
          <h2 className="text-2xl font-semibold mb-2">Annual Plan</h2>
          <p className="text-gray-500 mb-4">For proactive investors who want updates.</p>
          <div className="text-4xl font-bold mb-4">$199/yr</div>
          <ul className="text-sm text-gray-600 space-y-2 mb-6">
            <li>✅ Includes everything in the One-Time plan</li>
            <li>✅ Three additional quarterly updates</li>
            <li>✅ Continuous monitoring of market regime</li>
            <li>✅ Priority email support</li>
          </ul>
          <button
            disabled={isLoading === "annual"}
            onClick={() => handleBuy("annual")}
            className="w-full rounded-lg bg-green-600 hover:bg-green-700 text-white py-3 font-medium transition disabled:opacity-60"
          >
            {isLoading === "annual" ? "Redirecting…" : "Buy Annual Plan"}
          </button>
        </div>
      </div>

      <p className="text-xs text-center text-gray-500 mt-6">
        *By proceeding to checkout, you acknowledge that you have reviewed the{" "}
        <a href="/legal/ria" className="text-blue-600 hover:underline">
          Registered Investment Advisory Agreement
        </a>
        .
      </p>
    </main>
  );
}
