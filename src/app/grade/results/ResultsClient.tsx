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

function computePrelimGrade(profile: string, rows: Holding[]): number {
  const weights = rows.map((r) => (Number.isFinite(r.weight) ? r.weight : 0));
  const total = weights.reduce((s, n) => s + n, 0);

  let base =
    profile === "Aggressive Growth" ? 4.5 :
    profile === "Balanced" ? 3.8 :
    4.1;

  const off = Math.abs(100 - total);
  if (off > 0.25) base -= Math.min(1, off / 100);
  if (Math.max(0, ...weights) > 60) base -= 0.2;

  return Math.max(1, Math.min(5, Math.round(base * 2) / 2));
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

  async function handleMakeShareLink() {
    try {
      setShareError(null);
      if (!preview) return;
      const provider = (preview.provider_display || preview.provider || "").toString();
      const profile = (preview.profile || "").toString();
      const gradeNumber =
        Number(preview.grade_adjusted) ||
        Number(preview.grade_base) ||
        0;

      if (!provider || !profile || !Number.isFinite(gradeNumber) || gradeNumber <= 0) {
        setShareError("Grade not ready to share.");
        return;
      }

      setShareWorking(true);

      const res = await fetch("/api/share/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Only redacted fields — no PII
        body: JSON.stringify({
          provider,
          profile,
          grade: (Math.round(gradeNumber * 10) / 10).toFixed(1), // e.g., "4.3"
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

      // NOTE: removed automatic navigator.share invocation
      // Clicking "Share your grade" now only reveals the menu.
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

  // ───────────────────────────────────────────────────────────────────────────

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
    () =>
      preview?.provider_display ||
      preview?.provider ||
      "—",
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

  const gradeNum: number = useMemo(() => {
    const ga = Number(preview?.grade_adjusted);
    const gb = Number(preview?.grade_base);
    if (Number.isFinite(ga)) return ga;
    if (Number.isFinite(gb)) return gb;
    return holdings.length ? computePrelimGrade(profile, holdings) : 0;
  }, [preview, holdings, profile]);

  const grade = gradeNum ? gradeNum.toFixed(1) : "—";
  const total = holdings.reduce((s, r) => s + (Number.isFinite(r.weight) ? r.weight : 0), 0);

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
                    className={`h-full ${
                      Math.abs(100 - total) < 0.1 ? "bg-emerald-500" : "bg-yellow-500"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, total))}%` }}
                  />
                </div>
                <div className="text-xs text-gray-600 mt-1">{total.toFixed(1)}% (target 100%)</div>
              </div>
            </div>

            {/* ─── NEW: Share controls (PII-safe) ─────────────────────────── */}
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
        </>
      )}
    </main>
  );
}
