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
          // If you want to auto-apply your 100% promo, pass its Promotion Code ID here:
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
      <p className="text-sm text-gray-600 mb-6">
        $149 one-time. After checkout you’ll securely upload your 401(k) statement and then pick a time on our calendar.
      </p>

      <button
        onClick={() => startCheckout()}
        disabled={loading}
        className="w-full bg-black text-white rounded-xl py-3 font-medium hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Opening Checkout…" : "Book Now — $149"}
      </button>

      {/* Optional helper text / error */}
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
