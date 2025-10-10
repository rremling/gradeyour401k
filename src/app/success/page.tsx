// src/app/order/success/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

// ---- Stepper ----
function Stepper({ current = 4 }: { current?: 1 | 2 | 3 | 4 }) {
  const steps = [
    { n: 1, label: "Get Grade" },
    { n: 2, label: "Review" },
    { n: 3, label: "Purchase" },
    { n: 4, label: "Report Sent" },
  ] as const;

  return (
    <div className="w-full">
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

export default function OrderSuccessPage() {
  const sp = useSearchParams();
  const [resending, setResending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const email = sp.get("email") || "";
  const orderId = sp.get("orderId") || "";
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = localStorage.getItem("gy4k_preview_id");
    setPreviewId(id || null);
  }, []);

  async function resend() {
    setMsg(null);
    try {
      setResending(true);
      const res = await fetch("/api/report/generate-and-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Prefer your server-side lookup by orderId/email; previewId is a fallback
          previewId: previewId || undefined,
          email: email || undefined,
          force: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data?.error || "Resend failed. Please try again.");
      } else {
        setMsg("Report re-sent! Check your inbox in a moment.");
      }
    } catch (e: any) {
      setMsg(e?.message || "Resend failed.");
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      {/* Progress / flow */}
      <Stepper current={4} />

      <h1 className="text-2xl font-bold">Report sent</h1>

      <div className="rounded-lg border p-6 bg-white space-y-3">
        <p className="text-gray-700">
          Thanks for your purchase! Your personalized PDF report is on its way
          {email ? (
            <>
              {" "}
              to <span className="font-medium">{email}</span>.
            </>
          ) : (
            "."
          )}
        </p>
        {orderId && (
          <p className="text-sm text-gray-600">Order ID: {orderId}</p>
        )}
        <div className="flex gap-3 pt-2">
          <button
            onClick={resend}
            disabled={resending}
            className="rounded-lg bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
          >
            {resending ? "Re-sending…" : "Re-send report"}
          </button>
          <Link
            href="/"
            className="inline-block rounded-lg border px-4 py-2 hover:bg-gray-50"
          >
            Back to home
          </Link>
        </div>
        {msg && (
          <p
            className={`text-sm ${
              msg.toLowerCase().includes("sent")
                ? "text-green-700"
                : "text-red-700"
            }`}
          >
            {msg}
          </p>
        )}
      </div>

      <section className="rounded-lg border p-6 bg-white space-y-2">
        <h2 className="text-lg font-semibold">Didn’t get the email?</h2>
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
          <li>Check your spam or promotions folder.</li>
          <li>Ensure <span className="font-mono">reports@gradeyour401k.kenaiinvest.com</span> is whitelisted.</li>
          <li>Click “Re-send report” above to send it again.</li>
        </ul>
      </section>
    </main>
  );
}
