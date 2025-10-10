// src/app/grade/results/page.tsx
import Link from "next/link";
import { sql } from "../../../lib/db"; // adjust if your path alias differs

type SearchParams = { previewId?: string };

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

  const providerDisplay = p.provider_display || p.provider || "—";
  const profile = p.profile || "—";
  const grade =
    typeof p.grade_adjusted === "number"
      ? p.grade_adjusted.toFixed(1)
      : typeof p.grade_base === "number"
      ? p.grade_base.toFixed(1)
      : "—";

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <Stepper current={2} />

      <h1 className="text-2xl font-bold">Your Grade</h1>

      <div className="rounded-lg border p-6 space-y-3 bg-white">
        <p>
          <span className="font-medium">Provider:</span> {providerDisplay}
        </p>
        <p>
          <span className="font-medium">Profile:</span> {profile}
        </p>
        <p className="text-3xl">⭐ {grade} / 5</p>
        <p className="text-xs text-gray-500">
          This is a preview. Purchase to unlock your full PDF report.
        </p>
      </div>

      <div className="flex gap-3">
        <Link
          href="/grade/new"
          className="inline-block rounded-lg border px-4 py-2 hover:bg-gray-50"
        >
          Edit inputs
        </Link>
        <Link
          href="/pricing"
          className="inline-block rounded-lg bg-blue-600 text-white px-4 py-2 hover:bg-blue-700"
        >
          Buy full report
        </Link>
      </div>
    </main>
  );
}
