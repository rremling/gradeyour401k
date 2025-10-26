"use client";

import { useState } from "react";
import StepNav from "@/app/components/StepNav"; // ← added import

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
    <>
      {/* Stepper at top */}
      <StepNav current="pay" />

      <main className="max-w-xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-semibold mb-2">
          Book a 30-Minute 401(k) Review
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          $149 one-time. After checkout you’ll securely upload your 401(k)
          statement and then pick a time on our calendar.
        </p>

        <button
          onClick={() => startCheckout()}
          disabled={loading}
          className="w-full rounded-xl py-3 font-medium text-white transition disabled:opacity-50"
          style={{
            backgroundColor: "#0b59c7",
            boxShadow: "0 2px 6px rgba(11, 89, 199, 0.3)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "#0a4fb5")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "#0b59c7")
          }
        >
          {loading ? "Opening Checkout…" : "Book Now — $149"}
        </button>

        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

        <div className="mt-8 text-xs text-gray-500">
          <p>
            Have a promo code? You can enter it on the Stripe checkout page. If
            you prefer auto-apply, we can enable that for you on request.
          </p>
        </div>
      </main>
    </>
  );
}
