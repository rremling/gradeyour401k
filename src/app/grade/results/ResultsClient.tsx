// src/app/grade/results/ResultsClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FUND_LABELS, labelFor } from "@/lib/funds";

type Holding = { symbol: string; weight: number };
type Preview = {
  ok: boolean;
  id?: string;
  provider?: string | null;
  provider_display?: string | null;
  profile?: string | null;
  rows?: Array<{ symbol?: string; weight?: number | string }>;
  grade_base?: number | string | null;
  grade_adjusted?: number | string | null;
};

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

// ─────────────── Grade logic: diversification, family, provider, bonds ─────────
function isBondSymbol(sym: string): boolean {
  // Heuristic via label keywords
  const lbl = (labelFor(sym) || "").toLowerCase();
  return /bond|treasury|fixed income|aggregate|corporate|muni|municipal|income/.test(lbl);
}

function fundFamily(sym: string): string {
  // First word of the label often carries the family (e.g., "Fidelity 500 Index")
  const lbl = (labelFor(sym) || "").trim();
  if (!lbl) return "";
  const first = lbl.split(/\s+/)[0];
  return first || "";
}

function computeSmartGrade(profile: string, rows: Holding[], providerDisplay: string): number {
  const weights = rows.map((r) => (Number.isFinite(r.weight) ? r.weight : 0));
  const total = weights.reduce((s, n) => s + n, 0);

  // Baseline by profile
  let base =
    profile === "Aggressive Growth" ? 4.4 :
    profile === "Balanced" ? 4.0 :
    4.2;

  // Keep total allocation near 100%
  const off = Math.abs(100 - total);
  if (off > 0.25) base -= Math.min(0.8, off / 100); // small, linear penalty

  // Position concentration sanity check: >60% in a single fund is a small ding
  if (Math.max(0, ...weights) > 60) base -= 0.2;

  // Diversification: sweet spot is 6–8 holdings
  const n = rows.length;
  if (n >= 6 && n <= 8) {
    base += 0.35; // reward sweet spot
  } else {
    // gentle penalty as we move away from the sweet spot
    const dist = Math.min(Math.abs(n - 7), 10);
    base -= dist * 0.05; // max -0.5
  }

  // Provider list usage: credit symbols that exist in our map (treated as curated list)
  const curatedCount = rows.filter((r) => !!FUND_LABELS[(r.symbol || "").toUpperCase()]).length;
  if (n > 0) {
    const curatedRatio = curatedCount / n; // 0..1
    base += (curatedRatio - 0.6) * 0.5; // bonus if >60% curated, up to +0.2; small ding if far below
  }

  // Fund family alignment: encourage staying within a family (clean implementation path)
  // Weight share of the dominant family
  const familyWeights: Record<string, number> = {};
  rows.forEach((r) => {
    const fam = fundFamily(r.symbol);
    familyWeights[fam] = (familyWeights[fam] || 0) + (Number(r.weight) || 0);
  });
  const topFamily = Object.entries(familyWeights).sort((a, b) => b[1] - a[1])[0];
  const topFamilyPct = topFamily ? topFamily[1] : 0;

  // If top family carries 55–85% of the weight, give a modest bonus (implementation simplicity & fee cohesion)
  if (topFamilyPct >= 55 && topFamilyPct <= 85) {
    base += 0.25;
  } else if (topFamilyPct > 90) {
    // Avoid over-concentration in a single family
    base -= 0.1;
  }

  // Bonds penalty: discourage excessive bond weight in high inflation
  const bondPct = rows.reduce((s, r) => s + (isBondSymbol(r.symbol) ? (Number(r.weight) || 0) : 0), 0);
  // Thresholds by profile
  const bondThresh =
    profile === "Aggressive Growth" ? 20 :
    profile === "Balanced" ? 35 :
    50;
  if (bondPct > bondThresh) {
    // scale penalty with overshoot; cap so it doesn't dominate
    const overshoot = bondPct - bondThresh; // e.g., 55% bonds in Balanced -> 20% overshoot
    base -= Math.min(0.9, overshoot * 0.03); // -0.03 per point over threshold
  }

  // Clamp and half-star rounding
  const clamped = Math.max(1, Math.min(5, base));
  return Math.round(clamped * 2) / 2;
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

export default function ResultsClient() {
  const sp = useSearchParams();
  const previewId = (sp.get("previewId") || "").trim();

  const [loading, setLoading] = useState<boolean>(!!previewId);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  // ─── NEW: share state ──────────────────────────────────────────────────────
  const [shareUrl, setShareUrl] = useState<string>("");
  const [shareId, setShareId] = useState<string>(""); // store id for image download
  const [shareWorking, setShareWorking] = useState<boolean>(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // ─── NEW: persist the user's holdings locally for seamless "Edit inputs" ───
  useEffect(() => {
    // As soon as we have preview/rows, persist a light, PII-free snapshot for re-entry
    if (!preview) return;
    const rows = Array.isArray(preview.rows) ? preview.rows : [];
    const normalized: Holding[] = rows
      .map((r) => ({
        symbol: String(r?.symbol || "").toUpperCase().trim(),
        weight: Number(r?.weight ?? 0),
      }))
      .filter((r) => r.symbol && Number.isFinite(r.weight));

    // Only persist if we actually have holdings
    if (normalized.length > 0 && typeof window !== "undefined") {
      const payload = {
        previewId,
        provider: preview.provider_display || preview.provider || null,
        profile: preview.profile || null,
        rows: normalized,
        savedAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem("gy401k:lastPreview", JSON.stringify(payload));
      } catch {
        // ignore quota issues
      }
    }
  }, [preview, previewId]);

  async function handleMakeShareLink() {
    try {
      setShareError(null);
      if (!preview) return;
      const provider = (preview.provider_display || preview.provider || "").toString();
      const profile = (preview.profile || "").toString();

      // Use the on-page computed grade
      const gradeNumber = Number(gradeNum);

      if (!provider || !profile || !Number.isFinite(gradeNumber) || gradeNumber <= 0) {
        setShareError("Grade not ready to share.");
        return;
      }

      setShareWorking(true);

      const res = await fetch("/api/share/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          profile,
          grade: (Math.round(gradeNumber * 10) / 10).toFixed(1), // e.g., "4.5"
          as_of_date: new Date().toISOString().slice(0, 10),     // YYYY-MM-DD
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.id) {
        throw new Error(data?.error || "Failed to create share link");
      }

      const url = `${window.location.origin}/share/${data.id}`;
      setShareUrl(url);
      setShareId(data.id);
    } catch (e: any) {
      setShareError(e?.message || "Could not create share link.");
    } finally {
      setShareWorking(false);
    }
  }

  function copyLink() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  // download the OG image PNG for the created share id
  async function handleDownloadImage() {
    if (!shareId) return;
    const res = await fetch(`/api/share/og/${encodeURIComponent(shareId)}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-401k-grade.png";
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    let alive = true;
    async function run() {
      if (!previewId) {
        setLoading(false);
        setError("Missing previewId");
        return;
      }
      try {
        setLoading(true);
        const res = await fetch(`/api/preview/get?id=${encodeURIComponent(previewId)}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as Preview;
        if (!alive) return;
        if (!res.ok || !data?.ok) {
          setError((data as any as string) || "Failed to load preview");
          setPreview(null);
        } else {
          setPreview(data);
          setError(null);
        }
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load preview");
        setPreview(null);
      } finally {
        if (alive) setLoading(false);
      }
    }
    run();
    return () => { alive = false; };
  }, [previewId]);

  const providerDisplay = useMemo(
    () => preview?.provider_display || preview?.provider || "—",
    [preview]
  );

  const profile = preview?.profile || "—";

  // Normalize holdings array defensively
  const holdings: Holding[] = useMemo(() => {
    const raw = preview?.rows;
    if (!raw) return [];
    const arr = Array.isArray(raw) ? raw : [];
    return arr
      .map((r) => ({
        symbol: String(r?.symbol || "").toUpperCase().trim(),
        weight: Number(r?.weight ?? 0),
      }))
      .filter((r) => r.symbol && Number.isFinite(r.weight));
  }, [preview]);

  // NEW: always compute the on-page grade with the updated rubric
  const gradeNum: number = useMemo(() => {
    return holdings.length ? computeSmartGrade(profile, holdings, providerDisplay) : 0;
  }, [holdings, profile, providerDisplay]);

  const grade = gradeNum ? gradeNum.toFixed(1) : "—";
  const total = holdings.reduce((s, r) => s + (Number.isFinite(r.weight) ? r.weight : 0), 0);

  // Quick stats for the description
  const bondsPct = useMemo(
    () => holdings.reduce((s, r) => s + (isBondSymbol(r.symbol) ? (Number(r.weight) || 0) : 0), 0),
    [holdings]
  );
  const curatedCount = useMemo(
    () => holdings.filter((r) => !!FUND_LABELS[(r.symbol || "").toUpperCase()]).length,
    [holdings]
  );
  const familyWeights: Record<string, number> = useMemo(() => {
    const m: Record<string, number> = {};
    holdings.forEach((r) => {
      const fam = fundFamily(r.symbol);
      m[fam] = (m[fam] || 0) + (Number(r.weight) || 0);
    });
    return m;
  }, [holdings]);
  const topFamily = useMemo(
    () => Object.entries(familyWeights).sort((a, b) => b[1] - a[1])[0],
    [familyWeights]
  );
  const topFamilyName = topFamily?.[0] || "—";
  const topFamilyPct = topFamily?.[1] || 0;

  // Helper for social links once shareUrl exists
  const enc = (s: string) => encodeURIComponent(s);
  const xUrl  = shareUrl ? `https://twitter.com/intent/tweet?text=${enc("Just got my 401(k) graded on GradeYour401k!")}&url=${enc(shareUrl)}` : "";
  const liUrl = shareUrl ? `https://www.linkedin.com/sharing/share-offsite/?url=${enc(shareUrl)}` : "";
  const fbUrl = shareUrl ? `https://www.facebook.com/sharer/sharer.php?u=${enc(shareUrl)}` : "";

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-8">
      <Stepper current={2} />

      <h1 className="text-2xl font-bold">Your 401(k) Grade</h1>

      {loading && (
        <div className="rounded border p-4 bg-white text-sm text-gray-600">Loading…</div>
      )}

      {!loading && error && (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Grade card */}
          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <Stars value={gradeNum} />
                  <div className="text-3xl font-semibold">{grade} / 5</div>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Provider: <span className="font-medium">{providerDisplay}</span> · Profile:{" "}
                  <span className="font-medium">{profile}</span>
                </p>
              </div>
              <div className="text-right hidden sm:block">
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

            {/* NEW: brief explanation of how this grade is computed */}
            <div className="mt-4 text-sm text-gray-700 border-t pt-4">
              <p className="mb-2">
                <span className="font-medium">How we scored this:</span> We reward{" "}
                <span className="font-medium">diversification</span> (sweet spot is 6–8 funds), give credit for{" "}
                <span className="font-medium">using curated plan funds</span> and for{" "}
                <span className="font-medium">staying within a single fund family</span> for clean implementation, and
                apply a penalty for <span className="font-medium">excessive bond exposure</span> in high-inflation environments.
                Market-cycle tuning is <span className="font-medium">not</span> applied to this free grade—it <span className="font-medium">is</span> included in the Optimized 401(k) Report below.
              </p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>Funds held: <span className="font-medium">{holdings.length}</span> (target 6–8)</li>
                <li>From plan list: <span className="font-medium">{curatedCount}</span> / {holdings.length || 0}</li>
                <li>Top fund family: <span className="font-medium">{topFamilyName}</span> (~{topFamilyPct.toFixed(1)}% of weight)</li>
                <li>Bond allocation: <span className="font-medium">{bondsPct.toFixed(1)}%</span></li>
              </ul>
            </div>

            {/* ─── Share controls (PII-safe) ─────────────────────────── */}
            <div className="mt-4 border-t pt-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  onClick={handleMakeShareLink}
                  disabled={shareWorking}
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 text-white px-4 py-2.5 hover:bg-blue-700 disabled:opacity-60"
                >
                  {shareWorking ? "Preparing share link…" : "Share your grade"}
                </button>

                {shareError && (
                  <span className="text-sm text-red-600">{shareError}</span>
                )}

                {shareUrl && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => {
                        if (navigator.share) {
                          navigator.share({
                            title: "My 401(k) Grade",
                            text: "Just got my 401(k) graded on GradeYour401k!",
                            url: shareUrl,
                          }).catch(() => {});
                        } else {
                          copyLink();
                        }
                      }}
                      className="rounded-lg border px-3 py-2 hover:bg-gray-50"
                    >
                      System Share
                    </button>
                    <a className="rounded-lg border px-3 py-2 hover:bg-gray-50" href={xUrl} target="_blank" rel="noopener noreferrer">
                      X/Twitter
                    </a>
                    <a className="rounded-lg border px-3 py-2 hover:bg-gray-50" href={liUrl} target="_blank" rel="noopener noreferrer">
                      LinkedIn
                    </a>
                    <a className="rounded-lg border px-3 py-2 hover:bg-gray-50" href={fbUrl} target="_blank" rel="noopener noreferrer">
                      Facebook
                    </a>
                    <button onClick={handleDownloadImage} className="rounded-lg border px-3 py-2 hover:bg-gray-50">
                      Download share image
                    </button>
                    <button onClick={copyLink} className="rounded-lg border px-3 py-2 hover:bg-gray-50">
                      {copied ? "Copied!" : "Copy link"}
                    </button>
                  </div>
                )}
              </div>
              {shareUrl && (
                <p className="text-xs text-gray-500 mt-1 break-all">{shareUrl}</p>
              )}
            </div>
            {/* ─────────────────────────────────────────────────────────────── */}
          </section>

          {/* Holdings list */}
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
                      <div className="shrink-0 font-medium">
                        {(Number(r.weight) || 0).toFixed(1)}%
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-2 text-xs text-gray-500">Total: {total.toFixed(1)}%</div>
          </section>

          {/* CTA */}
          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="font-semibold">⭐⭐⭐⭐⭐ Get Your 5-Star Optimized 401(k) Report</h2>

            <p className="text-sm text-gray-700 mt-2">
              Unlock a personalized PDF that shows exactly how to align your 401(k) with your investor profile and the current market.
            </p>

            <ul className="list-disc list-inside text-sm text-gray-800 mt-3 space-y-1">
              <li><span className="font-medium">Precise Target Allocations</span> – See your ideal portfolio weights and fund matches.</li>
              <li><span className="font-medium">Specific Fund Changes</span> – Know exactly what to adjust to reach your optimized mix.</li>
              <li><span className="font-medium">Market-Tuned Strategy</span> – Stay in step with today’s leading investment trends.</li>
              <li><span className="font-medium">Clear Next Steps</span> – No guesswork, just actionable guidance you can implement confidently.</li>
            </ul>

            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 text-white px-5 py-2.5 hover:bg-blue-700"
              >
                Buy optimized report
              </Link>
              <Link
                href={`/grade/new?previewId=${encodeURIComponent(previewId)}&from=results`}
                className="inline-flex items-center justify-center rounded-lg border px-5 py-2.5 hover:bg-gray-50"
              >
                Edit inputs
              </Link>
            </div>

            <p className="text-xs text-gray-500 mt-2">
              You can revisit and tweak your entries—your preview is linked above.
            </p>
          </section>
        </>
      )}
    </main>
  );
}
