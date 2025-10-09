"use client";
import { useEffect, useMemo, useRef, useState } from "react";
// ...existing imports/types/utilities...

export default function PricingPage() {
  const [isLoading, setIsLoading] = useState<"one_time" | "annual" | null>(null);
  const [riaAccepted, setRiaAccepted] = useState(false);

  // NEW: preliminary grade gate
  const [hasPrelim, setHasPrelim] = useState(false);
  const [prelimAccepted, setPrelimAccepted] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    const id = typeof window !== "undefined" ? localStorage.getItem("gy4k_preview_id") : null;
    if (id) {
      setPreviewId(id);
      setHasPrelim(true);
      setPrelimAccepted(true); // auto-check if found
    } else {
      setPreviewId(null);
      setHasPrelim(false);
      setPrelimAccepted(false);
    }
  }, []);

  // ...promo code state...

  async function handleBuy(planKey: "one_time" | "annual") {
    setError(null);

    if (!prelimAccepted || !hasPrelim || !previewId) {
      // strong nudge to get a grade first
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
          promotionCodeId: applied?.id || undefined,
          previewId, // 👈 pass through to metadata
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
    () => !riaAccepted || !prelimAccepted || isLoading !== null,
    [riaAccepted, prelimAccepted, isLoading]
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 space-y-8">
      {/* ...header... */}

      {/* Preliminary Grade gate */}
      <div className="rounded-lg border border-gray-200 p-4 bg-white">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={prelimAccepted}
            onChange={(e) => setPrelimAccepted(e.target.checked)}
          />
          <span>
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
          </span>
        </label>
        {!hasPrelim && (
          <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1 inline-block">
            No preliminary grade found. Please grade your current 401(k) first; we use this to build your PDF.
          </p>
        )}
      </div>

      {/* ...pricing cards with buyDisabled... */}

      {/* RIA Agreement box (unchanged) */}
      {/* Promo code box (unchanged) */}
    </main>
  );
}
