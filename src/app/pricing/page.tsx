// src/app/pricing/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

// ---- Stepper (mobile-friendly) ----
function Stepper({ current = 3 }: { current?: 1 | 2 | 3 | 4 }) {
  const steps = [
    { n: 1, label: "Get Grade" },
    { n: 2, label: "Review" },
    { n: 3, label: "Purchase" },
    { n: 4, label: "Report Sent" },
  ] as const;

  return (
    <div className="w-full mb-6">
      {/* Compact on mobile */}
      <ol className="flex sm:hidden items-end justify-between gap-2">
        {steps.map((s) => {
          const isActive = s.n === current;
          const isComplete = s.n < current;
          return (
            <li key={s.n} className="flex-1 flex flex-col items-center gap-1 min-w-0">
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
              <div
                className={[
                  "text-[10px] leading-tight text-center truncate max-w-[5.5rem]",
                  isActive ? "font-semibold text-blue-700" : "text-gray-700",
                ].join(" ")}
              >
                {s.label}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Full labels with horizontal scroll if needed */}
      <div className="hidden sm:block">
        <div className="-mx-3 overflow-x-auto overscroll-x-contain">
          <ol className="flex items-center gap-3 flex-nowrap px-3">
            {steps.map((s, idx) => {
              const isActive = s.n === current;
              const isComplete = s.n < current;
              return (
                <li key={s.n} className="flex items-center gap-3 shrink-0">
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
      </div>
    </div>
  );
}
/* ---------------------- pricing + checkout logic (unchanged) ---------------------- */
const ONE_TIME_PRICE_USD = Number(process.env.NEXT_PUBLIC_PRICE_ONE_TIME || 79);
const ANNUAL_PRICE_USD = Number(process.env.NEXT_PUBLIC_PRICE_ANNUAL || 149);

type PlanKey = "one_time" | "annual";
type PromoInfo = {
  id: string;
  percent_off?: number | null;
  amount_off?: number | null;
  currency?: string | null;
};

export default function PricingPage() {
  const [isLoading, setIsLoading] = useState<PlanKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [riaAccepted, setRiaAccepted] = useState(false);
  const riaRef = useRef<HTMLDivElement | null>(null);

  const [hasPrelim, setHasPrelim] = useState(false);
  const [prelimAccepted, setPrelimAccepted] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    const id =
      typeof window !== "undefined"
        ? localStorage.getItem("gy4k_preview_id")
        : null;
    if (id) {
      setPreviewId(id);
      setHasPrelim(true);
      setPrelimAccepted(true);
    } else {
      setPreviewId(null);
      setHasPrelim(false);
      setPrelimAccepted(false);
    }
  }, []);

  const [promoInput, setPromoInput] = useState("");
  const [applied, setApplied] = useState<PromoInfo | null>(null);
  const [applying, setApplying] = useState(false);
  const [promoMsg, setPromoMsg] = useState<string | null>(null);

  function calcAfterPromo(baseUsd: number, promo: PromoInfo | null): number {
    if (!promo) return baseUsd;
    const pct = promo.percent_off ?? null;
    const amtCents = promo.amount_off ?? null;
    let after = baseUsd;
    if (pct && pct > 0) after = Math.max(0, baseUsd * (1 - pct / 100));
    else if (amtCents && amtCents > 0) after = Math.max(0, baseUsd - amtCents / 100);
    return Math.round(after * 100) / 100;
  }

  const oneTimeAfter = useMemo(() => calcAfterPromo(ONE_TIME_PRICE_USD, applied), [applied]);
  const annualAfter = useMemo(() => calcAfterPromo(ANNUAL_PRICE_USD, applied), [applied]);

  const buyDisabled = useMemo(
    () => !riaAccepted || !prelimAccepted || isLoading !== null,
    [riaAccepted, prelimAccepted, isLoading]
  );

  async function handleBuy(planKey: PlanKey) {
    setError(null);

    if (!prelimAccepted || !hasPrelim || !previewId) {
      window.location.href = "/grade/new";
      return;
    }
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
          previewId,
          promotionCodeId: applied?.id || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.url) {
        window.location.href = data.url as string;
      } else {
        setError(data?.error || "Checkout failed. Please try again.");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to start Checkout. Please try again.");
    } finally {
      setIsLoading(null);
    }
  }

  async function applyPromo() {
    setPromoMsg(null);
    setError(null);
    setApplying(true);
    try {
      const code = promoInput.trim().toUpperCase();
      if (!code) {
        setPromoMsg("Enter a code first.");
        setApplying(false);
        return;
      }
      const res = await fetch("/api/checkout/validate-promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();

      if (!res.ok || !data?.ok || !data?.promotionCode) {
        setApplied(null);
        setPromoMsg(data?.error || "This code is invalid or not applicable to your items.");
      } else {
        setApplied({
          id: data.promotionCode.id,
          percent_off: data.promotionCode.coupon?.percent_off ?? null,
          amount_off: data.promotionCode.coupon?.amount_off ?? null,
          currency: data.promotionCode.coupon?.currency ?? null,
        });
        setPromoMsg("Code applied!");
      }
    } catch (e: any) {
      setApplied(null);
      setPromoMsg("Failed to validate promo. Please try again.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 space-y-8">
      {/* Progress / flow */}
      <Stepper current={3} />

      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Get Your 401(k) Report</h1>
        <p className="text-gray-600">
          Buy a one-time report or an annual plan with 3 additional updates through the year.
          We require a quick, preliminary grade first so your PDF is personalized.
        </p>
      </header>

      {/* Preliminary Grade gate */}
      <div className="rounded-lg border border-gray-200 p-4 bg-white">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={prelimAccepted}
            onChange={(e) => setPrelimAccepted(e.target.checked)}
          />
        </label>
        <div className="ml-7">
          <p>
            I have a <strong>preliminary grade</strong> saved for this order.
            {!hasPrelim && (
              <>
                {" "}
                <a href="/grade/new" className="text-blue-600 hover:underline">
                  Get your grade first
                </a>{" "}
                to continue.
              </>
            )}
          </p>
          {!hasPrelim && (
            <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1 inline-block">
              No preliminary grade found. Please grade your current 401(k) first.
            </p>
          )}
        </div>
      </div>

      {/* Pricing cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* One-Time card */}
        <div className="rounded-2xl border p-6 bg-white flex flex-col">
          {/* title + price inline */}
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">One-Time Report</h2>
            <div className="text-xl md:text-2xl font-bold text-blue-600">
              ${ONE_TIME_PRICE_USD.toFixed(0)}
            </div>
          </div>
          {/* after-promo hint */}
          {applied && (
            <div className="text-xs text-green-700 mt-1">
              After promo: ${oneTimeAfter.toFixed(2)}
            </div>
          )}
          <p className="text-gray-600 mt-2">
            Personalized PDF with your grade, model comparison, and allocation guidance.
          </p>
          {/* bullets */}
          <ul className="mt-4 text-sm text-gray-700 list-disc list-inside space-y-1">
            <li>PDF delivered by email</li>
            <li>Market cycle overlay (SPY SMA)</li>
            <li>Shareable star grade</li>
          </ul>
          {/* buy button moved below bullets */}
          <button
            className="mt-6 rounded-lg bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
            disabled={buyDisabled}
            onClick={() => handleBuy("one_time")}
          >
            {isLoading === "one_time" ? "Starting…" : "Buy One-Time"}
          </button>
        </div>

        {/* Annual card */}
        <div className="rounded-2xl border p-6 bg-white flex flex-col">
          {/* title + price inline */}
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">Annual Plan</h2>
            <div className="text-xl md:text-2xl font-bold text-blue-600">
              ${ANNUAL_PRICE_USD.toFixed(0)}
            </div>
          </div>
          {/* after-promo hint */}
          {applied && (
            <div className="text-xs text-green-700 mt-1">
              After promo: ${annualAfter.toFixed(2)}
            </div>
          )}
          <p className="text-gray-600 mt-2">
            Includes the initial report plus 3 more updates over the next 12 months.
          </p>
          {/* bullets */}
          <ul className="mt-4 text-sm text-gray-700 list-disc list-inside space-y-1">
            <li>Initial PDF report</li>
            <li>3 quarterly updates</li>
            <li>Priority support</li>
          </ul>
          {/* buy button moved below bullets */}
          <button
            className="mt-6 rounded-lg bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
            disabled={buyDisabled}
            onClick={() => handleBuy("annual")}
          >
            {isLoading === "annual" ? "Starting…" : "Buy Annual"}
          </button>
        </div>
      </section>

      {/* RIA Agreement */}
      <div ref={riaRef} className="rounded-lg border p-4 bg-white">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={riaAccepted}
            onChange={(e) => setRiaAccepted(e.target.checked)}
          />
          <span>
            I agree to the{" "}
            <Link href="/legal/ria" className="text-blue-600 hover:underline" target="_blank">
              RIA Agreement
            </Link>{" "}
            (Kenai Investments Inc., 2700 S Western Suite 900, Amarillo, TX — www.kenaiinvest.com).
          </span>
        </label>
      </div>

      {/* Promo code (bottom) */}
      <div className="rounded-lg border p-4 bg-white">
        <label className="text-sm font-medium">Promo code</label>
        <div className="mt-2 flex gap-2">
          <input
            className="w-56 border rounded-md p-2 uppercase"
            value={promoInput}
            onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
            placeholder="ENTER CODE"
            maxLength={40}
          />
          <button
            className="rounded-md border px-4 py-2 hover:bg-gray-50 disabled:opacity-50"
            onClick={applyPromo}
            disabled={applying}
          >
            {applying ? "Applying…" : "Apply"}
          </button>
          {applied && <span className="text-sm text-green-700 self-center">Code applied</span>}
        </div>
        {promoMsg && (
          <p
            className={`mt-2 text-sm ${
              promoMsg.includes("applied") ? "text-green-700" : "text-red-700"
            }`}
          >
            {promoMsg}
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-red-700 text-sm">
          {error}
        </div>
      )}
    </main>
  );
}
