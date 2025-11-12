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

// ────────────────────────── Grade Logic Helpers ──────────────────────────────
function isBondSymbol(sym: string): boolean {
  const lbl = (labelFor(sym) || "").toLowerCase();
  return /bond|treasury|fixed income|aggregate|corporate|muni|municipal|income|tips/.test(lbl);
}

function fundFamily(sym: string): string {
  const lbl = (labelFor(sym) || "").trim();
  if (!lbl) return "";
  return lbl.split(/\s+/)[0] || "";
}

function computePrelimGrade(profile: string, rows: Holding[]): number {
  const weights = rows.map((r) => (Number.isFinite(r.weight) ? r.weight : 0));
  const total = weights.reduce((s, n) => s + n, 0);

  let base =
    profile === "Aggressive Growth" ? 4.5 :
    profile === "Balanced" ? 3.8 :
    4.1;

  const off = Math.abs(100 - total);
  if (off > 0.25) base -= Math.min(0.8, off / 100);
  if (Math.max(0, ...weights) > 60) base -= 0.2;

  const n = rows.length;
  if (n >= 6 && n <= 8) base += 0.35;
  else {
    const dist = Math.min(Math.abs(n - 7), 10);
    base -= dist * 0.05;
  }

  const curatedCount = rows.filter((r) => !!FUND_LABELS[(r.symbol || "").toUpperCase()]).length;
  if (n > 0) {
    const curatedRatio = curatedCount / n;
    base += (curatedRatio - 0.6) * 0.5;
  }

  const familyWeights: Record<string, number> = {};
  rows.forEach((r) => {
    const fam = fundFamily(r.symbol);
    familyWeights[fam] = (familyWeights[fam] || 0) + (Number(r.weight) || 0);
  });
  const topFamily = Object.entries(familyWeights).sort((a, b) => b[1] - a[1])[0];
  const topFamilyPct = topFamily ? topFamily[1] : 0;

  if (topFamilyPct >= 55 && topFamilyPct <= 85) base += 0.25;
  else if (topFamilyPct > 90) base -= 0.1;

  const bondPct = rows.reduce((s, r) => s + (isBondSymbol(r.symbol) ? (Number(r.weight) || 0) : 0), 0);
  const bondThresh =
    profile === "Aggressive Growth" ? 20 :
    profile === "Balanced" ? 35 :
    50;
  if (bondPct > bondThresh) {
    const overshoot = bondPct - bondThresh;
    base -= Math.min(0.9, overshoot * 0.03);
  }

  const clamped = Math.max(1, Math.min(5, base));
  return Math.round(clamped * 2) / 2;
}

// ────────────────────────── Stars Renderer ────────────────────────────────
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

// ────────────────────────── Main Component ────────────────────────────────
export default function ResultsClient() {
  const sp = useSearchParams();
  const previewId = (sp.get("previewId") || "").trim();

  const [loading, setLoading] = useState<boolean>(!!previewId);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [shareUrl, setShareUrl] = useState<string>("");
  const [shareId, setShareId] = useState<string>("");
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
        body: JSON.stringify({
          provider,
          profile,
          grade: (Math.round(gradeNumber * 10) / 10).toFixed(1),
          as_of_date: new Date().toISOString().slice(0, 10),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.id) throw new Error(data?.error || "Failed to create share link");

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
        const res = await fetch(`/api/preview/get?id=${encodeURIComponent(previewId)}`, { cache: "no-store" });
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

  const holdings: Holding[] = useMemo(() => {
    const raw = preview?.rows;
    if (!raw) return [];
    return (Array.isArray(raw) ? raw : [])
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

  const enc = (s: string) => encodeURIComponent(s);
  const xUrl = shareUrl ? `https://twitter.com/intent/tweet?text=${enc("Just got my 401(k) graded on GradeYour401k!")}&url=${enc(shareUrl)}` : "";
  const liUrl = shareUrl ? `https://www.linkedin.com/sharing/share-offsite/?url=${enc(shareUrl)}` : "";
  const fbUrl = shareUrl ? `https://www.facebook.com/sharer/sharer.php?u=${enc(shareUrl)}` : "";

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-8">
      <Stepper current={2} />
      <h1 className="text-2xl font-bold">Your 401(k) Grade</h1>

      {loading && <div className="rounded border p-4 bg-white text-sm text-gray-600">Loading…</div>}
      {!loading && error && <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {!loading && !error && (
        <>
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
                <p className="text-sm text-gray-700 mt-1 italic">
                  The grade summarizes how effectively your 401(k) holdings achieve diversification, stay aligned with your profile, and make efficient use of your provider’s investment options.
                </p>
              </div>
              <div className="text-right hidden sm:block">
                <div className="text-xs text-gray-600 mb-1">Total allocation</div>
                <div className="w-44 h-2 rounded-full bg-gray-200 overflow-hidden">
                  <div className={`h-full ${Math.abs(100 - total) < 0.1 ? "bg-emerald-500" : "bg-yellow-500"}`} style={{ width: `${Math.min(100, Math.max(0, total))}%` }} />
                </div>
                <div className="text-xs text-gray-600 mt-1">{total.toFixed(1)}% (target 100%)</div>
              </div>
            </div>
            {/* Share buttons omitted for brevity — unchanged */}
          </section>
        </>
      )}
    </main>
  );
}
