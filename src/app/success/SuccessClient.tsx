// src/app/success/SuccessClient.tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type State =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "needEmail" }
  | { kind: "done" }
  | { kind: "error"; message: string };

// ---- Stepper (mobile-friendly like the grade page) ----
function Stepper({ current = 4 }: { current?: 1 | 2 | 3 | 4 }) {
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

      {/* Full labels with horizontal scroll on larger screens */}
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
export default function SuccessClient() {
  const sp = useSearchParams();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [email, setEmail] = useState("");

  const sessionId = sp.get("session_id") || "";

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!sessionId) {
        setState({ kind: "error", message: "Missing session_id" });
        return;
      }
      setState({ kind: "working" });

      try {
        const res = await fetch("/api/report/generate-and-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });

        // route returns JSON; handle non-JSON defensively
        let data: any = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }

        if (!res.ok) {
          setState({
            kind: "error",
            message: data?.error || "Could not finalize your order.",
          });
          return;
        }

        if (data?.needEmail) {
          // Order exists but no email captured; show capture form
          setState({ kind: "needEmail" });
          return;
        }

        if (data?.ok) {
          setState({ kind: "done" });
          return;
        }

        setState({
          kind: "error",
          message: data?.error || "Unexpected response. Please try again.",
        });
      } catch (e: any) {
        setState({
          kind: "error",
          message: e?.message || "Network error while finalizing.",
        });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !sessionId) return;

    try {
      // Save email to order, then re-run generate-and-email
      const res1 = await fetch("/api/order/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, email }),
      });
      const d1 = await res1.json();
      if (!res1.ok || !d1?.ok) {
        setState({
          kind: "error",
          message: d1?.error || "Could not save email.",
        });
        return;
      }

      const res2 = await fetch("/api/report/generate-and-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const d2 = await res2.json();
      if (res2.ok && d2?.ok) {
        setState({ kind: "done" });
      } else {
        setState({
          kind: "error",
          message: d2?.error || "Could not send your report.",
        });
      }
    } catch (e: any) {
      setState({
        kind: "error",
        message: e?.message || "Network error while saving email.",
      });
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Order Confirmed</h1>

      {state.kind === "working" && (
        <div className="rounded-lg border p-6 bg-white text-sm text-gray-700">
          We’re preparing your PDF report…
        </div>
      )}

      {state.kind === "needEmail" && (
        <div className="rounded-lg border p-6 bg-white space-y-3">
          <p className="text-sm text-gray-700">
            We didn’t receive your email from Checkout. Enter it below and we’ll send your report.
          </p>
          <form onSubmit={submitEmail} className="flex gap-2">
            <input
              type="email"
              required
              className="border rounded-md p-2 flex-1"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              type="submit"
              className="rounded-md bg-blue-600 text-white px-4 py-2 hover:bg-blue-700"
            >
              Send my report
            </button>
          </form>
        </div>
      )}

      {state.kind === "done" && (
        <div className="rounded-lg border p-6 bg-white text-sm text-green-700">
          Your report has been emailed. Check your inbox!
        </div>
      )}

      {state.kind === "error" && (
        <div className="rounded-lg border p-6 bg-white text-sm text-red-700">
          {state.message}
          {!!sessionId && (
            <div className="mt-2 text-xs text-gray-500">
              (Session: <code className="font-mono">{sessionId}</code>)
            </div>
          )}
        </div>
      )}

      {state.kind === "idle" && (
        <div className="rounded-lg border p-6 bg-white text-sm text-gray-700">
          Finalizing your order…
        </div>
      )}
    </main>
  );
}
