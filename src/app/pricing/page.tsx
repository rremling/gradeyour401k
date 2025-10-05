// src/app/pricing/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";

export default function PricingPage() {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    try {
      setLoading(true);
      setError(null);

      // We’ll read optional state from localStorage if available
      const ls = typeof window !== "undefined" ? localStorage.getItem("gy4k_form_v1") : null;
      const formData = ls ? JSON.parse(ls) : null;

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Which price/plan to buy – set via env or change here
          priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID || "",
          // metadata to help correlate later (optional)
          metadata: {
            provider: formData?.provider ?? "",
            profile: formData?.profile ?? "",
          },
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Checkout failed");
      }

      const { url } = await res.json();
      if (!url) throw new Error("No checkout URL returned.");
      window.location.assign(url);
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-8">
      <h1 className="text-3xl font-bold text-center">Get Your 401k Grade</h1>
      <p className="text-center text-gray-600">
        Pay once to receive your personalized grade and PDF report. Share your grade for a discount on your next review.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border p-6">
          <h2 className="text-xl font-semibold">One-Time Grade</h2>
          <p className="mt-1 text-gray-600">Single PDF report + allocation suggestions.</p>
          <p className="mt-4 text-3xl font-bold">$49</p>
          <ul className="mt-4 space-y-2 text-sm text-gray-700">
            <li>✓ Personalized grade (⭐ up to 5)</li>
            <li>✓ Holdings vs. model comparison</li>
            <li>✓ Actionable fund changes</li>
            <li>✓ Social share image</li>
          </ul>
        </div>

        <div className="rounded-xl border p-6">
          <h2 className="text-xl font-semibold">Annual Plan</h2>
          <p className="mt-1 text-gray-600">Quarterly re-grades + updated PDF reports.</p>
          <p className="mt-4 text-3xl font-bold">$99<span className="text-base font-normal">/yr</span></p>
          <ul className="mt-4 space-y-2 text-sm text-gray-700">
            <li>✓ Everything in One-Time</li>
            <li>✓ 3 additional re-grades</li>
            <li>✓ Priority email support</li>
            <li>✓ Discount lock-in</li>
          </ul>
        </div>
      </div>

      <div className="rounded-xl border p-4 flex items-start gap-3">
        <input
          id="ria"
          type="checkbox"
          className="mt-1 h-5 w-5"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        <label htmlFor="ria" className="text-sm text-gray-700">
          I have read and agree to the{" "}
          <Link href="/legal/ria" className="underline hover:no-underline">
            RIA Agreement
          </Link>{" "}
          and understand this service provides educational information only and is not individualized investment advice.
        </label>
      </div>

      {error && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="flex justify-center">
        <button
          onClick={startCheckout}
          disabled={!agreed || loading}
          className={`rounded-lg px-6 py-3 text-white ${
            agreed && !loading ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 cursor-not-allowed"
          }`}
        >
          {loading ? "Redirecting…" : "Get My Grade"}
        </button>
      </div>

      <p className="text-center text-xs text-gray-500">
        By continuing, you consent to secure payment processing via Stripe.
      </p>
    </main>
  );
}
