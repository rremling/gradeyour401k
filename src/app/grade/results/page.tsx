// src/app/grade/results/page.tsx
import Link from "next/link";

// Local stepper (Purchase is step 2: Review)
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

type Holding = { symbol: string; weight: number };
type PreviewRecord = {
  id: string;
  provider: string; // e.g. "fidelity"
  provider_display?: string; // e.g. "Fidelity"
  profile: string; // "Aggressive Growth" | "Growth" | "Balanced"
  rows: Holding[];
  grade_base?: number | null;
  grade_adjusted?: number | null;
};

const PREVIEW_ENDPOINT = "/api/preview/get"; // change if your route differs

async function loadPreview(previewId: string): Promise<PreviewRecord | null> {
  try {
    const res = await fetch(`${PREVIEW_ENDPOINT}?previewId=${encodeURIComponent(previewId)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Accept common shapes: {ok, preview}, {preview}, or plain preview
    const preview: PreviewRecord | undefined =
      data?.preview ?? (data?.ok ? data?.data || data?.record : data) ?? null;
    if (!preview || !preview?.rows) return null;
    return preview as PreviewRecord;
  } catch {
    return null;
  }
}

export default async function ResultPage({
  searchParams,
}: {
  searchParams: { previewId?: string };
}) {
  const previewId = searchParams?.previewId;
  if (!previewId) {
    return (
      <main className="mx-auto max-w-3xl p-6 space-y-6">
        <Stepper current={2} />
        <h1 className="text-2xl font-bold">We couldn’t find your saved preview</h1>
        <p className="text-gray-600">
          Please get your grade again to generate a new preview.
        </p>
        <Link
          href="/grade/new"
          className="inline-block rounded-lg bg-blue-600 text-white px-5 py-2 hover:bg-blue-700"
        >
          Get your grade
        </Link>
      </main>
    );
  }

  const preview = await loadPreview(previewId);
  if (!preview) {
    return (
      <main className="mx-auto max-w-3xl p-6 space-y-6">
        <Stepper current={2} />
        <h1 className="text-2xl font-bold">We couldn’t find your saved preview</h1>
        <p className="text-gray-600">
          The preview might have expired or been removed. Please re-enter your holdings to regenerate it.
        </p>
        <Link
          href="/grade/new"
          className="inline-block rounded-lg bg-blue-600 text-white px-5 py-2 hover:bg-blue-700"
        >
          Get your grade
        </Link>
      </main>
    );
  }

  const grade =
    (typeof preview.grade_adjusted === "number" && preview.grade_adjusted) ||
    (typeof preview.grade_base === "number" && preview.grade_base) ||
    null;

  const providerDisplay =
    preview.provider_display ||
    (preview.provider || "").replace(/\b\w/g, (c) => c.toUpperCase());

  const cleanRows: Holding[] = Array.isArray(preview.rows)
    ? preview.rows
        .map((r) => ({
          symbol: String(r.symbol || "").toUpperCase(),
          weight: Number(r.weight || 0),
        }))
        .filter((r) => r.symbol && Number.isFinite(r.weight))
    : [];

  // total (nice to show)
  const total = cleanRows.reduce((s, r) => s + (Number.isFinite(r.weight) ? r.weight : 0), 0);

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-8">
      <Stepper current={2} />

      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Your Grade</h1>
        <p className="text-gray-600">
          Provider: <span className="font-medium">{providerDisplay || "—"}</span> · Profile:{" "}
          <span className="font-medium">{preview.profile || "—"}</span>
        </p>
      </header>

      {/* Grade card */}
      <section className="rounded-lg border p-6 bg-white space-y-3">
        <div className="text-3xl">
          ⭐ {typeof grade === "number" ? grade.toFixed(1) : "—"} / 5
        </div>
        <p className="text-sm text-gray-600">
          This is a preview grade. The full paid PDF includes model comparison, market cycle overlay,
          and personalized increase/decrease guidance.
        </p>
      </section>

      {/* Holdings list */}
      <section className="rounded-lg border p-6 bg-white">
        <h2 className="font-semibold">Your current holdings</h2>
        {cleanRows.length === 0 ? (
          <p className="text-sm text-gray-600 mt-2">No holdings to display.</p>
        ) : (
          <>
            <ul className="mt-3 text-sm text-gray-800 space-y-1">
              {cleanRows.map((r, idx) => (
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
