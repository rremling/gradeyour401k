// src/app/success/page.tsx
import { Suspense } from "react";
import SuccessClient from "./SuccessClient";

// Ensure this page is not pre-rendered in a way that trips CSR bailout checks.
export const dynamic = "force-dynamic";

// --- Stepper ---
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

           {/* Full labels (no horizontal scroll on sm+) */}
      <div className="hidden sm:block">
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
  );      
}         

export default function SuccessPage() {
  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <Stepper current={4} />
      <Suspense
        fallback={
          <div className="rounded-lg border p-6 bg-white text-sm text-gray-600">
            Finalizing your order…
          </div>
        }
      >
        <SuccessClient />
      </Suspense>
    </main>
  );
}
