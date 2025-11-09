// src/app/grade/results/page.tsx
import Link from "next/link";
import { sql } from "@/lib/db"; // uses the helper you added in lib/db.ts
import { FUND_LABELS, labelFor } from "@/lib/funds";

export const dynamic = "force-dynamic";

type SearchParams = { previewId?: string };
type Holding = { symbol: string; weight: number };

// ───────────────────────── Stepper (mobile-friendly) ─────────────────────────
function Stepper({ current = 2 }: { current?: 1 | 2 | 3 | 4 }) {
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

/** Compute a simple preliminary grade from holdings + profile. */
function computePrelimGrade(profile: string, rows: Holding[]): number {
  const weights = rows.map((r) => (Number.isFinite(r.weight) ? r.weight : 0));
  const total = weights.reduce((s, n) => s + n, 0);

  let base = profile === "Aggressive Growth" ? 4.5 : profile === "Balanced" ? 3.8 : 4.1;

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

function Stars({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <div className="relative inline-block align-middle" aria-label={`${value.toFixed(1)} out of 5`}>
      <div className="text-3xl text-gray-300 tracking-[2px] select-none">★★★★★</div>
      <div className="absolute left-0 top-0 h-full overflow-hidden" style={{ width: `${pct}%` }}>
        <div className="text-3xl text-yellow-500 tracking-[2px] select-none">★★★★★</div>
      </div>
    </div>
  );
}

export default async function ResultPage({ searchParams }: { searchParams: SearchParams }) {
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
    `
    SELECT id, created_at, provider, provider_display, profile, "rows", grade_base, grade_adjusted
    FROM public.previews
    WHERE id::text = $1
    LIMIT 1
    `,
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

  // Parse holdings safely (rows may be json or text)
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

  const numericGrade: number | null =
    typeof p.grade_adjusted === "number"
      ? p.grade_adjusted
      : typeof p.grade_base === "number"
      ? p.grade_base
      : holdings.length > 0
      ? computePrelimGrade(profile, holdings)
      : null;

  const grade = numericGrade !== null ? numericGrade.toFixed(1) : "—";
  const gradeNum = numericGrade ?? 0;
  const total = holdings.reduce((s, r) => s + (Number.isFinite(r.weight) ? r.weight : 0), 0);

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-8">
      <Stepper current={2} />

      {/* Hero header with subtle gradient */}
      <header className="rounded-xl p-6 bg-gradient-to-br from-blue-600/10 to-emerald-500/10 border">
        <h1 className="text-2xl font-bold">Your 401(k) Grade</h1>
        <p className="text-gray-700 mt-1">
          Provider: <span className="font-medium">{providerDisplay}</span> · Profile:{" "}
          <span className="font-medium">{profile}</span>
        </p>
      </header>

      {/* Grade card */}
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Stars value={gradeNum} />
              <div className="text-3xl font-semibold">{grade} / 5</div>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              This preliminary grade reflects your current mix and concentration. Your optimized
              report can lift your plan toward a <span className="font-semibold text-blue-700">5-Star</span>{" "}
              allocation with clear, step-by-step adjustments.
            </p>
          </div>
          <div className="text-right hidden sm:block">
            {/* Total weight meter */}
            <div className="text-xs text-gray-600 mb-1">Total allocation</div>
            <div className="w-44 h-2 rounded-full bg-gray-200 overflow-hidden">
              <div
                className={`h-full ${Math.abs(100 - total) < 0.1 ? "bg-emerald-500" : "bg-yellow-500"}`}
                style={{ width: `${Math.min(100, Math.max(0, total))}%` }}
              />
            </div>
            <div className="text-xs text-gray-600 mt-1">{total.toFixed(1)}% (target 100%)</div>
          </div>
        </div>
      </section>

      {/* Holdings list with descriptions */}
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Your current holdings</h2>
          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
            {holdings.length} fund{holdings.length === 1 ? "" : "s"}
          </span>
        </div>

        {holdings.length === 0 ? (
          <p className="text-sm text-gray-600 mt-2">No holdings to display.</p>
        ) : (
          <ul className="mt-3 text-sm text-gray-800 divide-y">
            {holdings.map((r, idx) => {
              const sym = (r.symbol || "").toUpperCase().trim();
              const desc = FUND_LABELS[sym];
              return (
                <li key={`${r.symbol}-${idx}`} className="py-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono font-medium">{r.symbol}</div>
                    <div className="text-xs text-gray-600 truncate" title={labelFor(r.symbol)}>
                      {desc ?? " "}
                    </div>
                  </div>
                  <div className="shrink-0 font-medium">{(Number(r.weight) || 0).toFixed(1)}%</div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-2 text-xs text-gray-500">Total: {total.toFixed(1)}%</div>
      </section>

      {/* Value prop + CTA */}
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="font-semibold">Make it 5-Stars with an Optimized Report</h2>
        <p className="text-sm text-gray-700 mt-2">
          Get a personalized PDF with <span className="font-medium">exact increase/decrease actions</span>, a
          <span className="font-medium"> model match</span> for your profile, and a
          <span className="font-medium"> market-aware tilt</span> so you can implement confidently.
        </p>
        <ul className="list-disc list-inside text-sm text-gray-800 mt-3 space-y-1">
          <li>Specific fund changes to reach the target allocation</li>
          <li>Side-by-side comparison vs. a curated model</li>
          <li>Clear next steps—no guesswork</li>
        </ul>
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 text-white px-5 py-2.5 hover:bg-blue-700"
          >
            Buy optimized report
          </Link>
          <Link
            href={`/grade/new?previewId=${encodeURIComponent(previewId)}`}
            className="inline-flex items-center justify-center rounded-lg border px-5 py-2.5 hover:bg-gray-50"
          >
            Edit inputs
          </Link>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          You can revisit and tweak your entries—your preview is linked above.
        </p>
      </section>
    </main>
  );
}
