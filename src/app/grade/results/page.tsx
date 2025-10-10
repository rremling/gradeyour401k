// src/app/grade/result/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type PreviewRow = { symbol: string; weight: number };
type Preview = {
  ok: boolean;
  provider?: string | null;
  provider_display?: string | null;
  profile?: string | null;
  rows?: PreviewRow[];
  grade_base?: number | null;
  grade_adjusted?: number | null;
};

export default function ResultPage() {
  const sp = useSearchParams();

  const providerParam = sp.get("provider") || "";
  const profileParam = sp.get("profile") || "";
  const gradeParam = sp.get("grade") || "—";
  const previewId = sp.get("previewId") || "";

  const [loading, setLoading] = useState<boolean>(!!previewId);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const providerDisplay = useMemo(() => {
    return preview?.provider_display || providerParam || preview?.provider || "—";
  }, [preview, providerParam]);

  const rows = preview?.rows || [];

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Your Grade</h1>

      <div className="rounded-lg border p-6 space-y-3 bg-white">
        <p>
          <span className="font-medium">Provider:</span>{" "}
          {providerDisplay}
        </p>
        <p>
          <span className="font-medium">Profile:</span>{" "}
          {profileParam || preview?.profile || "—"}
        </p>
        <p className="text-3xl">⭐ {gradeParam} / 5</p>
        <p className="text-sm text-gray-600">
          This is a preview grade. The full PDF report (with model comparison
          and market overlay) is sent after purchase.
        </p>
      </div>

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
                <div className="col-span-4 text-right">{Number(r.weight).toFixed(1)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex gap-3">
        <Link
          href="/pricing"
          className="inline-block rounded-lg border px-4 py-2 hover:bg-gray-50"
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
    </main>
  );
}
