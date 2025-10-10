// src/app/grade/results/page.tsx
import Link from "next/link";
import { sql } from "../../../lib/db"; // adjust if your path alias differs

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

// --- Simple “reasons” computation mirroring the grade page ---
function computeReasons(rows: Holding[]) {
  const weights = rows.map((r) => (Number.isFinite(r.weight) ? r.weight : 0));
  const total = weights.reduce((s, n) => s + n, 0);
  const reasons: string[] = [];

  // total near 100%
  const off = Math.abs(100 - total);
  if (off > 0.25) {
    reasons.push(`Weights sum to ${total.toFixed(1)}% (target 100%).`);
  }

  // concentration
  const maxWt = Math.max(0, ...weights);
  if (maxWt > 60) {
    reasons.push(`High concentration: top position is ${maxWt.toFixed(1)}%.`);
  }

  return { reasons, total };
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
  const numericGrade =
    typeof p.grade_adjusted === "number"
      ? p.grade_adjusted
      : typeof p.grade_base === "number"
      ? p.grade_base
      : null;
  const grade = numericGrade !== null ? numericGrade.toFixed(1) : "—";

  // Parse rows (DB column "rows" may already be an array or a JSON string)
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

  const { reasons, total } = computeReasons(holdings);

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-8">
      <Stepper current={2} />

      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Your Grade</h1>
        <p className="text-gray-600">
          Provider: <span className="font-medium">{providerDisplay}</span> · Profile:{" "}
          <span className="font-medium">{profile}</span>
        </p>
      </header>

      {/* Grade card */}
      <section className="rounded-lg border p-6 bg-white space-y-3">
        <div className="text-3xl">⭐ {grade} / 5</div>
        <p className="text-sm text-gray-600">
          This is a preview grade. The full paid PDF includes model comparison, market cycle overlay,
          and personalized increase/decrease guidance.
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

      {/* Reasons (preview bullets) */}
      <section className="rounded-lg border p-6 bg-white">
        <h2 className="font-semibold">Why you received this grade</h2>
        {reasons.length === 0 ? (
          <p className="text-sm text-gray-600 mt-2">
            Looks balanced for your selected profile. The full report can still reveal fees, overlaps,
            and optimization opportunities.
          </p>
        ) : (
          <ul className="list-disc list-inside text-sm text-gray-800 mt-2 space-y-1">
            {reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        )}
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
