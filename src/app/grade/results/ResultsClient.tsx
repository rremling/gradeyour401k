"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type PreviewRow = { symbol?: string; weight?: number | string };
type Preview = {
  ok: boolean;
  provider?: string | null;
  provider_display?: string | null;
  profile?: string | null;
  rows?: PreviewRow[];
  grade_base?: number | null;
  grade_adjusted?: number | null;
};

type ModelLine = { symbol: string; weight: number; role: string | null };
type ModelResponse = {
  ok: boolean;
  asof?: string;
  provider?: string;
  profile?: string;
  fear_greed?: { asof_date: string; reading: number } | null;
  lines?: ModelLine[];
};

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
    </div>
  );
}

export default function ResultsClient() {
  const sp = useSearchParams();

  const providerParam = sp.get("provider") || "";
  const profileParam = sp.get("profile") || "";
  const gradeParam = sp.get("grade") || "—";
  const previewId = sp.get("previewId") || "";

  const [loading, setLoading] = useState<boolean>(!!previewId);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [model, setModel] = useState<ModelResponse | null>(null);

  // ---- Fetch user preview ----
  useEffect(() => {
    let active = true;
    async function load() {
      if (!previewId) return;
      try {
        setLoading(true);
        const res = await fetch(`/api/preview/get?id=${encodeURIComponent(previewId)}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as Preview;
        if (!active) return;
        if (!res.ok || !data?.ok) {
          setError("Could not load your saved preview.");
          setPreview(null);
        } else {
          setPreview(data);
          setError(null);
        }
      } catch (e: any) {
        if (!active) return;
        setError(e?.message || "Failed to fetch preview.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [previewId]);

  // ---- Fetch recommended model + fear/greed ----
  useEffect(() => {
    async function loadModel() {
      if (!providerParam || !profileParam) return;
      try {
        const q = new URLSearchParams({
          provider: providerParam,
          profile: profileParam,
        }).toString();
        const res = await fetch(`/api/models/latest?${q}`, { cache: "no-store" });
        const json = (await res.json()) as ModelResponse;
        if (json?.ok) setModel(json);
      } catch (e) {
        console.warn("model fetch failed:", e);
      }
    }
    loadModel();
  }, [providerParam, profileParam]);

  const providerDisplay = useMemo(() => {
    return preview?.provider_display || providerParam || preview?.provider || "—";
  }, [preview, providerParam]);

  // Clean holdings: drop meta/invalid rows and coerce weights safely
  const rows = useMemo(() => {
    const raw = preview?.rows || [];
    return raw
      .filter((r) => r && typeof r.symbol === "string" && r.symbol.trim() !== "")
      .map((r) => ({
        symbol: (r.symbol as string).toUpperCase(),
        weight: Number(r.weight ?? 0),
      }))
      .filter((r) => Number.isFinite(r.weight));
  }, [preview]);

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <Stepper current={2} />
      <h1 className="text-2xl font-bold">Your Grade</h1>

      <div className="rounded-lg border p-6 space-y-3 bg-white">
        <p>
          <span className="font-medium">Provider:</span> {providerDisplay}
        </p>
        <p>
          <span className="font-medium">Profile:</span>{" "}
          {profileParam || preview?.profile || "—"}
        </p>
        <p className="text-3xl">⭐ {gradeParam} / 5</p>
        {model?.fear_greed && (
          <p className="text-sm text-gray-700">
            Market Sentiment (Fear/Greed):{" "}
            <span className="font-semibold">{model.fear_greed.reading}</span>
          </p>
        )}
        <p className="text-sm text-gray-600">
          This is a preview grade. The full PDF report (with model comparison and
          market overlay) is sent after purchase.
        </p>
      </div>

      {/* User holdings */}
      {loading && (
        <div className="rounded-lg border p-4 bg-white text-sm text-gray-600">
          Loading your holdings…
        </div>
      )}
      {!loading && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {!loading && !error && rows.length > 0 && (
        <section className="rounded-lg border p-6 bg-white">
          <h2 className="text-lg font-semibold mb-3">Your current holdings</h2>
          <div className="grid grid-cols-12 text-sm font-medium border-b pb-2">
            <div className="col-span-8">Symbol</div>
            <div className="col-span-4 text-right">Weight %</div>
          </div>
          <div className="divide-y">
            {rows.map((r, i) => (
              <div key={`${r.symbol}-${i}`} className="grid grid-cols-12 py-2 text-sm">
                <div className="col-span-8">{r.symbol}</div>
                <div className="col-span-4 text-right">
                  {Number(r.weight).toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recommended model overlay */}
      {model?.lines && model.lines.length > 0 && (
        <section className="rounded-lg border p-6 bg-white">
          <h2 className="text-lg font-semibold mb-3">
            Recommended {model.provider} / {model.profile} Model
          </h2>
          <div className="grid grid-cols-12 text-sm font-medium border-b pb-2">
            <div className="col-span-7">Symbol</div>
            <div className="col-span-3 text-right">Weight %</div>
            <div className="col-span-2 text-right">Role</div>
          </div>
          <div className="divide-y">
            {model.lines.map((r, i) => (
              <div key={`${r.symbol}-${i}`} className="grid grid-cols-12 py-2 text-sm">
                <div className="col-span-7">{r.symbol}</div>
                <div className="col-span-3 text-right">{(r.weight * 100).toFixed(1)}</div>
                <div className="col-span-2 text-right text-gray-600">{r.role}</div>
              </div>
            ))}
          </div>
          {model.asof && (
            <p className="text-xs text-gray-500 mt-2">
              Model as of {model.asof.slice(0, 10)}
            </p>
          )}
        </section>
      )}

      {/* Reasons to buy + CTA */}
      <section className="rounded-lg border p-6 bg-white space-y-4">
        <h2 className="text-lg font-semibold">Why buy the full report?</h2>
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
          <li>Personalized model comparison against your actual 401(k) menu</li>
          <li>Allocation guidance with suggested increases/decreases by holding</li>
          <li>Market cycle overlay using SPY 30/50/100/200-day SMAs</li>
          <li>Clean, shareable PDF with your star grade and allocation map</li>
          <li>Annual plan: three additional updates</li>
        </ul>
        <div className="flex gap-3">
          <Link
            href="/pricing"
            className="inline-block rounded-lg bg-blue-600 text-white px-4 py-2 hover:bg-blue-700"
          >
            Buy report
          </Link>
          <Link
            href="/grade/new"
            className="inline-block rounded-lg border px-4 py-2 hover:bg-gray-50"
          >
            Edit inputs
          </Link>
        </div>
      </section>
    </main>
  );
}
