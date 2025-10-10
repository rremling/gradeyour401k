// src/app/grade/results/page.tsx
import Link from "next/link";
import { sql } from "../../../lib/db"; // adjust if your alias/path differs

type SearchParams = { previewId?: string };
type Holding = { symbol: string; weight: number };

// Server-rendered stepper (no hooks)
function Stepper({ current = 2 }: { current?: 1 | 2 | 3 | 4 }) {
  const steps = [
    { n: 1, label: "Get Grade" },
    { n: 2, label: "Review" },
    { n: 3, label: "Purchase" },
    { n: 4, label: "Report Sent" },
  ] as const;

  return (
    <div className="w-full mb-6">
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

/** Compute a simple preliminary grade from holdings + profile.
 * Matches the lightweight logic used on the grade page:
 * - Base by profile
 * - Penalty if weights don’t sum ~100%
 * - Penalty for concentration (largest position > 60%)
 * - Clamp to [1,5] with half-star rounding
 */
function computePrelimGrade(profile: string, rows: Holding[]): number {
  const weights = rows.map((r) => (Number.isFinite(r.weight) ? r.weight : 0));
  const total = weights.reduce((s, n) => s + n, 0);

  let base =
    profile === "Aggressive Growth" ? 4.5 : profile === "Balanced" ? 3.8 : 4.1;

  // Penalize if not around 100%
  const off = Math.abs(100 - total);
  if (off > 0.25) {
    const p = Math.min(1, off / 100); // max -1.0
    base -= p;
  }

  // Penalize high concentration
  const maxWt = Math.max(0, ...weights);
  if (maxWt > 60) base -= 0.2;

  // Clamp and half-star round
  const score = Math.max(1, Math.min(5, Math.round(base * 2) / 2));
  return score;
}

export default async function ResultPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const previewId = (searchParams.previewId || "").trim();

  if (!previewId) {
    return (
      <main className="mx-auto max-w-3xl p-6 space-y-4">
        <Stepper current={2} />
        <h1 className="text-2xl font-bold">Your Grade</h1>
        <div className="rounded border p-4 bg-white">
          <p className="text-sm text-gray-700">
            We couldn’t find your saved preview. Please get your grade again.
          </p>
          <div className="mt-3">
            <Link href="/grade/new" className="text-blue-600 underline">
              Get your grade →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Supports UUID or bigint ids by casting to text
  const r = await sql(
    `SELECT id, created_at, provider, provider_display, profile, "rows", grade_base, grade_adjusted
     FROM public.previews
     WHERE id::text = $1
     LIMIT 1`,
    [previewId]
  );
  const p: any = r.rows?.[0];

  if (!p) {
    return (
      <main className="mx-auto max-w-3xl p-6 space-y-4">
        <Stepper current={2} />
        <h1 className="text-2xl font-bold">Your Grade</h1>
        <div className="rounded border p-4 bg-white">
          <p className="text-sm text-gray-700">
            Preview not found (id {previewId}). Please re-create your grade.
          </p>
          <div className="mt-3">
            <Link href="/grade/new" className="text-blue-600 underline">
              Get your grade →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const providerDisplay: string = p.provider_display || p.provider || "—";
  const profile: string = p.profile || "—";

  // Parse holdings
  let holdings: Holding[] = [];
  try {
    const raw = p.rows;
    const arr = Array.isArray(raw) ? raw : JSON.parse(raw);
    holdings = (arr as any[])
      .map((r) => ({
        symbol: String(r.symbol || "").toUpperCase(),
        weight: Number(r.weight || 0),
      }))
      .filter((r) => r.symbol && Number.isFinite(r.weight));
  } catch {
    holdings = [];
  }

  // Use stored grade if present; otherwise compute preliminary from holdings/profile
  const numericGrade: number | null =
    typeof p.grade_adjusted === "number"
      ? p.grade_adjusted
      : typeof p.grade_base === "number"
      ? p.grade_base
      : holdings.length > 0
      ? computePrelimGrade(profile, holdings)
      : null;

  const grade = numericGrade !== null ? numericGrade.toFixed(1) : "—";

  const total = holdings.reduce(
    (s, r) => s + (Number.isFinite(r.weight) ? r.weight : 0),
    0
  );

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-8">
      <Stepper current={2} />

      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Your Grade</h1>
        <p className="text-gray-600">
          Provider: <span className="font-medium">{providerDisplay}</span> ·
          {" "}Profile: <span className="font-medium">{profile}</span>
        </p>
      </header>

      {/* Grade card */}
      <section className="rounded-lg border p-6 bg-white space-y-3">
        <div className="text-3xl">⭐ {grade} / 5</div>
        <p className="text-sm text-gray-600">
          This is a preliminary grade. The paid PDF sharpens this with model comparison,
          market cycle overlay, and specific increase/decrease guidance.
        </p>
      </section>

      {/* Holdings list */}
      <section className="rounded-lg border p-6 bg-white">
        <h2 className="font-semibold">Your current holdings</h2>
        {holdings.length === 0 ? (
          <p className="text-sm text-gray-600 mt-2">No holdings to display.</p>
        ) : (
          <>
            <ul className="mt-3 text-sm text-gray-800 space-y-1">
              {holdings.map((r, idx) => (
                <li key={`${r.symbol}-${idx}`} className="flex justify-between">
                  <span className="font-mono">{r.symbol}</span>
                  <span>{(Number(r.weight) || 0).toFixed(1)}%</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 text-xs text-gray-500">Total: {total.toFixed(1)}%</div>
          </>
        )}
      </section>

      {/* What you get with the full report (replaces “reasons”) */}
      <section className="rounded-lg border p-6 bg-white">
        <h2 className="font-semibold">What you get with the full report</h2>
        <ul className="list-disc list-inside text-sm text-gray-800 mt-2 space-y-1">
          <li>Model comparison vs. curated ETF allocations for your profile.</li>
          <li>Market cycle overlay (SPY 30/50/100/200-day SMA) to sensibly tilt risk.</li>
          <li>Actionable “increase / decrease / replace” guidance with a reallocation roadmap.</li>
          <li>Fee and diversification diagnostics; sector/factor exposure view.</li>
          <li>Shareable star grade, delivered as a polished PDF to your inbox.</li>
          <li>Annual plan includes 3 additional re-grades over the next 12 months.</li>
        </ul>
      </section>

      {/* CTA buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/pricing"
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 text-white px-5 py-2 hover:bg-blue-700"
        >
          Buy full report
        </Link>
        <Link
          href="/grade/new"
          className="inline-flex items-center justify-center rounded-lg border px-5 py-2 hover:bg-gray-50"
        >
          Edit inputs
        </Link>
      </div>
    </main>
  );
}
