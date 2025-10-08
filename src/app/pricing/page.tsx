// src/app/pricing/page.tsx
"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";

type AppliedPromo = {
  id: string;
  percent_off: number | null;
  amount_off: number | null; // cents
  currency: string;          // e.g., 'usd'
};

const PRICE_ONE_TIME = 79;   // USD
const PRICE_ANNUAL = 199;    // USD

function formatUSD(amount: number) {
  return `$${amount.toFixed(0)}`;
}

function applyDiscount(base: number, promo: AppliedPromo | null) {
  if (!promo) return base;
  if (promo.percent_off != null) {
    const discounted = base * (1 - promo.percent_off / 100);
    return Math.max(0, discounted);
  }
  if (promo.amount_off != null) {
    const amountOffDollars = promo.amount_off / 100; // cents -> dollars
    const discounted = base - amountOffDollars;
    return Math.max(0, discounted);
  }
  return base;
}

export default function PricingPage() {
  const [isLoading, setIsLoading] = useState<"one_time" | "annual" | null>(null);
  const [riaAccepted, setRiaAccepted] = useState(false);

  // Promo state (bottom box)
  const [promo, setPromo] = useState("");
  const [promoStatus, setPromoStatus] = useState<"idle" | "checking" | "applied" | "invalid">("idle");
  const [applied, setApplied] = useState<AppliedPromo | null>(null);

  const [error, setError] = useState<string | null>(null);
  const riaRef = useRef<HTMLDivElement | null>(null);

  async function handleApplyPromo() {
    setError(null);
    const code = promo.trim().toUpperCase();
    if (!code) {
      setApplied(null);
      setPromoStatus("invalid");
      return;
    }
    try {
      setPromoStatus("checking");
      const res = await fetch("/api/checkout/validate-promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data?.valid && data?.promotionCodeId) {
        const coupon = data.coupon || {};
        const ap: AppliedPromo = {
          id: data.promotionCodeId as string,
          percent_off: coupon.percent_off ?? null,
          amount_off: coupon.amount_off ?? null,
          currency: coupon.currency ?? "usd",
        };
        setApplied(ap);
        setPromoStatus("applied");
      } else {
        setApplied(null);
        setPromoStatus("invalid");
      }
    } catch (e) {
      console.error(e);
      setApplied(null);
      setPromoStatus("invalid");
    }
  }

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
          promotionCodeId: applied?.id || undefined, // send only if applied
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

  const buyDisabled = useMemo(
    () => !riaAccepted || isLoading !== null,
    [riaAccepted, isLoading]
  );

  const estOneTime = useMemo(
    () => applyDiscount(PRICE_ONE_TIME, applied),
    [applied]
  );
  const estAnnual = useMemo(
    () => applyDiscount(PRICE_ANNUAL, applied),
    [applied]
  );

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

      {error && (
        <div className="mx-auto max-w-md w-full">
          <p className="mt-1 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-8 mt-2">
        {/* ONE-TIME */}
        <div className="rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all bg-white">
          <h2 className="text-2xl font-semibold mb-2">One-Time Report</h2>
          <p className="text-gray-500 mb-4">Perfect for a single, in-depth grade.</p>
          <div className="text-4xl font-bold mb-1">{formatUSD(PRICE_ONE_TIME)}</div>
          {applied && (
            <div className="text-sm text-green-700">
              After promo: <span className="font-semibold">{formatUSD(estOneTime)}</span>
            </div>
          )}
          <ul className="text-sm text-gray-600 space-y-2 mb-6 mt-3">
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
          <div className="text-4xl font-bold mb-1">{formatUSD(PRICE_ANNUAL)}/yr</div>
          {applied && (
            <div className="text-sm text-green-700">
              After promo: <span className="font-semibold">{formatUSD(estAnnual)}</span>/yr
            </div>
          )}
          <ul className="text-sm text-gray-600 space-y-2 mb-6 mt-3">
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

      {/* Promo code (bottom) */}
      <div className="mx-auto max-w-md w-full rounded-lg border border-gray-200 p-4 bg-white">
        <label className="block text-sm font-medium mb-1">Promo code (optional)</label>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="text"
            value={promo}
            onChange={(e) => setPromo(e.target.value.toUpperCase())}
            placeholder="ENTER CODE"
            className="uppercase flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleApplyPromo}
            className="rounded-lg border px-4 py-2 hover:bg-gray-50"
          >
            {promoStatus === "checking" ? "Checking…" : "Apply"}
          </button>
        </div>
        {promoStatus === "applied" && (
          <p className="mt-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-2 py-1 inline-block">
            Promo applied. Prices above show your estimate.
          </p>
        )}
        {promoStatus === "invalid" && (
          <p className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1 inline-block">
            Invalid or inactive code.
          </p>
        )}
      </div>
    </main>
  );
}
