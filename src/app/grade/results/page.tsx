// src/app/grade/results/page.tsx
import Link from "next/link";
import { sql } from "../../../lib/db"; // adjust if your alias/path differs

type SearchParams = { previewId?: string };
type Holding = { symbol: string; weight: number };

// ---- Starter label map (expand anytime) ----
const FUND_LABELS: Record<string, string> = {
  // Fidelity
  FSKAX: "Fidelity® Total Market Index",
  FXNAX: "Fidelity® U.S. Bond Index",
  FFGCX: "Fidelity® Global Commodity Stock",
  FXAIX: "Fidelity® 500 Index",
  FBND: "Fidelity® Total Bond ETF",
  FTEC: "Fidelity® MSCI Information Technology ETF",
  FREL: "Fidelity® MSCI Real Estate ETF",
  // Vanguard
  VOO: "Vanguard S&P 500 ETF",
  VTI: "Vanguard Total Stock Market ETF",
  BND: "Vanguard Total Bond Market ETF",
  VXUS: "Vanguard Total International Stock ETF",
  VIG: "Vanguard Dividend Appreciation ETF",
  // Schwab
  SCHB: "Schwab U.S. Broad Market ETF",
  SCHD: "Schwab U.S. Dividend Equity ETF",
  SCHZ: "Schwab U.S. Aggregate Bond ETF",
  // SPDR / State Street
  SPY: "SPDR S&P 500 ETF Trust",
  SPLG: "SPDR Portfolio S&P 500 ETF",
  XLU: "Utilities Select Sector SPDR",
  XLK: "Technology Select Sector SPDR",
  // iShares / BlackRock
  IVV: "iShares Core S&P 500 ETF",
  ITOT: "iShares Core S&P Total U.S. Stock Market ETF",
  AGG: "iShares Core U.S. Aggregate Bond ETF",
  IXUS: "iShares Core MSCI Total International Stock ETF",
  // Invesco
  QQQ: "Invesco QQQ Trust",
  SPLV: "Invesco S&P 500 Low Volatility ETF",
};

function labelFor(symRaw: string): string {
  const sym = (symRaw || "").toUpperCase().trim();
  const name = FUND_LABELS[sym];
  return name ? `${sym} — ${name}` : sym;
}

// ---- Stepper (mobile-friendly) ----
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

/** Compute a simple preliminary grade from holdings + profile.
 * Matches your /grade/new logic:
 * - Base by profile
 * - Penalty if weights don’t sum ~100%
 * - Clamp to [1,5] with half-star rounding
 */
function computePrelimGrade(profile: string, rows: Holding[]): number {
  const total = rows.reduce((s, r) => s + (Number.isFinite(r.weight) ? r.weight : 0), 0);
  const base =
    profile === "Growth" ? 4.3 : profile === "Balanced" ? 3.8 : 3.3;
  const penalty = Math.min(1, Math.abs(100 - total) / 100);
  const score = Math.max(1, Math.min(5, Math.round((base - penalty) * 2) / 2));
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

  // Load preview (works for uuid/bigint thanks to ::text on id)
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

  const idText = String(p.id);
  const providerDisplay: string = p.provider_display || p.provider || "—";
  const profile: string = p.profile || "—";

  // Parse holdings
  let holdings: Holding[] = [];
  try {
    const raw = p.rows;
    const arr = Array.isArray(raw) ? raw : JSON.parse(raw);
    holdings = (arr as any[])
      .map((r) => ({
        symbol: String(r?.symbol || "").toUpperCase(),
        weight: Number(r?.weight || 0),
      }))
      .filter((r) => r.symbol && Number.isFinite(r.weight));
  } catch {
    holdings = [];
  }

  // Use stored grade if present; otherwise compute preliminary
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

  const totalOk = Math.abs(total - 100) < 0.1;

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-8">
      <Stepper current={2} />

      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Your Grade</h1>
        <p className="text-gray-600">
          Provider: <span className="font-medium">{providerDisplay}</span> ·{" "}
          Profile: <span className="font-medium">{profile}</span>
        </p>
      </header>

      {/* Grade card */}
      <section className="rounded-xl border p-6 bg-white space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-3xl font-semibold">
            ⭐ <span className="align-middle">{grade}</span>{" "}
            <span className="text-base align-middle text-gray-500">/ 5</span>
          </div>
          {!totalOk && (
            <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">
              Weights should total 100% (currently {total.toFixed(1)}%)
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600">
          This is a preliminary grade. Upgrade to the{" "}
          <span className="font-medium">optimized PDF report</span> to see:
          model match vs. your holdings, market-cycle tilt, and precise
          increase/decrease actions by fund.
        </p>
        <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm">
          <span className="font-semibold text-blue-800">Make your 401(k) 5-Stars:</span>{" "}
          get an <span className="font-medium">Optimized Report</span> with step-by-step
          changes you can implement today.
        </div>
      </section>

      {/* Holdings list */}
      <section className="rounded-xl border p-6 bg-white">
        <h2 className="font-semibold">Your current holdings</h2>
        {holdings.length === 0 ? (
          <p className="text-sm text-gray-600 mt-2">No holdings to display.</p>
        ) : (
          <>
            <ul className="mt-3 text-sm text-gray-800 space-y-2">
              {holdings.map((r, idx) => (
                <li
                  key={`${r.symbol}-${idx}`}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-mono truncate">{labelFor(r.symbol)}</div>
                  </div>
                  <div className="shrink-0 tabular-nums">{(Number(r.weight) || 0).toFixed(1)}%</div>
                </li>
              ))}
            </ul>
            <div className="mt-3 text-xs text-gray-500">
              Total: {total.toFixed(1)}%
            </div>
          </>
        )}
      </section>

      {/* What you get with the full report — concise & persuasive */}
      <section className="rounded-xl border p-6 bg-white">
        <h2 className="font-semibold">What you get with the full report</h2>
        <ul className="list-disc list-inside text-sm text-gray-800 mt-2 space-y-1">
          <li><strong>Clear actions</strong> to increase, decrease, or replace specific funds.</li>
          <li><strong>Model match</strong> to a curated ETF allocation for your profile.</li>
          <li><strong>Market-aware tilt</strong> using SPY 30/50/100/200-day trend.</li>
          <li><strong>Polished PDF</strong> delivered to your inbox—ready to implement or share.</li>
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
          href={`/grade/new?previewId=${encodeURIComponent(idText)}`}
          className="inline-flex items-center justify-center rounded-lg border px-5 py-2 hover:bg-gray-50"
        >
          Edit inputs
        </Link>
      </div>
    </main>
  );
}
