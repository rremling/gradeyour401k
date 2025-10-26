"use client";

import { useState } from "react";

export default function ReviewPage() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function startCheckout(promoId?: string) {
    try {
      setLoading(true);
      setErr(null);

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // planKey "review" uses your live price set in envs (STRIPE_PRICE_401K_REVIEW)
        body: JSON.stringify({
          planKey: "review",
          // promotionCodeId: "promo_XXXXXXXXXXXX",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create checkout session");
      window.location.href = data.url; // Send to Stripe Checkout
    } catch (e: any) {
      setErr(e.message || "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <main className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold mb-2">Book a 30-Minute 401(k) Review</h1>
      <p className="text-sm text-gray-600 mb-4">
        $149 one-time. After checkout you’ll securely upload your 401(k) statement and then pick a time on our calendar.
      </p>

      {/* Inline, centered stepper (Pay → Upload → Schedule), compact & mobile-friendly */}
      <div className="mb-8 flex justify-center">
        <ol className="flex items-center gap-6 sm:gap-10">
          {/* Step 1: Pay (active) */}
          <li className="flex flex-col items-center">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-blue-600 bg-blue-600 text-white text-sm font-medium">
              1
            </span>
            <span className="mt-1 text-xs font-medium text-blue-700">Pay</span>
          </li>

          {/* connector */}
          <span className="hidden sm:block h-px w-12 bg-gray-300" />

          {/* Step 2: Upload */}
          <li className="flex flex-col items-center">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 text-sm font-medium">
              2
            </span>
            <span className="mt-1 text-xs text-gray-600">Upload</span>
          </li>

          {/* connector */}
          <span className="hidden sm:block h-px w-12 bg-gray-300" />

          {/* Step 3: Schedule */}
          <li className="flex flex-col items-center">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 text-sm font-medium">
              3
            </span>
            <span className="mt-1 text-xs text-gray-600">Schedule</span>
          </li>
        </ol>
      </div>

      <button
        onClick={() => startCheckout()}
        disabled={loading}
        className="w-full rounded-xl py-3 font-medium text-white transition disabled:opacity-50"
        style={{
          backgroundColor: "#0b59c7",
          boxShadow: "0 2px 6px rgba(11, 89, 199, 0.3)",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#0a4fb5")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#0b59c7")}
      >
        {loading ? "Opening Checkout…" : "Book Now — $149"}
      </button>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      <div className="mt-8 text-xs text-gray-500">
        <p>
          Have a promo code? You can enter it on the Stripe checkout page.
          If you prefer auto-apply, we can enable that for you on request.
        </p>
      </div>
    </main>
  );
}
