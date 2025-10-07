// src/app/grade/results/page.tsx
import Link from "next/link";
import { getMarketRegime } from "@/lib/market";

type Holding = { symbol: string; weight: number };
type SearchParams = {
  provider?: string;
  profile?: string;
  grade?: string;
  rows?: string; // encoded JSON
};

export const metadata = {
  title: "Your Grade | GradeYour401k",
};

export default async function ResultPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const provider = searchParams.provider ?? "";
  const profile = searchParams.profile ?? "";
  const grade = searchParams.grade ?? "—";

  // Optional: show the holdings the user passed along (for context, not mandatory)
  let rows: Holding[] = [];
  try {
    if (searchParams.rows) {
      rows = JSON.parse(decodeURIComponent(searchParams.rows));
      if (!Array.isArray(rows)) rows = [];
    }
  } catch {
    rows = [];
  }

  // Teaser-only: fetch market regime string (cached ~15min in lib/market)
  const regime = await getMarketRegime(); // e.g., "Market Cycle: Bull ..."

  // Build a link back to edit inputs with prefill
  const prefill = new URLSearchParams();
  if (provider) prefill.set("provider", provider);
  if (profile) prefill.set("profile", profile);
  if (rows.length) prefill.set("rows", encodeURIComponent(JSON.stringify(rows)));

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Your Grade</h1>

      <div className="rounded-lg border p-6 space-y-3">
        <p>
          <span className="font-medium">Provider:</span>{" "}
          {provider || "—"}
        </p>
        <p>
          <span className="font-medium">Profile:</span>{" "}
          {profile || "—"}
        </p>
        <p className="text-3xl">⭐ {grade} / 5</p>

        <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-900">
          <div className="font-medium mb-1">Market Cycle (teaser)</div>
          <div>{regime}</div>
          <div className="text-xs text-blue-800 mt-1">
            Full allocation adjustments based on market regime are included in the paid PDF report.
          </div>
        </div>

        <p className="text-sm text-gray-600">
          This is a preview grade only. Detailed “increase / reduce” suggestions,
          invalid/mixed ticker penalties, and model comparisons are in the full PDF.
        </p>
      </div>

      <div className="flex gap-3">
        <Link
          href={`/grade/new?${prefill.toString()}`}
          className="inline-block rounded-lg border px-4 py-2 hover:bg-gray-50"
        >
          Edit inputs
        </Link>
        <Link
          href="/pricing"
          className="inline-block rounded-lg border px-4 py-2 hover:bg-gray-50"
        >
          Unlock full PDF
        </Link>
      </div>
    </main>
  );
}
